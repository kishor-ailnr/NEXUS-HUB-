-- ==========================================================
-- Phase 7B-2: Airways Intelligence Layer & PDF Reports
-- ==========================================================

-- 1. Extend flight_movements table with intelligence columns
alter table flight_movements
  add column if not exists predicted_duration_minutes numeric,
  add column if not exists actual_duration_minutes numeric,
  add column if not exists carbon_kg numeric;

-- 2. Crew Flight Scoring Table
create table if not exists crew_flight_scores (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references flight_movements(id) on delete cascade,
  pilot_id uuid not null references flight_crew(id) on delete cascade,
  score int not null check (score between 0 and 100),
  abrupt_maneuver_count int not null default 0,
  overspeed_event_count int not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists idx_crew_flight_scores_movement on crew_flight_scores(movement_id);
create index if not exists idx_crew_flight_scores_pilot on crew_flight_scores(pilot_id);

-- 3. Flight Duty Logs Table (DGCA India FDTL Compliant)
create table if not exists flight_duty_logs (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references flight_crew(id) on delete cascade,
  movement_id uuid references flight_movements(id) on delete set null,
  duty_minutes numeric not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  violation boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_flight_duty_logs_pilot on flight_duty_logs(pilot_id);
create index if not exists idx_flight_duty_logs_window on flight_duty_logs(window_started_at, window_ended_at);

-- 4. Flight Movement PDF Reports Table
create table if not exists flight_movement_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  movement_id uuid not null references flight_movements(id) on delete cascade,
  storage_path text not null,
  file_size_bytes int,
  generated_at timestamptz not null default now(),
  unique (movement_id)
);

create index if not exists idx_flight_movement_reports_org on flight_movement_reports(org_id);

-- Enable RLS
alter table crew_flight_scores enable row level security;
alter table flight_duty_logs enable row level security;
alter table flight_movement_reports enable row level security;

-- Policies for crew_flight_scores
create policy "Users can view crew flight scores for their org"
  on crew_flight_scores for select
  using (
    exists (
      select 1 from flight_movements fm
      where fm.id = crew_flight_scores.movement_id
      and fm.org_id = auth.jwt() ->> 'orgId'::uuid
    )
  );

create policy "Users can manage crew flight scores for their org"
  on crew_flight_scores for all
  using (
    exists (
      select 1 from flight_movements fm
      where fm.id = crew_flight_scores.movement_id
      and fm.org_id = auth.jwt() ->> 'orgId'::uuid
    )
  );

-- Policies for flight_duty_logs
create policy "Users can view flight duty logs for their org"
  on flight_duty_logs for select
  using (
    exists (
      select 1 from flight_crew fc
      where fc.id = flight_duty_logs.pilot_id
      and fc.org_id = auth.jwt() ->> 'orgId'::uuid
    )
  );

create policy "Users can manage flight duty logs for their org"
  on flight_duty_logs for all
  using (
    exists (
      select 1 from flight_crew fc
      where fc.id = flight_duty_logs.pilot_id
      and fc.org_id = auth.jwt() ->> 'orgId'::uuid
    )
  );

-- Policies for flight_movement_reports
create policy "Users can view flight movement reports for their org"
  on flight_movement_reports for select
  using (org_id = auth.jwt() ->> 'orgId'::uuid);

create policy "Users can manage flight movement reports for their org"
  on flight_movement_reports for all
  using (org_id = auth.jwt() ->> 'orgId'::uuid);
