create schema if not exists cp_private;
revoke all on schema cp_private from public, anon;
grant usage on schema cp_private to authenticated;
create table public.cp_stock_adjustments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 request_id uuid not null, producto_id bigint not null references public.productos(id) on delete restrict,
 payload_hash text not null, created_at timestamptz not null default now(), unique(user_id,request_id)
);
alter table public.cp_stock_adjustments enable row level security;
revoke all on public.cp_stock_adjustments from public, anon, authenticated;
grant select on public.cp_stock_adjustments to authenticated;
create policy cp_stock_adjustments_read on public.cp_stock_adjustments for select to authenticated using (user_id=(select auth.uid()));

create function cp_private.adjust_stock_once(
 p_request_id uuid, p_product_id bigint, p_expected_name text, p_new_name text,
 p_expected_stock jsonb, p_changes jsonb, p_expected_total numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
 v_user uuid := auth.uid(); v_existing public.cp_stock_adjustments%rowtype;
 v_hash text; v_id uuid; v_product public.productos%rowtype;
 v_current jsonb; v_item jsonb; v_warehouse uuid; v_quantity numeric;
 v_before numeric; v_total numeric; v_keys uuid[] := array[]::uuid[];
 v_without_meta text; v_quantity_match text[];
begin
 if v_user is null or p_request_id is null or p_product_id is null or p_expected_name is null
   or p_new_name is null or length(p_new_name)=0 or length(p_new_name)>10000
   or jsonb_typeof(p_expected_stock) is distinct from 'object'
   or jsonb_typeof(p_changes) is distinct from 'array'
   or jsonb_array_length(p_changes)>1000 or p_expected_total is null or p_expected_total<0
   or p_expected_total>999999999999.999 then raise exception 'Datos de ajuste inválidos'; end if;
 v_hash:=pg_catalog.md5(pg_catalog.jsonb_build_object('producto',p_product_id,'nombre_anterior',p_expected_name,'nombre_nuevo',p_new_name,
  'existencias_anteriores',p_expected_stock,'cambios',p_changes,'total',p_expected_total)::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':adjust:'||p_request_id::text,0));
 select * into v_existing from public.cp_stock_adjustments where user_id=v_user and request_id=p_request_id;
 if found then
  if v_existing.payload_hash<>v_hash then raise exception 'La referencia ya se usó con otros datos'; end if;
  return v_existing.id;
 end if;
 -- Mismo bloqueo por producto que la transferencia preparada.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':stock:'||p_product_id::text,0));
 select * into v_product from public.productos where id=p_product_id and user_id=v_user for update;
 if not found or v_product.nombre is distinct from p_expected_name then raise exception 'El producto cambió; actualiza antes de ajustar'; end if;
 perform 1 from public.producto_existencias where user_id=v_user and producto_id=p_product_id order by almacen_id for update;
 select coalesce(pg_catalog.jsonb_object_agg(almacen_id::text,cantidad),'{}'::jsonb) into v_current
   from public.producto_existencias where user_id=v_user and producto_id=p_product_id;
 if v_current is distinct from p_expected_stock then raise exception 'Las existencias cambiaron; actualiza antes de ajustar'; end if;
 -- Valida todas las filas antes de escribir ninguna.
 for v_item in select value from pg_catalog.jsonb_array_elements(p_changes) loop
  if jsonb_typeof(v_item) is distinct from 'object' or not (v_item ? 'almacen_id') or not (v_item ? 'cantidad') then raise exception 'Ajuste inválido'; end if;
  v_warehouse:=(v_item->>'almacen_id')::uuid;
  v_quantity:=(v_item->>'cantidad')::numeric;
  if v_warehouse is null or v_warehouse=any(v_keys) or v_quantity is null or v_quantity<0 or v_quantity>999999999999.999 or round(v_quantity,3)<>v_quantity then raise exception 'Cantidad o almacén inválido'; end if;
  v_keys:=array_append(v_keys,v_warehouse);
 end loop;
 -- Bloquea almacenes en orden para evitar carreras de propiedad o estado.
 perform 1 from public.almacenes where user_id=v_user and id=any(v_keys) order by id for update;
 if (select count(*) from public.almacenes where user_id=v_user and id=any(v_keys) and activo)<>cardinality(v_keys) then raise exception 'Almacén no disponible'; end if;
 insert into public.cp_stock_adjustments(user_id,request_id,producto_id,payload_hash) values(v_user,p_request_id,p_product_id,v_hash) returning id into v_id;
 for v_item in select value from pg_catalog.jsonb_array_elements(p_changes) loop
  v_warehouse:=(v_item->>'almacen_id')::uuid;v_quantity:=(v_item->>'cantidad')::numeric;
  select cantidad into v_before from public.producto_existencias where user_id=v_user and producto_id=p_product_id and almacen_id=v_warehouse;
  v_before:=coalesce(v_before,0);
  insert into public.producto_existencias(user_id,producto_id,almacen_id,cantidad) values(v_user,p_product_id,v_warehouse,v_quantity)
    on conflict(producto_id,almacen_id) do update set cantidad=excluded.cantidad,updated_at=now()
    where public.producto_existencias.user_id=v_user;
  if not found then raise exception 'Existencia no disponible'; end if;
  if v_before<>v_quantity then
   insert into public.kardex(user_id,producto_id,almacen_id,tipo,cantidad,existencia_anterior,existencia_posterior,documento_tipo,documento_id,documento,usuario)
    values(v_user,p_product_id,v_warehouse,'ajuste',v_quantity-v_before,v_before,v_quantity,'ajuste',v_id::text,'Ajuste de inventario',v_user::text);
  end if;
 end loop;
 select coalesce(sum(cantidad),0) into v_total from public.producto_existencias where user_id=v_user and producto_id=p_product_id;
 if v_total<>p_expected_total then raise exception 'El total del inventario no coincide'; end if;
 -- Verifica que el nombre compatible conserve la misma cantidad calculada.
 v_without_meta:=pg_catalog.regexp_replace(p_new_name,'\{(?:costo:[0-9.]+|min:[0-9]+|pzm:[if]|pzs:[^}]*|grp:[^}]{1,40}|atr:[^}]*|lts:[^}]*)\}','', 'g');
 v_quantity_match:=pg_catalog.regexp_match(pg_catalog.btrim(v_without_meta),'\(([0-9]+(?:\.[0-9]+)?)\s+(piezas|litros|kilos|metros|cajas|servicios)\)\s*$','i');
 if v_quantity_match is null or v_quantity_match[1]::numeric<>v_total then raise exception 'La cantidad compatible no coincide'; end if;
 update public.productos set nombre=p_new_name where id=p_product_id and user_id=v_user and nombre=p_expected_name;
 if not found then raise exception 'El producto ya no está disponible'; end if;
 return v_id;
end $$;
revoke all on function cp_private.adjust_stock_once(uuid,bigint,text,text,jsonb,jsonb,numeric) from public, anon;
grant execute on function cp_private.adjust_stock_once(uuid,bigint,text,text,jsonb,jsonb,numeric) to authenticated;
create function public.cp_adjust_stock_once(p_request_id uuid,p_product_id bigint,p_expected_name text,p_new_name text,p_expected_stock jsonb,p_changes jsonb,p_expected_total numeric)
returns uuid language sql security invoker set search_path = '' as $$
 select cp_private.adjust_stock_once(p_request_id,p_product_id,p_expected_name,p_new_name,p_expected_stock,p_changes,p_expected_total)
$$;
revoke all on function public.cp_adjust_stock_once(uuid,bigint,text,text,jsonb,jsonb,numeric) from public, anon;
grant execute on function public.cp_adjust_stock_once(uuid,bigint,text,text,jsonb,jsonb,numeric) to authenticated;
-- No incluye configuraciones de máximos/reorden ni gestiona lotes. La función
-- debe integrarse con una interfaz que conserve request_id ante desconexiones.
