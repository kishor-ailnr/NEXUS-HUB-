import React from 'react';
import { DashboardStats } from '@nexus-ways/shared';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Truck, Layers, AlertTriangle, Gauge, CheckCircle2, ArrowUpRight } from 'lucide-react';

interface StatsRowProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

export const StatsRow: React.FC<StatsRowProps> = ({ stats, isLoading = false }) => {
  const cards = [
    {
      id: 'active-vehicles',
      title: 'Active Vehicles',
      icon: Truck,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      value: stats?.activeVehicles?.available ? stats.activeVehicles.value : '—',
      available: stats?.activeVehicles?.available ?? false,
      note: 'Phase 4 Tracking',
    },
    {
      id: 'total-fleet',
      title: 'Total Fleet Today',
      icon: Layers,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      value: stats?.totalFleetToday?.available ? stats.totalFleetToday.value : '—',
      available: stats?.totalFleetToday?.available ?? false,
      note: 'Phase 4 Registry',
    },
    {
      id: 'active-alerts',
      title: 'Active Alerts',
      icon: AlertTriangle,
      color: 'text-status-critical',
      bgColor: 'bg-red-50',
      value: stats ? stats.activeAlerts : 0,
      available: true,
      note: 'Live Database',
    },
    {
      id: 'avg-speed',
      title: 'Average Speed',
      icon: Gauge,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      value: stats?.avgSpeedKmh?.available ? `${stats.avgSpeedKmh.value} km/h` : '—',
      available: stats?.avgSpeedKmh?.available ?? false,
      note: 'Phase 4 Telemetry',
    },
    {
      id: 'arrived-count',
      title: 'Arrived Today',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      value: stats?.arrivedCount?.available ? stats.arrivedCount.value : '—',
      available: stats?.arrivedCount?.available ?? false,
      note: 'Phase 4 Lifecycle',
    },
    {
      id: 'departed-count',
      title: 'Departed Today',
      icon: ArrowUpRight,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      value: stats?.departedCount?.available ? stats.departedCount.value : '—',
      available: stats?.departedCount?.available ?? false,
      note: 'Phase 4 Lifecycle',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.id}
            data-testid={`stat-card-${card.id}`}
            className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-white"
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 truncate">{card.title}</span>
                <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-1">
                {isLoading ? (
                  <div className="h-7 w-12 bg-slate-200 animate-pulse rounded" />
                ) : (
                  <span
                    className={`text-xl sm:text-2xl font-bold tracking-tight ${
                      card.available ? 'text-slate-900' : 'text-slate-400 font-mono'
                    }`}
                  >
                    {card.value}
                  </span>
                )}

                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${
                    card.available
                      ? 'border-red-200 bg-red-50/50 text-status-critical-dark font-medium'
                      : 'border-slate-200 bg-slate-50 text-slate-400 font-normal'
                  }`}
                >
                  {card.available ? 'Active' : 'Phase 4'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
