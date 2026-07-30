-- AgriSmart verified accounts and administrator review workflow.
-- Apply after 20260729_agrismart_core.sql.

alter table public.profiles
  add column if not exists account_type text not null default 'farmer'
    check (account_type in ('farmer','buyer','supplier','agronomist','cooperative')),
  add column if not exists country text not null default 'Nigeria',
  add column if not exists business_name text not null default '',
  add column if not exists registration_number text not null default '',
  add column if not exists address text not null default '',
  add column if not exists verification_status text not null default 'draft'
    check (verification_status in ('draft','pending','verified','rejected','suspended')),
  add column if not exists verification_evidence_url text not null default '',
  add column if not exists verification_note text not null default '',
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_verification_status_idx
  on public.profiles(verification_status, verification_submitted_at desc);
create index if not exists profiles_account_type_idx
  on public.profiles(account_type);

update public.profiles
set account_type = case role
  when 'buyer' then 'buyer'
  when 'agronomist' then 'agronomist'
  when 'cooperative' then 'cooperative'
  else 'farmer'
end
where account_type = 'farmer' and role in ('buyer','agronomist','cooperative');

create or replace function public.agrismart_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin','super_admin')
      and status = 'active'
  );
$$;

revoke all on function public.agrismart_is_admin() from public;
grant execute on function public.agrismart_is_admin() to authenticated;

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles
for select using (public.agrismart_is_admin());

-- Own-profile updates remain subject to RLS, but column privileges prevent
-- users from changing their role, account status or verification decision.
revoke update on public.profiles from authenticated;
grant update (
  full_name,
  phone,
  organization,
  country,
  account_type,
  business_name,
  registration_number,
  address,
  verification_evidence_url
) on public.profiles to authenticated;

create or replace function public.submit_profile_verification(
  requested_account_type text,
  requested_country text,
  requested_business_name text,
  requested_registration_number text,
  requested_address text,
  requested_evidence_url text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if requested_account_type not in ('farmer','buyer','supplier','agronomist','cooperative') then
    raise exception 'Unsupported account type';
  end if;

  if length(trim(coalesce(requested_country, ''))) < 2 then
    raise exception 'Country is required';
  end if;

  if requested_account_type in ('buyer','supplier','cooperative')
     and length(trim(coalesce(requested_business_name, ''))) < 2 then
    raise exception 'Business or cooperative name is required';
  end if;

  update public.profiles
  set
    account_type = requested_account_type,
    country = trim(requested_country),
    business_name = trim(coalesce(requested_business_name, '')),
    registration_number = trim(coalesce(requested_registration_number, '')),
    address = trim(coalesce(requested_address, '')),
    verification_evidence_url = trim(coalesce(requested_evidence_url, '')),
    verification_status = 'pending',
    verification_note = '',
    verification_submitted_at = now(),
    verified_at = null,
    verified_by = null
  where id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.submit_profile_verification(text,text,text,text,text,text) from public;
grant execute on function public.submit_profile_verification(text,text,text,text,text,text) to authenticated;

create or replace function public.review_profile_verification(
  target_profile_id uuid,
  decision text,
  review_note text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.agrismart_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if decision not in ('verified','rejected','suspended') then
    raise exception 'Unsupported verification decision';
  end if;

  update public.profiles
  set
    verification_status = decision,
    verification_note = trim(coalesce(review_note, '')),
    verified_at = case when decision = 'verified' then now() else null end,
    verified_by = auth.uid()
  where id = target_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.review_profile_verification(uuid,text,text) from public;
grant execute on function public.review_profile_verification(uuid,text,text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_type text;
begin
  requested_type := lower(coalesce(new.raw_user_meta_data->>'account_type', 'farmer'));
  if requested_type not in ('farmer','buyer','supplier','agronomist','cooperative') then
    requested_type := 'farmer';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    organization,
    role,
    account_type,
    country,
    business_name
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'organization', 'WHSF'),
    'farmer',
    requested_type,
    coalesce(new.raw_user_meta_data->>'country', 'Nigeria'),
    coalesce(new.raw_user_meta_data->>'business_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

