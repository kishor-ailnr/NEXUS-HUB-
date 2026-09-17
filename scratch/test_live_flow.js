const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

async function runLiveAudit() {
  console.log('=== Step 1: Register Brand New Org and Manager ===');
  const orgName = `Audit Org ${Date.now()}`;
  const userPayload = {
    fullName: 'Audit Manager',
    email: `audit.manager.${Date.now()}@nexusways.com`,
    password: 'SecurePassword123!',
    orgName: orgName,
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai City',
    address: '101 Bandra Kurla Complex, Mumbai',
  };

  const regRes = await fetch('http://localhost:4000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userPayload),
  });

  const regStatus = regRes.status;
  const regCookies = regRes.headers.getSetCookie ? regRes.headers.getSetCookie().join('; ') : (regRes.headers.get('set-cookie') || '');
  const regBody = await regRes.json();
  console.log('Register Response Status:', regStatus);
  console.log('Register Response Body:', JSON.stringify(regBody, null, 2));
  console.log('Cookie:', regCookies);

  return { regCookies, regBody };
}

runLiveAudit().catch(console.error);
