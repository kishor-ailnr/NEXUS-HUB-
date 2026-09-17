import { Injectable } from '@nestjs/common';

/**
 * Carbon calculation based on Global Logistics Emissions Council (GLEC) Framework v3.0 (2023).
 * Exact Source: Smart Freight Centre — GLEC Framework v3.0, Module 1: Road Transport Default Emission Factors.
 * Table 2.1: Heavy Road Transport WTW (Well-to-Wheel) Default GHG Intensity.
 * Row: Articulated Diesel Truck (34–40t GVW, average load factor).
 * Exact Figure: 0.101 kg CO2e per tonne-km (101 g CO2e / t-km).
 */
export const GLEC_INDIAN_ROAD_FREIGHT_EMISSION_FACTOR = 0.101; // kg CO2e / tonne-km
export const GLEC_CITATION =
  'Smart Freight Centre — GLEC Framework v3.0 (2023), Module 1, Table 2.1 (Articulated Diesel Truck 34-40t WTW: 0.101 kg CO2e/t-km)';

@Injectable()
export class CarbonService {
  /**
   * Computes carbon emissions (kg CO2e) for a trip based on distance and vehicle payload capacity.
   * Formula: distance_km * vehicle_capacity_tonnes * emission_factor_kg_per_tonne_km
   */
  calculateTripCarbon(
    distanceKm: number,
    capacityKg = 15000,
  ): { carbonKg: number; emissionFactor: number; citation: string } {
    const validDistance = Math.max(0, distanceKm || 0);
    const capacityTonnes = Math.max(1, (capacityKg || 15000) / 1000);
    const rawCarbon = validDistance * capacityTonnes * GLEC_INDIAN_ROAD_FREIGHT_EMISSION_FACTOR;

    return {
      carbonKg: Math.round(rawCarbon * 100) / 100,
      emissionFactor: GLEC_INDIAN_ROAD_FREIGHT_EMISSION_FACTOR,
      citation: GLEC_CITATION,
    };
  }
}
