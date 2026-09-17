const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectSchemaAndStorage() {
  console.log('=== 1. Checking trip_reports table via REST / RPC ===');
  
  // Query information_schema columns
  const { data: cols, error: colErr } = await supabase
    .from('trip_reports')
    .select('*')
    .limit(1);
  console.log('Sample trip_reports query error/success:', { colErr, cols });

  // Query bucket listing
  console.log('\n=== 2. Checking Supabase Storage Buckets ===');
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  console.log('Buckets result:', JSON.stringify(buckets, null, 2));
  if (bucketErr) console.error('Bucket error:', bucketErr);

  // If there's an rpc or direct pg query or we can inspect via postgres connection / postgrest
}

inspectSchemaAndStorage().catch(console.error);
