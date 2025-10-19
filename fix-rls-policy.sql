-- Fix RLS Policy for Users Table
-- This allows the trigger function to create user profiles during signup

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Create a new policy that allows:
-- 1. Users to insert their own profile (when authenticated)
-- 2. The trigger function to insert during signup (when no user is authenticated)
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (
  -- Allow authenticated users to insert their own profile
  (auth.uid() = id)
  OR
  -- Allow the trigger function to insert during signup (when no user is authenticated)
  (auth.uid() IS NULL AND auth.role() = 'service_role')
);

-- Also ensure users can read public profiles
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
CREATE POLICY "Users can view public profiles" ON users FOR SELECT USING (true);

-- Test the policy by checking if we can query the users table
SELECT COUNT(*) as user_count FROM users;
