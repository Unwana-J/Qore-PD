-- Add invite lifecycle fields for expiry/resend tracking.
alter table public.invites
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Backfill existing pending invites to 7 days from creation.
update public.invites
set expires_at = coalesce(expires_at, created_at + interval '7 days')
where status = 'Pending';

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_invites_updated_at on public.invites;
create trigger set_invites_updated_at
before update on public.invites
for each row
execute function public.set_updated_at();

-- Ensure invite insert/select/delete policies exist.
alter table public.invites enable row level security;

drop policy if exists "Invites select by admin roles" on public.invites;
drop policy if exists "Invites insert by admin roles" on public.invites;
drop policy if exists "Invites delete by admin roles" on public.invites;

create policy "Invites select by admin roles"
on public.invites
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('manager', 'team lead', 'superadmin')
  )
  or email = (select email from auth.users where id = auth.uid())
);

create policy "Invites insert by admin roles"
on public.invites
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('manager', 'team lead', 'superadmin')
  )
);

create policy "Invites delete by admin roles"
on public.invites
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('manager', 'team lead', 'superadmin')
  )
);

-- Keep auth trigger role resolution based on latest non-expired invite.
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
  set email = excluded.email,
      name = excluded.name,
      role = excluded.role;

  update public.invites
  set status = 'Accepted',
      accepted_at = now()
  where email = new.email
    and status = 'Pending';

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
