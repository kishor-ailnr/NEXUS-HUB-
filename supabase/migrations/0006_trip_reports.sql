-- ==========================================
-- Phase 6: Trip Reports & Supabase Storage
-- ==========================================

-- 1. Create trip_reports table
CREATE TABLE IF NOT EXISTS public.trip_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_size_bytes INT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_trip_report_trip UNIQUE (trip_id)
);

-- 2. Indexes for efficient lookup & admin listing
CREATE INDEX IF NOT EXISTS idx_trip_reports_org ON public.trip_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_trip_reports_trip ON public.trip_reports(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_reports_generated_at ON public.trip_reports(generated_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.trip_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for trip_reports select" ON public.trip_reports
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM public.users WHERE users.id = auth.uid()
        )
    );

CREATE POLICY "Tenant isolation for trip_reports insert" ON public.trip_reports
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM public.users WHERE users.id = auth.uid()
        )
    );

-- 4. Supabase Storage Bucket Setup (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trip-pdfs', 'trip-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
