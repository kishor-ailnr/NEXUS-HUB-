const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { PdfReportService } = require('../apps/api/dist/reports/pdf-report.service.js');

async function testDirectService() {
  const service = new PdfReportService({ adminClient: supabase }, null);
  const orgId = 'e4b535b6-7dbe-4233-b745-f5cea544a4f4';
  const reports = await service.getAdminReports(orgId);
  console.log('Direct service getAdminReports result:\n', JSON.stringify(reports, null, 2));
}

testDirectService().catch(console.error);
