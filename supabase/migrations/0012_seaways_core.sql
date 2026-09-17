-- Phase 7C-1 Migration: Seaways Core Tables & RLS Policies

create table ports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  unlocode text,
  lat double precision,
  lng double precision,   -- geocoded via existing GeocodingService
  created_at timestamptz not null default now()
);

create table vessels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  vessel_name text not null,
  imo_number text,
  vessel_type text not null,
  dwt_tonnes numeric,   -- deadweight tonnage — needed for Phase 7C-2's carbon factor bucket
  status text not null default 'idle' check (status in ('idle','active','maintenance')),
  created_at timestamptz not null default now(),
  unique (org_id, imo_number)
);

create table sea_crew (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  certificate_number text not null,
  crew_role text not null default 'officer'
    check (crew_role in ('master','officer','rating')),
  status text not null default 'available' check (status in ('available','on_duty','off_duty')),
  created_at timestamptz not null default now()
);

create table voyages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  voyage_number text not null,
  origin_port_id uuid not null references ports(id),
  destination_port_id uuid not null references ports(id),
  created_at timestamptz not null default now(),
  unique (org_id, voyage_number)
);

create table saved_sea_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  origin_port_id uuid not null references ports(id),
  destination_port_id uuid not null references ports(id),
  route_geometry jsonb,
  routing_source text not null default 'pending'
    check (routing_source in ('searoute','fallback-chokepoint','pending')),
  usage_count int not null default 1,
  updated_at timestamptz not null default now(),
  unique (org_id, origin_port_id, destination_port_id)
);

create table voyage_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  voyage_id uuid not null references voyages(id),
  vessel_id uuid not null references vessels(id),
  master_id uuid not null references sea_crew(id),
  status text not null default 'planned' check (status in ('planned','in_transit','completed','cancelled')),
  distance_km numeric,
  duration_minutes numeric,
  simulation_speed_multiplier numeric not null default 60,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table vessel_telemetry (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references voyage_movements(id) on delete cascade,
  vessel_id uuid not null references vessels(id),
  lat double precision not null,
  lng double precision not null,
  speed_knots numeric not null,
  heading numeric,
  recorded_at timestamptz not null default now()
);

create table sea_convoy_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table sea_convoy_members (
  id uuid primary key default gen_random_uuid(),
  convoy_id uuid not null references sea_convoy_groups(id) on delete cascade,
  vessel_id uuid not null references vessels(id),
  joined_at timestamptz not null default now(),
  unique (convoy_id, vessel_id)
);

-- Indexes
create index idx_ports_org_id on ports (org_id);
create index idx_vessels_org_id on vessels (org_id);
create index idx_sea_crew_org_id on sea_crew (org_id);
create index idx_voyages_org_id on voyages (org_id);
create index idx_saved_sea_routes_org on saved_sea_routes (org_id, origin_port_id, destination_port_id);
create index vessel_telemetry_movement_idx on vessel_telemetry (movement_id, recorded_at desc);
create index voyage_movements_org_status_idx on voyage_movements (org_id, status);
create index idx_sea_convoy_groups_org_id on sea_convoy_groups (org_id);
create index idx_sea_convoy_members_convoy_id on sea_convoy_members (convoy_id);

-- Enable RLS
alter table ports enable row level security;
alter table vessels enable row level security;
alter table sea_crew enable row level security;
alter table voyages enable row level security;
alter table saved_sea_routes enable row level security;
alter table voyage_movements enable row level security;
alter table vessel_telemetry enable row level security;
alter table sea_convoy_groups enable row level security;
alter table sea_convoy_members enable row level security;

-- Ports RLS Policies
create policy "Tenant isolation for ports select" on ports
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for ports insert" on ports
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for ports update" on ports
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for ports delete" on ports
  for delete using (org_id = public.get_auth_org_id());

-- Vessels RLS Policies
create policy "Tenant isolation for vessels select" on vessels
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for vessels insert" on vessels
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for vessels update" on vessels
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for vessels delete" on vessels
  for delete using (org_id = public.get_auth_org_id());

-- Sea Crew RLS Policies
create policy "Tenant isolation for sea_crew select" on sea_crew
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for sea_crew insert" on sea_crew
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for sea_crew update" on sea_crew
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for sea_crew delete" on sea_crew
  for delete using (org_id = public.get_auth_org_id());

-- Voyages RLS Policies
create policy "Tenant isolation for voyages select" on voyages
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for voyages insert" on voyages
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for voyages update" on voyages
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for voyages delete" on voyages
  for delete using (org_id = public.get_auth_org_id());

-- Saved Sea Routes RLS Policies
create policy "Tenant isolation for saved_sea_routes select" on saved_sea_routes
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for saved_sea_routes insert" on saved_sea_routes
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for saved_sea_routes update" on saved_sea_routes
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for saved_sea_routes delete" on saved_sea_routes
  for delete using (org_id = public.get_auth_org_id());

-- Voyage Movements RLS Policies
create policy "Tenant isolation for voyage_movements select" on voyage_movements
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for voyage_movements insert" on voyage_movements
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for voyage_movements update" on voyage_movements
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for voyage_movements delete" on voyage_movements
  for delete using (org_id = public.get_auth_org_id());

-- Vessel Telemetry RLS Policies
create policy "Tenant isolation for vessel_telemetry select" on vessel_telemetry
  for select using (movement_id in (select id from voyage_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for vessel_telemetry insert" on vessel_telemetry
  for insert with check (movement_id in (select id from voyage_movements where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for vessel_telemetry delete" on vessel_telemetry
  for delete using (movement_id in (select id from voyage_movements where org_id = public.get_auth_org_id()));

-- Sea Convoy Groups RLS Policies
create policy "Tenant isolation for sea_convoy_groups select" on sea_convoy_groups
  for select using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for sea_convoy_groups insert" on sea_convoy_groups
  for insert with check (org_id = public.get_auth_org_id());
create policy "Tenant isolation for sea_convoy_groups update" on sea_convoy_groups
  for update using (org_id = public.get_auth_org_id());
create policy "Tenant isolation for sea_convoy_groups delete" on sea_convoy_groups
  for delete using (org_id = public.get_auth_org_id());

-- Sea Convoy Members RLS Policies
create policy "Tenant isolation for sea_convoy_members select" on sea_convoy_members
  for select using (convoy_id in (select id from sea_convoy_groups where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for sea_convoy_members insert" on sea_convoy_members
  for insert with check (convoy_id in (select id from sea_convoy_groups where org_id = public.get_auth_org_id()));
create policy "Tenant isolation for sea_convoy_members delete" on sea_convoy_members
  for delete using (convoy_id in (select id from sea_convoy_groups where org_id = public.get_auth_org_id()));
