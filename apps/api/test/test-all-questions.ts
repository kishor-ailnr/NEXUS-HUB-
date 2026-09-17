import { AiService } from '../src/ai/ai.service';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testAllQuestions() {
  const configService = new ConfigService({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: 'gemini-3.6-flash',
  });

  const mockSupabase: any = {
    adminClient: {
      from: () => ({
        select: () => mockSupabase.adminClient.from(),
        eq: () => mockSupabase.adminClient.from(),
        is: () => mockSupabase.adminClient.from(),
        order: () => mockSupabase.adminClient.from(),
        limit: () => Promise.resolve({
          data: [{ id: 'alert-101', type: 'geofence_breach', message: 'Vehicle departed Mumbai Port unexpectedly', severity: 'high' }],
          error: null,
        }),
      }),
    },
  };

  const mockDashboard: any = {
    getStats: () => Promise.resolve({
      activeAlerts: 1,
      activeVehicles: { value: 6, label: 'Active Vehicles' },
      totalFleetToday: { value: 12, label: 'Total Fleet' },
      avgSpeedKmh: { value: 52, label: 'Avg Speed' },
      arrivedCount: { value: 4, label: 'Arrived' },
      departedCount: { value: 5, label: 'Departed' },
    }),
  };

  const mockTrips: any = {
    findAll: () => Promise.resolve([
      { id: 'trip-1', vehicle: 'MH-04-AX-5555', origin: 'Mumbai Port', destination: 'Pune Hub', status: 'in_transit', distanceKm: 150 },
    ]),
    findOne: () => Promise.resolve({ id: 'trip-1', origin_label: 'Mumbai Port', destination_label: 'Pune Hub', status: 'in_transit' }),
    getEta: () => Promise.resolve({ base_eta_minutes: 120, min_eta_minutes: 105, max_eta_minutes: 135, confidence_basis: 'historical', sample_size: 5 }),
  };

  const aiService = new AiService(configService, mockSupabase, mockDashboard, mockTrips);

  console.log('================================================================');
  console.log('TESTING AI ASSISTANT WITH 6 CORE USER QUESTIONS (LIVE GEMINI)');
  console.log('================================================================\n');

  // Test 1: General
  console.log('--- TEST 1: General Question ---');
  const q1 = 'What is NEXUS WAYS?';
  console.log(`User: "${q1}"`);
  const r1 = await aiService.processChat('org-test', { message: q1 });
  console.log(`Fallback Mode Active: ${r1.isFallback}`);
  console.log(`Tools Called: ${r1.toolCalls ? r1.toolCalls.map(t => t.name).join(', ') : 'None (Correct!)'}`);
  console.log(`Response:\n${r1.content}\n`);

  // Test 2: General Capability
  console.log('--- TEST 2: General Capability Question ---');
  const q2 = 'What are the operational workflows you can manage?';
  console.log(`User: "${q2}"`);
  const r2 = await aiService.processChat('org-test', { message: q2 });
  console.log(`Fallback Mode Active: ${r2.isFallback}`);
  console.log(`Tools Called: ${r2.toolCalls ? r2.toolCalls.map(t => t.name).join(', ') : 'None (Correct!)'}`);
  console.log(`Response:\n${r2.content}\n`);

  // Test 3: Dashboard Status (Should call get_dashboard_stats)
  console.log('--- TEST 3: Operational Fleet Status ---');
  const q3 = 'What is the current fleet status?';
  console.log(`User: "${q3}"`);
  const r3 = await aiService.processChat('org-test', { message: q3 });
  console.log(`Fallback Mode Active: ${r3.isFallback}`);
  console.log(`Tools Called: ${r3.toolCalls ? r3.toolCalls.map(t => t.name).join(', ') : 'None'}`);
  console.log(`Response:\n${r3.content}\n`);

  // Test 4: Conceptual (Digital Twin)
  console.log('--- TEST 4: Conceptual (Digital Twin) ---');
  const q4 = 'How does the digital twin work?';
  console.log(`User: "${q4}"`);
  const r4 = await aiService.processChat('org-test', { message: q4 });
  console.log(`Fallback Mode Active: ${r4.isFallback}`);
  console.log(`Tools Called: ${r4.toolCalls ? r4.toolCalls.map(t => t.name).join(', ') : 'None (Correct!)'}`);
  console.log(`Response:\n${r4.content}\n`);

  // Test 5: Prediction
  console.log('--- TEST 5: Predictive & Disruptions ---');
  const q5 = 'Which logistics disruptions should I monitor?';
  console.log(`User: "${q5}"`);
  const r5 = await aiService.processChat('org-test', { message: q5 });
  console.log(`Fallback Mode Active: ${r5.isFallback}`);
  console.log(`Tools Called: ${r5.toolCalls ? r5.toolCalls.map(t => t.name).join(', ') : 'None (Correct!)'}`);
  console.log(`Response:\n${r5.content}\n`);

  // Test 6: Follow-up
  console.log('--- TEST 6: Contextual Follow-up ---');
  const q6 = 'What about weather?';
  console.log(`User: "${q6}"`);
  const r6 = await aiService.processChat('org-test', {
    message: q6,
    conversationHistory: [
      { role: 'user', content: q5 },
      { role: 'assistant', content: r5.content },
    ],
  });
  console.log(`Fallback Mode Active: ${r6.isFallback}`);
  console.log(`Tools Called: ${r6.toolCalls ? r6.toolCalls.map(t => t.name).join(', ') : 'None (Correct!)'}`);
  console.log(`Response:\n${r6.content}\n`);

  console.log('================================================================');
  console.log('ALL 6 TESTS COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

testAllQuestions().catch(console.error);
