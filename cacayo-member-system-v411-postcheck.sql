-- CACAYO Member System v4.1.1 POST-CHECK

select
  'Reward list RPC installed' as check_name,
  case when to_regprocedure(
    'public.s4_list_reward_codes_paged(text,text,text,integer,integer)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end as result
union all
select
  'Reward copy RPC installed',
  case when to_regprocedure(
    'public.s4_copy_reward_code(text,uuid,text)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'Old list RPC removed',
  case when to_regprocedure(
    'public.s3_list_gift_codes_paged(text,text,integer,integer)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Old copy RPC removed',
  case when to_regprocedure(
    'public.s3_copy_gift_code(text,uuid,text)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'No image payload in list RPC',
  case when position(
    'image_data_url'
    in lower(
      pg_get_functiondef(
        to_regprocedure(
          'public.s4_list_reward_codes_paged(text,text,text,integer,integer)'
        )
      )
    )
  )=0
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'Type filter exists',
  case when position(
    'g.code_type=v_type'
    in replace(
      lower(
        pg_get_functiondef(
          to_regprocedure(
            'public.s4_list_reward_codes_paged(text,text,text,integer,integer)'
          )
        )
      ),
      ' ',
      ''
    )
  )>0
  then 'OK'
  else 'CHECK FAILED'
  end;

select
  upper(coalesce(g.code_type,'voucher')) as reward_type,
  g.status,
  count(*) as code_count
from public.gift_codes g
group by
  upper(coalesce(g.code_type,'voucher')),
  g.status
order by
  reward_type,
  g.status;
