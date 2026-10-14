-- More "Participating as" groups for event registration (UN major groups and other stakeholders). Applied 2026-10-13.
alter table public.forum_tickets drop constraint if exists forum_tickets_participant_type_check;
alter table public.forum_tickets add constraint forum_tickets_participant_type_check check (participant_type is null or participant_type in (
  'member_state', 'local_government', 'parliament', 'diplomatic', 'un_system', 'igo',
  'ngo', 'international_ngo', 'cbo', 'faith_based', 'womens_org', 'youth_org',
  'academia', 'student', 'educator',
  'private_sector', 'startup', 'philanthropy', 'trade_union',
  'farmers', 'indigenous', 'disability', 'older_persons', 'migrants',
  'media', 'speaker', 'volunteer', 'individual', 'other'));

-- forum_event_register_v2 accepts the same list (its validation list was updated in place).
do $do$
declare v_def text;
begin
  select pg_get_functiondef('public.forum_event_register_v2(uuid, jsonb)'::regprocedure) into v_def;
  v_def := replace(v_def,
    $$('member_state', 'un_system', 'igo', 'ngo', 'academia', 'private_sector', 'media', 'individual', 'other')$$,
    $$('member_state', 'local_government', 'parliament', 'diplomatic', 'un_system', 'igo', 'ngo', 'international_ngo', 'cbo', 'faith_based', 'womens_org', 'youth_org', 'academia', 'student', 'educator', 'private_sector', 'startup', 'philanthropy', 'trade_union', 'farmers', 'indigenous', 'disability', 'older_persons', 'migrants', 'media', 'speaker', 'volunteer', 'individual', 'other')$$);
  execute v_def;
end
$do$;
