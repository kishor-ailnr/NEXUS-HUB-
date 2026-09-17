-- 0004_roadways_core.sql
-- Core Roadways tables: drivers, vehicles, saved_routes, trips, checkpoints, gps_points, geofences, convoys, hos_logs

create table drivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  license_number text not null,
  phone text,
  status text not null default 'available' check (status in ('available','on_trip','off_duty')),
  created_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  registration_number text not null,
  vehicle_type text not null,
  capacity_kg numeric,
  status text not null default 'idle' check (status in ('idle','active','maintenance')),
  assigned_driver_id uuid references drivers(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, registration_number)
);

create table saved_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  origin_label text not null,
  destination_label text not null,
  checkpoints jsonb not null default '[]', -- [{label,lat,lng}]
  osrm_geometry jsonb,                      -- cached route polyline + distance/duration
  usage_count int not null default 1,
  updated_at timestamptz not null default now(),
  unique (org_id, origin_label, destination_label)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),
  driver_id uuid not null references drivers(id),
  origin_label text not null,
  origin_lat double precision,
  origin_lng double precision,
  destination_label text not null,
  destination_lat double precision,
  destination_lng double precision,
  status text not null default 'planned' check (status in ('planned','in_transit','completed','cancelled')),
  distance_km numeric,
  duration_minutes numeric,
  simulation_speed_multiplier numeric not null default 60,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table trip_checkpoints (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  sequence int not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  eta timestamptz,
  arrived_at timestamptz
);

create table gps_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),
  lat double precision not null,
  lng double precision not null,
  speed_kmh numeric not null,
  heading numeric,
  recorded_at timestamptz not null default now()
);

create table geofences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m numeric not null,
  created_at timestamptz not null default now()
);

create table geofence_events (
  id uuid primary key default gen_random_uuid(),
  geofence_id uuid not null references geofences(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),
  event_type text not null check (event_type in ('enter','exit')),
  occurred_at timestamptz not null default now()
);

create table convoy_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table convoy_members (
  id uuid primary key default gen_random_uuid(),
  convoy_id uuid not null references convoy_groups(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),
  joined_at timestamptz not null default now(),
  unique (convoy_id, vehicle_id)
);

create table hos_logs (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  trip_id uuid references trips(id),
  drive_minutes numeric not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  violation boolean not null default false
);

create index gps_points_trip_idx on gps_points (trip_id, recorded_at desc);
create index trips_org_status_idx on trips (org_id, status);
create index geofence_events_idx on geofence_events (geofence_id, occurred_at desc);
create index hos_logs_driver_window_idx on hos_logs (driver_id, window_ended_at desc);

-- RLS
alter table drivers enable row level security;
alter table vehicles enable row level security;
alter table saved_routes enable row level security;
alter table trips enable row level security;
alter table trip_checkpoints enable row level security;
alter table gps_points enable row level security;
alter table geofences enable row level security;
alter table geofence_events enable row level security;
alter table convoy_groups enable row level security;
alter table convoy_members enable row level security;
alter table hos_logs enable row level security;

create policy drivers_org on drivers for all using (org_id in (select org_id from users where users.id = auth.uid()));
create policy vehicles_org on vehicles for all using (org_id in (select org_id from users where users.id = auth.uid()));
create policy saved_routes_org on saved_routes for all using (org_id in (select org_id from users where users.id = auth.uid()));
create policy trips_org on trips for all using (org_id in (select org_id from users where users.id = auth.uid()));
create policy geofences_org on geofences for all using (org_id in (select org_id from users where users.id = auth.uid()));
create policy convoy_groups_org on convoy_groups for all using (org_id in (select org_id from users where users.id = auth.uid()));

create policy trip_checkpoints_org on trip_checkpoints for all using (
  trip_id in (select id from trips where org_id in (select org_id from users where users.id = auth.uid()))
);

create policy gps_points_org on gps_points for all using (
  trip_id in (select id from trips where org_id in (select org_id from users where users.id = auth.uid()))
);

create policy geofence_events_org on geofence_events for all using (
  geofence_id in (select id from geofences where org_id in (select org_id from users where users.id = auth.uid()))
);

create policy convoy_members_org on convoy_members for all using (
  convoy_id in (select id from convoy_groups where org_id in (select org_id from users where users.id = auth.uid()))
);

create policy hos_logs_org on hos_logs for all using (
  driver_id in (select id from drivers where org_id in (select org_id from users where users.id = auth.uid()))
);
