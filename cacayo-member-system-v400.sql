-- CACAYO Member System v4.0.0
-- White-label UI support: daily report + customer promo image.
begin;

do $preflight$
begin
  if to_regprocedure('public.ctd_require_staff(text,text[])') is null then
    raise exception 'Missing CTD security foundation: ctd_require_staff';
  end if;
end
$preflight$;

create table if not exists public.outlet_promotions(
  outlet_id uuid primary key references public.outlets(id) on delete cascade,
  title text not null default '',
  caption text not null default '',
  image_data_url text,
  is_active boolean not null default false,
  updated_by_staff_id uuid references public.staff_profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.outlet_promotions enable row level security;
revoke all on table public.outlet_promotions from public,anon,authenticated;

create index if not exists idx_transactions_outlet_created_at
on public.transactions(outlet_id,created_at desc);

drop function if exists public.s4_staff_transactions_by_date(text,date,date,text);
create function public.s4_staff_transactions_by_date(
  p_staff_session_token text,
  p_date_from date,
  p_date_to date,
  p_type text default 'all'
)
returns table(
  transaction_id uuid,
  type text,
  member_name text,
  member_phone text,
  balance_used bigint,
  cash_paid bigint,
  credit_issued bigint,
  status text,
  created_at timestamptz
)
language plpgsql security definer set search_path=public
as $function$
declare
  v_staff record;
  v_from date:=coalesce(p_date_from,current_date-6);
  v_to date:=coalesce(p_date_to,current_date);
  v_type text:=lower(trim(coalesce(p_type,'all')));
begin
  select * into v_staff from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']);
  if v_from>v_to then raise exception 'Tanggal awal tidak boleh setelah tanggal akhir'; end if;
  if v_to-v_from>366 then raise exception 'Rentang report maksimal 366 hari'; end if;
  return query
  select t.id,t.type::text,m.name::text,m.phone::text,
         coalesce(t.balance_used,0)::bigint,coalesce(t.cash_paid,0)::bigint,
         coalesce(t.credit_issued,0)::bigint,t.status::text,t.created_at
  from public.transactions t
  left join public.members m on m.id=t.member_id
  where t.outlet_id=v_staff.outlet_id
    and (t.created_at at time zone 'Asia/Jakarta')::date between v_from and v_to
    and (v_type='all' or t.type=v_type)
  order by t.created_at desc
  limit 2000;
end
$function$;
revoke all on function public.s4_staff_transactions_by_date(text,date,date,text) from public;
grant execute on function public.s4_staff_transactions_by_date(text,date,date,text) to anon,authenticated;

drop function if exists public.s4_get_promo_admin(text);
create function public.s4_get_promo_admin(p_staff_session_token text)
returns table(title text,caption text,image_data_url text,is_active boolean,updated_at timestamptz)
language plpgsql security definer set search_path=public
as $function$
declare v_staff record;
begin
  select * into v_staff from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']);
  return query select p.title,p.caption,p.image_data_url,p.is_active,p.updated_at
  from public.outlet_promotions p where p.outlet_id=v_staff.outlet_id limit 1;
end
$function$;
revoke all on function public.s4_get_promo_admin(text) from public;
grant execute on function public.s4_get_promo_admin(text) to anon,authenticated;

drop function if exists public.s4_save_promo(text,text,text,text,boolean);
create function public.s4_save_promo(
  p_staff_session_token text,
  p_title text,
  p_caption text,
  p_image_data_url text,
  p_is_active boolean
)
returns table(title text,caption text,image_data_url text,is_active boolean,updated_at timestamptz)
language plpgsql security definer set search_path=public
as $function$
declare v_staff record;v_image text;v_now timestamptz:=now();
begin
  select * into v_staff from public.ctd_require_staff(p_staff_session_token,array['owner','kasir']);
  if length(coalesce(p_title,''))>100 then raise exception 'Judul maksimal 100 karakter'; end if;
  if length(coalesce(p_caption,''))>240 then raise exception 'Keterangan maksimal 240 karakter'; end if;
  if p_image_data_url is not null then
    if p_image_data_url !~ '^data:image/(jpeg|png|webp);base64,' then raise exception 'Format gambar tidak valid'; end if;
    if length(p_image_data_url)>2300000 then raise exception 'Ukuran gambar hasil kompresi terlalu besar'; end if;
  end if;
  select coalesce(p_image_data_url,p.image_data_url) into v_image from public.outlet_promotions p where p.outlet_id=v_staff.outlet_id;
  if not found then v_image:=p_image_data_url; end if;
  insert into public.outlet_promotions(outlet_id,title,caption,image_data_url,is_active,updated_by_staff_id,updated_at)
  values(v_staff.outlet_id,left(trim(coalesce(p_title,'')),100),left(trim(coalesce(p_caption,'')),240),v_image,(coalesce(p_is_active,false) and v_image is not null),v_staff.staff_id,v_now)
  on conflict(outlet_id) do update set title=excluded.title,caption=excluded.caption,image_data_url=excluded.image_data_url,is_active=excluded.is_active,updated_by_staff_id=excluded.updated_by_staff_id,updated_at=excluded.updated_at;
  insert into public.security_audit_log(staff_id,outlet_id,action,entity_type,entity_id,metadata)
  values(v_staff.staff_id,v_staff.outlet_id,'promo_updated','promotion',v_staff.outlet_id,jsonb_build_object('active',(coalesce(p_is_active,false) and v_image is not null),'has_image',v_image is not null));
  return query select p.title,p.caption,p.image_data_url,p.is_active,p.updated_at from public.outlet_promotions p where p.outlet_id=v_staff.outlet_id;
end
$function$;
revoke all on function public.s4_save_promo(text,text,text,text,boolean) from public;
grant execute on function public.s4_save_promo(text,text,text,text,boolean) to anon,authenticated;

drop function if exists public.mvp_get_active_promo(text);
create function public.mvp_get_active_promo(p_outlet_slug text)
returns table(title text,caption text,image_data_url text,updated_at timestamptz)
language sql security definer set search_path=public
as $function$
  select p.title,p.caption,p.image_data_url,p.updated_at
  from public.outlet_promotions p
  join public.outlets o on o.id=p.outlet_id
  where o.slug=p_outlet_slug and p.is_active=true and p.image_data_url is not null
  limit 1
$function$;
revoke all on function public.mvp_get_active_promo(text) from public;
grant execute on function public.mvp_get_active_promo(text) to anon,authenticated;

notify pgrst,'reload schema';
commit;

select 'daily report RPC' check_name,case when to_regprocedure('public.s4_staff_transactions_by_date(text,date,date,text)') is not null then 'OK' else 'MISSING' end result
union all select 'promo table',case when to_regclass('public.outlet_promotions') is not null then 'OK' else 'MISSING' end
union all select 'promo admin RPC',case when to_regprocedure('public.s4_save_promo(text,text,text,text,boolean)') is not null then 'OK' else 'MISSING' end
union all select 'public promo RPC',case when to_regprocedure('public.mvp_get_active_promo(text)') is not null then 'OK' else 'MISSING' end;
