-- WHSF Forum part 4: member adverts (approved by WHSF before they show) and invite links.
-- Adverts are free while WHSF has no payment system; every new or edited advert is reviewed first.

create table if not exists public.forum_ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  headline text not null check (char_length(btrim(headline)) between 3 and 80),
  body text not null check (char_length(btrim(body)) between 10 and 200),
  link_url text not null check (link_url ~ '^https://\S+$' and char_length(link_url) between 12 and 500),
  cta text not null default 'Learn more' check (char_length(btrim(cta)) between 2 and 24),
  image_url text check (image_url is null or image_url like 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/%'),
  status text not null default 'pending' check (status in ('pending', 'live', 'paused', 'rejected', 'ended')),
  review_note text check (review_note is null or char_length(review_note) <= 300),
  approved_at timestamptz,
  ends_at timestamptz not null default (now() + interval '30 days'),
  views integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forum_ads_live_idx on public.forum_ads (status, ends_at);
create index if not exists forum_ads_owner_idx on public.forum_ads (owner_id, created_at desc);

alter table public.forum_ads enable row level security;
revoke all on public.forum_ads from anon, authenticated;
drop policy if exists "Owners and moderators read ads" on public.forum_ads;
create policy "Owners and moderators read ads" on public.forum_ads for select to authenticated
  using (owner_id = auth.uid() or public.whsf_is_staff());
drop policy if exists "Members create ads" on public.forum_ads;
create policy "Members create ads" on public.forum_ads for insert to authenticated
  with check (owner_id = auth.uid() and public.forum_is_member());
drop policy if exists "Owners and moderators update ads" on public.forum_ads;
create policy "Owners and moderators update ads" on public.forum_ads for update to authenticated
  using (owner_id = auth.uid() or public.whsf_is_staff()) with check (owner_id = auth.uid() or public.whsf_is_staff());
drop policy if exists "Owners delete ads" on public.forum_ads;
create policy "Owners delete ads" on public.forum_ads for delete to authenticated
  using (owner_id = auth.uid() or public.whsf_is_staff());
grant select, insert, update, delete on public.forum_ads to authenticated;

-- Guard: new ads start pending (max 3 pending/live per member); owners can pause/resume an approved ad,
-- but any change to the wording, link or picture sends it back for review. Counters are server-only.
create or replace function public.forum_ads_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from forum_ads where owner_id = new.owner_id and status in ('pending', 'live', 'paused')) >= 3 then
      raise exception 'You can have up to 3 adverts at a time. Pause or delete one first.';
    end if;
    new.status := 'pending'; new.review_note := null; new.approved_at := null;
    new.views := 0; new.clicks := 0; new.created_at := now(); new.ends_at := now() + interval '30 days';
  elsif not public.whsf_is_staff() then
    new.owner_id := old.owner_id; new.views := old.views; new.clicks := old.clicks;
    new.review_note := old.review_note; new.approved_at := old.approved_at; new.ends_at := old.ends_at;
    if (new.headline, new.body, new.link_url, new.cta, coalesce(new.image_url, '')) is distinct from
       (old.headline, old.body, old.link_url, old.cta, coalesce(old.image_url, '')) then
      new.status := 'pending'; new.approved_at := null;
    elsif new.status is distinct from old.status then
      if not ((old.status = 'live' and new.status = 'paused') or (old.status = 'paused' and new.status = 'live' and old.approved_at is not null)) then
        new.status := old.status;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists forum_ads_guard on public.forum_ads;
create trigger forum_ads_guard before insert or update on public.forum_ads for each row execute function public.forum_ads_guard();
revoke all on function public.forum_ads_guard() from public, anon, authenticated;

-- Live adverts for the Forum's "Sponsored" slot (members only), a few at random.
create or replace function public.forum_ads_now(p_limit integer default 1)
returns table (id uuid, headline text, body text, link_url text, cta text, image_url text)
language sql volatile security definer set search_path = public as $$
  select a.id, a.headline, a.body, a.link_url, a.cta, a.image_url
  from forum_ads a
  where public.forum_is_member() and a.status = 'live' and a.ends_at > now() and a.owner_id <> auth.uid()
  order by random() limit least(greatest(coalesce(p_limit, 1), 1), 3);
$$;
revoke all on function public.forum_ads_now(integer) from public, anon;
grant execute on function public.forum_ads_now(integer) to authenticated;

-- Count a view or click (not your own adverts).
create or replace function public.forum_ad_event(p_ad uuid, p_kind text)
returns void language sql security definer set search_path = public as $$
  update forum_ads set
    views = views + case when p_kind = 'view' then 1 else 0 end,
    clicks = clicks + case when p_kind = 'click' then 1 else 0 end
  where id = p_ad and status = 'live' and owner_id <> auth.uid() and public.forum_is_member() and p_kind in ('view', 'click');
$$;
revoke all on function public.forum_ad_event(uuid, text) from public, anon;
grant execute on function public.forum_ad_event(uuid, text) to authenticated;

create or replace function public.forum_ad_review(p_ad uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a forum_ads;
begin
  if not public.whsf_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select * into a from forum_ads where id = p_ad and status = 'pending';
  if a.id is null then raise exception 'This advert is not waiting for review.'; end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'Give the advertiser a short reason.'; end if;
  update forum_ads set status = case when p_approve then 'live' else 'rejected' end,
    approved_at = case when p_approve then now() else null end,
    ends_at = case when p_approve then now() + interval '30 days' else ends_at end,
    review_note = case when p_approve then null else left(btrim(p_note), 300) end
  where id = p_ad;
  insert into forum_notifications (user_id, kind, body, link)
  values (a.owner_id, case when p_approve then 'advert_approved' else 'advert_rejected' end,
    case when p_approve then 'Your advert "' || left(a.headline, 80) || '" is approved and live for 30 days.'
         else 'Your advert "' || left(a.headline, 80) || '" was not approved: ' || left(btrim(p_note), 160) end,
    '#ads');
end;
$$;
revoke all on function public.forum_ad_review(uuid, boolean, text) from public, anon;
grant execute on function public.forum_ad_review(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------- invites
alter table public.forum_profiles add column if not exists invite_code text unique;

create table if not exists public.forum_invites (
  invitee_id uuid primary key references public.forum_profiles (user_id) on delete cascade,
  inviter_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index if not exists forum_invites_inviter_idx on public.forum_invites (inviter_id);
alter table public.forum_invites enable row level security;
revoke all on public.forum_invites from anon, authenticated;

-- Your invite code (created on first use).
create or replace function public.forum_my_invite()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can invite.' using errcode = '42501'; end if;
  select invite_code into v_code from forum_profiles where user_id = auth.uid();
  if v_code is null then
    loop
      v_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      begin
        update forum_profiles set invite_code = v_code where user_id = auth.uid();
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end if;
  return v_code;
end;
$$;
revoke all on function public.forum_my_invite() from public, anon;
grant execute on function public.forum_my_invite() to authenticated;

-- A new profile records who invited them (once). The inviter is told when they join.
create or replace function public.forum_record_invite(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inviter uuid; v_name text;
begin
  if auth.uid() is null or p_code is null then return; end if;
  select user_id into v_inviter from forum_profiles where invite_code = lower(btrim(p_code));
  if v_inviter is null or v_inviter = auth.uid() then return; end if;
  if not exists (select 1 from forum_profiles where user_id = auth.uid() and created_at > now() - interval '1 day') then return; end if;
  insert into forum_invites (invitee_id, inviter_id) values (auth.uid(), v_inviter) on conflict do nothing;
  if found then
    select display_name into v_name from forum_profiles where user_id = auth.uid();
    insert into forum_notifications (user_id, kind, body, link)
    values (v_inviter, 'invite_joined', left(coalesce(v_name, 'Someone'), 80) || ' joined the WHSF Forum with your invite link.', '#invite');
  end if;
end;
$$;
revoke all on function public.forum_record_invite(text) from public, anon;
grant execute on function public.forum_record_invite(text) to authenticated;

create or replace function public.forum_invite_stats()
returns table (joined bigint, verified bigint)
language sql stable security definer set search_path = public as $$
  select count(*), count(*) filter (where p.verification_status = 'approved')
  from forum_invites i join forum_profiles p on p.user_id = i.invitee_id
  where i.inviter_id = auth.uid();
$$;
revoke all on function public.forum_invite_stats() from public, anon;
grant execute on function public.forum_invite_stats() to authenticated;

-- Fix: let forum_ad_event() update the view/click counters past the owner guard (flag set only inside it).
create or replace function public.forum_ads_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from forum_ads where owner_id = new.owner_id and status in ('pending', 'live', 'paused')) >= 3 then
      raise exception 'You can have up to 3 adverts at a time. Pause or delete one first.';
    end if;
    new.status := 'pending'; new.review_note := null; new.approved_at := null;
    new.views := 0; new.clicks := 0; new.created_at := now(); new.ends_at := now() + interval '30 days';
  elsif coalesce(current_setting('whsf.forum_ad_counter', true), '') = 'on' then
    return new; -- view/click counting from forum_ad_event()
  elsif not public.whsf_is_staff() then
    new.owner_id := old.owner_id; new.views := old.views; new.clicks := old.clicks;
    new.review_note := old.review_note; new.approved_at := old.approved_at; new.ends_at := old.ends_at;
    if (new.headline, new.body, new.link_url, new.cta, coalesce(new.image_url, '')) is distinct from
       (old.headline, old.body, old.link_url, old.cta, coalesce(old.image_url, '')) then
      new.status := 'pending'; new.approved_at := null;
    elsif new.status is distinct from old.status then
      if not ((old.status = 'live' and new.status = 'paused') or (old.status = 'paused' and new.status = 'live' and old.approved_at is not null)) then
        new.status := old.status;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.forum_ads_guard() from public, anon, authenticated;

create or replace function public.forum_ad_event(p_ad uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('view', 'click') or not public.forum_is_member() then return; end if;
  perform set_config('whsf.forum_ad_counter', 'on', true);
  update forum_ads set
    views = views + case when p_kind = 'view' then 1 else 0 end,
    clicks = clicks + case when p_kind = 'click' then 1 else 0 end
  where id = p_ad and status = 'live' and owner_id <> auth.uid();
  perform set_config('whsf.forum_ad_counter', 'off', true);
end;
$$;
revoke all on function public.forum_ad_event(uuid, text) from public, anon;
grant execute on function public.forum_ad_event(uuid, text) to authenticated;
