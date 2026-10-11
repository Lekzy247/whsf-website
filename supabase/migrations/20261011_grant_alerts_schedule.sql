-- Daily grant emails at 07:00 UTC (weekly matches go out on Mondays).
select cron.unschedule('whsf-grant-alerts')
where exists (select 1 from cron.job where jobname = 'whsf-grant-alerts');

select cron.schedule(
  'whsf-grant-alerts',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://ophymlgqnfilgxsuzcuz.supabase.co/functions/v1/grant-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
