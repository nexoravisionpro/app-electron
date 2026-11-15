begin;
do $$
declare owner_id uuid;other_id uuid;employee uuid;deal uuid;q uuid;a uuid;payment uuid;request uuid:=gen_random_uuid();expense uuid;seen integer;
begin
 select id into owner_id from auth.users order by created_at limit 1;
 select id into other_id from auth.users where id<>owner_id limit 1;
 if owner_id is null or other_id is null then raise exception 'Se necesitan dos cuentas para comprobar aislamiento';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 insert into public.empleados(nombre,rol,salario,status,details) values('QA rollback expediente','QA',1000,'activo',jsonb_build_object('department','QA','code','QA-'||gen_random_uuid()::text)) returning id into employee;
 insert into public.cp_staff_events(employee_id,kind,day,note) values(employee,'Asistencia',current_date,'Prueba revertida');
 insert into public.cp_crm_deals(titulo,cliente) values('QA rollback oportunidad','QA') returning id into deal;
 q:=public.cp_crm_create_quote(deal,jsonb_build_object('cliente','QA','concepto','Prueba revertida','monto',220.40,'details',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('description','Servicio QA','qty',2,'price',100)),'discount',10,'tax',16)),gen_random_uuid());
 if not exists(select 1 from public.cotizaciones where id=q and details->>'taxAmount'='30.40') then raise exception 'No se conservó el desglose de la cotización';end if;
 a:=public.cp_crm_create_appointment(deal,jsonb_build_object('titulo','QA rollback cita','fecha',current_date::text,'hora','10:30','details',jsonb_build_object('responsable','QA','duracion',60,'status','confirmada')),gen_random_uuid());
 if not exists(select 1 from public.citas where id=a and details->>'responsable'='QA') then raise exception 'No se conservó el responsable de la cita';end if;
 payment:=public.cp_register_payroll_payment(request,employee,current_date,current_date,current_date,'Transferencia',1000,0,0,'','Prueba revertida');
 if public.cp_register_payroll_payment(request,employee,current_date,current_date,current_date,'Transferencia',1000,0,0,'','Prueba revertida')<>payment then raise exception 'Pago no idempotente';end if;
 select expense_id into expense from public.cp_payroll_records where id=payment;
 begin update public.gastos set monto=1 where id=expense;raise exception using errcode='P0002',message='El gasto vinculado se pudo alterar';exception when sqlstate 'P0001' then null;end;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 select count(*) into seen from public.cp_staff_events where employee_id=employee;
 if seen<>0 then raise exception 'Aislamiento de incidencias falló';end if;
 select count(*) into seen from public.cp_payroll_records where id=payment;
 if seen<>0 then raise exception 'Aislamiento de pagos falló';end if;
 reset role;
end $$;
rollback;
select 'OK: expediente, incidencias, CRM con partidas/decimales, citas, pago único, gasto protegido y aislamiento; datos revertidos' as validation;
