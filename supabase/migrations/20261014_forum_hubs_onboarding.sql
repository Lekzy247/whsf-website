-- WHSF Forum 2.0: getting-started journey (interests, joined spaces) and saved funding opportunities.

-- Interests chosen during onboarding (used for suggestions and matching later).
alter table public.forum_profiles add column if not exists interests text[] not null default '{}';
alter table public.forum_profiles drop constraint if exists forum_profiles_interests_check;
alter table public.forum_profiles add constraint forum_profiles_interests_check check (
  cardinality(interests) <= 14 and interests <@ array['education', 'digital_skills', 'stem', 'ai', 'youth', 'women_girls',
    'health', 'climate', 'agriculture', 'humanitarian', 'economic_development', 'media_literacy', 'peacebuilding', 'entrepreneurship']);

-- Spaces a member has joined.
create table if not exists public.forum_space_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  space text not null check (space in ('exchange', 'jobs', 'conferences', 'women_tech', 'ngos', 'grants', 'mentorship',
    'volunteering', 'digital_ai', 'media_literacy')),
  joined_at timestamptz not null default now(),
  primary key (user_id, space)
);
alter table public.forum_space_members enable row level security;
revoke all on public.forum_space_members from anon, authenticated;
grant select, insert, delete on public.forum_space_members to authenticated;
drop policy if exists "Spaces: own memberships" on public.forum_space_members;
create policy "Spaces: own memberships" on public.forum_space_members for select to authenticated using (user_id = auth.uid());
drop policy if exists "Spaces: join" on public.forum_space_members;
create policy "Spaces: join" on public.forum_space_members for insert to authenticated with check (user_id = auth.uid() and public.forum_is_member());
drop policy if exists "Spaces: leave" on public.forum_space_members;
create policy "Spaces: leave" on public.forum_space_members for delete to authenticated using (user_id = auth.uid());

-- Member counts per space (numbers only, not who).
create or replace function public.forum_space_counts()
returns table (space text, members bigint)
language sql stable security definer set search_path = public as $$
  select m.space, count(*) from public.forum_space_members m
  join public.forum_profiles p on p.user_id = m.user_id and p.verification_status = 'approved' and not p.is_suspended
  where public.forum_is_member()
  group by m.space;
$$;
revoke all on function public.forum_space_counts() from public, anon;
grant execute on function public.forum_space_counts() to authenticated;

-- Funding opportunities a member saved from the Forum funding finder.
create table if not exists public.forum_saved_opportunities (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.whsf_opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
alter table public.forum_saved_opportunities enable row level security;
revoke all on public.forum_saved_opportunities from anon, authenticated;
grant select, insert, delete on public.forum_saved_opportunities to authenticated;
drop policy if exists "Saved funding: own" on public.forum_saved_opportunities;
create policy "Saved funding: own" on public.forum_saved_opportunities for select to authenticated using (user_id = auth.uid());
drop policy if exists "Saved funding: save" on public.forum_saved_opportunities;
create policy "Saved funding: save" on public.forum_saved_opportunities for insert to authenticated with check (user_id = auth.uid() and public.forum_is_member());
drop policy if exists "Saved funding: remove" on public.forum_saved_opportunities;
create policy "Saved funding: remove" on public.forum_saved_opportunities for delete to authenticated using (user_id = auth.uid());
