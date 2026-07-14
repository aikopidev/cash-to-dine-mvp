-- Cash to Dine v3.2.1
-- GENERIC EXISTING-MEMBER GIFT
--
-- FINAL MODEL
-- - VOUCHER: new-member registration only.
-- - GIFT: existing members only.
-- - Gift is not assigned to a specific member.
-- - The first eligible existing member who claims receives it.
-- - One code can be used only once.
--
-- Built from v3.1.2. This migration removes obsolete target-member
-- v3.2.0 functions/columns if that abandoned SQL was installed.
--
-- Required base:
-- - v3 Security Foundation
-- - v3.1.1 Single Balance Expiry
--
-- v3.1.2 SQL may already be installed, but is not required because this
-- migration also installs the copy-lock columns and secure functions.

begin;

-- ================================================================
-- 0. PRE-FLIGHT
-- ================================================================
do $preflight$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.gift_codes') is null then
    v_missing:=array_append(v_missing,'public.gift_codes');
  end if;

  if to_regclass('public.members') is null then
    v_missing:=array_append(v_missing,'public.members');
  end if;

  if to_regclass('public.wallets') is null then
    v_missing:=array_append(v_missing,'public.wallets');
  end if;

  if to_regclass('public.customer_sessions_secure') is null then
    v_missing:=array_append(
      v_missing,
      'public.customer_sessions_secure'
    );
  end if;

  if not exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='wallets'
      and column_name='expires_at'
  ) then
    v_missing:=array_append(
      v_missing,
      'wallets.expires_at from v3.1.1'
    );
  end if;

  if to_regprocedure(
    'public.ctd_expire_wallet_if_due(uuid)'
  ) is null then
    v_missing:=array_append(
      v_missing,
      'ctd_expire_wallet_if_due(uuid)'
    );
  end if;

  if to_regprocedure(
    'public.ctd_require_staff(text,text[])'
  ) is null then
    v_missing:=array_append(
      v_missing,
      'ctd_require_staff(text,text[])'
    );
  end if;

  if to_regprocedure(
    'public.mvp_generate_gift_codes_batch(uuid,text,bigint,date,integer)'
  ) is null then
    v_missing:=array_append(
      v_missing,
      'mvp_generate_gift_codes_batch latest'
    );
  end if;

  if cardinality(v_missing)>0 then
    raise exception
      'CTD v3.2.1 stopped. Missing base objects: %',
      array_to_string(v_missing,', ');
  end if;
end
$preflight$;

-- ================================================================
-- 1. REMOVE OLD OR ABANDONED WRAPPERS
-- ================================================================
drop function if exists public.s3_generate_member_gift(
  text,uuid,text,bigint,date
);

drop function if exists public.mvp_customer_preview_member_gift(
  text,text
);

drop function if exists public.mvp_customer_claim_member_gift(
  text,text
);

drop function if exists public.mvp_customer_preview_gift(
  text,text
);

drop function if exists public.mvp_customer_claim_gift(
  text,text
);

drop function if exists public.s3_generate_campaign_codes(
  text,text,text,bigint,date,integer
);

drop function if exists public.s3_generate_gift_codes_batch(
  text,text,bigint,date,integer
);

drop function if exists public.s3_list_gift_codes_paged(
  text,text,integer,integer
);

drop function if exists public.s3_copy_gift_code(
  text,uuid,text
);

drop function if exists public.s3_delete_gift_code(
  text,uuid
);

drop function if exists public.mvp_claim_gift_code(
  text,text,text,text,text,text
);

-- ================================================================
-- 2. CLEAN DATA MODEL
-- ================================================================
alter table public.gift_codes
  add column if not exists code_type text not null default 'voucher',
  add column if not exists copied_at timestamptz,
  add column if not exists copied_method text,
  add column if not exists copied_by_staff_id uuid
    references public.staff_profiles(id);

-- Preserve type if the abandoned target-member model was installed.
do $map_old_model$
begin
  if exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='gift_codes'
      and column_name='gift_type'
  ) then
    execute $dynamic$
      update public.gift_codes
      set code_type=case
        when gift_type='existing_member' then 'gift'
        else 'voucher'
      end
    $dynamic$;
  end if;
end
$map_old_model$;

-- These columns belong to the abandoned, member-specific Gift design.
alter table public.gift_codes
  drop column if exists target_member_id,
  drop column if exists gift_type;

update public.gift_codes
set code_type='voucher'
where code_type is null
   or code_type not in('voucher','gift');

alter table public.gift_codes
  drop constraint if exists gift_codes_code_type_check;

alter table public.gift_codes
  add constraint gift_codes_code_type_check
  check(code_type in('voucher','gift'));

-- Verify known status values before refreshing the lifecycle constraint.
do $status_precheck$
declare
  v_unknown text;
begin
  select string_agg(distinct g.status,', ')
  into v_unknown
  from public.gift_codes g
  where g.status not in(
    'available',
    'registered',
    'claimed',
    'used',
    'expired',
    'void'
  );

  if v_unknown is not null then
    raise exception
      'Unknown gift_codes status before migration: %',
      v_unknown;
  end if;
end
$status_precheck$;

alter table public.gift_codes
  drop constraint if exists gift_codes_status_check;

alter table public.gift_codes
  add constraint gift_codes_status_check
  check(status in(
    'available',
    'registered',
    'claimed',
    'used',
    'expired',
    'void'
  ));

create index if not exists idx_gift_codes_code_type_status
  on public.gift_codes(
    outlet_id,
    code_type,
    status,
    created_at desc
  );

create index if not exists idx_gift_codes_copy_state
  on public.gift_codes(outlet_id,copied_at)
  where copied_at is not null;

-- Internal generator is callable only through a secure owner wrapper.
revoke all on function public.mvp_generate_gift_codes_batch(
  uuid,text,bigint,date,integer
) from public,anon,authenticated;

-- ================================================================
-- 3. GENERATE VOUCHER OR GIFT
-- ================================================================
create function public.s3_generate_campaign_codes(
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

  if p_expired_at is null or p_expired_at<current_date then
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

-- ================================================================
-- 4. PAGINATED CONTROL LIST
-- ================================================================
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
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  update public.gift_codes g
  set status='expired'
  where g.outlet_id=v_staff.outlet_id
    and g.status='available'
    and g.expired_at is not null
    and g.expired_at<current_date;

  return query
  select
    g.id,
    g.code::text,
    g.value::bigint,
    g.status::text,
    g.campaign_name::text,
    g.expired_at,
    g.used_at,
    m.phone::text,
    m.name::text,
    g.created_at,
    g.copied_at,
    g.copied_method::text,
    g.code_type::text,
    count(*) over()::bigint
  from public.gift_codes g
  left join public.members m
    on m.id=g.used_by_member_id
  where g.outlet_id=v_staff.outlet_id
    and(
      v_status='all'
      or(
        v_status='registered'
        and g.status in('registered','used')
      )
      or(
        v_status<>'registered'
        and g.status=v_status
      )
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

-- ================================================================
-- 5. ONE-TIME SHARE LOCK
-- ================================================================
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
  expired_at date
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_gift public.gift_codes%rowtype;
  v_method text:=lower(trim(coalesce(p_method,'')));
  v_now timestamptz:=now();
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  if v_method not in('wa','link') then
    return query
    select
      false,
      'Metode share tidak valid'::text,
      p_gift_id,
      null::text,
      null::bigint,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::date;
    return;
  end if;

  select g.*
  into v_gift
  from public.gift_codes g
  where g.id=p_gift_id
    and g.outlet_id=v_staff.outlet_id
  for update;

  if not found then
    raise exception 'Voucher / Gift tidak ditemukan';
  end if;

  if v_gift.status='available'
     and v_gift.expired_at is not null
     and v_gift.expired_at<current_date then
    update public.gift_codes
    set status='expired'
    where id=v_gift.id;

    v_gift.status:='expired';
  end if;

  if v_gift.status<>'available' then
    return query
    select
      false,
      'Kode sudah tidak available dan tidak dapat dibagikan'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.value::bigint,
      v_gift.copied_at,
      v_gift.copied_method::text,
      v_gift.code_type::text,
      v_gift.campaign_name::text,
      v_gift.expired_at;
    return;
  end if;

  if v_gift.copied_at is not null then
    return query
    select
      false,
      format(
        'Kode sudah pernah dibagikan%s.',
        case
          when v_gift.copied_method is null then ''
          else ' via '||upper(v_gift.copied_method)
        end
      )::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.value::bigint,
      v_gift.copied_at,
      v_gift.copied_method::text,
      v_gift.code_type::text,
      v_gift.campaign_name::text,
      v_gift.expired_at;
    return;
  end if;

  update public.gift_codes g
  set
    copied_at=v_now,
    copied_method=v_method,
    copied_by_staff_id=v_staff.staff_id
  where g.id=v_gift.id;

  insert into public.security_audit_log(
    staff_id,
    outlet_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values(
    v_staff.staff_id,
    v_staff.outlet_id,
    'campaign_code_shared',
    'voucher',
    v_gift.id,
    jsonb_build_object(
      'method',v_method,
      'code',v_gift.code,
      'code_type',v_gift.code_type
    )
  );

  return query
  select
    true,
    null::text,
    v_gift.id,
    v_gift.code::text,
    v_gift.value::bigint,
    v_now,
    v_method,
    v_gift.code_type::text,
    v_gift.campaign_name::text,
    v_gift.expired_at;
end
$function$;

revoke all on function public.s3_copy_gift_code(
  text,uuid,text
) from public;

grant execute on function public.s3_copy_gift_code(
  text,uuid,text
) to anon,authenticated;

-- ================================================================
-- 6. DELETE ONLY UNSHARED AVAILABLE CODES
-- ================================================================
create function public.s3_delete_gift_code(
  p_staff_session_token text,
  p_gift_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_gift public.gift_codes%rowtype;
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  select g.*
  into v_gift
  from public.gift_codes g
  where g.id=p_gift_id
    and g.outlet_id=v_staff.outlet_id
  for update;

  if not found then
    raise exception 'Voucher / Gift tidak ditemukan';
  end if;

  if v_gift.status<>'available' then
    raise exception 'Hanya kode available yang bisa di-delete';
  end if;

  if v_gift.copied_at is not null then
    raise exception
      'Kode sudah dibagikan dan tidak bisa di-delete';
  end if;

  perform public.mvp_delete_gift_code(
    v_staff.staff_id,
    p_gift_id
  );

  insert into public.security_audit_log(
    staff_id,
    outlet_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values(
    v_staff.staff_id,
    v_staff.outlet_id,
    'campaign_code_voided',
    'voucher',
    p_gift_id,
    jsonb_build_object('code_type',v_gift.code_type)
  );

  return true;
end
$function$;

revoke all on function public.s3_delete_gift_code(
  text,uuid
) from public;

grant execute on function public.s3_delete_gift_code(
  text,uuid
) to anon,authenticated;

-- ================================================================
-- 7. NEW-MEMBER REGISTRATION ACCEPTS VOUCHER ONLY
-- ================================================================
create function public.mvp_claim_gift_code(
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
         and v_gift.expired_at<current_date
       ) then
      raise exception 'Voucher tidak tersedia / expired';
    end if;

    v_balance:=v_gift.value;

    if v_gift.expired_at is not null then
      v_expiry:=(
        v_gift.expired_at::date+time '23:59:59'
      ) at time zone 'Asia/Jakarta';
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
-- 8. CUSTOMER PREVIEW GIFT
-- ================================================================
create function public.mvp_customer_preview_gift(
  p_session_token text,
  p_code text
)
returns table(
  claim_allowed boolean,
  error_message text,
  gift_id uuid,
  code text,
  campaign_name text,
  value bigint,
  expired_at date,
  current_balance bigint,
  current_expiry timestamptz,
  result_expiry timestamptz
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
  v_code text:=upper(trim(coalesce(p_code,'')));
  v_gift_expiry timestamptz;
  v_result_expiry timestamptz;
begin
  select s.member_id
  into v_member_id
  from public.customer_sessions_secure s
  join public.members m
    on m.id=s.member_id
  where s.token_hash=public.ctd_token_hash(p_session_token)
    and s.revoked_at is null
    and s.expires_at>now()
    and m.status='active'
  limit 1;

  if v_member_id is null then
    return query
    select
      false,
      'Session customer tidak valid'::text,
      null::uuid,
      v_code,
      null::text,
      null::bigint,
      null::date,
      null::bigint,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  select m.*
  into v_member
  from public.members m
  where m.id=v_member_id;

  perform *
  from public.ctd_expire_wallet_if_due(v_member_id);

  select w.*
  into v_wallet
  from public.wallets w
  where w.member_id=v_member_id;

  select g.*
  into v_gift
  from public.gift_codes g
  where g.code=v_code
    and g.outlet_id=v_member.outlet_id
  limit 1;

  if not found then
    return query
    select
      false,
      'Gift tidak ditemukan'::text,
      null::uuid,
      v_code,
      null::text,
      null::bigint,
      null::date,
      coalesce(v_wallet.balance,0),
      v_wallet.expires_at,
      null::timestamptz;
    return;
  end if;

  if v_gift.code_type<>'gift' then
    return query
    select
      false,
      'Kode ini adalah VOUCHER untuk pendaftaran member baru'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      v_gift.expired_at,
      coalesce(v_wallet.balance,0),
      v_wallet.expires_at,
      null::timestamptz;
    return;
  end if;

  -- Gift is only for a member who already existed when it was generated.
  if v_member.created_at>v_gift.created_at then
    return query
    select
      false,
      'Gift hanya untuk member yang sudah terdaftar sebelum Gift dibuat'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      v_gift.expired_at,
      coalesce(v_wallet.balance,0),
      v_wallet.expires_at,
      null::timestamptz;
    return;
  end if;

  if v_gift.status<>'available' then
    return query
    select
      false,
      'Gift sudah pernah diclaim / tidak tersedia'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      v_gift.expired_at,
      coalesce(v_wallet.balance,0),
      v_wallet.expires_at,
      null::timestamptz;
    return;
  end if;

  if v_gift.expired_at is not null
     and v_gift.expired_at<current_date then
    return query
    select
      false,
      'Gift sudah expired'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      v_gift.expired_at,
      coalesce(v_wallet.balance,0),
      v_wallet.expires_at,
      null::timestamptz;
    return;
  end if;

  if v_gift.expired_at is not null then
    v_gift_expiry:=(
      v_gift.expired_at::date+time '23:59:59'
    ) at time zone 'Asia/Jakarta';
  end if;

  if coalesce(v_wallet.balance,0)>0
     and v_wallet.expires_at is null then
    v_result_expiry:=null;
  elsif coalesce(v_wallet.balance,0)>0
     and v_wallet.expires_at>now() then
    if v_gift_expiry is null then
      v_result_expiry:=null;
    else
      v_result_expiry:=greatest(
        v_wallet.expires_at,
        v_gift_expiry
      );
    end if;
  else
    v_result_expiry:=v_gift_expiry;
  end if;

  return query
  select
    true,
    null::text,
    v_gift.id,
    v_gift.code::text,
    v_gift.campaign_name::text,
    v_gift.value::bigint,
    v_gift.expired_at,
    coalesce(v_wallet.balance,0),
    v_wallet.expires_at,
    v_result_expiry;
end
$function$;

revoke all on function public.mvp_customer_preview_gift(
  text,text
) from public;

grant execute on function public.mvp_customer_preview_gift(
  text,text
) to anon,authenticated;

-- ================================================================
-- 9. CUSTOMER CLAIM: FIRST ELIGIBLE MEMBER WINS
-- ================================================================
create function public.mvp_customer_claim_gift(
  p_session_token text,
  p_code text
)
returns table(
  claim_success boolean,
  error_message text,
  gift_id uuid,
  campaign_name text,
  gift_value bigint,
  new_balance bigint,
  new_expiry timestamptz
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
  v_code text:=upper(trim(coalesce(p_code,'')));
  v_gift_expiry timestamptz;
  v_new_expiry timestamptz;
  v_new_balance bigint;
  v_tx uuid;
begin
  select s.member_id
  into v_member_id
  from public.customer_sessions_secure s
  join public.members m
    on m.id=s.member_id
  where s.token_hash=public.ctd_token_hash(p_session_token)
    and s.revoked_at is null
    and s.expires_at>now()
    and m.status='active'
  limit 1;

  if v_member_id is null then
    return query
    select
      false,
      'Session customer tidak valid'::text,
      null::uuid,
      null::text,
      null::bigint,
      null::bigint,
      null::timestamptz;
    return;
  end if;

  select m.*
  into v_member
  from public.members m
  where m.id=v_member_id
  for update;

  select g.*
  into v_gift
  from public.gift_codes g
  where g.code=v_code
    and g.outlet_id=v_member.outlet_id
  for update;

  if not found then
    return query
    select
      false,
      'Gift tidak ditemukan'::text,
      null::uuid,
      null::text,
      null::bigint,
      null::bigint,
      null::timestamptz;
    return;
  end if;

  if v_gift.code_type<>'gift' then
    return query
    select
      false,
      'Kode ini adalah VOUCHER untuk pendaftaran member baru'::text,
      v_gift.id,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      null::bigint,
      null::timestamptz;
    return;
  end if;

  if v_member.created_at>v_gift.created_at then
    return query
    select
      false,
      'Gift hanya untuk member yang sudah terdaftar sebelum Gift dibuat'::text,
      v_gift.id,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      null::bigint,
      null::timestamptz;
    return;
  end if;

  if v_gift.status<>'available' then
    return query
    select
      false,
      'Gift sudah pernah diclaim / tidak tersedia'::text,
      v_gift.id,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      null::bigint,
      null::timestamptz;
    return;
  end if;

  if v_gift.expired_at is not null
     and v_gift.expired_at<current_date then
    update public.gift_codes
    set status='expired'
    where id=v_gift.id;

    return query
    select
      false,
      'Gift sudah expired'::text,
      v_gift.id,
      v_gift.campaign_name::text,
      v_gift.value::bigint,
      null::bigint,
      null::timestamptz;
    return;
  end if;

  perform *
  from public.ctd_expire_wallet_if_due(v_member_id);

  select w.*
  into v_wallet
  from public.wallets w
  where w.member_id=v_member_id
  for update;

  if not found then
    raise exception 'Wallet member tidak ditemukan';
  end if;

  if v_gift.expired_at is not null then
    v_gift_expiry:=(
      v_gift.expired_at::date+time '23:59:59'
    ) at time zone 'Asia/Jakarta';
  end if;

  if v_wallet.balance>0
     and v_wallet.expires_at is null then
    v_new_expiry:=null;
  elsif v_wallet.balance>0
     and v_wallet.expires_at>now() then
    if v_gift_expiry is null then
      v_new_expiry:=null;
    else
      v_new_expiry:=greatest(
        v_wallet.expires_at,
        v_gift_expiry
      );
    end if;
  else
    v_new_expiry:=v_gift_expiry;
  end if;

  v_new_balance:=v_wallet.balance+v_gift.value;

  update public.wallets w
  set
    balance=v_new_balance,
    expires_at=v_new_expiry,
    expired_at=null,
    updated_at=now()
  where w.member_id=v_member_id;

  update public.gift_codes g
  set
    status='claimed',
    used_by_member_id=v_member_id,
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
    v_member.outlet_id,
    v_member_id,
    'gift_claim',
    v_gift.id,
    v_gift.value,
    'approved',
    jsonb_build_object(
      'code_type','gift',
      'claim_mode','first_eligible_member',
      'campaign_name',v_gift.campaign_name,
      'previous_balance',v_wallet.balance,
      'balance_after',v_new_balance,
      'previous_expiry',v_wallet.expires_at,
      'expires_at',v_new_expiry,
      'expiry_model','single_wallet'
    )
  )
  returning id into v_tx;

  insert into public.security_audit_log(
    outlet_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values(
    v_member.outlet_id,
    'generic_gift_claimed',
    'voucher',
    v_gift.id,
    jsonb_build_object(
      'member_id',v_member_id,
      'transaction_id',v_tx,
      'value',v_gift.value,
      'new_balance',v_new_balance,
      'new_expiry',v_new_expiry
    )
  );

  return query
  select
    true,
    null::text,
    v_gift.id,
    v_gift.campaign_name::text,
    v_gift.value::bigint,
    v_new_balance,
    v_new_expiry;
end
$function$;

revoke all on function public.mvp_customer_claim_gift(
  text,text
) from public;

grant execute on function public.mvp_customer_claim_gift(
  text,text
) to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- ================================================================
-- 10. INSTALLATION SUMMARY
-- ================================================================
select
  'code_type column' as check_name,
  case when exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='gift_codes'
      and column_name='code_type'
  ) then 'OK' else 'MISSING' end as result
union all
select
  'generic generator RPC',
  case when to_regprocedure(
    'public.s3_generate_campaign_codes(text,text,text,bigint,date,integer)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'list returns code type',
  case when position(
    'g.code_type'
    in pg_get_functiondef(
      to_regprocedure(
        'public.s3_list_gift_codes_paged(text,text,integer,integer)'
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end
union all
select
  'customer Gift preview RPC',
  case when to_regprocedure(
    'public.mvp_customer_preview_gift(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'customer Gift claim RPC',
  case when to_regprocedure(
    'public.mvp_customer_claim_gift(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'pre-existing member rule',
  case when position(
    'v_member.created_at>v_gift.created_at'
    in pg_get_functiondef(
      to_regprocedure(
        'public.mvp_customer_claim_gift(text,text)'
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end
union all
select
  'atomic first-claim lock',
  case when position(
    'for update'
    in lower(
      pg_get_functiondef(
        to_regprocedure(
          'public.mvp_customer_claim_gift(text,text)'
        )
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end
union all
select
  'obsolete target column removed',
  case when not exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='gift_codes'
      and column_name='target_member_id'
  ) then 'OK' else 'CHECK FAILED' end;
