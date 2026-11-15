create schema if not exists cp_private;
revoke all on schema cp_private from public, anon;
grant usage on schema cp_private to authenticated;

create table public.cp_stock_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  producto_id bigint not null references public.productos(id) on delete restrict,
  origen_id uuid not null references public.almacenes(id) on delete restrict,
  destino_id uuid not null references public.almacenes(id) on delete restrict,
  cantidad numeric not null check(cantidad > 0),
  origen_antes numeric not null,
  origen_despues numeric not null,
  destino_antes numeric not null,
  destino_despues numeric not null,
  created_at timestamptz not null default now(),
  check(origen_id <> destino_id), unique(user_id,request_id)
);
alter table public.cp_stock_transfers enable row level security;
revoke all on public.cp_stock_transfers from public, anon, authenticated;
grant select on public.cp_stock_transfers to authenticated;
create policy cp_stock_transfers_read on public.cp_stock_transfers for select to authenticated using (user_id=(select auth.uid()));

create function cp_private.transfer_stock_once(p_request_id uuid,p_product_id bigint,p_from uuid,p_to uuid,p_quantity numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_existing public.cp_stock_transfers%rowtype;
  v_origin public.producto_existencias%rowtype;
  v_destination public.producto_existencias%rowtype;
  v_transfer uuid;
begin
  if v_user is null or p_request_id is null or p_product_id is null or p_from is null or p_to is null or p_from=p_to
     or p_quantity is null or p_quantity<=0 or p_quantity>999999999999.999 or round(p_quantity,3)<>p_quantity then
    raise exception 'Datos de transferencia inválidos';
  end if;
  -- Orden fijo: referencia y producto. Los bloqueos se liberan al cerrar la transacción.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':transfer:'||p_request_id::text,0));
  select * into v_existing from public.cp_stock_transfers where user_id=v_user and request_id=p_request_id;
  if found then
    if (v_existing.producto_id,v_existing.origen_id,v_existing.destino_id,v_existing.cantidad)
       is distinct from (p_product_id,p_from,p_to,p_quantity) then
      raise exception 'La referencia ya se usó con otros datos';
    end if;
    return v_existing.id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':stock:'||p_product_id::text,0));
  perform 1 from public.productos where id=p_product_id and user_id=v_user for update;
  if not found then raise exception 'Producto no disponible'; end if;
  perform 1 from public.almacenes where id in (p_from,p_to) and user_id=v_user and activo order by id for update;
  if (select count(*) from public.almacenes where id in (p_from,p_to) and user_id=v_user and activo) <> 2 then
    raise exception 'Almacén no disponible';
  end if;
  -- Es imprescindible que el origen ya exista; no se inventa una existencia.
  if not exists(select 1 from public.producto_existencias where user_id=v_user and producto_id=p_product_id and almacen_id=p_from) then
    raise exception 'El origen no tiene existencia registrada';
  end if;
  insert into public.producto_existencias(user_id,producto_id,almacen_id,cantidad)
    values(v_user,p_product_id,p_to,0) on conflict(producto_id,almacen_id) do nothing;
  perform 1 from public.producto_existencias where user_id=v_user and producto_id=p_product_id and almacen_id in(p_from,p_to)
    order by almacen_id for update;
  select * into v_origin from public.producto_existencias where user_id=v_user and producto_id=p_product_id and almacen_id=p_from;
  if not found then raise exception 'Existencia de origen no disponible'; end if;
  select * into v_destination from public.producto_existencias where user_id=v_user and producto_id=p_product_id and almacen_id=p_to;
  if not found then raise exception 'Existencia de destino no disponible'; end if;
  if v_origin.cantidad<p_quantity then raise exception 'Existencia insuficiente'; end if;
  update public.producto_existencias set cantidad=v_origin.cantidad-p_quantity,updated_at=now() where id=v_origin.id and user_id=v_user;
  update public.producto_existencias set cantidad=v_destination.cantidad+p_quantity,updated_at=now() where id=v_destination.id and user_id=v_user;
  insert into public.cp_stock_transfers(user_id,request_id,producto_id,origen_id,destino_id,cantidad,origen_antes,origen_despues,destino_antes,destino_despues)
  values(v_user,p_request_id,p_product_id,p_from,p_to,p_quantity,v_origin.cantidad,v_origin.cantidad-p_quantity,v_destination.cantidad,v_destination.cantidad+p_quantity)
  returning id into v_transfer;
  insert into public.kardex(user_id,producto_id,almacen_id,tipo,cantidad,existencia_anterior,existencia_posterior,documento_tipo,documento_id,documento,usuario)
  values(v_user,p_product_id,p_from,'transferencia',-p_quantity,v_origin.cantidad,v_origin.cantidad-p_quantity,'transferencia',v_transfer::text,'Transferencia',v_user::text),
        (v_user,p_product_id,p_to,'transferencia',p_quantity,v_destination.cantidad,v_destination.cantidad+p_quantity,'transferencia',v_transfer::text,'Transferencia',v_user::text);
  return v_transfer;
end $$;
revoke all on function cp_private.transfer_stock_once(uuid,bigint,uuid,uuid,numeric) from public, anon;
grant execute on function cp_private.transfer_stock_once(uuid,bigint,uuid,uuid,numeric) to authenticated;
create function public.cp_transfer_stock_once(p_request_id uuid,p_product_id bigint,p_from uuid,p_to uuid,p_quantity numeric)
returns uuid language sql security invoker set search_path = '' as $$
  select cp_private.transfer_stock_once(p_request_id,p_product_id,p_from,p_to,p_quantity)
$$;
revoke all on function public.cp_transfer_stock_once(uuid,bigint,uuid,uuid,numeric) from public, anon;
grant execute on function public.cp_transfer_stock_once(uuid,bigint,uuid,uuid,numeric) to authenticated;
-- Pendiente: compatibilidad con clientes antiguos, permisos individuales, control
-- de creación de almacenes, conciliación con productos.nombre y pruebas integrales.
