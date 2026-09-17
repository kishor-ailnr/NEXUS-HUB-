import React, { useState } from 'react';
import { Vehicle, Driver, CreateVehicleDto } from '@nexus-ways/shared';
import { vehiclesService } from '../services/vehicles';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import {
  Truck,
  Search,
  Plus,
  Radio,
  MapPin,
  User,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';

interface VehicleSidebarProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  selectedVehicleId?: string | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onVehicleCreated: (vehicle: Vehicle) => void;
  onCreateTrip: (vehicle: Vehicle) => void;
  currentUserRole?: string;
}

export const VehicleSidebar: React.FC<VehicleSidebarProps> = ({
  vehicles,
  drivers,
  selectedVehicleId,
  onSelectVehicle,
  onVehicleCreated,
  onCreateTrip,
  currentUserRole,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Vehicle Form State
  const [regNumber, setRegNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Heavy Truck');
  const [capacityKg, setCapacityKg] = useState('15000');
  const [assignedDriverId, setAssignedDriverId] = useState('');

  const isManager = currentUserRole === 'manager';

  const filteredVehicles = vehicles.filter((v) =>
    v.registration_number.toLowerCase().includes(searchTerm.toLowerCase().trim()),
  );

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNumber.trim()) {
      toast.error('Registration number is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const newVehicle = await vehiclesService.createVehicle({
        registrationNumber: regNumber.trim().toUpperCase(),
        vehicleType,
        capacityKg: capacityKg ? Number(capacityKg) : undefined,
        assignedDriverId: assignedDriverId || undefined,
      });

      toast.success(`Vehicle ${newVehicle.registration_number} added successfully`);
      onVehicleCreated(newVehicle);
      setIsAddModalOpen(false);
      setRegNumber('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="roadways-sidebar">
      {/* Sidebar Header & Search */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900">Fleet Registry</CardTitle>
          </div>
          {isManager && (
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-2.5"
              data-testid="add-vehicle-button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search registration..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
              data-testid="vehicle-search-input"
            />
          </div>

          {/* Vehicle List */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                {searchTerm ? 'No matching vehicles found.' : 'No vehicles in fleet. Add one above!'}
              </div>
            ) : (
              filteredVehicles.map((v) => {
                const isSelected = selectedVehicleId === v.id;
                const isActive = v.status === 'active';
                const isMaintenance = v.status === 'maintenance';

                return (
                  <div
                    key={v.id}
                    onClick={() => onSelectVehicle(v)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                    data-testid={`vehicle-card-${v.id}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 tracking-wide">
                        {v.registration_number}
                      </span>
                      <Badge
                        variant={isActive ? 'default' : isMaintenance ? 'destructive' : 'secondary'}
                        className={`text-[10px] uppercase font-semibold px-1.5 py-0.2 ${
                          isActive
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : isMaintenance
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {v.status}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-slate-500 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">
                            {v.driver?.user?.full_name || v.driver?.license_number || 'Unassigned'}
                          </span>
                        </span>
                        {v.latest_gps?.speed_kmh !== undefined && (
                          <span className="font-semibold text-blue-600 flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                            {v.latest_gps.speed_kmh} km/h
                          </span>
                        )}
                      </div>

                      {v.convoy_name && (
                        <div className="flex items-center gap-1 text-purple-600 font-medium">
                          <Users className="w-3 h-3" />
                          <span>Convoy: {v.convoy_name}</span>
                        </div>
                      )}

                      {v.active_trip && (
                        <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 flex items-center justify-between mt-1">
                          <span className="truncate max-w-[140px]">
                            &rarr; {v.active_trip.destination_label}
                          </span>
                          <span className="text-emerald-600 font-bold">In Transit</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Trip Start action for idle vehicles */}
                    {isManager && v.status === 'idle' && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateTrip(v);
                          }}
                          className="h-6 text-[10px] px-2 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Start Trip</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Vehicle to Fleet</h3>
            <p className="text-xs text-slate-500 mb-4">
              Register a commercial vehicle for operational routing and live simulation.
            </p>

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Registration Number *
                </label>
                <Input
                  required
                  placeholder="e.g. MH-12-AB-1234"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="uppercase font-mono text-sm"
                  data-testid="registration-input"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-slate-200 bg-white px-3 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Heavy Truck">Heavy Truck (16-Wheel / Multi-Axle)</option>
                  <option value="Medium LCV">Medium LCV (Light Commercial)</option>
                  <option value="Trailer Truck">Trailer Truck (Container Carrier)</option>
                  <option value="Refrigerated Van">Refrigerated Cargo Van</option>
                  <option value="Tanker">Liquid Tanker</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Payload Capacity (kg)
                </label>
                <Input
                  type="number"
                  placeholder="15000"
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign Default Driver
                </label>
                <select
                  value={assignedDriverId}
                  onChange={(e) => setAssignedDriverId(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-slate-200 bg-white px-3 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- No Driver Assigned --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.full_name || d.license_number} ({d.license_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="submit-vehicle-button"
                >
                  {isSubmitting ? 'Registering...' : 'Register Vehicle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
