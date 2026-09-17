import React, { useState, useEffect } from 'react';
import { TrainMovement, UserRole, TrainMovementEtaResponse } from '@nexus-ways/shared';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  TrainFront,
  MapPin,
  Clock,
  User,
  Zap,
  Play,
  CheckCircle2,
  X,
  Radio,
  Layers,
  Leaf,
  ShieldCheck,
  FileText,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { railwaysService } from '../services/railways';
import { LiveRailTelemetryPayload } from '../services/socket';
import { toast } from 'sonner';

interface MovementDetailsPanelProps {
  movement: TrainMovement;
  liveTelemetry?: LiveRailTelemetryPayload;
  onClose: () => void;
  onRefresh: () => void;
  userRole?: UserRole;
}

export const MovementDetailsPanel: React.FC<MovementDetailsPanelProps> = ({
  movement,
  liveTelemetry,
  onClose,
  onRefresh,
  userRole,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [etaData, setEtaData] = useState<TrainMovementEtaResponse | null>(null);
  const [loadingEta, setLoadingEta] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const isManager = userRole === 'manager';

  // Load ETA confidence
  useEffect(() => {
    if (movement?.id && (movement.status === 'in_transit' || movement.status === 'planned')) {
      setLoadingEta(true);
      railwaysService
        .getEta(movement.id)
        .then((res) => setEtaData(res))
        .catch(() => setEtaData(null))
        .finally(() => setLoadingEta(false));
    } else {
      setEtaData(null);
    }
  }, [movement?.id, movement?.status]);

  const handleStatusChange = async (newStatus: 'in_transit' | 'completed' | 'cancelled') => {
    try {
      setIsUpdating(true);
      await railwaysService.updateMovementStatus(movement.id, newStatus);
      toast.success(`Movement status updated to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update movement status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingReport(true);
      const res = await railwaysService.getReportUrl(movement.id);
      if (res?.signedUrl) {
        window.open(res.signedUrl, '_blank');
        toast.success('Rail movement audit PDF opened.');
      } else {
        toast.error('Unable to retrieve signed report URL.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load movement report');
    } finally {
      setDownloadingReport(false);
    }
  };

  const speedKmh = liveTelemetry?.speedKmh ?? (movement.status === 'in_transit' ? 75 : 0);
  const fuelType = movement.train?.locomotive?.fuel_type || 'electric';
  const emissionFactor = fuelType === 'diesel' ? 0.032 : 0.021;
  const distanceKm = movement.distance_km || 300;
  const cargoTonnes = 1500;
  const calculatedCarbonKg =
    movement.carbon_kg || Math.round(distanceKm * cargoTonnes * emissionFactor * 100) / 100;
  const roadEquivCarbonKg = Math.round(distanceKm * cargoTonnes * 0.101 * 100) / 100;
  const percentSavedVsRoad = Math.round(
    ((roadEquivCarbonKg - calculatedCarbonKg) / Math.max(1, roadEquivCarbonKg)) * 100,
  );

  const crewScore = movement.crew_score?.score ?? 100;
  const harshBrakes = movement.crew_score?.harsh_brake_count ?? 0;
  const overspeeds = movement.crew_score?.overspeed_event_count ?? 0;

  return (
    <Card className="w-80 h-full bg-slate-900 border-l border-slate-800 rounded-none flex flex-col text-slate-100 select-none shadow-2xl">
      {/* Header */}
      <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrainFront className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              {movement.train?.train_number || 'Movement'}
            </CardTitle>
            <p className="text-[11px] text-slate-400">{movement.train?.train_name || 'Rail Service'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Status & Live Telemetry Banner */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Movement Status</span>
            <Badge
              variant="outline"
              className={
                movement.status === 'in_transit'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse'
                  : movement.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }
            >
              {movement.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            <div>
              <span className="text-slate-500">Live Speed:</span>
              <p className="font-bold text-white flex items-center gap-1 mt-0.5">
                <Radio className="w-3 h-3 text-emerald-400" />
                {speedKmh} km/h
              </p>
            </div>
            <div>
              <span className="text-slate-500">Routing:</span>
              <p className="font-medium text-slate-300 mt-0.5">
                {movement.route_geometry?.routing_source || 'overpass'}
              </p>
            </div>
          </div>
        </div>

        {/* ETA Confidence Card */}
        {etaData && (
          <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-semibold flex items-center gap-1.5 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                Predictive ETA Confidence
              </span>
              <Badge
                variant="outline"
                className="text-[9px] bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
              >
                {etaData.confidence_basis === 'historical'
                  ? `Historical (N=${etaData.sample_size})`
                  : 'Default (±15%)'}
              </Badge>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-lg font-bold text-white">{etaData.base_eta_minutes} min</span>
              <span className="text-[11px] text-cyan-300">
                Range: {etaData.min_eta_minutes} – {etaData.max_eta_minutes} min (±
                {etaData.confidence_band_minutes}m)
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Remaining: ~{etaData.remaining_distance_km} km to destination station
            </p>
          </div>
        )}

        {/* Crew Behavior Score */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Loco Pilot Crew Score
            </span>
            <span
              className={`font-bold text-sm ${
                crewScore >= 85 ? 'text-emerald-400' : crewScore >= 70 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {crewScore} / 100
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <div>
              <span>Harsh Brakes:</span>
              <p className="font-semibold text-slate-200">{harshBrakes} event(s)</p>
            </div>
            <div>
              <span>Overspeed (&gt;100 km/h):</span>
              <p className="font-semibold text-slate-200">{overspeeds} event(s)</p>
            </div>
          </div>
        </div>

        {/* Environmental Intelligence */}
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
              <Leaf className="w-3.5 h-3.5" />
              Rail Carbon Intelligence
            </span>
            <Badge
              variant="outline"
              className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30 uppercase"
            >
              {fuelType} Rail
            </Badge>
          </div>
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-base font-bold text-white">{calculatedCarbonKg} kg CO₂e</span>
            <span className="text-[10.5px] font-semibold text-emerald-400">
              {percentSavedVsRoad}% cleaner vs road
            </span>
          </div>
          <p className="text-[9.5px] text-slate-400">
            GLEC Framework v3.0 ({emissionFactor} kg CO₂e/t-km vs Road 0.101 kg/t-km)
          </p>
        </div>

        {/* Route Details */}
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-200 text-xs">Station Corridor</h3>
          <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] text-slate-500 font-medium">Origin Station</span>
                <p className="font-semibold text-white">{movement.origin_station?.name}</p>
                <p className="text-[10px] text-slate-500">
                  {movement.origin_station?.lat?.toFixed(4)}, {movement.origin_station?.lng?.toFixed(4)}
                </p>
              </div>
            </div>

            <div className="border-l-2 border-dashed border-slate-700 ml-2 pl-3 py-1 space-y-1">
              <span className="text-[10px] text-slate-400">
                Track Distance: {movement.distance_km || 0} km • Est. Time: {movement.duration_minutes || 0} min
              </span>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] text-slate-500 font-medium">Destination Station</span>
                <p className="font-semibold text-white">{movement.destination_station?.name}</p>
                <p className="text-[10px] text-slate-500">
                  {movement.destination_station?.lat?.toFixed(4)}, {movement.destination_station?.lng?.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Train & Crew Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-200 text-xs">Rolling Stock & Crew</h3>
          <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Locomotive
              </span>
              <span className="font-medium text-white">
                {movement.train?.locomotive?.loco_number || 'Standard Power'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Rake
              </span>
              <span className="font-medium text-white">
                {movement.train?.rake?.rake_id || 'Standard'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Loco Pilot
              </span>
              <span className="font-medium text-white">
                {movement.loco_pilot?.user?.full_name || 'Loco Pilot'}
              </span>
            </div>
          </div>
        </div>

        {/* PDF Movement Audit Report */}
        {movement.status === 'completed' && (
          <Button
            onClick={handleDownloadPdf}
            disabled={downloadingReport}
            className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 gap-2 h-9"
          >
            <FileText className="w-4 h-4" />
            {downloadingReport ? 'Opening Report...' : 'View Rail Audit PDF'}
          </Button>
        )}

        {/* Manager Action Buttons */}
        {isManager && (
          <div className="pt-2 space-y-2">
            {movement.status === 'planned' && (
              <Button
                onClick={() => handleStatusChange('in_transit')}
                disabled={isUpdating}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white gap-1.5 h-9"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Train Movement
              </Button>
            )}

            {movement.status === 'in_transit' && (
              <Button
                onClick={() => handleStatusChange('completed')}
                disabled={isUpdating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 h-9"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Completed
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
