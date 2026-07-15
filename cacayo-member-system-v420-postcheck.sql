-- CACAYO Member System v4.2.0 POST-CHECK

select
  'Unified request table' as check_name,
  case when to_regclass(
    'public.unified_transaction_requests'
  ) is not null
  then 'OK'
  else 'MISSING'
  end as result
union all
select
  'Reserved item status supported',
  case when exists(
    select 1
    from pg_constraint c
    join pg_class t
      on t.oid=c.conrelid
    join pg_namespace n
      on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='member_gift_items'
      and c.conname='member_gift_items_status_check'
      and pg_get_constraintdef(c.oid)
        ilike '%reserved%'
  )
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Create unified transaction',
  case when to_regprocedure(
    'public.s42_create_unified_transaction(text,uuid,text,bigint,uuid[])'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'Get unified transaction',
  case when to_regprocedure(
    'public.mvp_get_unified_transaction(text)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'Reject releases item',
  case when position(
    'ctd_release_unified_request'
    in pg_get_functiondef(
      to_regprocedure(
        'public.mvp_reject_unified_transaction(text)'
      )
    )
  )>0
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Atomic approval locks request',
  case when position(
    'for update'
    in lower(
      pg_get_functiondef(
        to_regprocedure(
          'public.mvp_approve_unified_transaction(text,text)'
        )
      )
    )
  )>0
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Atomic approval writes balance and items',
  case when position(
    'update public.wallets'
    in lower(
      pg_get_functiondef(
        to_regprocedure(
          'public.mvp_approve_unified_transaction(text,text)'
        )
      )
    )
  )>0
  and position(
    'update public.member_gift_items'
    in lower(
      pg_get_functiondef(
        to_regprocedure(
          'public.mvp_approve_unified_transaction(text,text)'
        )
      )
    )
  )>0
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Legacy balance approval removed',
  case when to_regprocedure(
    'public.mvp_approve_balance_use(text,text)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Legacy item approval removed',
  case when to_regprocedure(
    'public.mvp_approve_item_redemption(text,text)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end;

select
  r.reference_code,
  r.invoice_number,
  m.name as member_name,
  r.balance_used,
  r.selected_item_count,
  r.status,
  r.created_at,
  r.approved_at
from public.unified_transaction_requests r
join public.members m
  on m.id=r.member_id
order by r.created_at desc
limit 20;

select
  count(*) filter(
    where mg.status='reserved'
  ) as reserved_items,
  count(*) filter(
    where mg.status='available'
  ) as available_items,
  count(*) filter(
    where mg.status='redeemed'
  ) as redeemed_items
from public.member_gift_items mg;
