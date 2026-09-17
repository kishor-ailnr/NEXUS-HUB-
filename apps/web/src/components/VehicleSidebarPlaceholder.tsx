import React from 'react';
import { Truck, Sparkles, Navigation, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface VehicleSidebarPlaceholderProps {
  modeName: string;
}

export const VehicleSidebarPlaceholder: React.FC<VehicleSidebarPlaceholderProps> = ({ modeName }) => {
  return (
    <Card
      data-testid="sidebar-vehicle-placeholder"
      className="border-dashed border-2 border-slate-300 bg-slate-50/50 shadow-none"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-navy-50 text-navy rounded-lg">
              <Truck className="w-5 h-5 text-navy" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Fleet & Assets
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white border-blue-200 text-blue-700">
            Phase 4
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">
            {modeName} Fleet Manager
          </h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            Vehicle search & fleet management — arrives in Phase 4
          </p>
        </div>

        <div className="space-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-100/70">
            <Navigation className="w-3.5 h-3.5 text-slate-400" />
            <span>Realtime GPS Telematics (Phase 4)</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-100/70">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Multi-modal asset tracking (Phase 4)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
