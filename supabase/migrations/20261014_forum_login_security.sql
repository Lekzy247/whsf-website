-- WHSF Forum: confirm it's really the member when a sign-in looks suspicious.
-- Every sign-in session must be "trusted" before forum_is_member() lets it read or post:
--   * a device this member used before (random device key kept in the browser, stored here only as a hash),
--     from the same country when the country is known; or
--   * the first device of a brand-new account (created in the last 24 hours); or
--   * otherwise a strong confirmation in this session: the 6-digit email code / email link
--     (Supabase email OTP), or the authenticator app (Supabase MFA, aal2) when the member has turned it on.
--     Members with an authenticator app must use it; the email code is not enough for them.
-- Signing out other devices (auth.sessions removed) immediately ends their Forum access.

create table if not exists public.forum_trusted_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('new_account', 'known_device', 'email_code', 'authenticator')),
  country text,
  trusted_at timestamptz not null default now()
);
create index if not exists forum_trusted_sessions_user_idx on public.forum_trusted_sessions (user_id);
alter table public.forum_trusted_sessions enable row level security;
revoke all on public.forum_trusted_sessions from anon, authenticated;

create table if not exists public.forum_known_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(label) <= 120),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_country text check (last_country is null or last_country ~ '^[A-Z]{2}$'),
  primary key (user_id, device_hash)
);
alter table public.forum_known_devices enable row level security;
revoke all on public.forum_known_devices from anon, authenticated;
grant select, delete on public.forum_known_devices to authenticated;
drop policy if exists "Known devices: own" on public.forum_known_devices;
create policy "Known devices: own" on public.forum_known_devices for select to authenticated using (user_id = auth.uid());
drop policy if exists "Known devices: remove own" on public.forum_known_devices;
create policy "Known devices: remove own" on public.forum_known_devices for delete to authenticated using (user_id = auth.uid());

-- Is the current sign-in session trusted (and still signed in)?
create or replace function public.forum_session_trusted()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.forum_trusted_sessions t
    join auth.sessions s on s.id = t.session_id and s.user_id = t.user_id
    where t.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid and t.user_id = auth.uid()
  );
$$;

create or replace function public.forum_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.forum_profiles p
    where p.user_id = auth.uid() and not p.is_suspended and p.verification_status = 'approved'
  ) and public.forum_session_trusted();
$$;

alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security']));

-- Called by the Forum page after every sign-in. Returns status 'ok' (session trusted) or 'verify' with the
-- method the member must use: 'email' (6-digit code / link) or 'authenticator'.
create or replace function public.forum_session_check(p_device text, p_label text default null)
returns table (status text, method text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_amr jsonb := coalesce(auth.jwt() -> 'amr', '[]'::jsonb);
  v_hash text; v_country text; v_totp boolean; v_new_account boolean; v_strong text; v_method text;
  d public.forum_known_devices;
begin
  if v_uid is null or v_sid is null then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'Invalid device key.'; end if;
  if not exists (select 1 from auth.sessions where id = v_sid and user_id = v_uid) then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  v_hash := encode(extensions.digest(p_device, 'sha256'), 'hex');
  begin
    v_country := upper(nullif(current_setting('request.headers', true)::json ->> 'cf-ipcountry', ''));
  exception when others then v_country := null; end;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' or v_country in ('XX', 'T1') then v_country := null; end if;

  -- Forget sessions that have ended.
  delete from forum_trusted_sessions t where t.user_id = v_uid and not exists (select 1 from auth.sessions s where s.id = t.session_id);

  if exists (select 1 from forum_trusted_sessions where session_id = v_sid and user_id = v_uid) then
    update forum_known_devices set last_seen = now(), last_country = coalesce(v_country, last_country)
      where user_id = v_uid and device_hash = v_hash;
    return query select 'ok'::text, null::text; return;
  end if;

  select exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified' and f.factor_type = 'totp') into v_totp;
  select (u.created_at > now() - interval '24 hours') into v_new_account from auth.users u where u.id = v_uid;
  v_strong := case
    when auth.jwt() ->> 'aal' = 'aal2' then 'authenticator'
    when not v_totp and (v_amr @> '[{"method":"otp"}]' or v_amr @> '[{"method":"magiclink"}]' or v_amr @> '[{"method":"recovery"}]'
                         or v_amr @> '[{"method":"email/signup"}]' or v_amr @> '[{"method":"invite"}]') then 'email_code'
    else null end;
  select * into d from forum_known_devices k where k.user_id = v_uid and k.device_hash = v_hash;

  if d.user_id is not null and (v_country is null or d.last_country is null or d.last_country = v_country) then v_method := 'known_device';
  elsif v_strong is not null then v_method := v_strong;
  elsif v_new_account and not exists (select 1 from forum_known_devices k where k.user_id = v_uid) then v_method := 'new_account';
  else
    return query select 'verify'::text, case when v_totp then 'authenticator' else 'email' end; return;
  end if;

  insert into forum_trusted_sessions (session_id, user_id, method, country) values (v_sid, v_uid, v_method, v_country)
    on conflict (session_id) do nothing;
  insert into forum_known_devices (user_id, device_hash, label, last_country) values (v_uid, v_hash, left(nullif(btrim(p_label), ''), 120), v_country)
    on conflict (user_id, device_hash) do update set last_seen = now(), last_country = coalesce(excluded.last_country, forum_known_devices.last_country),
      label = coalesce(excluded.label, forum_known_devices.label);
  if v_method in ('email_code', 'authenticator') and exists (select 1 from forum_profiles p where p.user_id = v_uid) then
    insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (v_uid, 'security', v_uid,
      'New sign-in confirmed' || coalesce(' from ' || left(nullif(btrim(p_label), ''), 60), '') || coalesce(' (' || v_country || ')', '')
        || '. If this was not you, change your password and sign out other devices under Me → Security.', '#me');
  end if;
  return query select 'ok'::text, v_method;
end;
$$;
revoke all on function public.forum_session_check(text, text) from public, anon;
grant execute on function public.forum_session_check(text, text) to authenticated;
revoke all on function public.forum_session_trusted() from public, anon;
grant execute on function public.forum_session_trusted() to authenticated;
