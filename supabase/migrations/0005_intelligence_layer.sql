-- 0005_intelligence_layer.sql
-- Phase 5 Intelligence Layer: ETA predictions, actual durations, carbon, toll estimates, driver behavior scores

alter table trips
  add column if not exists predicted_duration_minutes numeric,   -- OSRM estimate captured at dispatch time
  add column if not exists actual_duration_minutes numeric,       -- computed at completion
  add column if not exists carbon_kg numeric,                     -- computed at completion
  add column if not exists toll_estimate_inr numeric;              -- computed at dispatch time

create table if not exists driver_behavior_scores (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete cascade,
  score int not null check (score between 0 and 100),
  harsh_brake_count int not null default 0,
  speeding_event_count int not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists driver_behavior_driver_idx on driver_behavior_scores (driver_id, computed_at desc);

-- RLS
alter table driver_behavior_scores enable row level security;

create policy driver_behavior_scores_org on driver_behavior_scores for all using (
  driver_id in (select id from drivers where org_id in (select org_id from users where users.id = auth.uid()))
);
