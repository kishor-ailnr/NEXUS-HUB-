const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'apps/api/.env' });

const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

async function testAdminReports() {
  console.log('--- Testing GET /admin/reports with real org and completed trip ---');
  
  // Create manager JWT token
  const token = jwt.sign(
    {
      sub: 'dbcbf3f7-e16e-49bf-9949-e8f53bf7cc00',
      id: 'dbcbf3f7-e16e-49bf-9949-e8f53bf7cc00',
      email: 'audit.mgr.1788919389776@nexusways.com',
      fullName: 'Audit Manager',
      orgId: 'e4b535b6-7dbe-4233-b745-f5cea544a4f4',
      role: 'manager',
      mode: 'roadways',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authCookie = `nw_access=${token}`;

  // Verify password for admin session
  const verifyRes = await fetch(`${API_BASE}/admin/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify({ password: 'SecurePassword123!' })
  });
  console.log('Admin verify status:', verifyRes.status);
  const rawSetCookie = verifyRes.headers.get('set-cookie') || '';
  const adminCookieMatch = rawSetCookie.match(/nw_admin=([^;]+)/);
  const adminCookie = adminCookieMatch ? `nw_admin=${adminCookieMatch[1]}` : '';

  const finalCookies = `${authCookie}; ${adminCookie}`;
  console.log('Sending Cookies:', finalCookies);

  // Call GET /admin/reports
  const res = await fetch(`${API_BASE}/admin/reports`, {
    headers: { Cookie: finalCookies }
  });
  console.log('GET /admin/reports status:', res.status);
  const data = await res.json();
  console.log('GET /admin/reports response:\n', JSON.stringify(data, null, 2));
}

testAdminReports().catch(console.error);
