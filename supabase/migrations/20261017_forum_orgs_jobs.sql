-- WHSF Forum: verified organisations (employers and NGOs), Career Center (jobs + CV applications) and
-- NGO partnerships. Owner decisions (2026-10-14): employers are verified by registration certificate, official
-- website and Tax ID / EIN; applicants apply with a CV that only the employer they apply to can see.

-- ---------------------------------------------------------------- organisations
create table if not exists public.forum_orgs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 140),
  kind text not null check (kind in ('employer', 'ngo', 'both')),
  website text not null check (website ~ '^https://[^\s]+$' and char_length(website) <= 300),
  country text not null check (char_length(btrim(country)) between 2 and 80),
  sector text check (sector is null or char_length(sector) <= 80),
  about text check (about is null or char_length(about) <= 2000),
  logo_url text check (logo_url is null or logo_url like 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/%'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'suspended')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists forum_orgs_owner_idx on public.forum_orgs (owner_id);
-- Private verification details: only the owner and WHSF moderators.
create table if not exists public.forum_org_private (
  org_id uuid primary key references public.forum_orgs(id) on delete cascade,
  registration_number text not null check (char_length(btrim(registration_number)) between 3 and 80),
  tax_id text not null check (char_length(btrim(tax_id)) between 3 and 40),
  certificate_path text not null check (certificate_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'),
  contact_email text check (contact_email is null or contact_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);
alter table public.forum_orgs enable row level security;
alter table public.forum_org_private enable row level security;
revoke all on public.forum_orgs, public.forum_org_private from anon, authenticated;
grant select, insert, update, delete on public.forum_orgs to authenticated;
grant select, insert, update on public.forum_org_private to authenticated;
drop policy if exists "Orgs: read" on public.forum_orgs;
create policy "Orgs: read" on public.forum_orgs for select to authenticated
  using (owner_id = auth.uid() or public.forum_is_staff() or (status = 'verified' and public.forum_is_member()));
drop policy if exists "Orgs: register own" on public.forum_orgs;
create policy "Orgs: register own" on public.forum_orgs for insert to authenticated with check (owner_id = auth.uid() and public.forum_is_member());
drop policy if exists "Orgs: owner or moderator edits" on public.forum_orgs;
create policy "Orgs: owner or moderator edits" on public.forum_orgs for update to authenticated
  using (owner_id = auth.uid() or public.forum_is_staff()) with check (owner_id = auth.uid() or public.forum_is_staff());
drop policy if exists "Orgs: owner deletes" on public.forum_orgs;
create policy "Orgs: owner deletes" on public.forum_orgs for delete to authenticated using (owner_id = auth.uid() or public.forum_is_staff());
drop policy if exists "Org private: owner or moderator" on public.forum_org_private;
create policy "Org private: owner or moderator" on public.forum_org_private for all to authenticated
  using (public.forum_is_staff() or exists (select 1 from public.forum_orgs o where o.id = org_id and o.owner_id = auth.uid()))
  with check (public.forum_is_staff() or exists (select 1 from public.forum_orgs o where o.id = org_id and o.owner_id = auth.uid()));

-- Owners cannot verify themselves; changing key details sends the organisation back to review.
create or replace function public.forum_orgs_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  new.id := old.id; new.owner_id := old.owner_id; new.created_at := old.created_at; new.updated_at := now();
  if not public.forum_is_staff() then
    new.status := old.status; new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    if (new.name, new.website, new.kind, new.country) is distinct from (old.name, old.website, old.kind, old.country) and old.status in ('verified', 'rejected') then
      new.status := 'pending'; new.review_note := null;
    end if;
  else
    if new.status is distinct from old.status then new.reviewed_by := auth.uid(); new.reviewed_at := now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists forum_orgs_guard on public.forum_orgs;
create trigger forum_orgs_guard before insert or update on public.forum_orgs for each row execute function public.forum_orgs_guard();

-- Private bucket for registration certificates.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-org-docs', 'forum-org-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Org docs: owner uploads" on storage.objects;
create policy "Org docs: owner uploads" on storage.objects for insert to authenticated with check (
  bucket_id = 'forum-org-docs' and exists (select 1 from public.forum_orgs o where o.id::text = (storage.foldername(name))[1] and o.owner_id = auth.uid()));
drop policy if exists "Org docs: owner or moderator views" on storage.objects;
create policy "Org docs: owner or moderator views" on storage.objects for select to authenticated using (
  bucket_id = 'forum-org-docs' and (public.forum_is_staff() or exists (select 1 from public.forum_orgs o where o.id::text = (storage.foldername(name))[1] and o.owner_id = auth.uid())));
drop policy if exists "Org docs: owner or moderator deletes" on storage.objects;
create policy "Org docs: owner or moderator deletes" on storage.objects for delete to authenticated using (
  bucket_id = 'forum-org-docs' and (public.forum_is_staff() or exists (select 1 from public.forum_orgs o where o.id::text = (storage.foldername(name))[1] and o.owner_id = auth.uid())));

-- ---------------------------------------------------------------- jobs
create table if not exists public.forum_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.forum_orgs(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'contract', 'internship', 'volunteer', 'fellowship')),
  workplace text not null check (workplace in ('onsite', 'remote', 'hybrid')),
  location text check (location is null or char_length(location) <= 120),
  country text check (country is null or char_length(country) <= 80),
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  salary_currency text default 'USD' check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$'),
  salary_period text default 'year' check (salary_period is null or salary_period in ('hour', 'month', 'year', 'total')),
  description text not null check (char_length(btrim(description)) between 50 and 8000),
  skills text[] not null default '{}' check (cardinality(skills) <= 15 and public.forum_text_items_ok(skills, 40)),
  deadline date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);
create index if not exists forum_jobs_open_idx on public.forum_jobs (status, created_at desc);
alter table public.forum_jobs enable row level security;
revoke all on public.forum_jobs from anon, authenticated;
grant select, insert, update, delete on public.forum_jobs to authenticated;
create or replace function public.forum_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from forum_orgs o where o.id = p_org and o.owner_id = auth.uid());
$$;
create or replace function public.forum_org_verified_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.forum_is_member() and exists (select 1 from forum_orgs o where o.id = p_org and o.owner_id = auth.uid() and o.status = 'verified');
$$;
drop policy if exists "Jobs: read" on public.forum_jobs;
create policy "Jobs: read" on public.forum_jobs for select to authenticated using (
  public.forum_is_staff() or public.forum_org_owner(org_id)
  or (public.forum_is_member() and exists (select 1 from forum_orgs o where o.id = org_id and o.status = 'verified')));
drop policy if exists "Jobs: verified employers post" on public.forum_jobs;
create policy "Jobs: verified employers post" on public.forum_jobs for insert to authenticated with check (public.forum_org_verified_owner(org_id));
drop policy if exists "Jobs: owner or moderator edits" on public.forum_jobs;
create policy "Jobs: owner or moderator edits" on public.forum_jobs for update to authenticated
  using (public.forum_org_owner(org_id) or public.forum_is_staff()) with check (public.forum_org_owner(org_id) or public.forum_is_staff());
drop policy if exists "Jobs: owner or moderator deletes" on public.forum_jobs;
create policy "Jobs: owner or moderator deletes" on public.forum_jobs for delete to authenticated using (public.forum_org_owner(org_id) or public.forum_is_staff());

create or replace function public.forum_jobs_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from forum_jobs j join forum_orgs o on o.id = j.org_id where o.owner_id = auth.uid() and j.created_at > now() - interval '24 hours') >= 10 then
      raise exception 'You can post up to 10 jobs a day.';
    end if;
    new.created_at := now(); new.updated_at := now(); new.status := 'open';
    return new;
  end if;
  new.id := old.id; new.org_id := old.org_id; new.created_at := old.created_at; new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists forum_jobs_guard on public.forum_jobs;
create trigger forum_jobs_guard before insert or update on public.forum_jobs for each row execute function public.forum_jobs_guard();

-- ---------------------------------------------------------------- applications with CV
create table if not exists public.forum_job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.forum_jobs(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  cv_path text not null check (cv_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx)$'),
  cv_name text not null check (char_length(cv_name) between 1 and 120),
  cover_note text check (cover_note is null or char_length(cover_note) <= 2000),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'shortlisted', 'interview', 'offered', 'not_selected', 'withdrawn')),
  employer_note text check (employer_note is null or char_length(employer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);
alter table public.forum_job_applications enable row level security;
revoke all on public.forum_job_applications from anon, authenticated;
grant select on public.forum_job_applications to authenticated;
drop policy if exists "Applications: applicant, employer or moderator" on public.forum_job_applications;
create policy "Applications: applicant, employer or moderator" on public.forum_job_applications for select to authenticated using (
  applicant_id = auth.uid() or public.forum_is_staff()
  or exists (select 1 from forum_jobs j join forum_orgs o on o.id = j.org_id where j.id = job_id and o.owner_id = auth.uid()));

-- Private CV bucket: <job id>/<applicant id>/<random>.pdf|docx
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-cvs', 'forum-cvs', false, 5242880, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "CVs: applicant uploads" on storage.objects;
create policy "CVs: applicant uploads" on storage.objects for insert to authenticated with check (
  bucket_id = 'forum-cvs' and (storage.foldername(name))[2] = auth.uid()::text and public.forum_is_member()
  and exists (select 1 from forum_jobs j join forum_orgs o on o.id = j.org_id where j.id::text = (storage.foldername(name))[1] and j.status = 'open' and o.status = 'verified'));
drop policy if exists "CVs: applicant, employer or moderator views" on storage.objects;
create policy "CVs: applicant, employer or moderator views" on storage.objects for select to authenticated using (
  bucket_id = 'forum-cvs' and ((storage.foldername(name))[2] = auth.uid()::text or public.forum_is_staff()
    or exists (select 1 from forum_jobs j join forum_orgs o on o.id = j.org_id where j.id::text = (storage.foldername(name))[1] and o.owner_id = auth.uid())));
drop policy if exists "CVs: applicant or moderator deletes" on storage.objects;
create policy "CVs: applicant or moderator deletes" on storage.objects for delete to authenticated using (
  bucket_id = 'forum-cvs' and ((storage.foldername(name))[2] = auth.uid()::text or public.forum_is_staff()));

alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security', 'mention',
  'connect_request', 'connect_accepted', 'collab_invite', 'collab_accepted',
  'org_verified', 'org_rejected', 'job_application', 'application_update']));

create or replace function public.forum_job_apply(p_job uuid, p_cv_path text, p_cv_name text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare j forum_jobs; o forum_orgs; v_id uuid; v_size bigint; v_mime text; v_name text;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can apply.' using errcode = '42501'; end if;
  select * into j from forum_jobs where id = p_job;
  select * into o from forum_orgs where id = j.org_id;
  if j.id is null or j.status <> 'open' or o.status <> 'verified' or (j.deadline is not null and j.deadline < current_date) then
    raise exception 'This job is no longer accepting applications.';
  end if;
  if o.owner_id = auth.uid() then raise exception 'You cannot apply to your own organisation''s job.'; end if;
  if p_cv_path is null or p_cv_path not like p_job::text || '/' || auth.uid()::text || '/%' then raise exception 'Upload your CV again.'; end if;
  select (x.metadata ->> 'size')::bigint, x.metadata ->> 'mimetype' into v_size, v_mime from storage.objects x where x.bucket_id = 'forum-cvs' and x.name = p_cv_path;
  if v_size is null then raise exception 'Your CV was not uploaded. Please try again.'; end if;
  if v_size > 5242880 or v_mime not in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') then
    raise exception 'Your CV must be a PDF or Word (.docx) file of 5 MB or less.';
  end if;
  if exists (select 1 from forum_job_applications where job_id = p_job and applicant_id = auth.uid() and status <> 'withdrawn') then
    raise exception 'You have already applied for this job.';
  end if;
  delete from forum_job_applications where job_id = p_job and applicant_id = auth.uid() and status = 'withdrawn';
  insert into forum_job_applications (job_id, applicant_id, cv_path, cv_name, cover_note)
  values (p_job, auth.uid(), p_cv_path, left(btrim(coalesce(p_cv_name, 'CV')), 120), nullif(left(btrim(coalesce(p_note, '')), 2000), ''))
  returning id into v_id;
  select display_name into v_name from forum_profiles where user_id = auth.uid();
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (o.owner_id, 'job_application', auth.uid(), left(coalesce(v_name, 'A member') || ' applied for ' || j.title, 300), '#careers/employer');
  return v_id;
end;
$$;

create or replace function public.forum_application_update(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a forum_job_applications; j forum_jobs; o forum_orgs; v_label text;
begin
  if not public.forum_is_member() and not public.forum_is_staff() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into a from forum_job_applications where id = p_id;
  select * into j from forum_jobs where id = a.job_id;
  select * into o from forum_orgs where id = j.org_id;
  if a.id is null then raise exception 'Application not found.'; end if;
  if a.applicant_id = auth.uid() then
    if p_status <> 'withdrawn' then raise exception 'You can only withdraw your application.'; end if;
    update forum_job_applications set status = 'withdrawn', updated_at = now() where id = p_id;
    return;
  end if;
  if o.owner_id <> auth.uid() and not public.forum_is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_status not in ('reviewing', 'shortlisted', 'interview', 'offered', 'not_selected') then raise exception 'Invalid status.'; end if;
  if a.status = 'withdrawn' then raise exception 'The applicant withdrew this application.'; end if;
  update forum_job_applications set status = p_status, employer_note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 1000), ''), employer_note), updated_at = now() where id = p_id;
  if p_status in ('shortlisted', 'interview', 'offered', 'not_selected') then
    v_label := case p_status when 'shortlisted' then 'You have been shortlisted for ' when 'interview' then 'Interview invitation for ' when 'offered' then 'Good news: an offer for ' else 'Update on your application for ' end;
    insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (a.applicant_id, 'application_update', auth.uid(), left(v_label || j.title || ' at ' || o.name, 300), '#careers/applications');
  end if;
end;
$$;

-- Moderator decision on an organisation (with an alert to the owner).
create or replace function public.forum_org_review(p_org uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o forum_orgs;
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'Tell the organisation why (at least a few words).'; end if;
  update forum_orgs set status = case when p_approve then 'verified' else 'rejected' end, review_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = p_org returning * into o;
  if o.id is null then raise exception 'Organisation not found.'; end if;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (o.owner_id, case when p_approve then 'org_verified' else 'org_rejected' end, auth.uid(),
    left(case when p_approve then o.name || ' is now verified by WHSF. You can post jobs and partnership calls.' else o.name || ' was not verified: ' || coalesce(p_note, '') end, 300),
    '#careers/employer');
end;
$$;

-- Jobs that match my skills and interests (simple overlap score).
create or replace function public.forum_job_matches(p_limit int default 6)
returns table (job_id uuid, score int)
language sql stable security definer set search_path = public as $$
  with me as (select coalesce(skills, '{}') skills from forum_profiles where user_id = auth.uid())
  select j.id, (select count(*) from unnest(j.skills) s where lower(s) = any (select lower(x) from unnest((select skills from me)) x))::int
  from forum_jobs j join forum_orgs o on o.id = j.org_id
  where public.forum_is_member() and j.status = 'open' and o.status = 'verified' and (j.deadline is null or j.deadline >= current_date)
  order by 2 desc, j.created_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 30);
$$;

revoke all on function public.forum_job_apply(uuid, text, text, text) from public, anon;
revoke all on function public.forum_application_update(uuid, text, text) from public, anon;
revoke all on function public.forum_org_review(uuid, boolean, text) from public, anon;
revoke all on function public.forum_job_matches(int) from public, anon;
revoke all on function public.forum_org_owner(uuid) from public, anon;
revoke all on function public.forum_org_verified_owner(uuid) from public, anon;
grant execute on function public.forum_job_apply(uuid, text, text, text) to authenticated;
grant execute on function public.forum_application_update(uuid, text, text) to authenticated;
grant execute on function public.forum_org_review(uuid, boolean, text) to authenticated;
grant execute on function public.forum_job_matches(int) to authenticated;
grant execute on function public.forum_org_owner(uuid) to authenticated;
grant execute on function public.forum_org_verified_owner(uuid) to authenticated;

-- Audit: organisation decisions and job removals by moderators.
drop trigger if exists forum_orgs_audit on public.forum_orgs;
create trigger forum_orgs_audit after update on public.forum_orgs for each row execute function public.forum_audit_trigger();

-- Include organisation decisions in the audit log.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.forum_audit_trigger'::regproc);
  d := replace(d, $q$('forum_events', 'forum_ads', 'forum_id_checks', 'whsf_programme_registrations')$q$, $q$('forum_events', 'forum_ads', 'forum_id_checks', 'whsf_programme_registrations', 'forum_orgs')$q$);
  d := replace(d, $q$when 'forum_id_checks' then 'id_check' else 'registration' end$q$, $q$when 'forum_id_checks' then 'id_check' when 'forum_orgs' then 'organisation' else 'registration' end$q$);
  d := replace(d, $q$coalesce(n ->> 'title', n ->> 'headline', n ->> 'reference', o ->> 'title')$q$, $q$coalesce(n ->> 'title', n ->> 'headline', n ->> 'reference', n ->> 'name', o ->> 'title')$q$);
  execute d;
end $$;

-- Moderator alerts (Teams / email) when an organisation asks to be verified.
alter table public.forum_review_alerts drop constraint if exists forum_review_alerts_kind_check;
alter table public.forum_review_alerts add constraint forum_review_alerts_kind_check check (kind = any (array['event', 'advert', 'org']));
do $$
declare d text;
begin
  d := pg_get_functiondef('public.forum_review_claim_alert'::regproc);
  d := replace(d, $q$  else
    return;
  end if;$q$, $q$  elsif p_kind = 'org' then
    select o.name, o.owner_id, o.website || ' · ' || o.country into v_title, v_owner, v_detail
    from forum_orgs o where o.id = p_id and o.owner_id = auth.uid() and o.status = 'pending';
  else
    return;
  end if;$q$);
  execute d;
  -- Moderator centre overview: organisations waiting for verification.
  d := pg_get_functiondef('public.forum_admin_stats'::regproc);
  d := replace(d, $q$'ads_pending', (select count(*) from forum_ads where status = 'pending'),$q$,
    $q$'ads_pending', (select count(*) from forum_ads where status = 'pending'),
    'orgs_pending', (select count(*) from forum_orgs where status = 'pending'),
    'jobs_open', (select count(*) from forum_jobs where status = 'open'),
    'applications_7d', (select count(*) from forum_job_applications where created_at > now() - interval '7 days'),$q$);
  execute d;
end $$;
