const { createClient } = require('@supabase/supabase-js');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: 'apps/api/.env' });

const API_BASE = 'http://localhost:4000';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFullAudit() {
  console.log('================================================================');
  console.log('--- SECTION 1: SCHEMA AUDIT (LIVE SUPABASE DB & STORAGE) ---');
  console.log('================================================================');

  // Query actual table trip_reports
  const { data: trData, error: trErr } = await supabase.from('trip_reports').select('*').limit(1);
  console.log('1. trip_reports query result:', { trData, trErr });

  // List all public schema tables
  const { data: orgData, error: orgErr } = await supabase.from('organizations').select('id, name, mode, latitude, longitude').limit(1);
  console.log('2. organizations table sample (with mode, lat, lng):', { orgData, orgErr });

  // List buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('3. Supabase storage buckets listing:');
  console.log(JSON.stringify(buckets, null, 2));

  console.log('\n================================================================');
  console.log('--- SECTION 5: 11-STEP FULL REGRESSION WALKTHROUGH ---');
  console.log('================================================================');

  // Step 1: Register brand new organization
  const timestamp = Date.now();
  const regPassword = 'SecurePassword123!';
  const regPayload = {
    fullName: `Audit Manager ${timestamp}`,
    email: `audit.mgr.${timestamp}@nexusways.com`,
    password: regPassword,
    orgName: `Audit Logistics ${timestamp}`,
    mode: 'roadways',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai City',
    address: 'Gateway of India, Colaba, Mumbai',
  };

  console.log('\n[Step 1: Registration]');
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });
  const regStatus = regRes.status;
  const regBody = await regRes.json();
  let cookies = regRes.headers.getSetCookie ? regRes.headers.getSetCookie().join('; ') : (regRes.headers.get('set-cookie') || '');
  console.log(`Status: ${regStatus}`);
  console.log('Body:', JSON.stringify(regBody, null, 2));
  console.log('Session Cookies Received:', cookies);

  // Step 2: Auth Profile check /auth/me
  console.log('\n[Step 2: Auth Check /auth/me]');
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: cookies },
  });
  const meStatus = meRes.status;
  const meBody = await meRes.json();
  console.log(`Status: ${meStatus}`);
  console.log('Body:', JSON.stringify(meBody, null, 2));

  // Step 3: Google OAuth status
  console.log('\n[Step 3: Google OAuth status check]');
  const hasGoogleClientId = !!process.env.GOOGLE_CLIENT_ID;
  console.log(`GOOGLE_CLIENT_ID configured: ${hasGoogleClientId}`);
  console.log('State: Browser-driven Google OAuth remains UNVERIFIED due to unconfigured OAuth credentials in local .env');

  // Step 4: Add Vehicle
  console.log('\n[Step 4: Create Vehicle]');
  const vPayload = {
    registrationNumber: `MH-04-QA-${Math.floor(1000 + Math.random() * 9000)}`,
    vehicleType: 'Heavy Commercial Vehicle (3-Axle)',
    capacityTonnes: 16,
    fuelType: 'diesel',
    emissionStandard: 'BS6',
  };
  const vRes = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify(vPayload),
  });
  console.log(`Status: ${vRes.status}`);
  const vBody = await vRes.json();
  console.log('Vehicle Body:', JSON.stringify(vBody, null, 2));

  // Step 5: Add Driver
  console.log('\n[Step 5: Create Driver]');
  const dPayload = {
    fullName: 'Suresh Patil',
    email: `driver.${timestamp}@nexusways.com`,
    licenseNumber: `MH-DRV-${Math.floor(100000 + Math.random() * 900000)}`,
    phone: '+919876543210',
    experienceYears: 8,
  };
  const dRes = await fetch(`${API_BASE}/drivers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify(dPayload),
  });
  console.log(`Status: ${dRes.status}`);
  const dBody = await dRes.json();
  console.log('Driver Body:', JSON.stringify(dBody, null, 2));

  // Step 6: Dispatch Trip with OSRM routing
  console.log('\n[Step 6: Dispatch Trip with OSRM routing]');
  const tripPayload = {
    vehicleId: vBody?.id,
    driverId: dBody?.id,
    originAddress: 'Gateway of India, Mumbai, India',
    destinationAddress: 'Pune Station, Pune, India',
    cargoDescription: 'Industrial Machine Assemblies',
    cargoWeightTonnes: 14.2,
    checkpoints: [
      { sequence: 1, label: 'Khalapur Toll Plaza', lat: 18.8322, lng: 73.2842 },
      { sequence: 2, label: 'Lonavala Ghat Rest Stop', lat: 18.7546, lng: 73.4062 }
    ]
  };
  const tripRes = await fetch(`${API_BASE}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify(tripPayload),
  });
  console.log(`Status: ${tripRes.status}`);
  const tripBody = await tripRes.json();
  console.log('Dispatched Trip Body:', JSON.stringify(tripBody, null, 2));

  // Step 7: Missing report 404 test on pending trip
  console.log('\n[Step 7: Check /trips/:id/report on pending trip (Expect 404)]');
  if (tripBody?.id) {
    const reportRes404 = await fetch(`${API_BASE}/trips/${tripBody.id}/report`, {
      headers: { Cookie: cookies },
    });
    console.log(`Status: ${reportRes404.status}`);
    const reportBody404 = await reportRes404.json();
    console.log('Report 404 Body:', JSON.stringify(reportBody404, null, 2));
  }

  // Step 8: WebSocket Realtime Simulation
  console.log('\n[Step 8: WebSocket Live Simulation]');
  const wsEvents = [];
  const accessTokenMatch = cookies.match(/nw_access=([^;]+)/);
  const accessToken = accessTokenMatch ? accessTokenMatch[1] : '';

  const socket = io(`${API_BASE}/realtime`, {
    transports: ['websocket'],
    auth: { token: accessToken },
    extraHeaders: { Cookie: cookies },
  });

  socket.on('connect', () => {
    console.log(`WebSocket connected to /realtime (Socket ID: ${socket.id})`);
    socket.emit('subscribe:trip', { tripId: tripBody?.id });
  });

  socket.on('tracking:update', (data) => {
    console.log('[WS Realtime Event: tracking:update]', JSON.stringify(data));
    wsEvents.push({ event: 'tracking:update', data });
  });

  socket.on('alert:raised', (data) => {
    console.log('[WS Realtime Event: alert:raised]', JSON.stringify(data));
    wsEvents.push({ event: 'alert:raised', data });
  });

  // Start simulation via PATCH status to in_transit
  if (tripBody?.id) {
    console.log('Starting live simulation by PATCHing status to in_transit...');
    const startRes = await fetch(`${API_BASE}/trips/${tripBody.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({ status: 'in_transit' }),
    });
    console.log(`in_transit Status: ${startRes.status}`);
    const startBody = await startRes.json();
    console.log('in_transit Body:', JSON.stringify(startBody, null, 2));
  }

  // Wait 4 seconds for simulation points to stream
  console.log('Listening for live simulation WebSocket events (4 seconds)...');
  await sleep(4000);

  // Step 9: Complete Trip
  console.log('\n[Step 9: Complete Trip & Generate PDF in Supabase Storage]');
  if (tripBody?.id) {
    const completeRes = await fetch(`${API_BASE}/trips/${tripBody.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({ status: 'completed' }),
    });
    console.log(`Complete Status: ${completeRes.status}`);
    const completeBody = await completeRes.json();
    console.log('Complete Body:', JSON.stringify(completeBody, null, 2));
  }

  // Allow storage upload & report row creation to finish
  await sleep(2000);

  // Step 10: Fetch Generated PDF Report URL and Download PDF
  console.log('\n[Step 10: GET /trips/:id/report, Follow Signed URL & Download PDF]');
  let downloadedPdfBuffer = null;
  if (tripBody?.id) {
    const reportRes = await fetch(`${API_BASE}/trips/${tripBody.id}/report`, {
      headers: { Cookie: cookies },
    });
    console.log(`Status: ${reportRes.status}`);
    const reportBody = await reportRes.json();
    console.log('Report Signed URL Response:', JSON.stringify(reportBody, null, 2));

    if (reportBody?.signedUrl) {
      console.log(`Downloading PDF from signedUrl: ${reportBody.signedUrl.substring(0, 80)}...`);
      const pdfFetch = await fetch(reportBody.signedUrl);
      const pdfArrayBuffer = await pdfFetch.arrayBuffer();
      downloadedPdfBuffer = Buffer.from(pdfArrayBuffer);
      const savePath = path.join(__dirname, `fresh_trip_${tripBody.id}.pdf`);
      fs.writeFileSync(savePath, downloadedPdfBuffer);
      console.log(`Downloaded and saved PDF to: ${savePath} (${downloadedPdfBuffer.length} bytes)`);

      // File header check
      const magicBytes = downloadedPdfBuffer.subarray(0, 5).toString('ascii');
      const headerLine = downloadedPdfBuffer.subarray(0, 10).toString('ascii');
      console.log(`Magic Bytes: "${magicBytes}" (Expected: "%PDF-")`);
      console.log(`Header Line: "${headerLine}"`);
    }
  }

  // Step 11: Admin Reports Ledger
  console.log('\n[Step 11: GET /admin/reports]');
  // First verify admin password
  console.log('Verifying manager password via POST /admin/verify-password...');
  const verifyRes = await fetch(`${API_BASE}/admin/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ password: regPassword }),
  });
  console.log(`Verify Password Status: ${verifyRes.status}`);
  const verifyBody = await verifyRes.json();
  console.log('Verify Password Body:', JSON.stringify(verifyBody, null, 2));
  const adminCookie = verifyRes.headers.getSetCookie ? verifyRes.headers.getSetCookie().join('; ') : (verifyRes.headers.get('set-cookie') || '');
  if (adminCookie) {
    cookies = `${cookies}; ${adminCookie}`;
  }

  const adminRes = await fetch(`${API_BASE}/admin/reports`, {
    headers: { Cookie: cookies },
  });
  console.log(`GET /admin/reports Status: ${adminRes.status}`);
  const adminBody = await adminRes.json();
  console.log('Admin Reports Response Body:');
  console.log(JSON.stringify(adminBody, null, 2));

  socket.disconnect();
  console.log('\n================================================================');
  console.log('--- ALL 11 STEPS COMPLETED WITH LIVE EVIDENCE ---');
  console.log('================================================================');
}

runFullAudit().catch((err) => {
  console.error('Audit run error:', err);
  process.exit(1);
});
