import React, { useState } from 'react';
import { Shield, ShieldAlert, Lock, UserCheck, X, FileText, Check, Edit2, ExternalLink, Loader2 } from 'lucide-react';
import { AdminUser, AdminReport, UserRole } from '@nexus-ways/shared';
import { adminService } from '../services/admin';
import { tripsService } from '../services/trips';
import { railwaysService } from '../services/railways';
import { airwaysService } from '../services/airways';
import { seawaysService } from '../services/seaways';
import { useAuthStore } from '../store/authStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';

interface AdminPanelModalProps {
  currentUserRole?: string;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ currentUserRole = 'manager' }) => {
  const mode = useAuthStore((s) => s.mode);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Admin panel data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('driver');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Reports data
  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [openingTripId, setOpeningTripId] = useState<string | null>(null);

  const handleOpenClick = () => {
    setIsPasswordModalOpen(true);
    setPassword('');
    setVerifyError(null);
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsVerifying(true);
    setVerifyError(null);

    try {
      await adminService.verifyPassword(password);
      toast.success('Admin authorization confirmed.');
      setIsPasswordModalOpen(false);
      setIsAdminPanelOpen(true);
      loadUsers();
      loadReports();
    } catch (err: any) {
      setVerifyError(err.message || 'Incorrect password. Verification failed.');
      toast.error('Password step-up verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch {
      toast.error('Failed to load user directory.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadReports = async () => {
    setIsLoadingReports(true);
    try {
      if (mode === 'railways') {
        const railReports = await railwaysService.getAdminReports();
        setReports(
          railReports.map((r) => ({
            id: r.id,
            tripId: r.movementId,
            movementId: r.movementId,
            vehicleRegistration: `${r.trainNumber} (${r.trainName || 'Rail'})`,
            driverName: r.locoPilotName,
            originLabel: r.originStationName,
            destinationLabel: r.destinationStationName,
            completedAt: r.completedAt,
            fileSizeBytes: r.fileSizeBytes,
            storagePath: r.storagePath,
            isRail: true,
          })),
        );
      } else if (mode === 'airways') {
        const airReports = await airwaysService.getAdminReports();
        setReports(
          airReports.map((r) => ({
            id: r.id,
            tripId: r.movementId,
            movementId: r.movementId,
            vehicleRegistration: `${r.flightNumber}`,
            driverName: r.pilotName,
            originLabel: `${r.originAirportName} (${r.originIataCode})`,
            destinationLabel: `${r.destinationAirportName} (${r.destIataCode})`,
            completedAt: r.completedAt,
            fileSizeBytes: r.fileSizeBytes,
            storagePath: r.storagePath,
            isAir: true,
          })),
        );
      } else if (mode === 'seaways') {
        const seaReports = await seawaysService.getAdminReports();
        setReports(
          seaReports.map((r) => ({
            id: r.id,
            tripId: r.movementId,
            movementId: r.movementId,
            vehicleRegistration: `${r.vesselName || 'MV Ocean Titan'} (${r.imoNumber || r.vesselType || 'Panamax'})`,
            driverName: r.masterName,
            originLabel: `${r.originPortName || 'Origin'} (${r.originPortCode || r.originUnlocode || ''})`,
            destinationLabel: `${r.destinationPortName || r.destPortName || 'Destination'} (${r.destPortCode || r.destUnlocode || ''})`,
            completedAt: r.completedAt,
            fileSizeBytes: r.fileSizeBytes,
            storagePath: r.storagePath,
            isSea: true,
          })),
        );
      } else {
        const data = await adminService.getReports();
        setReports(data);
      }
    } catch {
      toast.error('Failed to load completed movement/trip reports.');
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleOpenReport = async (report: any) => {
    const reportId = report.movementId || report.tripId;
    setOpeningTripId(reportId);
    try {
      let signedUrl = '';
      if (report.isSea || mode === 'seaways') {
        const seaRes = await seawaysService.getReportUrl(reportId);
        signedUrl = seaRes?.signedUrl || '';
      } else if (report.isAir || mode === 'airways') {
        const airRes = await airwaysService.getReportUrl(reportId);
        signedUrl = airRes?.signedUrl || '';
      } else if (report.isRail || mode === 'railways') {
        const railRes = await railwaysService.getReportUrl(reportId);
        signedUrl = railRes?.signedUrl || '';
      } else {
        const reportData = await tripsService.getTripReport(reportId);
        signedUrl = reportData?.signedUrl || '';
      }

      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Could not retrieve report download URL.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open audit report.');
    } finally {
      setOpeningTripId(null);
    }
  };

  const startEditUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    setEditFullName(user.fullName);
    setEditRole(user.role);
  };

  const handleSaveUser = async (userId: string) => {
    setIsUpdatingUser(true);
    try {
      const updated = await adminService.updateUser(userId, {
        fullName: editFullName,
        role: editRole,
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setEditingUserId(null);
      toast.success(`User ${updated.fullName} updated successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user.');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  return (
    <>
      {/* Admin Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenClick}
        className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm"
        aria-label="Open admin settings"
        data-testid="admin-trigger-button"
      >
        <Shield className="w-4 h-4 text-navy" />
        <span className="hidden sm:inline">Admin Panel</span>
      </Button>

      {/* 1. Step-up Password Re-entry Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-navy/10 rounded-lg text-navy">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Step-Up Authentication</h3>
                  <p className="text-xs text-slate-500">Re-enter your password to access admin controls</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <CardContent className="pt-6">
              <form onSubmit={handleVerifyPassword} className="space-y-4">
                {verifyError && (
                  <div
                    data-testid="verify-error"
                    className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2"
                  >
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Your Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPasswordModalOpen(false)}
                    disabled={isVerifying}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifying}
                    className="bg-navy hover:bg-navy/90 text-white"
                  >
                    {isVerifying ? 'Verifying...' : 'Unlock Admin Panel'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Admin Panel Full Modal */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-navy text-white rounded-xl shadow-md">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">Organization Administration</h2>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                      15m Step-Up Session Active
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Manage organization team members, roles, and {mode === 'railways' ? 'rail movement' : 'fleet trip'} audit reports
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAdminPanelOpen(false)}
                className="rounded-full text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              {/* User Directory Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-navy" />
                    <h3 className="font-bold text-slate-900">User Directory & Roles</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoadingUsers}>
                    {isLoadingUsers ? 'Loading...' : 'Refresh List'}
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-semibold">User / Email</th>
                        <th className="p-3 font-semibold">Role</th>
                        <th className="p-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-slate-400 text-xs">
                            {isLoadingUsers ? 'Loading users...' : 'No users found in this organization.'}
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50/70">
                            <td className="p-3">
                              {editingUserId === user.id ? (
                                <Input
                                  value={editFullName}
                                  onChange={(e) => setEditFullName(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              ) : (
                                <div>
                                  <div className="font-semibold text-slate-900">{user.fullName}</div>
                                  <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {editingUserId === user.id ? (
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                                  className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                                >
                                  <option value="manager">Manager</option>
                                  <option value="operator">Operator</option>
                                  <option value="driver">Driver</option>
                                  <option value="crew">Crew</option>
                                </select>
                              ) : (
                                <Badge variant="secondary" className="capitalize text-xs font-semibold">
                                  {user.role}
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {currentUserRole === 'manager' && (
                                <>
                                  {editingUserId === user.id ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveUser(user.id)}
                                        disabled={isUpdatingUser}
                                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Save</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingUserId(null)}
                                        className="h-7 px-2 text-xs"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditUser(user)}
                                      className="h-7 px-2 text-xs text-slate-600 hover:text-navy gap-1"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </Button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reports Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-navy" />
                    <h3 className="font-bold text-slate-900">
                      {mode === 'railways'
                        ? 'Completed Train Movement Reports'
                        : mode === 'airways'
                          ? 'Completed Flight Movement Reports'
                          : mode === 'seaways'
                            ? 'Completed Voyage Movement Reports'
                            : 'Completed Trip Reports'}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    {reports.length} report(s) archived
                  </span>
                </div>

                {isLoadingReports ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2 bg-slate-50 rounded-xl border border-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-navy" />
                    <span>Loading audit reports...</span>
                  </div>
                ) : reports.length === 0 ? (
                  <div
                    data-testid="reports-empty-state"
                    className="p-8 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center"
                  >
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-slate-700">
                      No completed trip reports yet
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Completed movement telemetry logs, PDF proof-of-delivery, and regulatory compliance audits will appear in this ledger.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm" data-testid="reports-table">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="p-3">
                            {mode === 'railways'
                              ? 'Train'
                              : mode === 'airways'
                                ? 'Aircraft'
                                : mode === 'seaways'
                                  ? 'Vessel'
                                  : 'Vehicle'}
                          </th>
                          <th className="p-3">
                            {mode === 'railways'
                              ? 'Loco Pilot'
                              : mode === 'airways'
                                ? 'Captain'
                                : mode === 'seaways'
                                  ? 'Master'
                                  : 'Driver'}
                          </th>
                          <th className="p-3">Route (Origin → Dest)</th>
                          <th className="p-3">Completed Date</th>
                          <th className="p-3">Size</th>
                          <th className="p-3 text-right">Audit PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reports.map((report) => (
                          <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-semibold font-mono text-slate-900">
                              {report.vehicleRegistration}
                            </td>
                            <td className="p-3 text-slate-700">
                              {report.driverName}
                            </td>
                            <td className="p-3 text-slate-600 max-w-[180px] truncate" title={`${report.originLabel} → ${report.destinationLabel}`}>
                              {report.originLabel} → {report.destinationLabel}
                            </td>
                            <td className="p-3 text-slate-500">
                              {new Date(report.completedAt).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {report.fileSizeBytes ? `${Math.round(report.fileSizeBytes / 1024)} KB` : 'PDF'}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReport(report)}
                                disabled={openingTripId === (report.movementId || report.tripId)}
                                className="h-7 px-2.5 text-xs text-navy border-slate-300 hover:bg-slate-100 gap-1"
                                data-testid={`view-report-btn-${report.movementId || report.tripId}`}
                              >
                                {openingTripId === (report.movementId || report.tripId) ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Opening...</span>
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink className="w-3 h-3" />
                                    <span>View PDF</span>
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between text-xs text-slate-500">
              <span>Security Level: High (HttpOnly Verified Token)</span>
              <Button variant="outline" size="sm" onClick={() => setIsAdminPanelOpen(false)}>
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
