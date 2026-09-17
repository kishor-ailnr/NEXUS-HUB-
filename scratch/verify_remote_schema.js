const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyAll() {
  console.log('=== VERIFYING REMOTE TABLES ===');
  const tables = [
    'organizations',
    'users',
    'notifications',
    'alerts',
    'drivers',
    'vehicles',
    'saved_routes',
    'trips',
    'trip_checkpoints',
    'gps_points',
    'geofences',
    'geofence_events',
    'convoy_groups',
    'convoy_members',
    'hos_logs',
    'driver_behavior_scores',
    'trip_reports'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`FAIL: ${t} -> ${error.message}`);
    } else {
      console.log(`PASS: ${t} exists (rows: ${data.length})`);
    }
  }

  console.log('\n=== VERIFYING STORAGE BUCKETS ===');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', JSON.stringify(buckets, null, 2));
}

verifyAll().catch(console.error);
