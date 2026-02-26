-- Create Enums
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
CREATE TYPE relationship_type_enum AS ENUM ('marriage', 'biological_child', 'adopted_child');
CREATE TYPE user_role_enum AS ENUM ('admin', 'member');

-- Create Tables

-- PROFILES (Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role_enum DEFAULT 'member' NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERSONS
CREATE TABLE persons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  gender gender_enum NOT NULL,
  birth_year INT,
  birth_month INT,
  birth_day INT,
  death_year INT,
  death_month INT,
  death_day INT,
  is_deceased BOOLEAN NOT NULL DEFAULT FALSE,
  is_in_law BOOLEAN NOT NULL DEFAULT FALSE,
  birth_order INT,
  generation INT,
  avatar_url TEXT,
  note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERSON_DETAILS_PRIVATE
CREATE TABLE person_details_private (
  person_id UUID REFERENCES persons(id) ON DELETE CASCADE PRIMARY KEY,
  phone_number TEXT,
  occupation TEXT,
  current_residence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RELATIONSHIPS
CREATE TABLE relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type relationship_type_enum NOT NULL,
  person_a UUID REFERENCES persons(id) ON DELETE CASCADE NOT NULL,
  person_b UUID REFERENCES persons(id) ON DELETE CASCADE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique relationships between pairs
  UNIQUE(person_a, person_b, type)
);

-- INDEXES

-- Optimize relationship queries (Finding parents, children, spouses)
CREATE INDEX IF NOT EXISTS idx_relationships_person_a ON relationships(person_a);
CREATE INDEX IF NOT EXISTS idx_relationships_person_b ON relationships(person_b);

-- Optimize person searches
CREATE INDEX IF NOT EXISTS idx_persons_full_name ON persons(full_name);

-- RLS POLICIES

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_details_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- PERSONS POLICIES
-- Everyone (Authenticated) can view persons
CREATE POLICY "Enable read access for authenticated users" ON persons
  FOR SELECT TO authenticated USING (true);

-- Admins can insert/update/delete persons
CREATE POLICY "Admins can insert persons" ON persons
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update persons" ON persons
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete persons" ON persons
  FOR DELETE TO authenticated USING (is_admin());

-- PERSON_DETAILS_PRIVATE POLICIES
-- Admins can view private details
CREATE POLICY "Admins can view private details" ON person_details_private
  FOR SELECT TO authenticated USING (is_admin());

-- Admins can manage private details
CREATE POLICY "Admins can manage private details" ON person_details_private
  FOR ALL TO authenticated USING (is_admin());

-- RELATIONSHIPS POLICIES
CREATE POLICY "Enable read access for authenticated users" ON relationships
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage relationships" ON relationships
  FOR ALL TO authenticated USING (is_admin());

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Check if this is the first user in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO is_first_user;

  INSERT INTO public.profiles (id, role, is_active)
  VALUES (
    new.id, 
    CASE WHEN is_first_user THEN 'admin'::public.user_role_enum ELSE 'member'::public.user_role_enum END,
    CASE WHEN is_first_user THEN true ELSE false END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- STORAGE POLICIES

-- Ensure the 'avatars' bucket exists and is public
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public access for viewing avatars
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload new avatars
CREATE POLICY "Users can upload avatars."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Allow authenticated users to update existing avatars
CREATE POLICY "Users can update avatars."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Allow authenticated users to delete avatars
CREATE POLICY "Users can delete avatars."
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- DATABASE FUNCTIONS FOR ADMIN (USER MANAGEMENT)

-- Custom type for get_admin_users
CREATE TYPE public.admin_user_data AS (
    id uuid,
    email text,
    role public.user_role_enum,
    created_at timestamptz,
    is_active boolean
);

-- 1. Get Admin Users
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS SETOF public.admin_user_data
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Only admins can access this function.';
    END IF;

    RETURN QUERY
    SELECT 
        au.id, 
        au.email::text, 
        p.role, 
        au.created_at,
        p.is_active
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    ORDER BY au.created_at DESC;
END;
$$;

-- 2. Set User Role
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Only admins can access this function.';
    END IF;

    UPDATE public.profiles
    SET role = new_role::public.user_role_enum, updated_at = now()
    WHERE id = target_user_id;
END;
$$;

-- 3. Delete User
CREATE OR REPLACE FUNCTION public.delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Only admins can access this function.';
    END IF;
    
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot delete your own account from the admin panel.';
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Note: Supabase uses pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. Admin Create User
CREATE OR REPLACE FUNCTION public.admin_create_user(new_email text, new_password text, new_role text, new_active boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_id uuid;
BEGIN
    -- Only admin can run this
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Only admins can access this function.';
    END IF;

    -- Generate a new UUID for the user
    new_id := gen_random_uuid();

    -- Insert into auth.users using extensions.crypt and extensions.gen_salt
    INSERT INTO auth.users (
        id, 
        instance_id,
        aud, 
        role, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        recovery_sent_at, 
        last_sign_in_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        created_at, 
        updated_at, 
        confirmation_token, 
        email_change, 
        email_change_token_new, 
        recovery_token
    )
    VALUES (
        new_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        new_email,
        extensions.crypt(new_password, extensions.gen_salt('bf')),
        now(),
        NULL,
        NULL,
        '{"provider":"email","providers":["email"]}',
        '{}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, role, is_active, created_at, updated_at)
    VALUES (new_id, new_role::public.user_role_enum, new_active, now(), now())
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;
    
    RETURN new_id;
END;
$$;

-- 5. Set User Active Status
CREATE OR REPLACE FUNCTION public.set_user_active_status(target_user_id uuid, new_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Only admins can access this function.';
    END IF;

    UPDATE public.profiles
    SET is_active = new_status, updated_at = now()
    WHERE id = target_user_id;
END;
$$;

