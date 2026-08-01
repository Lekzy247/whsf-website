-- Add official email as an optional staff verification method.
-- Populate official_email for each employee before enabling email-based checks in production.

alter table public.whsf_staff_directory
  add column if not exists official_email text;

create unique index if not exists whsf_staff_directory_official_email_unique
  on public.whsf_staff_directory (lower(official_email))
  where nullif(trim(official_email), '') is not null;

comment on column public.whsf_staff_directory.official_email is
  'Official employee email used only for WHSF staff identity verification.';

create or replace function public.verify_whsf_staff_contact(
  p_full_name text,
  p_phone text default '',
  p_official_email text default ''
)
returns table (
  full_name text,
  employee_number text,
  verification_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    staff.full_name,
    staff.employee_number,
    case
      when nullif(trim(p_official_email), '') is not null
        and lower(trim(staff.official_email)) = lower(trim(p_official_email))
        then 'Verified by official email'
      else 'Verified by phone number'
    end as verification_status
  from public.whsf_staff_directory as staff
  where lower(trim(staff.full_name)) = lower(trim(p_full_name))
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
