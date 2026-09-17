import { PlatformHubStatsResponse } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const platformService = {
  async getHubStats(): Promise<PlatformHubStatsResponse> {
    return apiFetch<PlatformHubStatsResponse>('/platform/hub-stats', {
      method: 'GET',
    });
  },
};
