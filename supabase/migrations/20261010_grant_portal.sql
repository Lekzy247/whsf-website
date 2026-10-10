-- WHSF Grant & Opportunity Portal (phase 1)
-- One table for funding opportunities and UN/global events, a funder directory,
-- a connector registry and a sync log. Imports run in the `opportunity-sync`
-- Edge Function; the public site reads published rows through RLS.

-- Admin check: WHSF main mailbox or an email listed by an existing grants admin.
-- (profiles.role is not used: users can insert their own profile row.)
create table if not exists public.whsf_grant_admins (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.whsf_grant_admins enable row level security;

create or replace function public.whsf_grants_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'info@worldhsfoundation.org'
    or exists (select 1 from public.whsf_grant_admins a
               where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create policy "Grant admins read admin list" on public.whsf_grant_admins
  for select using (public.whsf_grants_is_admin());
create policy "Grant admins manage admin list" on public.whsf_grant_admins
  for all using (public.whsf_grants_is_admin()) with check (public.whsf_grants_is_admin());

-- Connector registry: one row per data source.
create table if not exists public.whsf_opportunity_sources (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('grant', 'event')),
  homepage text not null,
  enabled boolean not null default true,
  auto_publish boolean not null default false,
  notes text not null default '',
  last_run_at timestamptz,
  last_status text not null default 'never'
);
alter table public.whsf_opportunity_sources enable row level security;
create policy "Public reads sources" on public.whsf_opportunity_sources for select using (true);
create policy "Grant admins manage sources" on public.whsf_opportunity_sources
  for update using (public.whsf_grants_is_admin()) with check (public.whsf_grants_is_admin());

insert into public.whsf_opportunity_sources (id, name, kind, homepage, auto_publish, notes) values
  ('manual', 'Added by WHSF', 'grant', 'https://www.worldhsfoundation.org/grants.html', true,
   'Entered and verified by a WHSF admin.'),
  ('grants_gov', 'Grants.gov (US federal)', 'grant', 'https://www.grants.gov/', true,
   'Official US federal opportunities. Open to US-registered nonprofits such as WHSF (501(c)(3)).'),
  ('eu_ft', 'EU Funding & Tenders Portal', 'grant', 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/', false,
   'Official EU calls. Most require an EU-based lead applicant or partner, so each call is reviewed before it is published.'),
  ('indico_un', 'Indico.UN (UN events)', 'event', 'https://indico.un.org/', false,
   'UN meetings and conferences read with the WHSF Indico.UN API token. Reviewed before publishing so only public events appear.')
on conflict (id) do nothing;

-- Funder / donor directory.
create table if not exists public.whsf_funders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  funder_type text not null check (funder_type in
    ('government', 'multilateral', 'foundation', 'corporate', 'platform', 'other')),
  headquarters text not null default '',
  regions text[] not null default '{}',
  sectors text[] not null default '{}',
  website text not null default '',
  funding_page text not null default '',
  summary text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whsf_funders enable row level security;
create policy "Public reads published funders" on public.whsf_funders
  for select using (published or public.whsf_grants_is_admin());
create policy "Grant admins manage funders" on public.whsf_funders
  for all using (public.whsf_grants_is_admin()) with check (public.whsf_grants_is_admin());

-- Opportunities: grants and events.
create table if not exists public.whsf_opportunities (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'grant' check (kind in ('grant', 'event')),
  source text not null references public.whsf_opportunity_sources(id),
  source_id text not null,
  title text not null,
  funder_name text not null default '',
  funder_id uuid references public.whsf_funders(id) on delete set null,
  summary text not null default '',
  url text not null default '',
  -- ISO 3166-1 alpha-2 codes, plus 'GLOBAL' (anyone) and 'EU' (EU member states).
  countries text[] not null default '{GLOBAL}',
  location text not null default '',
  sectors text[] not null default '{}',
  applicant_types text[] not null default '{}',
  amount_min_usd numeric,
  amount_max_usd numeric,
  amount_note text not null default '',
  open_date date,
  deadline date,
  deadline_note text not null default '',
  status text not null default 'open' check (status in ('forecasted', 'open', 'closed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'published', 'hidden')),
  raw jsonb not null default '{}',
  details_fetched_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(funder_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C')
  ) stored,
  unique (source, source_id)
);
create index if not exists whsf_opportunities_search_idx on public.whsf_opportunities using gin (search);
create index if not exists whsf_opportunities_countries_idx on public.whsf_opportunities using gin (countries);
create index if not exists whsf_opportunities_sectors_idx on public.whsf_opportunities using gin (sectors);
create index if not exists whsf_opportunities_deadline_idx on public.whsf_opportunities (kind, review_status, deadline);

alter table public.whsf_opportunities enable row level security;
create policy "Public reads published opportunities" on public.whsf_opportunities
  for select using (review_status = 'published' or public.whsf_grants_is_admin());
create policy "Grant admins manage opportunities" on public.whsf_opportunities
  for all using (public.whsf_grants_is_admin()) with check (public.whsf_grants_is_admin());

-- Sync log.
create table if not exists public.whsf_opportunity_sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  fetched integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  message text not null default ''
);
alter table public.whsf_opportunity_sync_runs enable row level security;
create policy "Grant admins read sync runs" on public.whsf_opportunity_sync_runs
  for select using (public.whsf_grants_is_admin());

-- Ingest: called only by the sync Edge Function (service role). New rows take the
-- source's auto_publish setting; an admin's publish/hide decision is never overwritten.
create or replace function public.whsf_ingest_opportunities(p_source text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto boolean;
  v_kind text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_item jsonb;
  v_was_insert boolean;
begin
  select auto_publish, kind into v_auto, v_kind from public.whsf_opportunity_sources where id = p_source;
  if v_kind is null then
    raise exception 'Unknown source %', p_source;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.whsf_opportunities as o (
      kind, source, source_id, title, funder_name, summary, url, countries, location, sectors,
      applicant_types, amount_min_usd, amount_max_usd, amount_note, open_date, deadline,
      deadline_note, status, review_status, raw, details_fetched_at, last_seen_at
    ) values (
      v_kind, p_source, v_item ->> 'source_id', left(v_item ->> 'title', 400),
      coalesce(v_item ->> 'funder_name', ''), left(coalesce(v_item ->> 'summary', ''), 4000),
      coalesce(v_item ->> 'url', ''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_item -> 'countries') x), '{GLOBAL}'),
      coalesce(v_item ->> 'location', ''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_item -> 'sectors') x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_item -> 'applicant_types') x), '{}'),
      nullif(v_item ->> 'amount_min_usd', '')::numeric, nullif(v_item ->> 'amount_max_usd', '')::numeric,
      coalesce(v_item ->> 'amount_note', ''),
      nullif(v_item ->> 'open_date', '')::date, nullif(v_item ->> 'deadline', '')::date,
      coalesce(v_item ->> 'deadline_note', ''), coalesce(v_item ->> 'status', 'open'),
      case when v_auto then 'published' else 'pending' end,
      coalesce(v_item -> 'raw', '{}'::jsonb),
      case when (v_item ->> 'detailed')::boolean then now() end,
      now()
    )
    on conflict (source, source_id) do update set
      title = excluded.title,
      funder_name = excluded.funder_name,
      summary = case when excluded.summary <> '' then excluded.summary else o.summary end,
      url = excluded.url,
      countries = excluded.countries,
      location = excluded.location,
      sectors = excluded.sectors,
      applicant_types = case when cardinality(excluded.applicant_types) > 0 then excluded.applicant_types else o.applicant_types end,
      amount_min_usd = coalesce(excluded.amount_min_usd, o.amount_min_usd),
      amount_max_usd = coalesce(excluded.amount_max_usd, o.amount_max_usd),
      amount_note = case when excluded.amount_note <> '' then excluded.amount_note else o.amount_note end,
      open_date = excluded.open_date,
      deadline = excluded.deadline,
      deadline_note = excluded.deadline_note,
      status = excluded.status,
      raw = o.raw || excluded.raw,
      details_fetched_at = coalesce(excluded.details_fetched_at, o.details_fetched_at),
      last_seen_at = now(),
      updated_at = now()
    returning (xmax = 0) into v_was_insert;

    if v_was_insert then v_inserted := v_inserted + 1; else v_updated := v_updated + 1; end if;
  end loop;

  -- Anything this source stopped listing more than 3 days ago is treated as closed.
  update public.whsf_opportunities
     set status = 'closed', updated_at = now()
   where source = p_source and status <> 'closed' and last_seen_at < now() - interval '3 days';

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;
revoke all on function public.whsf_ingest_opportunities(text, jsonb) from public, anon, authenticated;

-- Seed: a starter funder directory. Summaries are deliberately general;
-- each entry links to the funder's own site for current priorities and rules.
insert into public.whsf_funders (name, slug, funder_type, headquarters, regions, sectors, website, funding_page, summary) values
  ('Grants.gov (US Federal Government)', 'grants-gov', 'government', 'United States', '{US}', '{education,stem,ict,youth,health,humanitarian}',
   'https://www.grants.gov/', 'https://www.grants.gov/search-grants', 'Single portal for discretionary grants from US federal agencies. WHSF, as a US 501(c)(3), can apply to opportunities open to nonprofits.'),
  ('European Commission – Funding & Tenders', 'eu-funding-tenders', 'government', 'Belgium', '{EU,GLOBAL}', '{education,ict,ai,stem,youth,womens_empowerment,humanitarian}',
   'https://ec.europa.eu/', 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/', 'EU programmes such as Erasmus+, Digital Europe, Horizon Europe and CERV. Many calls need EU-based partners.'),
  ('National Science Foundation (NSF)', 'nsf', 'government', 'United States', '{US}', '{stem,ai,ict,education}',
   'https://www.nsf.gov/', 'https://www.nsf.gov/funding', 'US federal funder for science and engineering research and STEM education.'),
  ('Bill & Melinda Gates Foundation', 'gates-foundation', 'foundation', 'United States', '{GLOBAL}', '{health,education,agriculture,womens_empowerment}',
   'https://www.gatesfoundation.org/', 'https://www.gatesfoundation.org/about/committed-grants', 'Global health, development and US education. Check their site for which programmes accept proposals.'),
  ('Mastercard Foundation', 'mastercard-foundation', 'foundation', 'Canada', '{GLOBAL}', '{education,youth,ict,economic_development}',
   'https://mastercardfdn.org/', 'https://mastercardfdn.org/', 'Youth employment, education and financial inclusion, with a strong focus on Africa.'),
  ('Ford Foundation', 'ford-foundation', 'foundation', 'United States', '{GLOBAL}', '{womens_empowerment,humanitarian,ict}',
   'https://www.fordfoundation.org/', 'https://www.fordfoundation.org/work/our-grants/', 'Social justice, gender and technology & society programmes worldwide.'),
  ('John D. and Catherine T. MacArthur Foundation', 'macarthur-foundation', 'foundation', 'United States', '{GLOBAL}', '{humanitarian,climate,ict}',
   'https://www.macfound.org/', 'https://www.macfound.org/info-grantseekers/', 'Large-scale social change programmes; read their grant-seeker guidance before approaching.'),
  ('Google.org', 'google-org', 'corporate', 'United States', '{GLOBAL}', '{ai,ict,education,humanitarian}',
   'https://www.google.org/', 'https://www.google.org/', 'Google''s philanthropy: AI for social good, digital skills and crisis response. Runs periodic open calls.'),
  ('Microsoft Philanthropies', 'microsoft-philanthropies', 'corporate', 'United States', '{GLOBAL}', '{ai,ict,education,stem}',
   'https://www.microsoft.com/en-us/corporate-responsibility', 'https://www.microsoft.com/en-us/nonprofits', 'Digital skills, AI for Good programmes and nonprofit technology grants and discounts.'),
  ('Cisco Foundation', 'cisco-foundation', 'corporate', 'United States', '{GLOBAL}', '{ict,education,humanitarian}',
   'https://www.cisco.com/c/en/us/about/csr.html', 'https://www.cisco.com/c/en/us/about/csr/community/nonprofits.html', 'Digital inclusion, education and crisis response; also runs the Networking Academy.'),
  ('The William and Flora Hewlett Foundation', 'hewlett-foundation', 'foundation', 'United States', '{GLOBAL}', '{education,womens_empowerment,climate}',
   'https://hewlett.org/', 'https://hewlett.org/grants/', 'Education, gender equity and global development programmes.'),
  ('Malala Fund', 'malala-fund', 'foundation', 'United States', '{GLOBAL}', '{education,womens_empowerment}',
   'https://malala.org/', 'https://malala.org/', 'Girls'' secondary education, working with local education champions in selected countries.'),
  ('Skoll Foundation', 'skoll-foundation', 'foundation', 'United States', '{GLOBAL}', '{economic_development,humanitarian,health}',
   'https://skoll.org/', 'https://skoll.org/about/approach/', 'Backs established social entrepreneurs with proven, scalable impact.'),
  ('Tony Elumelu Foundation', 'tony-elumelu-foundation', 'foundation', 'Nigeria', '{GLOBAL}', '{economic_development,youth,womens_empowerment}',
   'https://www.tonyelumelufoundation.org/', 'https://www.tonyelumelufoundation.org/', 'Seed capital and training for African entrepreneurs through an annual open programme.'),
  ('GlobalGiving', 'globalgiving', 'platform', 'United States', '{GLOBAL}', '{education,humanitarian,womens_empowerment,youth}',
   'https://www.globalgiving.org/', 'https://www.globalgiving.org/nonprofits/', 'Crowdfunding platform for vetted nonprofits worldwide, with periodic matching campaigns.')
on conflict (slug) do nothing;
