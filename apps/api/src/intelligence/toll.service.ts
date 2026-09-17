import { Injectable } from '@nestjs/common';

/**
 * Historical reference point:
 * A nationally reported 3-axle National Highway toll rate from around 2010
 * (following a rate revision agreed between the government and the All India Motor Transport Congress).
 * Reference point only — not an assertion that this is precisely the Rule 4(2) "base year 2007-08"
 * statutory table value.
 */
export const NHAI_BASE_3AXLE_RATE_PER_KM = 2.40; // Historical reference INR per km (~2010)

/**
 * Approximate current operational toll rate for heavy commercial trucks on Indian National Highways.
 * Plainly labeled as an approximation (~₹5.50/km) rather than a statutory table quote.
 */
export const NHAI_COMMERCIAL_TRUCK_TOLL_RATE_PER_KM_APPROX = 5.50; // Approximate INR per km
export const NHAI_COMMERCIAL_TRUCK_TOLL_RATE_PER_KM = NHAI_COMMERCIAL_TRUCK_TOLL_RATE_PER_KM_APPROX;

export const NHAI_TOLL_CITATION =
  'Historical base reference ₹2.40/km (circa 2010, 3-axle commercial vehicles); current operational figure (~₹5.50/km) is an approximate estimate, not a statutory calculation.';

export const NHAI_TOLL_ESTIMATE_NOTE =
  'Estimated toll (~₹5.50/km) — approximate; not sourced from a verified current NHAI rate table.';

@Injectable()
export class TollService {
  /**
   * Estimates highway toll charges (INR) for a trip based on distance.
   * Formula: distance_km * per_km_rate_for_vehicle_class
   * Explicitly flagged and labeled as an approximate estimate.
   */
  calculateTripToll(
    distanceKm: number,
    vehicleType = 'Heavy Truck',
  ): {
    tollEstimateInr: number;
    perKmRate: number;
    isEstimate: true;
    estimateNote: string;
    citation: string;
  } {
    const validDistance = Math.max(0, distanceKm || 0);
    const rawToll = validDistance * NHAI_COMMERCIAL_TRUCK_TOLL_RATE_PER_KM_APPROX;

    return {
      tollEstimateInr: Math.round(rawToll),
      perKmRate: NHAI_COMMERCIAL_TRUCK_TOLL_RATE_PER_KM_APPROX,
      isEstimate: true,
      estimateNote: NHAI_TOLL_ESTIMATE_NOTE,
      citation: NHAI_TOLL_CITATION,
    };
  }
}
