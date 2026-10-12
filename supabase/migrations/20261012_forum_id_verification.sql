-- WHSF Forum: strict age verification with a government photo ID + selfie, reviewed by WHSF moderators.
-- Nobody can read or post in the forum until a moderator approves their ID check (existing members included).
-- ID and selfie images live in a PRIVATE bucket that only moderators can open; the review screen deletes
-- them as soon as a decision is made. We keep only the outcome (country, ID type, status, dates), never the
-- date of birth or the images.

alter table public.forum_profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'approved', 'rejected')),
  add column if not exists verified_at timestamptz,
  add column if not exists verification_reason text check (verification_reason is null or char_length(verification_reason) <= 300);

-- Only approved (and not suspended) profiles count as members.
create or replace function public.forum_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.forum_profiles p
    where p.user_id = auth.uid() and not p.is_suspended and p.verification_status = 'approved'
  );
$$;

-- Members cannot change moderation, consent or verification fields on their own profile.
create or replace function public.forum_profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.whsf_is_staff() then
    new.is_suspended := old.is_suspended;
    new.adult_confirmed_at := old.adult_confirmed_at;
    new.rules_accepted_at := old.rules_accepted_at;
    new.user_id := old.user_id;
    if coalesce(current_setting('whsf.forum_id_rpc', true), '') <> 'on' then
      new.verification_status := old.verification_status;
      new.verified_at := old.verified_at;
      new.verification_reason := old.verification_reason;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.forum_profiles_guard() from public, anon, authenticated;

-- One-time code the member writes on paper and holds up in the selfie (proves the selfie is fresh).
create table if not exists public.forum_id_codes (
  user_id uuid primary key references public.forum_profiles (user_id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.forum_id_codes enable row level security;
revoke all on public.forum_id_codes from anon, authenticated;

create table if not exists public.forum_id_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  country text not null check (char_length(btrim(country)) between 2 and 80),
  id_type text not null check (id_type in ('national_id', 'passport', 'drivers_licence', 'voter_card', 'residence_permit')),
  challenge_code text not null,
  id_front_path text,
  id_back_path text,
  selfie_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  files_deleted_at timestamptz
);
create unique index if not exists forum_id_checks_one_pending on public.forum_id_checks (user_id) where status = 'pending';
create index if not exists forum_id_checks_status_idx on public.forum_id_checks (status, submitted_at);

alter table public.forum_id_checks enable row level security;
revoke all on public.forum_id_checks from anon;
drop policy if exists "Own or moderator reads ID checks" on public.forum_id_checks;
create policy "Own or moderator reads ID checks" on public.forum_id_checks for select to authenticated
  using (user_id = auth.uid() or public.whsf_is_staff());
revoke all on public.forum_id_checks from authenticated;
grant select on public.forum_id_checks to authenticated;
-- No insert/update/delete grants: all changes go through the functions below.

-- Private bucket: 8 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-id-checks', 'forum-id-checks', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Forum ID: owner uploads while unverified" on storage.objects;
create policy "Forum ID: owner uploads while unverified" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'forum-id-checks'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.forum_profiles p where p.user_id = auth.uid()
                and not p.is_suspended and p.verification_status in ('unverified', 'rejected'))
  );
drop policy if exists "Forum ID: moderators view" on storage.objects;
create policy "Forum ID: moderators view" on storage.objects for select to authenticated
  using (bucket_id = 'forum-id-checks' and public.whsf_is_staff());
drop policy if exists "Forum ID: owner or moderator deletes" on storage.objects;
create policy "Forum ID: owner or moderator deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'forum-id-checks' and (
    public.whsf_is_staff()
    or ((storage.foldername(name))[1] = auth.uid()::text
        and not exists (select 1 from public.forum_profiles p where p.user_id = auth.uid() and p.verification_status = 'pending'))));

-- Get (or refresh after 24 hours) the selfie code.
create or replace function public.forum_id_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from forum_profiles where user_id = auth.uid() and not is_suspended
                 and verification_status in ('unverified', 'rejected')) then
    raise exception 'ID verification is not needed for this account right now.';
  end if;
  select code into v_code from forum_id_codes where user_id = auth.uid() and created_at > now() - interval '24 hours';
  if v_code is null then
    v_code := 'WHSF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into forum_id_codes (user_id, code, created_at) values (auth.uid(), v_code, now())
    on conflict (user_id) do update set code = excluded.code, created_at = excluded.created_at;
  end if;
  return v_code;
end;
$$;
revoke all on function public.forum_id_code() from public, anon;
grant execute on function public.forum_id_code() to authenticated;

-- Submit the uploaded ID + selfie for review.
create or replace function public.forum_id_submit(p_country text, p_id_type text, p_front text, p_back text, p_selfie text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_code text; v_path text;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from forum_profiles where user_id = v_uid and not is_suspended
                 and verification_status in ('unverified', 'rejected')) then
    raise exception 'ID verification is not needed for this account right now.';
  end if;
  select code into v_code from forum_id_codes where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_code is null then raise exception 'Your selfie code has expired. Reload the page to get a new one.'; end if;
  if p_front is null or p_selfie is null then raise exception 'Add a photo of your ID and a selfie.'; end if;
  foreach v_path in array array_remove(array[p_front, p_back, p_selfie], null) loop
    if split_part(v_path, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'forum-id-checks' and o.name = v_path and o.owner_id = v_uid::text) then
      raise exception 'An uploaded file is missing. Please add your photos again.';
    end if;
  end loop;
  insert into forum_id_checks (user_id, country, id_type, challenge_code, id_front_path, id_back_path, selfie_path)
  values (v_uid, btrim(p_country), p_id_type, v_code, p_front, p_back, p_selfie);
  delete from forum_id_codes where user_id = v_uid;
  perform set_config('whsf.forum_id_rpc', 'on', true);
  update forum_profiles set verification_status = 'pending', verification_reason = null where user_id = v_uid;
end;
$$;
revoke all on function public.forum_id_submit(text, text, text, text, text) from public, anon;
grant execute on function public.forum_id_submit(text, text, text, text, text) to authenticated;

-- Moderator decision. Approval requires the reviewer to confirm all three checks.
create or replace function public.forum_id_review(p_check_id uuid, p_approve boolean, p_reason text,
  p_age_18_plus boolean default false, p_face_matches boolean default false, p_genuine_id boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.whsf_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select user_id into v_user from forum_id_checks where id = p_check_id and status = 'pending' for update;
  if v_user is null then raise exception 'This check has already been decided.'; end if;
  if p_approve and not (coalesce(p_age_18_plus, false) and coalesce(p_face_matches, false) and coalesce(p_genuine_id, false)) then
    raise exception 'Confirm the ID shows 18+, the selfie matches with the code, and the ID looks genuine before approving.';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give the member a short reason for the rejection.';
  end if;
  update forum_id_checks set status = case when p_approve then 'approved' else 'rejected' end,
    reject_reason = case when p_approve then null else btrim(p_reason) end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_check_id;
  perform set_config('whsf.forum_id_rpc', 'on', true);
  update forum_profiles set
    verification_status = case when p_approve then 'approved' else 'rejected' end,
    verified_at = case when p_approve then now() else null end,
    verification_reason = case when p_approve then null else btrim(p_reason) end
  where user_id = v_user;
end;
$$;
revoke all on function public.forum_id_review(uuid, boolean, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.forum_id_review(uuid, boolean, text, boolean, boolean, boolean) to authenticated;

-- After the review screen deletes the images through the Storage API, it records that here.
create or replace function public.forum_id_files_deleted(p_check_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.whsf_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select * into r from forum_id_checks where id = p_check_id and status <> 'pending';
  if r.id is null then raise exception 'Decide the check first.'; end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'forum-id-checks'
             and o.name in (r.id_front_path, r.id_back_path, r.selfie_path)) then
    raise exception 'The images are still stored. Delete them first.';
  end if;
  update forum_id_checks set id_front_path = null, id_back_path = null, selfie_path = null, files_deleted_at = now()
  where id = p_check_id;
end;
$$;
revoke all on function public.forum_id_files_deleted(uuid) from public, anon;
grant execute on function public.forum_id_files_deleted(uuid) to authenticated;
