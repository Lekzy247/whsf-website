-- WHSF Forum ID verification: members choose how to confirm their identity (like ID.me).
--   self-service: photo of ID + a short VIDEO selfie (or a photo selfie as a fallback)
--   video call:   photo of ID, then a live Google Meet call with a WHSF moderator (no selfie stored)
-- Every route is still decided by a WHSF moderator; images/videos are deleted after the decision.

alter table public.forum_id_checks
  add column if not exists method text not null default 'photo_selfie'
    check (method in ('photo_selfie', 'video_selfie', 'video_call'));

-- Private bucket now also accepts short selfie videos (phones record ~5-20 MB for 10 seconds).
update storage.buckets
  set file_size_limit = 31457280,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
  where id = 'forum-id-checks';

create or replace function public.forum_id_submit_v2(p_method text, p_country text, p_id_type text, p_front text, p_back text, p_selfie text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_code text; v_path text;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_method not in ('photo_selfie', 'video_selfie', 'video_call') then raise exception 'Choose how to confirm your identity.'; end if;
  if not exists (select 1 from forum_profiles where user_id = v_uid and not is_suspended
                 and verification_status in ('unverified', 'rejected')) then
    raise exception 'ID verification is not needed for this account right now.';
  end if;
  select code into v_code from forum_id_codes where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_code is null then raise exception 'Your verification code has expired. Reload the page to get a new one.'; end if;
  if p_front is null then raise exception 'Add a photo of your ID.'; end if;
  if p_method <> 'video_call' and p_selfie is null then raise exception 'Add your selfie video or photo.'; end if;
  if p_method = 'video_call' and p_selfie is not null then raise exception 'No selfie is needed for a video call.'; end if;
  foreach v_path in array array_remove(array[p_front, p_back, p_selfie], null) loop
    if split_part(v_path, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'forum-id-checks' and o.name = v_path and o.owner_id = v_uid::text) then
      raise exception 'An uploaded file is missing. Please add it again.';
    end if;
  end loop;
  insert into forum_id_checks (user_id, method, country, id_type, challenge_code, id_front_path, id_back_path, selfie_path)
  values (v_uid, p_method, btrim(p_country), p_id_type, v_code, p_front, p_back, p_selfie);
  delete from forum_id_codes where user_id = v_uid;
  perform set_config('whsf.forum_id_rpc', 'on', true);
  update forum_profiles set verification_status = 'pending', verification_reason = null where user_id = v_uid;
end;
$$;
revoke all on function public.forum_id_submit_v2(text, text, text, text, text, text) from public, anon;
grant execute on function public.forum_id_submit_v2(text, text, text, text, text, text) to authenticated;

-- The original function stays (photo selfie route) so pages cached in browsers keep working.
drop function if exists public.forum_id_submit(text, text, text, text, text);
create function public.forum_id_submit(p_country text, p_id_type text, p_front text, p_back text, p_selfie text)
returns void language sql security definer set search_path = public as $$
  select public.forum_id_submit_v2('photo_selfie', p_country, p_id_type, p_front, p_back, p_selfie);
$$;
revoke all on function public.forum_id_submit(text, text, text, text, text) from public, anon;
grant execute on function public.forum_id_submit(text, text, text, text, text) to authenticated;

-- Alert email now says which route the member chose.
drop function if exists public.forum_id_claim_alert();
create function public.forum_id_claim_alert()
returns table (display_name text, country text, id_type text, method text, submitted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return; end if;
  update forum_id_checks c set alert_sent_at = now()
  where c.id = (select x.id from forum_id_checks x where x.user_id = auth.uid() and x.status = 'pending' and x.alert_sent_at is null
                order by x.submitted_at desc limit 1)
  returning c.id into v_id;
  if v_id is null then return; end if;
  return query select p.display_name, c.country, c.id_type, c.method, c.submitted_at
    from forum_id_checks c join forum_profiles p on p.user_id = c.user_id where c.id = v_id;
end;
$$;
revoke all on function public.forum_id_claim_alert() from public, anon;
grant execute on function public.forum_id_claim_alert() to authenticated;
