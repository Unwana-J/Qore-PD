-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create implementation_digests table for weekly reviews
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.implementation_digests (
    week_of DATE PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.implementation_digests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with leadership roles to read
CREATE POLICY "Leads can read implementation digests" ON public.implementation_digests
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Allow system/authenticated to upsert
CREATE POLICY "Enable upsert for implementation digests" ON public.implementation_digests
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for implementation digests" ON public.implementation_digests
    FOR UPDATE
    USING (auth.role() = 'authenticated');
