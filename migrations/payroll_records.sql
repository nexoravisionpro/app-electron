-- Registro administrativo de pagos; no calcula impuestos ni emite CFDI de nómina.
create table public.cp_payroll_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  employee_id uuid not null references public.empleados(id) on delete restrict,
  expense_id uuid not null references public.gastos(id) on delete restrict,
  request_id uuid not null,
  period_start date not null,
  period_end date not null,
  paid_on date not null,
  method text not null check (method in ('Transferencia','Efectivo','Depósito')),
  salary numeric(14,2) not null check (salary >= 0),
  bonus numeric(14,2) not null check (bonus >= 0),
  deduction numeric(14,2) not null check (deduction >= 0),
  deduction_reason text not null default '',
  notes text not null default '',
  net numeric(14,2) not null check (net > 0 and net = salary + bonus - deduction),
  created_at timestamptz not null default now(),
  check (period_start <= period_end),
  unique (user_id,request_id),
  unique (user_id,employee_id,period_start,period_end),
  unique (expense_id)
);
create index cp_payroll_employee_history_idx on public.cp_payroll_records(user_id,employee_id,paid_on desc);
alter table public.cp_payroll_records enable row level security;
revoke all on public.cp_payroll_records from public, anon, authenticated;
grant select on public.cp_payroll_records to authenticated;
create policy cp_payroll_select_own on public.cp_payroll_records for select to authenticated using (user_id = (select auth.uid()));

create schema if not exists cp_private;
revoke all on schema cp_private from public, anon;
grant usage on schema cp_private to authenticated;

-- Los triggers por fila no se ejecutan con TRUNCATE; se retira ese permiso.
revoke truncate on public.gastos from public, anon, authenticated;

-- Impide que gastos ya vinculados se alteren por otras pantallas o clientes.
-- La cancelación y corrección auditadas requieren un flujo independiente.
create function cp_private.protect_payroll_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.cp_payroll_records where expense_id = old.id) then
    raise exception 'El gasto está vinculado a un pago de personal y no puede modificarse directamente';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function cp_private.protect_payroll_expense() from public, anon, authenticated;
create trigger cp_protect_payroll_expense before update or delete on public.gastos
for each row execute function cp_private.protect_payroll_expense();

create function cp_private.register_payroll_payment(
  p_request_id uuid, p_employee_id uuid, p_period_start date, p_period_end date,
  p_paid_on date, p_method text, p_salary numeric, p_bonus numeric,
  p_deduction numeric, p_deduction_reason text, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_employee public.empleados%rowtype;
  v_existing public.cp_payroll_records%rowtype;
  v_expense uuid;
  v_payment uuid;
  v_reason text := coalesce(trim(p_deduction_reason),'');
  v_notes text := coalesce(trim(p_notes),'');
  v_net numeric;
begin
  if v_user is null then raise exception 'Se requiere una sesión'; end if;
  if p_request_id is null or p_employee_id is null or p_period_start is null or p_period_end is null or p_paid_on is null
     or p_period_start > p_period_end or p_method is null or p_method not in ('Transferencia','Efectivo','Depósito')
     or p_salary is null or p_bonus is null or p_deduction is null
     or p_salary < 0 or p_bonus < 0 or p_deduction < 0
     or p_salary <> round(p_salary,2) or p_bonus <> round(p_bonus,2) or p_deduction <> round(p_deduction,2)
     or p_salary > 999999999999.99 or p_bonus > 999999999999.99 or p_deduction > 999999999999.99
     or length(v_reason) > 500 or length(v_notes) > 2000 then
    raise exception 'Datos de pago inválidos';
  end if;
  v_net := p_salary + p_bonus - p_deduction;
  if v_net <= 0 or v_net > 999999999999.99 then raise exception 'El total debe ser positivo y válido'; end if;
  -- Serializa reintentos del mismo usuario y solicitud, incluso entre dispositivos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_request_id::text, 0));
  select * into v_existing from public.cp_payroll_records where user_id = v_user and request_id = p_request_id;
  if found then
    if (v_existing.employee_id,v_existing.period_start,v_existing.period_end,v_existing.paid_on,v_existing.method,v_existing.salary,v_existing.bonus,v_existing.deduction,v_existing.deduction_reason,v_existing.notes)
       is distinct from (p_employee_id,p_period_start,p_period_end,p_paid_on,p_method,p_salary,p_bonus,p_deduction,v_reason,v_notes) then
      raise exception 'La solicitud ya fue utilizada con otros datos';
    end if;
    return v_existing.id;
  end if;
  select * into v_employee from public.empleados where id = p_employee_id and user_id = v_user for update;
  if not found or v_employee.status is distinct from 'activo' then raise exception 'Empleado activo no encontrado'; end if;
  if exists (select 1 from public.cp_payroll_records where user_id = v_user and employee_id = p_employee_id
             and period_start <= p_period_end and period_end >= p_period_start) then
    raise exception 'Ya existe un pago para un periodo que se cruza con este';
  end if;
  insert into public.gastos(user_id,descripcion,categoria,monto,proveedor,fecha,notas,details)
    values (v_user,'Nómina - ' || v_employee.nombre,'Nomina',v_net,v_employee.nombre,p_paid_on,
      'Periodo: ' || p_period_start::text || ' a ' || p_period_end::text || ' · Método: ' || p_method ||
      ' · Salario: ' || p_salary::text || ' · Bono: ' || p_bonus::text || ' · Deducción: ' || p_deduction::text ||
      case when v_reason <> '' then ' (' || v_reason || ')' else '' end || case when v_notes <> '' then ' · ' || v_notes else '' end, jsonb_build_object('paymentStatus','Pagado','paidOn',p_paid_on::text,'method',p_method))
    returning id into v_expense;
  insert into public.cp_payroll_records(user_id,employee_id,expense_id,request_id,period_start,period_end,paid_on,method,salary,bonus,deduction,deduction_reason,notes,net)
    values(v_user,p_employee_id,v_expense,p_request_id,p_period_start,p_period_end,p_paid_on,p_method,p_salary,p_bonus,p_deduction,v_reason,v_notes,v_net)
    returning id into v_payment;
  return v_payment;
end $$;
revoke all on function cp_private.register_payroll_payment(uuid,uuid,date,date,date,text,numeric,numeric,numeric,text,text) from public, anon;
grant execute on function cp_private.register_payroll_payment(uuid,uuid,date,date,date,text,numeric,numeric,numeric,text,text) to authenticated;
create function public.cp_register_payroll_payment(
  p_request_id uuid, p_employee_id uuid, p_period_start date, p_period_end date,
  p_paid_on date, p_method text, p_salary numeric, p_bonus numeric,
  p_deduction numeric, p_deduction_reason text, p_notes text
) returns uuid language sql security invoker set search_path = '' as $$
  select cp_private.register_payroll_payment(p_request_id,p_employee_id,p_period_start,p_period_end,
    p_paid_on,p_method,p_salary,p_bonus,p_deduction,p_deduction_reason,p_notes)
$$;
revoke all on function public.cp_register_payroll_payment(uuid,uuid,date,date,date,text,numeric,numeric,numeric,text,text) from public, anon;
grant execute on function public.cp_register_payroll_payment(uuid,uuid,date,date,date,text,numeric,numeric,numeric,text,text) to authenticated;
-- Pagos históricos de gastos no se asocian automáticamente: el nombre no identifica a una persona de forma fiable.
-- Pendientes: control de permisos individuales en servidor y anulación auditada.
