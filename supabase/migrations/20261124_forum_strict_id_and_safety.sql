-- 2026-11-24 Forum safety pass (owner requests):
-- 1. Strict, identity-verifiable ID checks: recorded video for everyone, back of the ID (except passports), legal name,
--    moderator records DOB / expiry / document number; the database refuses under-18s, expired IDs and one ID on
--    two accounts; anything that does not meet the rules is rejected automatically with "why" and "what to do".
-- 2. Members only see what they need: private profile fields hidden from other members, internal helpers locked.
-- 3. Posts, comments and messages: money requests, "pay first" offers, get-rich schemes, betting/adult content
--    are held (posts/comments, moderators alerted) or blocked (messages).

-- ───────────── 1. Strict ID checks ─────────────
alter table public.forum_id_checks
  add column if not exists legal_name text,
  add column if not exists id_number_last4 text,
  add column if not exists id_expires_on date,
  add column if not exists age_verified boolean,
  add column if not exists checklist jsonb,
  add column if not exists auto_rejected boolean not null default false;

-- Salted fingerprints of document numbers, so one ID cannot verify two accounts. Never readable by any client.
create table if not exists public.forum_id_documents (
  check_id uuid primary key references public.forum_id_checks(id) on delete cascade,
  user_id uuid not null,
  doc_hash text not null,
  outcome text not null check (outcome in ('approved', 'underage', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists forum_id_documents_hash on public.forum_id_documents (doc_hash);
alter table public.forum_id_documents enable row level security;
revoke all on public.forum_id_documents from anon, authenticated;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'whsf_id_pepper') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'whsf_id_pepper', 'Salt for Forum ID document fingerprints');
  end if;
end $$;

create or replace function public.forum_id_doc_hash(p_country text, p_id_type text, p_number text)
returns text language sql stable security definer set search_path = public as $$
  select encode(extensions.hmac(
    upper(regexp_replace(coalesce(p_country, ''), '[^A-Za-z]', '', 'g')) || '|' || coalesce(p_id_type, '') || '|' ||
    upper(regexp_replace(coalesce(p_number, ''), '[^A-Za-z0-9]', '', 'g')),
    (select decrypted_secret from vault.decrypted_secrets where name = 'whsf_id_pepper'), 'sha256'), 'hex');
$$;

create or replace function public.forum_id_submit_v3(p_method text, p_country text, p_id_type text, p_legal_name text,
  p_front text, p_back text, p_video text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_code text; v_path text; v_id uuid; v_reason text;
  v_name text := btrim(regexp_replace(coalesce(p_legal_name, ''), '\s+', ' ', 'g'));
  v_recent int; v_rejected int; f jsonb; b jsonb; v jsonb;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_method not in ('video_selfie', 'video_call') then raise exception 'Choose self-service or video call.'; end if;
  if p_id_type not in ('national_id', 'passport', 'drivers_licence', 'voter_card', 'residence_permit') then raise exception 'Choose the type of ID.'; end if;
  if char_length(btrim(coalesce(p_country, ''))) < 2 then raise exception 'Enter the country that issued your ID.'; end if;
  if v_name !~ '^[^ ]{2,}( [^ ]+)+$' or char_length(v_name) > 120 or v_name ~ '[0-9@/\\<>_=+]' then
    raise exception 'Enter your full legal name exactly as it is printed on your ID (first name and surname).';
  end if;
  if not exists (select 1 from forum_profiles where user_id = v_uid and not is_suspended
                 and verification_status in ('unverified', 'rejected')) then
    raise exception 'ID verification is not needed for this account right now.';
  end if;
  select count(*) filter (where submitted_at > now() - interval '30 days'), count(*) filter (where status = 'rejected')
    into v_recent, v_rejected from forum_id_checks where user_id = v_uid;
  if v_rejected >= 5 then
    raise exception 'This account has reached the limit of ID check attempts. Please contact WHSF through the Contact page.';
  end if;
  if v_recent >= 3 then
    raise exception 'You have made 3 ID check attempts in the last 30 days. Please read the guide, wait a few days and try again, or contact WHSF.';
  end if;
  select code into v_code from forum_id_codes where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_code is null then raise exception 'Your verification code has expired. Reload the page to get a new one.'; end if;
  if p_front is null then raise exception 'Add a photo of the front of your ID.'; end if;
  if p_back is null and p_id_type <> 'passport' then raise exception 'Add a photo of the back of your ID. Only passports can skip this.'; end if;
  if p_video is null then raise exception 'Record your video selfie first.'; end if;
  foreach v_path in array array_remove(array[p_front, p_back, p_video], null) loop
    if split_part(v_path, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'forum-id-checks' and o.name = v_path and o.owner_id = v_uid::text) then
      raise exception 'An uploaded file is missing. Please add it again.';
    end if;
  end loop;
  select metadata into f from storage.objects where bucket_id = 'forum-id-checks' and name = p_front;
  select metadata into b from storage.objects where bucket_id = 'forum-id-checks' and name = p_back;
  select metadata into v from storage.objects where bucket_id = 'forum-id-checks' and name = p_video;

  -- Automatic rejection: the files do not meet the rules. Each reason says why and what to do.
  if coalesce(f->>'mimetype', '') !~ '^image/' or (b is not null and coalesce(b->>'mimetype', '') !~ '^image/') then
    v_reason := 'Your ID pictures were not photos. What to do: take clear JPG, PNG or WebP photos of the front and back of your physical ID';
  elsif coalesce(v->>'mimetype', '') !~ '^video/' then
    v_reason := 'A photo was sent instead of a recorded video. What to do: record a 10 to 15 second video selfie holding your ID, saying your full name and code';
  elsif coalesce((v->>'size')::bigint, 0) < 150000 then
    v_reason := 'Your video selfie was too short or empty. What to do: record 10 to 15 seconds in good light, say your full name and code, show the ID front and back, turn your head';
  elsif coalesce((f->>'size')::bigint, 0) < 30000 or (b is not null and coalesce((b->>'size')::bigint, 0) < 30000) then
    v_reason := 'Your ID photo was too small to read. What to do: photograph the whole ID close up, all four corners visible, in good light with no glare';
  elsif b is not null and f->>'eTag' is not null and f->>'eTag' = b->>'eTag' then
    v_reason := 'The same picture was used for the front and the back. What to do: take one photo of the front and a separate photo of the back of your ID';
  end if;

  insert into forum_id_checks (user_id, method, country, id_type, legal_name, challenge_code, id_front_path, id_back_path, selfie_path,
                               status, reject_reason, auto_rejected, reviewed_at)
  values (v_uid, p_method, btrim(p_country), p_id_type, v_name, v_code, p_front, p_back, p_video,
          case when v_reason is null then 'pending' else 'rejected' end, v_reason, v_reason is not null,
          case when v_reason is null then null else now() end)
  returning id into v_id;
  delete from forum_id_codes where user_id = v_uid;
  perform set_config('whsf.forum_id_rpc', 'on', true);
  update forum_profiles set verification_status = case when v_reason is null then 'pending' else 'rejected' end,
    verification_reason = v_reason where user_id = v_uid;
  return case when v_reason is null then 'pending' else 'rejected: ' || v_reason end;
end $$;

create or replace function public.forum_id_review_v2(p_check_id uuid, p_approve boolean, p_reason text, p_dob date, p_expires date,
  p_no_expiry boolean, p_doc_number text, p_checklist jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  c record; v_doc text := upper(regexp_replace(coalesce(p_doc_number, ''), '[^A-Za-z0-9]', '', 'g'));
  v_hash text; v_auto text; v_ok boolean; v_final text; v_underage boolean := false;
  v_keys text[] := array['genuine_original', 'four_corners', 'name_matches', 'face_matches', 'live_video', 'code_spoken', 'same_id_in_video', 'watched_full'];
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select * into c from forum_id_checks where id = p_check_id and status = 'pending' for update;
  if c.id is null then raise exception 'This check has already been decided.'; end if;
  if c.user_id = auth.uid() then raise exception 'You cannot review your own ID check.'; end if;
  if c.method = 'video_call' then v_keys := v_keys || 'call_done'; end if;
  if p_approve then
    if exists (select 1 from unnest(v_keys) k where coalesce((p_checklist ->> k)::boolean, false) is not true) then
      raise exception 'Tick every check before approving. If any check fails, press Reject instead.';
    end if;
    if p_dob is null then raise exception 'Enter the date of birth printed on the ID.'; end if;
    if not coalesce(p_no_expiry, false) and p_expires is null then
      raise exception 'Enter the expiry date on the ID, or tick "This ID has no expiry date".';
    end if;
    if char_length(v_doc) not between 5 and 30 then raise exception 'Enter the ID document number exactly as printed.'; end if;
  end if;
  if p_dob is not null and (p_dob < date '1900-01-01' or p_dob > current_date) then raise exception 'That date of birth is not valid.'; end if;
  if char_length(v_doc) >= 5 then v_hash := public.forum_id_doc_hash(c.country, c.id_type, v_doc); end if;

  -- Automatic rejection rules: they apply even if Approve was pressed.
  if p_dob is not null and p_dob > (current_date - interval '18 years')::date then
    v_underage := true;
    v_auto := 'The date of birth on your ID shows you are under 18, and the WHSF Forum is only for adults. What to do: explore WHSF programmes for young people on worldhsfoundation.org';
  elsif p_expires is not null and not coalesce(p_no_expiry, false) and p_expires < current_date then
    v_auto := 'Your ID has expired. What to do: submit again with a valid, unexpired government ID (national ID, passport, driver''s licence, voter''s card or residence permit)';
  elsif v_hash is not null and exists (select 1 from forum_id_documents d where d.doc_hash = v_hash and d.user_id <> c.user_id and d.outcome in ('approved', 'underage')) then
    v_auto := 'This ID is already linked to another Forum account, and each person may have only one account. What to do: sign in to your existing account, or contact WHSF';
  end if;
  if not p_approve and v_auto is null and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Choose or write the reason for the rejection.';
  end if;
  v_ok := p_approve and v_auto is null;
  v_final := case when v_ok then null else left(coalesce(v_auto, btrim(p_reason)), 300) end;

  update forum_id_checks set status = case when v_ok then 'approved' else 'rejected' end, reject_reason = v_final,
    auto_rejected = v_auto is not null, reviewed_by = auth.uid(), reviewed_at = now(),
    age_verified = case when p_dob is null then null else p_dob <= (current_date - interval '18 years')::date end,
    id_expires_on = p_expires, id_number_last4 = nullif(right(v_doc, 4), ''), checklist = coalesce(p_checklist, '{}'::jsonb)
  where id = c.id;
  if v_hash is not null then
    insert into forum_id_documents (check_id, user_id, doc_hash, outcome)
    values (c.id, c.user_id, v_hash, case when v_ok then 'approved' when v_underage then 'underage' else 'rejected' end)
    on conflict (check_id) do update set doc_hash = excluded.doc_hash, outcome = excluded.outcome;
  end if;
  perform set_config('whsf.forum_id_rpc', 'on', true);
  update forum_profiles set verification_status = case when v_ok then 'approved' else 'rejected' end,
    verified_at = case when v_ok then now() else null end, verification_reason = v_final
  where user_id = c.user_id;
  if v_underage then
    update forum_profiles set is_suspended = true, suspended_at = now(), suspended_reason = 'Under 18 (ID check)' where user_id = c.user_id;
    delete from forum_trusted_sessions where user_id = c.user_id;
  end if;
  return case when v_ok then 'approved' else 'rejected: ' || v_final end;
end $$;

-- A video call that never happened: rejected automatically after 14 days, with what to do.
create or replace function public.forum_id_expire_stale()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with gone as (
    update forum_id_checks set status = 'rejected', auto_rejected = true, reviewed_at = now(),
      reject_reason = 'Your video call was not completed within 14 days. What to do: submit again and book a call time using the booking button, or choose self-service'
    where status = 'pending' and method = 'video_call' and submitted_at < now() - interval '14 days'
    returning user_id, reject_reason)
  select count(*) into n from gone;
  perform set_config('whsf.forum_id_rpc', 'on', true);
  update forum_profiles p set verification_status = 'rejected', verification_reason = c.reject_reason
  from forum_id_checks c where c.user_id = p.user_id and p.verification_status = 'pending' and c.status = 'rejected'
    and c.auto_rejected and c.reviewed_at > now() - interval '1 minute'
    and not exists (select 1 from forum_id_checks x where x.user_id = p.user_id and x.status = 'pending');
  return n;
end $$;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'forum-id-expire-stale') then
    perform cron.schedule('forum-id-expire-stale', '45 6 * * *', 'select public.forum_id_expire_stale()');
  end if;
end $$;

-- A member can tidy up their own files after an automatic rejection; moderators as before.
create or replace function public.forum_id_files_deleted(p_check_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from forum_id_checks where id = p_check_id and status <> 'pending';
  if r.id is null then raise exception 'Decide the check first.'; end if;
  if not (public.forum_is_staff() or r.user_id = auth.uid()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'forum-id-checks'
             and o.name in (r.id_front_path, r.id_back_path, r.selfie_path)) then
    raise exception 'The files are still stored. Delete them first.';
  end if;
  update forum_id_checks set id_front_path = null, id_back_path = null, selfie_path = null, files_deleted_at = now()
  where id = p_check_id;
end $$;

-- The old, looser routes now refuse (an old open tab must refresh).
create or replace function public.forum_id_submit_v2(p_method text, p_country text, p_id_type text, p_front text, p_back text, p_selfie text)
returns void language plpgsql security definer set search_path = public as $$
begin raise exception 'The ID check has been updated. Please refresh the page and try again.'; end $$;
create or replace function public.forum_id_submit(p_country text, p_id_type text, p_front text, p_back text, p_selfie text)
returns void language plpgsql security definer set search_path = public as $$
begin raise exception 'The ID check has been updated. Please refresh the page and try again.'; end $$;
create or replace function public.forum_id_review(p_check_id uuid, p_approve boolean, p_reason text,
  p_age_18_plus boolean default false, p_face_matches boolean default false, p_genuine_id boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin raise exception 'The review screen has been updated. Please refresh the page.'; end $$;

-- A member reads their own rejection reason here (other members can no longer read it).
create or replace function public.forum_my_verification()
returns table(verification_status text, verification_reason text)
language sql stable security definer set search_path = public as $$
  select verification_status, verification_reason from forum_profiles where user_id = auth.uid();
$$;

revoke execute on function public.forum_id_doc_hash(text, text, text) from public, anon, authenticated;
revoke execute on function public.forum_id_expire_stale() from public, anon, authenticated;
revoke execute on function public.forum_id_submit_v3(text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.forum_id_review_v2(uuid, boolean, text, date, date, boolean, text, jsonb) from public, anon;
revoke execute on function public.forum_my_verification() from public, anon;
grant execute on function public.forum_id_submit_v3(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.forum_id_review_v2(uuid, boolean, text, date, date, boolean, text, jsonb) to authenticated;
grant execute on function public.forum_my_verification() to authenticated;

-- ───────────── 2. Members only see what they need ─────────────
-- Other members' private fields (rejection/suspension reasons, invite codes, email settings) are hidden.
revoke select on public.forum_profiles from anon, authenticated;
grant select (user_id, display_name, headline, location, about, avatar_url, is_suspended, created_at, updated_at,
  verification_status, verified_at, interests, skills, experience, portfolio, open_to) on public.forum_profiles to authenticated;

-- Internal helpers and trigger functions cannot be called from the browser.
do $$ declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
revoke execute on function public.whsf_is_personal_email(uuid) from public, anon, authenticated;
revoke execute on function public.forum_user_protected(uuid) from public, anon, authenticated;
revoke execute on function public.forum_is_official(uuid) from public, anon, authenticated;
revoke execute on function public.ai_career_public_live_sessions(timestamptz, timestamptz) from public, anon, authenticated;

-- Only published content is public.
drop policy if exists connect_content_public_read on public.connect_content;
create policy connect_content_public_read on public.connect_content for select
  using (coalesce(published, false) and coalesce(public_visible, true));

-- ───────────── 3. Relevant, scam-free posts, comments and messages ─────────────
create or replace function public.forum_scam_risk(p_text text)
returns text language plpgsql immutable set search_path = public as $$
declare t text := lower(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  if t = '' then return null; end if;
  if t ~ '\m(send|transfer|wire|give|lend|borrow)\s+(me|us)\s+(some\s+|small\s+)?(money|cash|funds|\$|usd|dollars?|naira|ngn|₦|£|€|pounds|euros?|cedis|shillings|rand)'
     or t ~ '\m(send|transfer|wire)\s+(some\s+|the\s+)?(money|cash|funds)\s+(to|into)\s+(me|my)\M'
     or t ~ '\m(borrow|lend)\s+me\M'
     or t ~ '\mmy\s+(bank\s+)?(account\s+(number|details|no\.?)|cash\s?app|zelle|venmo|paypal|momo|mobile money|opay|palmpay|wallet( address)?|btc address|usdt address)'
     or t ~ '\m(send|share|give|drop|provide|inbox|dm)\s+(me\s+)?(your\s+)?(bank\s+(account|details)|account\s+(number|details)|card\s+(number|details)|atm\s+(card|pin)|bvn|otp|cvv|pin\s+code|password|login\s+details)'
     or t ~ '\m(western union|moneygram|world remit|gift ?cards?|itunes cards?|steam cards?|google play cards?|amazon cards?)\M'
     or t ~ '\m(urgent(ly)?|kindly|please|i)\s+(need|needs?|want|beg|request)\s+(for\s+)?(some\s+|small\s+|financial\s+)?(money|cash|funds|financial (help|assistance|support)|loan)\M'
     or t ~ '\m(donate|contribute|support me|help me)\s+(with\s+\S+\s+)?(to|into|via|through)\s+my\s+(account|wallet|cash\s?app|paypal|momo|mobile money)'
  then return 'a request for money or payment details (WHSF members never ask each other for money)'; end if;
  if t ~ '\m(pay|paying|payment of|deposit)\s+(a\s+|an\s+|the\s+|your\s+|small\s+)?(registration|processing|clearance|activation|interview|onboarding|verification|release|transfer|delivery|handling|commitment|security|insurance|form|logistics|approval)\s+(fee|fees|charges?|levy)\M'
     or t ~ '\m(registration|processing|clearance|activation|commitment|release|application|verification)\s+fees?\s+(of\s+)?(\$|£|€|₦|usd|ngn|n|gbp|eur)\s?\d'
     or t ~ '\m(pay|payment|deposit)\s+(to|before|for)\s+(get|secure|receive|claim|process|release|unlock)\w*\s+(the\s+|your\s+|a\s+)?(job|visa|grant|scholarship|award|prize|funds|loan|certificate|admission|offer|placement)'
     or t ~ '\mclaim\s+(your|the)\s+(prize|winnings|funds|grant|award|reward)\M'
     or t ~ '\myou\s+(have\s+)?(won|been selected)\M.{0,80}\m(prize|lottery|grant|award|funds|cash)\M'
     or t ~ '\mguaranteed\s+(profit|returns?|income|payout|job|visa|admission|scholarship|grant|approval)\M'
  then return 'a "pay first" or prize offer (WHSF never charges fees for jobs, grants, visas or scholarships)'; end if;
  if t ~ '\m(double|triple|multiply|grow)\s+your\s+(money|investment|income|capital)\M'
     or t ~ '\m(invest(ment|ing)?|trading|signals?|profits?|returns?|earn(ing)?|mining)\M.{0,40}\m(forex|binary options?|crypto(currency)?|bitcoin|btc|usdt|ethereum|eth|nft|ponzi)\M'
     or t ~ '\m(forex|binary options?|crypto(currency)?|bitcoin|btc|usdt|ethereum)\M.{0,40}\m(invest(ment|ing)?|trading|signals?|profits?|returns?|earn|account manager|mining)\M'
     or t ~ '\mearn\s+(up to\s+)?(\$|£|€|₦|usd\s?)?\d[\d,.]*\s*k?\s*(\$|usd|dollars?|naira|pounds|euros?)?\s*(daily|weekly|per day|a day|per week|a week|every day|every week)\M'
     or t ~ '\m(loan|loans)\s+(offer|available|approved|without collateral|in \d+ (minutes|hours))'
     or t ~ '\m(network marketing|mlm|pyramid scheme|recruit (\d+|two|three) people)\M'
  then return 'an investment, trading or "get rich" offer, which is not allowed on the WHSF Forum'; end if;
  if t ~ '\m(sugar\s+(mummy|mommy|daddy|baby)|hook\s?ups?|escorts?|onlyfans|nudes|18\+\s+content|adult content|dating site)\M'
     or t ~ '\m(bet9ja|sportybet|betking|1xbet|betway|fixed (match|matches|odds)|betting tips|sure odds|casino bonus)\M'
     or t ~ '\m(buy|sell|selling|cheap)\s+(instagram\s+|tiktok\s+|facebook\s+)?(followers|likes|accounts|views)\M'
  then return 'content that is not relevant to WHSF (betting, adult, dating or buying followers)'; end if;
  return null;
end $$;

create or replace function public.forum_hold_risky_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text; what text := case when tg_table_name = 'forum_posts' then 'post' else 'comment' end;
  txt text := coalesce(new.body, '') || ' ' || coalesce(to_jsonb(new) ->> 'collab_need', '');
begin
  if public.forum_is_staff() then return new; end if;
  if tg_op = 'UPDATE' and new.body is not distinct from old.body then return new; end if;
  r := coalesce(public.forum_link_risk(txt), public.forum_scam_risk(txt));
  if r is null then return new; end if;
  new.is_hidden := true;
  if tg_table_name = 'forum_posts' then new.hidden_reason := left('Held for a safety check: ' || r, 300); end if;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (new.author_id, 'held', new.author_id,
      left('Your ' || what || ' is hidden and waiting for a WHSF moderator because it contains ' || r || '. Posts must be about education, careers, WHSF programmes or the group topic.', 300), '#rules');
  insert into forum_notifications (user_id, kind, actor_id, body, link)
    select s, 'held', new.author_id,
      left('A ' || what || ' was held for a safety check: ' || r || '. Review it in the feed.', 300), '#feed'
    from public.forum_staff_ids() s where s <> new.author_id;
  return new;
end $$;

create or replace function public.forum_block_risky_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if public.forum_is_staff() then return new; end if;
  r := public.forum_link_risk(new.body);
  if r is not null then
    raise exception 'This message was not sent because it contains %. Share the full, official website address instead.', r using errcode = 'P0001';
  end if;
  r := public.forum_scam_risk(new.body);
  if r is not null then
    raise exception 'This message was not sent because it contains %. If someone asks you for money or payment details, report them to WHSF.', r using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$ declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
