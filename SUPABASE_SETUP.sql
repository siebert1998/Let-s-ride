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
