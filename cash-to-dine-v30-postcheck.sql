-- CTD v3.0 POST-MIGRATION CHECK
-- Run after cash-to-dine-v30-security-foundation.sql.

select 'staff passwords bcrypt' as check_name,
       case when count(*) filter (where password_hash !~ '^\$2[aby]\$') = 0 then 'OK' else 'CHECK FAILED' end as result
from public.staff_profiles
union all
select 'member PINs bcrypt',
       case when count(*) filter (where password_hash !~ '^\$2[aby]\$') = 0 then 'OK' else 'CHECK FAILED' end
from public.members
union all
select 'secure staff login function', case when to_regprocedure('public.s3_staff_login(text,text)') is not null then 'OK' else 'MISSING' end
union all
select 'secure topup function', case when to_regprocedure('public.s3_topup_member(text,uuid,bigint,bigint,text,text,integer)') is not null then 'OK' else 'MISSING' end
union all
select 'secure approval function', case when to_regprocedure('public.s3_create_approval_request(text,uuid,bigint)') is not null then 'OK' else 'MISSING' end
union all
select 'security audit table', case when to_regclass('public.security_audit_log') is not null then 'OK' else 'MISSING' end
union all
select 'staff sessions table', case when to_regclass('public.staff_sessions') is not null then 'OK' else 'MISSING' end
union all
select 'customer secure sessions', case when to_regclass('public.customer_sessions_secure') is not null then 'OK' else 'MISSING' end;
