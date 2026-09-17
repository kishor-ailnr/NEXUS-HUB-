const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSqlExecution() {
  console.log('Testing SQL endpoints on Supabase...');
  
  // 1. Test POST /rest/v1/rpc/
  const res1 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  console.log('REST base endpoint:', res1.status);

  // 2. Test Supabase pg query or sql endpoint
  const sqlEndpoints = [
    `${process.env.SUPABASE_URL}/pg/query`,
    `${process.env.SUPABASE_URL}/sql`,
    `${process.env.SUPABASE_URL}/v1/query`,
    `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    `${process.env.SUPABASE_URL}/rest/v1/rpc/exec`,
  ];

  for (const ep of sqlEndpoints) {
    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'SELECT 1;' })
      });
      console.log(`Endpoint ${ep} -> Status: ${r.status} ${r.statusText}`);
      const txt = await r.text();
      console.log(`Response: ${txt.substring(0, 200)}`);
    } catch (e) {
      console.log(`Endpoint ${ep} error: ${e.message}`);
    }
  }
}

testSqlExecution().catch(console.error);
