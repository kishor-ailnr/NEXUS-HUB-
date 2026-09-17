import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RailSlotCheckResponse } from '@nexus-ways/shared';

export const DEFAULT_SLOT_CONGESTION_THRESHOLD = 1; // 1 or more overlapping movements flags congestion for single-track/priority corridors
export const DEFAULT_SLOT_WINDOW_HOURS = 2; // +/- 2 hours window

@Injectable()
export class SlotIntelligenceService {
  private readonly logger = new Logger(SlotIntelligenceService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Checks slot congestion for a proposed train departure on a specific route corridor.
   * Compares against existing active/planned movements within +/- windowHours.
   */
  async checkSlot(
    orgId: string,
    originStationId: string,
    destinationStationId: string,
    proposedDepartureStr?: string,
    windowHours = DEFAULT_SLOT_WINDOW_HOURS,
    threshold = DEFAULT_SLOT_CONGESTION_THRESHOLD,
  ): Promise<RailSlotCheckResponse> {
    const proposedDate = proposedDepartureStr ? new Date(proposedDepartureStr) : new Date();
    const proposedTimeMs = proposedDate.getTime();
    const windowMs = windowHours * 60 * 60 * 1000;

    const windowStart = new Date(proposedTimeMs - windowMs).toISOString();
    const windowEnd = new Date(proposedTimeMs + windowMs).toISOString();

    // Query active or planned movements on this route or opposite direction (shared single/double rail corridor)
    const { data: movements, error } = await this.supabase.adminClient
      .from('train_movements')
      .select('id, origin_station_id, destination_station_id, status, started_at, created_at')
      .eq('org_id', orgId)
      .in('status', ['planned', 'in_transit'])
      .or(
        `and(origin_station_id.eq.${originStationId},destination_station_id.eq.${destinationStationId}),and(origin_station_id.eq.${destinationStationId},destination_station_id.eq.${originStationId})`,
      );

    if (error) {
      this.logger.warn(`Slot intelligence query warning: ${error.message}`);
    }

    const activeList = movements || [];

    // Filter movements whose departure / active time falls within the window
    const overlapping = activeList.filter((m) => {
      const departureTimeStr = m.started_at || m.created_at;
      if (!departureTimeStr) return false;
      const depTimeMs = new Date(departureTimeStr).getTime();
      return Math.abs(depTimeMs - proposedTimeMs) <= windowMs;
    });

    const overlapCount = overlapping.length;
    const isCongested = overlapCount >= threshold;

    let suggestedDeparture: string | undefined = undefined;
    const alternativeSlots: string[] = [];

    if (isCongested) {
      // Suggest departing 3 hours later (outside the 2-hour congestion window)
      const suggestedDate = new Date(proposedTimeMs + (windowHours + 1) * 60 * 60 * 1000);
      suggestedDeparture = suggestedDate.toISOString();

      alternativeSlots.push(suggestedDate.toISOString());
      alternativeSlots.push(new Date(proposedTimeMs + (windowHours + 3) * 60 * 60 * 1000).toISOString());
      alternativeSlots.push(new Date(proposedTimeMs - (windowHours + 1) * 60 * 60 * 1000).toISOString());
    }

    return {
      originStationId,
      destinationStationId,
      proposedDeparture: proposedDate.toISOString(),
      congested: isCongested,
      overlapCount,
      threshold,
      reason: isCongested
        ? `High line occupancy: ${overlapCount} active or planned train movement(s) detected within ±${windowHours}h window on this rail corridor.`
        : `Track section clear: ${overlapCount} movement(s) detected (within threshold of ${threshold}).`,
      suggestedDeparture,
      alternativeSlots: alternativeSlots.length > 0 ? alternativeSlots : undefined,
    };
  }
}
