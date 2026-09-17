import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { PortSlotCheckResponse } from '@nexus-ways/shared';

@Injectable()
export class PortSlotService {
  private readonly logger = new Logger(PortSlotService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Evaluates port berth & fairway channel slot congestion for proposed departure and arrival times.
   * Slot congestion is evaluated PER-PORT (origin port window +/- 60 min, destination port window +/- 60 min).
   */
  async checkPortSlots(
    orgId: string,
    originPortId: string,
    destinationPortId: string,
    proposedDeparture: string,
    voyageDurationMinutes = 180,
    threshold = 4,
  ): Promise<PortSlotCheckResponse> {
    const depTime = new Date(proposedDeparture);
    const arrTime = new Date(depTime.getTime() + voyageDurationMinutes * 60 * 1000);

    // 1-hour window for origin port: [depTime - 60 min, depTime + 60 min]
    const depWindowStart = new Date(depTime.getTime() - 60 * 60 * 1000).toISOString();
    const depWindowEnd = new Date(depTime.getTime() + 60 * 60 * 1000).toISOString();

    // 1-hour window for destination port: [arrTime - 60 min, arrTime + 60 min]
    const arrWindowStart = new Date(arrTime.getTime() - 60 * 60 * 1000).toISOString();
    const arrWindowEnd = new Date(arrTime.getTime() + 60 * 60 * 1000).toISOString();

    // Query active/planned voyage movements in the organization
    const { data: movements } = await this.supabase.adminClient
      .from('voyage_movements')
      .select('id, voyage_id, status, started_at, created_at, voyage:voyages(origin_port_id, destination_port_id)')
      .eq('org_id', orgId)
      .in('status', ['planned', 'in_transit']);

    let origSlotCount = 0;
    let destSlotCount = 0;

    for (const mov of movements || []) {
      const oId = (mov as any).voyage?.origin_port_id;
      const dId = (mov as any).voyage?.destination_port_id;
      const movTime = new Date(mov.started_at || mov.created_at);

      // Check origin port overlap
      if (oId === originPortId || dId === originPortId) {
        if (movTime >= new Date(depWindowStart) && movTime <= new Date(depWindowEnd)) {
          origSlotCount++;
        }
      }

      // Check destination port overlap
      if (oId === destinationPortId || dId === destinationPortId) {
        if (movTime >= new Date(arrWindowStart) && movTime <= new Date(arrWindowEnd)) {
          destSlotCount++;
        }
      }
    }

    const origCongested = origSlotCount >= threshold;
    const destCongested = destSlotCount >= threshold;
    const isCongested = origCongested || destCongested;

    let reason: string | undefined;
    if (origCongested && destCongested) {
      reason = `Both Origin Port (${origSlotCount} vessel ops) and Destination Port (${destSlotCount} vessel ops) exceed berth/channel capacity threshold (${threshold} ops/hr)`;
    } else if (origCongested) {
      reason = `Origin Port berth allocation window has ${origSlotCount} scheduled movements (threshold: ${threshold} ops/hr)`;
    } else if (destCongested) {
      reason = `Destination Port berth allocation window has ${destSlotCount} scheduled movements (threshold: ${threshold} ops/hr)`;
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
      ? new Date(new Date(suggestedDeparture).getTime() + voyageDurationMinutes * 60 * 1000).toISOString()
      : undefined;

    return {
      originPortId,
      destinationPortId,
      proposedDeparture,
      congested: isCongested,
      originSlotCount: origSlotCount,
      destinationSlotCount: destSlotCount,
      threshold,
      originSlotCongested: origCongested,
      destinationSlotCongested: destCongested,
      reason,
      suggestedDeparture,
      suggestedDepartureTime: suggestedDeparture,
      suggestedArrival,
      alternativeSlots,
    };
  }
}
