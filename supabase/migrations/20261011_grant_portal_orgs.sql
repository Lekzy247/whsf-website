-- WHSF Grant Portal phase 2: registered organisations and their grant tracker.
-- Profiles are private to their owner (and WHSF grants admins). Matching and the
-- eligibility checklist run in the browser from the profile + published grants.

create table if not exists public.whsf_grant_orgs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 200),
  org_type text not null check (org_type in
    ('nonprofit', 'us_nonprofit', 'school', 'university', 'business', 'individual', 'government')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  operating_countries text[] not null default '{}',
  sectors text[] not null default '{}',
  annual_budget_usd numeric check (annual_budget_usd is null or annual_budget_usd >= 0),
  founded_year integer check (founded_year is null or founded_year between 1800 and 2100),
  website text not null default '',
  description text not null default '' check (char_length(description) <= 2000),
  -- Registrations funders commonly require.
  has_us_501c3 boolean not null default false,
  has_sam_uei boolean not null default false,
  has_eu_pic boolean not null default false,
  can_partner_eu boolean not null default false,
  alerts_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whsf_grant_orgs enable row level security;
create policy "Owners manage their organisation" on public.whsf_grant_orgs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Grant admins read organisations" on public.whsf_grant_orgs
  for select using (public.whsf_grants_is_admin());

create table if not exists public.whsf_grant_saved (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.whsf_grant_orgs(id) on delete cascade,
  opportunity_id uuid not null references public.whsf_opportunities(id) on delete cascade,
  status text not null default 'interested' check (status in
    ('interested', 'preparing', 'submitted', 'awarded', 'declined', 'not_eligible')),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, opportunity_id)
);
create index if not exists whsf_grant_saved_org_idx on public.whsf_grant_saved (org_id);
alter table public.whsf_grant_saved enable row level security;
create policy "Owners manage their saved grants" on public.whsf_grant_saved
  for all using (exists (select 1 from public.whsf_grant_orgs o where o.id = org_id and o.owner_id = auth.uid()))
  with check (exists (select 1 from public.whsf_grant_orgs o where o.id = org_id and o.owner_id = auth.uid()));
create policy "Grant admins read saved grants" on public.whsf_grant_saved
  for select using (public.whsf_grants_is_admin());
