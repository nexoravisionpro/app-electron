create table public.cp_staff_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 employee_id uuid not null references public.empleados(id) on delete restrict,
 kind text not null check(kind in ('Asistencia','Falta','Retardo','Vacaciones','Permiso','Incapacidad')),
 day date not null,
 minutes integer not null default 0 check(minutes between 0 and 1440),
 note text not null default '' check(length(note)<=1000),
 created_at timestamptz not null default now(),
 unique(user_id,employee_id,day,kind)
);
alter table public.cp_staff_events enable row level security;
revoke all on public.cp_staff_events from public,anon,authenticated;
grant select,insert,delete on public.cp_staff_events to authenticated;
create policy cp_staff_events_select on public.cp_staff_events for select to authenticated using(user_id=(select auth.uid()));
create policy cp_staff_events_insert on public.cp_staff_events for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.empleados e where e.id=employee_id and e.user_id=(select auth.uid())));
create policy cp_staff_events_delete on public.cp_staff_events for delete to authenticated using(user_id=(select auth.uid()));
create index cp_staff_events_employee_day_idx on public.cp_staff_events(user_id,employee_id,day desc);
