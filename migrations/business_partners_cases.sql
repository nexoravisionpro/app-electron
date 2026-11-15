create or replace function cp_private.business_partner_case(p_action text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();r integer;s public.cp_business_suppliers%rowtype;c public.cp_service_cases%rowtype;v_sale text;v_customer text;v_status text;
begin
 if u is null or p_id is null then raise exception 'Sesión o referencia inválida';end if;
 if p_action='supplier.save' then
  if nullif(trim(p_data->>'name'),'') is null or length(p_data->>'name')>200 or length(coalesce(p_data->>'notes',''))>4000 or length(coalesce(p_data->>'email',''))>200 or length(coalesce(p_data->>'phone',''))>40 then raise exception 'Revisa los datos del proveedor';end if;
  select * into s from public.cp_business_suppliers where id=p_id and user_id=u for update;
  if found then
   if s.revision is distinct from (p_data->>'revision')::integer then raise exception 'El proveedor cambió. Actualiza la lista';end if;
   update public.cp_business_suppliers set name=trim(p_data->>'name'),contact=coalesce(p_data->>'contact',''),phone=coalesce(p_data->>'phone',''),email=coalesce(p_data->>'email',''),rfc=coalesce(p_data->>'rfc',''),address=coalesce(p_data->>'address',''),terms=coalesce(p_data->>'terms',''),notes=coalesce(p_data->>'notes',''),active=coalesce((p_data->>'active')::boolean,true),revision=revision+1,updated_at=now() where id=p_id and user_id=u;
  else
   if p_data ? 'revision' and p_data->>'revision' is not null then raise exception 'El proveedor ya no está disponible';end if;
   insert into public.cp_business_suppliers(id,user_id,name,contact,phone,email,rfc,address,terms,notes,active) values(p_id,u,trim(p_data->>'name'),coalesce(p_data->>'contact',''),coalesce(p_data->>'phone',''),coalesce(p_data->>'email',''),coalesce(p_data->>'rfc',''),coalesce(p_data->>'address',''),coalesce(p_data->>'terms',''),coalesce(p_data->>'notes',''),coalesce((p_data->>'active')::boolean,true));
  end if;
 elsif p_action='case.save' then
  if nullif(trim(p_data->>'subject'),'') is null or nullif(trim(p_data->>'customer'),'') is null or length(p_data->>'subject')>200 or length(p_data->>'customer')>200 or length(coalesce(p_data->>'description',''))>4000 or length(coalesce(p_data->>'resolution',''))>4000 or coalesce(p_data->>'priority','normal') not in ('normal','alta','urgente') or coalesce(p_data->>'status','abierto') not in ('abierto','en proceso','en espera','resuelto') then raise exception 'Revisa los datos del caso';end if;
  v_status:=coalesce(p_data->>'status','abierto');v_sale:=nullif(p_data->>'sale_id','');v_customer:=trim(p_data->>'customer');
  if v_sale is not null and not exists(select 1 from public.cp_sales where id=v_sale and user_id=u) then raise exception 'Venta no disponible';end if;
  if v_status='resuelto' and nullif(trim(p_data->>'resolution'),'') is null then raise exception 'Describe la solución antes de resolver';end if;
  select * into c from public.cp_service_cases where id=p_id and user_id=u for update;
  if found then
   if c.revision is distinct from (p_data->>'revision')::integer then raise exception 'El caso cambió. Actualiza antes de editar';end if;
   update public.cp_service_cases set subject=trim(p_data->>'subject'),customer=v_customer,phone=coalesce(p_data->>'phone',''),sale_id=v_sale,category=coalesce(p_data->>'category','Soporte'),priority=coalesce(p_data->>'priority','normal'),status=v_status,owner_name=coalesce(p_data->>'owner_name',''),due_on=nullif(p_data->>'due_on','')::date,description=coalesce(p_data->>'description',''),resolution=coalesce(p_data->>'resolution',''),resolved_at=case when v_status='resuelto' then coalesce(c.resolved_at,now()) end,revision=revision+1,updated_at=now() where id=p_id and user_id=u;
   insert into public.cp_case_events(user_id,case_id,message)values(u,p_id,'Caso actualizado: '||v_status);
  else
   if p_data->>'revision' is not null then raise exception 'El caso ya no está disponible';end if;
   insert into public.cp_service_cases(id,user_id,subject,customer,phone,sale_id,category,priority,status,owner_name,due_on,description,resolution,resolved_at)values(p_id,u,trim(p_data->>'subject'),v_customer,coalesce(p_data->>'phone',''),v_sale,coalesce(p_data->>'category','Soporte'),coalesce(p_data->>'priority','normal'),v_status,coalesce(p_data->>'owner_name',''),nullif(p_data->>'due_on','')::date,coalesce(p_data->>'description',''),coalesce(p_data->>'resolution',''),case when v_status='resuelto' then now() end);
   insert into public.cp_case_events(user_id,case_id,message)values(u,p_id,'Caso abierto');
  end if;
 elsif p_action='case.comment' then
  if nullif(trim(p_data->>'message'),'') is null or length(p_data->>'message')>4000 or not exists(select 1 from public.cp_service_cases where id=p_id and user_id=u) then raise exception 'Caso o comentario inválido';end if;
  insert into public.cp_case_events(user_id,case_id,message)values(u,p_id,trim(p_data->>'message'));
 elsif p_action='goal.save' then
  if (p_data->>'sales_goal')::numeric<0 or (p_data->>'expense_budget')::numeric<0 or (p_data->>'sales_goal')::numeric>999999999999.99 or (p_data->>'expense_budget')::numeric>999999999999.99 or (p_data->>'sales_goal')::numeric<>round((p_data->>'sales_goal')::numeric,2) or (p_data->>'expense_budget')::numeric<>round((p_data->>'expense_budget')::numeric,2) then raise exception 'Revisa los objetivos';end if;
  insert into public.cp_business_goals(id,user_id,month,sales_goal,expense_budget,notes)values(p_id,u,(p_data->>'month')::date,(p_data->>'sales_goal')::numeric,(p_data->>'expense_budget')::numeric,coalesce(p_data->>'notes','')) on conflict(user_id,month) do update set sales_goal=excluded.sales_goal,expense_budget=excluded.expense_budget,notes=excluded.notes,updated_at=now() returning id into p_id;
 else raise exception 'Acción no disponible';end if;
 return jsonb_build_object('id',p_id);
end $$;
revoke all on function cp_private.business_partner_case(text,uuid,jsonb) from public,anon,authenticated;
