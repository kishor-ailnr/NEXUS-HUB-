const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  const tables = ['organizations', 'users', 'vehicles', 'drivers', 'trips', 'locations', 'telemetry', 'alerts', 'geofences', 'trip_reports'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`Table '${t}':`, error ? `ERROR: ${error.message} (${error.code})` : `FOUND (${data.length} rows sample)`);
  }

  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('\nBuckets:', buckets, 'Error:', bErr);
}

checkTables().catch(console.error);
