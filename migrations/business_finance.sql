create or replace function cp_private.business_finance(p_action text,p_id uuid,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();a public.cp_finance_accounts%rowtype;p public.cp_finance_payments%rowtype;amount numeric;balance numeric;expense uuid;payment uuid;method text;v_sale text;v_purchase uuid;v_expected numeric;
begin
 if u is null then raise exception 'Se requiere iniciar sesión';end if;
 if p_action='account.create' then
  amount:=(p_data->>'amount')::numeric;
  if nullif(trim(p_data->>'party'),'') is null or nullif(trim(p_data->>'concept'),'') is null or coalesce(p_data->>'kind','') not in ('cobrar','pagar') or amount is null or amount<=0 or amount>999999999999.99 or amount<>round(amount,2) then raise exception 'Revisa nombre, concepto y saldo';end if;
  v_sale:=nullif(p_data->>'sale_id','');v_purchase:=nullif(p_data->>'purchase_id','')::uuid;
  if v_sale is not null then
   if p_data->>'kind'<>'cobrar' then raise exception 'La venta corresponde a una cuenta por cobrar';end if;
   select greatest(0,total-refunded_total) into v_expected from public.cp_sales where id=v_sale and user_id=u and status in ('completed','partially_refunded') for update;
   if not found or amount>v_expected then raise exception 'La venta no está disponible o el saldo supera su importe neto';end if;
  end if;
  if v_purchase is not null then
   if p_data->>'kind'<>'pagar' then raise exception 'La compra corresponde a una cuenta por pagar';end if;
   select total into v_expected from public.cp_purchase_orders where id=v_purchase and user_id=u and status='recibida' for update;
   if not found or amount<>v_expected then raise exception 'Recibe la compra y utiliza su importe completo';end if;
  end if;
  if v_sale is not null and v_purchase is not null then raise exception 'Selecciona una sola referencia';end if;
  insert into public.cp_finance_accounts(id,user_id,kind,party,phone,concept,reference,amount,due_on,sale_id,purchase_id,expense_category)values(p_id,u,p_data->>'kind',trim(p_data->>'party'),coalesce(p_data->>'phone',''),trim(p_data->>'concept'),coalesce(p_data->>'reference',''),amount,(p_data->>'due_on')::date,v_sale,v_purchase,coalesce(nullif(p_data->>'expense_category',''),case when v_purchase is not null then 'Compras' else 'Otro' end));
 elsif p_action in ('account.pay','account.cancel') then
  select * into a from public.cp_finance_accounts where id=p_id and user_id=u for update;
  if not found or a.status<>'abierta' then raise exception 'Cuenta no disponible';end if;
  select a.amount-coalesce(sum(pay.amount)filter(where not pay.voided),0) into balance from public.cp_finance_payments pay where pay.account_id=a.id and pay.user_id=u;
  if p_action='account.cancel' then
   if balance<>a.amount then raise exception 'Anula primero los abonos registrados';end if;
   update public.cp_finance_accounts set status='cancelada',revision=revision+1 where id=a.id and user_id=u;
  else
   amount:=(p_data->>'amount')::numeric;method:=p_data->>'method';
   if amount is null or amount<=0 or amount<>round(amount,2) or amount>balance or coalesce(method,'') not in ('Efectivo','Transferencia','Tarjeta','Depósito','Otro') or (p_data->>'paid_on')::date>current_date then raise exception 'Importe, fecha o método de abono inválido; revisa el saldo';end if;
   if a.kind='pagar' then
    insert into public.gastos(user_id,descripcion,categoria,monto,proveedor,fecha,notas,details)values(u,'Pago de cuenta: '||a.concept,a.expense_category,amount,a.party,(p_data->>'paid_on')::date,'Cuenta: '||a.id::text||' · '||coalesce(p_data->>'reference',''),jsonb_build_object('paymentStatus','Pagado','method',method,'paidOn',p_data->>'paid_on','reference',coalesce(p_data->>'reference',''),'financeAccount',a.id))returning id into expense;
   end if;
   insert into public.cp_finance_payments(user_id,account_id,amount,paid_on,method,reference,expense_id)values(u,a.id,amount,(p_data->>'paid_on')::date,method,coalesce(p_data->>'reference',''),expense)returning id into payment;
   update public.cp_finance_accounts set revision=revision+1 where id=a.id and user_id=u;
   return jsonb_build_object('id',a.id,'payment_id',payment,'balance',balance-amount,'expense_id',expense);
  end if;
 elsif p_action='payment.void' then
  select * into p from public.cp_finance_payments where id=p_id and user_id=u;
  if not found or p.voided or nullif(trim(p_data->>'reason'),'') is null then raise exception 'Abono no disponible o falta el motivo';end if;
  perform 1 from public.cp_finance_accounts where id=p.account_id and user_id=u for update;
  select * into p from public.cp_finance_payments where id=p_id and user_id=u for update;
  if p.voided then raise exception 'El abono ya se anuló';end if;
  update public.cp_finance_payments set voided=true,void_reason=trim(p_data->>'reason'),voided_at=now() where id=p.id and user_id=u;
  if p.expense_id is not null then delete from public.gastos where id=p.expense_id and user_id=u;end if;
  update public.cp_finance_accounts set revision=revision+1 where id=p.account_id and user_id=u;
  return jsonb_build_object('id',p.account_id,'payment_id',p.id,'voided',true);
 else raise exception 'Acción financiera no disponible';end if;
 return jsonb_build_object('id',p_id);
end $$;
revoke all on function cp_private.business_finance(text,uuid,jsonb) from public,anon,authenticated;
create function cp_private.protect_finance_expense()returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.cp_finance_payments where expense_id=old.id and not voided)then raise exception 'Este gasto pertenece a un abono. Corrígelo desde Cuentas por pagar';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function cp_private.protect_finance_expense()from public,anon,authenticated;
create trigger cp_finance_expense_guard before update or delete on public.gastos for each row execute function cp_private.protect_finance_expense();
