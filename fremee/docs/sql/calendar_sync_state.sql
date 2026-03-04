create table if not exists public.calendar_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_started_at timestamptz null,
  last_finished_at timestamptz null,
  last_status text not null default 'IDLE' check (last_status in ('IDLE', 'RUNNING', 'SUCCESS', 'ERROR')),
  last_error text null,
  sync_enabled_snapshot boolean not null default false,
  export_plans_snapshot boolean not null default true,
  last_imported_count integer not null default 0,
  last_exported_count integer not null default 0,
  last_calendars_count integer not null default 0
);

create or replace function public.fn_calendar_sync_state_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_calendar_sync_state_set_updated_at on public.calendar_sync_state;
create trigger trg_calendar_sync_state_set_updated_at
before update on public.calendar_sync_state
for each row
execute procedure public.fn_calendar_sync_state_set_updated_at();

alter table public.calendar_sync_state enable row level security;

drop policy if exists calendar_sync_state_select_own on public.calendar_sync_state;
create policy calendar_sync_state_select_own
on public.calendar_sync_state
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists calendar_sync_state_insert_own on public.calendar_sync_state;
create policy calendar_sync_state_insert_own
on public.calendar_sync_state
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists calendar_sync_state_update_own on public.calendar_sync_state;
create policy calendar_sync_state_update_own
on public.calendar_sync_state
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists idx_calendar_sync_state_status on public.calendar_sync_state(last_status);
