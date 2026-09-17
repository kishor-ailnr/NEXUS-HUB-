import React, { useState, useEffect } from 'react';
import { Vehicle, Driver, CheckpointItem, Trip, SavedRoute } from '@nexus-ways/shared';
import { tripsService } from '../services/trips';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Route,
  MapPin,
  Truck,
  User,
  Plus,
  Trash2,
  Zap,
  Sparkles,
  Navigation,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  drivers: Driver[];
  preselectedVehicle?: Vehicle | null;
  onTripCreated: (trip: Trip) => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  drivers,
  preselectedVehicle,
  onTripCreated,
}) => {
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [originAddress, setOriginAddress] = useState('Mumbai Hub, JNPT Port');
  const [destAddress, setDestAddress] = useState('Pune Warehouse, Chakan MIDC');
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [speedMultiplier, setSpeedMultiplier] = useState(60);
  const [suggestedRoute, setSuggestedRoute] = useState<SavedRoute | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New checkpoint inline form
  const [newCpLabel, setNewCpLabel] = useState('');
  const [newCpLat, setNewCpLat] = useState('');
  const [newCpLng, setNewCpLng] = useState('');

  useEffect(() => {
    if (preselectedVehicle) {
      setVehicleId(preselectedVehicle.id);
      if (preselectedVehicle.assigned_driver_id) {
        setDriverId(preselectedVehicle.assigned_driver_id);
      }
    } else if (vehicles.length > 0 && !vehicleId) {
      const firstAvailable = vehicles.find((v) => v.status === 'idle') || vehicles[0];
      setVehicleId(firstAvailable.id);
      if (firstAvailable.assigned_driver_id) {
        setDriverId(firstAvailable.assigned_driver_id);
      }
    }
  }, [preselectedVehicle, vehicles]);

  // Update default driver when vehicle changes
  const handleVehicleChange = (vId: string) => {
    setVehicleId(vId);
    const selected = vehicles.find((v) => v.id === vId);
    if (selected?.assigned_driver_id) {
      setDriverId(selected.assigned_driver_id);
    }
  };

  // Checkpoint Memory: Search saved routes when origin & destination change
  useEffect(() => {
    if (!originAddress.trim() || !destAddress.trim()) {
      setSuggestedRoute(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const routes = await tripsService.getSavedRoutes(originAddress.trim(), destAddress.trim());
        if (routes && routes.length > 0 && routes[0].checkpoints && routes[0].checkpoints.length > 0) {
          setSuggestedRoute(routes[0]);
        } else {
          setSuggestedRoute(null);
        }
      } catch {
        setSuggestedRoute(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [originAddress, destAddress]);

  const handleApplySuggestedCheckpoints = () => {
    if (suggestedRoute && suggestedRoute.checkpoints) {
      setCheckpoints([...suggestedRoute.checkpoints]);
      toast.success(`Applied ${suggestedRoute.checkpoints.length} saved checkpoints from Route Memory`);
      setSuggestedRoute(null);
    }
  };

  const handleAddCheckpoint = () => {
    if (!newCpLabel.trim()) {
      toast.error('Checkpoint label is required');
      return;
    }

    const lat = newCpLat ? parseFloat(newCpLat) : 18.75;
    const lng = newCpLng ? parseFloat(newCpLng) : 73.4;

    setCheckpoints((prev) => [...prev, { label: newCpLabel.trim(), lat, lng }]);
    setNewCpLabel('');
    setNewCpLat('');
    setNewCpLng('');
  };

  const handleRemoveCheckpoint = (index: number) => {
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicleId || !driverId || !originAddress.trim() || !destAddress.trim()) {
      toast.error('Please fill in vehicle, driver, origin, and destination.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Create trip (calls real OSRM and saved_routes)
      const newTrip = await tripsService.createTrip({
        vehicleId,
        driverId,
        originAddress: originAddress.trim(),
        destinationAddress: destAddress.trim(),
        checkpoints,
        simulationSpeedMultiplier: speedMultiplier,
      });

      // 2. Start trip immediately for live simulation
      const startedTrip = await tripsService.updateStatus(newTrip.id, 'in_transit');

      toast.success(`Trip started! Simulated live tracking active (${speedMultiplier}x speed).`);
      onTripCreated(startedTrip);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Create & Dispatch Roadway Trip</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateAndStart} className="space-y-4 text-xs">
          {/* Vehicle & Driver Assignment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Select Vehicle *
              </label>
              <select
                required
                value={vehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-2.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                data-testid="trip-vehicle-select"
              >
                <option value="">-- Choose Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Select Driver *
              </label>
              <select
                required
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-2.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="trip-driver-select"
              >
                <option value="">-- Choose Driver --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user?.full_name || d.license_number} ({d.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Origin Address *
              </label>
              <Input
                required
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="e.g. Mumbai Hub, Maharashtra"
                className="text-xs h-8 bg-white"
                data-testid="trip-origin-input"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <Navigation className="w-3.5 h-3.5 text-red-500" />
                Destination Address *
              </label>
              <Input
                required
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                placeholder="e.g. Pune Logistics Park, Chakan"
                className="text-xs h-8 bg-white"
                data-testid="trip-dest-input"
              />
            </div>
          </div>

          {/* Checkpoint Memory Banner */}
          {suggestedRoute && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Checkpoint Memory Found ({suggestedRoute.checkpoints.length} saved waypoints)</span>
                </div>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[10px] border-amber-300">
                  Used {suggestedRoute.usage_count}x
                </Badge>
              </div>
              <p className="text-[11px] text-amber-800">
                Previous trips on this route used checkpoints: <em>{suggestedRoute.checkpoints.map((c) => c.label).join(', ')}</em>
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSuggestedRoute(null)}
                  className="h-7 text-[11px] text-slate-600"
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplySuggestedCheckpoints}
                  className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="apply-checkpoint-memory"
                >
                  Apply Remembered Checkpoints
                </Button>
              </div>
            </div>
          )}

          {/* Intermediate Checkpoints */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-700 block">
              Intermediate Checkpoints ({checkpoints.length})
            </label>

            {checkpoints.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {checkpoints.map((cp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-100 border border-slate-200"
                  >
                    <span className="font-medium text-slate-800">
                      {idx + 1}. {cp.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCheckpoint(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Checkpoint Inputs */}
            <div className="flex gap-2">
              <Input
                placeholder="Checkpoint label (e.g. Lonavala Toll)"
                value={newCpLabel}
                onChange={(e) => setNewCpLabel(e.target.value)}
                className="text-xs h-8 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCheckpoint}
                className="h-8 gap-1 text-blue-600 border-blue-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </Button>
            </div>
          </div>

          {/* Simulation Speed Slider */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                Simulation Speed Multiplier
              </span>
              <span className="font-bold text-blue-600 font-mono text-sm">
                {speedMultiplier}&times; Real-Time
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              step="5"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1x (Real-time)</span>
              <span>60x (1h trip in 1 min)</span>
              <span>120x (Fast demo)</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 px-4"
              data-testid="create-trip-submit"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Routing with OSRM...' : 'Dispatch & Start Simulation'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
