create table if not exists public.ride_routes (
  slot_key text primary key,
  title text not null,
  notes text not null default '',
  file_name text,
  gpx_text text,
  distance_km double precision,
  elevation_gain_m double precision,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.ride_routes enable row level security;

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
