-- 0009_railways_intelligence.sql
-- Phase 7A-2: Railways Intelligence Layer, Crew Scoring, Slot Intelligence & Movement PDF Reports

-- 1. Extend train_movements table
alter table public.train_movements
  add column if not exists predicted_duration_minutes numeric,
  add column if not exists actual_duration_minutes numeric,
  add column if not exists carbon_kg numeric;

-- 2. Create crew_behavior_scores table
create table if not exists public.crew_behavior_scores (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.train_movements(id) on delete cascade,
  loco_pilot_id uuid not null references public.loco_pilots(id) on delete cascade,
  score int not null check (score between 0 and 100),
  harsh_brake_count int not null default 0,
  overspeed_event_count int not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists idx_crew_behavior_scores_movement on public.crew_behavior_scores (movement_id);
create index if not exists idx_crew_behavior_scores_pilot on public.crew_behavior_scores (loco_pilot_id, computed_at desc);

-- 3. Create train_movement_reports table
create table if not exists public.train_movement_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  movement_id uuid not null references public.train_movements(id) on delete cascade,
  storage_path text not null,
  file_size_bytes int,
  generated_at timestamptz not null default now(),
  unique (movement_id)
);

create index if not exists idx_train_movement_reports_org on public.train_movement_reports (org_id);
create index if not exists idx_train_movement_reports_movement on public.train_movement_reports (movement_id);
create index if not exists idx_train_movement_reports_generated on public.train_movement_reports (generated_at desc);

-- 4. Enable Row Level Security (RLS)
alter table public.crew_behavior_scores enable row level security;
alter table public.train_movement_reports enable row level security;

-- Crew Behavior Scores RLS Policies
create policy "Tenant isolation for crew_behavior_scores select" on public.crew_behavior_scores
  for select using (
    movement_id in (select id from public.train_movements where org_id = public.get_auth_org_id())
  );

create policy "Tenant isolation for crew_behavior_scores insert" on public.crew_behavior_scores
  for insert with check (
    movement_id in (select id from public.train_movements where org_id = public.get_auth_org_id())
  );

create policy "Tenant isolation for crew_behavior_scores update" on public.crew_behavior_scores
  for update using (
    movement_id in (select id from public.train_movements where org_id = public.get_auth_org_id())
  );

create policy "Tenant isolation for crew_behavior_scores delete" on public.crew_behavior_scores
  for delete using (
    movement_id in (select id from public.train_movements where org_id = public.get_auth_org_id())
  );

-- Train Movement Reports RLS Policies
create policy "Tenant isolation for train_movement_reports select" on public.train_movement_reports
  for select using (org_id = public.get_auth_org_id());

create policy "Tenant isolation for train_movement_reports insert" on public.train_movement_reports
  for insert with check (org_id = public.get_auth_org_id());

create policy "Tenant isolation for train_movement_reports update" on public.train_movement_reports
  for update using (org_id = public.get_auth_org_id());

create policy "Tenant isolation for train_movement_reports delete" on public.train_movement_reports
  for delete using (org_id = public.get_auth_org_id());

-- 5. Private storage bucket for train pdfs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('train-pdfs', 'train-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
