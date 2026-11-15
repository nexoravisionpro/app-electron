create or replace function cp_private.business_purchase(p_action text,p_id uuid,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=auth.uid();o public.cp_purchase_orders%rowtype;s public.cp_business_suppliers%rowtype;line jsonb;adj jsonb;items jsonb:='[]';seen bigint[]:=array[]::bigint[];pid bigint;qty numeric;cost numeric;subtotal numeric:=0;discount numeric;tax numeric;total numeric;new_total numeric;expected jsonb;warehouse uuid;supplier uuid;v_name text;stockqty numeric;oldname text;change jsonb;result uuid;matches text[];
begin
 if u is null then raise exception 'Se requiere iniciar sesión';end if;
 select * into o from public.cp_purchase_orders where id=p_id and user_id=u for update;
 if p_action='purchase.save' then
  if o.id is not null and (o.status<>'borrador' or o.revision is distinct from (p_data->>'revision')::integer) then raise exception 'La orden cambió o ya no es un borrador';end if;
  if o.id is null and p_data->>'revision' is not null then raise exception 'Orden no disponible';end if;
  supplier:=(p_data->>'supplier_id')::uuid;warehouse:=(p_data->>'warehouse_id')::uuid;
  select * into s from public.cp_business_suppliers where id=supplier and user_id=u and active;
  if not found or not exists(select 1 from public.almacenes where id=warehouse and user_id=u and activo)then raise exception 'Selecciona proveedor y almacén activos';end if;
  if jsonb_typeof(p_data->'items')is distinct from 'array' or jsonb_array_length(p_data->'items')not between 1 and 100 then raise exception 'Agrega entre una y cien partidas';end if;
  for line in select value from jsonb_array_elements(p_data->'items')loop
   pid:=(line->>'product_id')::bigint;qty:=(line->>'quantity')::numeric;cost:=(line->>'unit_cost')::numeric;
   if pid is null or pid=any(seen) or qty is null or qty<=0 or qty>1000000 or round(qty,3)<>qty or cost is null or cost<0 or cost>999999999 or round(cost,2)<>cost then raise exception 'Revisa cantidades, costos y productos repetidos';end if;
   select nombre into v_name from public.productos where id=pid and user_id=u;
   if not found then raise exception 'Producto no disponible';end if;
   if length(coalesce(line->>'lot',''))>100 or coalesce(line->>'lot','')~'[|~{}]' or length(coalesce(line->>'description',v_name))>600 then raise exception 'Revisa la descripción y el lote';end if;
   if nullif(line->>'expiry','')is not null then perform (line->>'expiry')::date;end if;
   if line ? 'serials' and (jsonb_typeof(line->'serials')is distinct from 'array' or jsonb_array_length(line->'serials')>10000)then raise exception 'Los códigos individuales deben ser una lista';end if;
   if exists(select 1 from jsonb_array_elements(coalesce(line->'serials','[]'::jsonb))code where jsonb_typeof(code)is distinct from 'string' or (code#>>'{}')!~'^[-A-Za-z0-9_.]{1,100}$')then raise exception 'Código individual inválido';end if;
   if v_name like '%{pzm:i}%' and (qty<>trunc(qty)or jsonb_array_length(coalesce(line->'serials','[]'::jsonb))<>qty or (select count(distinct code#>>'{}')from jsonb_array_elements(coalesce(line->'serials','[]'::jsonb))code)<>qty)then raise exception 'Cada pieza individual necesita un código nuevo y distinto';end if;
   seen:=array_append(seen,pid);subtotal:=subtotal+round(qty*cost,2);
   items:=items||jsonb_build_array(jsonb_build_object('product_id',pid,'description',coalesce(line->>'description',v_name),'quantity',qty,'unit_cost',cost,'lot',coalesce(line->>'lot',''),'expiry',coalesce(line->>'expiry',''),'serials',coalesce(line->'serials','[]'::jsonb)));
  end loop;
  discount:=coalesce((p_data->>'discount')::numeric,0);tax:=coalesce((p_data->>'tax')::numeric,0);
  if discount<0 or discount>subtotal or discount<>round(discount,2) or tax<0 or tax>100 then raise exception 'Revisa descuento e impuesto';end if;
  total:=subtotal-discount+round((subtotal-discount)*tax/100,2);
  if total<=0 or total>999999999999.99 then raise exception 'Importe de compra inválido';end if;
  if o.id is null then
   insert into public.cp_purchase_orders(id,user_id,supplier_id,warehouse_id,supplier_name,reference,expected_on,notes,items,subtotal,discount,tax,total)values(p_id,u,supplier,warehouse,s.name,coalesce(p_data->>'reference',''),nullif(p_data->>'expected_on','')::date,coalesce(p_data->>'notes',''),items,subtotal,discount,tax,total);
  else
   update public.cp_purchase_orders set supplier_id=supplier,warehouse_id=warehouse,supplier_name=s.name,reference=coalesce(p_data->>'reference',''),expected_on=nullif(p_data->>'expected_on','')::date,notes=coalesce(p_data->>'notes',''),items=items,subtotal=subtotal,discount=discount,tax=tax,total=total,revision=revision+1,updated_at=now() where id=p_id and user_id=u;
  end if;
 elsif p_action in ('purchase.order','purchase.cancel')then
  if o.id is null or o.status not in ('borrador','ordenada')or o.revision is distinct from (p_data->>'revision')::integer then raise exception 'La orden cambió o no está disponible';end if;
  update public.cp_purchase_orders set status=case when p_action='purchase.order' then 'ordenada' else 'cancelada' end,revision=revision+1,updated_at=now() where id=p_id and user_id=u;
 elsif p_action='purchase.receive' then
  if o.id is null or o.status<>'ordenada' or o.revision is distinct from (p_data->>'revision')::integer then raise exception 'La compra cambió, no está ordenada o ya fue recibida';end if;
  if jsonb_typeof(p_data->'adjustments')is distinct from 'array' or jsonb_array_length(p_data->'adjustments')<>jsonb_array_length(o.items) then raise exception 'La recepción debe incluir todas las partidas';end if;
  -- Tomar TODOS los productos antes de bloquear cualquier almacén.
  for line in select value from jsonb_array_elements(o.items)order by (value->>'product_id')::bigint loop
   pid:=(line->>'product_id')::bigint;
   perform pg_advisory_xact_lock(hashtextextended(u::text||':stock:'||pid::text,0));
   perform 1 from public.productos where id=pid and user_id=u for update;
   if not found then raise exception 'Producto no disponible';end if;
  end loop;
  -- Orden global por producto antes de tomar bloqueos de almacén.
  for line in select value from jsonb_array_elements(o.items)order by (value->>'product_id')::bigint loop
   pid:=(line->>'product_id')::bigint;qty:=(line->>'quantity')::numeric;
   perform pg_advisory_xact_lock(hashtextextended(u::text||':stock:'||pid::text,0));
   select nombre into oldname from public.productos where id=pid and user_id=u for update;
   if not found then raise exception 'Producto no disponible';end if;
   select value into adj from jsonb_array_elements(p_data->'adjustments')where (value->>'product_id')::bigint=pid;
   if adj is null then raise exception 'Falta una partida en la recepción';end if;
   expected:=adj->'expected_stock';
   if jsonb_typeof(expected)is distinct from 'object' or adj->>'expected_name' is distinct from oldname then raise exception 'El catálogo cambió; actualiza la recepción';end if;
   select coalesce(sum(value::numeric),0)into stockqty from jsonb_each_text(expected);
   matches:=regexp_match(regexp_replace(oldname,'\{[^}]*\}','','g'),'\(([0-9]+(?:\.[0-9]+)?)\s+(piezas|litros|kilos|metros|cajas|servicios)\)\s*$','i');
   if matches is null or matches[1]::numeric<>stockqty then raise exception 'Concilia las cantidades del catálogo y almacenes antes de recibir';end if;
   new_total:=stockqty+qty;
   change:=jsonb_build_array(jsonb_build_object('almacen_id',o.warehouse_id,'cantidad',coalesce((expected->>o.warehouse_id::text)::numeric,0)+qty));
   result:=public.cp_adjust_stock_once(md5(p_id::text||':'||pid::text)::uuid,pid,oldname,adj->>'new_name',expected,change,new_total);
   update public.kardex set documento_tipo='compra',documento_id=o.id::text,documento='Recepción de compra '||o.reference,observaciones='Proveedor: '||o.supplier_name where user_id=u and documento_tipo='ajuste' and documento_id=result::text;
  end loop;
  update public.cp_purchase_orders set status='recibida',received_at=now(),revision=revision+1,updated_at=now()where id=p_id and user_id=u;
 else raise exception 'Acción de compra no disponible';end if;
 return jsonb_build_object('id',p_id);
end $$;
revoke all on function cp_private.business_purchase(text,uuid,jsonb)from public,anon,authenticated;
