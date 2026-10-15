-- WHSF Forum Career Center: jobs from partner job boards (owner request 2026-10-15: jobs open to people in African
-- countries + remote jobs abroad, refreshed daily, searchable in the Forum).
-- Sources: Himalayas (himalayas.app public API) and Jobicy (jobicy.com public API). Their terms: credit the source,
-- always apply through the link they supply, remove expired listings, never pass the jobs on to other job boards or
-- job search engines (so no JobPosting structured data for these). Members read them; nobody writes them except the
-- daily sync (api/jobs-sync.js), which calls forum_partner_jobs_ingest with a secret whose SHA-256 hash is stored in
-- forum_job_sync_keys (the secret itself lives only in Vercel as JOBS_INGEST_SECRET).

create table if not exists public.forum_partner_jobs (
  id text primary key,                                  -- '<source>:<source job url>'
  source text not null check (source in ('himalayas', 'jobicy')),
  title text not null check (char_length(title) between 2 and 200),
  company text check (char_length(company) <= 160),
  company_logo text check (company_logo is null or company_logo ~ '^https://'),
  url text not null check (url ~ '^https://'),          -- the source's own job page / apply link
  location_restrictions text[] not null default '{}',   -- as given by the source
  match_countries text[] not null default '{}',         -- African countries we found the job under
  worldwide boolean not null default false,             -- open to applicants anywhere
  employment_type text check (char_length(employment_type) <= 40),
  seniority text check (char_length(seniority) <= 60),
  category text check (char_length(category) <= 80),
  excerpt text check (char_length(excerpt) <= 600),
  salary_min numeric, salary_max numeric,
  currency text check (char_length(currency) <= 8),
  salary_period text check (char_length(salary_period) <= 20),
  published_at timestamptz,
  expires_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists forum_partner_jobs_pub on public.forum_partner_jobs (published_at desc);
create index if not exists forum_partner_jobs_countries on public.forum_partner_jobs using gin (match_countries);
create index if not exists forum_partner_jobs_world on public.forum_partner_jobs (worldwide, published_at desc);

alter table public.forum_partner_jobs enable row level security;
drop policy if exists "Members read partner jobs" on public.forum_partner_jobs;
create policy "Members read partner jobs" on public.forum_partner_jobs for select
  using ((public.forum_is_member() or public.forum_is_staff()) and (expires_at is null or expires_at > now()));
revoke insert, update, delete on public.forum_partner_jobs from anon, authenticated;

-- Hash of the sync secret. No policies: only the security-definer functions below can read it.
create table if not exists public.forum_job_sync_keys (key_hash text primary key, created_at timestamptz not null default now());
alter table public.forum_job_sync_keys enable row level security;
revoke all on public.forum_job_sync_keys from anon, authenticated;

create or replace function public.forum_job_sync_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(char_length(p_secret) >= 32, false)
     and exists (select 1 from public.forum_job_sync_keys k where k.key_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'));
$$;
revoke all on function public.forum_job_sync_ok(text) from public, anon, authenticated;

-- Upsert a batch from the daily sync. match_countries is merged, never shrunk, so a job found under several
-- countries keeps them all. Returns how many rows were written.
create or replace function public.forum_partner_jobs_ingest(p_secret text, p_jobs jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) > 1000 then raise exception 'bad batch'; end if;
  insert into public.forum_partner_jobs as t (id, source, title, company, company_logo, url, location_restrictions,
    match_countries, worldwide, employment_type, seniority, category, excerpt, salary_min, salary_max, currency,
    salary_period, published_at, expires_at, last_seen_at)
  select j->>'id', j->>'source', left(j->>'title', 200), left(j->>'company', 160),
         case when j->>'company_logo' ~ '^https://' then left(j->>'company_logo', 500) end,
         j->>'url',
         coalesce((select array_agg(left(x, 60)) from jsonb_array_elements_text(j->'location_restrictions') x), '{}'),
         coalesce((select array_agg(left(x, 60)) from jsonb_array_elements_text(j->'match_countries') x), '{}'),
         coalesce((j->>'worldwide')::boolean, false),
         left(j->>'employment_type', 40), left(j->>'seniority', 60), left(j->>'category', 80), left(j->>'excerpt', 600),
         nullif(j->>'salary_min', '')::numeric, nullif(j->>'salary_max', '')::numeric,
         left(j->>'currency', 8), left(j->>'salary_period', 20),
         nullif(j->>'published_at', '')::timestamptz, nullif(j->>'expires_at', '')::timestamptz, now()
  from jsonb_array_elements(p_jobs) j
  where j->>'url' ~ '^https://' and char_length(coalesce(j->>'title', '')) >= 2
    and j->>'source' in ('himalayas', 'jobicy') and j->>'id' like (j->>'source') || ':%'
  on conflict (id) do update set
    title = excluded.title, company = excluded.company, company_logo = excluded.company_logo, url = excluded.url,
    location_restrictions = excluded.location_restrictions,
    match_countries = (select coalesce(array_agg(distinct c), '{}') from unnest(t.match_countries || excluded.match_countries) c),
    worldwide = t.worldwide or excluded.worldwide,
    employment_type = excluded.employment_type, seniority = excluded.seniority, category = excluded.category,
    excerpt = excluded.excerpt, salary_min = excluded.salary_min, salary_max = excluded.salary_max,
    currency = excluded.currency, salary_period = excluded.salary_period,
    published_at = excluded.published_at, expires_at = excluded.expires_at, last_seen_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.forum_partner_jobs_ingest(text, jsonb) from public;
grant execute on function public.forum_partner_jobs_ingest(text, jsonb) to anon, authenticated;

-- Remove expired listings (source expiry date passed, or not seen by the sync for 21 days).
create or replace function public.forum_partner_jobs_cleanup(p_secret text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.forum_partner_jobs where expires_at < now() or last_seen_at < now() - interval '21 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.forum_partner_jobs_cleanup(text) from public;
grant execute on function public.forum_partner_jobs_cleanup(text) to anon, authenticated;

-- Country chips: how many open jobs each African country has, plus worldwide and "new in the last 24 hours".
create or replace function public.forum_partner_job_counts()
returns table (country text, jobs bigint, new_today bigint)
language sql stable security definer set search_path = public as $$
  select c, count(*), count(*) filter (where j.first_seen_at > now() - interval '24 hours')
  from public.forum_partner_jobs j, unnest(j.match_countries) c
  where (public.forum_is_member() or public.forum_is_staff()) and (j.expires_at is null or j.expires_at > now())
  group by c
  union all
  select '__worldwide__', count(*), count(*) filter (where j.first_seen_at > now() - interval '24 hours')
  from public.forum_partner_jobs j
  where (public.forum_is_member() or public.forum_is_staff()) and j.worldwide and (j.expires_at is null or j.expires_at > now());
$$;
revoke all on function public.forum_partner_job_counts() from public, anon;
grant execute on function public.forum_partner_job_counts() to authenticated;

-- Jobs open to only a few countries (e.g. "Nigeria") sort before jobs open to dozens of countries.
alter table public.forum_partner_jobs
  add column if not exists restriction_count integer generated always as (cardinality(location_restrictions)) stored;
create index if not exists forum_partner_jobs_focus on public.forum_partner_jobs (restriction_count, published_at desc);
