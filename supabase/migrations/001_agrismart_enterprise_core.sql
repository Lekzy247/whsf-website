-- AgriSmart Enterprise Core
-- PostgreSQL / Supabase migration

create extension if not exists pgcrypto;

create type public.agrismart_member_status as enum ('invited', 'active', 'suspended', 'disabled');
create type public.agrismart_org_status as enum ('trial', 'active', 'suspended', 'closed');

create table public.agrismart_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  country_code char(2) not null default 'NG',
  currency_code char(3) not null default 'NGN',
  time_zone text not null default 'UTC',
  status public.agrismart_org_status not null default 'trial',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agrismart_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.agrismart_organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.agrismart_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agrismart_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.agrismart_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.agrismart_roles(id),
  status public.agrismart_member_status not null default 'invited',
  invited_by uuid references auth.users(id),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (organization_id, user_id)
);

create table public.agrismart_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.agrismart_organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.agrismart_farms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.agrismart_organizations(id) on delete cascade,
  name text not null,
  primary_crop text,
  size_hectares numeric(12,2) check (size_hectares is null or size_hectares > 0),
  location_name text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  notes text,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agrismart_memberships_user_idx on public.agrismart_memberships(user_id, organization_id);
create index agrismart_audit_org_created_idx on public.agrismart_audit_logs(organization_id, created_at desc);
create index agrismart_farms_org_idx on public.agrismart_farms(organization_id);

create or replace function public.agrismart_is_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agrismart_memberships m
    where m.organization_id = target_organization
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.agrismart_has_permission(target_organization uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agrismart_memberships m
    join public.agrismart_roles r on r.id = m.role_id
    where m.organization_id = target_organization
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        r.permissions ? '*'
        or r.permissions ? requested_permission
        or r.permissions ? (split_part(requested_permission, '.', 1) || '.*')
      )
  );
$$;

alter table public.agrismart_organizations enable row level security;
alter table public.agrismart_roles enable row level security;
alter table public.agrismart_profiles enable row level security;
alter table public.agrismart_memberships enable row level security;
alter table public.agrismart_audit_logs enable row level security;
alter table public.agrismart_farms enable row level security;

create policy organizations_member_select on public.agrismart_organizations
for select using (public.agrismart_is_member(id));

create policy organizations_admin_update on public.agrismart_organizations
for update using (public.agrismart_has_permission(id, 'organization.manage'))
with check (public.agrismart_has_permission(id, 'organization.manage'));

create policy roles_member_select on public.agrismart_roles
for select using (public.agrismart_is_member(organization_id));

create policy roles_admin_manage on public.agrismart_roles
for all using (public.agrismart_has_permission(organization_id, 'users.manage'))
with check (public.agrismart_has_permission(organization_id, 'users.manage'));

create policy profiles_self_select on public.agrismart_profiles
for select using (id = auth.uid());

create policy profiles_self_update on public.agrismart_profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_member_select on public.agrismart_memberships
for select using (public.agrismart_is_member(organization_id));

create policy memberships_admin_manage on public.agrismart_memberships
for all using (public.agrismart_has_permission(organization_id, 'users.manage'))
with check (public.agrismart_has_permission(organization_id, 'users.manage'));

create policy audit_authorized_select on public.agrismart_audit_logs
for select using (public.agrismart_has_permission(organization_id, 'audit.view'));

create policy audit_member_insert on public.agrismart_audit_logs
for insert with check (public.agrismart_is_member(organization_id) and user_id = auth.uid());

create policy farms_member_select on public.agrismart_farms
for select using (public.agrismart_has_permission(organization_id, 'farms.view'));

create policy farms_authorized_insert on public.agrismart_farms
for insert with check (public.agrismart_has_permission(organization_id, 'farms.create'));

create policy farms_authorized_update on public.agrismart_farms
for update using (public.agrismart_has_permission(organization_id, 'farms.update'))
with check (public.agrismart_has_permission(organization_id, 'farms.update'));

create policy farms_authorized_delete on public.agrismart_farms
for delete using (public.agrismart_has_permission(organization_id, 'farms.delete'));

create or replace function public.agrismart_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agrismart_organizations_updated_at
before update on public.agrismart_organizations
for each row execute function public.agrismart_set_updated_at();

create trigger agrismart_profiles_updated_at
before update on public.agrismart_profiles
for each row execute function public.agrismart_set_updated_at();

create trigger agrismart_farms_updated_at
before update on public.agrismart_farms
for each row execute function public.agrismart_set_updated_at();

comment on schema public is 'AgriSmart enterprise multi-tenant core';
