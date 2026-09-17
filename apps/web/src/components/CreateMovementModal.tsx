import React, { useState, useEffect } from 'react';
import {
  Station,
  Train,
  LocoPilot,
  SavedRailRoute,
  CreateTrainMovementDto,
  RailSlotCheckResponse,
} from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { railwaysService } from '../services/railways';
import { TrainFront, MapPin, History, Play, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CreateMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  stations: Station[];
  trains: Train[];
  locoPilots: LocoPilot[];
  savedRoutes: SavedRailRoute[];
  onMovementCreated: () => void;
}

export const CreateMovementModal: React.FC<CreateMovementModalProps> = ({
  isOpen,
  onClose,
  stations,
  trains,
  locoPilots,
  savedRoutes,
  onMovementCreated,
}) => {
  const [selectedTrainId, setSelectedTrainId] = useState('');
  const [selectedPilotId, setSelectedPilotId] = useState('');
  const [originStationId, setOriginStationId] = useState('');
  const [destinationStationId, setDestinationStationId] = useState('');
  const [speedMultiplier, setSpeedMultiplier] = useState(60);
  const [proposedDeparture, setProposedDeparture] = useState(new Date().toISOString().slice(0, 16));
  const [slotStatus, setSlotStatus] = useState<RailSlotCheckResponse | null>(null);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill first available options
  useEffect(() => {
    if (isOpen) {
      if (!selectedTrainId && trains.length > 0) {
        const idle = trains.find((t) => t.status === 'idle') || trains[0];
        setSelectedTrainId(idle.id);
      }
      if (!selectedPilotId && locoPilots.length > 0) {
        const avail = locoPilots.find((p) => p.status === 'available') || locoPilots[0];
        setSelectedPilotId(avail.id);
      }
      if (!originStationId && stations.length > 0) {
        setOriginStationId(stations[0].id);
      }
      if (!destinationStationId && stations.length > 1) {
        setDestinationStationId(stations[1].id);
      }
      setProposedDeparture(new Date().toISOString().slice(0, 16));
    }
  }, [isOpen, trains, locoPilots, stations]);

  // Slot Intelligence Check whenever station pair or departure time changes
  useEffect(() => {
    if (originStationId && destinationStationId && originStationId !== destinationStationId) {
      setCheckingSlot(true);
      railwaysService
        .checkSlot(originStationId, destinationStationId, new Date(proposedDeparture).toISOString())
        .then((res) => setSlotStatus(res))
        .catch(() => setSlotStatus(null))
        .finally(() => setCheckingSlot(false));
    } else {
      setSlotStatus(null);
    }
  }, [originStationId, destinationStationId, proposedDeparture]);

  if (!isOpen) return null;

  // Check if matching saved rail route exists
  const matchingSavedRoute = savedRoutes.find(
    (r) => r.origin_station_id === originStationId && r.destination_station_id === destinationStationId,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainId || !selectedPilotId || !originStationId || !destinationStationId) {
      toast.error('Please fill in all required movement fields.');
      return;
    }

    if (originStationId === destinationStationId) {
      toast.error('Origin and Destination stations must be different.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: CreateTrainMovementDto = {
        trainId: selectedTrainId,
        locoPilotId: selectedPilotId,
        originStationId,
        destinationStationId,
        simulationSpeedMultiplier: Number(speedMultiplier),
        proposedDeparture: new Date(proposedDeparture).toISOString(),
      };

      await railwaysService.createMovement(payload);
      toast.success('Train movement dispatched successfully!');
      onMovementCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch train movement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplySuggestedSlot = (suggestedIso: string) => {
    const formatted = new Date(suggestedIso).toISOString().slice(0, 16);
    setProposedDeparture(formatted);
    toast.info(`Updated departure slot to ${new Date(suggestedIso).toLocaleTimeString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrainFront className="w-5 h-5 text-emerald-400" />
            Dispatch Train Movement
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs overflow-y-auto">
          {/* Saved Route Match Banner */}
          {matchingSavedRoute && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-start gap-2.5">
              <History className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-300">Cached Rail Geometry Found</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    {matchingSavedRoute.routing_source}
                  </Badge>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Estimated: {matchingSavedRoute.route_geometry?.distance_km} km (Used {matchingSavedRoute.usage_count} times)
                </p>
              </div>
            </div>
          )}

          {/* Slot Intelligence Banner */}
          {slotStatus && (
            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                slotStatus.congested
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {slotStatus.congested ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px]">
                    {slotStatus.congested ? 'Slot Intelligence: Congestion Warning' : 'Slot Intelligence: Track Clear'}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      slotStatus.congested
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {slotStatus.overlapCount} movement(s) active
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{slotStatus.reason}</p>
                {slotStatus.congested && slotStatus.suggestedDeparture && (
                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-amber-500/20">
                    <span className="text-[10.5px] text-amber-300">
                      Suggested Slot: <strong>{new Date(slotStatus.suggestedDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplySuggestedSlot(slotStatus.suggestedDeparture!)}
                      className="h-6 text-[10px] bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30"
                    >
                      Apply Suggested Slot
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Train Selection */}
          <div className="space-y-1.5">
            <Label>Train Service</Label>
            <select
              required
              value={selectedTrainId}
              onChange={(e) => setSelectedTrainId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white text-xs"
            >
              <option value="">Select Train Composition</option>
              {trains.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.train_number} {t.train_name ? `(${t.train_name})` : ''} - Status: {t.status}
                </option>
              ))}
            </select>
          </div>

          {/* Loco Pilot Selection */}
          <div className="space-y-1.5">
            <Label>Loco Pilot (Crew)</Label>
            <select
              required
              value={selectedPilotId}
              onChange={(e) => setSelectedPilotId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white text-xs"
            >
              <option value="">Assign Loco Pilot</option>
              {locoPilots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user?.full_name} ({p.license_number}) - {p.status}
                </option>
              ))}
            </select>
          </div>

          {/* Station Pair */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-emerald-400">
                <MapPin className="w-3.5 h-3.5" />
                Origin Station
              </Label>
              <select
                required
                value={originStationId}
                onChange={(e) => setOriginStationId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white text-xs"
              >
                <option value="">Select Origin</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.station_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-amber-400">
                <MapPin className="w-3.5 h-3.5" />
                Destination Station
              </Label>
              <select
                required
                value={destinationStationId}
                onChange={(e) => setDestinationStationId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white text-xs"
              >
                <option value="">Select Destination</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.station_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Proposed Departure Time */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-cyan-400">
              <Clock className="w-3.5 h-3.5" />
              Proposed Departure Slot
            </Label>
            <input
              type="datetime-local"
              value={proposedDeparture}
              onChange={(e) => setProposedDeparture(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white text-xs"
            />
          </div>

          {/* Simulation Speed */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label>Live Simulation Speed Multiplier</Label>
              <span className="font-bold text-emerald-400">{speedMultiplier}x</span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={10}
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              60x: 1 minute of real time simulates 1 hour of train progress along the track geometry.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isSubmitting ? 'Routing & Dispatching...' : 'Dispatch Movement'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
