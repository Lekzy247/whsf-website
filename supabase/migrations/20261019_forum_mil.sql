-- WHSF Forum: MIL Lab community. Fact-check requests answered by WHSF-appointed fact-checkers (verdict +
-- sources), a public-to-members fact-check library, and progress through the six MIL Lab learning modules
-- (all six = MIL Ambassador badge).

create table if not exists public.forum_factcheckers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.forum_factcheckers enable row level security;
revoke all on public.forum_factcheckers from anon, authenticated;
grant select, insert, delete on public.forum_factcheckers to authenticated;
drop policy if exists "Fact-checkers: members read" on public.forum_factcheckers;
create policy "Fact-checkers: members read" on public.forum_factcheckers for select to authenticated using (public.forum_is_member() or public.forum_is_staff());
drop policy if exists "Fact-checkers: WHSF appoints" on public.forum_factcheckers;
create policy "Fact-checkers: WHSF appoints" on public.forum_factcheckers for insert to authenticated with check (public.forum_is_staff() and added_by = auth.uid());
drop policy if exists "Fact-checkers: WHSF removes" on public.forum_factcheckers;
create policy "Fact-checkers: WHSF removes" on public.forum_factcheckers for delete to authenticated using (public.forum_is_staff());

create or replace function public.forum_is_factchecker()
returns boolean language sql stable security definer set search_path = public as $$
  select public.forum_is_staff() or (public.forum_is_member() and exists (select 1 from forum_factcheckers where user_id = auth.uid()));
$$;
revoke all on function public.forum_is_factchecker() from public, anon;
grant execute on function public.forum_is_factchecker() to authenticated;

create table if not exists public.forum_factchecks (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  claim text not null check (char_length(btrim(claim)) between 10 and 1000),
  source_url text check (source_url is null or (source_url ~ '^https?://[^\s]+$' and char_length(source_url) <= 500)),
  seen_on text check (seen_on is null or seen_on in ('whatsapp', 'facebook', 'x', 'tiktok', 'instagram', 'youtube', 'website', 'tv_radio', 'in_person', 'other')),
  topic text not null default 'other' check (topic in ('health', 'elections', 'scam', 'education', 'climate', 'conflict', 'ai_media', 'other')),
  status text not null default 'open' check (status in ('open', 'in_review', 'answered', 'rejected')),
  verdict text check (verdict is null or verdict in ('true', 'false', 'misleading', 'missing_context', 'unproven')),
  summary text check (summary is null or char_length(summary) between 30 and 3000),
  sources jsonb not null default '[]'::jsonb,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  checker_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'answered' or (verdict is not null and summary is not null and jsonb_array_length(sources) between 1 and 8))
);
create index if not exists forum_factchecks_status_idx on public.forum_factchecks (status, created_at desc);
alter table public.forum_factchecks enable row level security;
revoke all on public.forum_factchecks from anon, authenticated;
grant select on public.forum_factchecks to authenticated;
drop policy if exists "Fact-checks: read" on public.forum_factchecks;
create policy "Fact-checks: read" on public.forum_factchecks for select to authenticated using (
  requester_id = auth.uid() or public.forum_is_factchecker() or (status <> 'rejected' and public.forum_is_member()));

alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security', 'mention',
  'connect_request', 'connect_accepted', 'collab_invite', 'collab_accepted',
  'org_verified', 'org_rejected', 'job_application', 'application_update',
  'mentor_request', 'mentor_accepted', 'mentor_declined', 'mentor_session',
  'factcheck_request', 'factcheck_answered']));

create or replace function public.forum_factcheck_request(p_claim text, p_url text, p_seen text, p_topic text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can ask for a fact-check.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_claim, ''))) < 10 then raise exception 'Describe the claim in a sentence or two.'; end if;
  if (select count(*) from forum_factchecks where requester_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You can send up to 5 fact-check requests a day.';
  end if;
  insert into forum_factchecks (requester_id, claim, source_url, seen_on, topic)
  values (auth.uid(), left(btrim(p_claim), 1000), nullif(btrim(coalesce(p_url, '')), ''), nullif(p_seen, ''), coalesce(nullif(p_topic, ''), 'other'))
  returning id into v_id;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  select f.user_id, 'factcheck_request', auth.uid(), left('New fact-check request: ' || btrim(p_claim), 300), '#mil/review'
  from forum_factcheckers f where f.user_id <> auth.uid() limit 25;
  return v_id;
end;
$$;

create or replace function public.forum_factcheck_claim(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c forum_factchecks;
begin
  if not public.forum_is_factchecker() then raise exception 'Fact-checkers only.' using errcode = '42501'; end if;
  select * into c from forum_factchecks where id = p_id for update;
  if c.id is null or c.status <> 'open' then raise exception 'Someone is already working on this one.'; end if;
  if c.requester_id = auth.uid() then raise exception 'Another fact-checker should check your own request.'; end if;
  update forum_factchecks set status = 'in_review', checker_id = auth.uid(), claimed_at = now() where id = p_id;
end;
$$;

create or replace function public.forum_factcheck_answer(p_id uuid, p_verdict text, p_summary text, p_sources jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c forum_factchecks; n int;
begin
  if not public.forum_is_factchecker() then raise exception 'Fact-checkers only.' using errcode = '42501'; end if;
  select * into c from forum_factchecks where id = p_id for update;
  if c.id is null or c.status not in ('in_review', 'answered') then raise exception 'Start the review first.'; end if;
  if c.checker_id <> auth.uid() and not public.forum_is_staff() then raise exception 'Another fact-checker is working on this one.'; end if;
  if p_verdict not in ('true', 'false', 'misleading', 'missing_context', 'unproven') then raise exception 'Choose a verdict.'; end if;
  if char_length(btrim(coalesce(p_summary, ''))) < 30 then raise exception 'Explain the verdict in at least two sentences.'; end if;
  if jsonb_typeof(p_sources) <> 'array' then raise exception 'Add at least one source.'; end if;
  n := jsonb_array_length(p_sources);
  if n < 1 or n > 8 or exists (select 1 from jsonb_array_elements(p_sources) s
      where char_length(btrim(coalesce(s ->> 'title', ''))) < 2 or coalesce(s ->> 'url', '') !~ '^https://[^\s]+$') then
    raise exception 'Add 1 to 8 sources, each with a title and a link starting with https://';
  end if;
  update forum_factchecks set status = 'answered', verdict = p_verdict, summary = left(btrim(p_summary), 3000), sources = p_sources,
    checker_id = coalesce(checker_id, auth.uid()), answered_at = now() where id = p_id;
  if c.status <> 'answered' then
    insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (c.requester_id, 'factcheck_answered', auth.uid(), left('Your fact-check is ready: ' || c.claim, 300), '#mil/check/' || p_id);
  end if;
end;
$$;

create or replace function public.forum_factcheck_reject(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_is_factchecker() then raise exception 'Fact-checkers only.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a short reason.'; end if;
  update forum_factchecks set status = 'rejected', reject_reason = left(btrim(p_reason), 300), checker_id = auth.uid(), answered_at = now()
  where id = p_id and status in ('open', 'in_review');
  if not found then raise exception 'This request is already closed.'; end if;
end;
$$;

-- Release a review you can't finish.
create or replace function public.forum_factcheck_release(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_is_factchecker() then raise exception 'Fact-checkers only.' using errcode = '42501'; end if;
  update forum_factchecks set status = 'open', checker_id = null, claimed_at = null
  where id = p_id and status = 'in_review' and (checker_id = auth.uid() or public.forum_is_staff());
end;
$$;

-- Learning progress through the six MIL Lab modules.
create table if not exists public.forum_mil_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module int not null check (module between 1 and 6),
  completed_at timestamptz not null default now(),
  primary key (user_id, module)
);
alter table public.forum_mil_progress enable row level security;
revoke all on public.forum_mil_progress from anon, authenticated;
grant select, insert, delete on public.forum_mil_progress to authenticated;
drop policy if exists "MIL progress: members read" on public.forum_mil_progress;
create policy "MIL progress: members read" on public.forum_mil_progress for select to authenticated using (user_id = auth.uid() or public.forum_is_member());
drop policy if exists "MIL progress: own" on public.forum_mil_progress;
create policy "MIL progress: own" on public.forum_mil_progress for insert to authenticated with check (user_id = auth.uid() and public.forum_is_member());
drop policy if exists "MIL progress: own delete" on public.forum_mil_progress;
create policy "MIL progress: own delete" on public.forum_mil_progress for delete to authenticated using (user_id = auth.uid());

revoke all on function public.forum_factcheck_request(text, text, text, text) from public, anon;
revoke all on function public.forum_factcheck_claim(uuid) from public, anon;
revoke all on function public.forum_factcheck_answer(uuid, text, text, jsonb) from public, anon;
revoke all on function public.forum_factcheck_reject(uuid, text) from public, anon;
revoke all on function public.forum_factcheck_release(uuid) from public, anon;
grant execute on function public.forum_factcheck_request(text, text, text, text) to authenticated;
grant execute on function public.forum_factcheck_claim(uuid) to authenticated;
grant execute on function public.forum_factcheck_answer(uuid, text, text, jsonb) to authenticated;
grant execute on function public.forum_factcheck_reject(uuid, text) to authenticated;
grant execute on function public.forum_factcheck_release(uuid) to authenticated;

-- Audit: fact-checker appointments.
drop trigger if exists forum_factcheckers_audit on public.forum_factcheckers;
create trigger forum_factcheckers_audit after insert or delete on public.forum_factcheckers for each row execute function public.forum_audit_trigger();
do $$
declare d text; d2 text;
begin
  d := pg_get_functiondef('public.forum_audit_trigger'::regproc);
  d2 := replace(d, $q$  elsif tg_table_name = 'forum_space_resources' then$q$, $q$  elsif tg_table_name = 'forum_factcheckers' then
    ttype := 'member'; tid := coalesce(n ->> 'user_id', o ->> 'user_id'); det := '{}'::jsonb;
    act := case tg_op when 'INSERT' then 'member.factchecker_add' when 'DELETE' then 'member.factchecker_remove' end;
  elsif tg_table_name = 'forum_space_resources' then$q$);
  if d2 = d then raise exception 'audit replace did not match'; end if;
  execute d2;
end $$;
