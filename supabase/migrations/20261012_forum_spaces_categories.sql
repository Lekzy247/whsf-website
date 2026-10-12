-- Forum spaces (post topics) and event types, for the redesigned Forum.
alter table public.forum_posts add column if not exists topic text not null default 'general'
  check (topic in ('general', 'exchange', 'jobs', 'conferences', 'women_tech', 'ngos', 'grants', 'mentorship', 'volunteering', 'digital_ai', 'media_literacy'));
create index if not exists forum_posts_topic_idx on public.forum_posts (topic, created_at desc);

alter table public.forum_events add column if not exists category text not null default 'meetup'
  check (category in ('conference', 'summit', 'exchange', 'career_fair', 'webinar', 'workshop', 'meetup', 'networking'));
create index if not exists forum_events_category_idx on public.forum_events (category, starts_at);
