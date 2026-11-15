CREATE OR REPLACE FUNCTION public.cp_crm_create_quote(p_deal_id uuid, p_quote jsonb, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_user uuid := auth.uid(); v_quote_id uuid; v_existing_deal uuid; v_existing_hash text; v_request_hash text;
begin
 if v_user is null then raise exception 'Se requiere iniciar sesión'; end if;
 if p_request_id is null then raise exception 'Se requiere una referencia de operación'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_request_id::text, 0));
 v_request_hash := pg_catalog.md5(p_quote::text);
 select quote_id, deal_id, request_hash into v_quote_id, v_existing_deal, v_existing_hash
 from public.cp_crm_quote_links where user_id=v_user and request_id=p_request_id;
 if found then
  if v_existing_deal is distinct from p_deal_id or v_existing_hash is distinct from v_request_hash then
   raise exception 'La referencia de operación ya se usó con otros datos';
  end if;
  return v_quote_id;
 end if;
 if not exists(select 1 from public.cp_crm_deals d where d.id=p_deal_id and d.user_id=v_user) then
  raise exception 'Oportunidad no encontrada';
 end if;
 if jsonb_typeof(p_quote) is distinct from 'object' or length(coalesce(p_quote->>'cliente',''))>200 or length(coalesce(p_quote->>'concepto',''))>4000 or length(coalesce(p_quote->>'telefono',''))>40 or length(coalesce(p_quote->>'notas',''))>4000 or length(coalesce(p_quote->>'validez',''))>200 or coalesce(p_quote->>'monto','') !~ '^[0-9]{1,12}([.][0-9]{1,2})?$' then raise exception 'Datos de cotización inválidos';end if;
 if nullif(trim(p_quote->>'cliente'),'') is null or nullif(trim(p_quote->>'concepto'),'') is null or coalesce((p_quote->>'monto')::numeric,0) <= 0 then
  raise exception 'Cotización inválida';
 end if;
 insert into public.cotizaciones (user_id,cliente,telefono,concepto,monto,validez,notas,estado,details)
 values (v_user,p_quote->>'cliente',coalesce(p_quote->>'telefono',''),p_quote->>'concepto',(p_quote->>'monto')::numeric,coalesce(p_quote->>'validez',''),coalesce(p_quote->>'notas',''),'pendiente',coalesce(p_quote->'details','{}'::jsonb)) returning id into v_quote_id;
 insert into public.cp_crm_quote_links (user_id,deal_id,quote_id,request_id,request_hash) values (v_user,p_deal_id,v_quote_id,p_request_id,v_request_hash);
 insert into public.cp_crm_activities(user_id,deal_id,texto) values (v_user,p_deal_id,'Se creó una cotización vinculada');
 return v_quote_id;
end;
$function$
;
