const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const orgId = 'e4b535b6-7dbe-4233-b745-f5cea544a4f4';

async function debugQuery() {
  console.log('1. All trip_reports:');
  const r1 = await supabase.from('trip_reports').select('*');
  console.log(r1);

  console.log('2. trip_reports with eq org_id:');
  const r2 = await supabase.from('trip_reports').select('*').eq('org_id', orgId);
  console.log(r2);

  console.log('3. trip_reports with join select:');
  const r3 = await supabase.from('trip_reports').select(`
    id,
    trip_id,
    storage_path,
    file_size_bytes,
    generated_at,
    trips (
      id,
      origin_label,
      destination_label,
      completed_at,
      vehicles (registration_number),
      drivers (full_name)
    )
  `).eq('org_id', orgId);
  console.log('Join select result:', JSON.stringify(r3, null, 2));
}

debugQuery().catch(console.error);
