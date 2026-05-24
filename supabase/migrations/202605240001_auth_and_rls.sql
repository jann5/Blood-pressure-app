-- Supabase schema and security for blood pressure readings

create extension if not exists pgcrypto;

create table if not exists public.blood_pressure_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  systolic integer not null check (systolic between 60 and 280),
  diastolic integer not null check (diastolic between 30 and 180),
  pulse integer not null check (pulse between 30 and 240),
  note text,
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_blood_pressure_metadata()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.user_id := auth.uid();
    end if;

    if new.created_at is null then
      new.created_at := now();
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_blood_pressure_metadata on public.blood_pressure_readings;

create trigger trg_set_blood_pressure_metadata
before insert or update on public.blood_pressure_readings
for each row
execute function public.set_blood_pressure_metadata();

-- Enable RLS on all public tables
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.schemaname, table_record.tablename);
  END LOOP;
END
$$;

alter table public.blood_pressure_readings force row level security;

drop policy if exists "read own readings" on public.blood_pressure_readings;
drop policy if exists "insert own readings" on public.blood_pressure_readings;
drop policy if exists "update own readings" on public.blood_pressure_readings;
drop policy if exists "delete own readings" on public.blood_pressure_readings;

create policy "read own readings"
on public.blood_pressure_readings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "insert own readings"
on public.blood_pressure_readings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "update own readings"
on public.blood_pressure_readings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "delete own readings"
on public.blood_pressure_readings
for delete
to authenticated
using ((select auth.uid()) = user_id);
