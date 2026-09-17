import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Supabase Real RLS Live Verification (e2e)', () => {
  jest.setTimeout(60000);

  const supabaseUrl = process.env.SUPABASE_URL || 'https://facnvxbznmbhzdkbumby.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  let adminClient: any;
  let clientA: any;
  let clientB: any;

  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;

  let vehicleB: any;
  let driverB: any;
  let tripB: any;
  let trainB: any;
  let movementB: any;
  let notifTargetedB: any;
  let notifBroadcastB: any;
  let alertB: any;

  const runId = Date.now().toString().slice(-6);
  const userAEmail = `e2e_a_${runId}@rls-live.internal`;
  const userBEmail = `e2e_b_${runId}@rls-live.internal`;
  const password = 'TestPassword123!';

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Create Org A
    const { data: orgA, error: orgAErr } = await adminClient
      .from('organizations')
      .insert({
        name: `Org-A-${runId}`,
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai',
        address: 'Terminal A',
        mode: 'roadways',
      })
      .select()
      .single();
    if (orgAErr) throw orgAErr;
    orgAId = orgA.id;

    // 2. Create User A in Auth & Users table
    const { data: authA, error: authAErr } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'User A' },
    });
    if (authAErr) throw authAErr;
    userAId = authA.user.id;

    await adminClient.from('users').insert({
      id: userAId,
      org_id: orgAId,
      email: userAEmail,
      full_name: 'User A',
      role: 'manager',
    });

    // 3. Create Org B
    const { data: orgB, error: orgBErr } = await adminClient
      .from('organizations')
      .insert({
        name: `Org-B-${runId}`,
        country: 'India',
        state: 'Maharashtra',
        district: 'Pune',
        address: 'Terminal B',
        mode: 'roadways',
      })
      .select()
      .single();
    if (orgBErr) throw orgBErr;
    orgBId = orgB.id;

    // 4. Create User B in Auth & Users table
    const { data: authB, error: authBErr } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'User B' },
    });
    if (authBErr) throw authBErr;
    userBId = authB.user.id;

    await adminClient.from('users').insert({
      id: userBId,
      org_id: orgBId,
      email: userBEmail,
      full_name: 'User B',
      role: 'manager',
    });

    // 5. Authenticate clients with anon key + user passwords
    clientA = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: logAErr } = await clientA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (logAErr) throw logAErr;

    clientB = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: logBErr } = await clientB.auth.signInWithPassword({
      email: userBEmail,
      password,
    });
    if (logBErr) throw logBErr;

    // 6. Seed Org B records
    const { data: v } = await adminClient
      .from('vehicles')
      .insert({
        org_id: orgBId,
        registration_number: `MH-12-RLS-${runId}`,
        vehicle_type: 'Heavy Commercial Vehicle',
        capacity_kg: 25000,
        status: 'idle',
      })
      .select()
      .single();
    vehicleB = v;

    const { data: d } = await adminClient
      .from('drivers')
      .insert({
        org_id: orgBId,
        user_id: userBId,
        license_number: `DL-RLS-${runId}`,
        phone: '+919876543210',
        status: 'available',
      })
      .select()
      .single();
    driverB = d;

    const { data: tr } = await adminClient
      .from('trips')
      .insert({
        org_id: orgBId,
        vehicle_id: vehicleB.id,
        driver_id: driverB.id,
        origin_label: 'Pune Warehouse',
        origin_lat: 18.5204,
        origin_lng: 73.8567,
        destination_label: 'Mumbai Port',
        destination_lat: 18.9438,
        destination_lng: 72.836,
        status: 'planned',
        distance_km: 150,
        duration_minutes: 180,
      })
      .select()
      .single();
    tripB = tr;

    const { data: nt } = await adminClient
      .from('notifications')
      .insert({
        org_id: orgBId,
        user_id: userBId,
        type: 'alert',
        title: 'Org B Secret Alert',
        body: 'Confidential Org B message for User B',
      })
      .select()
      .single();
    notifTargetedB = nt;

    const { data: nb } = await adminClient
      .from('notifications')
      .insert({
        org_id: orgBId,
        user_id: null,
        type: 'system',
        title: 'Org B Broadcast Notice',
        body: 'Broadcast for Org B staff only',
      })
      .select()
      .single();
    notifBroadcastB = nb;

    const { data: al } = await adminClient
      .from('alerts')
      .insert({
        org_id: orgBId,
        type: 'speed_violation',
        severity: 'high',
        message: 'Vehicle exceeded speed limit in Org B',
      })
      .select()
      .single();
    alertB = al;

    const { data: s1 } = await adminClient
      .from('stations')
      .insert({
        org_id: orgBId,
        name: `Station 1-${runId}`,
        station_code: `S1${runId}`,
        station_type: 'station',
      })
      .select()
      .single();

    const { data: s2 } = await adminClient
      .from('stations')
      .insert({
        org_id: orgBId,
        name: `Station 2-${runId}`,
        station_code: `S2${runId}`,
        station_type: 'station',
      })
      .select()
      .single();

    const { data: t } = await adminClient
      .from('trains')
      .insert({
        org_id: orgBId,
        train_number: `TRN-${runId}`,
        train_name: `Freight Express ${runId}`,
        status: 'idle',
      })
      .select()
      .single();
    trainB = t;

    const { data: lp } = await adminClient
      .from('loco_pilots')
      .insert({
        org_id: orgBId,
        user_id: userBId,
        license_number: `LP-IN-${runId}`,
        phone: '+91 98765 43210',
        status: 'available',
      })
      .select()
      .single();

    const { data: tm } = await adminClient
      .from('train_movements')
      .insert({
        org_id: orgBId,
        train_id: trainB.id,
        loco_pilot_id: lp.id,
        origin_station_id: s1?.id,
        destination_station_id: s2?.id,
        status: 'planned',
        distance_km: 120,
        duration_minutes: 90,
      })
      .select()
      .single();
    movementB = tm;
  });

  afterAll(async () => {
    if (orgAId) await adminClient.from('organizations').delete().eq('id', orgAId);
    if (orgBId) await adminClient.from('organizations').delete().eq('id', orgBId);
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
  });

  describe('Roadways Mode Tenant Isolation', () => {
    it('blocks Org A user from selecting Org B trips', async () => {
      const { data } = await clientA.from('trips').select('*').eq('id', tripB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B trips', async () => {
      const { data } = await clientA.from('trips').update({ status: 'completed' }).eq('id', tripB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B trips', async () => {
      const { data } = await clientA.from('trips').delete().eq('id', tripB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B vehicles', async () => {
      const { data } = await clientA.from('vehicles').select('*').eq('id', vehicleB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B vehicles', async () => {
      const { data } = await clientA.from('vehicles').update({ status: 'maintenance' }).eq('id', vehicleB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B vehicles', async () => {
      const { data } = await clientA.from('vehicles').delete().eq('id', vehicleB.id).select();
      expect(data).toEqual([]);
    });
  });

  describe('Railways Mode Tenant Isolation', () => {
    it('blocks Org A user from selecting Org B trains', async () => {
      const { data } = await clientA.from('trains').select('*').eq('id', trainB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B trains', async () => {
      const { data } = await clientA.from('trains').update({ train_name: 'Hacked' }).eq('id', trainB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B trains', async () => {
      const { data } = await clientA.from('trains').delete().eq('id', trainB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B train movements', async () => {
      const { data } = await clientA.from('train_movements').select('*').eq('id', movementB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B train movements', async () => {
      const { data } = await clientA.from('train_movements').update({ status: 'completed' }).eq('id', movementB.id).select();
      expect(data).toEqual([]);
    });
  });

  describe('Shared Tables Tenant Isolation (Notifications & Alerts)', () => {
    it('blocks Org A user from selecting Org B targeted notifications', async () => {
      const { data } = await clientA.from('notifications').select('*').eq('id', notifTargetedB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B broadcast notifications', async () => {
      const { data } = await clientA.from('notifications').select('*').eq('id', notifBroadcastB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B broadcast notifications', async () => {
      const { data } = await clientA.from('notifications').update({ body: 'Hacked' }).eq('id', notifBroadcastB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B alerts', async () => {
      const { data } = await clientA.from('alerts').select('*').eq('id', alertB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B alerts', async () => {
      const { data } = await clientA.from('alerts').update({ message: 'Hacked' }).eq('id', alertB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B alerts', async () => {
      const { data } = await clientA.from('alerts').delete().eq('id', alertB.id).select();
      expect(data).toEqual([]);
    });
  });
});
