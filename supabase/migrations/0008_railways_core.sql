-- Phase 7A-1 Migration: Railways Core Tables & RLS Policies

create table stations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  station_code text,
  lat double precision,
  lng double precision,
  station_type text not null default 'station' check (station_type in ('station','yard','junction')),
  created_at timestamptz not null default now()
);

create table locomotives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  loco_number text not null,
  loco_type text not null,
  power_kw numeric,
  fuel_type text not null check (fuel_type in ('electric','diesel')),
  status text not null default 'idle' check (status in ('idle','active','maintenance')),
  created_at timestamptz not null default now(),
  unique (org_id, loco_number)
);

create table rakes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  rake_id text not null,
  composition jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (org_id, rake_id)
);

create table loco_pilots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  license_number text not null,
  phone text,
  status text not null default 'available' check (status in ('available','on_duty','off_duty')),
  created_at timestamptz not null default now()
);

create table trains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  train_number text not null,
  train_name text,
  locomotive_id uuid references locomotives(id) on delete set null,
  rake_id uuid references rakes(id) on delete set null,
  status text not null default 'idle' check (status in ('idle','active','maintenance')),
  created_at timestamptz not null default now(),
  unique (org_id, train_number)
);

create table saved_rail_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  origin_station_id uuid not null references stations(id) on delete cascade,
  destination_station_id uuid not null references stations(id) on delete cascade,
  intermediate_stations jsonb not null default '[]',
  route_geometry jsonb,
  routing_source text not null default 'pending' check (routing_source in ('overpass','fallback-straight-line','pending')),
  usage_count int not null default 1,
  updated_at timestamptz not null default now(),
  unique (org_id, origin_station_id, destination_station_id)
);

create table train_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  train_id uuid not null references trains(id) on delete cascade,
  loco_pilot_id uuid not null references loco_pilots(id) on delete cascade,
  origin_station_id uuid not null references stations(id) on delete cascade,
  destination_station_id uuid not null references stations(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','in_transit','completed','cancelled')),
  distance_km numeric,
  duration_minutes numeric,
  simulation_speed_multiplier numeric not null default 60,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table train_movement_stops (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references train_movements(id) on delete cascade,
  station_id uuid not null references stations(id) on delete cascade,
  sequence int not null,
  eta timestamptz,
  arrived_at timestamptz,
  departed_at timestamptz
);

create table train_telemetry (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references train_movements(id) on delete cascade,
  train_id uuid not null references trains(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed_kmh numeric not null,
  heading numeric,
  recorded_at timestamptz not null default now()
);

create index idx_stations_org_id on stations (org_id);
create index idx_locomotives_org_id on locomotives (org_id);
create index idx_rakes_org_id on rakes (org_id);
create index idx_loco_pilots_org_id on loco_pilots (org_id);
create index idx_trains_org_id on trains (org_id);
create index idx_saved_rail_routes_org_id on saved_rail_routes (org_id);
create index train_telemetry_movement_idx on train_telemetry (movement_id, recorded_at desc);
create index train_movements_org_status_idx on train_movements (org_id, status);

-- Enable RLS
alter table stations enable row level security;
alter table locomotives enable row level security;
alter table rakes enable row level security;
alter table loco_pilots enable row level security;
alter table trains enable row level security;
alter table saved_rail_routes enable row level security;
alter table train_movements enable row level security;
alter table train_movement_stops enable row level security;
alter table train_telemetry enable row level security;

-- Stations RLS Policies
create policy "Tenant isolation for stations select" on stations
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for stations insert" on stations
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for stations update" on stations
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for stations delete" on stations
  for delete using (org_id = public.get_auth_org_id());

-- Locomotives RLS Policies
create policy "Tenant isolation for locomotives select" on locomotives
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for locomotives insert" on locomotives
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for locomotives update" on locomotives
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for locomotives delete" on locomotives
  for delete using (org_id = public.get_auth_org_id());

-- Rakes RLS Policies
create policy "Tenant isolation for rakes select" on rakes
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for rakes insert" on rakes
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for rakes update" on rakes
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for rakes delete" on rakes
  for delete using (org_id = public.get_auth_org_id());

-- Loco Pilots RLS Policies
create policy "Tenant isolation for loco_pilots select" on loco_pilots
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for loco_pilots insert" on loco_pilots
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for loco_pilots update" on loco_pilots
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for loco_pilots delete" on loco_pilots
  for delete using (org_id = public.get_auth_org_id());

-- Trains RLS Policies
create policy "Tenant isolation for trains select" on trains
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for trains insert" on trains
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for trains update" on trains
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for trains delete" on trains
  for delete using (org_id = public.get_auth_org_id());

-- Saved Rail Routes RLS Policies
create policy "Tenant isolation for saved_rail_routes select" on saved_rail_routes
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for saved_rail_routes insert" on saved_rail_routes
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for saved_rail_routes update" on saved_rail_routes
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for saved_rail_routes delete" on saved_rail_routes
  for delete using (org_id = public.get_auth_org_id());

-- Train Movements RLS Policies
create policy "Tenant isolation for train_movements select" on train_movements
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for train_movements insert" on train_movements
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for train_movements update" on train_movements
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for train_movements delete" on train_movements
  for delete using (org_id = public.get_auth_org_id());

-- Train Movement Stops RLS Policies
create policy "Tenant isolation for train_movement_stops select" on train_movement_stops
  for select using (movement_id in (select id from train_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for train_movement_stops insert" on train_movement_stops
  for insert with check (movement_id in (select id from train_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for train_movement_stops update" on train_movement_stops
  for update using (movement_id in (select id from train_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for train_movement_stops delete" on train_movement_stops
  for delete using (movement_id in (select id from train_movements where org_id = public.get_auth_org_id()));

-- Train Telemetry RLS Policies
create policy "Tenant isolation for train_telemetry select" on train_telemetry
  for select using (movement_id in (select id from train_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for train_telemetry insert" on train_telemetry
  for insert with check (movement_id in (select id from train_movements where org_id = public.get_auth_org_id()));
