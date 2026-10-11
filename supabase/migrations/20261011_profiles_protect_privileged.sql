-- Close the self-promotion hole on public.profiles.
--
-- RLS lets a signed-in user insert, update and delete their own profile row. Updates of
-- role/status/verification columns were already blocked by column privileges, but INSERT
-- was not: a user could delete their profile and insert a new one with role = 'admin'
-- (passing agrismart_is_admin / ai_career_live_is_admin) or verification_status =
-- 'verified'. This trigger pins those columns for ordinary API users. Trusted paths
-- (handle_new_user, submit_/review_profile_verification, which run as postgres, and the
-- service role) are unaffected.

create or replace function public.profiles_protect_privileged()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'farmer';
    new.status := 'active';
    new.verification_status := 'draft';
    new.verification_note := '';
    new.verified_at := null;
    new.verified_by := null;
  else
    new.role := old.role;
    new.status := old.status;
    new.verification_status := old.verification_status;
    new.verification_note := old.verification_note;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_privileged();

-- Defence in depth: visitors who are not signed in never need to write profiles.
revoke insert, update, delete on public.profiles from anon;
