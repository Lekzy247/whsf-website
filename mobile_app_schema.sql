-- WHSF Mobile App: Supabase Auth profiles and collaboration chat
-- Run this in Supabase SQL Editor once before deploying the updated mobile app files.

create table if not exists public.mobile_app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('volunteer', 'partner', 'student', 'member', 'donor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_app_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_role text not null,
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 2000),
  message_type text not null default 'message' check (message_type in ('message', 'announcement')),
  created_at timestamptz not null default now()
);

create index if not exists mobile_app_chat_messages_room_created_idx
on public.mobile_app_chat_messages (room, created_at);

alter table public.mobile_app_profiles enable row level security;
alter table public.mobile_app_chat_messages enable row level security;

drop policy if exists "Mobile app users can view own profile" on public.mobile_app_profiles;
create policy "Mobile app users can view own profile"
on public.mobile_app_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Mobile app users can create own profile" on public.mobile_app_profiles;
create policy "Mobile app users can create own profile"
on public.mobile_app_profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Mobile app users can update own profile" on public.mobile_app_profiles;
create policy "Mobile app users can update own profile"
on public.mobile_app_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Authenticated users can view mobile app chat" on public.mobile_app_chat_messages;
create policy "Authenticated users can view mobile app chat"
on public.mobile_app_chat_messages
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create own mobile app chat messages" on public.mobile_app_chat_messages;
create policy "Authenticated users can create own mobile app chat messages"
on public.mobile_app_chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and message_type = 'message'
);

drop policy if exists "Mobile app admins can create announcements" on public.mobile_app_chat_messages;
create policy "Mobile app admins can create announcements"
on public.mobile_app_chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and message_type = 'announcement'
  and exists (
    select 1
    from public.mobile_app_profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
  )
);
