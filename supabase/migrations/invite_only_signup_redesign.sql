-- Define the secure RPC function for frontend invite pre-checks
create or replace function public.check_pending_invite(email_to_check text)
returns json
language plpgsql
security definer
as $$
declare
  invite_record record;
begin
  select name, role, status, expires_at
  into invite_record
  from public.invites
  where lower(email) = lower(trim(email_to_check))
    and status = 'Pending'
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if invite_record is null then
    -- Also allow the Superadmin bypass email to pass the check
    if lower(trim(email_to_check)) = 'johnkingunwanao@gmail.com' then
      return json_build_object(
        'exists', true,
        'name', 'Superadmin User',
        'role', 'Superadmin'
      );
    end if;
    return json_build_object('exists', false);
  else
    return json_build_object(
      'exists', true,
      'name', coalesce(invite_record.name, ''),
      'role', invite_record.role
    );
  end if;
end;
$$;

-- Update handle_new_user to enforce invite requirement server-side
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

  -- Bypasses for specific admin setup email
  if new.email = 'johnkingunwanao@gmail.com' and invited_role is null then
    invited_role := 'Superadmin';
  end if;

  -- SERVER-SIDE ENFORCEMENT: Throw exception if the email does not have a pending invite
  if invited_role is null then
    raise exception 'Access Denied: Email % has not been invited to this workspace.', new.email;
  end if;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', invited_name, 'User'),
    invited_role
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = case
      when profiles.name is null or profiles.name = 'User' or profiles.name = ''
      then excluded.name
      else profiles.name
    end,
    role = case
      when invited_role is not null then invited_role
      else profiles.role
    end;

  update public.invites
  set status = 'Accepted',
      accepted_at = now()
  where email = new.email
    and status = 'Pending';

  return new;
end;
$$;

-- Recreate trigger to ensure it executes the updated function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
