import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(() => {
    service = new GeocodingService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns null for empty address query', async () => {
    const coords = await service.geocodeAddress('');
    expect(coords).toBeNull();
  });

  it('geocodes a real known address using Nominatim API and returns valid coordinates', async () => {
    const address = 'Gateway of India, Mumbai, India';
    const result = await service.geocodeAddress(address);
    console.log(`[Nominatim Live Geocoding Output] Query: "${address}" -> Latitude: ${result?.latitude}, Longitude: ${result?.longitude}`);
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeGreaterThanOrEqual(18.9);
    expect(result!.latitude).toBeLessThanOrEqual(19.0);
    expect(result!.longitude).toBeGreaterThanOrEqual(72.8);
    expect(result!.longitude).toBeLessThanOrEqual(72.9);
  }, 15000);
});
