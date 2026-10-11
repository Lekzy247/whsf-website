-- Stop the newsletter views from leaking student contacts.
--
-- Both views were owned by postgres without security_invoker, so they bypassed the RLS on
-- whsf_student_contacts / whsf_newsletter_queue / whsf_newsletter_campaigns, and anon had
-- SELECT: anyone with the public site key could read the 363-contact newsletter audience
-- (names, emails, phone numbers, course details). Make them run with the caller's
-- permissions so the tables' own rules apply (students: own row; WHSF staff: all), and
-- remove anonymous access and write grants. whsf_prepare_newsletter_campaign() is SECURITY
-- DEFINER (owner rights) and keeps working.

alter view public.whsf_newsletter_audience set (security_invoker = true);
alter view public.whsf_newsletter_queue_preview set (security_invoker = true);

revoke all on public.whsf_newsletter_audience from anon;
revoke all on public.whsf_newsletter_queue_preview from anon;
revoke insert, update, delete, truncate, references, trigger on public.whsf_newsletter_audience from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.whsf_newsletter_queue_preview from authenticated;
