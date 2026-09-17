-- ==========================================================
-- Phase 7C-2: Seaways Intelligence Layer & PDF Reports
-- ==========================================================

-- 1. Extend voyage_movements and vessels table with intelligence columns
alter table voyage_movements
  add column if not exists predicted_duration_minutes numeric,
  add column if not exists actual_duration_minutes numeric,
  add column if not exists carbon_kg numeric;

alter table vessels
  add column if not exists teu_capacity int;

-- 2. Sea Crew Behavior Scoring Table
create table if not exists sea_crew_scores (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references voyage_movements(id) on delete cascade,
  crew_id uuid not null references sea_crew(id) on delete cascade,
  score int not null check (score between 0 and 100),
  harsh_maneuver_count int not null default 0,
  overspeed_event_count int not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists idx_sea_crew_scores_movement on sea_crew_scores(movement_id);
create index if not exists idx_sea_crew_scores_crew on sea_crew_scores(crew_id);

-- 3. Watchkeeping Logs Table (STCW Regulation VIII/1 & Section A-VIII/1 / MLC 2006 Compliant)
create table if not exists watchkeeping_logs (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references sea_crew(id) on delete cascade,
  movement_id uuid references voyage_movements(id) on delete set null,
  duty_minutes numeric not null,
  rest_minutes numeric not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  violation boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_watchkeeping_logs_crew on watchkeeping_logs(crew_id);
create index if not exists idx_watchkeeping_logs_window on watchkeeping_logs(window_started_at, window_ended_at);

-- 4. Voyage Movement PDF Reports Table
create table if not exists voyage_movement_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  movement_id uuid not null references voyage_movements(id) on delete cascade,
  storage_path text not null,
  file_size_bytes int,
  generated_at timestamptz not null default now(),
  unique (movement_id)
);

create index if not exists idx_voyage_movement_reports_org on voyage_movement_reports(org_id);

-- Enable RLS
alter table sea_crew_scores enable row level security;
alter table watchkeeping_logs enable row level security;
alter table voyage_movement_reports enable row level security;

-- Policies for sea_crew_scores
create policy "Tenant isolation for sea_crew_scores select"
  on sea_crew_scores for select
  using (
    exists (
      select 1 from voyage_movements vm
      where vm.id = sea_crew_scores.movement_id
      and vm.org_id = public.get_auth_org_id()
    )
  );

create policy "Tenant isolation for sea_crew_scores insert"
  on sea_crew_scores for insert
  with check (
    exists (
      select 1 from voyage_movements vm
      where vm.id = sea_crew_scores.movement_id
      and vm.org_id = public.get_auth_org_id()
    )
  );

create policy "Tenant isolation for sea_crew_scores update"
  on sea_crew_scores for update
  using (
    exists (
      select 1 from voyage_movements vm
      where vm.id = sea_crew_scores.movement_id
      and vm.org_id = public.get_auth_org_id()
    )
  );

create policy "Tenant isolation for sea_crew_scores delete"
  on sea_crew_scores for delete
  using (
    exists (
      select 1 from voyage_movements vm
      where vm.id = sea_crew_scores.movement_id
      and vm.org_id = public.get_auth_org_id()
    )
  );

-- Policies for watchkeeping_logs
create policy "Tenant isolation for watchkeeping_logs select"
  on watchkeeping_logs for select
  using (
    exists (
      select 1 from sea_crew sc
      where sc.id = watchkeeping_logs.crew_id
      and sc.org_id = public.get_auth_org_id()
    )
  );

create policy "Tenant isolation for watchkeeping_logs insert"
  on watchkeeping_logs for insert
  with check (
    exists (
      select 1 from sea_crew sc
      where sc.id = watchkeeping_logs.crew_id
      and sc.org_id = public.get_auth_org_id()
    )
  );

create policy "Tenant isolation for watchkeeping_logs update"
  on watchkeeping_logs for update
  using (
    exists (
      select 1 from sea_crew sc
      where sc.id = watchkeeping_logs.crew_id
      and sc.org_id = public.get_auth_org_id()
    )
  );

create policy "Tenant isolation for watchkeeping_logs delete"
  on watchkeeping_logs for delete
  using (
    exists (
      select 1 from sea_crew sc
      where sc.id = watchkeeping_logs.crew_id
      and sc.org_id = public.get_auth_org_id()
    )
  );

-- Policies for voyage_movement_reports
create policy "Tenant isolation for voyage_movement_reports select"
  on voyage_movement_reports for select
  using (org_id = public.get_auth_org_id());

create policy "Tenant isolation for voyage_movement_reports insert"
  on voyage_movement_reports for insert
  with check (org_id = public.get_auth_org_id());

create policy "Tenant isolation for voyage_movement_reports update"
  on voyage_movement_reports for update
  using (org_id = public.get_auth_org_id());

create policy "Tenant isolation for voyage_movement_reports delete"
  on voyage_movement_reports for delete
  using (org_id = public.get_auth_org_id());
