import React from 'react';
import { Wifi, Activity, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import { SystemStatus } from '@nexus-ways/shared';
import { Badge } from './ui/badge';

interface SystemStatusRowProps {
  systemStatus: SystemStatus | null;
  isWsConnected: boolean;
  networkLatency: { latencyMs: number; quality: 'Good' | 'Fair' | 'Poor' } | null;
}

export const SystemStatusRow: React.FC<SystemStatusRowProps> = ({
  systemStatus,
  isWsConnected,
  networkLatency,
}) => {
  const getQualityBadgeVariant = (quality?: 'Good' | 'Fair' | 'Poor') => {
    switch (quality) {
      case 'Good':
        return 'healthy';
      case 'Fair':
        return 'warning';
      default:
        return 'critical';
    }
  };

  return (
    <div
      data-testid="system-status-row"
      className="bg-slate-900 text-white rounded-xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-4 text-xs"
    >
      <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-slate-400 text-[10px]">
        <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
        <span>Telemetry & Telematics State</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
        {/* 1. Live WebSocket Connection */}
        <div className="flex items-center gap-1.5" data-testid="ws-status">
          <Wifi className={`w-3.5 h-3.5 ${isWsConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className="text-slate-300">Gateway:</span>
          <Badge
            variant={isWsConnected ? 'healthy' : 'critical'}
            className="text-[10px] py-0 px-1.5"
          >
            {isWsConnected ? 'Connected (Live)' : 'Disconnected'}
          </Badge>
        </div>

        {/* 2. Client-Measured Network Latency */}
        <div className="flex items-center gap-1.5" data-testid="network-latency">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-300">Client Latency:</span>
          <Badge
            variant={getQualityBadgeVariant(networkLatency?.quality)}
            className="text-[10px] py-0 px-1.5 font-mono"
          >
            {networkLatency ? `${networkLatency.latencyMs} ms (${networkLatency.quality})` : 'Measuring...'}
          </Badge>
        </div>

        {/* 3. System Agents State */}
        <div className="flex items-center gap-1.5" data-testid="agents-health">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-slate-300">System Agents:</span>
          {systemStatus?.agentsHealthy ? (
            <Badge variant="healthy" className="text-[10px] py-0 px-1.5 gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Operational</span>
            </Badge>
          ) : (
            <Badge variant="warning" className="text-[10px] py-0 px-1.5 gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>Degraded</span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};
