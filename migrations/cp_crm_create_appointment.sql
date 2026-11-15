CREATE OR REPLACE FUNCTION public.cp_crm_create_appointment(p_deal_id uuid, p_appointment jsonb, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_user uuid := auth.uid();v_appointment_id uuid;v_existing_deal uuid;v_existing_hash text;v_hash text;
begin
 if v_user is null or p_request_id is null then raise exception 'Sesión o referencia de operación no válida';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_request_id::text,0));
 v_hash:=pg_catalog.md5(p_appointment::text);
 select appointment_id,deal_id,request_hash into v_appointment_id,v_existing_deal,v_existing_hash
 from public.cp_crm_appointment_links where user_id=v_user and request_id=p_request_id;
 if found then
  if v_existing_deal is distinct from p_deal_id or v_existing_hash is distinct from v_hash then raise exception 'La referencia de operación ya se usó con otros datos';end if;
  return v_appointment_id;
 end if;
 if not exists(select 1 from public.cp_crm_deals d where d.id=p_deal_id and d.user_id=v_user) then raise exception 'Oportunidad no encontrada';end if;
 if jsonb_typeof(p_appointment) is distinct from 'object' or length(coalesce(p_appointment->>'titulo',''))>200 or length(coalesce(p_appointment->>'cliente',''))>200 or length(coalesce(p_appointment->>'telefono',''))>40 or length(coalesce(p_appointment->>'notas',''))>4000 or coalesce(p_appointment->>'hora','') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Datos de cita inválidos';end if;
 if nullif(trim(p_appointment->>'titulo'),'') is null then raise exception 'La cita necesita un título';end if;
 insert into public.citas(user_id,titulo,fecha,hora,cliente,telefono,prioridad,notas,hecho,details)
 values(v_user,p_appointment->>'titulo',nullif(p_appointment->>'fecha','')::date,coalesce(p_appointment->>'hora',''),coalesce(p_appointment->>'cliente',''),coalesce(p_appointment->>'telefono',''),coalesce(p_appointment->>'prioridad','normal'),coalesce(p_appointment->>'notas',''),false,coalesce(p_appointment->'details','{}'::jsonb))
 returning id into v_appointment_id;
 insert into public.cp_crm_appointment_links(user_id,deal_id,appointment_id,request_id,request_hash) values(v_user,p_deal_id,v_appointment_id,p_request_id,v_hash);
 insert into public.cp_crm_activities(user_id,deal_id,texto) values(v_user,p_deal_id,'Se agendó una cita vinculada');
 return v_appointment_id;
end;
$function$
;
