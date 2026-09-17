const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const PDFDocument = require('pdfkit');

// Build trip report data exactly matching what the application generates
const mockTripReportData = {
  tripId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  orgId: 'org-audit-001',
  orgName: 'NEXUS Logistics Ltd',
  vehicleRegistration: 'MH-04-AX-5555',
  vehicleType: 'Heavy Commercial Vehicle (3-Axle)',
  driverName: 'Rajesh Kumar',
  originLabel: 'Mumbai Central Freight Depot',
  originLat: 18.9696,
  originLng: 72.8193,
  destLabel: 'Pune Chakan Industrial Hub',
  destLat: 18.5204,
  destLng: 73.8567,
  dispatchedAt: '2026-09-09T02:00:00.000Z',
  completedAt: '2026-09-09T05:15:00.000Z',
  predictedDurationMinutes: 195,
  actualDurationMinutes: 195,
  distanceKm: 153.4,
  avgSpeedKmh: 47.2,
  etaConfidenceBasis: 'historical',
  etaConfidenceBandMinutes: 10,
  etaSampleSize: 4,
  driverSafetyScore: 88,
  harshBrakeCount: 1,
  speedingEventCount: 2,
  carbonKg: 232.4,
  cargoTonnes: 14.5,
  tollEstimateInr: 843.7,
  checkpoints: [
    { sequence: 1, label: 'Khalapur Toll Plaza', lat: 18.8322, lng: 73.2842 },
    { sequence: 2, label: 'Lonavala Expressway Toll Plaza', lat: 18.755, lng: 73.409 },
  ],
  alerts: [
    { type: 'congestion', severity: 'medium', message: 'Heavy ghat section slow moving traffic', createdAt: '2026-09-09T03:30:00Z' },
  ],
  geofenceEvents: [
    { geofenceName: 'Mumbai JNPT Freight Hub', eventType: 'exit', occurredAt: '2026-09-09T02:15:00Z' },
    { geofenceName: 'Pune Chakan Industrial Hub', eventType: 'enter', occurredAt: '2026-09-09T05:14:00Z' },
  ],
};

// We will inspect pdf-report.service.ts implementation and build the PDF
async function testPdfGeneration() {
  console.log('--- Testing PDF Generation & Binary Verification ---');
  // Load the compiled service if available or dynamically compile
  const { PdfReportService } = require('../apps/api/dist/reports/pdf-report.service.js');
  const service = new PdfReportService(null, null);
  const pdfBuffer = await service.buildTripPdfBuffer(mockTripReportData);

  const pdfPath = path.join(__dirname, 'generated_audit_report.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`Saved generated PDF to ${pdfPath} (${pdfBuffer.length} bytes)`);

  // 1. File type / signature check
  const magic = pdfBuffer.subarray(0, 5).toString('ascii');
  const header = pdfBuffer.subarray(0, 10).toString('ascii');
  console.log(`PDF Magic bytes: "${magic}"`);
  console.log(`PDF Header: "${header}"`);

  // 2. Extract text from uncompressed metadata & flate streams
  const rawString = pdfBuffer.toString('latin1');
  console.log('\n--- Uncompressed PDF String Excerpts ---');
  console.log('Title match:', rawString.match(/\/Title \(([^)]+)\)/)?.[1]);
  console.log('Author match:', rawString.match(/\/Author \(([^)]+)\)/)?.[1]);

  // Extract all decompressed stream contents
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  let extractedText = '';
  let streamCount = 0;

  while ((streamMatch = streamRegex.exec(rawString)) !== null) {
    streamCount++;
    const compressed = Buffer.from(streamMatch[1], 'latin1');
    try {
      const decompressed = zlib.inflateSync(compressed).toString('latin1');
      // Extract hex encoded strings <...>
      const hexMatches = decompressed.match(/<([0-9a-fA-F]+)>/g) || [];
      for (const h of hexMatches) {
        const hex = h.replace(/[<>]/g, '');
        extractedText += Buffer.from(hex, 'hex').toString('latin1') + ' ';
      }
      // Also extract standard Tj strings (...)
      const textMatches = decompressed.match(/\(([^)]+)\)\s*Tj/g) || [];
      for (const t of textMatches) {
        extractedText += t.replace(/[()]/g, '').replace('Tj', '') + ' ';
      }
    } catch (e) {
      // uncompressed or different filter
    }
  }

  console.log(`\nDecompressed ${streamCount} streams.`);
  console.log('\n=== EXTRACTED PDF TEXT EXCERPT ===\n');
  console.log(extractedText);

  console.log('\n=== CHECKLIST VERIFICATION ===');
  const checks = {
    'Trip ID': extractedText.includes(mockTripReportData.tripId),
    'Vehicle Reg (MH-04-AX-5555)': extractedText.includes(mockTripReportData.vehicleRegistration),
    'Driver Name (Rajesh Kumar)': extractedText.includes(mockTripReportData.driverName),
    'Origin Label': extractedText.includes('Mumbai Central Freight Depot'),
    'Destination Label': extractedText.includes('Pune Chakan Industrial Hub'),
    'Checkpoints with labels': extractedText.includes('Khalapur Toll Plaza') && extractedText.includes('Lonavala Expressway Toll Plaza'),
    'Predicted vs Actual Duration': extractedText.includes('195') || extractedText.includes('Duration'),
    'ETA Confidence Basis': extractedText.includes('historical') || extractedText.includes('Historical') || extractedText.includes('CONFIDENCE'),
    'Driver Safety Score': extractedText.includes('88') || extractedText.includes('SAFETY SCORE'),
    'Harsh Brake & Speeding Counts': (extractedText.includes('1') || extractedText.includes('Harsh')) && extractedText.includes('Speeding'),
    'Carbon Estimate & Factor': extractedText.includes('232.4') || extractedText.includes('CO') || extractedText.includes('GLEC'),
    'Toll Estimate & "approximate" label': extractedText.toLowerCase().includes('approximate') || extractedText.toLowerCase().includes('approx'),
    'Alerts / Geofence events': extractedText.includes('JNPT') || extractedText.includes('Mumbai JNPT Freight Hub'),
  };

  for (const [k, v] of Object.entries(checks)) {
    console.log(`- [${v ? 'X' : ' '}] ${k}: ${v ? 'FOUND' : 'MISSING'}`);
  }
}

testPdfGeneration().catch(console.error);
