import React, { useEffect, useState } from 'react';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Trip, TripEtaResponse, DriverBehaviorScore } from '@nexus-ways/shared';
import { tripsApi } from '../services/trips';
import { driversApi } from '../services/drivers';
import { toast } from 'sonner';

interface TripDetailsPanelProps {
  trip: Trip;
  onClose: () => void;
}

export const TripDetailsPanel: React.FC<TripDetailsPanelProps> = ({ trip, onClose }) => {
  const [eta, setEta] = useState<TripEtaResponse | null>(null);
  const [loadingEta, setLoadingEta] = useState<boolean>(false);
  const [driverScores, setDriverScores] = useState<DriverBehaviorScore[]>([]);
  const [loadingScores, setLoadingScores] = useState<boolean>(false);
  const [isOpeningReport, setIsOpeningReport] = useState<boolean>(false);

  useEffect(() => {
    if (trip?.id) {
      setLoadingEta(true);
      tripsApi.getTripEta(trip.id)
        .then((res: TripEtaResponse) => setEta(res))
        .catch((err: any) => console.error('Failed to load ETA:', err))
        .finally(() => setLoadingEta(false));

      if (trip.driver_id) {
        setLoadingScores(true);
        driversApi.getBehaviorHistory(trip.driver_id)
          .then((res: DriverBehaviorScore[]) => setDriverScores(res))
          .catch((err: any) => console.error('Failed to load driver behavior history:', err))
          .finally(() => setLoadingScores(false));
      }
    }
  }, [trip?.id, trip?.driver_id]);

  const latestScore = driverScores.length > 0 ? driverScores[0] : null;

  const handleViewReport = async () => {
    setIsOpeningReport(true);
    try {
      const data = await tripsApi.getTripReport(trip.id);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Could not retrieve report URL.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch trip report.');
    } finally {
      setIsOpeningReport(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 border-l border-slate-700/80 shadow-2xl p-6 z-40 overflow-y-auto backdrop-blur-md text-slate-100 flex flex-col">
      <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 mb-4">
        <div>
          <h2 className="text-lg font-bold text-emerald-400 tracking-wide">Trip Intelligence</h2>
          <span className="text-xs text-slate-400 font-mono">ID: {trip.id.substring(0, 8)}...</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-5 flex-1">
        {/* Route Info */}
        <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/50">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Route & Status</div>
          <div className="text-sm font-medium text-white mb-1">
            {trip.origin_label || 'Origin'} <span className="text-slate-400">→</span> {trip.destination_label || 'Destination'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
              trip.status === 'in_transit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              trip.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              'bg-slate-700 text-slate-300'
            }`}>
              {trip.status.replace('_', ' ')}
            </span>
            {trip.distance_km && (
              <span className="text-xs text-slate-300">{Number(trip.distance_km).toFixed(1)} km</span>
            )}
          </div>

          {/* Phase 6: View Report button on completed trips */}
          {trip.status === 'completed' && (
            <div className="pt-3 border-t border-slate-700/40 mt-3">
              <button
                onClick={handleViewReport}
                disabled={isOpeningReport}
                data-testid="view-trip-report-btn"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {isOpeningReport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Opening PDF Report...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>View PDF Report</span>
                    <ExternalLink className="w-3 h-3 ml-auto opacity-75" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ETA & Confidence Interval */}
        <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ETA & Confidence Band</span>
            {eta && (
              <span
                data-testid="confidence-basis-badge"
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  eta.confidence_basis === 'historical'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-700/60 text-slate-300 border-slate-600'
                }`}
              >
                {eta.confidence_basis === 'historical'
                  ? `based on ${eta.sample_size} prior trips on this route`
                  : 'default estimate — no route history yet'}
              </span>
            )}
          </div>

          {loadingEta ? (
            <div className="text-xs text-slate-400 py-2 animate-pulse">Calculating ETA confidence interval...</div>
          ) : eta ? (
            <div className="space-y-2 mt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Base Remaining ETA:</span>
                <span className="text-base font-bold text-white font-mono">
                  {eta.base_eta_minutes} min
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Remaining Distance:</span>
                <span className="text-slate-200 font-mono">
                  {Number(eta.remaining_distance_km).toFixed(1)} km
                </span>
              </div>
              <div className="p-2.5 bg-slate-900/80 rounded border border-slate-700/60 text-xs">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Confidence Window:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {eta.min_eta_minutes} – {eta.max_eta_minutes} min
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {eta.confidence_basis === 'historical' ? (
                    <span>StdDev ±{eta.confidence_band_minutes}m from {eta.sample_size} historical completions.</span>
                  ) : (
                    <span>Default heuristic (±15% / ±{eta.confidence_band_minutes}m). Sample size: {eta.sample_size}.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">ETA data unavailable</div>
          )}
        </div>

        {/* Driver Behavior Scoring */}
        <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Driver Safety Score</span>
            <span className="text-[10px] text-slate-500">Telemetry Rule-Based</span>
          </div>

          {loadingScores ? (
            <div className="text-xs text-slate-400 py-2 animate-pulse">Loading telemetry behavior metrics...</div>
          ) : latestScore ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-extrabold font-mono text-emerald-400">
                  {latestScore.score}
                  <span className="text-sm font-normal text-slate-400">/100</span>
                </div>
                <div className="text-right text-xs">
                  <div className="text-amber-400 font-medium">Harsh Brakes: {latestScore.harsh_brake_count}</div>
                  <div className="text-rose-400 font-medium">Speeding Events: {latestScore.speeding_event_count}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-700/40">
                Formula: <code className="text-slate-300 font-mono">100 - (10 × brakes) - (5 × speedings)</code> floored at 0.
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              No behavior score computed yet (evaluates upon trip completion from recorded GPS points).
            </div>
          )}
        </div>

        {/* Carbon & Toll Intelligence */}
        <div className="grid grid-cols-2 gap-3">
          {/* Carbon Card */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50 group relative">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Carbon (CO₂e)</span>
              <span className="cursor-help text-slate-500 hover:text-emerald-400 text-xs">ℹ</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {trip.carbon_kg != null ? `${Number(trip.carbon_kg).toFixed(1)} kg` : 'Pending'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              GLEC Framework 2023
            </div>

            {/* Tooltip on hover */}
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-56 p-2 bg-slate-950 border border-slate-700 text-[11px] text-slate-300 rounded shadow-xl z-50">
              <span className="font-semibold text-emerald-400">Factor:</span> 0.101 kg CO₂e / tonne-km (Smart Freight Centre GLEC Framework v3.0, Module 1 Table 2.1 for 34–40t articulated truck).
            </div>
          </div>

          {/* Toll Card */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50 group relative">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Highway Toll</span>
              <span className="cursor-help text-slate-500 hover:text-blue-400 text-xs">ℹ</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {trip.toll_estimate_inr != null ? `₹${Number(trip.toll_estimate_inr).toFixed(0)}` : 'Pending'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Estimated Toll (approx)
            </div>

            {/* Tooltip on hover */}
            <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-950 border border-slate-700 text-[11px] text-slate-300 rounded shadow-xl z-50">
              <span className="font-semibold text-blue-400">Note:</span> Estimated toll (~₹5.50/km) — approximate; not sourced from a verified current NHAI rate table.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
