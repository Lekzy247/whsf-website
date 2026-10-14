-- WHSF Forum: space pages. Membership lists, space moderators (appointed by WHSF), featured discussions,
-- resources and space events.

-- Members can see who has joined a space (like a group's member list).
drop policy if exists "Spaces: own memberships" on public.forum_space_members;
drop policy if exists "Spaces: members read memberships" on public.forum_space_members;
create policy "Spaces: members read memberships" on public.forum_space_members for select to authenticated
  using (user_id = auth.uid() or public.forum_is_member() or public.forum_is_staff());

-- Space moderators: appointed and removed by WHSF moderators.
create table if not exists public.forum_space_moderators (
  space text not null check (space in ('exchange', 'jobs', 'conferences', 'women_tech', 'ngos', 'grants', 'mentorship',
    'volunteering', 'digital_ai', 'media_literacy')),
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (space, user_id)
);
alter table public.forum_space_moderators enable row level security;
revoke all on public.forum_space_moderators from anon, authenticated;
grant select, insert, delete on public.forum_space_moderators to authenticated;
drop policy if exists "Space mods: members read" on public.forum_space_moderators;
create policy "Space mods: members read" on public.forum_space_moderators for select to authenticated using (public.forum_is_member() or public.forum_is_staff());
drop policy if exists "Space mods: WHSF appoints" on public.forum_space_moderators;
create policy "Space mods: WHSF appoints" on public.forum_space_moderators for insert to authenticated with check (public.forum_is_staff() and added_by = auth.uid());
drop policy if exists "Space mods: WHSF removes" on public.forum_space_moderators;
create policy "Space mods: WHSF removes" on public.forum_space_moderators for delete to authenticated using (public.forum_is_staff());

create or replace function public.forum_is_space_mod(p_space text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.forum_is_staff() or (public.forum_is_member() and exists (
    select 1 from public.forum_space_moderators m where m.space = p_space and m.user_id = auth.uid()));
$$;
revoke all on function public.forum_is_space_mod(text) from public, anon;
grant execute on function public.forum_is_space_mod(text) to authenticated;

-- Featured discussions (chosen by WHSF or the space's moderators).
alter table public.forum_posts add column if not exists featured_at timestamptz;
create index if not exists forum_posts_featured_idx on public.forum_posts (topic, featured_at desc) where featured_at is not null;

create or replace function public.forum_feature_post(p_post uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_topic text;
begin
  select topic into v_topic from forum_posts where id = p_post and not is_hidden;
  if v_topic is null then raise exception 'Post not found.'; end if;
  if not public.forum_is_space_mod(v_topic) then raise exception 'Only WHSF or this space''s moderators can feature posts.' using errcode = '42501'; end if;
  if p_on and (select count(*) from forum_posts where topic = v_topic and featured_at is not null) >= 10 then
    raise exception 'A space can feature up to 10 posts. Unfeature one first.';
  end if;
  perform set_config('whsf.forum_feature_rpc', 'on', true);
  update forum_posts set featured_at = case when p_on then now() else null end where id = p_post;
  perform set_config('whsf.forum_feature_rpc', 'off', true);
end;
$$;
revoke all on function public.forum_feature_post(uuid, boolean) from public, anon;
grant execute on function public.forum_feature_post(uuid, boolean) to authenticated;

-- Only forum_feature_post may change featured_at (authors and the guard keep it otherwise).
create or replace function public.forum_posts_feature_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.featured_at := null; return new; end if;
  if coalesce(current_setting('whsf.forum_feature_rpc', true), '') <> 'on' then new.featured_at := old.featured_at; end if;
  return new;
end;
$$;
drop trigger if exists forum_posts_feature_guard on public.forum_posts;
create trigger forum_posts_feature_guard before insert or update on public.forum_posts
  for each row execute function public.forum_posts_feature_guard();

-- Space resources: useful links added by WHSF or the space's moderators.
create table if not exists public.forum_space_resources (
  id uuid primary key default gen_random_uuid(),
  space text not null check (space in ('exchange', 'jobs', 'conferences', 'women_tech', 'ngos', 'grants', 'mentorship',
    'volunteering', 'digital_ai', 'media_literacy')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 500),
  about text check (about is null or char_length(about) <= 240),
  kind text not null default 'website' check (kind in ('guide', 'toolkit', 'course', 'website', 'template', 'report', 'portal')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.forum_space_resources enable row level security;
revoke all on public.forum_space_resources from anon, authenticated;
grant select, insert, delete on public.forum_space_resources to authenticated;
drop policy if exists "Space resources: members read" on public.forum_space_resources;
create policy "Space resources: members read" on public.forum_space_resources for select to authenticated using (public.forum_is_member() or public.forum_is_staff());
drop policy if exists "Space resources: moderators add" on public.forum_space_resources;
create policy "Space resources: moderators add" on public.forum_space_resources for insert to authenticated with check (public.forum_is_space_mod(space) and added_by = auth.uid());
drop policy if exists "Space resources: moderators remove" on public.forum_space_resources;
create policy "Space resources: moderators remove" on public.forum_space_resources for delete to authenticated using (public.forum_is_space_mod(space));

-- Starter resources (WHSF's own pages and official public portals).
insert into public.forum_space_resources (space, title, url, about, kind)
select * from (values
  ('grants', 'WHSF Grants portal', 'https://www.worldhsfoundation.org/grants.html', 'Search open grants with deadline reminders and matching.', 'portal'),
  ('grants', 'Grants.gov', 'https://www.grants.gov', 'The official US federal grants database.', 'portal'),
  ('grants', 'EU Funding & Tenders Portal', 'https://ec.europa.eu/info/funding-tenders/opportunities/portal', 'Official European Union funding calls.', 'portal'),
  ('media_literacy', 'WHSF MIL Lab', 'https://www.worldhsfoundation.org/mil-lab.html', 'Spot, verify, create, amplify: the WHSF media literacy programme.', 'course'),
  ('media_literacy', 'UNESCO Media and Information Literacy', 'https://www.unesco.org/en/media-information-literacy', 'UNESCO''s global MIL programme and resources.', 'guide'),
  ('women_tech', 'WHSF programmes', 'https://www.worldhsfoundation.org/programs.html', 'Digital skills and ICT programmes, including Girls in ICT.', 'course'),
  ('digital_ai', 'WHSF programmes', 'https://www.worldhsfoundation.org/programs.html', 'Hands-on digital skills, drones and AI training.', 'course'),
  ('volunteering', 'UN Volunteers', 'https://www.unv.org', 'Volunteer with the United Nations, online or on assignment.', 'portal'),
  ('ngos', 'Partner with WHSF', 'https://www.worldhsfoundation.org/corporate-partnerships.html', 'Ways organisations can partner with WHSF.', 'guide'),
  ('jobs', 'UN Careers', 'https://careers.un.org', 'Official United Nations job openings.', 'portal')
) as v(space, title, url, about, kind)
where not exists (select 1 from public.forum_space_resources r where r.space = v.space and r.url = v.url);

-- Events can belong to a space (shown on that space's page).
alter table public.forum_events add column if not exists space text check (space is null or space in ('exchange', 'jobs', 'conferences',
  'women_tech', 'ngos', 'grants', 'mentorship', 'volunteering', 'digital_ai', 'media_literacy'));
