import React, { useState, useEffect } from 'react';
import {
  FlightMovement,
  UserRole,
  LiveFlightTelemetryPayload,
  FlightMovementEtaResponse,
  CrewFlightScore,
  FlightDutyLog,
} from '@nexus-ways/shared';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Plane,
  MapPin,
  Clock,
  User,
  Play,
  CheckCircle2,
  X,
  Compass,
  ArrowRight,
  Package,
  ShieldCheck,
  Leaf,
  FileText,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { airwaysService } from '../services/airways';
import { toast } from 'sonner';

interface FlightMovementDetailsPanelProps {
  movement: FlightMovement;
  liveTelemetry?: LiveFlightTelemetryPayload;
  onClose: () => void;
  onRefresh: () => void;
  userRole?: UserRole;
}

export const FlightMovementDetailsPanel: React.FC<FlightMovementDetailsPanelProps> = ({
  movement,
  liveTelemetry,
  onClose,
  onRefresh,
  userRole,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOpeningReport, setIsOpeningReport] = useState(false);
  const [etaData, setEtaData] = useState<FlightMovementEtaResponse | null>(null);
  const [crewScores, setCrewScores] = useState<CrewFlightScore[]>([]);
  const [dutyLogs, setDutyLogs] = useState<FlightDutyLog[]>([]);
  const isManager = userRole === 'manager';

  useEffect(() => {
    // Load intelligence data
    if (movement.id) {
      airwaysService.getEta(movement.id).then(setEtaData).catch(() => null);
      airwaysService.getCrewScore(movement.id).then(setCrewScores).catch(() => null);
    }
    if (movement.pilot_id) {
      airwaysService.getDutyLogs(movement.pilot_id).then(setDutyLogs).catch(() => null);
    }
  }, [movement.id, movement.pilot_id, movement.status]);

  const handleStatusChange = async (newStatus: 'in_transit' | 'completed' | 'cancelled') => {
    try {
      setIsUpdating(true);
      await airwaysService.updateMovementStatus(movement.id, newStatus);
      toast.success(`Flight status updated to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update flight status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setIsOpeningReport(true);
      const res = await airwaysService.getReportUrl(movement.id);
      if (res.signedUrl) {
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('No signed PDF report URL returned');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch flight audit report');
    } finally {
      setIsOpeningReport(false);
    }
  };

  const altitudeFt = liveTelemetry?.altitudeFt ?? (movement.status === 'in_transit' ? 36000 : 0);
  const speedKts = liveTelemetry?.speedKts ?? (movement.status === 'in_transit' ? 460 : 0);
  const heading = liveTelemetry?.heading ?? 0;
  const progressPercent = liveTelemetry?.progressPercent ?? (movement.status === 'completed' ? 100 : 0);

  const latestScore = crewScores.length > 0 ? crewScores[0].score : (movement.crew_score?.score ?? 100);
  const latestDuty = dutyLogs.length > 0 ? dutyLogs[0] : null;

  return (
    <div
      className="absolute bottom-6 right-6 w-96 max-h-[85vh] z-20 overflow-y-auto animate-in fade-in slide-in-from-bottom-5"
      data-testid="flight-movement-details-panel"
    >
      <Card className="border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Header */}
        <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-sky-500/5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                {movement.flight?.flight_number || 'Flight Movement'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize border-sky-500/40 text-sky-400">
                  {movement.status.replace('_', ' ')}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {movement.routing_method || 'Great-Circle'}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4 text-xs">
          {/* Origin -> Destination Banner */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between font-semibold text-xs">
              <div className="flex items-center gap-1 text-sky-400">
                <MapPin className="h-3.5 w-3.5" />
                <span>{movement.flight?.origin_airport?.iata_code || 'DEP'}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                <span>{movement.distance_km ? `${movement.distance_km} km` : 'Great-Circle'}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-1 text-emerald-400">
                <MapPin className="h-3.5 w-3.5" />
                <span>{movement.flight?.destination_airport?.iata_code || 'ARR'}</span>
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="truncate max-w-[120px]">{movement.flight?.origin_airport?.name}</span>
              <span className="truncate max-w-[120px] text-right">{movement.flight?.destination_airport?.name}</span>
            </div>
          </div>

          {/* ETA Confidence Badge & Intelligence Card */}
          {etaData && (
            <div className="p-2.5 rounded-lg border border-sky-500/20 bg-sky-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Estimated Flight Duration
                </span>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${
                    etaData.confidence_basis === 'historical'
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                      : 'border-sky-500/40 text-sky-400 bg-sky-500/10'
                  }`}
                >
                  {etaData.confidence_basis === 'historical'
                    ? `Historical Sample (N=${etaData.sample_size})`
                    : 'Default Aviation Band (±15%)'}
                </Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-base font-bold text-sky-400">
                  {etaData.base_eta_minutes} min
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Range: {etaData.min_eta_minutes} - {etaData.max_eta_minutes} min (±{etaData.confidence_band_minutes}m)
                </span>
              </div>
            </div>
          )}

          {/* Live Flight Telemetry Box */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-border bg-card/60">
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">Altitude</div>
              <div className="font-mono font-bold text-xs text-sky-400">
                {altitudeFt.toLocaleString()} ft
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">Airspeed</div>
              <div className="font-mono font-bold text-xs text-sky-400">
                {speedKts} kts
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">Heading</div>
              <div className="font-mono font-bold text-xs text-foreground">
                {heading}°
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Flight Trajectory Progress</span>
              <span className="font-mono font-semibold text-foreground">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>

          {/* Pilot Score & DGCA FDTL Compliance */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg border border-border bg-card/40 space-y-1">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-sky-400" />
                Pilot Safety Score
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`font-mono text-base font-bold ${
                  latestScore >= 85 ? 'text-emerald-400' : latestScore >= 70 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {latestScore}
                </span>
                <span className="text-[10px] text-muted-foreground">/ 100</span>
              </div>
              <div className="text-[9px] text-muted-foreground">
                ICAO Annex 2 Rule
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-border bg-card/40 space-y-1">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" />
                DGCA FDTL Status
              </div>
              <div className="font-semibold text-xs text-foreground">
                {latestDuty?.violation ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Exceeded
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">Compliant</span>
                )}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {latestDuty ? `${latestDuty.duty_minutes}m in 24h` : 'Max 780m FDP'}
              </div>
            </div>
          </div>

          {/* Aviation Carbon Footprint */}
          <div className="p-2.5 rounded-lg border border-border bg-card/40 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                Air Freight Carbon Footprint:
              </span>
              <span className="font-mono font-bold text-foreground">
                {movement.carbon_kg ? `${movement.carbon_kg} kg CO₂e` : 'Calculated on dispatch'}
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground">
              GLEC v3.2: {movement.distance_km && movement.distance_km < 1500 ? '1.516 kg CO₂e/t-km (Short-Haul <1,500 km)' : '0.608 kg CO₂e/t-km (Long-Haul ≥1,500 km)'}
            </div>
          </div>

          {/* Aircraft & Crew Specs */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Plane className="h-3.5 w-3.5 text-sky-400" /> Aircraft:
              </span>
              <span className="font-medium text-foreground">
                {movement.aircraft?.tail_number} ({movement.aircraft?.aircraft_type})
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-sky-400" /> Pilot in Command:
              </span>
              <span className="font-medium text-foreground">
                {movement.pilot?.user?.full_name || 'Assigned Pilot'}
              </span>
            </div>

            {movement.aircraft?.cargo_capacity_kg && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-sky-400" /> Payload Capacity:
                </span>
                <span className="font-medium text-foreground">
                  {(movement.aircraft.cargo_capacity_kg / 1000).toFixed(1)} tonnes
                </span>
              </div>
            )}
          </div>

          {/* PDF Movement Audit Report Button */}
          {movement.status === 'completed' && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
                disabled={isOpeningReport}
                className="w-full text-xs h-8 gap-1.5 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                data-testid="flight-report-button"
              >
                {isOpeningReport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Opening Audit Ledger...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download Flight Audit PDF</span>
                    <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Action Buttons (Manager only) */}
          {isManager && (
            <div className="pt-2 border-t border-border flex flex-col gap-2">
              {movement.status === 'planned' && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange('in_transit')}
                  disabled={isUpdating}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white gap-1.5 text-xs h-8"
                >
                  <Play className="h-3.5 w-3.5" /> Takeoff / Dispatch Flight
                </Button>
              )}

              {movement.status === 'in_transit' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange('completed')}
                    disabled={isUpdating}
                    className="text-xs h-8 gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Land / Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={isUpdating}
                    className="text-xs h-8 gap-1"
                  >
                    <X className="h-3.5 w-3.5" /> Abort Flight
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
