import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { SupabaseService } from '../supabase/supabase.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { TripsService } from '../trips/trips.service';
import { TrainMovementsService } from '../railways/movements/train-movements.service';
import { FlightMovementsService } from '../airways/movements/flight-movements.service';
import { VoyageMovementsService } from '../seaways/movements/voyage-movements.service';
import {
  AiChatMessage,
  AiChatRequest,
  AiConfirmActionRequest,
  AiToolCall,
  AiProposedAction,
} from '@nexus-ways/shared';

const NEXUS_SYSTEM_INSTRUCTION = `You are the NEXUS WAYS Multimodal Logistics Operations Assistant.

NEXUS WAYS is an enterprise Multimodal Logistics Intelligence Platform covering:
1. Roadways (live fleet simulation, OSRM routing, geofences, HOS/duty tracking, convoys, telemetry)
2. Railways (freight rakes, yard tracking, block section operations, Overpass rail routing, slot intelligence, digital twin ghost tracking, crew scoring, GLEC rail carbon)
3. Airways (air cargo manifests, flight movements, Great-Circle direct spherical routing, airport runway/apron slot intelligence, DGCA FDTL compliance, pilot safety scoring, GLEC air carbon)
4. Seaways (ocean vessels, container tracking, port calls, berth allocations, searoute open-water routing, STCW Regulation VIII/1 watchkeeping compliance, master safety scoring, GLEC DWT-bucketed maritime carbon)

Key Platform Capabilities & Architecture:
- Digital Twin: Real-time ghost projection simulating scheduled vehicle/train/flight/vessel progress vs actual telemetry position, calculating schedule deviation in minutes.
- Predictive ETA: Dynamic arrival time confidence intervals derived from historical standard deviation (≥3 trips/movements) or calibrated heuristics (±15%).
- Safety & Crew Behavior: Deterministic rule-based scoring based on recorded telemetry (Road: harsh brakes >20 km/h, speeding >80 km/h; Rail: harsh deceleration >15 km/h, overspeeding >100 km/h MPS; Air: abrupt vertical rate >±3000 fpm / delta speed >50 kts, overspeeding >250 kts below 10,000 ft MSL; Sea: harsh rudder rate-of-turn ROT >20°/min per IMO Res A.526(13), overspeeding >12 kts harbor / >24 kts open water per COLREGs Rule 6).
- Green Logistics & Carbon: Carbon footprint calculation based on GLEC Framework v3.2 & IMO (Sea Panamax: 0.0084 kg CO2e/t-km; Rail: 0.0106 kg CO2e/t-km; Road: 0.101 kg CO2e/t-km; Air: 0.608–1.516 kg CO2e/t-km) and Slot Intelligence congestion checks.
- Operational Compliance: Geofencing boundary monitoring, port limits/anchorage logs, MTWA HOS rules, DGCA India CAR Sec 7 Series J FDTL limits, and IMO STCW Code Section A-VIII/1 watchkeeping rest-hour limits (min 10h rest / max 14h duty in 24h).

Behavioral Rules:
1. Answer general questions, capability questions, and architecture inquiries directly with concise, structured, professional explanations. DO NOT call operational tools for general questions.
2. Only execute operational tools when the user explicitly asks for live data (e.g. "What is the fleet status?", "Show unacknowledged alerts", "List active trips", "List active train movements", "List active flight movements", "List active voyage movements", "Check slot congestion").
3. Automatically choose the right tool set based on context (Road trips vs Rail movements vs Air flight movements vs Sea voyage movements).
4. When asked to acknowledge or clear an alert, propose the action using propose_acknowledge_alert so the human operator can confirm it.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAiClient: GoogleGenAI | null = null;
  private readonly modelName: string;
  private pendingActions = new Map<string, AiProposedAction>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly dashboardService: DashboardService,
    private readonly tripsService: TripsService,
    private readonly trainMovementsService: TrainMovementsService,
    private readonly flightMovementsService: FlightMovementsService,
    private readonly voyageMovementsService: VoyageMovementsService,
  ) {
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.6-flash';
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey && apiKey.trim() && apiKey !== 'mock-gemini-key') {
      try {
        this.genAiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.logger.log(`Gemini Assistant initialized with model ${this.modelName}`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize GoogleGenAI: ${err.message}`);
      }
    } else {
      this.logger.log('No GEMINI_API_KEY configured. Context-aware fallback active.');
    }
  }

  /**
   * Execute read-only tool functions against real operational data
   */
  private async executeTool(orgId: string, name: string, args: any): Promise<any> {
    this.logger.log(`Executing AI Tool: ${name} with args: ${JSON.stringify(args)}`);

    switch (name) {
      case 'get_dashboard_stats': {
        const stats = await this.dashboardService.getStats(orgId);
        return {
          activeAlerts: stats.activeAlerts,
          activeVehicles: stats.activeVehicles.value,
          totalFleet: stats.totalFleetToday.value,
          avgSpeedKmh: stats.avgSpeedKmh.value,
          arrivedCount: stats.arrivedCount.value,
          departedCount: stats.departedCount.value,
        };
      }

      case 'list_active_trips': {
        const trips = await this.tripsService.findAll(orgId);
        const active = trips.filter((t) => t.status === 'in_transit' || t.status === 'planned');
        return active.map((t) => ({
          tripId: t.id,
          origin: t.origin_label,
          destination: t.destination_label,
          vehicle: t.vehicle?.registration_number,
          driver: t.driver?.user?.full_name || t.driver?.license_number,
          status: t.status,
          distanceKm: t.distance_km,
          predictedDurationMin: t.predicted_duration_minutes,
        }));
      }

      case 'get_trip_details': {
        if (!args.trip_id) return { error: 'trip_id is required' };
        try {
          const trip = await this.tripsService.findOne(orgId, args.trip_id);
          const eta = await this.tripsService.getEta(orgId, args.trip_id).catch(() => null);
          return {
            tripId: trip.id,
            origin: trip.origin_label,
            destination: trip.destination_label,
            status: trip.status,
            vehicle: trip.vehicle?.registration_number,
            driver: trip.driver?.user?.full_name,
            driverScore: trip.driver_score?.score,
            carbonKg: trip.carbon_kg,
            tollEstimateInr: trip.toll_estimate_inr,
            etaConfidence: eta
              ? {
                  baseEtaMinutes: eta.base_eta_minutes,
                  minEta: eta.min_eta_minutes,
                  maxEta: eta.max_eta_minutes,
                  confidenceBasis: eta.confidence_basis,
                  sampleSize: eta.sample_size,
                }
              : null,
          };
        } catch (e: any) {
          return { error: `Trip ${args.trip_id} not found` };
        }
      }

      case 'list_active_train_movements': {
        const movements = await this.trainMovementsService.findAll(orgId);
        const active = movements.filter((m) => m.status === 'in_transit' || m.status === 'planned');
        return active.map((m) => ({
          movementId: m.id,
          trainNumber: m.train?.train_number,
          trainName: m.train?.train_name,
          originStation: m.origin_station?.name,
          destinationStation: m.destination_station?.name,
          locoPilot: m.loco_pilot?.user?.full_name || m.loco_pilot?.license_number,
          locoFuelType: m.train?.locomotive?.fuel_type,
          status: m.status,
          distanceKm: m.distance_km,
          durationMinutes: m.duration_minutes,
        }));
      }

      case 'get_train_movement_details': {
        if (!args.movement_id) return { error: 'movement_id is required' };
        try {
          const movement = await this.trainMovementsService.findOne(orgId, args.movement_id);
          const eta = await this.trainMovementsService.getEtaConfidence(orgId, args.movement_id).catch(() => null);
          return {
            movementId: movement.id,
            trainNumber: movement.train?.train_number,
            trainName: movement.train?.train_name,
            locomotive: movement.train?.locomotive?.loco_number,
            fuelType: movement.train?.locomotive?.fuel_type,
            originStation: movement.origin_station?.name,
            destinationStation: movement.destination_station?.name,
            status: movement.status,
            locoPilot: movement.loco_pilot?.user?.full_name,
            crewScore: movement.crew_score?.score,
            carbonKg: movement.carbon_kg,
            stopsCount: movement.stops?.length || 0,
            etaConfidence: eta
              ? {
                  baseEtaMinutes: eta.base_eta_minutes,
                  minEta: eta.min_eta_minutes,
                  maxEta: eta.max_eta_minutes,
                  confidenceBasis: eta.confidence_basis,
                  sampleSize: eta.sample_size,
                }
              : null,
          };
        } catch (e: any) {
          return { error: `Train movement ${args.movement_id} not found` };
        }
      }

      case 'list_active_flight_movements': {
        const movements = await this.flightMovementsService.findAll(orgId);
        const active = movements.filter((m) => m.status === 'in_transit' || m.status === 'planned');
        return active.map((m) => ({
          movementId: m.id,
          flightNumber: m.flight?.flight_number,
          aircraft: `${m.aircraft?.tail_number} (${m.aircraft?.aircraft_type})`,
          originAirport: `${m.flight?.origin_airport?.name || 'Origin'} (${m.flight?.origin_airport?.iata_code || ''})`,
          destinationAirport: `${m.flight?.destination_airport?.name || 'Dest'} (${m.flight?.destination_airport?.iata_code || ''})`,
          pilot: m.pilot?.user?.full_name || m.pilot?.license_number,
          status: m.status,
          distanceKm: m.distance_km,
          durationMinutes: m.duration_minutes,
        }));
      }

      case 'get_flight_movement_details': {
        const movementId = args.movement_id || args.flight_movement_id;
        if (!movementId) return { error: 'movement_id is required' };
        try {
          const movement = await this.flightMovementsService.findOne(orgId, movementId);
          const eta = await this.flightMovementsService.getEtaConfidence(orgId, movementId).catch(() => null);
          return {
            movementId: movement.id,
            flightNumber: movement.flight?.flight_number,
            aircraft: movement.aircraft?.tail_number,
            aircraftType: movement.aircraft?.aircraft_type,
            originAirport: movement.flight?.origin_airport?.name,
            originIata: movement.flight?.origin_airport?.iata_code,
            destAirport: movement.flight?.destination_airport?.name,
            destIata: movement.flight?.destination_airport?.iata_code,
            status: movement.status,
            pilot: movement.pilot?.user?.full_name,
            carbonKg: movement.carbon_kg,
            predictedDurationMinutes: movement.predicted_duration_minutes,
            actualDurationMinutes: movement.actual_duration_minutes,
            distanceKm: movement.distance_km,
            etaConfidence: eta
              ? {
                  baseEtaMinutes: eta.base_eta_minutes,
                  minEta: eta.min_eta_minutes,
                  maxEta: eta.max_eta_minutes,
                  confidenceBasis: eta.confidence_basis,
                  sampleSize: eta.sample_size,
                }
              : null,
          };
        } catch (e: any) {
          return { error: `Flight movement ${movementId} not found` };
        }
      }

      case 'list_active_voyage_movements': {
        const movements = await this.voyageMovementsService.findAll(orgId);
        const active = movements.filter((m) => m.status === 'in_transit' || m.status === 'planned');
        return active.map((m: any) => {
          const vName = m.vessel?.vessel_name || m.vessel?.name || 'Vessel';
          const vType = m.vessel?.vessel_type || 'Panamax';
          const oCode = m.voyage?.origin_port?.unlocode || m.voyage?.origin_port?.code || '';
          const dCode = m.voyage?.destination_port?.unlocode || m.voyage?.destination_port?.code || '';
          const masterName = m.crew?.user?.full_name || m.master?.user?.full_name || m.crew?.master_license || m.master?.certificate_number || 'Master';
          return {
            movementId: m.id,
            voyageNumber: m.voyage?.voyage_number,
            vessel: `${vName} (${vType})`,
            imoNumber: m.vessel?.imo_number,
            dwtTonnes: m.vessel?.dwt_tonnes,
            originPort: `${m.voyage?.origin_port?.name || 'Origin'}${oCode ? ` (${oCode})` : ''}`,
            destinationPort: `${m.voyage?.destination_port?.name || 'Dest'}${dCode ? ` (${dCode})` : ''}`,
            master: masterName,
            status: m.status,
            distanceKm: m.distance_km,
            durationMinutes: m.duration_minutes,
          };
        });
      }

      case 'get_voyage_movement_details': {
        const movementId = args.movement_id || args.voyage_movement_id;
        if (!movementId) return { error: 'movement_id is required' };
        try {
          const movement = await this.voyageMovementsService.findOne(orgId, movementId);
          const eta = await this.voyageMovementsService.getEtaConfidence(orgId, movementId).catch(() => null);
          return {
            movementId: movement.id,
            voyageNumber: movement.voyage?.voyage_number,
            vessel: movement.vessel?.vessel_name,
            vesselType: movement.vessel?.vessel_type,
            imoNumber: movement.vessel?.imo_number,
            dwtTonnes: movement.vessel?.dwt_tonnes,
            originPort: movement.voyage?.origin_port?.name,
            originUnlocode: movement.voyage?.origin_port?.unlocode,
            destPort: movement.voyage?.destination_port?.name,
            destUnlocode: movement.voyage?.destination_port?.unlocode,
            status: movement.status,
            master: movement.master?.user?.full_name,
            crewScore: movement.crew_score?.score,
            carbonKg: movement.carbon_kg,
            predictedDurationMinutes: movement.predicted_duration_minutes,
            actualDurationMinutes: movement.actual_duration_minutes,
            distanceKm: movement.distance_km,
            etaConfidence: eta
              ? {
                  baseEtaMinutes: eta.base_eta_minutes,
                  minEta: eta.min_eta_minutes,
                  maxEta: eta.max_eta_minutes,
                  confidenceBasis: eta.confidence_basis,
                  sampleSize: eta.sample_size,
                }
              : null,
          };
        } catch (e: any) {
          return { error: `Voyage movement ${movementId} not found` };
        }
      }

      case 'check_rail_slot': {
        if (!args.origin_station_id || !args.destination_station_id) {
          return { error: 'origin_station_id and destination_station_id are required' };
        }
        return this.trainMovementsService.checkSlot(
          orgId,
          args.origin_station_id,
          args.destination_station_id,
          args.proposed_departure,
        );
      }

      case 'check_port_slot': {
        if (!args.origin_port_id || !args.destination_port_id) {
          return { error: 'origin_port_id and destination_port_id are required' };
        }
        return this.voyageMovementsService.checkSlots(
          orgId,
          args.origin_port_id,
          args.destination_port_id,
          args.proposed_departure,
        );
      }

      case 'list_unacknowledged_alerts': {
        const { data: alerts } = await this.supabase.adminClient
          .from('alerts')
          .select('*')
          .eq('org_id', orgId)
          .is('acknowledged_at', null)
          .order('created_at', { ascending: false })
          .limit(10);

        return (alerts || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          message: a.message,
          createdAt: a.created_at,
        }));
      }

      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  /**
   * Main chat turn handler with Gemini tool-calling and context-aware fallback.
   */
  async processChat(orgId: string, req: AiChatRequest): Promise<AiChatMessage> {
    const userMessage = req.message.trim();
    const toolCallsExecuted: AiToolCall[] = [];
    let proposedAction: AiProposedAction | null = null;

    if (this.genAiClient) {
      try {
        const tools: FunctionDeclaration[] = [
          {
            name: 'get_dashboard_stats',
            description: 'Get live operational fleet stats for active vehicles, alerts count, speed, and trip departures.',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'list_active_trips',
            description: 'List all currently in-transit or planned Roadways fleet shipments and manifests.',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'get_trip_details',
            description: 'Get full operational intelligence for a specific Roadways trip ID including ETA confidence, carbon, and driver safety score.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                trip_id: { type: Type.STRING, description: 'The unique trip UUID' },
              },
              required: ['trip_id'],
            },
          },
          {
            name: 'list_active_train_movements',
            description: 'List all currently in-transit or planned Railways freight train movements, rakes, and locomotives.',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'get_train_movement_details',
            description: 'Get full operational intelligence for a specific Railways train movement ID including ETA confidence, crew score, and rail carbon footprint.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                movement_id: { type: Type.STRING, description: 'The unique train movement UUID' },
              },
              required: ['movement_id'],
            },
          },
          {
            name: 'list_active_flight_movements',
            description: 'List all currently in-transit or planned Airways flight movements, aircraft, and pilots.',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'get_flight_movement_details',
            description: 'Get full operational intelligence for a specific Airways flight movement ID including Great-Circle distance, ETA confidence, carbon, and pilot safety.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                movement_id: { type: Type.STRING, description: 'The unique flight movement UUID' },
              },
              required: ['movement_id'],
            },
          },
          {
            name: 'list_active_voyage_movements',
            description: 'List all currently in-transit or planned Seaways voyage movements, vessels, and ship masters.',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'get_voyage_movement_details',
            description: 'Get full operational intelligence for a specific Seaways voyage movement ID including land-avoiding sea distance, ETA confidence, DWT-bucketed carbon, and master safety score.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                movement_id: { type: Type.STRING, description: 'The unique voyage movement UUID' },
              },
              required: ['movement_id'],
            },
          },
          {
            name: 'check_rail_slot',
            description: 'Check rail slot congestion on a specific station corridor for proposed departure times.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                origin_station_id: { type: Type.STRING, description: 'Origin station UUID' },
                destination_station_id: { type: Type.STRING, description: 'Destination station UUID' },
                proposed_departure: { type: Type.STRING, description: 'Proposed departure ISO timestamp' },
              },
              required: ['origin_station_id', 'destination_station_id'],
            },
          },
          {
            name: 'check_port_slot',
            description: 'Check port berth and channel slot congestion for proposed voyage departure times.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                origin_port_id: { type: Type.STRING, description: 'Origin port UUID' },
                destination_port_id: { type: Type.STRING, description: 'Destination port UUID' },
                proposed_departure: { type: Type.STRING, description: 'Proposed departure ISO timestamp' },
              },
              required: ['origin_port_id', 'destination_port_id'],
            },
          },
          {
            name: 'list_unacknowledged_alerts',
            description: 'List all active unacknowledged operational alerts across Roadways, Railways, Airways, and Seaways.',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'propose_acknowledge_alert',
            description: 'Propose acknowledging an alert (requires explicit human confirmation before executing).',
            parameters: {
              type: Type.OBJECT,
              properties: {
                alert_id: { type: Type.STRING, description: 'The alert UUID to acknowledge' },
                reason: { type: Type.STRING, description: 'Reason for acknowledging the alert' },
              },
              required: ['alert_id'],
            },
          },
        ];

        // Format history
        const contents: any[] = (req.conversationHistory || []).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        }));
        contents.push({ role: 'user', parts: [{ text: userMessage }] });

        const response = await this.genAiClient.models.generateContent({
          model: this.modelName,
          contents,
          config: {
            systemInstruction: NEXUS_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: tools }],
          },
        });

        const candidate = response.candidates?.[0];
        let assistantReply = response.text || '';

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            // Handle tool function calls
            if (part.functionCall) {
              const call = part.functionCall;
              const toolName = call.name;
              const toolArgs = call.args || {};

              if (toolName === 'propose_acknowledge_alert') {
                const actionId = `action-${Date.now()}`;
                const alertIdStr = String(toolArgs.alert_id || '');
                proposedAction = {
                  id: actionId,
                  actionType: 'acknowledge_alert',
                  description: `Acknowledge alert #${alertIdStr.substring(0, 8)} (${toolArgs.reason || 'Operational review'})`,
                  payload: { alertId: alertIdStr },
                  status: 'pending',
                };
                this.pendingActions.set(actionId, proposedAction);

                toolCallsExecuted.push({
                  name: toolName,
                  args: toolArgs,
                  result: { status: 'proposed_for_user_confirmation', actionId },
                });
              } else {
                const result = await this.executeTool(orgId, toolName, toolArgs);
                toolCallsExecuted.push({
                  name: toolName,
                  args: toolArgs,
                  result,
                });
              }
            }
          }
        }

        // If tool calls were made, perform synthesis turn so Gemini explains the data
        if (toolCallsExecuted.length > 0 && !assistantReply.trim()) {
          const followUp = await this.genAiClient.models.generateContent({
            model: this.modelName,
            contents: [
              ...contents,
              {
                role: 'model',
                parts: toolCallsExecuted.map((tc) => ({
                  text: `Executed tool ${tc.name}: ${JSON.stringify(tc.result)}`,
                })),
              },
              {
                role: 'user',
                parts: [{ text: 'Please synthesize and summarize the above tool findings clearly for the operator.' }],
              },
            ],
            config: {
              systemInstruction: NEXUS_SYSTEM_INSTRUCTION,
            },
          });
          assistantReply = followUp.text || 'Operational data retrieved successfully.';
        }

        if (assistantReply.trim()) {
          return {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: assistantReply,
            toolCalls: toolCallsExecuted.length > 0 ? toolCallsExecuted : undefined,
            proposedAction,
            isFallback: false,
            createdAt: new Date().toISOString(),
          };
        }
      } catch (geminiError: any) {
        this.logger.warn(`Gemini API call failed (${geminiError.message}). Using context-aware fallback.`);
      }
    }

    // Context-Aware Fallback Responder
    return this.processFallbackChat(orgId, userMessage);
  }

  /**
   * Deterministic, context-aware fallback when Gemini API key is absent or network fails.
   */
  async processFallbackChat(orgId: string, message: string): Promise<AiChatMessage> {
    const lower = message.toLowerCase();
    const toolCallsExecuted: AiToolCall[] = [];
    let proposedAction: AiProposedAction | null = null;
    let replyText = '';

    // 1. Seaways-Specific Operational Inquiries (Vessels, Voyages, Ships, Ports, Maritime Carbon, STCW)
    if (
      lower.includes('voyage') ||
      lower.includes('vessel') ||
      lower.includes('ship') ||
      lower.includes('seaways') ||
      lower.includes('port') ||
      lower.includes('berth') ||
      lower.includes('stcw') ||
      lower.includes('watchkeeping')
    ) {
      if (lower.includes('stcw') || lower.includes('watchkeeping') || lower.includes('rest hour')) {
        replyText =
          `IMO STCW Watchkeeping & Rest-Hour Compliance Module (STCW Reg VIII/1 & Code Sec A-VIII/1 / MLC 2006):\n\n` +
          `• Minimum Daily Rest: 10 hours (600 minutes) in any 24-hour period (maximum allowable duty period: 14 hours / 840 minutes).\n` +
          `• Weekly Rest: Minimum 77 hours in any 7-day period.\n` +
          `• Rest Division: Divided into no more than two periods, one of which must be at least 6 hours.\n` +
          `• Compliance Auditing: Automatically audits master/watchkeeping logs on voyage completion and flags critical safety breaches.`;
      } else {
        const voyages = await this.executeTool(orgId, 'list_active_voyage_movements', {});
        toolCallsExecuted.push({
          name: 'list_active_voyage_movements',
          args: {},
          result: voyages,
        });

        replyText =
          voyages.length > 0
            ? `Found ${voyages.length} active/planned voyage movement(s) on the seaways network:\n` +
              voyages
                .map(
                  (v: any, i: number) =>
                    `${i + 1}. Voyage ${v.voyageNumber || 'N/A'} (${v.vessel || 'Vessel'}, ${v.dwtTonnes ? `${v.dwtTonnes.toLocaleString()} DWT` : 'Panamax'}): ${v.originPort} → ${v.destinationPort} (${v.status}, ~${v.distanceKm || 0} km, Master: ${v.master || 'N/A'})`,
                )
                .join('\n')
            : 'No active voyage movements are currently in transit. Use "Dispatch Voyage" to schedule a new open-water sea route.';
      }
    }
    // 2. Airways-Specific Operational Inquiries (Flights, Aircraft, Pilot Crew, Air Carbon, FDTL)
    else if (
      lower.includes('flight') ||
      lower.includes('aircraft') ||
      lower.includes('airplane') ||
      lower.includes('pilot') ||
      lower.includes('airways') ||
      lower.includes('airport') ||
      lower.includes('fdtl')
    ) {
      if (lower.includes('fdtl') || lower.includes('flight duty') || lower.includes('duty time')) {
        replyText =
          `DGCA India Flight Duty Time Limitations (FDTL) Module (CAR Section 7 Series J):\n\n` +
          `• Maximum Flight Duty Period (FDP): 13 hours (780 minutes) within any rolling 24-hour window for two-pilot operations.\n` +
          `• Maximum Flight Time: 8 hours (480 minutes) in a 24-hour window.\n` +
          `• Compliance Auditing: Automatically logs duty hours on flight completion and raises critical safety violations if limits are exceeded.`;
      } else {
        const flights = await this.executeTool(orgId, 'list_active_flight_movements', {});
        toolCallsExecuted.push({
          name: 'list_active_flight_movements',
          args: {},
          result: flights,
        });

        replyText =
          flights.length > 0
            ? `Found ${flights.length} active/planned flight movement(s) on the airways network:\n` +
              flights
                .map(
                  (f: any, i: number) =>
                    `${i + 1}. Flight ${f.flightNumber || 'N/A'} (${f.aircraft || 'Air Cargo'}): ${f.originAirport} → ${f.destinationAirport} (${f.status}, ~${f.distanceKm || 0} km, Pilot: ${f.pilot || 'N/A'})`,
                )
                .join('\n')
            : 'No active flight movements are currently in transit. Use "Dispatch Flight" to schedule a new movement.';
      }
    }
    // 3. Railways-Specific Operational Inquiries (Train Movements, Rakes, Loco Pilots, Slot Intelligence)
    else if (
      lower.includes('train') ||
      lower.includes('rail') ||
      lower.includes('rake') ||
      lower.includes('loco') ||
      lower.includes('locomotive') ||
      lower.includes('station')
    ) {
      if (lower.includes('slot') || lower.includes('congestion') || lower.includes('capacity')) {
        replyText =
          `Rail Slot Intelligence Module:\n\n` +
          `• Corridor Capacity Evaluation: Analyzes planned and active train movements within a ±2 hour search window on the specified rail route.\n` +
          `• Bottleneck Detection: Flags corridor congestion when overlapping departures exceed threshold capacity.\n` +
          `• Suggested Departure: Recommends the earliest clear line window (e.g. +3 hours) to prevent track holds.`;
      } else {
        const movements = await this.executeTool(orgId, 'list_active_train_movements', {});
        toolCallsExecuted.push({
          name: 'list_active_train_movements',
          args: {},
          result: movements,
        });

        replyText =
          movements.length > 0
            ? `Found ${movements.length} active/planned train movement(s) on the rail network:\n` +
              movements
                .map(
                  (m: any, i: number) =>
                    `${i + 1}. Train ${m.trainNumber || 'N/A'} (${m.locoFuelType || 'Electric'}): ${m.originStation} → ${m.destinationStation} (${m.status}, ~${m.distanceKm || 0} km, Pilot: ${m.locoPilot || 'N/A'})`,
                )
                .join('\n')
            : 'No active freight train movements are currently on the rail network. Use "Dispatch Train" to schedule a new movement.';
      }
    }
    // 4. General & Conceptual Questions (Workflows, Platform Capabilities, Digital Twin)
    else if (
      lower.includes('workflow') ||
      lower.includes('what can you do') ||
      lower.includes('capabilities') ||
      lower.includes('what is nexus') ||
      lower.includes('digital twin') ||
      lower.includes('multimodal') ||
      lower.includes('predictive eta') ||
      lower.includes('how does')
    ) {
      if (lower.includes('digital twin')) {
        replyText =
          `The NEXUS WAYS Digital Twin generates a live 'ghost' projection representing the ideal predicted schedule along the route geometry.\n\n` +
          `• Schedule Deviation: Continuously compares real simulated GPS/telemetry points against the ghost position to compute minute-level schedule variance (ahead/behind).\n` +
          `• Map Visualization: Renders a distinctive dashed cyan ghost marker with live status indicators across Roadways, Railways, Airways, and Seaways.\n` +
          `• Congestion Impact: When real simulated speed holds or sea lane cautions occur, the deviation updates in real-time.`;
      } else if (lower.includes('workflow') || lower.includes('what can you do') || lower.includes('capabilities')) {
        replyText =
          `I can assist with several NEXUS WAYS operational workflows across your multimodal network:\n\n` +
          `• Fleet, Train, Flight & Vessel Tracking: Real-time telemetry monitoring, heading/speed tracking, and status updates across Roadways, Railways, Airways & Seaways.\n` +
          `• Predictive ETA & Confidence: Dynamic arrival estimation with historical sample variance bands (±15% default or sample stddev).\n` +
          `• Driver, Pilot & Master Safety Scoring: Automated evaluation of harsh maneuvers and overspeeding (Road limit: 80 km/h; Rail: 100 km/h; Air: 250 kts below 10k ft; Sea: ROT > 20°/min per IMO Res A.526(13)).\n` +
          `• Environmental & Slot Intelligence: GLEC Framework carbon emission calculations (Sea Panamax: 0.0084 kg/t-km; Rail: 0.0106 kg/t-km; Road: 0.101 kg/t-km; Air: 0.608 kg/t-km) and Slot Intelligence checks.\n` +
          `• Regulatory Compliance: Geofencing boundary monitoring, MTWA HOS rules, DGCA India FDTL limits, and IMO STCW Section A-VIII/1 watchkeeping rules.\n` +
          `• Disruption Response: Alert triage and proposed operational acknowledgements.`;
      } else if (lower.includes('what is nexus') || lower.includes('multimodal')) {
        replyText =
          `NEXUS WAYS is a unified Multimodal Logistics Intelligence Platform providing end-to-end operational visibility across Roadways, Railways, Airways, and Seaways.\n\n` +
          `It combines route optimization, live telemetry simulation, digital twin schedule tracking, and automated regulatory safety compliance into a single operational interface.`;
      } else {
        replyText =
          `NEXUS WAYS provides integrated multimodal logistics operations, route planning with OSRM, Overpass, Great-Circle and Searoute open-water calculations, safety scoring, carbon/slot calculation, and digital-twin ghost tracking.`;
      }
    }
    // 5. Specific Operational Inquiries: Alerts & Incidents
    else if (lower.includes('alert') || lower.includes('warning') || lower.includes('incident') || lower.includes('hos') || lower.includes('geofence')) {
      const alerts = await this.executeTool(orgId, 'list_unacknowledged_alerts', {});
      toolCallsExecuted.push({
        name: 'list_unacknowledged_alerts',
        args: {},
        result: alerts,
      });

      if (lower.includes('ack') || lower.includes('dismiss') || lower.includes('clear')) {
        const firstAlert = alerts[0];
        if (firstAlert) {
          const actionId = `action-${Date.now()}`;
          proposedAction = {
            id: actionId,
            actionType: 'acknowledge_alert',
            description: `Acknowledge alert #${firstAlert.id.substring(0, 8)} (${firstAlert.type} - ${firstAlert.message.substring(0, 40)}...)`,
            payload: { alertId: firstAlert.id },
            status: 'pending',
          };
          this.pendingActions.set(actionId, proposedAction);
          replyText = `Found active alert #${firstAlert.id.substring(0, 8)}: "${firstAlert.message}". I have prepared a proposed action for you to confirm.`;
        } else {
          replyText = 'There are no active unacknowledged alerts to acknowledge.';
        }
      } else {
        replyText =
          alerts.length > 0
            ? `There are currently ${alerts.length} unacknowledged operational alert(s):\n` +
              alerts.map((a: any, i: number) => `${i + 1}. [${a.severity.toUpperCase()}] ${a.message}`).join('\n')
            : 'All operational alerts are clear. No active unacknowledged alerts found.';
      }
    }
    // 6. Specific Operational Inquiries: Road Trips & Shipments
    else if (lower.includes('trip') || lower.includes('route') || lower.includes('manifest') || lower.includes('shipment') || lower.includes('delayed')) {
      const trips = await this.executeTool(orgId, 'list_active_trips', {});
      toolCallsExecuted.push({
        name: 'list_active_trips',
        args: {},
        result: trips,
      });

      replyText =
        trips.length > 0
          ? `Found ${trips.length} active/planned trip(s) in the fleet:\n` +
            trips
              .map(
                (t: any, i: number) =>
                  `${i + 1}. Vehicle ${t.vehicle || 'N/A'}: ${t.origin} → ${t.destination} (${t.status}, ~${t.distanceKm || 0} km)`,
              )
              .join('\n')
          : 'No road trips are currently in transit. Use "Dispatch Trip" to initiate a new route manifest.';
    }
    // 7. Specific Operational Inquiries: Fleet Statistics & Summary
    else if (lower.includes('fleet') || lower.includes('status') || lower.includes('speed') || lower.includes('stats') || lower.includes('summary')) {
      const stats = await this.executeTool(orgId, 'get_dashboard_stats', {});
      toolCallsExecuted.push({
        name: 'get_dashboard_stats',
        args: {},
        result: stats,
      });

      replyText = `Operational Fleet Summary:\n- Active Vehicles: ${stats.activeVehicles}\n- Total Fleet Units: ${stats.totalFleet}\n- Active Alerts: ${stats.activeAlerts}\n- Average Speed: ${stats.avgSpeedKmh} km/h\n- Completed Today: ${stats.arrivedCount} trip(s).`;
    }
    // 8. Predictive & Weather Logistics Questions
    else if (lower.includes('weather') || lower.includes('predict') || lower.includes('disruption') || lower.includes('risk')) {
      replyText =
        `Predictive Logistics & Risk Monitoring:\n\n` +
        `• Weather & Route Conditions: Extreme weather events, marine swells, and localized corridor congestion are tracked against scheduled transit corridors.\n` +
        `• Disruption Detection: Ghost projections identify schedule slippage early to allow route diversion or relief crew dispatch.\n` +
        `• Multimodal Coordination: Planned rail/air/sea transfers can be rescheduled when upstream legs experience variance.`;
    }
    // 9. Default Helpful Fallback
    else {
      replyText =
        `I am your NEXUS WAYS Operations Copilot. You can ask me to:\n` +
        `• Check fleet, train, flight, or vessel status ("List active voyage movements", "List active flight movements", "List active train movements" or "What is our fleet status?")\n` +
        `• Inspect operational alerts or acknowledge incidents ("Show active alerts")\n` +
        `• Review active trips/movements and ETA predictions ("List active voyage movements")\n` +
        `• Check port berth capacity or airport slot congestion ("Explain slot intelligence")\n` +
        `• Explain platform capabilities and digital twin intelligence ("How does digital twin work?")`;
    }

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content: `[Rule-Based Assistant Fallback Mode]\n${replyText}`,
      toolCalls: toolCallsExecuted.length > 0 ? toolCallsExecuted : undefined,
      proposedAction,
      isFallback: true,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Confirms and applies a proposed write action (e.g. acknowledge_alert).
   */
  async confirmAction(orgId: string, req: AiConfirmActionRequest): Promise<{ success: boolean; message: string }> {
    if (!req.confirmed) {
      this.pendingActions.delete(req.actionId);
      return { success: true, message: 'Proposed action was rejected and cancelled.' };
    }

    if (req.actionType === 'acknowledge_alert') {
      const alertId = req.payload?.alertId;
      if (!alertId) {
        throw new BadRequestException('alertId is required to acknowledge alert');
      }

      const { error } = await this.supabase.adminClient
        .from('alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('id', alertId);

      if (error) {
        throw new BadRequestException(`Failed to acknowledge alert: ${error.message}`);
      }

      this.pendingActions.delete(req.actionId);
      return { success: true, message: `Alert #${alertId.substring(0, 8)} successfully acknowledged.` };
    }

    throw new BadRequestException(`Unsupported action type: ${req.actionType}`);
  }
}
