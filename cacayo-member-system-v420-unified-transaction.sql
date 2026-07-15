-- CACAYO Member System v4.2.0
-- UNIFIED TRANSACTION: SALDO + GIFT ITEM
--
-- Required database baseline:
-- - v4.1.0 Gift Item
-- - v4.1.1 Reward Control Fix
-- - v4.1.2 Ambiguous Code Fix
--
-- Final transaction model:
-- - Staff finds one member.
-- - Staff may select balance, one or more Gift Items, or both.
-- - Bill / Invoice POS is mandatory.
-- - System creates one QR and one approval token.
-- - Customer enters one PIN.
-- - Balance deduction and all item redemptions are atomic:
--   either everything succeeds or nothing changes.
-- - Item IDs selected by the frontend are ordered FEFO
--   (earliest expiry first).
--
-- Existing member, wallet, Gift, Voucher, Gift Item, and transaction
-- history data are preserved.

begin;

-- ================================================================
-- 0. PRE-FLIGHT
-- ================================================================
do $preflight$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.members') is null then
    v_missing:=array_append(v_missing,'members');
  end if;

  if to_regclass('public.wallets') is null then
    v_missing:=array_append(v_missing,'wallets');
  end if;

  if to_regclass('public.member_gift_items') is null then
    v_missing:=array_append(v_missing,'member_gift_items');
  end if;

  if to_regclass('public.gift_item_master') is null then
    v_missing:=array_append(v_missing,'gift_item_master');
  end if;

  if to_regclass('public.transactions') is null then
    v_missing:=array_append(v_missing,'transactions');
  end if;

  if to_regclass('public.pending_approvals') is null then
    v_missing:=array_append(v_missing,'pending_approvals');
  end if;

  if to_regclass(
    'public.gift_item_redemption_requests'
  ) is null then
    v_missing:=array_append(
      v_missing,
      'gift_item_redemption_requests'
    );
  end if;

  if to_regprocedure(
    'public.ctd_require_staff(text,text[])'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_require_staff');
  end if;

  if to_regprocedure(
    'public.ctd_new_token()'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_new_token');
  end if;

  if to_regprocedure(
    'public.ctd_token_hash(text)'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_token_hash');
  end if;

  if to_regprocedure(
    'public.ctd_expire_wallet_if_due(uuid)'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_expire_wallet_if_due');
  end if;

  if to_regprocedure(
    'public.ctd_expire_due_gift_items(uuid)'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_expire_due_gift_items');
  end if;

  if to_regprocedure(
    'public.mvp_customer_preview_reward(text,text)'
  ) is null then
    v_missing:=array_append(
      v_missing,
      'v4.1.2 mvp_customer_preview_reward'
    );
  end if;

  if cardinality(v_missing)>0 then
    raise exception
      'v4.2.0 stopped. Missing base objects: %',
      array_to_string(v_missing,', ');
  end if;
end
$preflight$;

-- ================================================================
-- 1. UNIFIED REQUEST TABLE
-- ================================================================
create table if not exists public.unified_transaction_requests(
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  reference_code text unique not null,
  outlet_id uuid not null
    references public.outlets(id) on delete cascade,
  member_id uuid not null
    references public.members(id) on delete cascade,
  cashier_id uuid not null
    references public.staff_profiles(id),
  invoice_number text not null,
  balance_used bigint not null default 0
    check(balance_used>=0),
  balance_before bigint,
  balance_after bigint,
  selected_item_count integer not null default 0
    check(selected_item_count>=0),
  status text not null default 'waiting'
    check(status in(
      'waiting',
      'approved',
      'rejected',
      'expired'
    )),
  expires_at timestamptz not null,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.unified_transaction_requests
  enable row level security;

revoke all on table public.unified_transaction_requests
from public,anon,authenticated;

create unique index if not exists
  idx_unified_active_invoice
on public.unified_transaction_requests(
  outlet_id,
  lower(invoice_number)
)
where status in('waiting','approved');

create index if not exists
  idx_unified_token_hash
on public.unified_transaction_requests(token_hash);

create index if not exists
  idx_unified_member_created
on public.unified_transaction_requests(
  member_id,
  created_at desc
);

-- Associate selected item entitlements with one unified request.
alter table public.member_gift_items
  add column if not exists unified_request_id uuid
  references public.unified_transaction_requests(id);

alter table public.member_gift_items
  drop constraint if exists member_gift_items_status_check;

alter table public.member_gift_items
  add constraint member_gift_items_status_check
  check(status in(
    'available',
    'reserved',
    'redeemed',
    'expired',
    'void'
  ));

create index if not exists
  idx_member_gift_items_unified_request
on public.member_gift_items(unified_request_id)
where unified_request_id is not null;

-- ================================================================
-- 2. INTERNAL HELPERS
-- ================================================================
create or replace function public.ctd_unified_items_json(
  p_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'gift_item_id',
        grouped.gift_item_id,
        'item_name',
        grouped.item_name,
        'quantity',
        grouped.quantity,
        'earliest_expiry',
        grouped.earliest_expiry
      )
      order by grouped.earliest_expiry,grouped.item_name
    ),
    '[]'::jsonb
  )
  from(
    select
      i.id as gift_item_id,
      i.name::text as item_name,
      count(*)::integer as quantity,
      min(mg.expires_at) as earliest_expiry
    from public.member_gift_items mg
    join public.gift_item_master i
      on i.id=mg.gift_item_id
    where mg.unified_request_id=p_request_id
    group by i.id,i.name
  ) grouped
$function$;

revoke all on function public.ctd_unified_items_json(uuid)
from public,anon,authenticated;

create or replace function public.ctd_release_unified_request(
  p_request_id uuid,
  p_new_status text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_status text:=lower(trim(coalesce(p_new_status,'')));
begin
  if v_status not in('rejected','expired') then
    raise exception 'Status release tidak valid';
  end if;

  update public.member_gift_items mg
  set
    status=case
      when mg.expires_at<=now() then 'expired'
      else 'available'
    end,
    unified_request_id=null
  where mg.unified_request_id=p_request_id
    and mg.status='reserved';

  update public.unified_transaction_requests r
  set
    status=v_status,
    rejected_at=case
      when v_status='rejected' then now()
      else r.rejected_at
    end
  where r.id=p_request_id
    and r.status='waiting';

  return found;
end
$function$;

revoke all on function public.ctd_release_unified_request(uuid,text)
from public,anon,authenticated;

create or replace function public.ctd_expire_unified_requests()
returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_count integer:=0;
begin
  update public.member_gift_items mg
  set
    status=case
      when mg.expires_at<=now() then 'expired'
      else 'available'
    end,
    unified_request_id=null
  where mg.status='reserved'
    and exists(
      select 1
      from public.unified_transaction_requests r
      where r.id=mg.unified_request_id
        and r.status='waiting'
        and r.expires_at<=now()
    );

  update public.unified_transaction_requests r
  set status='expired'
  where r.status='waiting'
    and r.expires_at<=now();

  get diagnostics v_count=row_count;
  return v_count;
end
$function$;

revoke all on function public.ctd_expire_unified_requests()
from public,anon,authenticated;

-- ================================================================
-- 3. STAFF: AVAILABLE BENEFITS
-- Individual entitlements are returned so frontend can select FEFO IDs.
-- ================================================================
drop function if exists public.s42_staff_member_benefits(
  text,uuid
);

create function public.s42_staff_member_benefits(
  p_staff_session_token text,
  p_member_id uuid
)
returns table(
  member_gift_item_id uuid,
  gift_item_id uuid,
  item_name text,
  item_description text,
  image_data_url text,
  status text,
  expires_at timestamptz,
  days_remaining integer
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  if not exists(
    select 1
    from public.members m
    where m.id=p_member_id
      and m.outlet_id=v_staff.outlet_id
      and m.status='active'
  ) then
    raise exception
      'Member tidak ditemukan / akun tidak aktif';
  end if;

  perform public.ctd_expire_unified_requests();
  perform public.ctd_expire_due_gift_items(p_member_id);

  return query
  select
    mg.id,
    i.id,
    i.name::text,
    i.description::text,
    i.image_data_url::text,
    mg.status::text,
    mg.expires_at,
    (
      (
        mg.expires_at at time zone 'Asia/Jakarta'
      )::date
      -
      (
        now() at time zone 'Asia/Jakarta'
      )::date
    )::integer
  from public.member_gift_items mg
  join public.gift_item_master i
    on i.id=mg.gift_item_id
  where mg.outlet_id=v_staff.outlet_id
    and mg.member_id=p_member_id
    and mg.status='available'
    and mg.expires_at>now()
  order by
    mg.expires_at asc,
    i.name,
    mg.claimed_at;
end
$function$;

revoke all on function public.s42_staff_member_benefits(
  text,uuid
) from public;

grant execute on function public.s42_staff_member_benefits(
  text,uuid
) to anon,authenticated;

-- ================================================================
-- 4. STAFF: CREATE ONE UNIFIED REQUEST
-- ================================================================
drop function if exists public.s42_create_unified_transaction(
  text,uuid,text,bigint,uuid[]
);

create function public.s42_create_unified_transaction(
  p_staff_session_token text,
  p_member_id uuid,
  p_invoice_number text,
  p_balance_used bigint,
  p_member_gift_item_ids uuid[]
)
returns table(
  request_id uuid,
  token text,
  reference_code text,
  invoice_number text,
  balance_before bigint,
  balance_after bigint,
  item_count integer,
  items jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_member public.members%rowtype;
  v_wallet public.wallets%rowtype;
  v_item_ids uuid[];
  v_item_count integer:=0;
  v_reserved_count integer:=0;
  v_request_id uuid;
  v_token text;
  v_reference text;
  v_invoice text:=trim(coalesce(p_invoice_number,''));
  v_balance_used bigint:=coalesce(p_balance_used,0);
  v_expiry timestamptz:=now()+interval '15 minutes';
  v_items jsonb;
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  perform public.ctd_expire_unified_requests();
  perform public.ctd_expire_due_gift_items(p_member_id);
  perform *
  from public.ctd_expire_wallet_if_due(p_member_id);

  select m.*
  into v_member
  from public.members m
  where m.id=p_member_id
    and m.outlet_id=v_staff.outlet_id
    and m.status='active'
  for update;

  if not found then
    raise exception
      'Member tidak ditemukan / akun tidak aktif';
  end if;

  if v_invoice='' then
    raise exception 'Nomor Bill/Invoice POS wajib diisi';
  end if;

  if length(v_invoice)>80 then
    raise exception
      'Nomor Bill/Invoice maksimal 80 karakter';
  end if;

  if v_balance_used<0 then
    raise exception 'Nominal saldo tidak valid';
  end if;

  select coalesce(
    array_agg(distinct selected.item_id),
    array[]::uuid[]
  )
  into v_item_ids
  from unnest(
    coalesce(
      p_member_gift_item_ids,
      array[]::uuid[]
    )
  ) as selected(item_id);

  v_item_count:=cardinality(v_item_ids);

  if v_item_count>20 then
    raise exception
      'Maksimal 20 Gift Item per transaksi';
  end if;

  if v_balance_used=0 and v_item_count=0 then
    raise exception
      'Pilih saldo, Gift Item, atau keduanya';
  end if;

  select w.*
  into v_wallet
  from public.wallets w
  where w.member_id=p_member_id
  for update;

  if not found then
    raise exception 'Wallet member tidak ditemukan';
  end if;

  if v_balance_used>v_wallet.balance then
    raise exception 'Saldo member tidak cukup';
  end if;

  v_token:=public.ctd_new_token();

  v_reference:=
    'UTX-'||
    to_char(
      now() at time zone 'Asia/Jakarta',
      'YYMMDDHH24MISS'
    )||
    '-'||
    upper(
      substr(
        replace(gen_random_uuid()::text,'-',''),
        1,
        6
      )
    );

  begin
    insert into public.unified_transaction_requests(
      token_hash,
      reference_code,
      outlet_id,
      member_id,
      cashier_id,
      invoice_number,
      balance_used,
      balance_before,
      balance_after,
      selected_item_count,
      status,
      expires_at
    )
    values(
      public.ctd_token_hash(v_token),
      v_reference,
      v_staff.outlet_id,
      p_member_id,
      v_staff.staff_id,
      v_invoice,
      v_balance_used,
      v_wallet.balance,
      v_wallet.balance-v_balance_used,
      v_item_count,
      'waiting',
      v_expiry
    )
    returning id
    into v_request_id;
  exception
    when unique_violation then
      raise exception
        'Nomor Bill/Invoice sedang digunakan atau sudah pernah disetujui';
  end;

  if v_item_count>0 then
    update public.member_gift_items mg
    set
      status='reserved',
      unified_request_id=v_request_id
    where mg.id=any(v_item_ids)
      and mg.outlet_id=v_staff.outlet_id
      and mg.member_id=p_member_id
      and mg.status='available'
      and mg.expires_at>now();

    get diagnostics v_reserved_count=row_count;

    if v_reserved_count<>v_item_count then
      raise exception
        'Satu atau lebih Gift Item sudah digunakan, expired, atau tidak tersedia';
    end if;
  end if;

  v_items:=public.ctd_unified_items_json(v_request_id);

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
    'unified_transaction_requested',
    'unified_transaction',
    v_request_id,
    jsonb_build_object(
      'reference_code',v_reference,
      'invoice_number',v_invoice,
      'member_id',p_member_id,
      'balance_used',v_balance_used,
      'item_count',v_item_count
    )
  );

  return query
  select
    v_request_id,
    v_token,
    v_reference,
    v_invoice,
    v_wallet.balance,
    v_wallet.balance-v_balance_used,
    v_item_count,
    v_items,
    v_expiry;
end
$function$;

revoke all on function public.s42_create_unified_transaction(
  text,uuid,text,bigint,uuid[]
) from public;

grant execute on function public.s42_create_unified_transaction(
  text,uuid,text,bigint,uuid[]
) to anon,authenticated;

-- ================================================================
-- 5. PUBLIC: GET ONE REQUEST BY TOKEN
-- ================================================================
drop function if exists public.mvp_get_unified_transaction(text);

create function public.mvp_get_unified_transaction(
  p_token text
)
returns table(
  request_id uuid,
  reference_code text,
  invoice_number text,
  member_id uuid,
  member_name text,
  member_phone text,
  balance_used bigint,
  balance_before bigint,
  balance_after bigint,
  item_count integer,
  items jsonb,
  status text,
  request_expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $function$
begin
  perform public.ctd_expire_unified_requests();

  return query
  select
    r.id,
    r.reference_code::text,
    r.invoice_number::text,
    r.member_id,
    m.name::text,
    m.phone::text,
    r.balance_used::bigint,
    r.balance_before::bigint,
    r.balance_after::bigint,
    r.selected_item_count::integer,
    public.ctd_unified_items_json(r.id),
    r.status::text,
    r.expires_at,
    r.created_at
  from public.unified_transaction_requests r
  join public.members m
    on m.id=r.member_id
  where r.token_hash=public.ctd_token_hash(p_token)
  limit 1;
end
$function$;

revoke all on function public.mvp_get_unified_transaction(text)
from public;

grant execute on function public.mvp_get_unified_transaction(text)
to anon,authenticated;

-- ================================================================
-- 6. PUBLIC: REJECT REQUEST AND RELEASE ITEMS
-- ================================================================
drop function if exists public.mvp_reject_unified_transaction(text);

create function public.mvp_reject_unified_transaction(
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_request public.unified_transaction_requests%rowtype;
begin
  perform public.ctd_expire_unified_requests();

  select r.*
  into v_request
  from public.unified_transaction_requests r
  where r.token_hash=public.ctd_token_hash(p_token)
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if v_request.status<>'waiting' then
    return false;
  end if;

  perform public.ctd_release_unified_request(
    v_request.id,
    'rejected'
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
    v_request.cashier_id,
    v_request.outlet_id,
    'unified_transaction_rejected',
    'unified_transaction',
    v_request.id,
    jsonb_build_object(
      'reference_code',v_request.reference_code,
      'invoice_number',v_request.invoice_number
    )
  );

  return true;
end
$function$;

revoke all on function public.mvp_reject_unified_transaction(text)
from public;

grant execute on function public.mvp_reject_unified_transaction(text)
to anon,authenticated;

-- ================================================================
-- 7. PUBLIC: ATOMIC PIN APPROVAL
-- ================================================================
drop function if exists public.mvp_approve_unified_transaction(
  text,text
);

create function public.mvp_approve_unified_transaction(
  p_token text,
  p_password text
)
returns table(
  approval_success boolean,
  error_message text,
  remaining_attempts integer,
  reference_code text,
  invoice_number text,
  balance_after bigint,
  items jsonb
)
language plpgsql
security definer
set search_path=public,extensions
as $function$
declare
  v_request public.unified_transaction_requests%rowtype;
  v_member public.members%rowtype;
  v_wallet public.wallets%rowtype;
  v_attempts integer;
  v_reserved_count integer:=0;
  v_expired_count integer:=0;
  v_balance_after bigint;
  v_items jsonb;
  v_block_message text:=
    'Anda telah salah memasukkan PIN sebanyak 10 kali. Akun sementara diblokir. Silakan reset PIN melalui kasir.';
begin
  if p_password !~ '^[0-9]{6}$' then
    return query
    select
      false,
      'PIN wajib 6 digit angka'::text,
      null::integer,
      null::text,
      null::text,
      null::bigint,
      '[]'::jsonb;
    return;
  end if;

  perform public.ctd_expire_unified_requests();

  select r.*
  into v_request
  from public.unified_transaction_requests r
  where r.token_hash=public.ctd_token_hash(p_token)
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if v_request.status<>'waiting' then
    return query
    select
      false,
      format(
        'Transaksi sudah %s',
        upper(v_request.status)
      )::text,
      null::integer,
      v_request.reference_code::text,
      v_request.invoice_number::text,
      v_request.balance_after::bigint,
      public.ctd_unified_items_json(v_request.id);
    return;
  end if;

  select m.*
  into v_member
  from public.members m
  where m.id=v_request.member_id
  for update;

  if not found or v_member.status='deleted' then
    perform public.ctd_release_unified_request(
      v_request.id,
      'rejected'
    );

    return query
    select
      false,
      'Member tidak ditemukan'::text,
      null::integer,
      v_request.reference_code::text,
      v_request.invoice_number::text,
      null::bigint,
      '[]'::jsonb;
    return;
  end if;

  if v_member.status='blocked' then
    perform public.ctd_release_unified_request(
      v_request.id,
      'rejected'
    );

    return query
    select
      false,
      v_block_message,
      0,
      v_request.reference_code::text,
      v_request.invoice_number::text,
      null::bigint,
      '[]'::jsonb;
    return;
  end if;

  if v_member.password_hash is null
     or v_member.password_hash<>
       extensions.crypt(
         p_password,
         v_member.password_hash
       ) then

    v_attempts:=least(
      coalesce(v_member.failed_pin_attempts,0)+1,
      10
    );

    update public.members m
    set
      failed_pin_attempts=v_attempts,
      status=case
        when v_attempts>=10 then 'blocked'
        else m.status
      end,
      blocked_at=case
        when v_attempts>=10 then now()
        else m.blocked_at
      end
    where m.id=v_member.id;

    if v_attempts>=10 then
      perform public.ctd_release_unified_request(
        v_request.id,
        'rejected'
      );

      return query
      select
        false,
        v_block_message,
        0,
        v_request.reference_code::text,
        v_request.invoice_number::text,
        null::bigint,
        '[]'::jsonb;
    else
      return query
      select
        false,
        format(
          'PIN salah. Sisa percobaan %s kali.',
          10-v_attempts
        )::text,
        10-v_attempts,
        v_request.reference_code::text,
        v_request.invoice_number::text,
        null::bigint,
        public.ctd_unified_items_json(v_request.id);
    end if;

    return;
  end if;

  -- Lock every reserved item selected for this request.
  perform mg.id
  from public.member_gift_items mg
  where mg.unified_request_id=v_request.id
  for update;

  select
    count(*)::integer,
    count(*) filter(
      where mg.expires_at<=now()
    )::integer
  into
    v_reserved_count,
    v_expired_count
  from public.member_gift_items mg
  where mg.unified_request_id=v_request.id
    and mg.status='reserved';

  if v_reserved_count<>v_request.selected_item_count
     or v_expired_count>0 then
    perform public.ctd_release_unified_request(
      v_request.id,
      'expired'
    );

    return query
    select
      false,
      'Satu atau lebih Gift Item sudah tidak tersedia / expired'::text,
      null::integer,
      v_request.reference_code::text,
      v_request.invoice_number::text,
      null::bigint,
      '[]'::jsonb;
    return;
  end if;

  perform *
  from public.ctd_expire_wallet_if_due(v_request.member_id);

  select w.*
  into v_wallet
  from public.wallets w
  where w.member_id=v_request.member_id
  for update;

  if not found then
    perform public.ctd_release_unified_request(
      v_request.id,
      'rejected'
    );

    return query
    select
      false,
      'Wallet member tidak ditemukan'::text,
      null::integer,
      v_request.reference_code::text,
      v_request.invoice_number::text,
      null::bigint,
      '[]'::jsonb;
    return;
  end if;

  if v_request.balance_used>v_wallet.balance then
    perform public.ctd_release_unified_request(
      v_request.id,
      'rejected'
    );

    return query
    select
      false,
      'Saldo member tidak cukup. Transaksi dibatalkan tanpa menggunakan Gift Item.'::text,
      null::integer,
      v_request.reference_code::text,
      v_request.invoice_number::text,
      v_wallet.balance::bigint,
      '[]'::jsonb;
    return;
  end if;

  v_balance_after:=
    v_wallet.balance-v_request.balance_used;

  -- From this point onward everything is one PostgreSQL transaction.
  if v_request.balance_used>0 then
    update public.wallets w
    set
      balance=v_balance_after,
      updated_at=now()
    where w.member_id=v_request.member_id;
  end if;

  update public.member_gift_items mg
  set
    status='redeemed',
    redeemed_at=now(),
    redeemed_by_staff_id=v_request.cashier_id
  where mg.unified_request_id=v_request.id
    and mg.status='reserved';

  update public.unified_transaction_requests r
  set
    status='approved',
    approved_at=now(),
    balance_before=v_wallet.balance,
    balance_after=v_balance_after
  where r.id=v_request.id;

  update public.members m
  set
    failed_pin_attempts=0,
    blocked_at=null
  where m.id=v_request.member_id;

  if v_request.balance_used>0 then
    insert into public.transactions(
      outlet_id,
      member_id,
      cashier_id,
      type,
      balance_used,
      approval_method,
      status,
      metadata
    )
    values(
      v_request.outlet_id,
      v_request.member_id,
      v_request.cashier_id,
      'use_balance',
      v_request.balance_used,
      'customer_phone',
      'approved',
      jsonb_build_object(
        'reference_code',v_request.reference_code,
        'invoice_number',v_request.invoice_number,
        'balance_before',v_wallet.balance,
        'balance_after',v_balance_after,
        'unified_request_id',v_request.id,
        'selected_item_count',
          v_request.selected_item_count
      )
    );
  end if;

  insert into public.transactions(
    outlet_id,
    member_id,
    cashier_id,
    type,
    status,
    approval_method,
    metadata
  )
  select
    v_request.outlet_id,
    v_request.member_id,
    v_request.cashier_id,
    'gift_item_redeem',
    'approved',
    'customer_phone',
    jsonb_build_object(
      'reference_code',v_request.reference_code,
      'invoice_number',v_request.invoice_number,
      'unified_request_id',v_request.id,
      'member_gift_item_id',mg.id,
      'gift_item_id',i.id,
      'gift_item_name',i.name
    )
  from public.member_gift_items mg
  join public.gift_item_master i
    on i.id=mg.gift_item_id
  where mg.unified_request_id=v_request.id
    and mg.status='redeemed';

  v_items:=public.ctd_unified_items_json(v_request.id);

  insert into public.security_audit_log(
    staff_id,
    outlet_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values(
    v_request.cashier_id,
    v_request.outlet_id,
    'unified_transaction_approved',
    'unified_transaction',
    v_request.id,
    jsonb_build_object(
      'reference_code',v_request.reference_code,
      'invoice_number',v_request.invoice_number,
      'member_id',v_request.member_id,
      'balance_used',v_request.balance_used,
      'balance_after',v_balance_after,
      'item_count',v_request.selected_item_count
    )
  );

  return query
  select
    true,
    null::text,
    null::integer,
    v_request.reference_code::text,
    v_request.invoice_number::text,
    v_balance_after,
    v_items;
end
$function$;

revoke all on function public.mvp_approve_unified_transaction(
  text,text
) from public;

grant execute on function public.mvp_approve_unified_transaction(
  text,text
) to anon,authenticated;

-- ================================================================
-- 8. ENRICHED STAFF REPORT
-- Keeps separate rows but links them by reference and invoice.
-- ================================================================
drop function if exists public.s42_staff_transactions_by_date(
  text,date,date,text
);

create function public.s42_staff_transactions_by_date(
  p_staff_session_token text,
  p_date_from date,
  p_date_to date,
  p_type text default 'all'
)
returns table(
  transaction_id uuid,
  type text,
  member_name text,
  member_phone text,
  balance_used bigint,
  cash_paid bigint,
  credit_issued bigint,
  status text,
  created_at timestamptz,
  reference_code text,
  invoice_number text,
  item_name text
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_from date:=coalesce(
    p_date_from,
    (
      now() at time zone 'Asia/Jakarta'
    )::date-6
  );
  v_to date:=coalesce(
    p_date_to,
    (
      now() at time zone 'Asia/Jakarta'
    )::date
  );
  v_type text:=lower(
    trim(coalesce(p_type,'all'))
  );
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  if v_from>v_to then
    raise exception
      'Tanggal awal tidak boleh setelah tanggal akhir';
  end if;

  if v_to-v_from>366 then
    raise exception
      'Rentang report maksimal 366 hari';
  end if;

  return query
  select
    t.id,
    t.type::text,
    m.name::text,
    m.phone::text,
    coalesce(t.balance_used,0)::bigint,
    coalesce(t.cash_paid,0)::bigint,
    coalesce(t.credit_issued,0)::bigint,
    t.status::text,
    t.created_at,
    t.metadata->>'reference_code',
    t.metadata->>'invoice_number',
    t.metadata->>'gift_item_name'
  from public.transactions t
  left join public.members m
    on m.id=t.member_id
  where t.outlet_id=v_staff.outlet_id
    and(
      t.created_at at time zone 'Asia/Jakarta'
    )::date between v_from and v_to
    and(
      v_type='all'
      or t.type=v_type
    )
  order by t.created_at desc
  limit 2000;
end
$function$;

revoke all on function public.s42_staff_transactions_by_date(
  text,date,date,text
) from public;

grant execute on function public.s42_staff_transactions_by_date(
  text,date,date,text
) to anon,authenticated;

-- ================================================================
-- 9. RETIRE SEPARATE APPROVAL ENDPOINTS
-- ================================================================
-- Expire legacy waiting requests before removing executable endpoints.
update public.pending_approvals p
set status='expired'
where p.status='waiting';

update public.gift_item_redemption_requests r
set status='expired'
where r.status='waiting';

drop function if exists public.s3_create_approval_request(
  text,uuid,bigint
);

drop function if exists public.mvp_get_approval(text);
drop function if exists public.mvp_reject_approval(text);
drop function if exists public.mvp_approve_balance_use(text,text);

drop function if exists public.s4_create_item_redemption(
  text,uuid
);

drop function if exists public.mvp_get_item_redemption(text);
drop function if exists public.mvp_reject_item_redemption(text);
drop function if exists public.mvp_approve_item_redemption(
  text,text
);

notify pgrst,'reload schema';

commit;

-- ================================================================
-- INSTALLATION CHECK
-- ================================================================
select
  'unified request table' as check_name,
  case when to_regclass(
    'public.unified_transaction_requests'
  ) is not null
  then 'OK'
  else 'MISSING'
  end as result
union all
select
  'staff benefit RPC',
  case when to_regprocedure(
    'public.s42_staff_member_benefits(text,uuid)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'create unified RPC',
  case when to_regprocedure(
    'public.s42_create_unified_transaction(text,uuid,text,bigint,uuid[])'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'public get unified RPC',
  case when to_regprocedure(
    'public.mvp_get_unified_transaction(text)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'atomic approval RPC',
  case when to_regprocedure(
    'public.mvp_approve_unified_transaction(text,text)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'report RPC',
  case when to_regprocedure(
    'public.s42_staff_transactions_by_date(text,date,date,text)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'legacy balance approval removed',
  case when to_regprocedure(
    'public.mvp_approve_balance_use(text,text)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'legacy item approval removed',
  case when to_regprocedure(
    'public.mvp_approve_item_redemption(text,text)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end;
