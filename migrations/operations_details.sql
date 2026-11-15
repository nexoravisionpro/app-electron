-- Cambios aditivos: los registros y clientes anteriores siguen siendo válidos.
alter table public.empleados add column details jsonb not null default '{}'::jsonb, add column ops_revision integer not null default 0;
alter table public.gastos add column details jsonb not null default '{}'::jsonb, add column ops_revision integer not null default 0;
alter table public.citas add column details jsonb not null default '{}'::jsonb, add column ops_revision integer not null default 0;
alter table public.cotizaciones add column details jsonb not null default '{}'::jsonb, add column ops_revision integer not null default 0;
create unique index cp_employee_code_owner_unique on public.empleados(user_id,lower(trim(details->>'code'))) where nullif(trim(details->>'code'),'') is not null;
create or replace function public.cp_validate_operations_details() returns trigger language plpgsql security invoker set search_path='' as $$
declare d jsonb:=new.details; item jsonb; subtotal numeric:=0; discount numeric; rate numeric; tax_amount numeric; total numeric; qty numeric; price numeric;
begin
 if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>200000 then raise exception 'Detalle administrativo inválido';end if;
 if tg_op='UPDATE' then
  if new.user_id is distinct from old.user_id then raise exception 'No se puede cambiar el propietario';end if;
  new.ops_revision:=old.ops_revision+1;
 else new.ops_revision:=0;end if;
 if tg_table_name='empleados' then
  if length(coalesce(d->>'code',''))>100 or length(coalesce(d->>'email',''))>200 then raise exception 'Expediente inválido';end if;
  if nullif(d->>'hired','') is not null then perform (d->>'hired')::date;end if;
  if nullif(d->>'ended','') is not null then perform (d->>'ended')::date;end if;
  if nullif(d->>'ended','') is not null and nullif(d->>'hired','') is not null and (d->>'ended')::date<(d->>'hired')::date then raise exception 'Baja anterior al ingreso';end if;
 elsif tg_table_name='gastos' then
  if d ? 'paymentStatus' and d->>'paymentStatus' not in ('Pagado','Pendiente') then raise exception 'Estado de pago inválido';end if;
  if nullif(d->>'due','') is not null then perform (d->>'due')::date;end if;
  if nullif(d->>'paidOn','') is not null then perform (d->>'paidOn')::date;end if;
  if d->>'paymentStatus'='Pagado' and nullif(d->>'paidOn','') is null then raise exception 'Se requiere la fecha de pago';end if;
  if d->>'paymentStatus'='Pendiente' then new.details:=jsonb_set(d,'{paidOn}','""'::jsonb);end if;
 elsif tg_table_name='citas' then
  if d ? 'status' and d->>'status' not in ('programada','confirmada','cancelada') then raise exception 'Estado de cita inválido';end if;
  if d ? 'duracion' and (coalesce(d->>'duracion','') !~ '^[0-9]{1,4}$' or (d->>'duracion')::integer not between 5 and 1440) then raise exception 'Duración inválida';end if;
 elsif tg_table_name='cotizaciones' and d ? 'items' then
  if jsonb_typeof(d->'items') is distinct from 'array' or jsonb_array_length(d->'items') not between 1 and 100 then raise exception 'Partidas inválidas';end if;
  for item in select value from jsonb_array_elements(d->'items') loop
   if jsonb_typeof(item) is distinct from 'object' or nullif(trim(item->>'description'),'') is null or length(item->>'description')>600 or coalesce(item->>'qty','') !~ '^[0-9]+([.][0-9]{1,3})?$' or coalesce(item->>'price','') !~ '^[0-9]+([.][0-9]{1,2})?$' then raise exception 'Partida inválida';end if;
   qty:=(item->>'qty')::numeric;price:=(item->>'price')::numeric;
   if qty<=0 or qty>1000000 or price<0 or price>999999999 then raise exception 'Cantidad o precio inválido';end if;
   subtotal:=subtotal+round(qty*price,2);
  end loop;
  discount:=coalesce((d->>'discount')::numeric,0);rate:=coalesce((d->>'tax')::numeric,0);
  if discount<0 or discount>subtotal or discount<>round(discount,2) or rate<0 or rate>100 then raise exception 'Descuento o impuesto inválido';end if;
  tax_amount:=round((subtotal-discount)*rate/100,2);total:=subtotal-discount+tax_amount;
  if total<=0 or total<>new.monto then raise exception 'Las partidas no coinciden con el total';end if;
  new.details:=d||jsonb_build_object('subtotal',subtotal,'discount',discount,'tax',rate,'taxAmount',tax_amount,'total',total);
 end if;
 return new;
end $$;
revoke all on function public.cp_validate_operations_details() from public,anon,authenticated;
create trigger cp_operations_employee before insert or update on public.empleados for each row execute function public.cp_validate_operations_details();
create trigger cp_operations_expense before insert or update on public.gastos for each row execute function public.cp_validate_operations_details();
create trigger cp_operations_appointment before insert or update on public.citas for each row execute function public.cp_validate_operations_details();
create trigger cp_operations_quote before insert or update on public.cotizaciones for each row execute function public.cp_validate_operations_details();
