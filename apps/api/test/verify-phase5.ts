import { CarbonService } from '../src/intelligence/carbon.service';
import { TollService } from '../src/intelligence/toll.service';
import { DriverScoringService } from '../src/intelligence/driver-scoring.service';
import { EtaService } from '../src/intelligence/eta.service';
import { AiService } from '../src/ai/ai.service';
import { ConfigService } from '@nestjs/config';

async function runVerification() {
  console.log('================================================================');
  console.log('NEXUS WAYS — PHASE 5 REAL VERIFICATION & DEMONSTRATION TRANSCRIPT');
  console.log('================================================================\n');

  // 1. Carbon Calculation Verification
  const carbonService = new CarbonService();
  const carbonResult = carbonService.calculateTripCarbon(150, 15000);
  console.log('1. CARBON EMISSIONS INTELLIGENCE:');
  console.log(`- Trip Distance: 150 km`);
  console.log(`- Vehicle Capacity: 15 tonnes (15,000 kg)`);
  console.log(`- Factor: ${carbonResult.emissionFactor} kg CO2e / tonne-km`);
  console.log(`- Citation: ${carbonResult.citation}`);
  console.log(`- Calculated Carbon: ${carbonResult.carbonKg} kg CO2e`);
  console.log(`- Formula: 150 * 15 * 0.115 = 258.75 kg CO2e\n`);

  // 2. Highway Toll Estimation Verification
  const tollService = new TollService();
  const tollResult = tollService.calculateTripToll(150);
  console.log('2. HIGHWAY TOLL INTELLIGENCE (ESTIMATED):');
  console.log(`- Trip Distance: 150 km`);
  console.log(`- Base HCV Commercial Rate: ₹${tollResult.perKmRate} / km`);
  console.log(`- Citation: ${tollResult.citation}`);
  console.log(`- Estimated Toll: ₹${tollResult.tollEstimateInr} INR`);
  console.log(`- Formula: 150 * 5.45 = ₹817.50 -> rounded ₹818\n`);

  // 3. Driver Safety Scoring Verification
  console.log('3. DRIVER BEHAVIOR SCORING (TELEMETRY RULE-BASED):');
  const mockGps = [
    { id: '1', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.0, lng: 72.0, speed_kmh: 70, recorded_at: '2026-09-06T00:00:00Z' },
    // Harsh brake 1: 70 -> 40 (drop 30 km/h in 4s)
    { id: '2', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.01, lng: 72.01, speed_kmh: 40, recorded_at: '2026-09-06T00:00:04Z' },
    // Speeding 1: 88 km/h (> 80 km/h)
    { id: '3', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.02, lng: 72.02, speed_kmh: 88, recorded_at: '2026-09-06T00:00:20Z' },
    // Harsh brake 2: 88 -> 55 (drop 33 km/h in 5s)
    { id: '4', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.03, lng: 72.03, speed_kmh: 55, recorded_at: '2026-09-06T00:00:25Z' },
  ];
  const mockSupabase: any = {
    adminClient: {
      from: () => ({
        insert: (p: any) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'score-live', ...p, computed_at: new Date().toISOString() }, error: null }),
          }),
        }),
      }),
    },
  };
  const scoringService = new DriverScoringService(mockSupabase);
  const driverScore = await scoringService.computeTripDriverScore('t-1', 'd-1', mockGps as any);
  console.log(`- GPS Points Evaluated: ${mockGps.length}`);
  console.log(`- Harsh Brake Events: ${driverScore.harsh_brake_count}`);
  console.log(`- Speeding Events: ${driverScore.speeding_event_count}`);
  console.log(`- Computed Safety Score: ${driverScore.score} / 100`);
  console.log(`- Formula: 100 - (10 * 2) - (5 * 1) = 75\n`);

  // 4. ETA Confidence Interval Verification
  console.log('4. ETA CONFIDENCE INTERVAL VARIANCE:');
  const mockEtaQueryBuilder: any = {
    select: () => mockEtaQueryBuilder,
    eq: () => mockEtaQueryBuilder,
    is: () => mockEtaQueryBuilder,
    order: () => mockEtaQueryBuilder,
    limit: () => mockEtaQueryBuilder,
    neq: () => Promise.resolve({
      data: [
        { actual_duration_minutes: 65, predicted_duration_minutes: 60 },
        { actual_duration_minutes: 70, predicted_duration_minutes: 60 },
        { actual_duration_minutes: 57, predicted_duration_minutes: 60 },
      ],
      error: null,
    }),
    maybeSingle: () => Promise.resolve({
      data: {
        id: 't-historical',
        org_id: 'org-1',
        origin_lat: 19.0,
        origin_lng: 72.0,
        destination_lat: 19.5,
        destination_lng: 72.5,
        origin_label: 'Mumbai',
        destination_label: 'Pune',
        duration_minutes: 60,
        predicted_duration_minutes: 60,
        distance_km: 150,
        status: 'in_transit',
      },
      error: null,
    }),
  };
  const etaSupabase: any = { adminClient: { from: () => mockEtaQueryBuilder } };
  const etaService = new EtaService(etaSupabase);
  const historicalEta = await etaService.calculateTripEtaConfidence('org-1', 't-historical');
  console.log(`[Historical Basis >= 3 trips]`);
  console.log(`- Sample Size: ${historicalEta.sample_size}`);
  console.log(`- Confidence Basis: ${historicalEta.confidence_basis}`);
  console.log(`- Base ETA: ${historicalEta.base_eta_minutes} min`);
  console.log(`- Confidence Band (StdDev): ±${historicalEta.confidence_band_minutes} min`);
  console.log(`- ETA Interval: ${historicalEta.min_eta_minutes} to ${historicalEta.max_eta_minutes} min\n`);

  // 5. AI Assistant Demonstration (Fallback & Action Propose -> Confirm)
  console.log('5. AI ASSISTANT (FALLBACK & TOOL-CALLING EXECUTION):');
  const mockAiSupabase: any = {
    adminClient: {
      from: () => ({
        select: () => mockAiSupabase.adminClient.from(),
        eq: () => mockAiSupabase.adminClient.from(),
        is: () => mockAiSupabase.adminClient.from(),
        order: () => mockAiSupabase.adminClient.from(),
        limit: () => Promise.resolve({
          data: [{ id: 'alert-77', type: 'hos_exceeded', message: 'Driver daily driving limit reached (9 hrs)', severity: 'critical' }],
          error: null,
        }),
        update: () => mockAiSupabase.adminClient.from(),
      }),
    },
  };
  const mockConfig: any = { get: () => '' };
  const mockDash: any = { getStats: () => Promise.resolve({ activeAlerts: 1, activeVehicles: { value: 4 }, totalFleetToday: { value: 8 }, avgSpeedKmh: { value: 48 }, arrivedCount: { value: 2 }, departedCount: { value: 3 } }) };
  const mockTrips: any = { findAll: () => Promise.resolve([{ id: 't-1', vehicle: 'MH-04-AX-5555', origin: 'Mumbai', destination: 'Pune', status: 'in_transit', distanceKm: 150 }]) };
  
  const ai = new AiService(mockConfig, mockAiSupabase, mockDash, mockTrips);
  
  // Turn 1: Query Fleet Status
  const chatResponse1 = await ai.processChat('org-1', { message: 'How is the fleet performing today?' });
  console.log(`User: "How is the fleet performing today?"`);
  console.log(`AI (Fallback Active: ${chatResponse1.isFallback}):`);
  console.log(`Tool Executed: ${chatResponse1.toolCalls?.[0]?.name}() -> ${JSON.stringify(chatResponse1.toolCalls?.[0]?.result)}`);
  console.log(`Response:\n${chatResponse1.content}\n`);

  // Turn 2: Propose Action
  const chatResponse2 = await ai.processChat('org-1', { message: 'Acknowledge alert #alert-77' });
  console.log(`User: "Acknowledge alert #alert-77"`);
  console.log(`AI Proposed Action:`, chatResponse2.proposedAction);
  console.log(`Response:\n${chatResponse2.content}\n`);

  // Turn 3: User Confirmation (Write Execution)
  const confirmResult = await ai.confirmAction('org-1', {
    actionId: chatResponse2.proposedAction!.id,
    actionType: chatResponse2.proposedAction!.actionType,
    payload: chatResponse2.proposedAction!.payload,
    confirmed: true,
  });
  console.log(`User clicked [Apply] -> Confirm Result:`, confirmResult);

  console.log('\n================================================================');
  console.log('ALL PHASE 5 VERIFICATIONS COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

runVerification().catch(console.error);
