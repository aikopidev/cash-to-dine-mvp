-- Cash to Dine v3.0 Security Foundation
-- RUN IN SUPABASE SQL EDITOR AFTER v2.4.3.
-- This migration:
-- 1) hashes staff passwords and customer PINs with bcrypt,
-- 2) creates server-validated staff sessions,
-- 3) revokes direct anonymous access to legacy staff RPCs,
-- 4) adds secure staff RPC wrappers,
-- 5) generates approval/reset tokens server-side and stores only hashes,
-- 6) adds expiry, audit logs, invoice idempotency, and secure customer sessions.

create schema if not exists extensions;
create extension if not exists pgcrypto;
set search_path = public, extensions;

-- -------------------------------------------------------------------
-- Helpers
-- -------------------------------------------------------------------
create or replace function public.ctd_token_hash(p_token text)
returns text language sql immutable security definer
set search_path=public,extensions
as $$ select encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex') $$;

create or replace function public.ctd_new_token()
returns text language sql volatile security definer
set search_path=public
as $$ select replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') $$;

-- -------------------------------------------------------------------
-- Credential hashing migration
-- -------------------------------------------------------------------
update public.staff_profiles
set password_hash = crypt(password_hash, gen_salt('bf', 12))
where password_hash is not null and password_hash !~ '^\\$2[aby]\\$';

update public.members
set password_hash = crypt(password_hash, gen_salt('bf', 12))
where password_hash is not null and password_hash !~ '^\\$2[aby]\\$';

-- -------------------------------------------------------------------
-- Secure sessions + audit
-- -------------------------------------------------------------------
create table if not exists public.staff_sessions (
  token_hash text primary key,
  staff_id uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '8 hours'),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.staff_sessions enable row level security;

drop policy if exists staff_sessions_no_direct_access on public.staff_sessions;
create policy staff_sessions_no_direct_access on public.staff_sessions for all using(false) with check(false);

create table if not exists public.security_audit_log (
  id bigint generated always as identity primary key,
  staff_id uuid references public.staff_profiles(id),
  outlet_id uuid references public.outlets(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.security_audit_log enable row level security;
drop policy if exists security_audit_no_direct_access on public.security_audit_log;
create policy security_audit_no_direct_access on public.security_audit_log for all using(false) with check(false);

create table if not exists public.customer_sessions_secure (
  token_hash text primary key,
  member_id uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  revoked_at timestamptz
);
alter table public.customer_sessions_secure enable row level security;
drop policy if exists customer_sessions_secure_no_direct_access on public.customer_sessions_secure;
create policy customer_sessions_secure_no_direct_access on public.customer_sessions_secure for all using(false) with check(false);

create or replace function public.ctd_require_staff(p_token text, p_roles text[] default null)
returns table(staff_id uuid,outlet_id uuid,role text,name text)
language plpgsql security definer set search_path=public
as $$
begin
  return query
  select sp.id,sp.outlet_id,sp.role::text,sp.name::text
  from public.staff_sessions ss
  join public.staff_profiles sp on sp.id=ss.staff_id
  where ss.token_hash=public.ctd_token_hash(p_token)
    and ss.revoked_at is null and ss.expires_at>now()
    and sp.status='active'
    and (p_roles is null or sp.role=any(p_roles))
  limit 1;
  if not found then raise exception 'Staff session invalid / expired'; end if;
  update public.staff_sessions set last_seen_at=now() where token_hash=public.ctd_token_hash(p_token);
end $$;

-- -------------------------------------------------------------------
-- Secure staff login/session
-- -------------------------------------------------------------------
drop function if exists public.s3_staff_login(text,text);
create function public.s3_staff_login(p_username text,p_password text)
returns table(login_success boolean,error_message text,session_token text,id uuid,outlet_id uuid,name text,username text,role text,status text,expires_at timestamptz)
language plpgsql security definer set search_path=public,extensions
as $$
declare v_staff public.staff_profiles%rowtype; v_token text; v_exp timestamptz;
begin
  select * into v_staff from public.staff_profiles sp
  where lower(sp.username)=lower(trim(p_username)) and sp.status='active' limit 1;
  if not found or v_staff.password_hash <> crypt(p_password,v_staff.password_hash) then
    insert into public.security_audit_log(action,entity_type,metadata) values('staff_login_failed','staff',jsonb_build_object('username',left(trim(p_username),100)));
    return query select false,'Username / password salah'::text,null::text,null::uuid,null::uuid,null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  v_token:=public.ctd_new_token(); v_exp:=now()+interval '8 hours';
  insert into public.staff_sessions(token_hash,staff_id,expires_at) values(public.ctd_token_hash(v_token),v_staff.id,v_exp);
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id) values(v_staff.id,v_staff.outlet_id,'staff_login','staff',v_staff.id);
  return query select true,null::text,v_token,v_staff.id,v_staff.outlet_id,v_staff.name::text,v_staff.username::text,v_staff.role::text,v_staff.status::text,v_exp;
end $$;

drop function if exists public.s3_staff_logout(text);
create function public.s3_staff_logout(p_staff_session_token text) returns boolean
language plpgsql security definer set search_path=public as $$
declare v record;
begin
  select * into v from public.ctd_require_staff(p_staff_session_token,null);
  update public.staff_sessions set revoked_at=now() where token_hash=public.ctd_token_hash(p_staff_session_token);
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id) values(v.staff_id,v.outlet_id,'staff_logout','staff',v.staff_id);
  return true;
end $$;

-- -------------------------------------------------------------------
-- Secure staff wrappers. Legacy staff RPCs remain callable only by DB owner.
-- -------------------------------------------------------------------
create or replace function public.s3_search_member(p_staff_session_token text,p_phone text)
returns table(member_id uuid,member_code text,name text,phone text,status text,balance bigint)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']); return query select * from public.mvp_search_member(v.staff_id,p_phone); end $$;

create or replace function public.s3_search_members(p_staff_session_token text,p_query text)
returns table(member_id uuid,member_code text,name text,phone text,status text,balance bigint)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']); return query select * from public.mvp_search_members(v.staff_id,p_query); end $$;

create or replace function public.s3_staff_member_history(p_staff_session_token text,p_member_id uuid)
returns table(transaction_id uuid,created_at timestamptz,outlet_name text,type text,topup_amount bigint,balance_used bigint,balance_after bigint,transaction_status text)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']); return query select * from public.mvp_staff_member_history(v.staff_id,p_member_id); end $$;

create unique index if not exists idx_ctd_topup_invoice_unique
on public.transactions(outlet_id,(metadata->>'invoice_number'))
where type='topup' and status='approved' and coalesce(metadata->>'invoice_number','')<>'';

create or replace function public.s3_topup_member(p_staff_session_token text,p_member_id uuid,p_cash_paid bigint,p_credit_issued bigint,p_invoice_number text,p_package_name text default 'NICKEL',p_valid_months int default 2)
returns bigint language plpgsql security definer set search_path=public as $$
declare v record; v_balance bigint;
begin
  select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']);
  begin
    v_balance:=public.mvp_topup_member(v.staff_id,p_member_id,p_cash_paid,p_credit_issued,p_invoice_number,p_package_name,p_valid_months);
  exception when unique_violation then raise exception 'Invoice POS sudah pernah dipakai untuk top up'; end;
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id,metadata) values(v.staff_id,v.outlet_id,'member_topup','member',p_member_id,jsonb_build_object('cash_paid',p_cash_paid,'credit_issued',p_credit_issued,'invoice_number',p_invoice_number,'package',p_package_name));
  return v_balance;
end $$;

alter table public.pending_approvals add column if not exists expires_at timestamptz;
update public.pending_approvals set expires_at=coalesce(expires_at,created_at+interval '5 minutes');
-- Migrate existing plaintext approval tokens to hashes; old links continue to work.
update public.pending_approvals set token=public.ctd_token_hash(token) where token !~ '^[0-9a-f]{64}$';

create or replace function public.s3_create_approval_request(p_staff_session_token text,p_member_id uuid,p_balance_used bigint)
returns table(approval_id uuid,token text,balance_before bigint,balance_after bigint,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v record; v_balance bigint; v_id uuid; v_token text; v_exp timestamptz;
begin
  select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']);
  if p_balance_used<=0 then raise exception 'Nominal harus lebih dari Rp0'; end if;
  select w.balance into v_balance from public.wallets w join public.members m on m.id=w.member_id where w.member_id=p_member_id and m.outlet_id=v.outlet_id and m.status='active' for update;
  if v_balance is null then raise exception 'Member/wallet tidak ditemukan atau akun diblokir'; end if;
  if p_balance_used>v_balance then raise exception 'Saldo tidak cukup'; end if;
  v_token:=public.ctd_new_token(); v_exp:=now()+interval '5 minutes';
  insert into public.pending_approvals(token,outlet_id,member_id,cashier_id,balance_used,balance_before,balance_after,status,expires_at)
  values(public.ctd_token_hash(v_token),v.outlet_id,p_member_id,v.staff_id,p_balance_used,v_balance,v_balance-p_balance_used,'waiting',v_exp) returning id into v_id;
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id,metadata) values(v.staff_id,v.outlet_id,'approval_requested','member',p_member_id,jsonb_build_object('approval_id',v_id,'balance_used',p_balance_used));
  return query select v_id,v_token,v_balance,v_balance-p_balance_used,v_exp;
end $$;

create or replace function public.s3_create_pin_reset_request(p_staff_session_token text,p_member_id uuid)
returns table(token text,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v record; v_token text; v_exp timestamptz;
begin
  select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']);
  if not exists(select 1 from public.members m where m.id=p_member_id and m.outlet_id=v.outlet_id and m.status<>'deleted') then raise exception 'Member not found'; end if;
  update public.member_pin_reset_requests r set status='expired' where r.member_id=p_member_id and r.status='waiting';
  v_token:=public.ctd_new_token(); v_exp:=now()+interval '30 minutes';
  insert into public.member_pin_reset_requests(outlet_id,member_id,token,status,created_by_staff_id,expires_at)
  values(v.outlet_id,p_member_id,public.ctd_token_hash(v_token),'waiting',v.staff_id,v_exp);
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id) values(v.staff_id,v.outlet_id,'pin_reset_requested','member',p_member_id);
  return query select v_token,v_exp;
end $$;

create or replace function public.s3_archive_member(p_staff_session_token text,p_member_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v record; v_balance bigint;
begin
  select * into v from public.ctd_require_staff(p_staff_session_token,array['owner']);
  perform 1 from public.members m where m.id=p_member_id and m.outlet_id=v.outlet_id and m.status<>'deleted' for update;
  if not found then raise exception 'Member not found / already archived'; end if;
  select coalesce(w.balance,0) into v_balance from public.wallets w where w.member_id=p_member_id;
  v_balance:=coalesce(v_balance,0);
  if v_balance<>0 then raise exception 'Member hanya bisa di-archive jika saldo Rp0'; end if;
  update public.members set status='deleted' where id=p_member_id;
  update public.member_pin_reset_requests set status='expired' where member_id=p_member_id and status='waiting';
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id,metadata) values(v.staff_id,v.outlet_id,'member_archived','member',p_member_id,jsonb_build_object('balance',v_balance));
  return true;
end $$;

create or replace function public.s3_owner_dashboard_summary(p_staff_session_token text)
returns table(total_members bigint,total_wallet_balance bigint,total_vouchers bigint,available_vouchers bigint,registered_vouchers bigint,claimed_vouchers bigint,expired_vouchers bigint,void_vouchers bigint,available_value bigint,total_transactions bigint,total_balance_used bigint)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner']); return query select * from public.mvp_owner_dashboard_summary(v.staff_id); end $$;

create or replace function public.s3_list_gift_codes_paged(p_staff_session_token text,p_status text default 'available',p_limit int default 10,p_offset int default 0)
returns table(gift_id uuid,code text,value bigint,voucher_status text,campaign_name text,expired_at date,used_at timestamptz,used_by_phone text,used_by_name text,created_at timestamptz,total_count bigint)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner']); return query select * from public.mvp_list_gift_codes_paged(v.staff_id,p_status,p_limit,p_offset); end $$;

create or replace function public.s3_delete_gift_code(p_staff_session_token text,p_gift_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner']); perform public.mvp_delete_gift_code(v.staff_id,p_gift_id); insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id) values(v.staff_id,v.outlet_id,'voucher_voided','voucher',p_gift_id); return true; end $$;

create or replace function public.s3_generate_gift_codes_batch(p_staff_session_token text,p_campaign_name text,p_value bigint,p_expired_at date,p_qty int)
returns table(gift_id uuid,code text,value bigint,campaign_name text,expired_at date)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner']); insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,metadata) values(v.staff_id,v.outlet_id,'voucher_batch_generated','voucher',jsonb_build_object('campaign',p_campaign_name,'value',p_value,'qty',p_qty)); return query select * from public.mvp_generate_gift_codes_batch(v.staff_id,p_campaign_name,p_value,p_expired_at,p_qty); end $$;

create or replace function public.s3_list_members(p_staff_session_token text)
returns table(member_id uuid,member_code text,name text,phone text,status text,balance bigint,created_at timestamptz)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner']); return query select * from public.mvp_list_members(v.staff_id); end $$;

create or replace function public.s3_recent_transactions(p_staff_session_token text)
returns table(transaction_id uuid,type text,member_name text,member_phone text,balance_used bigint,cash_paid bigint,credit_issued bigint,status text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$ declare v record; begin select * into v from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']); return query select * from public.mvp_recent_transactions(v.staff_id); end $$;

-- -------------------------------------------------------------------
-- Public approval functions now compare HASHED tokens and enforce expiry.
-- -------------------------------------------------------------------
create or replace function public.mvp_get_approval(p_token text)
returns table(approval_id uuid,token text,member_id uuid,member_name text,member_phone text,balance_used bigint,balance_before bigint,balance_after bigint,status text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  update public.pending_approvals p set status='expired' where p.token=public.ctd_token_hash(p_token) and p.status='waiting' and p.expires_at<now();
  return query select p.id,p_token,p.member_id,m.name::text,m.phone::text,p.balance_used,p.balance_before,p.balance_after,p.status::text,p.created_at
  from public.pending_approvals p join public.members m on m.id=p.member_id where p.token=public.ctd_token_hash(p_token) limit 1;
end $$;

create or replace function public.mvp_reject_approval(p_token text) returns boolean
language plpgsql security definer set search_path=public as $$ begin update public.pending_approvals p set status='rejected' where p.token=public.ctd_token_hash(p_token) and p.status='waiting' and p.expires_at>now(); return found; end $$;

-- bcrypt-aware approval + persistent counter
create or replace function public.mvp_approve_balance_use(p_token text,p_password text)
returns table(approval_success boolean,error_message text,remaining_attempts int,transaction_id uuid,balance_after bigint)
language plpgsql security definer set search_path=public,extensions as $$
declare v_pending public.pending_approvals%rowtype; v_member public.members%rowtype; v_balance bigint; v_tx uuid; v_after bigint; v_attempts int; v_msg text:='Anda telah salah memasukkan PIN sebanyak 10 kali. Akun dan penggunaan saldo Anda sementara diblokir untuk keamanan. Silakan datang ke cabang Cacayo terdekat untuk melakukan reset PIN melalui kasir. Saldo Anda tetap aman.';
begin
  if p_password !~ '^[0-9]{6}$' then return query select false,'PIN wajib 6 digit angka',null::int,null::uuid,null::bigint; return; end if;
  select * into v_pending from public.pending_approvals p where p.token=public.ctd_token_hash(p_token) for update;
  if not found then raise exception 'Approval not found'; end if;
  if v_pending.status<>'waiting' then raise exception 'Approval already processed / expired'; end if;
  if v_pending.expires_at<now() then update public.pending_approvals set status='expired' where id=v_pending.id; raise exception 'Approval expired'; end if;
  select * into v_member from public.members m where m.id=v_pending.member_id for update;
  if not found or v_member.status='deleted' then raise exception 'Member not found'; end if;
  if v_member.status='blocked' then return query select false,v_msg,0,null::uuid,null::bigint; return; end if;
  if v_member.password_hash <> crypt(p_password,v_member.password_hash) then
    update public.members m set failed_pin_attempts=least(coalesce(m.failed_pin_attempts,0)+1,10),status=case when least(coalesce(m.failed_pin_attempts,0)+1,10)>=10 then 'blocked' else m.status end,blocked_at=case when least(coalesce(m.failed_pin_attempts,0)+1,10)>=10 then now() else m.blocked_at end where m.id=v_member.id returning m.failed_pin_attempts into v_attempts;
    if v_attempts>=10 then return query select false,v_msg,0,null::uuid,null::bigint; else return query select false,format('PIN salah. Sisa percobaan %s kali.',10-v_attempts),(10-v_attempts),null::uuid,null::bigint; end if; return;
  end if;
  select balance into v_balance from public.wallets where member_id=v_pending.member_id for update;
  if v_balance is null or v_balance<v_pending.balance_used then raise exception 'Saldo tidak cukup'; end if;
  v_after:=v_balance-v_pending.balance_used;
  update public.wallets set balance=v_after,updated_at=now() where member_id=v_pending.member_id;
  update public.members set failed_pin_attempts=0,blocked_at=null where id=v_pending.member_id;
  update public.pending_approvals set status='approved',approved_at=now(),balance_before=v_balance,balance_after=v_after where id=v_pending.id;
  insert into public.transactions(outlet_id,member_id,cashier_id,type,balance_used,approval_method,status,metadata) values(v_pending.outlet_id,v_pending.member_id,v_pending.cashier_id,'use_balance',v_pending.balance_used,'customer_phone','approved',jsonb_build_object('balance_after',v_after)) returning id into v_tx;
  return query select true,null::text,null::int,v_tx,v_after;
end $$;

-- -------------------------------------------------------------------
-- Reset PIN tokens hashed, PIN stored bcrypt.
-- -------------------------------------------------------------------
update public.member_pin_reset_requests set token=public.ctd_token_hash(token) where token !~ '^[0-9a-f]{64}$';

create or replace function public.mvp_get_pin_reset_request(p_token text)
returns table(member_id uuid,member_code text,member_name text,member_phone text,balance bigint,status text,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  update public.member_pin_reset_requests r set status='expired' where r.token=public.ctd_token_hash(p_token) and r.status='waiting' and r.expires_at<now();
  return query select m.id,m.member_code::text,m.name::text,m.phone::text,coalesce(w.balance,0)::bigint,r.status::text,r.expires_at from public.member_pin_reset_requests r join public.members m on m.id=r.member_id left join public.wallets w on w.member_id=m.id where r.token=public.ctd_token_hash(p_token) and m.status<>'deleted' limit 1;
end $$;

create or replace function public.mvp_complete_pin_reset(p_token text,p_new_pin text) returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare v_req public.member_pin_reset_requests%rowtype;
begin
  if p_new_pin !~ '^[0-9]{6}$' then raise exception 'PIN baru wajib 6 digit angka'; end if;
  select * into v_req from public.member_pin_reset_requests r where r.token=public.ctd_token_hash(p_token) for update;
  if not found then raise exception 'Reset PIN request tidak ditemukan'; end if;
  if v_req.status<>'waiting' or v_req.expires_at<now() then raise exception 'Reset PIN link sudah tidak aktif / expired'; end if;
  update public.members set password_hash=crypt(p_new_pin,gen_salt('bf',12)),status='active',failed_pin_attempts=0,blocked_at=null where id=v_req.member_id and status<>'deleted';
  update public.member_pin_reset_requests set status='done',used_at=now() where id=v_req.id;
  delete from public.customer_sessions_secure where member_id=v_req.member_id;
  return true;
end $$;

-- -------------------------------------------------------------------
-- Customer registration/login/session use bcrypt + hashed session token.
-- -------------------------------------------------------------------
create or replace function public.mvp_claim_gift_code(p_outlet_slug text,p_member_code text,p_name text,p_phone text,p_password text,p_gift_code text)
returns table(member_id uuid,member_code text,initial_balance bigint)
language plpgsql security definer set search_path=public,extensions as $$
declare v_outlet uuid; v_gift public.gift_codes%rowtype; v_member uuid; v_phone text; v_code text; v_balance bigint:=0;
begin
  if p_password !~ '^[0-9]{6}$' then raise exception 'PIN wajib 6 digit angka'; end if;
  v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); if left(v_phone,1)='0' then v_phone:='62'||substr(v_phone,2); end if;
  if length(v_phone)<8 then raise exception 'Nomor HP tidak valid'; end if;
  select id into v_outlet from public.outlets where slug=p_outlet_slug; if v_outlet is null then raise exception 'Outlet not found'; end if;
  if exists(select 1 from public.members m where m.outlet_id=v_outlet and m.phone=v_phone and m.status<>'deleted') then raise exception 'Nomor HP sudah terdaftar sebagai member'; end if;
  v_code:=upper(trim(coalesce(p_gift_code,'')));
  if v_code<>'' then
    select * into v_gift from public.gift_codes g where g.code=v_code and g.outlet_id=v_outlet for update;
    if not found then raise exception 'Gift Code tidak ditemukan'; end if;
    if v_gift.status<>'available' or v_gift.expired_at<current_date then raise exception 'Gift Code tidak tersedia / expired'; end if;
    v_balance:=v_gift.value;
  end if;
  insert into public.members(outlet_id,member_code,name,phone,password_hash,status,failed_pin_attempts) values(v_outlet,p_member_code,left(trim(p_name),120),v_phone,crypt(p_password,gen_salt('bf',12)),'active',0) returning id into v_member;
  insert into public.wallets(member_id,balance) values(v_member,v_balance);
  if v_code<>'' then update public.gift_codes set status='registered',used_by_member_id=v_member,used_at=now() where id=v_gift.id; insert into public.transactions(outlet_id,member_id,type,gift_code_id,credit_issued,status) values(v_outlet,v_member,'gift_claim',v_gift.id,v_balance,'approved'); end if;
  return query select v_member,p_member_code,v_balance;
end $$;

create or replace function public.mvp_customer_login(p_outlet_slug text,p_phone text,p_pin text)
returns table(login_success boolean,error_message text,remaining_attempts int,session_token text,member_id uuid,member_code text,name text,phone text,balance bigint,status text)
language plpgsql security definer set search_path=public,extensions as $$
declare v_outlet uuid; v_member public.members%rowtype; v_phone text; v_attempts int; v_token text; v_balance bigint; v_msg text:='Anda telah salah memasukkan PIN sebanyak 10 kali. Akun dan penggunaan saldo Anda sementara diblokir untuk keamanan. Silakan datang ke cabang Cacayo terdekat untuk melakukan reset PIN melalui kasir. Saldo Anda tetap aman.';
begin
  v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); if left(v_phone,1)='0' then v_phone:='62'||substr(v_phone,2); end if;
  if p_pin !~ '^[0-9]{6}$' then return query select false,'PIN wajib 6 digit angka',null::int,null::text,null::uuid,null::text,null::text,null::text,null::bigint,'pin_error'; return; end if;
  select id into v_outlet from public.outlets where slug=p_outlet_slug;
  select * into v_member from public.members m where m.outlet_id=v_outlet and m.phone=v_phone and m.status<>'deleted' for update;
  if not found then return query select false,'Nomor WhatsApp / PIN salah',null::int,null::text,null::uuid,null::text,null::text,null::text,null::bigint,'not_found'; return; end if;
  if v_member.status='blocked' then return query select false,v_msg,0,null::text,v_member.id,v_member.member_code::text,v_member.name::text,v_member.phone::text,null::bigint,'blocked'; return; end if;
  if v_member.password_hash <> crypt(p_pin,v_member.password_hash) then
    update public.members m set failed_pin_attempts=least(coalesce(m.failed_pin_attempts,0)+1,10),status=case when least(coalesce(m.failed_pin_attempts,0)+1,10)>=10 then 'blocked' else m.status end,blocked_at=case when least(coalesce(m.failed_pin_attempts,0)+1,10)>=10 then now() else m.blocked_at end where m.id=v_member.id returning m.failed_pin_attempts into v_attempts;
    if v_attempts>=10 then return query select false,v_msg,0,null::text,v_member.id,v_member.member_code::text,v_member.name::text,v_member.phone::text,null::bigint,'blocked'; else return query select false,format('PIN salah. Sisa percobaan %s kali.',10-v_attempts),(10-v_attempts),null::text,v_member.id,v_member.member_code::text,v_member.name::text,v_member.phone::text,null::bigint,'pin_error'; end if; return;
  end if;
  update public.members set failed_pin_attempts=0,blocked_at=null where id=v_member.id;
  select coalesce(balance,0) into v_balance from public.wallets where member_id=v_member.id;
  v_token:=public.ctd_new_token(); insert into public.customer_sessions_secure(token_hash,member_id) values(public.ctd_token_hash(v_token),v_member.id);
  return query select true,null::text,null::int,v_token,v_member.id,v_member.member_code::text,v_member.name::text,v_member.phone::text,coalesce(v_balance,0),'active';
end $$;

create or replace function public.mvp_customer_home(p_session_token text)
returns table(member_id uuid,member_code text,name text,phone text,balance bigint,status text)
language sql security definer set search_path=public as $$ select m.id,m.member_code::text,m.name::text,m.phone::text,coalesce(w.balance,0)::bigint,m.status::text from public.customer_sessions_secure s join public.members m on m.id=s.member_id left join public.wallets w on w.member_id=m.id where s.token_hash=public.ctd_token_hash(p_session_token) and s.revoked_at is null and s.expires_at>now() and m.status='active' limit 1 $$;

create or replace function public.mvp_customer_logout(p_session_token text) returns boolean language plpgsql security definer set search_path=public as $$ begin update public.customer_sessions_secure set revoked_at=now() where token_hash=public.ctd_token_hash(p_session_token) and revoked_at is null; return true; end $$;

create or replace function public.mvp_customer_history(p_session_token text)
returns table(transaction_id uuid,created_at timestamptz,outlet_name text,type text,topup_amount bigint,balance_used bigint,balance_after bigint,transaction_status text)
language sql security definer set search_path=public as $$
with vs as(select s.member_id from public.customer_sessions_secure s join public.members m on m.id=s.member_id where s.token_hash=public.ctd_token_hash(p_session_token) and s.revoked_at is null and s.expires_at>now() and m.status='active' limit 1), tx as(select t.id,t.created_at,o.name::text outlet_name,t.type::text type,coalesce(t.credit_issued,0)::bigint credit_issued,coalesce(t.balance_used,0)::bigint balance_used,t.status::text transaction_status,sum(coalesce(t.credit_issued,0)-coalesce(t.balance_used,0)) over(partition by t.member_id order by t.created_at,t.id)::bigint balance_after from public.transactions t join vs on vs.member_id=t.member_id join public.outlets o on o.id=t.outlet_id where t.status='approved' and t.type in('gift_claim','topup','use_balance')) select id,created_at,outlet_name,type,case when type in('gift_claim','topup') then credit_issued else 0 end,case when type='use_balance' then balance_used else 0 end,balance_after,transaction_status from tx order by created_at desc,id desc limit 100 $$;

-- -------------------------------------------------------------------
-- Lock down legacy functions; grant only public customer/token RPCs + secure staff RPCs.
-- -------------------------------------------------------------------
revoke execute on all functions in schema public from public,anon,authenticated;

grant execute on function public.mvp_claim_gift_code(text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.mvp_customer_login(text,text,text) to anon,authenticated;
grant execute on function public.mvp_customer_home(text) to anon,authenticated;
grant execute on function public.mvp_customer_history(text) to anon,authenticated;
grant execute on function public.mvp_customer_logout(text) to anon,authenticated;
grant execute on function public.mvp_get_approval(text) to anon,authenticated;
grant execute on function public.mvp_approve_balance_use(text,text) to anon,authenticated;
grant execute on function public.mvp_reject_approval(text) to anon,authenticated;
grant execute on function public.mvp_get_pin_reset_request(text) to anon,authenticated;
grant execute on function public.mvp_complete_pin_reset(text,text) to anon,authenticated;

grant execute on function public.s3_staff_login(text,text) to anon,authenticated;
grant execute on function public.s3_staff_logout(text) to anon,authenticated;
grant execute on function public.s3_search_member(text,text) to anon,authenticated;
grant execute on function public.s3_search_members(text,text) to anon,authenticated;
grant execute on function public.s3_staff_member_history(text,uuid) to anon,authenticated;
grant execute on function public.s3_topup_member(text,uuid,bigint,bigint,text,text,int) to anon,authenticated;
grant execute on function public.s3_create_approval_request(text,uuid,bigint) to anon,authenticated;
grant execute on function public.s3_create_pin_reset_request(text,uuid) to anon,authenticated;
grant execute on function public.s3_archive_member(text,uuid) to anon,authenticated;
grant execute on function public.s3_owner_dashboard_summary(text) to anon,authenticated;
grant execute on function public.s3_list_gift_codes_paged(text,text,int,int) to anon,authenticated;
grant execute on function public.s3_delete_gift_code(text,uuid) to anon,authenticated;
grant execute on function public.s3_generate_gift_codes_batch(text,text,bigint,date,int) to anon,authenticated;
grant execute on function public.s3_list_members(text) to anon,authenticated;
grant execute on function public.s3_recent_transactions(text) to anon,authenticated;

notify pgrst,'reload schema';
