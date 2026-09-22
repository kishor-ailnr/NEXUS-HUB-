import React, { useState } from 'react';
import {
  Aircraft,
  Airport,
  FlightCrew,
  Flight,
  FlightMovement,
  UserRole,
} from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  Search,
  Plus,
  Plane,
  MapPin,
  UserCheck,
  Radio,
  Play,
  CheckCircle2,
  X,
  Compass,
  Package,
  UserPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { airwaysService } from '../services/airways';

interface AirwaysSidebarProps {
  aircraft: Aircraft[];
  airports: Airport[];
  crew: FlightCrew[];
  flights: Flight[];
  movements: FlightMovement[];
  selectedAircraftId: string | null;
  onSelectAircraft: (aircraftId: string) => void;
  selectedMovementId: string | null;
  onSelectMovement: (movementId: string) => void;
  userRole?: UserRole;
  onRefresh: () => void;
  onOpenCreateMovement: () => void;
}

export const AirwaysSidebar: React.FC<AirwaysSidebarProps> = ({
  aircraft = [],
  airports = [],
  crew = [],
  flights = [],
  movements = [],
  selectedAircraftId = null,
  onSelectAircraft,
  selectedMovementId = null,
  onSelectMovement,
  userRole,
  onRefresh,
  onOpenCreateMovement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'movements' | 'aircraft' | 'flights' | 'airports' | 'crew'>('movements');

  // Modal states
  const [isAddAircraftOpen, setIsAddAircraftOpen] = useState(false);
  const [isAddAirportOpen, setIsAddAirportOpen] = useState(false);
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false);
  const [isAddFlightOpen, setIsAddFlightOpen] = useState(false);

  // Form states
  const [newTailNumber, setNewTailNumber] = useState('');
  const [newAircraftType, setNewAircraftType] = useState('Boeing 777F');
  const [newCargoCapacity, setNewCargoCapacity] = useState(102000);

  const [newAirportName, setNewAirportName] = useState('');
  const [newIataCode, setNewIataCode] = useState('');
  const [newIcaoCode, setNewIcaoCode] = useState('');
  const [newAirportAddress, setNewAirportAddress] = useState('');

  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewEmail, setNewCrewEmail] = useState('');
  const [newCrewLicense, setNewCrewLicense] = useState('');
  const [newCrewPhone, setNewCrewPhone] = useState('');
  const [newCrewRole, setNewCrewRole] = useState<'pilot' | 'cabin'>('pilot');
  const [newCrewPassword, setNewCrewPassword] = useState('');
  const [showCrewPassword, setShowCrewPassword] = useState(false);
  const [isSubmittingCrew, setIsSubmittingCrew] = useState(false);

  const [newFlightNumber, setNewFlightNumber] = useState('');
  const [newFlightOriginId, setNewFlightOriginId] = useState('');
  const [newFlightDestId, setNewFlightDestId] = useState('');

  const isManager = userRole === 'manager';

  // Handlers
  const handleCreateAircraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTailNumber.trim() || !newAircraftType.trim()) {
      toast.error('Tail number and aircraft type are required');
      return;
    }
    try {
      await airwaysService.createAircraft({
        tail_number: newTailNumber.trim(),
        aircraft_type: newAircraftType.trim(),
        cargo_capacity_kg: Number(newCargoCapacity) || undefined,
      });
      toast.success(`Aircraft ${newTailNumber} created successfully`);
      setIsAddAircraftOpen(false);
      setNewTailNumber('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create aircraft');
    }
  };

  const handleCreateAirport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAirportName.trim()) {
      toast.error('Airport name is required');
      return;
    }
    try {
      await airwaysService.createAirport({
        name: newAirportName.trim(),
        iata_code: newIataCode.trim() || undefined,
        icao_code: newIcaoCode.trim() || undefined,
        address: newAirportAddress.trim() || undefined,
      });
      toast.success(`Airport ${newAirportName} created successfully`);
      setIsAddAirportOpen(false);
      setNewAirportName('');
      setNewIataCode('');
      setNewIcaoCode('');
      setNewAirportAddress('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create airport');
    }
  };

  const handleCreateCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrewName.trim() || !newCrewEmail.trim() || !newCrewLicense.trim()) {
      toast.error('Name, email, and license number are required');
      return;
    }
    try {
      setIsSubmittingCrew(true);
      await airwaysService.createFlightCrew({
        fullName: newCrewName.trim(),
        email: newCrewEmail.trim(),
        licenseNumber: newCrewLicense.trim().toUpperCase(),
        phone: newCrewPhone.trim() || undefined,
        crewRole: newCrewRole,
        password: newCrewPassword.trim() || undefined,
      });
      toast.success(`Flight crew member ${newCrewName} registered`);
      setIsAddCrewOpen(false);
      setNewCrewName('');
      setNewCrewEmail('');
      setNewCrewLicense('');
      setNewCrewPhone('');
      setNewCrewPassword('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create crew member');
    } finally {
      setIsSubmittingCrew(false);
    }
  };

  const handleCreateFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlightNumber.trim() || !newFlightOriginId || !newFlightDestId) {
      toast.error('Flight number, origin and destination airports are required');
      return;
    }
    try {
      await airwaysService.createFlight({
        flight_number: newFlightNumber.trim(),
        origin_airport_id: newFlightOriginId,
        destination_airport_id: newFlightDestId,
      });
      toast.success(`Flight route ${newFlightNumber} scheduled`);
      setIsAddFlightOpen(false);
      setNewFlightNumber('');
      setNewFlightOriginId('');
      setNewFlightDestId('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create flight');
    }
  };

  const filteredMovements = movements.filter((m) => {
    const fn = m.flight?.flight_number || '';
    const tail = m.aircraft?.tail_number || '';
    const pilot = m.pilot?.user?.full_name || '';
    const origin = m.flight?.origin_airport?.name || '';
    const dest = m.flight?.destination_airport?.name || '';
    const term = searchTerm.toLowerCase();
    return (
      fn.toLowerCase().includes(term) ||
      tail.toLowerCase().includes(term) ||
      pilot.toLowerCase().includes(term) ||
      origin.toLowerCase().includes(term) ||
      dest.toLowerCase().includes(term)
    );
  });

  const filteredAircraft = aircraft.filter(
    (a) =>
      a.tail_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.aircraft_type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredFlights = flights.filter(
    (f) =>
      f.flight_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.origin_airport?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.destination_airport?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredAirports = airports.filter(
    (ap) =>
      ap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ap.iata_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ap.icao_code?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredCrew = crew.filter(
    (c) =>
      c.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.license_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <aside className="w-80 border-r border-border bg-card/60 backdrop-blur flex flex-col h-full select-none" data-testid="airways-sidebar">
      {/* Header & Search */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-sky-500" />
            <span className="font-semibold text-sm tracking-wide text-foreground">
              Airways Fleet & Flights
            </span>
          </div>
          {isManager && (
            <Button
              size="sm"
              onClick={onOpenCreateMovement}
              className="h-8 gap-1 text-xs bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Dispatch
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search flights, aircraft, airports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
          {(['movements', 'aircraft', 'flights', 'airports', 'crew'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Movements Tab */}
        {activeTab === 'movements' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">
                Flight Movements ({filteredMovements.length})
              </span>
            </div>

            {filteredMovements.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No active or planned flights found.
              </div>
            ) : (
              filteredMovements.map((movement) => {
                const isSelected = selectedMovementId === movement.id;
                const isTransit = movement.status === 'in_transit';
                const isCompleted = movement.status === 'completed';

                return (
                  <Card
                    key={movement.id}
                    onClick={() => onSelectMovement(movement.id)}
                    className={`cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-border/60 hover:border-border bg-card/40'
                    }`}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Plane className={`h-4 w-4 ${isTransit ? 'text-sky-400 animate-pulse' : 'text-muted-foreground'}`} />
                          <span className="font-medium text-xs text-foreground">
                            {movement.flight?.flight_number || 'Flight'}
                          </span>
                        </div>
                        <Badge
                          variant={
                            isTransit
                              ? 'default'
                              : isCompleted
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[10px] px-1.5 py-0 capitalize"
                        >
                          {movement.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-muted-foreground truncate">
                        {movement.flight?.origin_airport?.name || 'Origin'} &rarr;{' '}
                        {movement.flight?.destination_airport?.name || 'Destination'}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>Tail: {movement.aircraft?.tail_number || 'N/A'}</span>
                        <span>Pilot: {movement.pilot?.user?.full_name || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Aircraft Fleet Tab */}
        {activeTab === 'aircraft' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">
                Aircraft Fleet ({filteredAircraft.length})
              </span>
              {isManager && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAddCrewOpen(true)}
                    className="h-6 px-2 text-[11px] text-emerald-400 hover:text-emerald-300 gap-1"
                    data-testid="add-crew-button"
                  >
                    <UserPlus className="h-3 w-3" /> Add Crew
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAddAircraftOpen(true)}
                    className="h-6 px-2 text-[11px] text-sky-400 hover:text-sky-300 gap-1"
                    data-testid="add-aircraft-button"
                  >
                    <Plus className="h-3 w-3" /> Add Aircraft
                  </Button>
                </div>
              )}
            </div>

            {filteredAircraft.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No aircraft registered.
              </div>
            ) : (
              filteredAircraft.map((ac) => {
                const isSelected = selectedAircraftId === ac.id;
                return (
                  <Card
                    key={ac.id}
                    onClick={() => onSelectAircraft(ac.id)}
                    className={`cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-border/60 hover:border-border bg-card/40'
                    }`}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-foreground">
                          {ac.tail_number}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {ac.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{ac.aircraft_type}</div>
                      {ac.cargo_capacity_kg && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Capacity: {(ac.cargo_capacity_kg / 1000).toFixed(1)} tonnes
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Flights Tab */}
        {activeTab === 'flights' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">
                Flight Routes ({filteredFlights.length})
              </span>
              {isManager && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddFlightOpen(true)}
                  className="h-6 px-2 text-[11px] text-sky-400 hover:text-sky-300 gap-1"
                >
                  <Plus className="h-3 w-3" /> New Route
                </Button>
              )}
            </div>

            {filteredFlights.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No flight routes defined.
              </div>
            ) : (
              filteredFlights.map((flight) => (
                <Card key={flight.id} className="border-border/60 bg-card/40">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-sky-400">
                        {flight.flight_number}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Great-Circle</span>
                    </div>
                    <div className="text-[11px] text-foreground font-medium">
                      {flight.origin_airport?.iata_code || flight.origin_airport?.name} &rarr;{' '}
                      {flight.destination_airport?.iata_code || flight.destination_airport?.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {flight.origin_airport?.name} to {flight.destination_airport?.name}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Airports Tab */}
        {activeTab === 'airports' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">
                Airports ({filteredAirports.length})
              </span>
              {isManager && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddAirportOpen(true)}
                  className="h-6 px-2 text-[11px] text-sky-400 hover:text-sky-300 gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Airport
                </Button>
              )}
            </div>

            {filteredAirports.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No airports registered.
              </div>
            ) : (
              filteredAirports.map((airport) => (
                <Card key={airport.id} className="border-border/60 bg-card/40">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-foreground">{airport.name}</span>
                      {airport.iata_code && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                          {airport.iata_code}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {airport.lat?.toFixed(4)}, {airport.lng?.toFixed(4)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Flight Crew Tab */}
        {activeTab === 'crew' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">
                Flight Crew ({filteredCrew.length})
              </span>
              {isManager && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddCrewOpen(true)}
                  className="h-6 px-2 text-[11px] text-sky-400 hover:text-sky-300 gap-1"
                  data-testid="add-crew-button-tab"
                >
                  <UserPlus className="h-3 w-3" /> Add Crew
                </Button>
              )}
            </div>

            {filteredCrew.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No flight crew registered.
              </div>
            ) : (
              filteredCrew.map((member) => (
                <Card key={member.id} className="border-border/60 bg-card/40">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-foreground">
                        {member.user?.full_name || 'Pilot'}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                        {member.crew_role}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      License: {member.license_number}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Email: {member.user?.email || 'N/A'}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Aircraft Modal */}
      {isAddAircraftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl">
            <form onSubmit={handleCreateAircraft}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-semibold text-sm">Add New Aircraft</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddAircraftOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tail Number / Registration</Label>
                  <Input
                    placeholder="e.g. VT-NEX"
                    value={newTailNumber}
                    onChange={(e) => setNewTailNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aircraft Type</Label>
                  <Input
                    placeholder="e.g. Boeing 777F, Airbus A330-200F"
                    value={newAircraftType}
                    onChange={(e) => setNewAircraftType(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payload Cargo Capacity (kg)</Label>
                  <Input
                    type="number"
                    value={newCargoCapacity}
                    onChange={(e) => setNewCargoCapacity(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAircraftOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-500 text-white">
                  Save Aircraft
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Airport Modal */}
      {isAddAirportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl">
            <form onSubmit={handleCreateAirport}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-semibold text-sm">Add New Airport</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddAirportOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Airport Name</Label>
                  <Input
                    placeholder="e.g. Indira Gandhi International Airport"
                    value={newAirportName}
                    onChange={(e) => setNewAirportName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">IATA Code (3 letters)</Label>
                    <Input
                      placeholder="e.g. DEL"
                      maxLength={3}
                      value={newIataCode}
                      onChange={(e) => setNewIataCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ICAO Code (4 letters)</Label>
                    <Input
                      placeholder="e.g. VIDP"
                      maxLength={4}
                      value={newIcaoCode}
                      onChange={(e) => setNewIcaoCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City / Address (for geocoding)</Label>
                  <Input
                    placeholder="e.g. New Delhi, India"
                    value={newAirportAddress}
                    onChange={(e) => setNewAirportAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAirportOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-500 text-white">
                  Save Airport
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Crew Modal */}
      {isAddCrewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl">
            <form onSubmit={handleCreateCrew}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-semibold text-sm">Register Flight Crew</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddCrewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    placeholder="e.g. Capt. Vikram Mehra"
                    value={newCrewName}
                    onChange={(e) => setNewCrewName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pilot Email Address</Label>
                  <Input
                    type="email"
                    placeholder="e.g. pilot@nexusways.air"
                    value={newCrewEmail}
                    onChange={(e) => setNewCrewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aviation License Number (ATPL)</Label>
                  <Input
                    placeholder="e.g. ATPL-IN-98421"
                    value={newCrewLicense}
                    onChange={(e) => setNewCrewLicense(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Crew Role</Label>
                  <select
                    value={newCrewRole}
                    onChange={(e) => setNewCrewRole(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="pilot">Pilot in Command / First Officer</option>
                    <option value="cabin">Cabin / Cargo Specialist</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddCrewOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-500 text-white">
                  Save Crew Member
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Flight Route Modal */}
      {isAddFlightOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl">
            <form onSubmit={handleCreateFlight}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-semibold text-sm">Schedule Flight Route</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddFlightOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Flight Number</Label>
                  <Input
                    placeholder="e.g. NW-701"
                    value={newFlightNumber}
                    onChange={(e) => setNewFlightNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Origin Airport</Label>
                  <select
                    value={newFlightOriginId}
                    onChange={(e) => setNewFlightOriginId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    required
                  >
                    <option value="">Select origin airport...</option>
                    {airports.map((ap) => (
                      <option key={ap.id} value={ap.id}>
                        {ap.name} ({ap.iata_code || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Destination Airport</Label>
                  <select
                    value={newFlightDestId}
                    onChange={(e) => setNewFlightDestId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    required
                  >
                    <option value="">Select destination airport...</option>
                    {airports.map((ap) => (
                      <option key={ap.id} value={ap.id} disabled={ap.id === newFlightOriginId}>
                        {ap.name} ({ap.iata_code || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddFlightOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-500 text-white">
                  Save Flight Route
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* Add Flight Crew Modal */}
      {isAddCrewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl">
            <form onSubmit={handleCreateCrew}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-semibold text-sm">Register Flight Crew Member</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddCrewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input
                    placeholder="e.g. Capt. Rajesh Nair"
                    value={newCrewName}
                    onChange={(e) => setNewCrewName(e.target.value)}
                    required
                    data-testid="crew-name-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="e.g. rajesh.pilot@airways.com"
                    value={newCrewEmail}
                    onChange={(e) => setNewCrewEmail(e.target.value)}
                    required
                    data-testid="crew-email-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">License / ATPL Number *</Label>
                  <Input
                    placeholder="e.g. ATPL-IND-9942"
                    value={newCrewLicense}
                    onChange={(e) => setNewCrewLicense(e.target.value)}
                    required
                    className="uppercase font-mono text-xs"
                    data-testid="crew-license-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone (Optional)</Label>
                  <Input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={newCrewPhone}
                    onChange={(e) => setNewCrewPhone(e.target.value)}
                    data-testid="crew-phone-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Crew Role</Label>
                  <select
                    value={newCrewRole}
                    onChange={(e) => setNewCrewRole(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    data-testid="crew-role-select"
                  >
                    <option value="pilot">Captain / First Officer (Pilot)</option>
                    <option value="cabin">Flight Navigator / Cargo Officer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Initial Password</Label>
                  <div className="relative">
                    <Input
                      type={showCrewPassword ? 'text' : 'password'}
                      placeholder="Set initial password (default: Pilot@Nexus123)"
                      value={newCrewPassword}
                      onChange={(e) => setNewCrewPassword(e.target.value)}
                      className="pr-9 text-xs"
                      data-testid="crew-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCrewPassword(!showCrewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCrewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddCrewOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingCrew}
                  className="bg-sky-600 hover:bg-sky-500 text-white"
                  data-testid="submit-crew-button"
                >
                  {isSubmittingCrew ? 'Registering...' : 'Register Crew Member'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </aside>
  );
};
