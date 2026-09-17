import { Injectable } from '@nestjs/common';

// Source: GLEC Framework v3.2 (Smart Freight Centre, 2023), §5.3, "container ship
// segmentation." Classification is by TEU capacity. Under-3,000-TEU vessels have no
// dedicated v3.2 default; per v3.2's own guidance, fall back to the 3,000-8,000 TEU factor
// (the conservative choice) rather than inventing a lower figure.
export const CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM = 0.0091; // 3,000-8,000 TEU
export const CONTAINER_SHIP_ULCV_KG_PER_TONNE_KM = 0.0076;              // 8,000+ TEU
export const CONTAINER_SHIP_TEU_THRESHOLD = 8000;
export const CONTAINER_SHIP_FEEDER_TEU_THRESHOLD = 3000; // below this: documented fallback, not a distinct factor

export const SEAWAYS_PANAMAX_CARBON_FACTOR_KG_PER_TONNE_KM = CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM;
export const SEAWAYS_DEFAULT_CARBON_FACTOR_KG_PER_TONNE_KM = CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM;

export const SEAWAYS_CARBON_CITATION =
  'GLEC Framework v3.2 (Smart Freight Centre, 2023), §5.3 Container Ship Segmentation: ' +
  'Panamax-to-Neo-Panamax (3,000–8,000 TEU) = 0.0091 kg CO2e/t-km; ' +
  'ULCV (8,000+ TEU) = 0.0076 kg CO2e/t-km; Sub-3,000 TEU feeder = 0.0091 kg CO2e/t-km (conservative fallback)';

export function selectSeaCarbonFactor(teuCapacity: number): {
  factor: number;
  bucket: 'panamax-neopanamax' | 'ulcv';
  note?: string;
} {
  if (teuCapacity >= CONTAINER_SHIP_TEU_THRESHOLD) {
    return { factor: CONTAINER_SHIP_ULCV_KG_PER_TONNE_KM, bucket: 'ulcv' };
  }
  if (teuCapacity < CONTAINER_SHIP_FEEDER_TEU_THRESHOLD) {
    return {
      factor: CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM,
      bucket: 'panamax-neopanamax',
      note:
        'Sub-3,000 TEU feeder vessel has no dedicated GLEC v3.2 default; using the ' +
        '3,000-8,000 TEU factor per v3.2\u2019s documented conservative fallback.',
    };
  }
  return { factor: CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM, bucket: 'panamax-neopanamax' };
}

export function getDwtBucketInfo(dwtTonnesOrTeu?: number | null): {
  name: string;
  teuRange: string;
  emissionFactor: number;
  description: string;
} {
  const val = dwtTonnesOrTeu != null && !isNaN(dwtTonnesOrTeu) && dwtTonnesOrTeu > 0 ? dwtTonnesOrTeu : 5000;
  // If value is in DWT range (> 30,000), approximate TEU at ~13 DWT/TEU
  const teu = val > 30000 ? Math.round(val / 13) : val;
  const selection = selectSeaCarbonFactor(teu);

  if (selection.bucket === 'ulcv') {
    return {
      name: 'ULCV (8,000+ TEU)',
      teuRange: '8,000+ TEU',
      emissionFactor: selection.factor,
      description: 'Ultra Large Container Vessel (8,000+ TEU)',
    };
  }

  if (teu < CONTAINER_SHIP_FEEDER_TEU_THRESHOLD) {
    return {
      name: 'Feeder (<3,000 TEU fallback)',
      teuRange: '<3,000 TEU',
      emissionFactor: selection.factor,
      description: 'Sub-3,000 TEU feeder vessel (GLEC v3.2 conservative fallback)',
    };
  }

  return {
    name: 'Panamax / Neo-Panamax (3,000–8,000 TEU)',
    teuRange: '3,000–8,000 TEU',
    emissionFactor: selection.factor,
    description: 'Panamax-to-Neo-Panamax container carrier (3,000–8,000 TEU, includes 65,000 DWT / 5,000 TEU class)',
  };
}

export interface SeaCarbonResult {
  carbonKg: number;
  emissionFactor: number;
  bucket: 'panamax-neopanamax' | 'ulcv';
  dwtBucket: string;
  teuCapacity: number;
  distanceKm: number;
  cargoTonnes: number;
  citation: string;
  note?: string;
  railComparisonKg: number;
  roadComparisonKg: number;
  airComparisonKg: number;
  savingsVsRailPercent: number;
  savingsVsRoadPercent: number;
  savingsVsAirPercent: number;
  directionalCheckPassed: boolean;
}

@Injectable()
export class SeaCarbonService {
  /**
   * Computes maritime carbon emissions (kg CO2e) for a voyage movement.
   * Formula: distance_km * cargo_tonnes * selectSeaCarbonFactor(teuCapacity).factor
   *
   * @param distanceKm Voyage distance in kilometers along open-water sea route
   * @param cargoTonnes Cargo payload carried in metric tonnes (defaults to 45,000 tonnes for Panamax container ship)
   * @param teuOrDwt Vessel capacity in TEU (or DWT tonnes if > 10,000)
   */
  calculateVoyageCarbon(
    distanceKm: number,
    cargoTonnes = 45000,
    teuOrDwt = 5000, // MV Ocean Titan 65,000 DWT is ~5,000 TEU
  ): SeaCarbonResult {
    const validDistance = Math.max(0, distanceKm || 0);
    const validCargo = Math.max(0.1, cargoTonnes || 45000);
    
    // Resolve TEU capacity (DWT is typically > 30,000 tonnes, whereas TEU is ≤ 25,000 TEU)
    const teuCapacity = teuOrDwt > 30000 ? Math.round(teuOrDwt / 13) : Math.max(1, teuOrDwt || 5000);
    const selection = selectSeaCarbonFactor(teuCapacity);
    const emissionFactor = selection.factor;

    const rawCarbon = validDistance * validCargo * emissionFactor;
    const carbonKg = Math.round(rawCarbon * 100) / 100;

    // Multimodal benchmark factors
    const RAIL_FACTOR = 0.0106; // Railways GLEC factor (0.0106 kg/t-km)
    const ROAD_FACTOR = 0.101;  // Roadways GLEC factor (0.101 kg/t-km)
    const AIR_FACTOR = 0.608;   // Airways Long-Haul GLEC factor (0.608 kg/t-km)

    const railComparisonKg = Math.round(validDistance * validCargo * RAIL_FACTOR * 100) / 100;
    const roadComparisonKg = Math.round(validDistance * validCargo * ROAD_FACTOR * 100) / 100;
    const airComparisonKg = Math.round(validDistance * validCargo * AIR_FACTOR * 100) / 100;

    // Relative savings percent
    const savingsVsRailPercent = Math.round(((railComparisonKg - carbonKg) / (railComparisonKg || 1)) * 1000) / 10;
    const savingsVsRoadPercent = Math.round(((roadComparisonKg - carbonKg) / (roadComparisonKg || 1)) * 1000) / 10;
    const savingsVsAirPercent = Math.round(((airComparisonKg - carbonKg) / (airComparisonKg || 1)) * 1000) / 10;

    // Directional check: Ocean container factors (0.0091 / 0.0076) are lower than Rail (0.0106), Road (0.101), and Air (0.608)
    const directionalCheckPassed =
      emissionFactor < RAIL_FACTOR && emissionFactor < ROAD_FACTOR && emissionFactor < AIR_FACTOR;

    const bucketLabel =
      selection.bucket === 'ulcv'
        ? 'ULCV (8,000+ TEU)'
        : teuCapacity < CONTAINER_SHIP_FEEDER_TEU_THRESHOLD
          ? 'Feeder (<3,000 TEU fallback)'
          : 'Panamax / Neo-Panamax (3,000–8,000 TEU)';

    const citation = `GLEC Framework v3.2 §5.3 (${bucketLabel}: ${emissionFactor} kg CO2e/t-km)`;

    return {
      carbonKg,
      emissionFactor,
      bucket: selection.bucket,
      dwtBucket: bucketLabel,
      teuCapacity,
      distanceKm: validDistance,
      cargoTonnes: validCargo,
      citation,
      note: selection.note,
      railComparisonKg,
      roadComparisonKg,
      airComparisonKg,
      savingsVsRailPercent,
      savingsVsRoadPercent,
      savingsVsAirPercent,
      directionalCheckPassed,
    };
  }
}
