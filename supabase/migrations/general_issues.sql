-- Create general_issues table
CREATE TABLE IF NOT EXISTS public.general_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    impact TEXT NOT NULL CHECK (impact IN ('Low', 'Medium', 'High')),
    category TEXT,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Addressing', 'Closed')),
    affected_services TEXT[] DEFAULT '{}',
    affected_extension_ids UUID[] DEFAULT '{}',
    notes TEXT,
    logged_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.general_issues ENABLE ROW LEVEL SECURITY;

-- Create policy for all users to read
CREATE POLICY "Enable read access for all users" ON public.general_issues
    FOR SELECT USING (true);

-- Create policy for all users to insert
CREATE POLICY "Enable insert for all users" ON public.general_issues
    FOR INSERT WITH CHECK (true);

-- Create policy for all users to update
CREATE POLICY "Enable update for all users" ON public.general_issues
    FOR UPDATE USING (true);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.general_issues;
