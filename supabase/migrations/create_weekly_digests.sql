CREATE TABLE IF NOT EXISTS public.weekly_digests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_of DATE UNIQUE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data JSONB NOT NULL
);

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Weekly digests can be viewed by Managers and Superadmins" ON public.weekly_digests;
CREATE POLICY "Weekly digests can be viewed by Managers and Superadmins"
ON public.weekly_digests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Manager', 'Superadmin', 'Executive')
    )
);

DROP POLICY IF EXISTS "Weekly digests can be inserted by Managers and Superadmins" ON public.weekly_digests;
CREATE POLICY "Weekly digests can be inserted by Managers and Superadmins"
ON public.weekly_digests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Manager', 'Superadmin')
    )
);
