-- WHSF: organisation due diligence + safe links everywhere (owner rule 2026-10-16: "Security is our ultimate goal when
-- any organization added link or anything suspicious to our site").
--
-- 1. Every link field members or organisations can fill must be https:// and pass forum_link_risk() (no shorteners,
--    look-alikes, raw IPs, program downloads, WhatsApp / Telegram invites...). Refused on save with a plain reason.
-- 2. Grants-portal organisations get a safety status, set by the database (members cannot change it):
--      quarantined = a claim that cannot be true as entered (US 501(c)(3) for an organisation registered outside the US),
--                    or the daily website check failed twice in a row -> alerts stop, WHSF is told.
--      unverified  = no website and a personal email address (Gmail, Yahoo...) -> listed for WHSF to review.
--      ok          = nothing found.
-- 3. A daily check (api/org-safety-scan.js) opens every organisation website; results come back through
--    org_safety_report(). Forum organisations (already verified by a person) are flagged for WHSF, not changed.

-- ---------------------------------------------------------------- 1. safe links
create or replace function public.whsf_url_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare col text; v text; r text; rec jsonb := to_jsonb(new);
begin
  if public.forum_is_staff() then return new; end if;
  foreach col in array tg_argv loop
    v := btrim(coalesce(rec ->> col, ''));
    if v = '' then continue; end if;
    if col = 'portfolio' then
      r := public.forum_link_risk(v);
    else
      if v !~* '^https://' then raise exception 'Links must start with https:// (%).', replace(col, '_', ' '); end if;
      if char_length(v) > 2000 then raise exception 'That link is too long.'; end if;
      r := public.forum_link_risk(v);
    end if;
    if r is not null then
      raise exception 'This link cannot be saved because it is %. Use the full, official website address.', r;
    end if;
  end loop;
  return new;
end $$;

do $$
declare t record;
begin
  for t in select * from (values
    ('forum_ads', 'link_url'), ('forum_event_private', 'meeting_link'),
    ('forum_events', 'recording_url, report_url, concept_note_url, livestream_url'),
    ('forum_mentors', 'booking_url'), ('forum_mentor_sessions', 'link'), ('forum_orgs', 'website'),
    ('forum_space_resources', 'url'), ('forum_factchecks', 'source_url'), ('forum_profiles', 'portfolio'),
    ('whsf_grant_orgs', 'website')) as x(tbl, cols)
  loop
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_url_guard', t.tbl);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.whsf_url_guard(%s)',
      t.tbl || '_url_guard', t.tbl, (select string_agg(quote_literal(btrim(c)), ', ') from unnest(string_to_array(t.cols, ',')) c));
  end loop;
end $$;

-- ---------------------------------------------------------------- 2. organisation safety status
alter table public.whsf_grant_orgs add column if not exists safety_status text not null default 'ok'
  check (safety_status in ('ok', 'unverified', 'quarantined'));
alter table public.whsf_grant_orgs add column if not exists safety_flags text[] not null default '{}';
alter table public.whsf_grant_orgs add column if not exists website_failures integer not null default 0;
alter table public.whsf_grant_orgs add column if not exists safety_checked_at timestamptz;
alter table public.whsf_grant_orgs add column if not exists safety_notified_at timestamptz;
alter table public.forum_orgs add column if not exists safety_flags text[] not null default '{}';
alter table public.forum_orgs add column if not exists website_failures integer not null default 0;
alter table public.forum_orgs add column if not exists safety_checked_at timestamptz;

create or replace function public.whsf_is_personal_email(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lower(split_part(u.email, '@', 2)) in ('gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com',
    'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
    'yandex.com', 'zoho.com'), false)
  from auth.users u where u.id = p_user;
$$;

create or replace function public.whsf_grant_org_safety()
returns trigger language plpgsql security definer set search_path = public as $$
declare flags text[] := '{}';
begin
  -- members cannot set these themselves; the database works them out
  -- only the daily check (org_safety_report sets whsf.safety_scan) may change these; member edits keep them
  if tg_op = 'INSERT' then
    new.website_failures := 0; new.safety_checked_at := null; new.safety_notified_at := null;
  elsif coalesce(current_setting('whsf.safety_scan', true), '') <> 'on' then
    new.website_failures := old.website_failures; new.safety_checked_at := old.safety_checked_at;
    new.safety_notified_at := old.safety_notified_at;
  end if;
  if coalesce(new.has_us_501c3, false) and upper(coalesce(new.country, '')) not in ('US', 'USA', 'UNITED STATES') then
    flags := flags || 'Claims US 501(c)(3) status but is registered outside the US'::text;
  end if;
  if coalesce(new.website_failures, 0) >= 2 then flags := flags || 'Website did not open on two daily checks'::text; end if;
  if cardinality(flags) > 0 then
    new.safety_status := 'quarantined';
    new.alerts_opt_in := false;
  elsif btrim(coalesce(new.website, '')) = '' and public.whsf_is_personal_email(new.owner_id) then
    new.safety_status := 'unverified';
    flags := flags || 'No website and a personal email address'::text;
  else
    new.safety_status := 'ok';
  end if;
  new.safety_flags := flags;
  return new;
end $$;
drop trigger if exists whsf_grant_orgs_safety on public.whsf_grant_orgs;
create trigger whsf_grant_orgs_safety before insert or update on public.whsf_grant_orgs
  for each row execute function public.whsf_grant_org_safety();

-- Forum organisations: only the daily check may change their safety fields.
create or replace function public.forum_org_safety_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('whsf.safety_scan', true), '') <> 'on' then
    if tg_op = 'INSERT' then new.safety_flags := '{}'; new.website_failures := 0; new.safety_checked_at := null;
    else new.safety_flags := old.safety_flags; new.website_failures := old.website_failures; new.safety_checked_at := old.safety_checked_at; end if;
  end if;
  return new;
end $$;
drop trigger if exists forum_orgs_safety_pin on public.forum_orgs;
create trigger forum_orgs_safety_pin before insert or update on public.forum_orgs
  for each row execute function public.forum_org_safety_pin();

-- ---------------------------------------------------------------- 3. daily website check (api/org-safety-scan.js)
create or replace function public.org_safety_targets(p_secret text)
returns table (kind text, id uuid, name text, website text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select 'grant_org', g.id, g.name, g.website from whsf_grant_orgs g where btrim(coalesce(g.website, '')) <> ''
    union all
    select 'forum_org', f.id, f.name, f.website from forum_orgs f where btrim(coalesce(f.website, '')) <> '' and f.status <> 'rejected';
end $$;
revoke all on function public.org_safety_targets(text) from public;
grant execute on function public.org_safety_targets(text) to anon, authenticated;

-- p_results: [{kind, id, ok}] -> returns organisations that became quarantined / flagged in this run (for the alert)
create or replace function public.org_safety_report(p_secret text, p_results jsonb)
returns table (kind text, id uuid, name text, website text, status text, flags text[])
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform set_config('whsf.safety_scan', 'on', true);
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]')) loop
    if r ->> 'kind' = 'grant_org' then
      update whsf_grant_orgs g set website_failures = case when (r ->> 'ok')::boolean then 0 else g.website_failures + 1 end,
        safety_checked_at = now() where g.id = (r ->> 'id')::uuid;
      if not (r ->> 'ok')::boolean then
        return query select 'grant_org'::text, g.id, g.name, g.website, g.safety_status, g.safety_flags
          from whsf_grant_orgs g where g.id = (r ->> 'id')::uuid and g.website_failures = 2;
      end if;
    elsif r ->> 'kind' = 'forum_org' then
      update forum_orgs f set website_failures = case when (r ->> 'ok')::boolean then 0 else f.website_failures + 1 end,
        safety_flags = case when (r ->> 'ok')::boolean then array_remove(f.safety_flags, 'Website did not open on two daily checks'::text)
                            when f.website_failures + 1 >= 2 and not ('Website did not open on two daily checks' = any(f.safety_flags))
                              then f.safety_flags || 'Website did not open on two daily checks'::text else f.safety_flags end,
        safety_checked_at = now() where f.id = (r ->> 'id')::uuid;
      if not (r ->> 'ok')::boolean then
        return query select 'forum_org'::text, f.id, f.name, f.website, f.status, f.safety_flags
          from forum_orgs f where f.id = (r ->> 'id')::uuid and f.website_failures = 2;
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.org_safety_report(text, jsonb) from public;
grant execute on function public.org_safety_report(text, jsonb) to anon, authenticated;

-- Grant organisations that are quarantined or unverified and WHSF has not been told about yet (marked as told).
create or replace function public.org_safety_new_flags(p_secret text)
returns table (id uuid, name text, country text, website text, status text, flags text[], email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform set_config('whsf.safety_scan', 'on', true);
  return query
    with told as (
      update whsf_grant_orgs g set safety_notified_at = now()
      where g.safety_status <> 'ok' and g.safety_notified_at is null
      returning g.id, g.name, g.country, g.website, g.safety_status, g.safety_flags, g.owner_id)
    select t.id, t.name, t.country, t.website, t.safety_status, t.safety_flags, u.email::text
    from told t left join auth.users u on u.id = t.owner_id;
end $$;
revoke all on function public.org_safety_new_flags(text) from public;
grant execute on function public.org_safety_new_flags(text) to anon, authenticated;

-- Re-check existing organisations now (fills safety_status / safety_flags).
update public.whsf_grant_orgs set updated_at = updated_at;
