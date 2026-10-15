-- WHSF Forum: link safety guard + alerts for official WHSF posts (owner request 2026-10-15).
--
-- 1. Link safety: forum_link_risk(text) names the first risky link in a text, or returns null. Risky = link shortener,
--    raw IP address, disguised (punycode) domain, address with a hidden "user@" part, a look-alike of WHSF / Gelllez /
--    PayPal, a direct program download, or a WhatsApp / Telegram invite (WHSF never recruits or pays through those).
--    Posts and comments from non-staff with such a link are HELD (hidden, reversible) for a moderator; the author and
--    WHSF staff get an alert. Private messages with such a link are refused with a plain explanation.
-- 2. Official posts: when an official WHSF account (forum_is_official) publishes a visible post, every approved member
--    gets an in-app alert, and api/official-post-email is called (pg_net) to email members who have not unsubscribed.
--    The call carries a secret kept in Supabase Vault ('whsf_official_alert_secret'); the endpoint reads the post and
--    recipients through forum_official_post_mail, which checks the sync secret (forum_job_sync_ok) and sends once only.

create or replace function public.forum_link_risk(p_text text)
returns text language plpgsql immutable set search_path = public as $$
declare m text[]; url text; host text; path text;
begin
  -- full links, plus bare shortener / chat-invite addresses written without https:// (e.g. "t.me/xyz")
  for m in select regexp_matches(coalesce(p_text, ''),
      '((?:https?://|www\.)[^\s<>"''()\]]+|\m(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|cutt\.ly|rb\.gy|shorturl\.at|tiny\.cc|rebrand\.ly|t\.ly|wa\.me|t\.me|telegram\.me|chat\.whatsapp\.com)/[^\s<>"''()\]]*)', 'gi') loop
    url := lower(m[1]);
    if url !~ '^https?://' then url := 'http://' || url; end if;
    if url ~ '^https?://[^/?#]*@' then return 'a link that hides its real address'; end if;
    host := regexp_replace(substring(url from '^https?://([^/?#:]+)'), '^www\.', '');
    path := coalesce(substring(url from '^https?://[^/?#]+([^?#]*)'), '');
    if host is null then continue; end if;
    if host ~ '^\d{1,3}(\.\d{1,3}){3}$' then return 'a link to a raw IP address'; end if;
    if host ~ '(^|\.)xn--' then return 'a disguised (look-alike) web address'; end if;
    if host in ('bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc',
                'rebrand.ly', 's.id', 't.ly', 'v.gd', 'bitly.com', 'buff.ly', 'lnkd.in', 'shorte.st', 'adf.ly', 'qr.ae')
      then return 'a link shortener (it hides where the link really goes)'; end if;
    if host in ('wa.me', 'chat.whatsapp.com', 'api.whatsapp.com', 't.me', 'telegram.me', 'telegram.org')
      then return 'a WhatsApp or Telegram invite (WHSF never recruits or pays through private chats)'; end if;
    if host ~ '(worldhs|whsf|gelllez|paypal)' and host !~ '(^|\.)(worldhsfoundation\.org|gelllez\.com|paypal\.com)$'
      then return 'a web address that imitates WHSF, Gelllez or PayPal'; end if;
    if path ~ '\.(exe|apk|scr|msi|bat|cmd|jar|vbs|ps1|dmg|pif)$' then return 'a direct program download'; end if;
  end loop;
  return null;
end $$;

create or replace function public.forum_staff_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select u.id from auth.users u where (u.raw_app_meta_data ->> 'role') in ('admin', 'teacher');
$$;
revoke all on function public.forum_staff_ids() from public, anon, authenticated;

-- 'held' = link held for review, 'official_post' = new post from WHSF
alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security', 'mention', 'connect_request',
  'connect_accepted', 'collab_invite', 'collab_accepted', 'org_verified', 'org_rejected', 'job_application',
  'application_update', 'mentor_request', 'mentor_accepted', 'mentor_declined', 'mentor_session', 'factcheck_request',
  'factcheck_answered', 'held', 'official_post']));

create or replace function public.forum_hold_risky_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text; what text := case when tg_table_name = 'forum_posts' then 'post' else 'comment' end;
begin
  if public.forum_is_staff() then return new; end if;
  if tg_op = 'UPDATE' and new.body is not distinct from old.body then return new; end if;
  r := public.forum_link_risk(new.body);
  if r is null then return new; end if;
  new.is_hidden := true;
  if tg_table_name = 'forum_posts' then new.hidden_reason := left('Held for a link safety check: ' || r, 300); end if;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (new.author_id, 'held', new.author_id,
      left('Your ' || what || ' is waiting for a WHSF moderator because it contains ' || r || '.', 300), '#feed');
  insert into forum_notifications (user_id, kind, actor_id, body, link)
    select s, 'held', new.author_id,
      left('A ' || what || ' was held for a link check: ' || r || '. Moderators can review it in the feed.', 300), '#feed'
    from public.forum_staff_ids() s where s <> new.author_id;
  return new;
end $$;

drop trigger if exists forum_posts_link_guard on public.forum_posts;
create trigger forum_posts_link_guard before insert or update of body on public.forum_posts
  for each row execute function public.forum_hold_risky_post();
drop trigger if exists forum_comments_link_guard on public.forum_comments;
create trigger forum_comments_link_guard before insert or update of body on public.forum_comments
  for each row execute function public.forum_hold_risky_post();

create or replace function public.forum_block_risky_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if public.forum_is_staff() then return new; end if;
  r := public.forum_link_risk(new.body);
  if r is not null then
    raise exception 'This message was not sent because it contains %. Share the full, official website address instead.', r
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists forum_messages_link_guard on public.forum_messages;
create trigger forum_messages_link_guard before insert on public.forum_messages
  for each row execute function public.forum_block_risky_message();

-- Email opt-out for WHSF updates (one-click link in every email).
alter table public.forum_profiles add column if not exists email_official_updates boolean not null default true;

create table if not exists public.forum_official_emails (
  post_id uuid primary key references public.forum_posts(id) on delete cascade,
  sent_at timestamptz not null default now(),
  recipients integer not null default 0
);
alter table public.forum_official_emails enable row level security;
revoke all on public.forum_official_emails from anon, authenticated;

create or replace function public.forum_official_post_alert()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare who text; snippet text; secret text;
begin
  if new.is_hidden or not public.forum_is_official(new.author_id) then return null; end if;
  select display_name into who from forum_profiles where user_id = new.author_id;
  snippet := btrim(regexp_replace(regexp_replace(new.body, '\*\*|__|\{/?[cf](:[a-z0-9_-]+)?\}', '', 'g'), '\s+', ' ', 'g'));
  insert into forum_notifications (user_id, kind, actor_id, body, link)
    select p.user_id, 'official_post', new.author_id,
      left(coalesce(who, 'WHSF') || ' posted: ' || coalesce(nullif(snippet, ''), 'a new update'), 300), '#post/' || new.id
    from forum_profiles p
    where p.user_id <> new.author_id and p.verification_status = 'approved' and not p.is_suspended;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'whsf_official_alert_secret';
  if secret is not null then
    perform net.http_post(
      url := 'https://www.worldhsfoundation.org/api/official-post-email',
      body := jsonb_build_object('post_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-WHSF-Secret', secret),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
drop trigger if exists forum_posts_official_alert on public.forum_posts;
create trigger forum_posts_official_alert after insert on public.forum_posts
  for each row execute function public.forum_official_post_alert();

-- Called by api/official-post-email (sync secret). Returns the post and the recipients once; later calls get nothing.
create or replace function public.forum_official_post_mail(p_secret text, p_post uuid)
returns table (author_name text, body text, image_url text, user_id uuid, email text, display_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from forum_posts x where x.id = p_post and not x.is_hidden and public.forum_is_official(x.author_id)) then return; end if;
  insert into forum_official_emails (post_id) values (p_post) on conflict do nothing;
  if not found then return; end if;
  return query
    select a.display_name, x.body, x.image_url, p.user_id, u.email::text, p.display_name
    from forum_posts x
    join forum_profiles a on a.user_id = x.author_id
    join forum_profiles p on p.user_id <> x.author_id and p.verification_status = 'approved' and not p.is_suspended and p.email_official_updates
    join auth.users u on u.id = p.user_id and u.email_confirmed_at is not null
    where x.id = p_post;
end $$;
revoke all on function public.forum_official_post_mail(text, uuid) from public;
grant execute on function public.forum_official_post_mail(text, uuid) to anon, authenticated;

create or replace function public.forum_official_mail_sent(p_secret text, p_post uuid, p_count integer)
returns void language sql security definer set search_path = public as $$
  update forum_official_emails set recipients = greatest(p_count, 0) where post_id = p_post and public.forum_job_sync_ok(p_secret);
$$;
revoke all on function public.forum_official_mail_sent(text, uuid, integer) from public;
grant execute on function public.forum_official_mail_sent(text, uuid, integer) to anon, authenticated;

create or replace function public.forum_email_optout(p_secret text, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update forum_profiles set email_official_updates = false where user_id = p_user;
  return found;
end $$;
revoke all on function public.forum_email_optout(text, uuid) from public;
grant execute on function public.forum_email_optout(text, uuid) to anon, authenticated;
