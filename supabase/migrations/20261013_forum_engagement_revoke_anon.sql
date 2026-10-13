-- Forum engagement tables are for signed-in members only (same as the other forum tables).
revoke all on public.forum_reactions, public.forum_comments, public.forum_comment_likes, public.forum_saves from anon;
