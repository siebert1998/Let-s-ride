create table if not exists public.ride_routes (
  slot_key text primary key,
  title text not null,
  notes text not null default '',
  file_name text,
  gpx_text text,
  distance_km double precision,
  elevation_gain_m double precision,
  history_comment text not null default '',
  photos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.ride_routes
  add column if not exists history_comment text not null default '',
  add column if not exists photos jsonb not null default '[]'::jsonb;

alter table public.ride_routes enable row level security;

drop policy if exists "Public can read ride routes" on public.ride_routes;
drop policy if exists "Public can insert ride routes" on public.ride_routes;
drop policy if exists "Public can update ride routes" on public.ride_routes;
drop policy if exists "Public can delete ride routes" on public.ride_routes;

create policy "Public can read ride routes"
  on public.ride_routes
  for select
  to anon
  using (true);

create policy "Public can insert ride routes"
  on public.ride_routes
  for insert
  to anon
  with check (true);

create policy "Public can update ride routes"
  on public.ride_routes
  for update
  to anon
  using (true)
  with check (true);

create policy "Public can delete ride routes"
  on public.ride_routes
  for delete
  to anon
  using (true);

insert into storage.buckets (id, name, public)
values ('ride-photos', 'ride-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read ride photos" on storage.objects;
drop policy if exists "Public upload ride photos" on storage.objects;
drop policy if exists "Public update ride photos" on storage.objects;
drop policy if exists "Public delete ride photos" on storage.objects;

create policy "Public read ride photos"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'ride-photos');

create policy "Public upload ride photos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'ride-photos');

create policy "Public update ride photos"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'ride-photos')
  with check (bucket_id = 'ride-photos');

create policy "Public delete ride photos"
  on storage.objects
  for delete
  to anon
  using (bucket_id = 'ride-photos');

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  main_group text not null,
  subgroup text,
  visibility_type text not null check (visibility_type in ('open', 'closed')),
  admin_required_for_ride_changes boolean not null default true,
  effective_group_key text unique not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.groups
  add column if not exists admin_required_for_ride_changes boolean not null default true;

create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, group_id)
);

create index if not exists idx_groups_name on public.groups(name);
create index if not exists idx_groups_main_sub on public.groups(main_group, subgroup);
create index if not exists idx_memberships_user on public.group_memberships(user_id);
create index if not exists idx_memberships_group on public.group_memberships(group_id);

insert into public.groups (slug, name, main_group, subgroup, visibility_type, effective_group_key)
values
  ('de-vzw', 'De VZW', 'VZW', null, 'open', 'VZW'),
  ('aquamundo-cycling-team', 'AquaMundo Cycling Team', 'AquaMundo Cycling Team', null, 'closed', 'AquaMundo Cycling Team'),
  ('barumas-vitessen-groep-a', 'Baruma''s Vitessen - Groep A', 'Vitessen', 'Groep A', 'closed', 'Vitessen-Groep A'),
  ('barumas-vitessen-groep-b', 'Baruma''s Vitessen - Groep B', 'Vitessen', 'Groep B', 'closed', 'Vitessen-Groep B'),
  ('barumas-vitessen-groep-c', 'Baruma''s Vitessen - Groep C', 'Vitessen', 'Groep C', 'closed', 'Vitessen-Groep C'),
  ('barumas-vitessen-social-rides', 'Baruma''s Vitessen - Social rides', 'Vitessen', 'Social rides', 'open', 'Vitessen-Social rides')
on conflict (slug) do update set
  name = excluded.name,
  main_group = excluded.main_group,
  subgroup = excluded.subgroup,
  visibility_type = excluded.visibility_type,
  admin_required_for_ride_changes = excluded.admin_required_for_ride_changes,
  effective_group_key = excluded.effective_group_key;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
      and gm.status = 'active'
  );
$$;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can upsert own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());
create policy "Users can upsert own profile"
  on public.profiles
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can read groups" on public.groups;
drop policy if exists "Authenticated users can create groups" on public.groups;
drop policy if exists "Group admins can update groups" on public.groups;
drop policy if exists "Public can read groups" on public.groups;
drop policy if exists "Public can create groups" on public.groups;
drop policy if exists "Public can update groups" on public.groups;
drop policy if exists "Public can delete groups" on public.groups;
create policy "Authenticated users can read groups"
  on public.groups
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create groups"
  on public.groups
  for insert
  to authenticated
  with check (true);

create policy "Group admins can update groups"
  on public.groups
  for update
  to authenticated
  using (public.is_group_admin(groups.id))
  with check (public.is_group_admin(groups.id));

create policy "Public can read groups"
  on public.groups
  for select
  to anon
  using (true);

create policy "Public can create groups"
  on public.groups
  for insert
  to anon
  with check (true);

create policy "Public can update groups"
  on public.groups
  for update
  to anon
  using (true)
  with check (true);

create policy "Public can delete groups"
  on public.groups
  for delete
  to anon
  using (true);

drop policy if exists "Users can read own memberships or admin view" on public.group_memberships;
drop policy if exists "Users can create own membership" on public.group_memberships;
drop policy if exists "Users/admin can update memberships" on public.group_memberships;
drop policy if exists "Group admins can update memberships" on public.group_memberships;
create policy "Users can read own memberships or admin view"
  on public.group_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_admin(group_memberships.group_id)
  );

create policy "Users can create own membership"
  on public.group_memberships
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Group admins can update memberships"
  on public.group_memberships
  for update
  to authenticated
  using (public.is_group_admin(group_memberships.group_id))
  with check (public.is_group_admin(group_memberships.group_id));
