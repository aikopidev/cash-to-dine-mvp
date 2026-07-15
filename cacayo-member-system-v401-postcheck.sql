-- CACAYO Member System v4.0.1 POST-CHECK

select
  'member search RPC installed' as check_name,
  case
    when to_regprocedure(
      'public.s3_search_members(text,text)'
    ) is not null
    then 'OK'
    else 'MISSING'
  end as result
union all
select
  'supports name search',
  case
    when position(
      'lower(coalesce(m.name'
      in lower(
        pg_get_functiondef(
          to_regprocedure(
            'public.s3_search_members(text,text)'
          )
        )
      )
    )>0
    then 'OK'
    else 'CHECK FAILED'
  end
union all
select
  'supports phone without 62',
  case
    when position(
      'phone_local'
      in lower(
        pg_get_functiondef(
          to_regprocedure(
            'public.s3_search_members(text,text)'
          )
        )
      )
    )>0
    then 'OK'
    else 'CHECK FAILED'
  end
union all
select
  'owner and cashier permitted',
  case
    when position(
      'array[''owner'',''kasir'']'
      in lower(
        pg_get_functiondef(
          to_regprocedure(
            'public.s3_search_members(text,text)'
          )
        )
      )
    )>0
    then 'OK'
    else 'CHECK FAILED'
  end;
