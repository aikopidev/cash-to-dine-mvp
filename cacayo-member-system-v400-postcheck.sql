-- CACAYO Member System v4.0.0 post-check
select 'daily report RPC' check_name,case when to_regprocedure('public.s4_staff_transactions_by_date(text,date,date,text)') is not null then 'OK' else 'MISSING' end result
union all select 'promo table',case when to_regclass('public.outlet_promotions') is not null then 'OK' else 'MISSING' end
union all select 'promo save RPC',case when to_regprocedure('public.s4_save_promo(text,text,text,text,boolean)') is not null then 'OK' else 'MISSING' end
union all select 'promo public RPC',case when to_regprocedure('public.mvp_get_active_promo(text)') is not null then 'OK' else 'MISSING' end;
select o.name,p.title,p.is_active,length(p.image_data_url) image_characters,p.updated_at from public.outlet_promotions p join public.outlets o on o.id=p.outlet_id;
