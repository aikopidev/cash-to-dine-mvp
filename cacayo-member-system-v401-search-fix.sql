-- CACAYO Member System v4.0.1
-- Member search fix:
-- - Search by member name
-- - Search phone stored as 62812... using 62812..., 0812..., or 812...
-- - Owner and cashier supported
-- - Expired wallet balances refreshed before search

begin;

create or replace function public.s3_search_members(
  p_staff_session_token text,
  p_query text
)
returns table(
  member_id uuid,
  member_code text,
  name text,
  phone text,
  status text,
  balance bigint
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_query text:=trim(coalesce(p_query,''));
  v_query_lower text;
  v_query_digits text;
  v_query_local text;
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner','kasir']
  );

  perform public.ctd_expire_all_due_wallets();

  v_query_lower:=lower(v_query);
  v_query_digits:=regexp_replace(v_query,'[^0-9]','','g');
  v_query_local:=v_query_digits;

  if left(v_query_local,2)='62' then
    v_query_local:=substr(v_query_local,3);
  elsif left(v_query_local,1)='0' then
    v_query_local:=substr(v_query_local,2);
  end if;

  if length(v_query)<2 and length(v_query_digits)<2 then
    return;
  end if;

  return query
  select
    m.id,
    m.member_code::text,
    m.name::text,
    m.phone::text,
    m.status::text,
    coalesce(w.balance,0)::bigint
  from public.members m
  left join public.wallets w
    on w.member_id=m.id
  cross join lateral(
    select
      regexp_replace(coalesce(m.phone,''),'[^0-9]','','g')
        as phone_digits
  ) pd
  cross join lateral(
    select
      case
        when left(pd.phone_digits,2)='62'
          then substr(pd.phone_digits,3)
        when left(pd.phone_digits,1)='0'
          then substr(pd.phone_digits,2)
        else pd.phone_digits
      end as phone_local
  ) pl
  where m.outlet_id=v_staff.outlet_id
    and m.status<>'deleted'
    and(
      lower(coalesce(m.name,'')) like '%'||v_query_lower||'%'
      or lower(coalesce(m.member_code,'')) like '%'||v_query_lower||'%'
      or(
        v_query_digits<>''
        and pd.phone_digits like '%'||v_query_digits||'%'
      )
      or(
        v_query_local<>''
        and pl.phone_local like '%'||v_query_local||'%'
      )
    )
  order by
    case
      when lower(coalesce(m.name,''))=v_query_lower then 0
      when lower(coalesce(m.name,'')) like v_query_lower||'%' then 1
      when v_query_local<>'' and pl.phone_local like v_query_local||'%' then 2
      when v_query_digits<>'' and pd.phone_digits like v_query_digits||'%' then 3
      else 4
    end,
    m.created_at desc
  limit 20;
end
$function$;

revoke all on function public.s3_search_members(text,text)
  from public;

grant execute on function public.s3_search_members(text,text)
  to anon,authenticated;

notify pgrst,'reload schema';

commit;

select
  'member search RPC' as check_name,
  case
    when to_regprocedure(
      'public.s3_search_members(text,text)'
    ) is not null
    then 'OK'
    else 'MISSING'
  end as result
union all
select
  'name search logic',
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
  'local phone logic',
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
  end;
