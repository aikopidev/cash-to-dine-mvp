-- CACAYO Member System v4.1.1
-- Reward Control separation + Gift Item code-list payload fix
--
-- Run AFTER v4.1.0.
--
-- Root cause fixed:
-- The old code-list RPC returned the full Base64 item image for every
-- generated Gift Item code. Generating 10 codes could create a very large
-- RPC response and prevent the list from rendering.
--
-- New behavior:
-- - Voucher, Gift Saldo, and Gift Item are queried separately.
-- - Code-list RPC returns item name only, not repeated Base64 images.
-- - Copy RPC also returns only the data needed by Copy WA / Copy Link.
-- - Old list/copy RPCs are removed to avoid unused/dead database endpoints.

begin;

-- ================================================================
-- 0. PRE-FLIGHT
-- ================================================================
do $preflight$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.gift_codes') is null then
    v_missing:=array_append(v_missing,'gift_codes');
  end if;

  if to_regclass('public.gift_item_master') is null then
    v_missing:=array_append(v_missing,'gift_item_master');
  end if;

  if to_regprocedure(
    'public.ctd_require_staff(text,text[])'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_require_staff');
  end if;

  if to_regprocedure(
    'public.ctd_token_hash(text)'
  ) is null then
    v_missing:=array_append(v_missing,'ctd_token_hash');
  end if;

  if cardinality(v_missing)>0 then
    raise exception
      'v4.1.1 stopped. Missing base objects: %',
      array_to_string(v_missing,', ');
  end if;
end
$preflight$;

-- ================================================================
-- 1. REMOVE OLD HEAVY/UNUSED RPCs
-- ================================================================
drop function if exists public.s3_list_gift_codes_paged(
  text,text,integer,integer
);

drop function if exists public.s3_copy_gift_code(
  text,uuid,text
);

drop function if exists public.s4_list_reward_codes_paged(
  text,text,text,integer,integer
);

drop function if exists public.s4_copy_reward_code(
  text,uuid,text
);

-- ================================================================
-- 2. LIGHTWEIGHT, TYPE-SPECIFIC CODE LIST
-- ================================================================
create function public.s4_list_reward_codes_paged(
  p_staff_session_token text,
  p_code_type text,
  p_status text default 'available',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  gift_id uuid,
  code text,
  value bigint,
  voucher_status text,
  campaign_name text,
  expired_at date,
  used_at timestamptz,
  used_by_phone text,
  used_by_name text,
  created_at timestamptz,
  copied_at timestamptz,
  copied_method text,
  code_type text,
  gift_item_id uuid,
  gift_item_name text,
  total_count bigint
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_type text:=lower(trim(coalesce(p_code_type,'')));
  v_status text:=lower(trim(coalesce(p_status,'available')));
  v_limit integer:=least(
    greatest(coalesce(p_limit,10),1),
    100
  );
  v_offset integer:=greatest(
    coalesce(p_offset,0),
    0
  );
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  if v_type not in('voucher','gift','item') then
    raise exception 'Kategori kode tidak valid';
  end if;

  if v_status not in(
    'available',
    'registered',
    'claimed',
    'expired',
    'void',
    'all'
  ) then
    raise exception 'Status filter tidak valid';
  end if;

  update public.gift_codes g
  set status='expired'
  where g.outlet_id=v_staff.outlet_id
    and g.status='available'
    and g.expired_at is not null
    and g.expired_at<
      (now() at time zone 'Asia/Jakarta')::date;

  return query
  select
    g.id,
    g.code::text,
    g.value::bigint,
    g.status::text,
    g.campaign_name::text,
    g.expired_at,
    g.used_at,
    m.phone::text,
    m.name::text,
    g.created_at,
    g.copied_at,
    g.copied_method::text,
    g.code_type::text,
    i.id,
    i.name::text,
    count(*) over()::bigint
  from public.gift_codes g
  left join public.members m
    on m.id=g.used_by_member_id
  left join public.gift_item_master i
    on i.id=g.gift_item_id
  where g.outlet_id=v_staff.outlet_id
    and g.code_type=v_type
    and(
      v_status='all'
      or(
        v_status='registered'
        and g.status in('registered','used')
      )
      or(
        v_status<>'registered'
        and g.status=v_status
      )
    )
  order by
    g.created_at desc,
    g.id desc
  limit v_limit
  offset v_offset;
end
$function$;

revoke all on function public.s4_list_reward_codes_paged(
  text,text,text,integer,integer
) from public;

grant execute on function public.s4_list_reward_codes_paged(
  text,text,text,integer,integer
) to anon,authenticated;

-- ================================================================
-- 3. LIGHTWEIGHT COPY RPC
-- ================================================================
create function public.s4_copy_reward_code(
  p_staff_session_token text,
  p_gift_id uuid,
  p_method text
)
returns table(
  copy_allowed boolean,
  error_message text,
  gift_id uuid,
  code text,
  value bigint,
  copied_at timestamptz,
  copied_method text,
  code_type text,
  campaign_name text,
  expired_at date,
  gift_item_id uuid,
  gift_item_name text
)
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_staff record;
  v_gift public.gift_codes%rowtype;
  v_item_name text;
  v_method text:=lower(
    trim(coalesce(p_method,''))
  );
  v_now timestamptz:=now();
begin
  select *
  into v_staff
  from public.ctd_require_staff(
    p_staff_session_token,
    array['owner']
  );

  if v_method not in('wa','link') then
    raise exception 'Metode copy tidak valid';
  end if;

  select g.*
  into v_gift
  from public.gift_codes g
  where g.id=p_gift_id
    and g.outlet_id=v_staff.outlet_id
  for update;

  if not found then
    raise exception 'Kode tidak ditemukan';
  end if;

  if v_gift.gift_item_id is not null then
    select i.name
    into v_item_name
    from public.gift_item_master i
    where i.id=v_gift.gift_item_id;
  end if;

  if v_gift.status='available'
     and v_gift.expired_at is not null
     and v_gift.expired_at<
       (now() at time zone 'Asia/Jakarta')::date then
    update public.gift_codes
    set status='expired'
    where id=v_gift.id;

    v_gift.status:='expired';
  end if;

  if v_gift.status<>'available' then
    return query
    select
      false,
      'Kode sudah tidak available'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.value::bigint,
      v_gift.copied_at,
      v_gift.copied_method::text,
      v_gift.code_type::text,
      v_gift.campaign_name::text,
      v_gift.expired_at,
      v_gift.gift_item_id,
      v_item_name;
    return;
  end if;

  if v_gift.copied_at is not null then
    return query
    select
      false,
      'Kode sudah pernah dicopy'::text,
      v_gift.id,
      v_gift.code::text,
      v_gift.value::bigint,
      v_gift.copied_at,
      v_gift.copied_method::text,
      v_gift.code_type::text,
      v_gift.campaign_name::text,
      v_gift.expired_at,
      v_gift.gift_item_id,
      v_item_name;
    return;
  end if;

  update public.gift_codes
  set
    copied_at=v_now,
    copied_method=v_method,
    copied_by_staff_id=v_staff.staff_id
  where id=v_gift.id;

  insert into public.security_audit_log(
    staff_id,
    outlet_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values(
    v_staff.staff_id,
    v_staff.outlet_id,
    'campaign_code_shared',
    'voucher',
    v_gift.id,
    jsonb_build_object(
      'method',v_method,
      'code_type',v_gift.code_type
    )
  );

  return query
  select
    true,
    null::text,
    v_gift.id,
    v_gift.code::text,
    v_gift.value::bigint,
    v_now,
    v_method,
    v_gift.code_type::text,
    v_gift.campaign_name::text,
    v_gift.expired_at,
    v_gift.gift_item_id,
    v_item_name;
end
$function$;

revoke all on function public.s4_copy_reward_code(
  text,uuid,text
) from public;

grant execute on function public.s4_copy_reward_code(
  text,uuid,text
) to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- ================================================================
-- INSTALLATION CHECK
-- ================================================================
select
  'lightweight reward list RPC' as check_name,
  case when to_regprocedure(
    'public.s4_list_reward_codes_paged(text,text,text,integer,integer)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end as result
union all
select
  'lightweight copy RPC',
  case when to_regprocedure(
    'public.s4_copy_reward_code(text,uuid,text)'
  ) is not null
  then 'OK'
  else 'MISSING'
  end
union all
select
  'old heavy list RPC removed',
  case when to_regprocedure(
    'public.s3_list_gift_codes_paged(text,text,integer,integer)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'old heavy copy RPC removed',
  case when to_regprocedure(
    'public.s3_copy_gift_code(text,uuid,text)'
  ) is null
  then 'OK'
  else 'CHECK FAILED'
  end
union all
select
  'list excludes Base64 image payload',
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
  end;
