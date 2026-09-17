import React, { useState, useEffect } from 'react';
import {
  Airport,
  Aircraft,
  FlightCrew,
  Flight,
  AirportSlotCheckResponse,
} from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { airwaysService } from '../services/airways';
import { Plane, Play, X, Compass, Clock, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateFlightMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  airports: Airport[];
  aircraft: Aircraft[];
  crew: FlightCrew[];
  flights: Flight[];
  onMovementCreated: () => void;
}

export const CreateFlightMovementModal: React.FC<CreateFlightMovementModalProps> = ({
  isOpen,
  onClose,
  airports,
  aircraft,
  crew,
  flights,
  onMovementCreated,
}) => {
  const [selectedAircraftId, setSelectedAircraftId] = useState('');
  const [selectedPilotId, setSelectedPilotId] = useState('');
  const [originAirportId, setOriginAirportId] = useState('');
  const [destinationAirportId, setDestinationAirportId] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [speedMultiplier, setSpeedMultiplier] = useState(60);
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slotCheck, setSlotCheck] = useState<AirportSlotCheckResponse | null>(null);
  const [isCheckingSlot, setIsCheckingSlot] = useState(false);

  // Auto-fill defaults
  useEffect(() => {
    if (isOpen) {
      if (!selectedAircraftId && aircraft.length > 0) {
        const idle = aircraft.find((a) => a.status === 'idle') || aircraft[0];
        setSelectedAircraftId(idle.id);
      }
      if (!selectedPilotId && crew.length > 0) {
        const avail = crew.find((c) => c.status === 'available') || crew[0];
        setSelectedPilotId(avail.id);
      }
      if (!originAirportId && airports.length > 0) {
        setOriginAirportId(airports[0].id);
      }
      if (!destinationAirportId && airports.length > 1) {
        setDestinationAirportId(airports[1].id);
      }
      setFlightNumber(`NW-${Math.floor(100 + Math.random() * 899)}`);
    }
  }, [isOpen, aircraft, crew, airports]);

  // Check airport slot capacity when origin/dest are selected
  useEffect(() => {
    if (originAirportId && destinationAirportId && originAirportId !== destinationAirportId) {
      setIsCheckingSlot(true);
      airwaysService
        .checkAirportSlots(originAirportId, destinationAirportId)
        .then((res) => {
          setSlotCheck(res);
          if (res.departureSlotCongested || res.arrivalSlotCongested) {
            toast.warning('Airport runway/apron slot congestion detected in proposed window.');
          }
        })
        .catch(() => setSlotCheck(null))
        .finally(() => setIsCheckingSlot(false));
    } else {
      setSlotCheck(null);
    }
  }, [originAirportId, destinationAirportId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAircraftId || !selectedPilotId || !originAirportId || !destinationAirportId) {
      toast.error('Please fill in all required flight dispatch fields.');
      return;
    }

    if (originAirportId === destinationAirportId) {
      toast.error('Origin and Destination airports must be distinct.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Create movement
      const movement = await airwaysService.createMovement({
        aircraftId: selectedAircraftId,
        pilotId: selectedPilotId,
        originAirportId,
        destinationAirportId,
        flightNumber: flightNumber.trim() || `NW-${Math.floor(100 + Math.random() * 899)}`,
        simulationSpeedMultiplier: Number(speedMultiplier),
      });

      // 2. If autoDispatch, immediately start flight movement simulation
      if (autoDispatch) {
        await airwaysService.updateMovementStatus(movement.id, 'in_transit');
        toast.success(`Flight ${movement.flight?.flight_number || flightNumber} dispatched on Great-Circle route!`);
      } else {
        toast.success(`Flight ${movement.flight?.flight_number || flightNumber} scheduled successfully!`);
      }

      onMovementCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch flight movement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const originAirport = airports.find((a) => a.id === originAirportId);
  const destAirport = airports.find((a) => a.id === destinationAirportId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-sky-500/5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  Dispatch Airways Flight Movement
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Real Great-Circle spherical trajectory calculation & Slot Intelligence
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {/* Flight Number */}
            <div className="space-y-1.5">
              <Label className="text-xs">Flight Number / Call-sign</Label>
              <input
                type="text"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="e.g. NW-701"
                className="w-full h-9 rounded-md border border-input bg-background px-3 font-mono text-xs font-semibold uppercase text-sky-400"
                required
              />
            </div>

            {/* Airport Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-sky-400" /> Origin Airport
                </Label>
                <select
                  value={originAirportId}
                  onChange={(e) => setOriginAirportId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                  required
                >
                  <option value="">Select origin...</option>
                  {airports.map((ap) => (
                    <option key={ap.id} value={ap.id}>
                      {ap.name} ({ap.iata_code || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400" /> Destination Airport
                </Label>
                <select
                  value={destinationAirportId}
                  onChange={(e) => setDestinationAirportId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                  required
                >
                  <option value="">Select destination...</option>
                  {airports.map((ap) => (
                    <option key={ap.id} value={ap.id} disabled={ap.id === originAirportId}>
                      {ap.name} ({ap.iata_code || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Airport Slot Intelligence Feedback */}
            {slotCheck && (
              <div
                data-testid="slot-check-feedback"
                className={`p-3 rounded-lg border text-xs space-y-1 ${
                  slotCheck.departureSlotCongested || slotCheck.arrivalSlotCongested
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {slotCheck.departureSlotCongested || slotCheck.arrivalSlotCongested ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>Airport Slot Congestion Warning (±60m Window)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Airport Runway & Apron Slots Clear</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] opacity-90">
                  {slotCheck.advisoryMessage}
                </div>
                {slotCheck.suggestedDepartureTime && (
                  <div className="text-[10px] font-mono mt-1 opacity-80">
                    Suggested alternate slot window: {new Date(slotCheck.suggestedDepartureTime).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}

            {/* Aircraft & Pilot */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5 text-sky-400" /> Assigned Aircraft
                </Label>
                <select
                  value={selectedAircraftId}
                  onChange={(e) => setSelectedAircraftId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                  required
                >
                  <option value="">Select aircraft...</option>
                  {aircraft.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {ac.tail_number} ({ac.aircraft_type}) - {ac.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Compass className="h-3.5 w-3.5 text-sky-400" /> Pilot in Command
                </Label>
                <select
                  value={selectedPilotId}
                  onChange={(e) => setSelectedPilotId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                  required
                >
                  <option value="">Select pilot...</option>
                  {crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user?.full_name || 'Pilot'} ({c.license_number}) - {c.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Speed Multiplier */}
            <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-sky-400" /> Simulation Speed
                </Label>
                <span className="font-mono text-xs font-semibold text-sky-400">
                  {speedMultiplier}x Real-time
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="120"
                step="5"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>1x (Real-time)</span>
                <span>30x</span>
                <span>60x (Fast)</span>
                <span>120x (Ultra)</span>
              </div>
            </div>

            {/* Auto Dispatch Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
              <div>
                <div className="font-medium text-xs text-foreground">Immediate Takeoff / Dispatch</div>
                <div className="text-[11px] text-muted-foreground">
                  Starts live flight telemetry along Great-Circle path immediately
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoDispatch}
                onChange={(e) => setAutoDispatch(e.target.checked)}
                className="h-4 w-4 accent-sky-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/10">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              {isSubmitting ? 'Dispatching...' : autoDispatch ? 'Dispatch Flight' : 'Schedule Flight'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
