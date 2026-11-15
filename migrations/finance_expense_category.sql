alter table public.cp_finance_accounts add column expense_category text not null default 'Otro' check(expense_category in ('Compras','Renta','Servicios','Marketing','Transporte','Equipo','Otro'));
