create schema if not exists cp_private;
revoke all on schema cp_private from public, anon;
grant usage on schema cp_private to authenticated;
create function cp_private.remove_warehouse_if_empty(p_warehouse_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_warehouse public.almacenes%rowtype;
begin
 if v_user is null or p_warehouse_id is null then raise exception 'Sesión o almacén inválido'; end if;
 -- Serializa eliminaciones de la misma cuenta realizadas mediante esta función.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':warehouse-delete',0));
 perform 1 from public.almacenes where user_id=v_user order by id for update;
 select * into v_warehouse from public.almacenes where id=p_warehouse_id and user_id=v_user;
 if not found then raise exception 'Almacén no disponible'; end if;
 if (select count(*) from public.almacenes where user_id=v_user)<=1 then raise exception 'Debe existir al menos un almacén'; end if;
 -- Incluye toda fila asociada a este almacén, incluso si presenta datos inconsistentes.
 if exists(select 1 from public.producto_existencias where almacen_id=p_warehouse_id and cantidad<>0) then
  raise exception 'El almacén tiene existencias; transfiérelas antes de eliminarlo';
 end if;
 if exists(select 1 from public.kardex where almacen_id=p_warehouse_id) then
  raise exception 'El almacén tiene movimientos; desactívalo para conservar el historial';
 end if;
 delete from public.almacenes where id=p_warehouse_id and user_id=v_user;
 return found;
end $$;
revoke all on function cp_private.remove_warehouse_if_empty(uuid) from public,anon;
grant execute on function cp_private.remove_warehouse_if_empty(uuid) to authenticated;
create function public.cp_remove_empty_warehouse(p_warehouse_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select cp_private.remove_warehouse_if_empty(p_warehouse_id)
$$;
revoke all on function public.cp_remove_empty_warehouse(uuid) from public,anon;
grant execute on function public.cp_remove_empty_warehouse(uuid) to authenticated;
-- La desactivación y las escrituras antiguas requieren permisos y protección aparte.
