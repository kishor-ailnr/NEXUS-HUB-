import { DashboardStats, SystemStatus } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await apiFetch<{ stats: DashboardStats }>('/dashboard/stats', {
      method: 'GET',
    });
    return res.stats;
  },

  async getSystemStatus(): Promise<SystemStatus> {
    const res = await apiFetch<{ status: SystemStatus }>('/dashboard/system-status', {
      method: 'GET',
    });
    return res.status;
  },

  async measureClientLatency(): Promise<{ latencyMs: number; quality: 'Good' | 'Fair' | 'Poor' }> {
    const start = performance.now();
    try {
      const url = `${API_BASE_URL.replace(/\/$/, '')}/health`;
      const res = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Health check failed');
      const latencyMs = Math.round(performance.now() - start);

      let quality: 'Good' | 'Fair' | 'Poor' = 'Good';
      if (latencyMs > 150) {
        quality = 'Poor';
      } else if (latencyMs > 60) {
        quality = 'Fair';
      }

      return { latencyMs, quality };
    } catch {
      return { latencyMs: 999, quality: 'Poor' };
    }
  },
};
