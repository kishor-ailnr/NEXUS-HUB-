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
  let aircraftB: any;
  let flightB: any;
  let flightMovementB: any;
  let vesselB: any;
  let voyageB: any;
  let voyageMovementB: any;

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
 
    // 7. Seed Airways Org B records
    const { data: a1 } = await adminClient
      .from('airports')
      .insert({
        org_id: orgBId,
        name: `Airport Bom-${runId}`,
        iata_code: `B${runId.slice(-2)}`,
        icao_code: `VAB${runId.slice(-1)}`,
        lat: 19.0896,
        lng: 72.8656,
      })
      .select()
      .single();

    const { data: a2 } = await adminClient
      .from('airports')
      .insert({
        org_id: orgBId,
        name: `Airport Del-${runId}`,
        iata_code: `D${runId.slice(-2)}`,
        icao_code: `VID${runId.slice(-1)}`,
        lat: 28.5562,
        lng: 77.1000,
      })
      .select()
      .single();

    const { data: ac } = await adminClient
      .from('aircraft')
      .insert({
        org_id: orgBId,
        tail_number: `VT-RLS-${runId}`,
        aircraft_type: 'Boeing 777F',
        cargo_capacity_kg: 102000,
        status: 'idle',
      })
      .select()
      .single();
    aircraftB = ac;

    const { data: fc } = await adminClient
      .from('flight_crew')
      .insert({
        org_id: orgBId,
        user_id: userBId,
        license_number: `ATPL-RLS-${runId}`,
        crew_role: 'pilot',
        status: 'available',
      })
      .select()
      .single();

    const { data: fl } = await adminClient
      .from('flights')
      .insert({
        org_id: orgBId,
        flight_number: `NW-${runId}`,
        origin_airport_id: a1?.id,
        destination_airport_id: a2?.id,
      })
      .select()
      .single();
    flightB = fl;

    const { data: fm } = await adminClient
      .from('flight_movements')
      .insert({
        org_id: orgBId,
        flight_id: flightB.id,
        aircraft_id: aircraftB.id,
        pilot_id: fc?.id,
        status: 'planned',
        distance_km: 1150,
        duration_minutes: 120,
      })
      .select()
      .single();
    flightMovementB = fm;

    // 8. Seed Seaways Org B records
    const { data: p1 } = await adminClient
      .from('ports')
      .insert({
        org_id: orgBId,
        name: `Port JNPT-${runId}`,
        unlocode: `INJN${runId.slice(-1)}`,
        lat: 18.95,
        lng: 72.95,
      })
      .select()
      .single();

    const { data: p2 } = await adminClient
      .from('ports')
      .insert({
        org_id: orgBId,
        name: `Port Mundra-${runId}`,
        unlocode: `INMU${runId.slice(-1)}`,
        lat: 22.74,
        lng: 69.70,
      })
      .select()
      .single();

    const { data: vs } = await adminClient
      .from('vessels')
      .insert({
        org_id: orgBId,
        vessel_name: `Ocean Titan ${runId}`,
        imo_number: `98${runId.slice(-5)}`,
        vessel_type: 'Container Ship',
        dwt_tonnes: 120000,
        status: 'idle',
      })
      .select()
      .single();
    vesselB = vs;

    const { data: sc } = await adminClient
      .from('sea_crew')
      .insert({
        org_id: orgBId,
        user_id: userBId,
        certificate_number: `COC-M-${runId}`,
        crew_role: 'master',
        status: 'available',
      })
      .select()
      .single();

    const { data: vy } = await adminClient
      .from('voyages')
      .insert({
        org_id: orgBId,
        voyage_number: `VOY-${runId}`,
        origin_port_id: p1?.id,
        destination_port_id: p2?.id,
      })
      .select()
      .single();
    voyageB = vy;

    const { data: vm } = await adminClient
      .from('voyage_movements')
      .insert({
        org_id: orgBId,
        voyage_id: voyageB.id,
        vessel_id: vesselB.id,
        master_id: sc?.id,
        status: 'planned',
        distance_km: 840,
        duration_minutes: 1440,
      })
      .select()
      .single();
    voyageMovementB = vm;
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

  describe('Airways Mode Tenant Isolation', () => {
    it('blocks Org A user from selecting Org B aircraft', async () => {
      const { data } = await clientA.from('aircraft').select('*').eq('id', aircraftB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B aircraft', async () => {
      const { data } = await clientA.from('aircraft').update({ aircraft_type: 'Hacked Jet' }).eq('id', aircraftB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B aircraft', async () => {
      const { data } = await clientA.from('aircraft').delete().eq('id', aircraftB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B flights', async () => {
      const { data } = await clientA.from('flights').select('*').eq('id', flightB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B flights', async () => {
      const { data } = await clientA.from('flights').update({ flight_number: 'HACKED-FLIGHT' }).eq('id', flightB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B flights', async () => {
      const { data } = await clientA.from('flights').delete().eq('id', flightB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B flight movements', async () => {
      const { data } = await clientA.from('flight_movements').select('*').eq('id', flightMovementB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B flight movements', async () => {
      const { data } = await clientA.from('flight_movements').update({ status: 'completed' }).eq('id', flightMovementB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B flight movements', async () => {
      const { data } = await clientA.from('flight_movements').delete().eq('id', flightMovementB.id).select();
      expect(data).toEqual([]);
    });
  });

  describe('Seaways Mode Tenant Isolation', () => {
    it('blocks Org A user from selecting Org B vessels', async () => {
      const { data } = await clientA.from('vessels').select('*').eq('id', vesselB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B vessels', async () => {
      const { data } = await clientA.from('vessels').update({ vessel_name: 'Hacked Vessel' }).eq('id', vesselB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B vessels', async () => {
      const { data } = await clientA.from('vessels').delete().eq('id', vesselB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B voyages', async () => {
      const { data } = await clientA.from('voyages').select('*').eq('id', voyageB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B voyages', async () => {
      const { data } = await clientA.from('voyages').update({ voyage_number: 'HACKED-VOYAGE' }).eq('id', voyageB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B voyages', async () => {
      const { data } = await clientA.from('voyages').delete().eq('id', voyageB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from selecting Org B voyage movements', async () => {
      const { data } = await clientA.from('voyage_movements').select('*').eq('id', voyageMovementB.id);
      expect(data).toEqual([]);
    });

    it('blocks Org A user from updating Org B voyage movements', async () => {
      const { data } = await clientA.from('voyage_movements').update({ status: 'completed' }).eq('id', voyageMovementB.id).select();
      expect(data).toEqual([]);
    });

    it('blocks Org A user from deleting Org B voyage movements', async () => {
      const { data } = await clientA.from('voyage_movements').delete().eq('id', voyageMovementB.id).select();
      expect(data).toEqual([]);
    });
  });
});

