-- Cash to Dine Supabase Schema v0.6 RLS-ready
-- Use this in Supabase SQL Editor.
-- Goal: create database tables with Row Level Security enabled from day 1.
-- This is still MVP/trial schema, not final audited financial infrastructure.

create extension if not exists pgcrypto;

-- =========================
-- TABLES
-- =========================

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
  balance_used bigint not null check (balance_used > 0),
  balance_before bigint,
  balance_after bigint,
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
  balance_used bigint default 0,
  cash_paid bigint default 0,
  credit_issued bigint default 0,
  gift_code_id uuid references gift_codes(id),
  approval_method text,
  status text not null default 'approved',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_members_phone on members(phone);
create index if not exists idx_gift_codes_code on gift_codes(code);
create index if not exists idx_transactions_member on transactions(member_id);
create index if not exists idx_pending_token on pending_approvals(token);
create index if not exists idx_staff_username on staff_profiles(username);

-- =========================
-- RLS ENABLED
-- =========================

alter table outlets enable row level security;
alter table staff_profiles enable row level security;
alter table members enable row level security;
alter table wallets enable row level security;
alter table gift_codes enable row level security;
alter table pending_approvals enable row level security;
alter table transactions enable row level security;

-- MVP DEV NOTE:
-- For v0.6 connected app, frontend should access data mostly through SECURITY DEFINER RPC functions below.
-- Direct table policies are intentionally limited.
-- This avoids exposing raw full-table access to anon users.

-- Allow basic read of outlet by slug for public join pages.
drop policy if exists "public_read_outlets" on outlets;
create policy "public_read_outlets"
on outlets for select
to anon, authenticated
using (true);

-- For internal trial only: allow reading minimal member lookup and wallet through RPC later.
-- Do not add broad public direct policies for wallets/gift_codes.

-- =========================
-- SEED DEMO DATA
-- =========================

insert into outlets (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Cacayo', 'cacayo')
on conflict (slug) do nothing;

-- Passwords are plain in MVP schema only as placeholder hash text.
-- Production must hash password server-side.
insert into staff_profiles (id, outlet_id, name, username, password_hash, role)
values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Owner Demo', 'owner', 'owner123', 'owner'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Kasir Demo', 'kasir', 'kasir123', 'kasir')
on conflict (username) do nothing;

insert into members (id, outlet_id, member_code, name, phone, password_hash, status)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CTD-000001', 'Andrew Demo', '628553007700', '123456', 'active')
on conflict (phone) do nothing;

insert into wallets (member_id, balance)
values ('20000000-0000-0000-0000-000000000001', 250000)
on conflict (member_id) do nothing;

insert into gift_codes (outlet_id, code, value, status, campaign_name, expired_at)
values ('00000000-0000-0000-0000-000000000001', 'A7K9P2QX', 100000, 'available', 'Demo Soft Opening', '2026-08-31')
on conflict (code) do nothing;

-- =========================
-- RPC FUNCTIONS
-- =========================

-- Login MVP: returns staff profile if username/password matches.
-- Production should use Supabase Auth or proper password hashing.
create or replace function mvp_staff_login(
  p_username text,
  p_password text
)
returns table (
  id uuid,
  outlet_id uuid,
  name text,
  username text,
  role text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.outlet_id, s.name, s.username, s.role, s.status
  from staff_profiles s
  where s.username = p_username
    and s.password_hash = p_password
    and s.status = 'active'
  limit 1;
$$;

grant execute on function mvp_staff_login(text, text) to anon, authenticated;

-- Generate gift codes should be called by Owner only in real app.
-- MVP function trusts caller-provided staff id, then validates role='owner'.
create or replace function mvp_generate_gift_code(
  p_staff_id uuid,
  p_campaign_name text,
  p_code text,
  p_value bigint,
  p_expired_at date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff staff_profiles%rowtype;
  v_gift_id uuid;
begin
  select * into v_staff from staff_profiles where id = p_staff_id and status = 'active';
  if not found or v_staff.role <> 'owner' then
    raise exception 'Only owner can generate gift code';
  end if;

  insert into gift_codes(outlet_id, code, value, status, campaign_name, expired_at, created_by_staff_id)
  values(v_staff.outlet_id, upper(p_code), p_value, 'available', p_campaign_name, p_expired_at, p_staff_id)
  returning id into v_gift_id;

  return v_gift_id;
end;
$$;

grant execute on function mvp_generate_gift_code(uuid, text, text, bigint, date) to anon, authenticated;

-- Claim gift code during new member registration.
-- Atomic: locks gift code, creates member, creates wallet, marks code used, inserts transaction.
create or replace function mvp_claim_gift_code(
  p_outlet_slug text,
  p_member_code text,
  p_name text,
  p_phone text,
  p_password text,
  p_gift_code text
)
returns table (
  member_id uuid,
  member_code text,
  initial_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outlet_id uuid;
  v_gift gift_codes%rowtype;
  v_member_id uuid;
begin
  select id into v_outlet_id from outlets where slug = p_outlet_slug;
  if v_outlet_id is null then
    raise exception 'Outlet not found';
  end if;

  select * into v_gift
  from gift_codes
  where code = upper(p_gift_code)
    and outlet_id = v_outlet_id
  for update;

  if not found then
    raise exception 'Gift Code tidak ditemukan';
  end if;

  if v_gift.status <> 'available' then
    raise exception 'Gift Code sudah digunakan / tidak tersedia';
  end if;

  if v_gift.expired_at < current_date then
    update gift_codes set status='expired' where id=v_gift.id;
    raise exception 'Gift Code expired';
  end if;

  insert into members(outlet_id, member_code, name, phone, password_hash, status)
  values(v_outlet_id, p_member_code, p_name, p_phone, p_password, 'active')
  returning id into v_member_id;

  insert into wallets(member_id, balance)
  values(v_member_id, v_gift.value);

  update gift_codes
  set status='used', used_by_member_id=v_member_id, used_at=now()
  where id=v_gift.id;

  insert into transactions(outlet_id, member_id, type, gift_code_id, credit_issued, status)
  values(v_outlet_id, v_member_id, 'gift_claim', v_gift.id, v_gift.value, 'approved');

  return query select v_member_id, p_member_code, v_gift.value;
end;
$$;

grant execute on function mvp_claim_gift_code(text, text, text, text, text, text) to anon, authenticated;

-- Search member by phone for kasir.
create or replace function mvp_search_member(
  p_staff_id uuid,
  p_phone text
)
returns table (
  member_id uuid,
  member_code text,
  name text,
  phone text,
  status text,
  balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff staff_profiles%rowtype;
begin
  select * into v_staff from staff_profiles where id=p_staff_id and status='active';
  if not found then
    raise exception 'Invalid staff';
  end if;

  return query
  select m.id, m.member_code, m.name, m.phone, m.status, w.balance
  from members m
  join wallets w on w.member_id=m.id
  where m.outlet_id=v_staff.outlet_id
    and m.phone=p_phone
  limit 1;
end;
$$;

grant execute on function mvp_search_member(uuid, text) to anon, authenticated;

-- Top up member balance.
create or replace function mvp_topup_member(
  p_staff_id uuid,
  p_member_id uuid,
  p_cash_paid bigint,
  p_credit_issued bigint,
  p_payment_method text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff staff_profiles%rowtype;
  v_new_balance bigint;
begin
  select * into v_staff from staff_profiles where id=p_staff_id and status='active';
  if not found then
    raise exception 'Invalid staff';
  end if;

  if p_credit_issued <= 0 then
    raise exception 'Invalid top up amount';
  end if;

  update wallets
  set balance = balance + p_credit_issued, updated_at = now()
  where member_id=p_member_id
  returning balance into v_new_balance;

  insert into transactions(outlet_id, member_id, cashier_id, type, cash_paid, credit_issued, status, metadata)
  values(v_staff.outlet_id, p_member_id, p_staff_id, 'topup', p_cash_paid, p_credit_issued, 'approved', jsonb_build_object('payment_method', p_payment_method));

  return v_new_balance;
end;
$$;

grant execute on function mvp_topup_member(uuid, uuid, bigint, bigint, text) to anon, authenticated;

-- Create approval request from kasir.
create or replace function mvp_create_approval_request(
  p_staff_id uuid,
  p_member_id uuid,
  p_balance_used bigint,
  p_token text
)
returns table (
  approval_id uuid,
  token text,
  balance_before bigint,
  balance_after bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff staff_profiles%rowtype;
  v_balance bigint;
  v_approval_id uuid;
begin
  select * into v_staff from staff_profiles where id=p_staff_id and status='active';
  if not found then
    raise exception 'Invalid staff';
  end if;

  if p_balance_used <= 0 then
    raise exception 'Invalid request amount';
  end if;

  select balance into v_balance from wallets where member_id=p_member_id;
  if v_balance is null then
    raise exception 'Wallet not found';
  end if;

  if p_balance_used > v_balance then
    raise exception 'Saldo tidak cukup';
  end if;

  insert into pending_approvals(
    token, outlet_id, member_id, cashier_id,
    balance_used, balance_before, balance_after, status
  )
  values(
    p_token, v_staff.outlet_id, p_member_id, p_staff_id,
    p_balance_used, v_balance, v_balance - p_balance_used, 'waiting'
  )
  returning id into v_approval_id;

  return query select v_approval_id, p_token, v_balance, v_balance - p_balance_used;
end;
$$;

grant execute on function mvp_create_approval_request(uuid, uuid, bigint, text) to anon, authenticated;

-- Get approval detail by token for customer page.
create or replace function mvp_get_approval(
  p_token text
)
returns table (
  approval_id uuid,
  token text,
  member_id uuid,
  member_name text,
  member_phone text,
  balance_used bigint,
  balance_before bigint,
  balance_after bigint,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.token, p.member_id, m.name, m.phone,
         p.balance_used, p.balance_before, p.balance_after,
         p.status, p.created_at
  from pending_approvals p
  join members m on m.id=p.member_id
  where p.token=p_token
  limit 1;
$$;

grant execute on function mvp_get_approval(text) to anon, authenticated;

-- Customer approve and deduct balance atomically.
create or replace function mvp_approve_balance_use(
  p_token text,
  p_password text
)
returns table (
  transaction_id uuid,
  balance_after bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending pending_approvals%rowtype;
  v_member members%rowtype;
  v_balance bigint;
  v_tx_id uuid;
  v_balance_after bigint;
begin
  select * into v_pending
  from pending_approvals
  where token=p_token
  for update;

  if not found then
    raise exception 'Approval not found';
  end if;

  if v_pending.status <> 'waiting' then
    raise exception 'Approval already processed';
  end if;

  select * into v_member
  from members
  where id=v_pending.member_id;

  if v_member.password_hash <> p_password then
    raise exception 'PIN/password salah';
  end if;

  select balance into v_balance
  from wallets
  where member_id = v_pending.member_id
  for update;

  if v_balance is null or v_balance < v_pending.balance_used then
    raise exception 'Saldo tidak cukup';
  end if;

  v_balance_after := v_balance - v_pending.balance_used;

  update wallets
  set balance = v_balance_after, updated_at = now()
  where member_id = v_pending.member_id;

  update pending_approvals
  set status='approved', approved_at=now(), balance_before=v_balance, balance_after=v_balance_after
  where id = v_pending.id;

  insert into transactions(
    outlet_id, member_id, cashier_id, type,
    balance_used, approval_method, status
  )
  values(
    v_pending.outlet_id, v_pending.member_id, v_pending.cashier_id,
    'use_balance', v_pending.balance_used, 'customer_phone', 'approved'
  )
  returning id into v_tx_id;

  return query select v_tx_id, v_balance_after;
end;
$$;

grant execute on function mvp_approve_balance_use(text, text) to anon, authenticated;

-- Reject approval request.
create or replace function mvp_reject_approval(
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update pending_approvals
  set status='rejected'
  where token=p_token and status='waiting';

  return true;
end;
$$;

grant execute on function mvp_reject_approval(text) to anon, authenticated;

-- Owner report / recent transactions.
create or replace function mvp_recent_transactions(
  p_staff_id uuid
)
returns table (
  transaction_id uuid,
  type text,
  member_name text,
  member_phone text,
  balance_used bigint,
  cash_paid bigint,
  credit_issued bigint,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff staff_profiles%rowtype;
begin
  select * into v_staff from staff_profiles where id=p_staff_id and status='active';
  if not found then
    raise exception 'Invalid staff';
  end if;

  return query
  select t.id, t.type, m.name, m.phone, t.balance_used, t.cash_paid, t.credit_issued, t.status, t.created_at
  from transactions t
  left join members m on m.id=t.member_id
  where t.outlet_id=v_staff.outlet_id
  order by t.created_at desc
  limit 100;
end;
$$;

grant execute on function mvp_recent_transactions(uuid) to anon, authenticated;

-- NOTE:
-- This MVP grants RPC execution to anon because customer pages need public access.
-- The functions validate token/staff/password internally.
-- Before paid production, replace MVP password flow with Supabase Auth + stricter RLS policies.
