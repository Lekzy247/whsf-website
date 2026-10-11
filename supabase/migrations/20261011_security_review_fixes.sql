-- Security review follow-ups (2026-10-11).

-- 1. Public newsletter sign-up could overwrite another contact's details: subscribing with
--    an email already on file replaced that person's name, phone and country. Now an
--    existing contact only gets blanks filled in.
create or replace function public.whsf_newsletter_subscribe(
  p_first_name text, p_last_name text, p_email text,
  p_country text default null, p_phone_number text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  clean_email text;
  clean_first text;
  clean_last text;
  clean_full text;
  contact uuid;
begin
  clean_email := lower(trim(coalesce(p_email, '')));
  clean_first := nullif(trim(coalesce(p_first_name, '')), '');
  clean_last := nullif(trim(coalesce(p_last_name, '')), '');
  clean_full := trim(coalesce(clean_first, '') || ' ' || coalesce(clean_last, ''));

  if clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('ok', false, 'message', 'Please enter a valid email address.');
  end if;

  if clean_full = '' then
    clean_full := split_part(clean_email, '@', 1);
    clean_first := clean_full;
  end if;

  insert into public.whsf_student_contacts (
    first_name, last_name, full_name, email, email_normalized, phone_number, phone_e164_candidate,
    country, communication_category, newsletter_group, tech_info_group, communication_status,
    student_status, course_registration_status, registration_source
  ) values (
    coalesce(clean_first, clean_full), clean_last, clean_full, clean_email, clean_email,
    nullif(trim(coalesce(p_phone_number, '')), ''),
    nullif(regexp_replace(coalesce(p_phone_number, ''), '[\s().-]+', '', 'g'), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    'WHSF newsletter and technology information', true, true, 'pending_review',
    'unregistered', 'not_registered_for_course', 'website_footer_newsletter_subscription'
  )
  on conflict (email_normalized) do update set
    first_name = coalesce(nullif(public.whsf_student_contacts.first_name, ''), excluded.first_name),
    last_name = coalesce(nullif(public.whsf_student_contacts.last_name, ''), excluded.last_name),
    full_name = coalesce(nullif(public.whsf_student_contacts.full_name, ''), excluded.full_name),
    phone_number = coalesce(nullif(public.whsf_student_contacts.phone_number, ''), excluded.phone_number),
    phone_e164_candidate = coalesce(nullif(public.whsf_student_contacts.phone_e164_candidate, ''), excluded.phone_e164_candidate),
    country = coalesce(nullif(public.whsf_student_contacts.country, ''), excluded.country),
    newsletter_group = true,
    tech_info_group = true,
    communication_category = 'WHSF newsletter and technology information',
    communication_status = public.whsf_student_contacts.communication_status,
    updated_at = now()
  returning id into contact;

  -- Every request is still recorded as typed, for the admin review.
  insert into public.whsf_newsletter_subscription_requests (
    contact_id, first_name, last_name, email, email_normalized, country, phone_number
  ) values (
    contact, clean_first, clean_last, clean_email, clean_email,
    nullif(trim(coalesce(p_country, '')), ''), nullif(trim(coalesce(p_phone_number, '')), '')
  );

  return jsonb_build_object('ok', true,
    'message', 'Thank you. Your WHSF newsletter request has been received and will be reviewed by an administrator.');
end;
$function$;

-- 2. The AI Career Connect app was removed from the website (2026-10-11); its public
--    connect-request form function is no longer called and only invites spam.
--    (Its EXECUTE came through the default PUBLIC grant, so revoke that too.)
revoke execute on function public.ai_career_submit_live_connect_request(text, text, text, text, text, text, text, timestamptz, text, text, text, text) from public, anon, authenticated;

-- 3. Trigger-only functions should not be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.connect_profiles_biu() from public, anon, authenticated;
revoke execute on function public.whsf_sync_student_contact_from_profile() from public, anon, authenticated;
-- Triggers fire without EXECUTE (verified: a student's own update still syncs), but keep
-- the auth service's grant explicit for the sign-up trigger.
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.whsf_sync_student_contact_from_profile() to supabase_auth_admin;

-- 4. Fixed search_path for functions flagged by the linter.
alter function public.normalize_whsf_staff_text(text) set search_path = public;
alter function public.normalize_whsf_staff_phone(text) set search_path = public;
alter function public.normalize_whsf_employee_number(text) set search_path = public;
alter function public.set_whsf_student_contacts_updated_at() set search_path = public;
alter function public.whsf_is_staff() set search_path = public;
alter function public.set_whsf_newsletter_updated_at() set search_path = public;
alter function public.set_updated_at() set search_path = public;
