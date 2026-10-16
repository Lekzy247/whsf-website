-- Private archive of records WHSF removes for safety reasons, so a removal can be undone if the person proves
-- they are genuine. No policies: readable only by admins (SQL editor / service role).
-- First use 2026-10-16: a grants-portal organisation removed after due diligence (owner request).

create table if not exists public.whsf_removed_records (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  record jsonb not null,
  reason text not null,
  removed_at timestamptz not null default now()
);
alter table public.whsf_removed_records enable row level security;
revoke all on public.whsf_removed_records from anon, authenticated;
