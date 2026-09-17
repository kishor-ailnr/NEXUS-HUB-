async function runQA() {
  console.log('--- Phase 1 Live Manual QA Execution ---');
  
  const testUser = {
    fullName: 'Rahul Sharma',
    email: `manager.${Date.now()}@nexusways.com`,
    password: 'SecurePassword123!',
    orgName: 'Nexus Global Logistics Ltd',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai City',
    address: '101 Marine Drive, Nariman Point, Mumbai',
  };

  console.log('Step 1: Registering new organization & manager account...');
  const regRes = await fetch('http://localhost:4000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });

  const cookies = regRes.headers.get('set-cookie') || '';
  const regData = await regRes.json();
  console.log(`Step 1 Status: ${regRes.status} (${regRes.statusText})`);
  console.log('Registered User Payload:', JSON.stringify(regData.user, null, 2));
  console.log('Session Cookies Received:', cookies.split(';').filter(c => c.includes('nw_access') || c.includes('nw_refresh')).join('; '));

  // Extract nw_access cookie
  const cookieHeader = regRes.headers.getSetCookie ? regRes.headers.getSetCookie().join('; ') : cookies;

  console.log('\nStep 2: Accessing protected endpoint /auth/me with session cookie...');
  const meRes = await fetch('http://localhost:4000/auth/me', {
    headers: { 'Cookie': cookieHeader },
  });
  const meData = await meRes.json();
  console.log(`Step 2 Status: ${meRes.status} (${meRes.statusText})`);
  console.log('Authenticated Profile:', JSON.stringify(meData.user, null, 2));

  console.log('\nStep 3: Logging out via /auth/logout...');
  const logoutRes = await fetch('http://localhost:4000/auth/logout', {
    method: 'POST',
    headers: { 'Cookie': cookieHeader },
  });
  const logoutData = await logoutRes.json();
  console.log(`Step 3 Status: ${logoutRes.status} (${logoutRes.statusText})`);
  console.log('Logout Response:', logoutData);

  console.log('\nStep 4: Verifying protected route access is blocked without active session...');
  const unauthRes = await fetch('http://localhost:4000/auth/me');
  const unauthData = await unauthRes.json();
  console.log(`Step 4 Status: ${unauthRes.status} (${unauthRes.statusText})`);
  console.log('Blocked Response:', unauthData);
  console.log('----------------------------------------');
}

runQA().catch(console.error);
