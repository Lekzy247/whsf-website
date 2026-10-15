-- WHSF Forum Grants & Scholarships hub: scholarships and fully / partially funded events (owner request 2026-10-15:
-- "find events that are sponsored fully or partially, and scholarships for students in any country").
-- Sources (public WordPress APIs of three opportunity sites; none restricts linking, we show only title, deadline and
-- a short summary, and every card links to their page, which links to the official programme):
--   ofa = Opportunities for Africans, asa = After School Africa, oc = Opportunities Corners.
-- Written daily by api/opportunities-sync.js through whsf_opportunities_ingest_partner, which reuses the job-sync
-- secret check (forum_job_sync_ok) and each source's auto_publish switch (grants-admin). Existing pages filter
-- kind = 'grant' / 'event', so the new kinds only appear where the Forum hub asks for them.

alter table public.whsf_opportunities drop constraint if exists whsf_opportunities_kind_check;
alter table public.whsf_opportunities add constraint whsf_opportunities_kind_check
  check (kind in ('grant', 'event', 'scholarship', 'funded_event'));
alter table public.whsf_opportunities add column if not exists funding text
  check (funding is null or funding in ('fully_funded', 'funded'));
alter table public.whsf_opportunities add column if not exists study_levels text[] not null default '{}';

alter table public.whsf_opportunity_sources drop constraint if exists whsf_opportunity_sources_kind_check;
alter table public.whsf_opportunity_sources add constraint whsf_opportunity_sources_kind_check
  check (kind in ('grant', 'event', 'scholarship', 'funded_event', 'mixed'));
insert into public.whsf_opportunity_sources (id, name, kind, homepage, enabled, auto_publish, notes, last_status) values
  ('ofa', 'Opportunities for Africans', 'mixed', 'https://www.opportunitiesforafricans.com/', true, true,
   'Scholarships and funded events with a deadline still ahead. Cards link to their page, which links to the official programme.', 'never'),
  ('asa', 'After School Africa', 'mixed', 'https://www.afterschoolafrica.com/', true, true,
   'Scholarships (undergraduate, masters, PhD) and funded events with a deadline still ahead.', 'never'),
  ('oc', 'Opportunities Corners', 'mixed', 'https://opportunitiescorners.com/', true, true,
   'Fully funded conferences, summits, exchanges and scholarships with a deadline still ahead.', 'never')
on conflict (id) do nothing;

drop function if exists public.whsf_opportunities_ingest_partner(text, jsonb);
create or replace function public.whsf_opportunities_ingest_partner(p_secret text, p_source text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; auto boolean; host text;
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'bad batch'; end if;
  host := case p_source when 'ofa' then 'https://www.opportunitiesforafricans.com/'
                        when 'asa' then 'https://www.afterschoolafrica.com/'
                        when 'oc' then 'https://opportunitiescorners.com/' end;
  select s.auto_publish into auto from public.whsf_opportunity_sources s where s.id = p_source and s.enabled;
  if host is null or auto is null then raise exception 'unknown or disabled source'; end if;

  insert into public.whsf_opportunities as t (kind, source, source_id, title, summary, url, deadline, status, review_status,
    funding, study_levels, last_seen_at, updated_at)
  select r->>'kind', p_source, r->>'source_id', left(r->>'title', 300), left(r->>'summary', 600), r->>'url',
         (r->>'deadline')::date, 'open', case when auto then 'published' else 'pending' end,
         nullif(r->>'funding', ''),
         coalesce((select array_agg(x) from jsonb_array_elements_text(r->'study_levels') x where x in ('undergraduate', 'masters', 'phd', 'short_course')), '{}'),
         now(), now()
  from jsonb_array_elements(p_rows) r
  where r->>'kind' in ('scholarship', 'funded_event') and left(r->>'url', char_length(host)) = host
    and char_length(coalesce(r->>'title', '')) >= 5 and coalesce(r->>'source_id', '') ~ '^[0-9]{1,12}$'
    and coalesce(r->>'deadline', '') ~ '^\d{4}-\d{2}-\d{2}$' and (r->>'deadline')::date >= current_date
  on conflict (source, source_id) do update set
    kind = excluded.kind, title = excluded.title, summary = excluded.summary, url = excluded.url,
    deadline = excluded.deadline, funding = excluded.funding, study_levels = excluded.study_levels,
    review_status = case when t.review_status = 'pending' and auto then 'published' else t.review_status end, -- never re-publish a hidden one
    status = 'open', last_seen_at = now(), updated_at = now();
  get diagnostics n = row_count;
  update public.whsf_opportunities set status = 'closed', updated_at = now()
   where source = p_source and status <> 'closed' and deadline < current_date;
  update public.whsf_opportunity_sources set last_run_at = now(), last_status = 'ok: ' || n || ' open listings' where id = p_source;
  return n;
end $$;
revoke all on function public.whsf_opportunities_ingest_partner(text, text, jsonb) from public;
grant execute on function public.whsf_opportunities_ingest_partner(text, text, jsonb) to anon, authenticated;
