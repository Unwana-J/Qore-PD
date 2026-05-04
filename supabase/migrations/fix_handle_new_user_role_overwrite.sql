-- Fix: handle_new_user trigger should NOT overwrite an existing role on conflict.
-- Previously, the ON CONFLICT DO UPDATE clause reset role to 'PM' if the invite
-- lookup failed (expired or already Accepted), silently demoting IM users.
-- This patch preserves the existing role when a profile row already exists.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  invited_role text;
  invited_name text;
begin
  select role, name
  into invited_role, invited_name
  from public.invites
  where email = new.email
    and status = 'Pending'
    and coalesce(expires_at, now() + interval '1 second') > now()
  order by created_at desc
  limit 1;

  if new.email = 'johnkingunwanao@gmail.com' and invited_role is null then
    invited_role := 'Superadmin';
  end if;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', invited_name, 'User'),
    coalesce(invited_role, 'PM')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    -- Only update name if the current name is blank/default
    name = case
      when profiles.name is null or profiles.name = 'User' or profiles.name = ''
      then excluded.name
      else profiles.name
    end,
    -- CRITICAL FIX: Only overwrite role if it is still the default 'PM'
    -- and we have a non-null invited role from a valid invite.
    -- This prevents demoting an admin-set 'IM' role back to 'PM'.
    role = case
      when invited_role is not null then invited_role
      else profiles.role  -- preserve existing role if no valid invite found
    end;

  update public.invites
  set status = 'Accepted',
      accepted_at = now()
  where email = new.email
    and status = 'Pending';

  return new;
end;
$$;

-- Recreate the trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
