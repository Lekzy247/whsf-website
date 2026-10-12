-- One moderator email per ID check: the member's browser asks the WHSF server (api/forum-id-alert.js)
-- to send it, and the server claims the alert here first, so it can only ever be sent once per check.
alter table public.forum_id_checks add column if not exists alert_sent_at timestamptz;

create or replace function public.forum_id_claim_alert()
returns table (display_name text, country text, id_type text, submitted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return; end if;
  update forum_id_checks c set alert_sent_at = now()
  where c.id = (select x.id from forum_id_checks x where x.user_id = auth.uid() and x.status = 'pending' and x.alert_sent_at is null
                order by x.submitted_at desc limit 1)
  returning c.id into v_id;
  if v_id is null then return; end if;
  return query select p.display_name, c.country, c.id_type, c.submitted_at
    from forum_id_checks c join forum_profiles p on p.user_id = c.user_id where c.id = v_id;
end;
$$;
revoke all on function public.forum_id_claim_alert() from public, anon;
grant execute on function public.forum_id_claim_alert() to authenticated;
