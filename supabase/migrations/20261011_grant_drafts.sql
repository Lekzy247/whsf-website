-- WHSF Grant Portal phase 4: proposal drafts saved with a tracked grant.
-- Drafts are written by the organisation (from a pre-filled template); WHSF runs no AI.
alter table public.whsf_grant_saved
  add column if not exists draft text not null default '' check (char_length(draft) <= 40000),
  add column if not exists draft_updated_at timestamptz;
