import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AirportSlotCheckResponse } from '@nexus-ways/shared';

@Injectable()
export class AirportSlotService {
  private readonly logger = new Logger(AirportSlotService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Evaluates airport runway/apron slot congestion for proposed departure and arrival times.
   * Slot congestion is a PER-AIRPORT constraint (departure airport window +/- 60 min, arrival airport window +/- 60 min).
   */
  async checkAirportSlots(
    orgId: string,
    departureAirportId: string,
    arrivalAirportId: string,
    proposedDeparture: string,
    flightDurationMinutes = 110,
    threshold = 4,
  ): Promise<AirportSlotCheckResponse> {
    const depTime = new Date(proposedDeparture);
    const arrTime = new Date(depTime.getTime() + flightDurationMinutes * 60 * 1000);

    // 1-hour window for departure airport: [depTime - 60 min, depTime + 60 min]
    const depWindowStart = new Date(depTime.getTime() - 60 * 60 * 1000).toISOString();
    const depWindowEnd = new Date(depTime.getTime() + 60 * 60 * 1000).toISOString();

    // 1-hour window for arrival airport: [arrTime - 60 min, arrTime + 60 min]
    const arrWindowStart = new Date(arrTime.getTime() - 60 * 60 * 1000).toISOString();
    const arrWindowEnd = new Date(arrTime.getTime() + 60 * 60 * 1000).toISOString();

    // 1. Query active/planned movements at departure airport
    const { data: depMovements } = await this.supabase.adminClient
      .from('flight_movements')
      .select('id, flight_id, status, started_at, created_at, flight:flights(origin_airport_id, destination_airport_id)')
      .eq('org_id', orgId)
      .in('status', ['planned', 'in_transit']);

    let depSlotCount = 0;
    let arrSlotCount = 0;

    for (const mov of depMovements || []) {
      const origId = (mov as any).flight?.origin_airport_id;
      const destId = (mov as any).flight?.destination_airport_id;

      const movTime = new Date(mov.started_at || mov.created_at);

      // Check departure airport matching
      if (origId === departureAirportId || destId === departureAirportId) {
        if (movTime >= new Date(depWindowStart) && movTime <= new Date(depWindowEnd)) {
          depSlotCount++;
        }
      }

      // Check arrival airport matching
      if (origId === arrivalAirportId || destId === arrivalAirportId) {
        if (movTime >= new Date(arrWindowStart) && movTime <= new Date(arrWindowEnd)) {
          arrSlotCount++;
        }
      }
    }

    const depCongested = depSlotCount >= threshold;
    const arrCongested = arrSlotCount >= threshold;
    const isCongested = depCongested || arrCongested;

    let reason: string | undefined;
    if (depCongested && arrCongested) {
      reason = `Both Departure Airport (${depSlotCount} ops) and Arrival Airport (${arrSlotCount} ops) exceed runway capacity threshold (${threshold} ops/hr)`;
    } else if (depCongested) {
      reason = `Departure Airport slot window has ${depSlotCount} scheduled operations (threshold: ${threshold} ops/hr)`;
    } else if (arrCongested) {
      reason = `Arrival Airport slot window has ${arrSlotCount} scheduled operations (threshold: ${threshold} ops/hr)`;
    }

    // Generate alternative slot times (+30m, +60m, -30m)
    const alternativeSlots: string[] = [];
    if (isCongested) {
      alternativeSlots.push(new Date(depTime.getTime() + 30 * 60 * 1000).toISOString());
      alternativeSlots.push(new Date(depTime.getTime() + 60 * 60 * 1000).toISOString());
      alternativeSlots.push(new Date(depTime.getTime() - 30 * 60 * 1000).toISOString());
    }

    const suggestedDeparture = isCongested && alternativeSlots.length > 0 ? alternativeSlots[0] : undefined;
    const suggestedArrival = suggestedDeparture
      ? new Date(new Date(suggestedDeparture).getTime() + flightDurationMinutes * 60 * 1000).toISOString()
      : undefined;

    return {
      departureAirportId,
      arrivalAirportId,
      proposedDeparture,
      congested: isCongested,
      departureSlotCount: depSlotCount,
      arrivalSlotCount: arrSlotCount,
      threshold,
      reason,
      suggestedDeparture,
      suggestedArrival,
      alternativeSlots,
    };
  }
}
