-- Private staff verification administration and initial official-email records.

alter table public.whsf_staff_directory enable row level security;
revoke all on table public.whsf_staff_directory from anon, authenticated;

with desired(full_name, official_email) as (
  values
    ('Olalekan Okunola', 'olalekan.okunola@worldhsfoundation.org'),
    ('Abayomi Okunola', 'abayomi.okunola@worldhsfoundation.org'),
    ('Babatunde Okunola', 'babatunde.okunola@worldhsfoundation.org'),
    ('Oluwaseun Ogunleye', 'oluwaseun.ogunleye@worldhsfoundation.org'),
    ('Segun Adekeye', 'segun.adekeye@worldhsfoundation.org'),
    ('Donald Lalude', 'donald.lalude@worldhsfoundation.org')
)
update public.whsf_staff_directory as staff
set official_email = desired.official_email
from desired
where lower(trim(staff.full_name)) = lower(trim(desired.full_name));

with desired(full_name, official_email) as (
  values
    ('Olalekan Okunola', 'olalekan.okunola@worldhsfoundation.org'),
    ('Abayomi Okunola', 'abayomi.okunola@worldhsfoundation.org'),
    ('Babatunde Okunola', 'babatunde.okunola@worldhsfoundation.org'),
    ('Oluwaseun Ogunleye', 'oluwaseun.ogunleye@worldhsfoundation.org'),
    ('Segun Adekeye', 'segun.adekeye@worldhsfoundation.org'),
    ('Donald Lalude', 'donald.lalude@worldhsfoundation.org')
),
missing as (
  select
    desired.*,
    row_number() over (order by desired.full_name)::integer as sequence_number
  from desired
  where not exists (
    select 1
    from public.whsf_staff_directory as staff
    where lower(trim(staff.full_name)) = lower(trim(desired.full_name))
  )
),
current_max as (
  select coalesce(max(nullif(regexp_replace(employee_number, '[^0-9]', '', 'g'), '')::integer), 0) as number
  from public.whsf_staff_directory
)
insert into public.whsf_staff_directory (
  full_name,
  full_name_normalized,
  employee_number,
  employee_number_normalized,
  phone,
  phone_normalized,
  gender,
  gender_normalized,
  is_active,
  official_email
)
select
  missing.full_name,
  lower(regexp_replace(trim(missing.full_name), '\s+', ' ', 'g')),
  'WHSF-' || lpad((current_max.number + missing.sequence_number)::text, 3, '0'),
  'WHSF' || lpad((current_max.number + missing.sequence_number)::text, 3, '0'),
  '',
  '',
  '',
  '',
  true,
  missing.official_email
from missing
cross join current_max;

drop function if exists public.verify_whsf_staff_contact(text, text, text);

create function public.verify_whsf_staff_contact(
  p_full_name text,
  p_phone text default '',
  p_official_email text default ''
)
returns table (
  full_name text,
  verification_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    staff.full_name,
    case
      when nullif(trim(p_official_email), '') is not null
        and lower(trim(staff.official_email)) = lower(trim(p_official_email))
        then 'Verified by official email'
      else 'Verified by phone number'
    end as verification_status
  from public.whsf_staff_directory as staff
  where staff.is_active = true
    and lower(trim(staff.full_name)) = lower(trim(p_full_name))
    and (
      (
        nullif(trim(p_phone), '') is not null
        and regexp_replace(coalesce(staff.phone, ''), '[^0-9]', '', 'g') =
            regexp_replace(p_phone, '[^0-9]', '', 'g')
      )
      or
      (
        nullif(trim(p_official_email), '') is not null
        and lower(trim(coalesce(staff.official_email, ''))) = lower(trim(p_official_email))
      )
    )
  limit 1;
$$;

revoke all on function public.verify_whsf_staff_contact(text, text, text) from public;
grant execute on function public.verify_whsf_staff_contact(text, text, text) to anon, authenticated;

revoke all on function public.verify_whsf_staff(text, text, text, text) from public, anon, authenticated;

create or replace function public.is_whsf_staff_verification_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'info@worldhsfoundation.org';
$$;

revoke all on function public.is_whsf_staff_verification_admin() from public, anon;
grant execute on function public.is_whsf_staff_verification_admin() to authenticated;

create or replace function public.admin_list_whsf_staff()
returns table (
  id uuid,
  full_name text,
  employee_number text,
  phone text,
  official_email text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_whsf_staff_verification_admin() then
    raise exception 'WHSF staff verification administrator access is required.' using errcode = '42501';
  end if;

  return query
  select
    staff.id,
    staff.full_name,
    staff.employee_number,
    staff.phone,
    staff.official_email,
    staff.is_active,
    staff.updated_at
  from public.whsf_staff_directory as staff
  order by staff.full_name;
end;
$$;

revoke all on function public.admin_list_whsf_staff() from public, anon;
grant execute on function public.admin_list_whsf_staff() to authenticated;

create or replace function public.admin_upsert_whsf_staff(
  p_first_name text,
  p_last_name text,
  p_employee_number text default '',
  p_phone text default '',
  p_official_email text default '',
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_full_name text;
  v_full_name_normalized text;
  v_employee_number text;
  v_employee_number_normalized text;
  v_phone text;
  v_phone_normalized text;
  v_email text;
  v_next_number integer;
begin
  if not public.is_whsf_staff_verification_admin() then
    raise exception 'WHSF staff verification administrator access is required.' using errcode = '42501';
  end if;

  v_full_name := trim(concat_ws(' ', nullif(trim(p_first_name), ''), nullif(trim(p_last_name), '')));
  v_full_name_normalized := lower(regexp_replace(v_full_name, '\s+', ' ', 'g'));
  v_phone := trim(coalesce(p_phone, ''));
  v_phone_normalized := regexp_replace(v_phone, '[^0-9]', '', 'g');
  v_email := lower(trim(coalesce(p_official_email, '')));

  if nullif(v_full_name, '') is null then
    raise exception 'First name and last name are required.';
  end if;

  if v_email !~ '^[a-z0-9._%+\-]+@worldhsfoundation\.org$' then
    raise exception 'Enter a valid @worldhsfoundation.org official email address.';
  end if;

  v_employee_number := upper(trim(coalesce(p_employee_number, '')));
  if v_employee_number = '' then
    select coalesce(max(nullif(regexp_replace(employee_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
    into v_next_number
    from public.whsf_staff_directory;
    v_employee_number := 'WHSF-' || lpad(v_next_number::text, 3, '0');
  end if;
  v_employee_number_normalized := upper(regexp_replace(v_employee_number, '[^A-Z0-9]', '', 'g'));

  update public.whsf_staff_directory
  set
    full_name = v_full_name,
    full_name_normalized = v_full_name_normalized,
    employee_number = v_employee_number,
    employee_number_normalized = v_employee_number_normalized,
    phone = v_phone,
    phone_normalized = v_phone_normalized,
    official_email = v_email,
    is_active = coalesce(p_is_active, true),
    updated_at = now()
  where full_name_normalized = v_full_name_normalized
  returning id into v_id;

  if v_id is null then
    insert into public.whsf_staff_directory (
      full_name,
      full_name_normalized,
      employee_number,
      employee_number_normalized,
      phone,
      phone_normalized,
      gender,
      gender_normalized,
      is_active,
      official_email
    ) values (
      v_full_name,
      v_full_name_normalized,
      v_employee_number,
      v_employee_number_normalized,
      v_phone,
      v_phone_normalized,
      '',
      '',
      coalesce(p_is_active, true),
      v_email
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_whsf_staff(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_upsert_whsf_staff(text, text, text, text, text, boolean) to authenticated;
