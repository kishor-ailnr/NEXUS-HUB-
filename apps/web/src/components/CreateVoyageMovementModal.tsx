import React, { useState, useEffect } from 'react';
import {
  Port,
  Vessel,
  SeaCrew,
  Voyage,
  PortSlotCheckResponse,
} from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { seawaysService } from '../services/seaways';
import { Ship, Play, X, Compass, Clock, Anchor, AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateVoyageMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  ports: Port[];
  vessels: Vessel[];
  crew: SeaCrew[];
  voyages: Voyage[];
  onMovementCreated: () => void;
}

export const CreateVoyageMovementModal: React.FC<CreateVoyageMovementModalProps> = ({
  isOpen,
  onClose,
  ports,
  vessels,
  crew,
  voyages,
  onMovementCreated,
}) => {
  const [selectedVesselId, setSelectedVesselId] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [originPortId, setOriginPortId] = useState('');
  const [destinationPortId, setDestinationPortId] = useState('');
  const [voyageNumber, setVoyageNumber] = useState('');
  const [speedMultiplier, setSpeedMultiplier] = useState(60);
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slotCheck, setSlotCheck] = useState<PortSlotCheckResponse | null>(null);
  const [isCheckingSlot, setIsCheckingSlot] = useState(false);

  // Auto-fill defaults
  useEffect(() => {
    if (isOpen) {
      if (!selectedVesselId && vessels.length > 0) {
        const idle = vessels.find((v) => v.status === 'idle') || vessels[0];
        setSelectedVesselId(idle.id);
      }
      if (!selectedMasterId && crew.length > 0) {
        const avail = crew.find((c) => c.status === 'available') || crew[0];
        setSelectedMasterId(avail.id);
      }
      if (!originPortId && ports.length > 0) {
        setOriginPortId(ports[0].id);
      }
      if (!destinationPortId && ports.length > 1) {
        setDestinationPortId(ports[1].id);
      }
      setVoyageNumber(`VOY-${Math.floor(100 + Math.random() * 899)}`);
    }
  }, [isOpen, vessels, crew, ports]);

  // Check port berth slot capacity when origin/dest are selected
  useEffect(() => {
    if (originPortId && destinationPortId && originPortId !== destinationPortId) {
      setIsCheckingSlot(true);
      seawaysService
        .checkPortSlots(originPortId, destinationPortId)
        .then((res) => {
          setSlotCheck(res);
          if (res.originSlotCongested || res.destinationSlotCongested) {
            toast.warning('Port berth & fairway slot congestion detected in proposed window.');
          }
        })
        .catch(() => setSlotCheck(null))
        .finally(() => setIsCheckingSlot(false));
    } else {
      setSlotCheck(null);
    }
  }, [originPortId, destinationPortId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVesselId || !selectedMasterId || !originPortId || !destinationPortId) {
      toast.error('Please fill in all required voyage dispatch fields.');
      return;
    }

    if (originPortId === destinationPortId) {
      toast.error('Origin and Destination ports must be distinct.');
      return;
    }

    try {
      setIsSubmitting(true);

      const movement = await seawaysService.createMovement({
        vessel_id: selectedVesselId,
        master_id: selectedMasterId,
        origin_port_id: originPortId,
        destination_port_id: destinationPortId,
        voyage_number: voyageNumber.trim(),
        simulation_speed_multiplier: speedMultiplier,
      });

      if (autoDispatch && movement?.id) {
        await seawaysService.updateMovementStatus(movement.id, 'in_transit');
        toast.success(`Voyage ${voyageNumber} created & dispatched into transit along land-avoiding sea route!`);
      } else {
        toast.success(`Voyage ${voyageNumber} scheduled successfully.`);
      }

      onMovementCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch voyage movement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOrigin = ports.find((p) => p.id === originPortId);
  const selectedDest = ports.find((p) => p.id === destinationPortId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Dispatch Voyage Movement</h2>
              <p className="text-xs text-slate-400">Land-Avoiding Sea Routing & Maritime Telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Voyage Number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">Voyage Call Sign / Number</Label>
            <input
              type="text"
              required
              className="w-full h-9 bg-slate-950 border border-slate-700 rounded-lg px-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              value={voyageNumber}
              onChange={(e) => setVoyageNumber(e.target.value)}
              placeholder="e.g. VOY-104"
            />
          </div>

          {/* Origin & Destination Ports */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                Origin Port
              </Label>
              <select
                className="w-full h-9 bg-slate-950 border border-slate-700 rounded-lg px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                value={originPortId}
                onChange={(e) => setOriginPortId(e.target.value)}
              >
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.unlocode ? `(${p.unlocode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                Destination Port
              </Label>
              <select
                className="w-full h-9 bg-slate-950 border border-slate-700 rounded-lg px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                value={destinationPortId}
                onChange={(e) => setDestinationPortId(e.target.value)}
              >
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.unlocode ? `(${p.unlocode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Port Berth Slot Intelligence Card */}
          {isCheckingSlot && (
            <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Analyzing Port Berth & Fairway Traffic Density...</span>
            </div>
          )}

          {slotCheck && !isCheckingSlot && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                slotCheck.congested
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                  : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  {slotCheck.congested ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {slotCheck.congested ? 'Port Berth Congestion Alert' : 'Berth & Fairway Slots Available'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                  {slotCheck.originSlotCount} dep / {slotCheck.destinationSlotCount} arr ops
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {slotCheck.reason || 'Sufficient berth capacity and fairway clearance at both ports.'}
              </p>
              {slotCheck.suggestedDeparture && (
                <div className="text-[11px] text-amber-300 font-mono pt-1 border-t border-amber-500/20">
                  Suggested Clear Slot: {new Date(slotCheck.suggestedDeparture).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {/* Land-Avoiding Marine Route Banner */}
          {selectedOrigin && selectedDest && selectedOrigin.id !== selectedDest.id && (
            <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-950/20 text-xs text-sky-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-sky-400">
                <Compass className="w-3.5 h-3.5" />
                Land-Avoiding Maritime Routing Active
              </div>
              <div className="text-[11px] text-slate-300">
                Route: <span className="text-white">{selectedOrigin.name}</span> →{' '}
                <span className="text-white">{selectedDest.name}</span> via verified open-water shipping lanes
                (avoids peninsular land crossing around Cape Comorin / Sri Lanka TSS).
              </div>
            </div>
          )}

          {/* Vessel & Master Select */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Vessel</Label>
              <select
                className="w-full h-9 bg-slate-950 border border-slate-700 rounded-lg px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                value={selectedVesselId}
                onChange={(e) => setSelectedVesselId(e.target.value)}
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vessel_name} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Master / Captain</Label>
              <select
                className="w-full h-9 bg-slate-950 border border-slate-700 rounded-lg px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                value={selectedMasterId}
                onChange={(e) => setSelectedMasterId(e.target.value)}
              >
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.user?.full_name || 'Crew Member'} ({c.crew_role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Simulation Speed Multiplier */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-300">Simulation Speed Multiplier</span>
              <span className="text-blue-400 font-bold">{speedMultiplier}x Realtime</span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              step="5"
              className="w-full accent-blue-500 cursor-pointer"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1x (Real speed)</span>
              <span>60x (1 min = 1 hour)</span>
              <span>120x (Fast)</span>
            </div>
          </div>

          {/* Auto-dispatch checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={autoDispatch}
                onChange={(e) => setAutoDispatch(e.target.checked)}
                className="rounded accent-blue-600 w-4 h-4"
              />
              <span>Immediately dispatch into transit (start simulation)</span>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {isSubmitting ? 'Dispatching...' : 'Confirm & Dispatch Voyage'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
