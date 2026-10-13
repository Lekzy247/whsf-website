-- One staff alert (Teams / email) per new event or advert waiting for WHSF approval. Applied 2026-10-13.
create table if not exists public.forum_review_alerts (
  kind text not null check (kind in ('event', 'advert')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (kind, item_id)
);
alter table public.forum_review_alerts enable row level security;
revoke all on public.forum_review_alerts from anon, authenticated;

-- Called by /api/forum-review-alert with the member's own session: returns the item only if the
-- caller owns it, it is waiting for approval and no alert has been sent for it yet.
create or replace function public.forum_review_claim_alert(p_kind text, p_id uuid)
returns table (title text, member_name text, detail text)
language plpgsql security definer set search_path = public as $$
declare v_title text; v_detail text; v_owner uuid; v_rows int;
begin
  if p_kind = 'event' then
    select e.title, e.host_id, e.category || ' · ' || to_char(e.starts_at at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC'
      into v_title, v_owner, v_detail
    from forum_events e where e.id = p_id and e.host_id = auth.uid() and e.status = 'pending';
  elsif p_kind = 'advert' then
    select a.headline, a.owner_id, a.link_url into v_title, v_owner, v_detail
    from forum_ads a where a.id = p_id and a.owner_id = auth.uid() and a.status = 'pending';
  else
    return;
  end if;
  if v_owner is null then return; end if;
  insert into forum_review_alerts (kind, item_id) values (p_kind, p_id) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return; end if;
  return query select v_title, coalesce((select display_name from forum_profiles where user_id = v_owner), 'A member'), v_detail;
end;
$$;
revoke all on function public.forum_review_claim_alert(text, uuid) from public, anon;
grant execute on function public.forum_review_claim_alert(text, uuid) to authenticated;
