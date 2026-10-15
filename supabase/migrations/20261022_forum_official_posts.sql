-- WHSF Forum: posts from official WHSF accounts are visible to everyone (owner request 2026-10-15).
-- An official account = a Forum profile whose sign-in email is a confirmed @worldhsfoundation.org address and that is
-- not suspended. Members already read every post; they now also always see official posts under "My network".
-- Visitors and members still waiting for their ID check read official posts through forum_official_posts(), which
-- returns only post fields plus the account's name, headline and photo (no other tables are opened up).
-- Reactions, comments and messages stay members-only.

create or replace function public.forum_is_official(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u join public.forum_profiles p on p.user_id = u.id
    where u.id = p_user and u.email_confirmed_at is not null and not coalesce(p.is_suspended, false)
      and lower(split_part(u.email, '@', 2)) = 'worldhsfoundation.org');
$$;

create or replace function public.forum_official_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.user_id from public.forum_profiles p where public.forum_is_official(p.user_id);
$$;

create or replace function public.forum_official_posts(p_limit int default 20, p_offset int default 0)
returns table (id uuid, kind text, topic text, body text, image_url text, location text, created_at timestamptz,
  edited_at timestamptz, is_pinned boolean, author_id uuid, author_name text, author_headline text, author_avatar text)
language sql stable security definer set search_path = public as $$
  select x.id, x.kind, x.topic, x.body, x.image_url, x.location, x.created_at, x.edited_at, x.is_pinned, x.author_id,
         p.display_name, p.headline, p.avatar_url
  from public.forum_posts x join public.forum_profiles p on p.user_id = x.author_id
  where not x.is_hidden and public.forum_is_official(x.author_id)
  order by x.is_pinned desc, x.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.forum_is_official(uuid) from public;
revoke all on function public.forum_official_ids() from public;
revoke all on function public.forum_official_posts(int, int) from public;
grant execute on function public.forum_is_official(uuid) to anon, authenticated;
grant execute on function public.forum_official_ids() to anon, authenticated;
grant execute on function public.forum_official_posts(int, int) to anon, authenticated;
