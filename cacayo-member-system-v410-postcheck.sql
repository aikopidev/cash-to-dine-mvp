-- CACAYO Member System v4.1.0 POST-CHECK

select
  'wallet expiry 23:59:59 Jakarta' as check_name,
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
  'Gift Item Master',
  case when to_regclass('public.gift_item_master') is not null
  then 'OK' else 'MISSING' end
union all
select
  'Member Gift Items',
  case when to_regclass('public.member_gift_items') is not null
  then 'OK' else 'MISSING' end
union all
select
  'Redemption Requests',
  case when to_regclass('public.gift_item_redemption_requests') is not null
  then 'OK' else 'MISSING' end
union all
select
  'Code type supports item',
  case when exists(
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='gift_codes'
      and c.conname='gift_codes_code_type_check'
      and pg_get_constraintdef(c.oid) ilike '%item%'
  ) then 'OK' else 'CHECK FAILED' end
union all
select
  'Unified reward preview',
  case when to_regprocedure(
    'public.mvp_customer_preview_reward(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'Unified reward claim',
  case when to_regprocedure(
    'public.mvp_customer_claim_reward(text,text)'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'Item redemption PIN approval',
  case when to_regprocedure(
    'public.mvp_approve_item_redemption(text,text)'
  ) is not null then 'OK' else 'MISSING' end;

select
  i.name,
  i.is_active,
  count(g.id) filter(where g.status='available') as available_codes,
  count(mg.id) filter(where mg.status='available') as customer_available,
  count(mg.id) filter(where mg.status='redeemed') as redeemed
from public.gift_item_master i
left join public.gift_codes g on g.gift_item_id=i.id
left join public.member_gift_items mg on mg.gift_item_id=i.id
group by i.id,i.name,i.is_active
order by i.updated_at desc;


select
  'Customer history includes item' as check_name,
  case when position(
    'gift_item_redeem'
    in pg_get_functiondef(
      to_regprocedure('public.mvp_customer_history(text)')
    )
  )>0 then 'OK' else 'CHECK FAILED' end as result
union all
select
  'Staff history includes item',
  case when position(
    'gift_item_claim'
    in pg_get_functiondef(
      to_regprocedure('public.s3_staff_member_history(text,uuid)')
    )
  )>0 then 'OK' else 'CHECK FAILED' end;


select
  'Jakarta end-of-day helper' as check_name,
  case when to_regprocedure(
    'public.ctd_jakarta_end_of_day(date)'
  ) is not null then 'OK' else 'MISSING' end as result
union all
select
  'Jakarta current-date helper',
  case when to_regprocedure(
    'public.ctd_jakarta_today()'
  ) is not null then 'OK' else 'MISSING' end
union all
select
  'Top up uses 23:59 helper',
  case when position(
    'ctd_jakarta_end_of_day'
    in pg_get_functiondef(
      to_regprocedure(
        'public.s3_topup_member(text,uuid,bigint,bigint,text,text,integer)'
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end
union all
select
  'Voucher registration uses Jakarta date',
  case when position(
    'ctd_jakarta_today'
    in pg_get_functiondef(
      to_regprocedure(
        'public.mvp_claim_gift_code(text,text,text,text,text,text)'
      )
    )
  )>0 then 'OK' else 'CHECK FAILED' end;
