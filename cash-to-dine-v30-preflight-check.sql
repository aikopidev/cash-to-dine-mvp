-- CTD v3.0 PRE-FLIGHT CHECK
-- Run this BEFORE cash-to-dine-v30-security-foundation.sql.
-- All required function checks should show OK.

select 'members table' as check_name,
       case when to_regclass('public.members') is not null then 'OK' else 'MISSING' end as result
union all
select 'staff_profiles table', case when to_regclass('public.staff_profiles') is not null then 'OK' else 'MISSING' end
union all
select 'pending_approvals table', case when to_regclass('public.pending_approvals') is not null then 'OK' else 'MISSING' end
union all
select 'member_pin_reset_requests table', case when to_regclass('public.member_pin_reset_requests') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_search_member(uuid,text)', case when to_regprocedure('public.mvp_search_member(uuid,text)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_search_members(uuid,text)', case when to_regprocedure('public.mvp_search_members(uuid,text)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_staff_member_history(uuid,uuid)', case when to_regprocedure('public.mvp_staff_member_history(uuid,uuid)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_topup_member latest', case when to_regprocedure('public.mvp_topup_member(uuid,uuid,bigint,bigint,text,text,integer)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_owner_dashboard_summary(uuid)', case when to_regprocedure('public.mvp_owner_dashboard_summary(uuid)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_list_gift_codes_paged', case when to_regprocedure('public.mvp_list_gift_codes_paged(uuid,text,integer,integer)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_generate_gift_codes_batch', case when to_regprocedure('public.mvp_generate_gift_codes_batch(uuid,text,bigint,date,integer)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_list_members(uuid)', case when to_regprocedure('public.mvp_list_members(uuid)') is not null then 'OK' else 'MISSING' end
union all
select 'mvp_recent_transactions(uuid)', case when to_regprocedure('public.mvp_recent_transactions(uuid)') is not null then 'OK' else 'MISSING' end;

-- Must return zero rows before creating the unique top-up invoice index.
select outlet_id, metadata->>'invoice_number' as duplicate_invoice, count(*) as duplicate_count
from public.transactions
where type='topup'
  and status='approved'
  and coalesce(metadata->>'invoice_number','')<>''
group by outlet_id, metadata->>'invoice_number'
having count(*) > 1;
