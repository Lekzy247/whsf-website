-- WHSF Forum: professional profiles (skills, experience, portfolio, open to) and networking
-- (connection requests, collaboration invitations, people suggestions).

-- ---------------------------------------------------------------- professional profile fields
alter table public.forum_profiles
  add column if not exists skills text[] not null default '{}',
  add column if not exists experience jsonb not null default '[]'::jsonb,
  add column if not exists portfolio jsonb not null default '[]'::jsonb,
  add column if not exists open_to text[] not null default '{}';

create or replace function public.forum_experience_ok(p jsonb)
returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 10 and coalesce((
    select bool_and(
      jsonb_typeof(x) = 'object'
      and char_length(btrim(coalesce(x ->> 'title', ''))) between 2 and 100
      and char_length(coalesce(x ->> 'org', '')) <= 120
      and coalesce(x ->> 'start', '') ~ '^(\d{4}(-\d{2})?)?$'
      and coalesce(x ->> 'end', '') ~ '^(\d{4}(-\d{2})?)?$'
      and char_length(coalesce(x ->> 'about', '')) <= 400)
    from jsonb_array_elements(p) x), true);
$$;
create or replace function public.forum_portfolio_ok(p jsonb)
returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 8 and coalesce((
    select bool_and(
      jsonb_typeof(x) = 'object'
      and char_length(btrim(coalesce(x ->> 'title', ''))) between 2 and 100
      and coalesce(x ->> 'url', '') ~ '^https://[^\s]+$' and char_length(x ->> 'url') <= 500
      and char_length(coalesce(x ->> 'about', '')) <= 200)
    from jsonb_array_elements(p) x), true);
$$;

alter table public.forum_profiles drop constraint if exists forum_profiles_professional_check;
alter table public.forum_profiles add constraint forum_profiles_professional_check check (
  cardinality(skills) <= 20 and public.forum_text_items_ok(skills, 40)
  and public.forum_experience_ok(experience)
  and public.forum_portfolio_ok(portfolio)
  and open_to <@ array['mentoring', 'being_mentored', 'collaboration', 'jobs', 'hiring', 'volunteering', 'speaking', 'partnerships']);

-- ---------------------------------------------------------------- connections and collaboration invitations
create table if not exists public.forum_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'connect' check (kind in ('connect', 'collaborate')),
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists forum_connections_pair_idx on public.forum_connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id)) where kind = 'connect';
create unique index if not exists forum_connections_collab_pending_idx on public.forum_connections (requester_id, addressee_id) where kind = 'collaborate' and status = 'pending';
create index if not exists forum_connections_addressee_idx on public.forum_connections (addressee_id, status);
alter table public.forum_connections enable row level security;
revoke all on public.forum_connections from anon, authenticated;
grant select on public.forum_connections to authenticated;
drop policy if exists "Connections: own" on public.forum_connections;
create policy "Connections: own" on public.forum_connections for select to authenticated
  using ((requester_id = auth.uid() or addressee_id = auth.uid()) and public.forum_is_member());

alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security', 'mention',
  'connect_request', 'connect_accepted', 'collab_invite', 'collab_accepted']));

create or replace function public.forum_connect(p_user uuid, p_kind text default 'connect', p_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); c forum_connections; v_name text; v_msg text := nullif(left(btrim(coalesce(p_message, '')), 500), '');
begin
  if not public.forum_is_member() then raise exception 'Only verified members can connect.' using errcode = '42501'; end if;
  if p_kind not in ('connect', 'collaborate') then raise exception 'Invalid request.'; end if;
  if p_user = v_me then raise exception 'You cannot connect with yourself.'; end if;
  if not exists (select 1 from forum_profiles where user_id = p_user and verification_status = 'approved' and not is_suspended) then
    raise exception 'This member is not available.';
  end if;
  if public.forum_is_blocked(v_me, p_user) then raise exception 'This member is not available.'; end if;
  if (select count(*) from forum_connections where requester_id = v_me and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'You have sent many requests today. Please try again tomorrow.';
  end if;
  if p_kind = 'collaborate' and char_length(coalesce(v_msg, '')) < 10 then
    raise exception 'Describe the collaboration in a sentence or two.';
  end if;
  select display_name into v_name from forum_profiles where user_id = v_me;

  if p_kind = 'connect' then
    select * into c from forum_connections
      where kind = 'connect' and least(requester_id, addressee_id) = least(v_me, p_user) and greatest(requester_id, addressee_id) = greatest(v_me, p_user);
    if c.id is not null then
      if c.status = 'accepted' then return 'connected'; end if;
      if c.status = 'pending' and c.addressee_id = v_me then
        update forum_connections set status = 'accepted', responded_at = now() where id = c.id;
        insert into forum_notifications (user_id, kind, actor_id, body, link)
          values (p_user, 'connect_accepted', v_me, left(coalesce(v_name, 'A member') || ' accepted your connection request', 300), '#profile/' || v_me);
        return 'connected';
      end if;
      if c.status = 'pending' then return 'pending'; end if;
      if c.status = 'declined' and c.responded_at > now() - interval '30 days' then
        raise exception 'This member is not accepting a request from you right now.';
      end if;
      update forum_connections set requester_id = v_me, addressee_id = p_user, status = 'pending', message = v_msg, created_at = now(), responded_at = null where id = c.id;
    else
      insert into forum_connections (requester_id, addressee_id, kind, message) values (v_me, p_user, 'connect', v_msg);
    end if;
    insert into forum_notifications (user_id, kind, actor_id, body, link)
      values (p_user, 'connect_request', v_me, left(coalesce(v_name, 'A member') || ' wants to connect with you', 300), '#network/invitations');
    return 'pending';
  end if;

  begin
    insert into forum_connections (requester_id, addressee_id, kind, message) values (v_me, p_user, 'collaborate', v_msg);
  exception when unique_violation then
    raise exception 'You already sent this member a collaboration invitation. Wait for their reply.';
  end;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (p_user, 'collab_invite', v_me, left(coalesce(v_name, 'A member') || ' invited you to collaborate: ' || v_msg, 300), '#network/invitations');
  return 'pending';
end;
$$;

create or replace function public.forum_connect_respond(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c forum_connections; v_name text;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can respond.' using errcode = '42501'; end if;
  select * into c from forum_connections where id = p_id;
  if c.id is null or c.addressee_id <> auth.uid() or c.status <> 'pending' then raise exception 'This request is no longer waiting for you.'; end if;
  update forum_connections set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_id;
  if p_accept then
    select display_name into v_name from forum_profiles where user_id = auth.uid();
    insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (c.requester_id, case c.kind when 'connect' then 'connect_accepted' else 'collab_accepted' end, auth.uid(),
      left(coalesce(v_name, 'A member') || case c.kind when 'connect' then ' accepted your connection request' else ' accepted your collaboration invitation. Send them a message to start.' end, 300),
      '#profile/' || auth.uid());
  end if;
end;
$$;

-- Remove a connection, or withdraw a request you sent.
create or replace function public.forum_connect_remove(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_is_member() then raise exception 'Only verified members can do this.' using errcode = '42501'; end if;
  delete from forum_connections
  where kind = 'connect'
    and ((requester_id = auth.uid() and addressee_id = p_user) or (status = 'accepted' and requester_id = p_user and addressee_id = auth.uid()));
  delete from forum_connections where kind = 'collaborate' and status = 'pending' and requester_id = auth.uid() and addressee_id = p_user;
end;
$$;

-- Connection count for any member (numbers only).
create or replace function public.forum_connection_count(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.forum_is_member() then (select count(*) from forum_connections
    where kind = 'connect' and status = 'accepted' and (requester_id = p_user or addressee_id = p_user)) else 0 end;
$$;

-- People you may know: shared interests, skills, spaces, location and mutual connections.
create or replace function public.forum_people_suggestions(p_limit int default 12)
returns table (user_id uuid, display_name text, headline text, location text, avatar_url text, reason text, score int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_me uuid := auth.uid(); me forum_profiles;
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into me from forum_profiles where forum_profiles.user_id = v_me;
  return query
  with mine as (
    select case when c.requester_id = v_me then c.addressee_id else c.requester_id end as other
    from forum_connections c where c.kind = 'connect' and c.status = 'accepted' and v_me in (c.requester_id, c.addressee_id)
  ), my_spaces as (select m.space from forum_space_members m where m.user_id = v_me),
  cand as (
    select p.*,
      (select count(*) from unnest(p.interests) i where i = any (me.interests))::int as s_int,
      (select count(*) from unnest(p.skills) s where lower(s) = any (select lower(x) from unnest(me.skills) x))::int as s_skill,
      (select count(*) from forum_space_members m where m.user_id = p.user_id and m.space in (select space from my_spaces))::int as s_space,
      (select count(*) from forum_connections c where c.kind = 'connect' and c.status = 'accepted'
         and ((c.requester_id = p.user_id and c.addressee_id in (select other from mine)) or (c.addressee_id = p.user_id and c.requester_id in (select other from mine))))::int as s_mutual,
      (case when me.location is not null and p.location is not null and lower(btrim(p.location)) = lower(btrim(me.location)) then 1 else 0 end) as s_loc
    from forum_profiles p
    where p.user_id <> v_me and p.verification_status = 'approved' and not p.is_suspended
      and not public.forum_is_blocked(v_me, p.user_id)
      and not exists (select 1 from forum_connections c where c.kind = 'connect'
        and least(c.requester_id, c.addressee_id) = least(v_me, p.user_id) and greatest(c.requester_id, c.addressee_id) = greatest(v_me, p.user_id)
        and (c.status in ('pending', 'accepted') or c.responded_at > now() - interval '30 days'))
  )
  select cand.user_id, cand.display_name, cand.headline, cand.location, cand.avatar_url,
    case
      when s_mutual > 0 then s_mutual || ' mutual connection' || case when s_mutual = 1 then '' else 's' end
      when s_int > 0 then 'Shares your interests'
      when s_skill > 0 then 'Similar skills'
      when s_space > 0 then 'In the same spaces'
      when s_loc > 0 then 'Near you'
      else 'New on the WHSF Forum'
    end,
    (s_mutual * 3 + s_int * 3 + s_skill * 2 + s_space * 2 + s_loc)::int
  from cand
  order by 7 desc, cand.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
end;
$$;

revoke all on function public.forum_connect(uuid, text, text) from public, anon;
revoke all on function public.forum_connect_respond(uuid, boolean) from public, anon;
revoke all on function public.forum_connect_remove(uuid) from public, anon;
revoke all on function public.forum_connection_count(uuid) from public, anon;
revoke all on function public.forum_people_suggestions(int) from public, anon;
grant execute on function public.forum_connect(uuid, text, text) to authenticated;
grant execute on function public.forum_connect_respond(uuid, boolean) to authenticated;
grant execute on function public.forum_connect_remove(uuid) to authenticated;
grant execute on function public.forum_connection_count(uuid) to authenticated;
grant execute on function public.forum_people_suggestions(int) to authenticated;
