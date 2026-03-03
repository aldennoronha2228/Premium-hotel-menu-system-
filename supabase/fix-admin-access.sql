-- ==============================================================================
-- FIX: "permission denied for table users" during AUTHZ_ADMIN_CHECK
-- ==============================================================================
-- This script fixes the issue where querying admin_users fails with a permissions 
-- error on the underlying auth.users table. This typically happens if admin_users 
-- was accidentally created as a view over auth.users, or if an RLS policy was 
-- attempting to query auth.users directly.

-- 1. Drop the table completely to ensure a clean slate
DROP TABLE IF EXISTS public.admin_users CASCADE;

-- 2. Recreate admin_users as a standard TABLE (NOT a view)
CREATE TABLE public.admin_users (
    email      TEXT PRIMARY KEY,
    full_name  TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 4. Create the correct RLS Policy
-- This uses auth.jwt() to securely get the email without querying auth.users!
CREATE POLICY "admin_users_auth_select_own"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (
        email = (auth.jwt() ->> 'email')
    );

-- 5. Revoke anon access for security
REVOKE ALL ON TABLE public.admin_users FROM anon;

-- 6. Grant authenticated access so the dashboard can read it
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

-- 7. Insert your specific admin account
-- We use the email from your error log to ensure you regain access immediately.
INSERT INTO public.admin_users (email, full_name, is_active)
VALUES ('aldenengineeringentranceexam@gmail.com', 'Alden', true)
ON CONFLICT (email) DO UPDATE SET is_active = true;
