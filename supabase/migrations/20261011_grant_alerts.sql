-- WHSF Grant Portal phase 3: deadline reminders and weekly new-match emails.
-- Sent by the `grant-alerts` Edge Function to organisations with alerts_opt_in = true.

-- Secret per organisation for one-click unsubscribe links (no sign-in needed).
alter table public.whsf_grant_orgs
  add column if not exists alerts_token uuid not null default gen_random_uuid();
create unique index if not exists whsf_grant_orgs_alerts_token_idx on public.whsf_grant_orgs (alerts_token);

-- One row per email sent, so nothing is sent twice.
-- kind: deadline_30 | deadline_14 | deadline_3 | weekly (opportunity_id null, period = ISO week).
create table if not exists public.whsf_grant_alert_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.whsf_grant_orgs(id) on delete cascade,
  kind text not null check (kind in ('deadline_30', 'deadline_14', 'deadline_3', 'weekly')),
  opportunity_id uuid references public.whsf_opportunities(id) on delete cascade,
  period text not null default '',
  email_id text not null default '',
  sent_at timestamptz not null default now()
);
create unique index if not exists whsf_grant_alert_log_once_idx
  on public.whsf_grant_alert_log (org_id, kind, coalesce(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid), period);
alter table public.whsf_grant_alert_log enable row level security;
create policy "Owners read their alert log" on public.whsf_grant_alert_log
  for select using (exists (select 1 from public.whsf_grant_orgs o where o.id = org_id and o.owner_id = auth.uid()));
create policy "Grant admins read alert log" on public.whsf_grant_alert_log
  for select using (public.whsf_grants_is_admin());
