-- Phase 7B-1 Migration: Airways Core Tables & RLS Policies

create table airports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  iata_code text,
  icao_code text,
  lat double precision,
  lng double precision,   -- geocoded via existing GeocodingService
  created_at timestamptz not null default now()
);

create table aircraft (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  tail_number text not null,
  aircraft_type text not null,
  cargo_capacity_kg numeric,
  status text not null default 'idle'
    check (status in ('idle','active','maintenance')),
  created_at timestamptz not null default now(),
  unique (org_id, tail_number)
);

create table flight_crew (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  license_number text not null,
  crew_role text not null default 'pilot'
    check (crew_role in ('pilot','cabin')),
  status text not null default 'available'
    check (status in ('available','on_duty','off_duty')),
  created_at timestamptz not null default now()
);

create table flights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  flight_number text not null,
  origin_airport_id uuid not null references airports(id),
  destination_airport_id uuid not null references airports(id),
  created_at timestamptz not null default now(),
  unique (org_id, flight_number)
);

create table flight_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  flight_id uuid not null references flights(id),
  aircraft_id uuid not null references aircraft(id),
  pilot_id uuid not null references flight_crew(id),
  status text not null default 'planned'
    check (status in ('planned','in_transit','completed','cancelled')),
  routing_method text not null default 'great-circle',
  distance_km numeric,
  duration_minutes numeric,
  simulation_speed_multiplier numeric not null default 60,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table flight_telemetry (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references flight_movements(id) on delete cascade,
  aircraft_id uuid not null references aircraft(id),
  lat double precision not null,
  lng double precision not null,
  altitude_ft numeric,
  speed_kts numeric not null,
  heading numeric,
  recorded_at timestamptz not null default now()
);

-- Indexes
create index idx_airports_org_id on airports (org_id);
create index idx_aircraft_org_id on aircraft (org_id);
create index idx_flight_crew_org_id on flight_crew (org_id);
create index idx_flights_org_id on flights (org_id);
create index flight_telemetry_movement_idx on flight_telemetry (movement_id, recorded_at desc);
create index flight_movements_org_status_idx on flight_movements (org_id, status);

-- Enable RLS
alter table airports enable row level security;
alter table aircraft enable row level security;
alter table flight_crew enable row level security;
alter table flights enable row level security;
alter table flight_movements enable row level security;
alter table flight_telemetry enable row level security;

-- Airports RLS Policies
create policy "Tenant isolation for airports select" on airports
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for airports insert" on airports
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for airports update" on airports
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for airports delete" on airports
  for delete using (org_id = public.get_auth_org_id());

-- Aircraft RLS Policies
create policy "Tenant isolation for aircraft select" on aircraft
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for aircraft insert" on aircraft
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for aircraft update" on aircraft
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for aircraft delete" on aircraft
  for delete using (org_id = public.get_auth_org_id());

-- Flight Crew RLS Policies
create policy "Tenant isolation for flight_crew select" on flight_crew
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flight_crew insert" on flight_crew
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flight_crew update" on flight_crew
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flight_crew delete" on flight_crew
  for delete using (org_id = public.get_auth_org_id());

-- Flights RLS Policies
create policy "Tenant isolation for flights select" on flights
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flights insert" on flights
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flights update" on flights
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flights delete" on flights
  for delete using (org_id = public.get_auth_org_id());

-- Flight Movements RLS Policies
create policy "Tenant isolation for flight_movements select" on flight_movements
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flight_movements insert" on flight_movements
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flight_movements update" on flight_movements
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for flight_movements delete" on flight_movements
  for delete using (org_id = public.get_auth_org_id());

-- Flight Telemetry RLS Policies
create policy "Tenant isolation for flight_telemetry select" on flight_telemetry
  for select using (movement_id in (select id from flight_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for flight_telemetry insert" on flight_telemetry
  for insert with check (movement_id in (select id from flight_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for flight_telemetry delete" on flight_telemetry
  for delete using (movement_id in (select id from flight_movements where org_id = public.get_auth_org_id()));
