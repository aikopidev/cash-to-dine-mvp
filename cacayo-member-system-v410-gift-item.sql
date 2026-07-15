-- CACAYO Member System v4.1.0
-- Gift Item + 23:59:59 Jakarta expiry normalization
--
-- Required base:
-- - Security Foundation v3
-- - Single Balance Expiry v3.1.1
-- - Generic Gift v3.2.2
-- - White Label UI database v4.0.0
-- - Search Fix v4.0.1

begin;

-- ================================================================
-- 0. PRE-FLIGHT
-- ================================================================
do $preflight$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regprocedure('public.ctd_require_staff(text,text[])') is null then
    v_missing:=array_append(v_missing,'ctd_require_staff');
  end if;
  if to_regprocedure('public.ctd_new_token()') is null then
    v_missing:=array_append(v_missing,'ctd_new_token');
  end if;
  if to_regprocedure('public.ctd_token_hash(text)') is null then
    v_missing:=array_append(v_missing,'ctd_token_hash');
  end if;
  if to_regprocedure('public.ctd_expire_wallet_if_due(uuid)') is null then
    v_missing:=array_append(v_missing,'ctd_expire_wallet_if_due');
  end if;
  if to_regprocedure('public.mvp_generate_gift_codes_batch(uuid,text,bigint,date,integer)') is null then
    v_missing:=array_append(v_missing,'mvp_generate_gift_codes_batch');
  end if;
  if to_regclass('public.gift_codes') is null then
    v_missing:=array_append(v_missing,'gift_codes');
  end if;
  if not exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='gift_codes'
      and column_name='code_type'
  ) then
    v_missing:=array_append(v_missing,'gift_codes.code_type');
  end if;
  if cardinality(v_missing)>0 then
    raise exception 'v4.1.0 stopped. Missing: %',array_to_string(v_missing,', ');
  end if;
end
$preflight$;

-- ================================================================
-- 1. END-OF-DAY EXPIRY STANDARD
-- ================================================================
create or replace function public.ctd_jakarta_end_of_day(p_date date)
returns timestamptz
language sql
immutable
set search_path=public
as $function$
  select ((p_date + time '23:59:59') at time zone 'Asia/Jakarta')
$function$;

revoke all on function public.ctd_jakarta_end_of_day(date)
from public,anon,authenticated;

create or replace function public.ctd_jakarta_today()
returns date
language sql
stable
set search_path=public
as $function$
  select (now() at time zone 'Asia/Jakarta')::date
$function$;

revoke all on function public.ctd_jakarta_today()
from public,anon,authenticated;

update public.wallets
set expires_at=public.ctd_jakarta_end_of_day(
  (expires_at at time zone 'Asia/Jakarta')::date
)
where expires_at is not null
  and expires_at<>public.ctd_jakarta_end_of_day(
    (expires_at at time zone 'Asia/Jakarta')::date
  );

drop function if exists public.s3_topup_member(
  text,uuid,bigint,bigint,text,text,integer
);

create function public.s3_topup_member(
  p_staff_session_token text,
  p_member_id uuid,
  p_cash_paid bigint,
  p_credit_issued bigint,
  p_invoice_number text,
  p_package_name text default 'NICKEL',
  p_valid_months int default 2
)
returns table(
  new_balance bigint,
  expires_at timestamptz,
  package_name text,
  credit_issued bigint,
  cash_paid bigint
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_package text;
  v_cash bigint;
  v_credit bigint;
  v_months int;
  v_balance_before bigint;
  v_current_expiry timestamptz;
  v_base_date date;
  v_new_expiry timestamptz;
  v_new_balance bigint;
  v_tx uuid;
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  v_package:=upper(trim(coalesce(p_package_name,'')));

  case v_package
    when 'NICKEL' then
      v_cash:=1000000;v_credit:=1050000;v_months:=2;
    when 'SILVER' then
      v_cash:=2000000;v_credit:=2200000;v_months:=2;
    when 'GOLD' then
      v_cash:=3000000;v_credit:=3450000;v_months:=4;
    when 'DIAMOND' then
      v_cash:=4000000;v_credit:=4800000;v_months:=4;
    else
      raise exception 'Paket top up tidak valid';
  end case;

  if coalesce(trim(p_invoice_number),'')='' then
    raise exception 'Invoice POS wajib diisi';
  end if;

  if p_cash_paid<>v_cash
     or p_credit_issued<>v_credit
     or p_valid_months<>v_months then
    raise exception 'Nominal atau masa aktif paket tidak sesuai';
  end if;

  if not exists(
    select 1 from public.members m
    where m.id=p_member_id
      and m.outlet_id=v_staff.outlet_id
      and m.status<>'deleted'
  ) then
    raise exception 'Member tidak ditemukan';
  end if;

  perform * from public.ctd_expire_wallet_if_due(p_member_id);

  select w.balance,w.expires_at
  into v_balance_before,v_current_expiry
  from public.wallets w
  where w.member_id=p_member_id
  for update;

  if not found then
    raise exception 'Wallet member tidak ditemukan';
  end if;

  if v_balance_before>0
     and v_current_expiry is not null
     and v_current_expiry>now() then
    v_base_date:=(v_current_expiry at time zone 'Asia/Jakarta')::date;
  else
    v_base_date:=public.ctd_jakarta_today();
  end if;

  v_new_expiry:=public.ctd_jakarta_end_of_day(
    (v_base_date+make_interval(months=>v_months))::date
  );

  begin
    v_new_balance:=public.mvp_topup_member(
      v_staff.staff_id,
      p_member_id,
      v_cash,
      v_credit,
      trim(p_invoice_number),
      v_package,
      v_months
    );
  exception
    when unique_violation then
      raise exception 'Invoice POS sudah pernah dipakai untuk top up';
  end;

  update public.wallets
  set
    expires_at=v_new_expiry,
    expired_at=null,
    updated_at=now()
  where member_id=p_member_id
  returning balance into v_new_balance;

  select t.id into v_tx
  from public.transactions t
  where t.outlet_id=v_staff.outlet_id
    and t.member_id=p_member_id
    and t.type='topup'
    and t.status='approved'
    and t.metadata->>'invoice_number'=trim(p_invoice_number)
  order by t.created_at desc
  limit 1;

  if v_tx is not null then
    update public.transactions
    set metadata=coalesce(metadata,'{}'::jsonb)
      ||jsonb_build_object(
        'package_name',v_package,
        'valid_months',v_months,
        'expires_at',v_new_expiry,
        'expiry_cutoff','23:59:59 Asia/Jakarta',
        'expiry_model','single_wallet'
      )
    where id=v_tx;
  end if;

  insert into public.security_audit_log(
    staff_id,outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_staff.staff_id,v_staff.outlet_id,
    'member_topup','member',p_member_id,
    jsonb_build_object(
      'cash_paid',v_cash,
      'credit_issued',v_credit,
      'invoice_number',trim(p_invoice_number),
      'package',v_package,
      'previous_expiry',v_current_expiry,
      'new_expiry',v_new_expiry
    )
  );

  return query
  select v_new_balance,v_new_expiry,v_package,v_credit,v_cash;
end
$function$;

revoke all on function public.s3_topup_member(
  text,uuid,bigint,bigint,text,text,integer
) from public;

grant execute on function public.s3_topup_member(
  text,uuid,bigint,bigint,text,text,integer
) to anon,authenticated;

-- ================================================================
-- 1B. VOUCHER / GIFT DATE CHECKS USE JAKARTA DATE
-- ================================================================
create or replace function public.s3_generate_campaign_codes(
  p_staff_session_token text,
  p_code_type text,
  p_campaign_name text,
  p_value bigint,
  p_expired_at date,
  p_qty integer
)
returns table(
  gift_id uuid,
  code text,
  value bigint,
  campaign_name text,
  expired_at date,
  code_type text
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_type text:=lower(trim(coalesce(p_code_type,'')));
  v_created record;
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  if v_type not in('voucher','gift') then
    raise exception 'Jenis kode harus VOUCHER atau GIFT';
  end if;

  if coalesce(trim(p_campaign_name),'')='' then
    raise exception 'Campaign / Event wajib diisi';
  end if;

  if p_qty<1 or p_qty>500 then
    raise exception 'Jumlah kode harus antara 1 sampai 500';
  end if;

  if p_value<1000 or p_value>10000000 then
    raise exception
      'Nominal per kode harus antara Rp1.000 sampai Rp10.000.000';
  end if;

  if p_expired_at is null or p_expired_at<public.ctd_jakarta_today() then
    raise exception 'Expired date harus hari ini atau setelahnya';
  end if;

  for v_created in
    select *
    from public.mvp_generate_gift_codes_batch(
      v_staff.staff_id,
      trim(p_campaign_name),
      p_value,
      p_expired_at,
      p_qty
    )
  loop
    update public.gift_codes g
    set code_type=v_type
    where g.id=v_created.gift_id;

    gift_id:=v_created.gift_id;
    code:=v_created.code::text;
    value:=v_created.value::bigint;
    campaign_name:=v_created.campaign_name::text;
    expired_at:=v_created.expired_at;
    code_type:=v_type;
    return next;
  end loop;

  insert into public.security_audit_log(
    staff_id,
    outlet_id,
    action,
    entity_type,
    metadata
  )
  values(
    v_staff.staff_id,
    v_staff.outlet_id,
    case
      when v_type='gift'
        then 'generic_gift_batch_generated'
      else 'voucher_batch_generated'
    end,
    'voucher',
    jsonb_build_object(
      'code_type',v_type,
      'campaign',trim(p_campaign_name),
      'value',p_value,
      'qty',p_qty,
      'expired_at',p_expired_at
    )
  );

  return;
end
$function$;

revoke all on function public.s3_generate_campaign_codes(
  text,text,text,bigint,date,integer
) from public;

grant execute on function public.s3_generate_campaign_codes(
  text,text,text,bigint,date,integer
) to anon,authenticated;

create or replace function public.mvp_claim_gift_code(
  p_outlet_slug text,
  p_member_code text,
  p_name text,
  p_phone text,
  p_password text,
  p_gift_code text
)
returns table(
  member_id uuid,
  member_code text,
  initial_balance bigint
)
language plpgsql
security definer
set search_path=public,extensions
as $function$
declare
  v_outlet uuid;
  v_gift public.gift_codes%rowtype;
  v_member uuid;
  v_phone text;
  v_code text;
  v_balance bigint:=0;
  v_expiry timestamptz;
begin
  if p_password !~ '^[0-9]{6}$' then
    raise exception 'PIN wajib 6 digit angka';
  end if;

  v_phone:=regexp_replace(
    coalesce(p_phone,''),
    '[^0-9]',
    '',
    'g'
  );

  if left(v_phone,1)='0' then
    v_phone:='62'||substr(v_phone,2);
  end if;

  if length(v_phone)<8 then
    raise exception 'Nomor HP tidak valid';
  end if;

  select o.id
  into v_outlet
  from public.outlets o
  where o.slug=p_outlet_slug;

  if v_outlet is null then
    raise exception 'Outlet not found';
  end if;

  if exists(
    select 1
    from public.members m
    where m.outlet_id=v_outlet
      and m.phone=v_phone
      and m.status<>'deleted'
  ) then
    raise exception 'Nomor HP sudah terdaftar sebagai member';
  end if;

  v_code:=upper(trim(coalesce(p_gift_code,'')));

  if v_code<>'' then
    select g.*
    into v_gift
    from public.gift_codes g
    where g.code=v_code
      and g.outlet_id=v_outlet
    for update;

    if not found then
      raise exception 'Voucher tidak ditemukan';
    end if;

    if v_gift.code_type<>'voucher' then
      raise exception
        'Kode ini adalah GIFT untuk existing member. Login ke Customer Portal untuk claim.';
    end if;

    if v_gift.status<>'available'
       or(
         v_gift.expired_at is not null
         and v_gift.expired_at<public.ctd_jakarta_today()
       ) then
      raise exception 'Voucher tidak tersedia / expired';
    end if;

    v_balance:=v_gift.value;

    if v_gift.expired_at is not null then
      v_expiry:=public.ctd_jakarta_end_of_day(
        v_gift.expired_at
      );
    end if;
  end if;

  insert into public.members(
    outlet_id,
    member_code,
    name,
    phone,
    password_hash,
    status,
    failed_pin_attempts
  )
  values(
    v_outlet,
    p_member_code,
    left(trim(p_name),120),
    v_phone,
    extensions.crypt(
      p_password,
      extensions.gen_salt('bf',12)
    ),
    'active',
    0
  )
  returning id into v_member;

  insert into public.wallets(
    member_id,
    balance,
    expires_at
  )
  values(
    v_member,
    v_balance,
    v_expiry
  );

  if v_code<>'' then
    update public.gift_codes g
    set
      status='registered',
      used_by_member_id=v_member,
      used_at=now()
    where g.id=v_gift.id;

    insert into public.transactions(
      outlet_id,
      member_id,
      type,
      gift_code_id,
      credit_issued,
      status,
      metadata
    )
    values(
      v_outlet,
      v_member,
      'gift_claim',
      v_gift.id,
      v_balance,
      'approved',
      jsonb_build_object(
        'code_type','voucher',
        'claim_mode','new_member_registration',
        'expires_at',v_expiry,
        'expiry_model','single_wallet'
      )
    );
  end if;

  return query
  select
    v_member,
    p_member_code,
    v_balance;
end
$function$;

revoke all on function public.mvp_claim_gift_code(
  text,text,text,text,text,text
) from public;

grant execute on function public.mvp_claim_gift_code(
  text,text,text,text,text,text
) to anon,authenticated;


-- ================================================================
-- 2. GIFT ITEM TABLES
-- ================================================================
create table if not exists public.gift_item_master(
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_data_url text,
  is_active boolean not null default true,
  created_by_staff_id uuid references public.staff_profiles(id),
  updated_by_staff_id uuid references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gift_item_master enable row level security;
revoke all on table public.gift_item_master from public,anon,authenticated;

alter table public.gift_codes
  add column if not exists gift_item_id uuid
  references public.gift_item_master(id);

alter table public.gift_codes
  drop constraint if exists gift_codes_code_type_check;

alter table public.gift_codes
  add constraint gift_codes_code_type_check
  check(code_type in('voucher','gift','item'));

create table if not exists public.member_gift_items(
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  gift_item_id uuid not null references public.gift_item_master(id),
  gift_code_id uuid not null unique references public.gift_codes(id),
  status text not null default 'available'
    check(status in('available','redeemed','expired','void')),
  expires_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by_staff_id uuid references public.staff_profiles(id),
  created_at timestamptz not null default now()
);

alter table public.member_gift_items enable row level security;
revoke all on table public.member_gift_items from public,anon,authenticated;

create table if not exists public.gift_item_redemption_requests(
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  member_gift_item_id uuid not null references public.member_gift_items(id),
  created_by_staff_id uuid not null references public.staff_profiles(id),
  status text not null default 'waiting'
    check(status in('waiting','approved','rejected','expired')),
  expires_at timestamptz not null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.gift_item_redemption_requests enable row level security;
revoke all on table public.gift_item_redemption_requests
from public,anon,authenticated;

create index if not exists idx_gift_item_master_outlet
on public.gift_item_master(outlet_id,is_active,updated_at desc);

create index if not exists idx_member_gift_items_member
on public.member_gift_items(member_id,status,expires_at);

create index if not exists idx_item_redemption_token
on public.gift_item_redemption_requests(token_hash);

-- Transaction history supports item claim/use.
do $transaction_type$
declare
  v_unknown text;
begin
  select string_agg(distinct t.type,', ')
  into v_unknown
  from public.transactions t
  where t.type not in(
    'gift_claim','topup','use_balance','void',
    'gift_item_claim','gift_item_redeem'
  );

  if v_unknown is not null then
    raise exception 'Unknown transaction types: %',v_unknown;
  end if;
end
$transaction_type$;

alter table public.transactions
  drop constraint if exists transactions_type_check;

do $drop_transaction_type_checks$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='transactions'
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%gift_claim%'
      and pg_get_constraintdef(c.oid) ilike '%use_balance%'
  loop
    execute format(
      'alter table public.transactions drop constraint %I',
      v_constraint.conname
    );
  end loop;
end
$drop_transaction_type_checks$;

alter table public.transactions
  add constraint transactions_type_check
  check(type in(
    'gift_claim','topup','use_balance','void',
    'gift_item_claim','gift_item_redeem'
  ));

-- ================================================================
-- 3. EXPIRY HELPER FOR GIFT ITEMS
-- ================================================================
create or replace function public.ctd_expire_due_gift_items(
  p_member_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_count integer;
begin
  update public.member_gift_items
  set status='expired'
  where status='available'
    and expires_at<=now()
    and(p_member_id is null or member_id=p_member_id);

  get diagnostics v_count=row_count;
  return v_count;
end
$function$;

revoke all on function public.ctd_expire_due_gift_items(uuid)
from public,anon,authenticated;

-- ================================================================
-- 4. MASTER ITEM RPCs
-- ================================================================
drop function if exists public.s4_list_gift_item_master(text,boolean);
create function public.s4_list_gift_item_master(
  p_staff_session_token text,
  p_include_inactive boolean default true
)
returns table(
  item_id uuid,
  name text,
  description text,
  image_data_url text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  return query
  select
    i.id,i.name,i.description,i.image_data_url,
    i.is_active,i.created_at,i.updated_at
  from public.gift_item_master i
  where i.outlet_id=v_staff.outlet_id
    and(p_include_inactive or i.is_active)
  order by i.is_active desc,i.updated_at desc;
end
$function$;

revoke all on function public.s4_list_gift_item_master(text,boolean)
from public;

grant execute on function public.s4_list_gift_item_master(text,boolean)
to anon,authenticated;

drop function if exists public.s4_save_gift_item_master(
  text,uuid,text,text,text,boolean
);

create function public.s4_save_gift_item_master(
  p_staff_session_token text,
  p_item_id uuid,
  p_name text,
  p_description text,
  p_image_data_url text,
  p_is_active boolean
)
returns table(
  item_id uuid,
  name text,
  description text,
  image_data_url text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_item public.gift_item_master%rowtype;
  v_image text;
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  if coalesce(trim(p_name),'')='' then
    raise exception 'Nama item wajib diisi';
  end if;
  if length(trim(p_name))>100 then
    raise exception 'Nama item maksimal 100 karakter';
  end if;
  if length(coalesce(p_description,''))>240 then
    raise exception 'Deskripsi maksimal 240 karakter';
  end if;
  if p_image_data_url is not null then
    if p_image_data_url !~ '^data:image/(jpeg|png|webp);base64,' then
      raise exception 'Format gambar tidak valid';
    end if;
    if length(p_image_data_url)>1800000 then
      raise exception 'Ukuran gambar terlalu besar';
    end if;
  end if;

  if p_item_id is null then
    if p_image_data_url is null then
      raise exception 'Foto item wajib diupload';
    end if;

    insert into public.gift_item_master(
      outlet_id,name,description,image_data_url,is_active,
      created_by_staff_id,updated_by_staff_id
    )
    values(
      v_staff.outlet_id,
      trim(p_name),
      trim(coalesce(p_description,'')),
      p_image_data_url,
      coalesce(p_is_active,true),
      v_staff.staff_id,
      v_staff.staff_id
    )
    returning * into v_item;
  else
    select * into v_item
    from public.gift_item_master
    where id=p_item_id
      and outlet_id=v_staff.outlet_id
    for update;

    if not found then
      raise exception 'Master item tidak ditemukan';
    end if;

    v_image:=coalesce(p_image_data_url,v_item.image_data_url);

    update public.gift_item_master
    set
      name=trim(p_name),
      description=trim(coalesce(p_description,'')),
      image_data_url=v_image,
      is_active=coalesce(p_is_active,false),
      updated_by_staff_id=v_staff.staff_id,
      updated_at=now()
    where id=p_item_id
    returning * into v_item;
  end if;

  insert into public.security_audit_log(
    staff_id,outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_staff.staff_id,v_staff.outlet_id,
    'gift_item_master_saved','gift_item',v_item.id,
    jsonb_build_object('name',v_item.name,'active',v_item.is_active)
  );

  return query
  select
    v_item.id,v_item.name,v_item.description,
    v_item.image_data_url,v_item.is_active,v_item.updated_at;
end
$function$;

revoke all on function public.s4_save_gift_item_master(
  text,uuid,text,text,text,boolean
) from public;

grant execute on function public.s4_save_gift_item_master(
  text,uuid,text,text,text,boolean
) to anon,authenticated;

-- ================================================================
-- 5. GENERATE ITEM CODES
-- ================================================================
drop function if exists public.s4_generate_item_gift_codes(
  text,uuid,text,date,integer
);

create function public.s4_generate_item_gift_codes(
  p_staff_session_token text,
  p_gift_item_id uuid,
  p_campaign_name text,
  p_expired_at date,
  p_qty integer
)
returns table(
  gift_id uuid,
  code text,
  item_name text,
  campaign_name text,
  expired_at date
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_item public.gift_item_master%rowtype;
  v_created record;
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  select * into v_item
  from public.gift_item_master
  where id=p_gift_item_id
    and outlet_id=v_staff.outlet_id
    and is_active=true;

  if not found then
    raise exception 'Gift Item tidak ditemukan / nonaktif';
  end if;

  if coalesce(trim(p_campaign_name),'')='' then
    raise exception 'Campaign wajib diisi';
  end if;

  if p_qty<1 or p_qty>500 then
    raise exception 'Jumlah kode harus 1 sampai 500';
  end if;

  if p_expired_at is null or p_expired_at<public.ctd_jakarta_today() then
    raise exception 'Expired date tidak valid';
  end if;

  for v_created in
    select *
    from public.mvp_generate_gift_codes_batch(
      v_staff.staff_id,
      trim(p_campaign_name),
      1,
      p_expired_at,
      p_qty
    )
  loop
    update public.gift_codes
    set
      code_type='item',
      gift_item_id=v_item.id
    where id=v_created.gift_id;

    gift_id:=v_created.gift_id;
    code:=v_created.code::text;
    item_name:=v_item.name;
    campaign_name:=trim(p_campaign_name);
    expired_at:=p_expired_at;
    return next;
  end loop;

  insert into public.security_audit_log(
    staff_id,outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_staff.staff_id,v_staff.outlet_id,
    'gift_item_codes_generated','gift_item',v_item.id,
    jsonb_build_object(
      'campaign',trim(p_campaign_name),
      'qty',p_qty,
      'expired_at',p_expired_at
    )
  );

  return;
end
$function$;

revoke all on function public.s4_generate_item_gift_codes(
  text,uuid,text,date,integer
) from public;

grant execute on function public.s4_generate_item_gift_codes(
  text,uuid,text,date,integer
) to anon,authenticated;

-- ================================================================
-- 6. LIST / COPY CODES WITH ITEM DATA
-- ================================================================
drop function if exists public.s3_list_gift_codes_paged(
  text,text,integer,integer
);

create function public.s3_list_gift_codes_paged(
  p_staff_session_token text,
  p_status text default 'available',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  gift_id uuid,
  code text,
  value bigint,
  voucher_status text,
  campaign_name text,
  expired_at date,
  used_at timestamptz,
  used_by_phone text,
  used_by_name text,
  created_at timestamptz,
  copied_at timestamptz,
  copied_method text,
  code_type text,
  gift_item_id uuid,
  gift_item_name text,
  gift_item_image_data_url text,
  total_count bigint
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_status text:=lower(trim(coalesce(p_status,'available')));
  v_limit integer:=least(greatest(coalesce(p_limit,10),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  update public.gift_codes
  set status='expired'
  where outlet_id=v_staff.outlet_id
    and status='available'
    and expired_at<public.ctd_jakarta_today();

  return query
  select
    g.id,g.code::text,g.value::bigint,g.status::text,
    g.campaign_name::text,g.expired_at,g.used_at,
    m.phone::text,m.name::text,g.created_at,
    g.copied_at,g.copied_method::text,g.code_type::text,
    i.id,i.name::text,i.image_data_url::text,
    count(*) over()::bigint
  from public.gift_codes g
  left join public.members m
    on m.id=g.used_by_member_id
  left join public.gift_item_master i
    on i.id=g.gift_item_id
  where g.outlet_id=v_staff.outlet_id
    and(
      v_status='all'
      or(v_status='registered' and g.status in('registered','used'))
      or(v_status<>'registered' and g.status=v_status)
    )
  order by g.created_at desc,g.id desc
  limit v_limit
  offset v_offset;
end
$function$;

revoke all on function public.s3_list_gift_codes_paged(
  text,text,integer,integer
) from public;

grant execute on function public.s3_list_gift_codes_paged(
  text,text,integer,integer
) to anon,authenticated;

drop function if exists public.s3_copy_gift_code(text,uuid,text);

create function public.s3_copy_gift_code(
  p_staff_session_token text,
  p_gift_id uuid,
  p_method text
)
returns table(
  copy_allowed boolean,
  error_message text,
  gift_id uuid,
  code text,
  value bigint,
  copied_at timestamptz,
  copied_method text,
  code_type text,
  campaign_name text,
  expired_at date,
  gift_item_id uuid,
  gift_item_name text,
  gift_item_image_data_url text
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_gift public.gift_codes%rowtype;
  v_item public.gift_item_master%rowtype;
  v_method text:=lower(trim(coalesce(p_method,'')));
  v_now timestamptz:=now();
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  if v_method not in('wa','link') then
    raise exception 'Metode copy tidak valid';
  end if;

  select * into v_gift
  from public.gift_codes
  where id=p_gift_id
    and outlet_id=v_staff.outlet_id
  for update;

  if not found then
    raise exception 'Kode tidak ditemukan';
  end if;

  if v_gift.gift_item_id is not null then
    select * into v_item
    from public.gift_item_master
    where id=v_gift.gift_item_id;
  end if;

  if v_gift.status='available'
     and v_gift.expired_at<public.ctd_jakarta_today() then
    update public.gift_codes
    set status='expired'
    where id=v_gift.id;
    v_gift.status:='expired';
  end if;

  if v_gift.status<>'available' then
    return query
    select false,'Kode sudah tidak available'::text,
      v_gift.id,v_gift.code::text,v_gift.value::bigint,
      v_gift.copied_at,v_gift.copied_method::text,
      v_gift.code_type::text,v_gift.campaign_name::text,
      v_gift.expired_at,v_item.id,v_item.name::text,
      v_item.image_data_url::text;
    return;
  end if;

  if v_gift.copied_at is not null then
    return query
    select false,'Kode sudah pernah dicopy'::text,
      v_gift.id,v_gift.code::text,v_gift.value::bigint,
      v_gift.copied_at,v_gift.copied_method::text,
      v_gift.code_type::text,v_gift.campaign_name::text,
      v_gift.expired_at,v_item.id,v_item.name::text,
      v_item.image_data_url::text;
    return;
  end if;

  update public.gift_codes
  set
    copied_at=v_now,
    copied_method=v_method,
    copied_by_staff_id=v_staff.staff_id
  where id=v_gift.id;

  insert into public.security_audit_log(
    staff_id,outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_staff.staff_id,v_staff.outlet_id,
    'campaign_code_shared','voucher',v_gift.id,
    jsonb_build_object(
      'method',v_method,
      'code_type',v_gift.code_type
    )
  );

  return query
  select true,null::text,
    v_gift.id,v_gift.code::text,v_gift.value::bigint,
    v_now,v_method,v_gift.code_type::text,
    v_gift.campaign_name::text,v_gift.expired_at,
    v_item.id,v_item.name::text,v_item.image_data_url::text;
end
$function$;

revoke all on function public.s3_copy_gift_code(text,uuid,text)
from public;

grant execute on function public.s3_copy_gift_code(text,uuid,text)
to anon,authenticated;

-- ================================================================
-- 7. UNIFIED CUSTOMER REWARD PREVIEW / CLAIM
-- ================================================================
drop function if exists public.mvp_customer_preview_gift(text,text);
drop function if exists public.mvp_customer_claim_gift(text,text);
drop function if exists public.mvp_customer_preview_reward(text,text);
drop function if exists public.mvp_customer_claim_reward(text,text);

create function public.mvp_customer_preview_reward(
  p_session_token text,
  p_code text
)
returns table(
  claim_allowed boolean,
  error_message text,
  gift_id uuid,
  code text,
  code_type text,
  campaign_name text,
  value bigint,
  expired_at date,
  current_balance bigint,
  current_expiry timestamptz,
  result_expiry timestamptz,
  item_id uuid,
  item_name text,
  item_description text,
  item_image_data_url text
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_member_id uuid;
  v_member public.members%rowtype;
  v_gift public.gift_codes%rowtype;
  v_wallet public.wallets%rowtype;
  v_item public.gift_item_master%rowtype;
  v_code text:=upper(trim(coalesce(p_code,'')));
  v_reward_expiry timestamptz;
  v_result_expiry timestamptz;
  v_allowed boolean:=true;
  v_error text;
begin
  select s.member_id into v_member_id
  from public.customer_sessions_secure s
  join public.members m on m.id=s.member_id
  where s.token_hash=public.ctd_token_hash(p_session_token)
    and s.revoked_at is null
    and s.expires_at>now()
    and m.status='active'
  limit 1;

  if v_member_id is null then
    return query
    select false,'Session customer tidak valid'::text,
      null::uuid,v_code,null::text,null::text,null::bigint,
      null::date,null::bigint,null::timestamptz,null::timestamptz,
      null::uuid,null::text,null::text,null::text;
    return;
  end if;

  select * into v_member
  from public.members
  where id=v_member_id;

  perform * from public.ctd_expire_wallet_if_due(v_member_id);

  select * into v_wallet
  from public.wallets
  where member_id=v_member_id;

  select * into v_gift
  from public.gift_codes
  where code=v_code
    and outlet_id=v_member.outlet_id
  limit 1;

  if not found then
    v_allowed:=false;
    v_error:='Gift tidak ditemukan';
  elsif v_gift.code_type not in('gift','item') then
    v_allowed:=false;
    v_error:='Kode ini adalah Voucher untuk pendaftaran member baru';
  elsif v_member.created_at>v_gift.created_at then
    v_allowed:=false;
    v_error:='Gift hanya untuk member yang sudah terdaftar sebelum Gift dibuat';
  elsif v_gift.status<>'available' then
    v_allowed:=false;
    v_error:='Gift sudah pernah diclaim / tidak tersedia';
  elsif v_gift.expired_at<public.ctd_jakarta_today() then
    v_allowed:=false;
    v_error:='Gift sudah expired';
  end if;

  if v_gift.gift_item_id is not null then
    select * into v_item
    from public.gift_item_master
    where id=v_gift.gift_item_id;
  end if;

  if v_allowed then
    v_reward_expiry:=public.ctd_jakarta_end_of_day(v_gift.expired_at);

    if v_gift.code_type='gift' then
      if coalesce(v_wallet.balance,0)>0
         and v_wallet.expires_at is null then
        v_result_expiry:=null;
      elsif coalesce(v_wallet.balance,0)>0
         and v_wallet.expires_at>now() then
        v_result_expiry:=greatest(
          v_wallet.expires_at,
          v_reward_expiry
        );
      else
        v_result_expiry:=v_reward_expiry;
      end if;
    else
      v_result_expiry:=v_reward_expiry;
    end if;
  end if;

  return query
  select
    v_allowed,v_error,v_gift.id,v_gift.code::text,
    v_gift.code_type::text,v_gift.campaign_name::text,
    v_gift.value::bigint,v_gift.expired_at,
    coalesce(v_wallet.balance,0),v_wallet.expires_at,
    v_result_expiry,
    v_item.id,v_item.name::text,v_item.description::text,
    v_item.image_data_url::text;
end
$function$;

revoke all on function public.mvp_customer_preview_reward(text,text)
from public;

grant execute on function public.mvp_customer_preview_reward(text,text)
to anon,authenticated;

create function public.mvp_customer_claim_reward(
  p_session_token text,
  p_code text
)
returns table(
  claim_success boolean,
  error_message text,
  code_type text,
  campaign_name text,
  gift_value bigint,
  new_balance bigint,
  new_expiry timestamptz,
  member_gift_item_id uuid,
  item_name text,
  item_description text,
  item_image_data_url text,
  item_expires_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_member_id uuid;
  v_member public.members%rowtype;
  v_gift public.gift_codes%rowtype;
  v_wallet public.wallets%rowtype;
  v_item public.gift_item_master%rowtype;
  v_code text:=upper(trim(coalesce(p_code,'')));
  v_reward_expiry timestamptz;
  v_new_expiry timestamptz;
  v_new_balance bigint;
  v_entitlement uuid;
begin
  select s.member_id into v_member_id
  from public.customer_sessions_secure s
  join public.members m on m.id=s.member_id
  where s.token_hash=public.ctd_token_hash(p_session_token)
    and s.revoked_at is null
    and s.expires_at>now()
    and m.status='active'
  limit 1;

  if v_member_id is null then
    return query
    select false,'Session customer tidak valid'::text,
      null::text,null::text,null::bigint,null::bigint,
      null::timestamptz,null::uuid,null::text,null::text,
      null::text,null::timestamptz;
    return;
  end if;

  select * into v_member
  from public.members
  where id=v_member_id
  for update;

  select * into v_gift
  from public.gift_codes
  where code=v_code
    and outlet_id=v_member.outlet_id
  for update;

  if not found then
    return query
    select false,'Gift tidak ditemukan'::text,
      null::text,null::text,null::bigint,null::bigint,
      null::timestamptz,null::uuid,null::text,null::text,
      null::text,null::timestamptz;
    return;
  end if;

  if v_gift.code_type not in('gift','item') then
    return query
    select false,'Kode ini adalah Voucher member baru'::text,
      v_gift.code_type::text,v_gift.campaign_name::text,
      v_gift.value::bigint,null::bigint,null::timestamptz,
      null::uuid,null::text,null::text,null::text,null::timestamptz;
    return;
  end if;

  if v_member.created_at>v_gift.created_at then
    return query
    select false,'Gift hanya untuk existing member'::text,
      v_gift.code_type::text,v_gift.campaign_name::text,
      v_gift.value::bigint,null::bigint,null::timestamptz,
      null::uuid,null::text,null::text,null::text,null::timestamptz;
    return;
  end if;

  if v_gift.status<>'available'
     or v_gift.expired_at<public.ctd_jakarta_today() then
    return query
    select false,'Gift sudah digunakan / expired'::text,
      v_gift.code_type::text,v_gift.campaign_name::text,
      v_gift.value::bigint,null::bigint,null::timestamptz,
      null::uuid,null::text,null::text,null::text,null::timestamptz;
    return;
  end if;

  v_reward_expiry:=public.ctd_jakarta_end_of_day(v_gift.expired_at);

  if v_gift.code_type='gift' then
    perform * from public.ctd_expire_wallet_if_due(v_member_id);

    select * into v_wallet
    from public.wallets
    where member_id=v_member_id
    for update;

    if v_wallet.balance>0
       and v_wallet.expires_at is null then
      v_new_expiry:=null;
    elsif v_wallet.balance>0
       and v_wallet.expires_at>now() then
      v_new_expiry:=greatest(
        v_wallet.expires_at,
        v_reward_expiry
      );
    else
      v_new_expiry:=v_reward_expiry;
    end if;

    v_new_balance:=v_wallet.balance+v_gift.value;

    update public.wallets
    set
      balance=v_new_balance,
      expires_at=v_new_expiry,
      expired_at=null,
      updated_at=now()
    where member_id=v_member_id;

    update public.gift_codes
    set
      status='claimed',
      used_by_member_id=v_member_id,
      used_at=now()
    where id=v_gift.id;

    insert into public.transactions(
      outlet_id,member_id,type,gift_code_id,
      credit_issued,status,metadata
    )
    values(
      v_member.outlet_id,v_member_id,'gift_claim',
      v_gift.id,v_gift.value,'approved',
      jsonb_build_object(
        'code_type','gift',
        'expires_at',v_new_expiry,
        'expiry_cutoff','23:59:59 Asia/Jakarta'
      )
    );

    return query
    select true,null::text,'gift'::text,
      v_gift.campaign_name::text,v_gift.value::bigint,
      v_new_balance,v_new_expiry,null::uuid,
      null::text,null::text,null::text,null::timestamptz;
    return;
  end if;

  select * into v_item
  from public.gift_item_master
  where id=v_gift.gift_item_id;

  if not found then
    raise exception 'Master Gift Item tidak ditemukan';
  end if;

  insert into public.member_gift_items(
    outlet_id,member_id,gift_item_id,gift_code_id,
    status,expires_at
  )
  values(
    v_member.outlet_id,v_member_id,v_item.id,v_gift.id,
    'available',v_reward_expiry
  )
  returning id into v_entitlement;

  update public.gift_codes
  set
    status='claimed',
    used_by_member_id=v_member_id,
    used_at=now()
  where id=v_gift.id;

  insert into public.transactions(
    outlet_id,member_id,type,gift_code_id,
    status,metadata
  )
  values(
    v_member.outlet_id,v_member_id,
    'gift_item_claim',v_gift.id,'approved',
    jsonb_build_object(
      'gift_item_id',v_item.id,
      'gift_item_name',v_item.name,
      'member_gift_item_id',v_entitlement,
      'expires_at',v_reward_expiry,
      'expiry_cutoff','23:59:59 Asia/Jakarta'
    )
  );

  insert into public.security_audit_log(
    outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_member.outlet_id,'gift_item_claimed',
    'member_gift_item',v_entitlement,
    jsonb_build_object(
      'member_id',v_member_id,
      'gift_code_id',v_gift.id,
      'item_name',v_item.name,
      'expires_at',v_reward_expiry
    )
  );

  return query
  select true,null::text,'item'::text,
    v_gift.campaign_name::text,0::bigint,
    null::bigint,null::timestamptz,v_entitlement,
    v_item.name::text,v_item.description::text,
    v_item.image_data_url::text,v_reward_expiry;
end
$function$;

revoke all on function public.mvp_customer_claim_reward(text,text)
from public;

grant execute on function public.mvp_customer_claim_reward(text,text)
to anon,authenticated;

-- ================================================================
-- 8. CUSTOMER / STAFF ITEM LIST
-- ================================================================
drop function if exists public.mvp_customer_gift_items(text);

create function public.mvp_customer_gift_items(
  p_session_token text
)
returns table(
  member_gift_item_id uuid,
  item_name text,
  item_description text,
  image_data_url text,
  status text,
  expires_at timestamptz,
  days_remaining integer,
  claimed_at timestamptz,
  redeemed_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_member_id uuid;
begin
  select s.member_id into v_member_id
  from public.customer_sessions_secure s
  join public.members m on m.id=s.member_id
  where s.token_hash=public.ctd_token_hash(p_session_token)
    and s.revoked_at is null
    and s.expires_at>now()
    and m.status='active'
  limit 1;

  if v_member_id is null then
    raise exception 'Session customer tidak valid';
  end if;

  perform public.ctd_expire_due_gift_items(v_member_id);

  return query
  select
    mg.id,i.name::text,i.description::text,
    i.image_data_url::text,mg.status::text,mg.expires_at,
    ((mg.expires_at at time zone 'Asia/Jakarta')::date-public.ctd_jakarta_today())::integer,
    mg.claimed_at,mg.redeemed_at
  from public.member_gift_items mg
  join public.gift_item_master i on i.id=mg.gift_item_id
  where mg.member_id=v_member_id
  order by
    case mg.status when 'available' then 0 when 'redeemed' then 1 else 2 end,
    mg.expires_at asc,mg.claimed_at desc
  limit 100;
end
$function$;

revoke all on function public.mvp_customer_gift_items(text)
from public;

grant execute on function public.mvp_customer_gift_items(text)
to anon,authenticated;

drop function if exists public.s4_staff_member_gift_items(text,uuid);

create function public.s4_staff_member_gift_items(
  p_staff_session_token text,
  p_member_id uuid
)
returns table(
  member_gift_item_id uuid,
  item_name text,
  item_description text,
  image_data_url text,
  status text,
  expires_at timestamptz,
  days_remaining integer,
  claimed_at timestamptz,
  redeemed_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  if not exists(
    select 1 from public.members
    where id=p_member_id
      and outlet_id=v_staff.outlet_id
      and status<>'deleted'
  ) then
    raise exception 'Member tidak ditemukan';
  end if;

  perform public.ctd_expire_due_gift_items(p_member_id);

  return query
  select
    mg.id,i.name::text,i.description::text,
    i.image_data_url::text,mg.status::text,mg.expires_at,
    ((mg.expires_at at time zone 'Asia/Jakarta')::date-public.ctd_jakarta_today())::integer,
    mg.claimed_at,mg.redeemed_at
  from public.member_gift_items mg
  join public.gift_item_master i on i.id=mg.gift_item_id
  where mg.member_id=p_member_id
    and mg.outlet_id=v_staff.outlet_id
  order by
    case mg.status when 'available' then 0 when 'redeemed' then 1 else 2 end,
    mg.expires_at asc,mg.claimed_at desc;
end
$function$;

revoke all on function public.s4_staff_member_gift_items(text,uuid)
from public;

grant execute on function public.s4_staff_member_gift_items(text,uuid)
to anon,authenticated;

-- ================================================================
-- 9. SECURE ITEM REDEMPTION
-- ================================================================
drop function if exists public.s4_create_item_redemption(text,uuid);

create function public.s4_create_item_redemption(
  p_staff_session_token text,
  p_member_gift_item_id uuid
)
returns table(
  token text,
  request_expires_at timestamptz,
  item_name text,
  item_description text,
  item_image_data_url text,
  item_expires_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_entitlement public.member_gift_items%rowtype;
  v_item public.gift_item_master%rowtype;
  v_token text;
  v_exp timestamptz:=now()+interval '15 minutes';
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  perform public.ctd_expire_due_gift_items(null::uuid);

  select * into v_entitlement
  from public.member_gift_items
  where id=p_member_gift_item_id
    and outlet_id=v_staff.outlet_id
  for update;

  if not found then
    raise exception 'Gift Item member tidak ditemukan';
  end if;

  if v_entitlement.status<>'available'
     or v_entitlement.expires_at<=now() then
    raise exception 'Gift Item sudah digunakan / expired';
  end if;

  select * into v_item
  from public.gift_item_master
  where id=v_entitlement.gift_item_id;

  update public.gift_item_redemption_requests
  set status='expired'
  where member_gift_item_id=v_entitlement.id
    and status='waiting';

  v_token:=public.ctd_new_token();

  insert into public.gift_item_redemption_requests(
    token_hash,outlet_id,member_id,member_gift_item_id,
    created_by_staff_id,status,expires_at
  )
  values(
    public.ctd_token_hash(v_token),
    v_staff.outlet_id,
    v_entitlement.member_id,
    v_entitlement.id,
    v_staff.staff_id,
    'waiting',
    v_exp
  );

  insert into public.security_audit_log(
    staff_id,outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_staff.staff_id,v_staff.outlet_id,
    'gift_item_redemption_requested',
    'member_gift_item',v_entitlement.id,
    jsonb_build_object('request_expires_at',v_exp)
  );

  return query
  select v_token,v_exp,v_item.name::text,
    v_item.description::text,v_item.image_data_url::text,
    v_entitlement.expires_at;
end
$function$;

revoke all on function public.s4_create_item_redemption(text,uuid)
from public;

grant execute on function public.s4_create_item_redemption(text,uuid)
to anon,authenticated;

drop function if exists public.mvp_get_item_redemption(text);

create function public.mvp_get_item_redemption(
  p_token text
)
returns table(
  request_status text,
  member_name text,
  item_name text,
  item_description text,
  item_image_data_url text,
  item_expires_at timestamptz,
  days_remaining integer,
  request_expires_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_hash text:=public.ctd_token_hash(p_token);
begin
  update public.gift_item_redemption_requests
  set status='expired'
  where token_hash=v_hash
    and status='waiting'
    and expires_at<=now();

  update public.member_gift_items mg
  set status='expired'
  from public.gift_item_redemption_requests r
  where r.token_hash=v_hash
    and r.member_gift_item_id=mg.id
    and mg.status='available'
    and mg.expires_at<=now();

  return query
  select
    r.status::text,m.name::text,i.name::text,
    i.description::text,i.image_data_url::text,
    mg.expires_at,
    ((mg.expires_at at time zone 'Asia/Jakarta')::date-public.ctd_jakarta_today())::integer,
    r.expires_at
  from public.gift_item_redemption_requests r
  join public.member_gift_items mg
    on mg.id=r.member_gift_item_id
  join public.gift_item_master i
    on i.id=mg.gift_item_id
  join public.members m
    on m.id=r.member_id
  where r.token_hash=v_hash
  limit 1;
end
$function$;

revoke all on function public.mvp_get_item_redemption(text)
from public;

grant execute on function public.mvp_get_item_redemption(text)
to anon,authenticated;

drop function if exists public.mvp_reject_item_redemption(text);

create function public.mvp_reject_item_redemption(
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
begin
  update public.gift_item_redemption_requests
  set status='rejected'
  where token_hash=public.ctd_token_hash(p_token)
    and status='waiting';

  return found;
end
$function$;

revoke all on function public.mvp_reject_item_redemption(text)
from public;

grant execute on function public.mvp_reject_item_redemption(text)
to anon,authenticated;

drop function if exists public.mvp_approve_item_redemption(text,text);

create function public.mvp_approve_item_redemption(
  p_token text,
  p_password text
)
returns table(
  approval_success boolean,
  error_message text,
  remaining_attempts integer,
  transaction_id uuid,
  item_name text
)
language plpgsql
security definer
set search_path=public,extensions
as $function$
declare
  v_request public.gift_item_redemption_requests%rowtype;
  v_entitlement public.member_gift_items%rowtype;
  v_member public.members%rowtype;
  v_item public.gift_item_master%rowtype;
  v_attempts integer;
  v_tx uuid;
  v_block_message text:=
    'Anda telah salah memasukkan PIN sebanyak 10 kali. Akun sementara diblokir. Silakan reset PIN melalui kasir.';
begin
  if p_password !~ '^[0-9]{6}$' then
    return query
    select false,'PIN wajib 6 digit angka'::text,
      null::integer,null::uuid,null::text;
    return;
  end if;

  select * into v_request
  from public.gift_item_redemption_requests
  where token_hash=public.ctd_token_hash(p_token)
  for update;

  if not found then
    raise exception 'Approval Gift Item tidak ditemukan';
  end if;

  if v_request.status<>'waiting' then
    raise exception 'Approval sudah diproses / expired';
  end if;

  if v_request.expires_at<=now() then
    update public.gift_item_redemption_requests
    set status='expired'
    where id=v_request.id;
    raise exception 'Approval expired';
  end if;

  select * into v_entitlement
  from public.member_gift_items
  where id=v_request.member_gift_item_id
  for update;

  if v_entitlement.status<>'available'
     or v_entitlement.expires_at<=now() then
    update public.member_gift_items
    set status='expired'
    where id=v_entitlement.id
      and status='available';
    raise exception 'Gift Item sudah digunakan / expired';
  end if;

  select * into v_member
  from public.members
  where id=v_request.member_id
  for update;

  if not found or v_member.status='deleted' then
    raise exception 'Member tidak ditemukan';
  end if;

  if v_member.status='blocked' then
    return query
    select false,v_block_message,0,null::uuid,null::text;
    return;
  end if;

  if v_member.password_hash is null or v_member.password_hash<>crypt(p_password,v_member.password_hash) then
    update public.members
    set
      failed_pin_attempts=least(coalesce(failed_pin_attempts,0)+1,10),
      status=case
        when least(coalesce(failed_pin_attempts,0)+1,10)>=10
          then 'blocked'
        else status
      end,
      blocked_at=case
        when least(coalesce(failed_pin_attempts,0)+1,10)>=10
          then now()
        else blocked_at
      end
    where id=v_member.id
    returning failed_pin_attempts into v_attempts;

    if v_attempts>=10 then
      return query
      select false,v_block_message,0,null::uuid,null::text;
    else
      return query
      select false,
        format('PIN salah. Sisa percobaan %s kali.',10-v_attempts),
        10-v_attempts,null::uuid,null::text;
    end if;
    return;
  end if;

  select * into v_item
  from public.gift_item_master
  where id=v_entitlement.gift_item_id;

  update public.member_gift_items
  set
    status='redeemed',
    redeemed_at=now(),
    redeemed_by_staff_id=v_request.created_by_staff_id
  where id=v_entitlement.id;

  update public.gift_item_redemption_requests
  set
    status='approved',
    approved_at=now()
  where id=v_request.id;

  update public.members
  set failed_pin_attempts=0,blocked_at=null
  where id=v_member.id;

  insert into public.transactions(
    outlet_id,member_id,cashier_id,type,status,metadata
  )
  values(
    v_request.outlet_id,
    v_request.member_id,
    v_request.created_by_staff_id,
    'gift_item_redeem',
    'approved',
    jsonb_build_object(
      'member_gift_item_id',v_entitlement.id,
      'gift_item_id',v_item.id,
      'gift_item_name',v_item.name
    )
  )
  returning id into v_tx;

  insert into public.security_audit_log(
    staff_id,outlet_id,action,entity_type,entity_id,metadata
  )
  values(
    v_request.created_by_staff_id,
    v_request.outlet_id,
    'gift_item_redeemed',
    'member_gift_item',
    v_entitlement.id,
    jsonb_build_object(
      'member_id',v_member.id,
      'item_name',v_item.name,
      'transaction_id',v_tx
    )
  );

  return query
  select true,null::text,null::integer,v_tx,v_item.name::text;
end
$function$;

revoke all on function public.mvp_approve_item_redemption(text,text)
from public;

grant execute on function public.mvp_approve_item_redemption(text,text)
to anon,authenticated;


-- ================================================================
-- 10. CUSTOMER / STAFF HISTORY INCLUDES GIFT ITEM
-- ================================================================
drop function if exists public.mvp_customer_history(text);

create function public.mvp_customer_history(
  p_session_token text
)
returns table(
  transaction_id uuid,
  created_at timestamptz,
  outlet_name text,
  type text,
  topup_amount bigint,
  balance_used bigint,
  balance_after bigint,
  transaction_status text
)
language sql
security definer
set search_path=public
as $function$
with valid_session as(
  select s.member_id
  from public.customer_sessions_secure s
  join public.members m on m.id=s.member_id
  where s.token_hash=public.ctd_token_hash(p_session_token)
    and s.revoked_at is null
    and s.expires_at>now()
    and m.status='active'
  limit 1
),
tx as(
  select
    t.id,
    t.created_at,
    o.name::text as outlet_name,
    t.type::text as type,
    coalesce(t.credit_issued,0)::bigint as credit_issued,
    coalesce(t.balance_used,0)::bigint as balance_used,
    t.status::text as transaction_status,
    sum(
      coalesce(t.credit_issued,0)-coalesce(t.balance_used,0)
    ) over(
      partition by t.member_id
      order by t.created_at,t.id
    )::bigint as balance_after
  from public.transactions t
  join valid_session s on s.member_id=t.member_id
  join public.outlets o on o.id=t.outlet_id
  where t.status='approved'
    and t.type in(
      'gift_claim','topup','use_balance',
      'gift_item_claim','gift_item_redeem'
    )
)
select
  id,
  created_at,
  outlet_name,
  type,
  case
    when type in('gift_claim','topup') then credit_issued
    else 0
  end,
  case when type='use_balance' then balance_used else 0 end,
  balance_after,
  transaction_status
from tx
order by created_at desc,id desc
limit 100
$function$;

revoke all on function public.mvp_customer_history(text)
from public;

grant execute on function public.mvp_customer_history(text)
to anon,authenticated;

drop function if exists public.s3_staff_member_history(text,uuid);

create function public.s3_staff_member_history(
  p_staff_session_token text,
  p_member_id uuid
)
returns table(
  transaction_id uuid,
  created_at timestamptz,
  outlet_name text,
  type text,
  topup_amount bigint,
  balance_used bigint,
  balance_after bigint,
  transaction_status text
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
begin
  select * into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  if not exists(
    select 1
    from public.members m
    where m.id=p_member_id
      and m.outlet_id=v_staff.outlet_id
      and m.status<>'deleted'
  ) then
    raise exception 'Member tidak ditemukan';
  end if;

  return query
  with tx as(
    select
      t.id,
      t.created_at,
      o.name::text as outlet_name,
      t.type::text as type,
      coalesce(t.credit_issued,0)::bigint as credit_issued,
      coalesce(t.balance_used,0)::bigint as balance_used,
      t.status::text as transaction_status,
      sum(
        coalesce(t.credit_issued,0)-coalesce(t.balance_used,0)
      ) over(
        partition by t.member_id
        order by t.created_at,t.id
      )::bigint as balance_after
    from public.transactions t
    join public.outlets o on o.id=t.outlet_id
    where t.member_id=p_member_id
      and t.outlet_id=v_staff.outlet_id
      and t.status='approved'
      and t.type in(
        'gift_claim','topup','use_balance',
        'gift_item_claim','gift_item_redeem'
      )
  )
  select
    tx.id,
    tx.created_at,
    tx.outlet_name,
    tx.type,
    case
      when tx.type in('gift_claim','topup') then tx.credit_issued
      else 0
    end,
    case when tx.type='use_balance' then tx.balance_used else 0 end,
    tx.balance_after,
    tx.transaction_status
  from tx
  order by tx.created_at desc,tx.id desc
  limit 100;
end
$function$;

revoke all on function public.s3_staff_member_history(text,uuid)
from public;

grant execute on function public.s3_staff_member_history(text,uuid)
to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- ================================================================
-- INSTALLATION CHECK
-- ================================================================
select
  'wallet expiry normalized 23:59' as check_name,
  case when not exists(
    select 1 from public.wallets
    where expires_at is not null
      and to_char(
        expires_at at time zone 'Asia/Jakarta',
        'HH24:MI:SS'
      )<>'23:59:59'
  ) then 'OK' else 'CHECK FAILED' end as result
union all
select
  'gift item master table',
  case when to_regclass('public.gift_item_master') is not null
  then 'OK' else 'MISSING' end
union all
select
  'member gift item table',
  case when to_regclass('public.member_gift_items') is not null
  then 'OK' else 'MISSING' end
union all
select
  'item generator RPC',
  case when to_regprocedure(
    'public.s4_generate_item_gift_codes(text,uuid,text,date,integer)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'unified claim RPC',
  case when to_regprocedure(
    'public.mvp_customer_claim_reward(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'item approval RPC',
  case when to_regprocedure(
    'public.mvp_approve_item_redemption(text,text)'
  ) is not null then 'OK' else 'MISSING' end;
