-- Cash to Dine v3.2.1 POST-CHECK
-- Run after cash-to-dine-v321-generic-gift.sql

select
  'code_type installed' as check_name,
  case when exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='gift_codes'
      and column_name='code_type'
  ) then 'OK' else 'MISSING' end as result
union all
select
  'only voucher/gift types',
  case when not exists(
    select 1
    from public.gift_codes
    where code_type not in('voucher','gift')
       or code_type is null
  ) then 'OK' else 'CHECK FAILED' end
union all
select
  'target-member column removed',
  case when not exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='gift_codes'
      and column_name='target_member_id'
  ) then 'OK' else 'CHECK FAILED' end
union all
select
  'old target generator removed',
  case when to_regprocedure(
    'public.s3_generate_member_gift(text,uuid,text,bigint,date)'
  ) is null then 'OK' else 'CHECK FAILED' end
union all
select
  'generic generator installed',
  case when to_regprocedure(
    'public.s3_generate_campaign_codes(text,text,text,bigint,date,integer)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'Gift preview installed',
  case when to_regprocedure(
    'public.mvp_customer_preview_gift(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'Gift claim installed',
  case when to_regprocedure(
    'public.mvp_customer_claim_gift(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'registration rejects Gift',
  case when position(
    'Kode ini adalah GIFT untuk existing member'
    in pg_get_functiondef(
      to_regprocedure(
        'public.mvp_claim_gift_code(text,text,text,text,text,text)'
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end
union all
select
  'Gift requires pre-existing member',
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
  'Gift first-claim atomic',
  case when position(
    'for update'
    in lower(
      pg_get_functiondef(
        to_regprocedure(
          'public.mvp_customer_claim_gift(text,text)'
        )
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end;

select
  g.code,
  upper(g.code_type) as code_type,
  g.campaign_name,
  g.value,
  g.status,
  g.expired_at,
  g.copied_at,
  g.copied_method,
  m.name as registered_or_claimed_by,
  m.phone
from public.gift_codes g
left join public.members m
  on m.id=g.used_by_member_id
order by g.created_at desc
limit 30;
