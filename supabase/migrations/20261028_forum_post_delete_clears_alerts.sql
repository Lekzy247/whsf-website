-- WHSF Forum: deleting a post also removes the alerts that point to it (owner deleted a 'testing' post 2026-10-16;
-- its 4 'WHSF Projects posted' alerts were left pointing at a missing post). Also removes any such orphan alerts.

create or replace function public.forum_post_delete_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from forum_notifications where link = '#post/' || old.id;
  return null;
end $$;
drop trigger if exists forum_posts_delete_alerts on public.forum_posts;
create trigger forum_posts_delete_alerts after delete on public.forum_posts
  for each row execute function public.forum_post_delete_alerts();
delete from forum_notifications n where n.link like '#post/%'
  and not exists (select 1 from forum_posts p where '#post/' || p.id = n.link);
