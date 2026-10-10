-- Daily run of the opportunity-sync Edge Function (apply after the function is deployed).
-- The function needs no key: unforced calls are limited to one run per source every 6 hours.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('whsf-opportunity-sync')
where exists (select 1 from cron.job where jobname = 'whsf-opportunity-sync');

-- 05:15 UTC every day.
select cron.schedule(
  'whsf-opportunity-sync',
  '15 5 * * *',
  $$
  select net.http_post(
    url := 'https://ophymlgqnfilgxsuzcuz.supabase.co/functions/v1/opportunity-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
