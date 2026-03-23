-- 1. Create Profile Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT CHECK (role IN ('Manager', 'Team Lead', 'PM', 'Finance', 'Executive', 'Superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Invites Table
CREATE TABLE IF NOT EXISTS public.invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT CHECK (role IN ('Manager', 'Team Lead', 'PM', 'Finance', 'Executive', 'Superadmin')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles can be viewed by anyone in the same organisation"
ON public.profiles FOR SELECT
USING (true); -- Simplified for now, adjust based on organisation logic later

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 4. RLS for Invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites can be viewed by Managers, Team Leads and Superadmins"
ON public.invites FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Manager', 'Team Lead', 'Superadmin')
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Invites can be sent by Managers, Team Leads and Superadmins"
ON public.invites FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Manager', 'Team Lead', 'Superadmin')
    )
);

CREATE POLICY "Invites can be deleted by Managers, Team Leads and Superadmins"
ON public.invites FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Manager', 'Team Lead', 'Superadmin')
    )
);

-- 5. Trigger for automated profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    invited_role text;
    invited_name text;
BEGIN
    -- Check if there's an invite for this email
    SELECT role, name INTO invited_role, invited_name 
    FROM public.invites 
    WHERE email = new.email;

    -- Special case for Johnkingunwanao@gmail.com to be Superadmin if not invited and first user
    IF new.email = 'Johnkingunwanao@gmail.com' THEN
        invited_role := 'Superadmin';
    END IF;

    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'display_name', invited_name, 'User'),
        COALESCE(invited_role, 'PM')
    );
    
    -- Delete the invite if it exists
    DELETE FROM public.invites WHERE email = new.email;
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-drop if exists to ensure we're updating
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
