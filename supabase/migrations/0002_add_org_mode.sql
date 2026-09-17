-- Migration 0002: Add org_mode enum and mode column to organizations table

create type org_mode as enum ('roadways', 'railways', 'airways', 'seaways');

alter table organizations
  add column mode org_mode not null default 'roadways';

-- Index on mode for mode-specific queries
create index organizations_mode_idx on organizations (mode);
