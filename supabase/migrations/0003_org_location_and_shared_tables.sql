-- 0003_org_location_and_shared_tables.sql
-- Add location coordinates to organizations and create notifications and alerts tables

alter table organizations
  add column latitude double precision,
  add column longitude double precision;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references users (id) on delete cascade, -- null = org-wide
  type text not null,                -- e.g. 'system', 'alert', 'info'
  title text not null,
  body text not null,
  action_label text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  message text not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
alter table alerts enable row level security;

create policy notifications_select_own_org on notifications for select
  using (org_id in (select org_id from users where users.id = auth.uid())
         and (user_id is null or user_id = auth.uid()));

create policy notifications_update_own on notifications for update
  using (user_id = auth.uid() or user_id is null);

create policy alerts_select_own_org on alerts for select
  using (org_id in (select org_id from users where users.id = auth.uid()));

create index notifications_org_user_idx on notifications (org_id, user_id, read_at);
create index alerts_org_idx on alerts (org_id, created_at desc);
