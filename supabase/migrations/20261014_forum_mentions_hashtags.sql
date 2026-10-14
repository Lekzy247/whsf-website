-- WHSF Forum: @mentions (tag members in posts and comments) and trending #hashtags.
-- A mention is stored in the text as @[Display Name](user id); the page shows it as @Display Name.
-- Mentioned members get an alert (max 10 per post/comment, only for newly added mentions).

alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security', 'mention']));

create or replace function public.forum_notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post uuid := case when tg_table_name = 'forum_posts' then new.id else new.post_id end;
  v_old text := case when tg_op = 'UPDATE' then coalesce(old.body, '') else '' end;
  v_ids uuid[]; v_name text;
begin
  select array_agg(distinct m[1]::uuid) into v_ids
  from regexp_matches(coalesce(new.body, ''), '@\[[^\]\n]{1,80}\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)', 'g') as m
  where position(m[1] in v_old) = 0;
  if v_ids is null then return new; end if;
  select display_name into v_name from forum_profiles where user_id = new.author_id;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  select p.user_id, 'mention', new.author_id,
    left(coalesce(v_name, 'A member') || ' mentioned you in a ' || case when tg_table_name = 'forum_posts' then 'post' else 'comment' end, 300),
    '#post/' || v_post
  from forum_profiles p
  where p.user_id = any (v_ids[1:10]) and p.user_id <> new.author_id and p.verification_status = 'approved' and not p.is_suspended;
  return new;
end;
$$;
revoke all on function public.forum_notify_mentions() from public, anon, authenticated;

drop trigger if exists forum_posts_mentions on public.forum_posts;
create trigger forum_posts_mentions after insert or update of body on public.forum_posts
  for each row execute function public.forum_notify_mentions();
drop trigger if exists forum_comments_mentions on public.forum_comments;
create trigger forum_comments_mentions after insert or update of body on public.forum_comments
  for each row execute function public.forum_notify_mentions();

-- Most-used hashtags in recent visible posts (members only).
create or replace function public.forum_trending_hashtags(p_days int default 7, p_limit int default 10)
returns table (tag text, posts bigint)
language sql stable security definer set search_path = public as $$
  select lower(m[1]) as tag, count(distinct p.id) as posts
  from public.forum_posts p
  cross join lateral regexp_matches(p.body, '#([[:alnum:]_]{2,40})', 'g') as m
  where public.forum_is_member() and not p.is_hidden
    and p.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
  group by 1
  order by 2 desc, 1
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;
revoke all on function public.forum_trending_hashtags(int, int) from public, anon;
grant execute on function public.forum_trending_hashtags(int, int) to authenticated;
