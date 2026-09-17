-- 0007_fix_rls_recursion.sql
-- Fix infinite recursion in RLS policies on public.users and dependent tables

create or replace function public.get_auth_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.users where id = auth.uid() limit 1;
$$;

-- 1. Fix users policy
drop policy if exists users_select_same_org on public.users;
create policy users_select_same_org on public.users for select
  using (id = auth.uid() or org_id = public.get_auth_org_id());

-- 2. Fix organizations policy
drop policy if exists org_select_own on public.organizations;
create policy org_select_own on public.organizations for select
  using (id = public.get_auth_org_id());

-- 3. Fix trip_reports policies
drop policy if exists "Tenant isolation for trip_reports select" on public.trip_reports;
create policy "Tenant isolation for trip_reports select" on public.trip_reports
  for select using (org_id = public.get_auth_org_id());

drop policy if exists "Tenant isolation for trip_reports insert" on public.trip_reports;
create policy "Tenant isolation for trip_reports insert" on public.trip_reports
  for insert with check (org_id = public.get_auth_org_id());
