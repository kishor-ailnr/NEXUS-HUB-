import { Injectable } from '@nestjs/common';

/**
 * Rail Freight Carbon Calculation based on Smart Freight Centre & TCI-IIMB:
 * "India Default GHG Emission Values V1.0 – Complementing GLEC Framework v3.01" (May 2025),
 * Rail Emission Intensity Values (p.4).
 *
 * Exact Source:
 * Smart Freight Centre & TCI-IIMB, "India Default GHG Emission Values V1.0 – Complementing GLEC Framework v3.01" (May 2025),
 * Rail Emission Intensity Values (p.4).
 * WTT 0.0064 + TTW 0.0041 = WTW 0.0106 kg CO2e/tonne-km (blended national average across
 * India's actual diesel/electric traction mix, derived from Ministry of Railways annual
 * report data 2015-16 to 2019-20).
 *
 * Directional Sanity Check vs Roadways:
 * Roadways factor = 0.101 kg CO2e / tonne-km (GLEC Framework v3.0, Module 1, Table 2.1).
 * Rail factor = 0.0106 kg CO2e / tonne-km (Smart Freight Centre & TCI-IIMB 2025).
 * Rail is 89.5% cleaner than road freight (~9.5x more carbon-efficient).
 */
// Source: Smart Freight Centre & TCI-IIMB, "India Default GHG Emission Values V1.0 –
// Complementing GLEC Framework v3.01" (May 2025), Rail Emission Intensity Values (p.4).
// WTT 0.0064 + TTW 0.0041 = WTW 0.0106 kg CO2e/tonne-km (blended national average across
// India's actual diesel/electric traction mix, derived from Ministry of Railways annual
// report data 2015-16 to 2019-20).
export const RAIL_CARBON_FACTOR_KG_PER_TONNE_KM = 0.0106;

export const RAIL_CARBON_CITATION =
  'Smart Freight Centre & TCI-IIMB, "India Default GHG Emission Values V1.0 – Complementing GLEC Framework v3.01" (May 2025), Rail Emission Intensity Values (p.4) (WTW: 0.0106 kg CO2e/t-km)';

export interface RailCarbonResult {
  carbonKg: number;
  emissionFactor: number;
  fuelType?: 'electric' | 'diesel';
  cargoTonnes: number;
  citation: string;
  roadComparisonKg: number;
  savedVsRoadKg: number;
  percentReductionVsRoad: number;
}

@Injectable()
export class RailCarbonService {
  /**
   * Computes carbon emissions (kg CO2e) for a train movement based on distance, cargo weight, and locomotive fuel type.
   * Uses single blended national rail emission factor across India's traction mix (0.0106 kg CO2e / tonne-km).
   * Formula: distance_km * cargo_tonnes * emission_factor
   */
  calculateMovementCarbon(
    distanceKm: number,
    fuelType: 'electric' | 'diesel' = 'electric',
    cargoTonnes = 1500, // Standard Indian Railways freight rake payload capacity (e.g. 30-50 wagons)
  ): RailCarbonResult {
    const validDistance = Math.max(0, distanceKm || 0);
    const validCargo = Math.max(1, cargoTonnes || 1500);

    const emissionFactor = RAIL_CARBON_FACTOR_KG_PER_TONNE_KM;

    const rawCarbon = validDistance * validCargo * emissionFactor;
    const carbonKg = Math.round(rawCarbon * 100) / 100;

    // Road comparison (using road factor 0.101 kg CO2e / t-km)
    const ROAD_FACTOR = 0.101;
    const roadComparisonKg = Math.round(validDistance * validCargo * ROAD_FACTOR * 100) / 100;
    const savedVsRoadKg = Math.max(0, Math.round((roadComparisonKg - carbonKg) * 100) / 100);
    const percentReductionVsRoad =
      roadComparisonKg > 0 ? Math.round(((roadComparisonKg - carbonKg) / roadComparisonKg) * 100) : 0;

    return {
      carbonKg,
      emissionFactor,
      fuelType,
      cargoTonnes: validCargo,
      citation: RAIL_CARBON_CITATION,
      roadComparisonKg,
      savedVsRoadKg,
      percentReductionVsRoad,
    };
  }
}
