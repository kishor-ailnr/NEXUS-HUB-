import { Injectable } from '@nestjs/common';

/**
 * Aviation Air Freight Carbon Calculation based on:
 * GLEC Framework v3.2 (Smart Freight Centre), Freight — multimodal intensities
 * (per tonne-km), Table 1: Air freight.
 *
 * Exact Source & Haul-Length Split:
 * - Dedicated Freighter, Short-Haul (<1,500 km):  1.516 kg CO2e / tonne-km (WTW)
 * - Dedicated Freighter, Long-Haul (>=1,500 km):  0.608 kg CO2e / tonne-km (WTW)
 * - Threshold: 1,500 km (geodesic great-circle distance)
 *
 * Directional Sanity Check vs Road & Rail:
 * - Short-Haul Air Freight Factor (1.516) vs Road (0.101) = ~15.0x higher
 * - Short-Haul Air Freight Factor (1.516) vs Rail (0.0106) = ~143.0x higher
 * - Long-Haul Air Freight Factor (0.608) vs Road (0.101) = ~6.0x higher
 * - Long-Haul Air Freight Factor (0.608) vs Rail (0.0106) = ~57.4x higher
 *
 * Both air freight buckets are materially and strictly higher than Roadways and Railways.
 */
export const AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM = 1.516; // Freighter, <1500 km
export const AIR_FREIGHT_CARBON_LONG_HAUL_KG_PER_TONNE_KM = 0.608;  // Freighter, >=1500 km
export const AIR_FREIGHT_HAUL_THRESHOLD_KM = 1500;

// Default / fallback alias
export const AIR_CARBON_FACTOR_KG_PER_TONNE_KM = AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM;

export const AIR_CARBON_CITATION =
  'GLEC Framework v3.2 (Smart Freight Centre) Table 1 (Air Freight): Short-Haul (<1500km) = 1.516 kg CO2e/t-km, Long-Haul (≥1500km) = 0.608 kg CO2e/t-km';

export function selectAirCarbonFactor(distanceKm: number): number {
  return distanceKm < AIR_FREIGHT_HAUL_THRESHOLD_KM
    ? AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM
    : AIR_FREIGHT_CARBON_LONG_HAUL_KG_PER_TONNE_KM;
}

export function selectAirHaulCategory(distanceKm: number): 'short' | 'long' {
  return distanceKm < AIR_FREIGHT_HAUL_THRESHOLD_KM ? 'short' : 'long';
}

export type AirHaulCategory = 'short' | 'long';

export interface AirCarbonResult {
  carbonKg: number;
  emissionFactor: number;
  haulCategory: AirHaulCategory;
  distanceKm: number;
  cargoTonnes: number;
  citation: string;
  roadComparisonKg: number;
  railComparisonKg: number;
  multiplierVsRoad: number;
  multiplierVsRail: number;
  directionalCheckPassed: boolean;
}

@Injectable()
export class AirCarbonService {
  /**
   * Computes carbon emissions (kg CO2e) for a flight movement based on great-circle distance and cargo weight.
   * Formula: distance_km * cargo_tonnes * selectAirCarbonFactor(distance_km)
   */
  calculateFlightCarbon(
    distanceKm: number,
    cargoTonnes = 40, // Standard dedicated freighter payload capacity in metric tonnes (e.g. B777-200LRF)
  ): AirCarbonResult {
    const validDistance = Math.max(0, distanceKm || 0);
    const validCargo = Math.max(0.1, cargoTonnes || 40);

    const emissionFactor = selectAirCarbonFactor(validDistance);
    const haulCategory = selectAirHaulCategory(validDistance);

    const rawCarbon = validDistance * validCargo * emissionFactor;
    const carbonKg = Math.round(rawCarbon * 100) / 100;

    // Road (0.101 kg CO2e/t-km) & Rail (0.0106 kg CO2e/t-km) comparisons
    const ROAD_FACTOR = 0.101;
    const RAIL_FACTOR = 0.0106;
    const roadComparisonKg = Math.round(validDistance * validCargo * ROAD_FACTOR * 100) / 100;
    const railComparisonKg = Math.round(validDistance * validCargo * RAIL_FACTOR * 100) / 100;

    const multiplierVsRoad = Math.round((emissionFactor / ROAD_FACTOR) * 10) / 10;
    const multiplierVsRail = Math.round((emissionFactor / RAIL_FACTOR) * 10) / 10;

    // Directional check: Air factor must be higher than both Road and Rail factors
    const directionalCheckPassed = emissionFactor > ROAD_FACTOR && emissionFactor > RAIL_FACTOR;

    const citation = `GLEC Framework v3.2 Table 1 (Dedicated Freighter, ${
      haulCategory === 'short' ? 'Short-Haul <1,500 km: 1.516' : 'Long-Haul ≥1,500 km: 0.608'
    } kg CO2e/t-km)`;

    return {
      carbonKg,
      emissionFactor,
      haulCategory,
      distanceKm: validDistance,
      cargoTonnes: validCargo,
      citation,
      roadComparisonKg,
      railComparisonKg,
      multiplierVsRoad,
      multiplierVsRail,
      directionalCheckPassed,
    };
  }
}
