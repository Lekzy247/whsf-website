-- WHSF Forum: ask "Confirm it's you" only for a genuinely new device or a new country.
-- Phones in private browsing (and Safari's storage clean-up) lose the random device key, so the same iPhone looked
-- like a new device at every visit. A sign-in from the same kind of device (browser + system) in the same country as
-- one this member confirmed in the last 60 days is now trusted ('known_device_type'). New device types, new
-- countries and devices unused for 60 days still need the email code or authenticator app.
alter table public.forum_trusted_sessions drop constraint if exists forum_trusted_sessions_method_check;
alter table public.forum_trusted_sessions add constraint forum_trusted_sessions_method_check
  check (method = any (array['new_account', 'known_device', 'known_device_type', 'email_code', 'authenticator']));

do $$
declare d text; d2 text;
begin
  d := pg_get_functiondef('public.forum_session_check'::regproc);
  d2 := replace(d,
$q$  if d.user_id is not null and (v_country is null or d.last_country is null or d.last_country = v_country) then v_method := 'known_device';
$q$,
$q$  if d.user_id is not null and (v_country is null or d.last_country is null or d.last_country = v_country) then v_method := 'known_device';
  elsif nullif(btrim(p_label), '') is not null and exists (
      select 1 from forum_known_devices k
      where k.user_id = v_uid and k.label = left(btrim(p_label), 120) and k.last_seen > now() - interval '60 days'
        and (v_country is null or k.last_country is null or k.last_country = v_country)) then v_method := 'known_device_type';
$q$);
  if d2 = d then raise exception 'session check replace did not match'; end if;
  execute d2;
end $$;
