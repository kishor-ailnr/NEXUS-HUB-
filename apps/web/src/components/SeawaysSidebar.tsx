import React, { useState } from 'react';
import {
  Vessel,
  Port,
  SeaCrew,
  Voyage,
  VoyageMovement,
  SeaConvoyGroup,
  UserRole,
} from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  Search,
  Plus,
  Ship,
  Anchor,
  UserCheck,
  Radio,
  Play,
  CheckCircle2,
  X,
  Compass,
  Package,
  Layers,
  Users,
  UserPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { seawaysService } from '../services/seaways';

interface SeawaysSidebarProps {
  vessels: Vessel[];
  ports: Port[];
  crew: SeaCrew[];
  voyages: Voyage[];
  movements: VoyageMovement[];
  convoys: SeaConvoyGroup[];
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
  selectedMovementId: string | null;
  onSelectMovement: (movementId: string) => void;
  userRole?: UserRole;
  onRefresh: () => void;
  onOpenCreateMovement: () => void;
}

export const SeawaysSidebar: React.FC<SeawaysSidebarProps> = ({
  vessels = [],
  ports = [],
  crew = [],
  voyages = [],
  movements = [],
  convoys = [],
  selectedVesselId = null,
  onSelectVessel,
  selectedMovementId = null,
  onSelectMovement,
  userRole,
  onRefresh,
  onOpenCreateMovement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'movements' | 'vessels' | 'voyages' | 'ports' | 'crew' | 'convoys'>('movements');

  // Modal states
  const [isAddVesselOpen, setIsAddVesselOpen] = useState(false);
  const [isAddPortOpen, setIsAddPortOpen] = useState(false);
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false);
  const [isAddVoyageOpen, setIsAddVoyageOpen] = useState(false);
  const [isAddConvoyOpen, setIsAddConvoyOpen] = useState(false);

  // Form states
  const [newVesselName, setNewVesselName] = useState('');
  const [newImoNumber, setNewImoNumber] = useState('');
  const [newVesselType, setNewVesselType] = useState('Container Ship');
  const [newDwtTonnes, setNewDwtTonnes] = useState<number | ''>('');
  const [newTeuCapacity, setNewTeuCapacity] = useState<number | ''>('');

  const [newPortName, setNewPortName] = useState('');
  const [newUnlocode, setNewUnlocode] = useState('');
  const [newPortAddress, setNewPortAddress] = useState('');

  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewEmail, setNewCrewEmail] = useState('');
  const [newCrewCert, setNewCrewCert] = useState('');
  const [newCrewPhone, setNewCrewPhone] = useState('');
  const [newCrewRole, setNewCrewRole] = useState<'master' | 'officer' | 'rating'>('master');
  const [newCrewPassword, setNewCrewPassword] = useState('');
  const [showCrewPassword, setShowCrewPassword] = useState(false);
  const [isSubmittingCrew, setIsSubmittingCrew] = useState(false);

  const [newVoyageNumber, setNewVoyageNumber] = useState('');
  const [newVoyageOriginId, setNewVoyageOriginId] = useState('');
  const [newVoyageDestId, setNewVoyageDestId] = useState('');

  const [newConvoyName, setNewConvoyName] = useState('');
  const [selectedConvoyVessels, setSelectedConvoyVessels] = useState<string[]>([]);

  const isManager = userRole === 'manager';

  // Handlers
  const handleCreateVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVesselName.trim() || !newVesselType.trim()) {
      toast.error('Vessel name and type are required');
      return;
    }
    try {
      await seawaysService.createVessel({
        vessel_name: newVesselName.trim(),
        vessel_type: newVesselType.trim(),
        imo_number: newImoNumber.trim() || undefined,
        dwt_tonnes: Number(newDwtTonnes) || undefined,
        teu_capacity: Number(newTeuCapacity) || undefined,
      });
      toast.success('Vessel added successfully');
      setIsAddVesselOpen(false);
      setNewVesselName('');
      setNewImoNumber('');
      setNewTeuCapacity('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create vessel');
    }
  };

  const handleCreatePort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortName.trim()) {
      toast.error('Port name is required');
      return;
    }
    try {
      await seawaysService.createPort({
        name: newPortName.trim(),
        unlocode: newUnlocode.trim() || undefined,
        address: newPortAddress.trim() || newPortName.trim(),
      });
      toast.success('Port created & geocoded successfully');
      setIsAddPortOpen(false);
      setNewPortName('');
      setNewUnlocode('');
      setNewPortAddress('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create port');
    }
  };

  const handleCreateCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrewName.trim() || !newCrewEmail.trim() || !newCrewCert.trim()) {
      toast.error('Name, email, and certificate number are required');
      return;
    }
    try {
      setIsSubmittingCrew(true);
      await seawaysService.createSeaCrew({
        fullName: newCrewName.trim(),
        email: newCrewEmail.trim(),
        certificateNumber: newCrewCert.trim().toUpperCase(),
        phone: newCrewPhone.trim() || undefined,
        crewRole: newCrewRole,
        password: newCrewPassword.trim() || undefined,
      });
      toast.success('Crew member registered successfully');
      setIsAddCrewOpen(false);
      setNewCrewName('');
      setNewCrewEmail('');
      setNewCrewCert('');
      setNewCrewPhone('');
      setNewCrewPassword('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create crew member');
    } finally {
      setIsSubmittingCrew(false);
    }
  };

  const handleCreateVoyage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoyageNumber.trim() || !newVoyageOriginId || !newVoyageDestId) {
      toast.error('Voyage number, origin, and destination ports are required');
      return;
    }
    if (newVoyageOriginId === newVoyageDestId) {
      toast.error('Origin and destination ports cannot be the same');
      return;
    }
    try {
      await seawaysService.createVoyage({
        voyage_number: newVoyageNumber.trim(),
        origin_port_id: newVoyageOriginId,
        destination_port_id: newVoyageDestId,
      });
      toast.success('Voyage route created successfully');
      setIsAddVoyageOpen(false);
      setNewVoyageNumber('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create voyage');
    }
  };

  const handleCreateConvoy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConvoyName.trim()) {
      toast.error('Convoy group name is required');
      return;
    }
    try {
      await seawaysService.createConvoy({
        name: newConvoyName.trim(),
        vessel_ids: selectedConvoyVessels,
      });
      toast.success('Convoy group created successfully');
      setIsAddConvoyOpen(false);
      setNewConvoyName('');
      setSelectedConvoyVessels([]);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create convoy');
    }
  };

  // Filtered lists
  const filteredMovements = movements.filter((m) => {
    const q = searchTerm.toLowerCase();
    const vName = m.vessel?.vessel_name?.toLowerCase() || '';
    const vNum = m.voyage?.voyage_number?.toLowerCase() || '';
    const orig = m.voyage?.origin_port?.name?.toLowerCase() || '';
    const dest = m.voyage?.destination_port?.name?.toLowerCase() || '';
    const master = m.master?.user?.full_name?.toLowerCase() || '';
    return vName.includes(q) || vNum.includes(q) || orig.includes(q) || dest.includes(q) || master.includes(q);
  });

  const filteredVessels = vessels.filter((v) => {
    const q = searchTerm.toLowerCase();
    return (
      v.vessel_name.toLowerCase().includes(q) ||
      (v.imo_number && v.imo_number.toLowerCase().includes(q)) ||
      v.vessel_type.toLowerCase().includes(q)
    );
  });

  const filteredVoyages = voyages.filter((vg) => {
    const q = searchTerm.toLowerCase();
    return (
      vg.voyage_number.toLowerCase().includes(q) ||
      (vg.origin_port?.name && vg.origin_port.name.toLowerCase().includes(q)) ||
      (vg.destination_port?.name && vg.destination_port.name.toLowerCase().includes(q))
    );
  });

  const filteredPorts = ports.filter((p) => {
    const q = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.unlocode && p.unlocode.toLowerCase().includes(q));
  });

  const filteredCrew = crew.filter((c) => {
    const q = searchTerm.toLowerCase();
    const name = c.user?.full_name?.toLowerCase() || '';
    const email = c.user?.email?.toLowerCase() || '';
    const cert = c.certificate_number.toLowerCase();
    return name.includes(q) || email.includes(q) || cert.includes(q);
  });

  return (
    <div className="w-80 md:w-96 flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-sm">Maritime Fleet</h2>
              <p className="text-xs text-slate-400">Seaways Operations & Land-Avoiding Routing</p>
            </div>
          </div>
          {isManager && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-2.5 flex items-center gap-1.5"
              onClick={onOpenCreateMovement}
            >
              <Play className="w-3.5 h-3.5" />
              Dispatch
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            placeholder="Search vessels, ports, voyages..."
            className="pl-9 h-9 bg-slate-950/60 border-slate-700 text-xs text-slate-200 placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              onClick={() => setSearchTerm('')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-lg border border-slate-800 text-xs overflow-x-auto">
          <button
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-all whitespace-nowrap ${
              activeTab === 'movements'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            onClick={() => setActiveTab('movements')}
          >
            Voyages ({movements.length})
          </button>
          <button
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-all whitespace-nowrap ${
              activeTab === 'vessels'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            onClick={() => setActiveTab('vessels')}
          >
            Vessels ({vessels.length})
          </button>
          <button
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-all whitespace-nowrap ${
              activeTab === 'ports'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            onClick={() => setActiveTab('ports')}
          >
            Ports ({ports.length})
          </button>
          <button
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-all whitespace-nowrap ${
              activeTab === 'convoys'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            onClick={() => setActiveTab('convoys')}
          >
            Convoys ({convoys.length})
          </button>
          <button
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-all whitespace-nowrap ${
              activeTab === 'crew'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            onClick={() => setActiveTab('crew')}
          >
            Crew ({crew.length})
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* TAB 1: MOVEMENTS */}
        {activeTab === 'movements' && (
          <div className="space-y-2">
            {filteredMovements.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Ship className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No active or planned voyage movements found.
                {isManager && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-xs text-slate-300"
                      onClick={onOpenCreateMovement}
                    >
                      Dispatch First Voyage
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredMovements.map((mov) => {
                const isSelected = selectedMovementId === mov.id;
                const isInTransit = mov.status === 'in_transit';
                const isCompleted = mov.status === 'completed';

                return (
                  <Card
                    key={mov.id}
                    className={`cursor-pointer transition-all border text-xs ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
                    }`}
                    onClick={() => {
                      onSelectMovement(mov.id);
                      if (mov.vessel_id) onSelectVessel(mov.vessel_id);
                    }}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                          <Ship className="w-3.5 h-3.5 text-blue-400" />
                          <span>{mov.voyage?.voyage_number || 'Voyage'}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${
                            isInTransit
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                              : isCompleted
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {mov.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="text-slate-300 font-medium">
                        {mov.vessel?.vessel_name || 'Vessel'}
                        <span className="text-slate-500 font-normal ml-1">
                          ({mov.vessel?.vessel_type || 'Cargo'})
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-1 truncate max-w-[150px]">
                          <Anchor className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{mov.voyage?.origin_port?.name || 'Origin'}</span>
                        </div>
                        <span className="text-slate-600">→</span>
                        <div className="flex items-center gap-1 truncate max-w-[150px] justify-end">
                          <span className="truncate">{mov.voyage?.destination_port?.name || 'Dest'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Master: {mov.master?.user?.full_name || 'Assigned'}</span>
                        <span>{mov.distance_km ? `${mov.distance_km} km` : 'Calculating route...'}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: VESSELS */}
        {activeTab === 'vessels' && (
          <div className="space-y-2">
            {isManager && (
              <div className="flex gap-1.5 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-dashed border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/60 text-xs h-8 flex items-center justify-center gap-1.5"
                  onClick={() => setIsAddVesselOpen(true)}
                  data-testid="add-vessel-button"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Vessel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-dashed border-cyan-700/60 text-cyan-300 hover:text-white hover:bg-cyan-950/20 text-xs h-8 flex items-center justify-center gap-1.5"
                  onClick={() => setIsAddCrewOpen(true)}
                  data-testid="add-crew-button"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Sea Crew
                </Button>
              </div>
            )}

            {filteredVessels.map((v) => (
              <Card
                key={v.id}
                className={`cursor-pointer transition-all border text-xs ${
                  selectedVesselId === v.id
                    ? 'bg-blue-950/40 border-blue-500'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
                onClick={() => onSelectVessel(v.id)}
              >
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{v.vessel_name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        v.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {v.status}
                    </Badge>
                  </div>
                  <div className="text-slate-400 text-[11px]">{v.vessel_type}</div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
                    <span>IMO: {v.imo_number || 'N/A'}</span>
                    <span>{v.dwt_tonnes ? `${v.dwt_tonnes.toLocaleString()} DWT` : ''}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 3: PORTS */}
        {activeTab === 'ports' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/60 text-xs h-8 flex items-center gap-1.5 mb-2"
                onClick={() => setIsAddPortOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Coastal Port
              </Button>
            )}

            {filteredPorts.map((p) => (
              <Card key={p.id} className="bg-slate-950/40 border-slate-800/80 text-xs">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{p.name}</span>
                    {p.unlocode && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
                        {p.unlocode}
                      </Badge>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Anchor className="w-3 h-3 text-slate-600" />
                    <span>
                      {p.lat ? `${p.lat.toFixed(3)}°N, ${p.lng?.toFixed(3)}°E` : 'Coordinates pending'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 4: CONVOYS */}
        {activeTab === 'convoys' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/60 text-xs h-8 flex items-center gap-1.5 mb-2"
                onClick={() => setIsAddConvoyOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Convoy Group
              </Button>
            )}

            {convoys.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                <Users className="w-6 h-6 mx-auto mb-1 opacity-40" />
                No convoy groups created yet.
              </div>
            ) : (
              convoys.map((convoy) => (
                <Card key={convoy.id} className="bg-slate-950/40 border-slate-800/80 text-xs">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-cyan-400">{convoy.name}</span>
                      <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                        {convoy.members?.length || 0} Vessels
                      </Badge>
                    </div>
                    {convoy.members && convoy.members.length > 0 && (
                      <div className="text-[11px] text-slate-400 space-y-0.5 pl-2 border-l border-cyan-500/30">
                        {convoy.members.map((m) => (
                          <div key={m.id} className="truncate">
                            • {m.vessel?.vessel_name || 'Vessel'}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* TAB 5: CREW */}
        {activeTab === 'crew' && (
          <div className="space-y-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-cyan-700/60 text-cyan-300 hover:text-white hover:bg-cyan-950/20 text-xs h-8 flex items-center gap-1.5 mb-2"
                onClick={() => setIsAddCrewOpen(true)}
                data-testid="add-crew-button-tab"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Sea Crew Member
              </Button>
            )}

            {filteredCrew.map((c) => (
              <Card key={c.id} className="bg-slate-950/40 border-slate-800/80 text-xs">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{c.user?.full_name || 'Crew Member'}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        c.status === 'on_duty'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-slate-400 text-[11px] capitalize">{c.crew_role} • Cert #{c.certificate_number}</div>
                  <div className="text-slate-500 text-[11px] truncate">{c.user?.email}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Vessel */}
      {isAddVesselOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm">Add Maritime Vessel</h3>
              <button onClick={() => setIsAddVesselOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateVessel} className="space-y-3">
              <div>
                <Label className="text-xs text-slate-300">Vessel Name</Label>
                <Input
                  required
                  placeholder="e.g. MV Sagar Samrat"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newVesselName}
                  onChange={(e) => setNewVesselName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">IMO Number</Label>
                <Input
                  placeholder="e.g. IMO 9412345"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newImoNumber}
                  onChange={(e) => setNewImoNumber(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Vessel Type</Label>
                <Input
                  required
                  placeholder="e.g. Container Ship, Bulk Carrier, Oil Tanker"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newVesselType}
                  onChange={(e) => setNewVesselType(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Deadweight Tonnage (DWT)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 65000"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newDwtTonnes}
                  onChange={(e) => setNewDwtTonnes(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">TEU Capacity (GLEC v3.2 basis)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newTeuCapacity}
                  onChange={(e) => setNewTeuCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsAddVesselOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs">
                  Save Vessel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Port */}
      {isAddPortOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm">Add Coastal Port</h3>
              <button onClick={() => setIsAddPortOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePort} className="space-y-3">
              <div>
                <Label className="text-xs text-slate-300">Port Name</Label>
                <Input
                  required
                  placeholder="e.g. Jawaharlal Nehru Port (JNPT)"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newPortName}
                  onChange={(e) => setNewPortName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">UN/LOCODE</Label>
                <Input
                  placeholder="e.g. INNSA"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newUnlocode}
                  onChange={(e) => setNewUnlocode(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Geocoding Address / Location Query</Label>
                <Input
                  placeholder="e.g. Navi Mumbai, Maharashtra, India"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newPortAddress}
                  onChange={(e) => setNewPortAddress(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsAddPortOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs">
                  Save Port
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Crew */}
      {isAddCrewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm">Register Sea Crew Member</h3>
              <button onClick={() => setIsAddCrewOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCrew} className="space-y-3">
              <div>
                <Label className="text-xs text-slate-300">Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Capt. Vikram Batra"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  data-testid="crew-name-input"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Email Address *</Label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. master.vikram@nexusways.com"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newCrewEmail}
                  onChange={(e) => setNewCrewEmail(e.target.value)}
                  data-testid="crew-email-input"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Certificate of Competency (CoC) Number *</Label>
                <Input
                  required
                  placeholder="e.g. IND-COC-M-98124"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100 uppercase font-mono"
                  value={newCrewCert}
                  onChange={(e) => setNewCrewCert(e.target.value)}
                  data-testid="crew-cert-input"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Phone (Optional)</Label>
                <Input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newCrewPhone}
                  onChange={(e) => setNewCrewPhone(e.target.value)}
                  data-testid="crew-phone-input"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300">Crew Role</Label>
                <select
                  className="w-full h-8 bg-slate-950 border border-slate-700 rounded-md text-xs text-slate-100 px-2"
                  value={newCrewRole}
                  onChange={(e) => setNewCrewRole(e.target.value as any)}
                  data-testid="crew-role-select"
                >
                  <option value="master">Master / Captain</option>
                  <option value="officer">Chief Officer / Navigation Officer</option>
                  <option value="rating">Rating / Deck Hand</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-300">Initial Password</Label>
                <div className="relative">
                  <Input
                    type={showCrewPassword ? 'text' : 'password'}
                    placeholder="Set initial password (default: Master@Nexus123)"
                    className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100 pr-8"
                    value={newCrewPassword}
                    onChange={(e) => setNewCrewPassword(e.target.value)}
                    data-testid="crew-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCrewPassword(!showCrewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCrewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsAddCrewOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingCrew}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
                  data-testid="submit-crew-button"
                >
                  {isSubmittingCrew ? 'Registering...' : 'Save Crew Member'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Convoy */}
      {isAddConvoyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm">Create Vessel Convoy Group</h3>
              <button onClick={() => setIsAddConvoyOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateConvoy} className="space-y-3">
              <div>
                <Label className="text-xs text-slate-300">Convoy Name</Label>
                <Input
                  required
                  placeholder="e.g. Arabian Gulf Transit Convoy Alpha"
                  className="h-8 bg-slate-950 border-slate-700 text-xs text-slate-100"
                  value={newConvoyName}
                  onChange={(e) => setNewConvoyName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-300 mb-1 block">Select Vessels for Convoy</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-slate-950 border border-slate-800 rounded-md">
                  {vessels.map((v) => {
                    const isSelected = selectedConvoyVessels.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConvoyVessels([...selectedConvoyVessels, v.id]);
                            } else {
                              setSelectedConvoyVessels(selectedConvoyVessels.filter((id) => id !== v.id));
                            }
                          }}
                        />
                        <span className="text-slate-200">{v.vessel_name}</span>
                        <span className="text-slate-500 text-[10px]">({v.vessel_type})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsAddConvoyOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs">
                  Create Convoy
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
