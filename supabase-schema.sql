-- Cash to Dine Supabase starter schema
-- Run in Supabase SQL Editor.
-- This is a starting point, not final audited financial ledger.

create extension if not exists pgcrypto;

create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),
  name text not null,
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('owner','kasir')),
  status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),
  member_code text unique not null,
  name text not null,
  phone text unique not null,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists wallets (
  member_id uuid primary key references members(id),
  balance bigint not null default 0,
  updated_at timestamptz default now(),
  constraint balance_non_negative check (balance >= 0)
);

create table if not exists gift_codes (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),
  code text unique not null,
  value bigint not null check (value > 0),
  status text not null default 'available' check (status in ('available','used','expired','void')),
  campaign_name text not null,
  expired_at date not null,
  used_by_member_id uuid references members(id),
  used_at timestamptz,
  created_by_staff_id uuid references staff_profiles(id),
  created_at timestamptz default now()
);

create table if not exists pending_approvals (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  outlet_id uuid references outlets(id),
  member_id uuid references members(id),
  cashier_id uuid references staff_profiles(id),
  pos_bill_number text,
  total_bill bigint check (total_bill is null or total_bill > 0),
  balance_used bigint not null check (balance_used > 0),
  remaining_payment bigint not null default 0 check (remaining_payment >= 0),
  remaining_payment_method text,
  status text not null default 'waiting' check (status in ('waiting','approved','rejected','expired')),
  created_at timestamptz default now(),
  approved_at timestamptz
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),
  member_id uuid references members(id),
  cashier_id uuid references staff_profiles(id),
  type text not null check (type in ('gift_claim','topup','use_balance','void')),
  pos_bill_number text,
  total_bill bigint,
  balance_used bigint default 0,
  remaining_payment bigint default 0,
  remaining_payment_method text,
  cash_paid bigint default 0,
  credit_issued bigint default 0,
  gift_code_id uuid references gift_codes(id),
  approval_method text,
  status text not null default 'approved',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Atomic claim gift code during registration.
-- In real production, password hashing must be handled safely in backend/auth layer.
create or replace function claim_gift_code(
  p_outlet_id uuid,
  p_member_code text,
  p_name text,
  p_phone text,
  p_password_hash text,
  p_gift_code text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_gift gift_codes%rowtype;
  v_member_id uuid;
begin
  select * into v_gift
  from gift_codes
  where code = upper(p_gift_code)
    and outlet_id = p_outlet_id
  for update;

  if not found then
    raise exception 'Gift code not found';
  end if;

  if v_gift.status <> 'available' then
    raise exception 'Gift code not available';
  end if;

  if v_gift.expired_at < current_date then
    update gift_codes set status='expired' where id=v_gift.id;
    raise exception 'Gift code expired';
  end if;

  insert into members(outlet_id, member_code, name, phone, password_hash, status)
  values(p_outlet_id, p_member_code, p_name, p_phone, p_password_hash, 'active')
  returning id into v_member_id;

  insert into wallets(member_id, balance)
  values(v_member_id, v_gift.value);

  update gift_codes
  set status='used', used_by_member_id=v_member_id, used_at=now()
  where id=v_gift.id;

  insert into transactions(outlet_id, member_id, type, gift_code_id, credit_issued, status)
  values(p_outlet_id, v_member_id, 'gift_claim', v_gift.id, v_gift.value, 'approved');

  return v_member_id;
end;
$$;

-- Atomic approve and deduct balance.
create or replace function approve_balance_use(
  p_token text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_pending pending_approvals%rowtype;
  v_balance bigint;
  v_tx_id uuid;
begin
  select * into v_pending
  from pending_approvals
  where token = p_token
  for update;

  if not found then
    raise exception 'Approval not found';
  end if;

  if v_pending.status <> 'waiting' then
    raise exception 'Approval already processed';
  end if;

  select balance into v_balance
  from wallets
  where member_id = v_pending.member_id
  for update;

  if v_balance is null or v_balance < v_pending.balance_used then
    raise exception 'Insufficient balance';
  end if;

  update wallets
  set balance = balance - v_pending.balance_used, updated_at = now()
  where member_id = v_pending.member_id;

  update pending_approvals
  set status='approved', approved_at=now()
  where id = v_pending.id;

  insert into transactions(
    outlet_id, member_id, cashier_id, type, pos_bill_number,
    total_bill, balance_used, remaining_payment, remaining_payment_method,
    approval_method, status
  )
  values(
    v_pending.outlet_id, v_pending.member_id, v_pending.cashier_id, 'use_balance',
    v_pending.pos_bill_number, v_pending.total_bill, v_pending.balance_used,
    v_pending.remaining_payment, v_pending.remaining_payment_method,
    'customer_phone', 'approved'
  )
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

-- Indexes
create index if not exists idx_members_phone on members(phone);
create index if not exists idx_gift_codes_code on gift_codes(code);
create index if not exists idx_transactions_member on transactions(member_id);
create index if not exists idx_transactions_pos_bill on transactions(pos_bill_number);
create index if not exists idx_pending_token on pending_approvals(token);


-- Balance safety rules:
-- 1. wallets.balance has CHECK balance >= 0
-- 2. approve_balance_use locks wallet row FOR UPDATE
-- 3. approve_balance_use rejects if balance < requested balance_used
-- 4. request equal to current balance is allowed and results in balance = 0
