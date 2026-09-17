-- Phase 1 Foundation Migration: Organizations, Users, Roles and RLS

-- Create user_role enum
create type user_role as enum ('manager', 'operator', 'driver', 'crew');

-- Create organizations table
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'India',
  state text not null,
  district text not null,
  address text not null,
  created_at timestamptz not null default now()
);

-- Create users table linked to Supabase auth.users
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'manager',
  created_at timestamptz not null default now()
);

-- Create helpful indexes
create index idx_users_org_id on users (org_id);
create index idx_users_email on users (email);

-- Enable Row Level Security
alter table organizations enable row level security;
alter table users enable row level security;

-- RLS Policies for organizations
-- A user may read their own organization's row
create policy org_select_own on organizations for select
  using (id in (select org_id from users where users.id = auth.uid()));

-- RLS Policies for users
-- A user may read other users in their own organization
create policy users_select_same_org on users for select
  using (org_id in (select org_id from users u2 where u2.id = auth.uid()));

-- A user may update only their own row
create policy users_update_self on users for update
  using (id = auth.uid());
