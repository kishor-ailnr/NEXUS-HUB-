import React, { useState } from 'react';
import {
  Train,
  Station,
  Locomotive,
  Rake,
  LocoPilot,
  TrainMovement,
  UserRole,
} from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  Search,
  Plus,
  TrainFront,
  MapPin,
  Flame,
  Layers,
  UserCheck,
  Zap,
  Radio,
  Play,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { railwaysService } from '../services/railways';

interface RailwaysSidebarProps {
  trains: Train[];
  stations: Station[];
  locomotives: Locomotive[];
  rakes: Rake[];
  locoPilots: LocoPilot[];
  movements: TrainMovement[];
  selectedTrainId: string | null;
  onSelectTrain: (trainId: string) => void;
  selectedMovementId: string | null;
  onSelectMovement: (movementId: string) => void;
  userRole?: UserRole;
  onRefresh: () => void;
  onOpenCreateMovement: () => void;
}

export const RailwaysSidebar: React.FC<RailwaysSidebarProps> = ({
  trains,
  stations,
  locomotives,
  rakes,
  locoPilots,
  movements,
  selectedTrainId,
  onSelectTrain,
  selectedMovementId,
  onSelectMovement,
  userRole,
  onRefresh,
  onOpenCreateMovement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'trains' | 'movements' | 'stations' | 'locos' | 'rakes' | 'pilots'>('trains');

  // Modal states
  const [isAddTrainOpen, setIsAddTrainOpen] = useState(false);
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [isAddLocoOpen, setIsAddLocoOpen] = useState(false);
  const [isAddRakeOpen, setIsAddRakeOpen] = useState(false);
  const [isAddPilotOpen, setIsAddPilotOpen] = useState(false);

  // Form states
  const [newTrainNumber, setNewTrainNumber] = useState('');
  const [newTrainName, setNewTrainName] = useState('');
  const [newTrainLocoId, setNewTrainLocoId] = useState('');
  const [newTrainRakeId, setNewTrainRakeId] = useState('');

  const [newStationName, setNewStationName] = useState('');
  const [newStationCode, setNewStationCode] = useState('');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationType, setNewStationType] = useState<'station' | 'yard' | 'junction'>('station');

  const [newLocoNumber, setNewLocoNumber] = useState('');
  const [newLocoType, setNewLocoType] = useState('WAP-7 Electric');
  const [newLocoFuel, setNewLocoFuel] = useState<'electric' | 'diesel'>('electric');
  const [newLocoPower, setNewLocoPower] = useState(4500);

  const [newRakeId, setNewRakeId] = useState('');
  const [newRakeCoachCount, setNewRakeCoachCount] = useState(16);

  const [newPilotName, setNewPilotName] = useState('');
  const [newPilotEmail, setNewPilotEmail] = useState('');
  const [newPilotLicense, setNewPilotLicense] = useState('');
  const [newPilotPhone, setNewPilotPhone] = useState('');

  const isManager = userRole === 'manager';

  const filteredTrains = trains.filter(
    (t) =>
      t.train_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.train_name && t.train_name.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const filteredMovements = movements.filter(
    (m) =>
      m.train?.train_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.origin_station?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.destination_station?.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await railwaysService.createTrain({
        train_number: newTrainNumber,
        train_name: newTrainName || undefined,
        locomotive_id: newTrainLocoId || undefined,
        rake_id: newTrainRakeId || undefined,
      });
      toast.success(`Train ${newTrainNumber} created successfully`);
      setIsAddTrainOpen(false);
      setNewTrainNumber('');
      setNewTrainName('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create train');
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await railwaysService.createStation({
        name: newStationName,
        station_code: newStationCode || undefined,
        address: newStationAddress || undefined,
        station_type: newStationType,
      });
      toast.success(`Station ${newStationName} added and geocoded`);
      setIsAddStationOpen(false);
      setNewStationName('');
      setNewStationCode('');
      setNewStationAddress('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add station');
    }
  };

  const handleCreateLoco = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await railwaysService.createLocomotive({
        loco_number: newLocoNumber,
        loco_type: newLocoType,
        fuel_type: newLocoFuel,
        power_kw: Number(newLocoPower),
      });
      toast.success(`Locomotive ${newLocoNumber} registered`);
      setIsAddLocoOpen(false);
      setNewLocoNumber('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add locomotive');
    }
  };

  const handleCreateRake = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await railwaysService.createRake({
        rake_id: newRakeId,
        composition: [{ type: 'coach', count: Number(newRakeCoachCount) }],
      });
      toast.success(`Rake ${newRakeId} created`);
      setIsAddRakeOpen(false);
      setNewRakeId('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rake');
    }
  };

  const handleCreatePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await railwaysService.createLocoPilot({
        fullName: newPilotName,
        email: newPilotEmail,
        licenseNumber: newPilotLicense,
        phone: newPilotPhone || undefined,
      });
      toast.success(`Loco Pilot ${newPilotName} registered`);
      setIsAddPilotOpen(false);
      setNewPilotName('');
      setNewPilotEmail('');
      setNewPilotLicense('');
      setNewPilotPhone('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register loco pilot');
    }
  };

  return (
    <div className="w-80 h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrainFront className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">Rail Operations</h2>
              <p className="text-xs text-slate-400">Fixed Track Infrastructure</p>
            </div>
          </div>
          {isManager && (
            <Button
              size="sm"
              onClick={onOpenCreateMovement}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-2.5 gap-1.5 shadow-sm shadow-emerald-950"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Dispatch
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search trains, stations..."
            className="pl-9 bg-slate-950 border-slate-800 text-xs text-white placeholder:text-slate-500 h-9"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('trains')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'trains'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trains ({trains.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'movements'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Movements ({movements.length})
          </button>
          <button
            onClick={() => setActiveTab('stations')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'stations'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Stations ({stations.length})
          </button>
          <button
            onClick={() => setActiveTab('locos')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'locos'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Locos ({locomotives.length})
          </button>
          <button
            onClick={() => setActiveTab('rakes')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'rakes'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rakes ({rakes.length})
          </button>
          <button
            onClick={() => setActiveTab('pilots')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'pilots'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pilots ({locoPilots.length})
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* TRAINS TAB */}
        {activeTab === 'trains' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddTrainOpen(true)}
                className="w-full justify-center gap-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-950/40 text-slate-300 hover:text-white h-9 text-xs mb-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Train Composition
              </Button>
            )}

            {filteredTrains.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No trains found.</div>
            ) : (
              filteredTrains.map((train) => {
                const isSelected = selectedTrainId === train.id;
                return (
                  <Card
                    key={train.id}
                    onClick={() => onSelectTrain(train.id)}
                    className={`cursor-pointer transition-all duration-150 border text-xs ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm shadow-emerald-950'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white tracking-wide text-sm flex items-center gap-1.5">
                          <TrainFront className="w-4 h-4 text-emerald-400" />
                          {train.train_number}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            train.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : train.status === 'maintenance'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }
                        >
                          {train.status}
                        </Badge>
                      </div>

                      {train.train_name && (
                        <p className="text-slate-300 font-medium truncate">{train.train_name}</p>
                      )}

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                        <div>
                          <span className="text-slate-500">Loco:</span>{' '}
                          {train.locomotive?.loco_number || 'Unassigned'}
                        </div>
                        <div>
                          <span className="text-slate-500">Rake:</span>{' '}
                          {train.rake?.rake_id || 'Standard'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* MOVEMENTS TAB */}
        {activeTab === 'movements' && (
          <div className="space-y-2">
            {filteredMovements.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No train movements.</div>
            ) : (
              filteredMovements.map((mov) => {
                const isSelected = selectedMovementId === mov.id;
                return (
                  <Card
                    key={mov.id}
                    onClick={() => onSelectMovement(mov.id)}
                    className={`cursor-pointer transition-all duration-150 border text-xs ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm shadow-emerald-950'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white tracking-wide text-sm flex items-center gap-1.5">
                          <TrainFront className="w-4 h-4 text-emerald-400" />
                          {mov.train?.train_number || 'Train'}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            mov.status === 'in_transit'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse'
                              : mov.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }
                        >
                          {mov.status}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-slate-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-400">From:</span> {mov.origin_station?.name}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-slate-400">To:</span> {mov.destination_station?.name}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                        <span>{mov.distance_km || 0} km</span>
                        <span>{mov.duration_minutes || 0} min</span>
                        <span>{mov.loco_pilot?.user?.full_name || 'Pilot'}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* STATIONS TAB */}
        {activeTab === 'stations' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddStationOpen(true)}
                className="w-full justify-center gap-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-950/40 text-slate-300 hover:text-white h-9 text-xs mb-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Railway Station / Yard
              </Button>
            )}

            {stations.map((st) => (
              <div
                key={st.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {st.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                    {st.station_type}
                  </Badge>
                </div>
                {st.station_code && (
                  <p className="text-slate-400 text-[11px]">Code: {st.station_code}</p>
                )}
                <div className="text-[11px] text-slate-500">
                  {st.lat?.toFixed(4)}, {st.lng?.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LOCOMOTIVES TAB */}
        {activeTab === 'locos' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddLocoOpen(true)}
                className="w-full justify-center gap-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-950/40 text-slate-300 hover:text-white h-9 text-xs mb-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Register Locomotive
              </Button>
            )}

            {locomotives.map((loco) => (
              <div
                key={loco.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    {loco.loco_number}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                    {loco.fuel_type}
                  </Badge>
                </div>
                <p className="text-slate-300 text-[11px]">{loco.loco_type}</p>
                <p className="text-slate-500 text-[11px]">Power: {loco.power_kw || 'N/A'} kW</p>
              </div>
            ))}
          </div>
        )}

        {/* RAKES TAB */}
        {activeTab === 'rakes' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddRakeOpen(true)}
                className="w-full justify-center gap-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-950/40 text-slate-300 hover:text-white h-9 text-xs mb-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Rake Composition
              </Button>
            )}

            {rakes.map((rk) => (
              <div
                key={rk.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    {rk.rake_id}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Coaches: {rk.composition?.[0]?.count || 12}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* PILOTS TAB */}
        {activeTab === 'pilots' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddPilotOpen(true)}
                className="w-full justify-center gap-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-950/40 text-slate-300 hover:text-white h-9 text-xs mb-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Register Loco Pilot
              </Button>
            )}

            {locoPilots.map((p) => (
              <div
                key={p.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {p.user?.full_name || 'Loco Pilot'}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                    {p.status}
                  </Badge>
                </div>
                <p className="text-slate-400 text-[11px]">License: {p.license_number}</p>
                <p className="text-slate-500 text-[11px]">{p.user?.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Add Train Modal */}
      {isAddTrainOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Add Train Composition</h2>
              <button onClick={() => setIsAddTrainOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTrain} className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Train Number / Service ID</Label>
                <Input
                  required
                  value={newTrainNumber}
                  onChange={(e) => setNewTrainNumber(e.target.value)}
                  placeholder="e.g. 12009 / FREIGHT-WR-404"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Train Name (Optional)</Label>
                <Input
                  value={newTrainName}
                  onChange={(e) => setNewTrainName(e.target.value)}
                  placeholder="e.g. Mumbai-Ahmedabad Shatabdi Express"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Locomotive (Optional)</Label>
                <select
                  value={newTrainLocoId}
                  onChange={(e) => setNewTrainLocoId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white text-xs"
                >
                  <option value="">Select Locomotive</option>
                  {locomotives.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.loco_number} ({l.loco_type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Rake (Optional)</Label>
                <select
                  value={newTrainRakeId}
                  onChange={(e) => setNewTrainRakeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white text-xs"
                >
                  <option value="">Select Rake</option>
                  {rakes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rake_id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsAddTrainOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Create Train
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Station Modal */}
      {isAddStationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Add Railway Station / Yard</h2>
              <button onClick={() => setIsAddStationOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateStation} className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Station / Yard Name</Label>
                <Input
                  required
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  placeholder="e.g. Pune Junction"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Station Code (Optional)</Label>
                <Input
                  value={newStationCode}
                  onChange={(e) => setNewStationCode(e.target.value)}
                  placeholder="e.g. PUNE / CSMT"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address for Geocoding (Optional)</Label>
                <Input
                  value={newStationAddress}
                  onChange={(e) => setNewStationAddress(e.target.value)}
                  placeholder="e.g. Station Road, Agarkar Nagar, Pune, Maharashtra"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Station Type</Label>
                <select
                  value={newStationType}
                  onChange={(e) => setNewStationType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white text-xs"
                >
                  <option value="station">Station</option>
                  <option value="junction">Junction</option>
                  <option value="yard">Freight Yard</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsAddStationOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Add Station
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Loco Modal */}
      {isAddLocoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Register Locomotive</h2>
              <button onClick={() => setIsAddLocoOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLoco} className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Locomotive Number</Label>
                <Input
                  required
                  value={newLocoNumber}
                  onChange={(e) => setNewLocoNumber(e.target.value)}
                  placeholder="e.g. WAP7-30201"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Locomotive Class / Type</Label>
                <Input
                  required
                  value={newLocoType}
                  onChange={(e) => setNewLocoType(e.target.value)}
                  placeholder="e.g. WAP-7 / WDG-4D"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fuel / Power</Label>
                  <select
                    value={newLocoFuel}
                    onChange={(e) => setNewLocoFuel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white text-xs"
                  >
                    <option value="electric">Electric (OHE)</option>
                    <option value="diesel">Diesel</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Power Rating (kW)</Label>
                  <Input
                    type="number"
                    value={newLocoPower}
                    onChange={(e) => setNewLocoPower(Number(e.target.value))}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsAddLocoOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Register Locomotive
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Rake Modal */}
      {isAddRakeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Create Rake Composition</h2>
              <button onClick={() => setIsAddRakeOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRake} className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Rake Identifier</Label>
                <Input
                  required
                  value={newRakeId}
                  onChange={(e) => setNewRakeId(e.target.value)}
                  placeholder="e.g. RAKE-LHB-22"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Coach / Wagon Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={newRakeCoachCount}
                  onChange={(e) => setNewRakeCoachCount(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsAddRakeOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Create Rake
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Pilot Modal */}
      {isAddPilotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Register Loco Pilot</h2>
              <button onClick={() => setIsAddPilotOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePilot} className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  required
                  value={newPilotName}
                  onChange={(e) => setNewPilotName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  required
                  value={newPilotEmail}
                  onChange={(e) => setNewPilotEmail(e.target.value)}
                  placeholder="e.g. ramesh.pilot@railways.in"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Loco Pilot License Number</Label>
                <Input
                  required
                  value={newPilotLicense}
                  onChange={(e) => setNewPilotLicense(e.target.value)}
                  placeholder="e.g. IR-LP-88421"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (Optional)</Label>
                <Input
                  value={newPilotPhone}
                  onChange={(e) => setNewPilotPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsAddPilotOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Register Pilot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
