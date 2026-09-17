import { Injectable, Logger } from '@nestjs/common';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private lastRequestTime = 0;
  private readonly minIntervalMs = 1050; // 1 req/sec rate limit

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  async geocodeAddress(addressQuery: string): Promise<Coordinates | null> {
    if (!addressQuery || !addressQuery.trim()) {
      return null;
    }

    try {
      await this.waitForRateLimit();

      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', addressQuery.trim());
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'NEXUS-WAYS-Platform/1.0 (contact: support@nexusways.com)',
          'Accept-Language': 'en',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim geocoding HTTP error ${response.status}: ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as any[];
      if (!Array.isArray(data) || data.length === 0) {
        this.logger.log(`No coordinates found for query: "${addressQuery}"`);
        return null;
      }

      const firstResult = data[0];
      const latitude = parseFloat(firstResult.lat);
      const longitude = parseFloat(firstResult.lon);

      if (isNaN(latitude) || isNaN(longitude)) {
        return null;
      }

      return { latitude, longitude };
    } catch (error: any) {
      this.logger.warn(`Geocoding error for "${addressQuery}": ${error.message}`);
      return null;
    }
  }
}
