-- WHSF Forum: more post reactions (Care, Wow, Sad, Applause, Thank you) alongside the original six.
alter table public.forum_reactions drop constraint if exists forum_reactions_kind_check;
alter table public.forum_reactions add constraint forum_reactions_kind_check check (kind in (
  'like', 'love', 'celebrate', 'support', 'insightful', 'funny', 'care', 'wow', 'sad', 'applause', 'thanks'));
