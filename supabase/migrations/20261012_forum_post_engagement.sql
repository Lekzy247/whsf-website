-- WHSF Forum: Facebook/Instagram-style post engagement.
-- Reactions, comments (with one level of replies) and comment likes, saved posts,
-- author edits (with an "Edited" time), staff-pinned posts, and alerts for reactions/comments/replies.

-- ---------------------------------------------------------------- posts: edits + pins
alter table public.forum_posts
  add column if not exists edited_at timestamptz,
  add column if not exists is_pinned boolean not null default false;

create or replace function public.forum_posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.forum_posts where author_id = new.author_id and created_at > now() - interval '24 hours') >= 20 then
      raise exception 'Posting limit reached (20 posts a day). Please try again tomorrow.';
    end if;
    new.is_hidden := false; new.hidden_reason := null; new.created_at := now();
    new.edited_at := null; new.is_pinned := false;
    return new;
  end if;
  -- UPDATE
  new.id := old.id; new.author_id := old.author_id; new.created_at := old.created_at;
  if not public.whsf_is_staff() then
    -- Authors may change only the text, space and location of their own post.
    new.is_hidden := old.is_hidden; new.hidden_reason := old.hidden_reason;
    new.is_pinned := old.is_pinned; new.kind := old.kind; new.image_url := old.image_url;
  end if;
  if new.body is distinct from old.body or new.topic is distinct from old.topic or new.location is distinct from old.location then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

drop policy if exists "Authors edit own posts" on public.forum_posts;
create policy "Authors edit own posts" on public.forum_posts for update to authenticated
  using (author_id = auth.uid() and public.forum_is_member())
  with check (author_id = auth.uid() and public.forum_is_member());

-- ---------------------------------------------------------------- reactions
create table if not exists public.forum_reactions (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.forum_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('like', 'love', 'celebrate', 'support', 'insightful', 'funny')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists forum_reactions_user_idx on public.forum_reactions (user_id);
alter table public.forum_reactions enable row level security;

create policy "Members read reactions" on public.forum_reactions for select to authenticated
  using (public.forum_is_member() or public.whsf_is_staff());
create policy "Members react" on public.forum_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.forum_is_member()
              and exists (select 1 from public.forum_posts p where p.id = post_id));
create policy "Members change reaction" on public.forum_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.forum_is_member()
              and exists (select 1 from public.forum_posts p where p.id = post_id));
create policy "Members remove reaction" on public.forum_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- comments + replies
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  parent_id uuid references public.forum_comments(id) on delete cascade,
  author_id uuid not null references public.forum_profiles(user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_hidden boolean not null default false
);
create index if not exists forum_comments_post_idx on public.forum_comments (post_id, created_at);
create index if not exists forum_comments_author_idx on public.forum_comments (author_id, created_at);
alter table public.forum_comments enable row level security;

create policy "Members read comments" on public.forum_comments for select to authenticated
  using (public.whsf_is_staff()
         or (public.forum_is_member()
             and exists (select 1 from public.forum_posts p where p.id = post_id)
             and (not is_hidden or author_id = auth.uid())));
create policy "Members comment" on public.forum_comments for insert to authenticated
  with check (author_id = auth.uid() and public.forum_is_member()
              and exists (select 1 from public.forum_posts p where p.id = post_id));
create policy "Authors or moderators edit comments" on public.forum_comments for update to authenticated
  using ((author_id = auth.uid() and public.forum_is_member()) or public.whsf_is_staff())
  with check ((author_id = auth.uid() and public.forum_is_member()) or public.whsf_is_staff());
-- Comment author, the post's author (their own post) or a moderator can delete a comment.
create policy "Authors, post owners or moderators delete comments" on public.forum_comments for delete to authenticated
  using (author_id = auth.uid() or public.whsf_is_staff()
         or exists (select 1 from public.forum_posts p where p.id = post_id and p.author_id = auth.uid()));

create or replace function public.forum_comments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_parent record;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.forum_comments where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 30 then
      raise exception 'You are commenting too fast. Please wait a few minutes.';
    end if;
    if new.parent_id is not null then
      select post_id, parent_id into v_parent from public.forum_comments where id = new.parent_id;
      if not found or v_parent.post_id <> new.post_id then
        raise exception 'Reply must belong to the same post.';
      end if;
      -- One level of replies (like Facebook): a reply to a reply joins the same thread.
      if v_parent.parent_id is not null then new.parent_id := v_parent.parent_id; end if;
    end if;
    new.created_at := now(); new.edited_at := null; new.is_hidden := false;
    return new;
  end if;
  new.id := old.id; new.post_id := old.post_id; new.parent_id := old.parent_id;
  new.author_id := old.author_id; new.created_at := old.created_at;
  if not public.whsf_is_staff() then new.is_hidden := old.is_hidden; end if;
  if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end;
$$;
drop trigger if exists forum_comments_guard on public.forum_comments;
create trigger forum_comments_guard before insert or update on public.forum_comments
  for each row execute function public.forum_comments_guard();

-- ---------------------------------------------------------------- comment likes
create table if not exists public.forum_comment_likes (
  comment_id uuid not null references public.forum_comments(id) on delete cascade,
  user_id uuid not null references public.forum_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists forum_comment_likes_user_idx on public.forum_comment_likes (user_id);
alter table public.forum_comment_likes enable row level security;
create policy "Members read comment likes" on public.forum_comment_likes for select to authenticated
  using (public.forum_is_member() or public.whsf_is_staff());
create policy "Members like comments" on public.forum_comment_likes for insert to authenticated
  with check (user_id = auth.uid() and public.forum_is_member()
              and exists (select 1 from public.forum_comments c where c.id = comment_id));
create policy "Members unlike comments" on public.forum_comment_likes for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- saved posts (private to each member)
create table if not exists public.forum_saves (
  user_id uuid not null references public.forum_profiles(user_id) on delete cascade,
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.forum_saves enable row level security;
create policy "Members read own saves" on public.forum_saves for select to authenticated
  using (user_id = auth.uid());
create policy "Members save posts" on public.forum_saves for insert to authenticated
  with check (user_id = auth.uid() and public.forum_is_member()
              and exists (select 1 from public.forum_posts p where p.id = post_id));
create policy "Members unsave posts" on public.forum_saves for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- alerts
alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind in (
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update',
  'advert_approved', 'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply'));

create or replace function public.forum_reaction_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text; v_link text;
begin
  select author_id into v_owner from forum_posts where id = new.post_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  v_link := '#post/' || new.post_id;
  -- One unread alert per person per post, so toggling reactions does not spam.
  if exists (select 1 from forum_notifications where user_id = v_owner and actor_id = new.user_id
             and kind = 'reaction' and link = v_link and read_at is null) then
    return new;
  end if;
  select display_name into v_name from forum_profiles where user_id = new.user_id;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (v_owner, 'reaction', new.user_id, left(coalesce(v_name, 'A member'), 80) || ' reacted to your post', v_link);
  return new;
end;
$$;
drop trigger if exists forum_reaction_alert on public.forum_reactions;
create trigger forum_reaction_alert after insert on public.forum_reactions
  for each row execute function public.forum_reaction_alert();

create or replace function public.forum_comment_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_parent_author uuid; v_name text; v_snip text; v_link text;
begin
  select author_id into v_owner from forum_posts where id = new.post_id;
  select display_name into v_name from forum_profiles where user_id = new.author_id;
  v_name := left(coalesce(v_name, 'A member'), 80);
  v_snip := left(regexp_replace(new.body, '\s+', ' ', 'g'), 120);
  v_link := '#post/' || new.post_id;
  if v_owner is not null and v_owner <> new.author_id then
    insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (v_owner, 'comment', new.author_id, v_name || ' commented on your post: ' || v_snip, v_link);
  end if;
  if new.parent_id is not null then
    select author_id into v_parent_author from forum_comments where id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> new.author_id and v_parent_author is distinct from v_owner then
      insert into forum_notifications (user_id, kind, actor_id, body, link)
      values (v_parent_author, 'reply', new.author_id, v_name || ' replied to your comment: ' || v_snip, v_link);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists forum_comment_alert on public.forum_comments;
create trigger forum_comment_alert after insert on public.forum_comments
  for each row execute function public.forum_comment_alert();

-- ---------------------------------------------------------------- feed stats (runs with the caller's own access rights)
create or replace function public.forum_post_stats(p_ids uuid[])
returns table (post_id uuid, reactions jsonb, reaction_total int, comment_total int, my_reaction text, saved boolean)
language sql stable security invoker set search_path = public as $$
  select p.id,
    coalesce((select jsonb_object_agg(x.kind, x.n) from (
      select r.kind, count(*) as n from public.forum_reactions r where r.post_id = p.id group by r.kind) x), '{}'::jsonb),
    (select count(*)::int from public.forum_reactions r where r.post_id = p.id),
    (select count(*)::int from public.forum_comments c where c.post_id = p.id and not c.is_hidden),
    (select r.kind from public.forum_reactions r where r.post_id = p.id and r.user_id = auth.uid()),
    exists (select 1 from public.forum_saves s where s.post_id = p.id and s.user_id = auth.uid())
  from public.forum_posts p
  where p.id = any (p_ids[1:50]);
$$;
revoke all on function public.forum_post_stats(uuid[]) from public, anon;
grant execute on function public.forum_post_stats(uuid[]) to authenticated;

revoke all on function public.forum_reaction_alert() from public, anon, authenticated;
revoke all on function public.forum_comment_alert() from public, anon, authenticated;
revoke all on function public.forum_comments_guard() from public, anon, authenticated;
