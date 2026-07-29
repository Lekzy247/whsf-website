-- AgriSmart Connect core database schema
-- Run this migration in the Supabase SQL Editor before enabling cloud data sync.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  organization text not null default 'WHSF',
  role text not null default 'farmer' check (role in ('farmer','agronomist','buyer','cooperative','ngo','admin','super_admin')),
  status text not null default 'active' check (status in ('active','pending','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  main_crop text not null default '',
  size_hectares numeric(12,2) check (size_hectares is null or size_hectares >= 0),
  location text not null default '',
  latitude numeric(10,7),
  longitude numeric(10,7),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  description text not null default '',
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.harvests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  crop text not null,
  quantity numeric(14,2) not null check (quantity >= 0),
  unit text not null default 'kg',
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  currency text not null default 'NGN',
  harvest_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  name text not null,
  category text not null default 'Other',
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  unit text not null default 'units',
  reorder_level numeric(14,2) not null default 0 check (reorder_level >= 0),
  supplier text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('in','out','adjustment')),
  quantity numeric(14,2) not null check (quantity > 0),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sync_records (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  payload jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists farms_owner_id_idx on public.farms(owner_id);
create index if not exists expenses_owner_id_idx on public.expenses(owner_id);
create index if not exists harvests_owner_id_idx on public.harvests(owner_id);
create index if not exists inventory_items_owner_id_idx on public.inventory_items(owner_id);
create index if not exists inventory_movements_owner_id_idx on public.inventory_movements(owner_id);
create index if not exists sync_records_owner_id_idx on public.sync_records(owner_id);
create index if not exists sync_records_type_idx on public.sync_records(record_type);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, organization, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'organization', 'WHSF'),
    case lower(coalesce(new.raw_user_meta_data->>'role', 'farmer'))
      when 'agronomist' then 'agronomist'
      when 'buyer' then 'buyer'
      when 'cooperative' then 'cooperative'
      when 'ngo' then 'ngo'
      when 'admin' then 'admin'
      when 'super_admin' then 'super_admin'
      else 'farmer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists farms_set_updated_at on public.farms;
create trigger farms_set_updated_at before update on public.farms
for each row execute function public.set_updated_at();
drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();
drop trigger if exists harvests_set_updated_at on public.harvests;
create trigger harvests_set_updated_at before update on public.harvests
for each row execute function public.set_updated_at();
drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items
for each row execute function public.set_updated_at();
drop trigger if exists sync_records_set_updated_at on public.sync_records;
create trigger sync_records_set_updated_at before update on public.sync_records
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.expenses enable row level security;
alter table public.harvests enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sync_records enable row level security;

-- Users can only access records they own.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists farms_owner_all on public.farms;
create policy farms_owner_all on public.farms for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists expenses_owner_all on public.expenses;
create policy expenses_owner_all on public.expenses for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists harvests_owner_all on public.harvests;
create policy harvests_owner_all on public.harvests for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists inventory_items_owner_all on public.inventory_items;
create policy inventory_items_owner_all on public.inventory_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists inventory_movements_owner_all on public.inventory_movements;
create policy inventory_movements_owner_all on public.inventory_movements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists sync_records_owner_all on public.sync_records;
create policy sync_records_owner_all on public.sync_records for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.farms to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.harvests to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.sync_records to authenticated;

-- Backfill profiles for users created before this migration.
insert into public.profiles (id, full_name, phone, organization, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  coalesce(u.raw_user_meta_data->>'phone', ''),
  coalesce(u.raw_user_meta_data->>'organization', 'WHSF'),
  'farmer'
from auth.users u
on conflict (id) do nothing;
