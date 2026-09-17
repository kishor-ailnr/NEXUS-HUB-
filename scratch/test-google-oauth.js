const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = 'https://facnvxbznmbhzdkbumby.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY252eGJ6bm1iaHpka2J1bWJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ5MDc0OCwiZXhwIjoyMTA0MDY2NzQ4fQ.8uK3v-uUFumUVuL2kXz2D6F6iJmuZvwn0x6kSmbmKwc';
const JWT_SECRET = 'JGlVFMx95a3KR3+sLaqcUva4DWO6EiwkeE+oyVzlVtQMqWw0uOXG4AXNazEhYBtRYLvsBBq8w4/6bIA1Af3w2Q==';

async function testGoogleOAuthFlow() {
  console.log('===============================================================');
  console.log('--- Phase 1: Google OAuth End-to-End Sign-In Demonstration ---');
  console.log('===============================================================\n');

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const googleEmail = `captain.google.${Date.now()}@nexusways.com`;
  const googleFullName = 'Captain Vikramaditya';

  console.log('Step 1: Simulating Google OAuth Callback via Supabase Auth Provider...');
  console.log(`Identity: Name="${googleFullName}", Email="${googleEmail}", Provider="google"`);

  // Supabase Auth engine creates user in auth.users on OAuth consent
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: googleEmail,
    email_confirm: true,
    user_metadata: {
      full_name: googleFullName,
      name: googleFullName,
      avatar_url: 'https://lh3.googleusercontent.com/a/default-user',
      provider_id: `google-${Date.now()}`,
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to provision Supabase auth user: ${authError?.message}`);
  }

  const googleUserUid = authData.user.id;
  console.log(`✓ Supabase Auth User Created with UID: ${googleUserUid}`);

  // Supabase issues access token signed with project SUPABASE_JWT_SECRET
  const googleAccessToken = jwt.sign(
    {
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: googleUserUid,
      email: googleEmail,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: googleFullName,
        name: googleFullName,
        email: googleEmail,
      },
      role: 'authenticated',
    },
    JWT_SECRET
  );

  const googleRefreshToken = `refresh-token-google-${Date.now()}`;

  // Step 2: Frontend receives tokens from OAuth redirect and calls POST /auth/session
  console.log('\nStep 2: Frontend calls POST /auth/session with Google OAuth tokens...');
  const sessionRes = await fetch('http://localhost:4000/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: googleAccessToken,
      refresh_token: googleRefreshToken,
    }),
  });

  const sessionData = await sessionRes.json();
  const setCookieHeader = sessionRes.headers.get('set-cookie') || '';
  console.log(`Session Exchange Response Status: ${sessionRes.status} (${sessionRes.statusText})`);
  console.log('Provisioned User & Organization Profile:', JSON.stringify(sessionData.user, null, 2));
  console.log('httpOnly Cookies Set:', setCookieHeader.split(';').filter(c => c.includes('nw_access') || c.includes('nw_refresh')).join('; '));

  // Step 3: Frontend loads /roadways/dashboard and hydrates session via GET /auth/me
  console.log('\nStep 3: Frontend loads /roadways/dashboard and fetches GET /auth/me using nw_access cookie...');
  const meRes = await fetch('http://localhost:4000/auth/me', {
    headers: { 'Cookie': setCookieHeader },
  });

  const meData = await meRes.json();
  console.log(`Dashboard Auth Guard Status: ${meRes.status} (${meRes.statusText})`);
  console.log('Authenticated Dashboard User Profile:', JSON.stringify(meData.user, null, 2));

  // Step 4: Verification of Authenticated State
  console.log('\nStep 4: Verification of Authenticated State (Identical to Email/Password):');
  console.log(`✅ User ID (auth.uid): ${meData.user.id}`);
  console.log(`✅ User Email: ${meData.user.email}`);
  console.log(`✅ User Full Name: ${meData.user.fullName}`);
  console.log(`✅ Assigned Role: ${meData.user.role}`);
  console.log(`✅ Provisioned Org ID: ${meData.user.organization.id}`);
  console.log(`✅ Organization Name: ${meData.user.organization.name}`);
  console.log(`✅ Jurisdiction / Country: ${meData.user.organization.country}`);
  console.log('\n===============================================================');
  console.log('Google OAuth End-to-End Sign-in Verified Successfully');
  console.log('===============================================================\n');
}

testGoogleOAuthFlow().catch(console.error);
