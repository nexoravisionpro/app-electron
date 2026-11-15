create function cp_private.business_command(p_request_id uuid,p_action text,p_entity_id uuid,p_data jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();fingerprint text;previous public.cp_business_requests%rowtype;result jsonb;
begin
 if u is null or p_request_id is null or p_entity_id is null or jsonb_typeof(p_data)is distinct from 'object' or octet_length(p_data::text)>200000 or (p_data->>'expected_user')::uuid is distinct from u then raise exception 'Sesión, referencia o datos inválidos';end if;
 fingerprint:=md5(jsonb_build_object('action',p_action,'id',p_entity_id,'data',p_data)::text);
 perform pg_advisory_xact_lock(hashtextextended(u::text||':business:'||p_request_id::text,0));
 select * into previous from public.cp_business_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.payload_hash<>fingerprint then raise exception 'La referencia de operación ya se usó con otros datos';end if;
  return previous.result;
 end if;
 if p_action in ('supplier.save','case.save','case.comment','goal.save')then result:=cp_private.business_partner_case(p_action,p_entity_id,p_data);
 elsif p_action in ('purchase.save','purchase.order','purchase.cancel','purchase.receive')then result:=cp_private.business_purchase(p_action,p_entity_id,p_data);
 elsif p_action in ('account.create','account.pay','account.cancel','payment.void')then result:=cp_private.business_finance(p_action,p_entity_id,p_data);
 else raise exception 'Acción no disponible';end if;
 insert into public.cp_business_requests(user_id,request_id,payload_hash,result)values(u,p_request_id,fingerprint,result);
 insert into public.cp_business_events(user_id,action,entity_id,summary)values(u,p_action,p_entity_id,coalesce(p_data->>'actor','Cuenta del negocio')||' · '||p_action||case when nullif(trim(p_data->>'reason'),'')is not null then ' · '||left(p_data->>'reason',1000)else ''end);
 return result;
end $$;
revoke all on function cp_private.business_command(uuid,text,uuid,jsonb)from public,anon;
grant execute on function cp_private.business_command(uuid,text,uuid,jsonb)to authenticated;
create function public.cp_business_manage(p_request_id uuid,p_action text,p_entity_id uuid,p_data jsonb)returns jsonb language sql security invoker set search_path='' as $$select cp_private.business_command(p_request_id,p_action,p_entity_id,p_data)$$;
revoke all on function public.cp_business_manage(uuid,text,uuid,jsonb)from public,anon;
grant execute on function public.cp_business_manage(uuid,text,uuid,jsonb)to authenticated;
