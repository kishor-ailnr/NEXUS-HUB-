-- Migration 0014: Platform Hub Stats Indexing
-- Optimizes cross-org aggregate count queries for active movements across all modes

CREATE INDEX IF NOT EXISTS idx_trips_status_in_transit ON trips(status) WHERE status = 'in_transit';
CREATE INDEX IF NOT EXISTS idx_train_movements_status_in_transit ON train_movements(status) WHERE status = 'in_transit';
CREATE INDEX IF NOT EXISTS idx_flight_movements_status_in_transit ON flight_movements(status) WHERE status = 'in_transit';
CREATE INDEX IF NOT EXISTS idx_voyage_movements_status_in_transit ON voyage_movements(status) WHERE status = 'in_transit';
