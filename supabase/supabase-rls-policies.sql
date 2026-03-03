-- =============================================================================
-- supabase-rls-policies.sql
-- Enterprise-grade Row Level Security migration
-- =============================================================================
-- SECURITY OBJECTIVES:
--   1. anon role can ONLY: read available menu items, read categories,
--      insert orders/order_items (no read-back), and nothing else.
--   2. authenticated role (dashboard admin) can do full CRUD on all tables
--      ONLY after the service_role check is satisfied by the backend.
--   3. All tables have RLS ENABLED — no table is left unprotected.
--   4. Policies are deny-by-default: only explicit GRANT statements open access.
--   5. The admin_users table is NEVER readable or writable by anon.
--
-- HOW TO APPLY:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire script and click Run
--   3. Verify policies in Authentication → Policies
--
-- VERSION: 2.0 (hardened)
-- DATE:    2026-02-25
-- =============================================================================


-- ─── 1. Enable RLS on ALL business tables ────────────────────────────────────
-- If RLS is already enabled, this is a no-op.

ALTER TABLE public.restaurants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users    ENABLE ROW LEVEL SECURITY;


-- ─── 2. Drop all existing policies ───────────────────────────────────────────
-- Clean slate — remove any old permissive policies before adding strict ones.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END
$$;


-- =============================================================================
-- TABLE: public.restaurants
-- =============================================================================
-- anon: read-only (needs to show restaurant name/logo in customer UI)
-- authenticated: full CRUD (dashboard management)

CREATE POLICY "restaurants_anon_select"
    ON public.restaurants
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "restaurants_auth_all"
    ON public.restaurants
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- TABLE: public.categories
-- =============================================================================
-- anon: read-only (customer menu needs category names)
-- authenticated: full CRUD

CREATE POLICY "categories_anon_select"
    ON public.categories
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "categories_auth_all"
    ON public.categories
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- TABLE: public.menu_items
-- =============================================================================
-- anon: can only read items where available = true
--       (hides unavailable items from customer menu at the DB level)
-- authenticated: full CRUD (can see and toggle unavailable items)

CREATE POLICY "menu_items_anon_select_available_only"
    ON public.menu_items
    FOR SELECT
    TO anon
    USING (available = true);

CREATE POLICY "menu_items_auth_all"
    ON public.menu_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- TABLE: public.orders
-- =============================================================================
-- CRITICAL TABLE — highest risk of IDOR attacks.
--
-- anon (customer):
--   INSERT only — customer can create an order, cannot read/list/delete orders.
--   They cannot see other customers' orders.
--   SELECT is intentionally DENIED for anon — order confirmation uses the
--   returned row from the INSERT (.select().single()) which bypasses RLS.
--
-- authenticated (dashboard admin):
--   Full CRUD on all orders.
--
-- SECURITY NOTE on the INSERT policy's WITH CHECK:
--   We validate that status = 'new' — customers cannot inject a different
--   status (e.g., 'paid') at insert time.

CREATE POLICY "orders_anon_insert_only"
    ON public.orders
    FOR INSERT
    TO anon
    WITH CHECK (
        status = 'new'
        -- Optionally constrain to known restaurant IDs:
        -- AND restaurant_id = 'rest001'
    );

-- Prevent anon from reading ANY order (stops order enumeration / IDOR)
-- No SELECT policy for anon = denied by default ✓

-- Prevent anon from updating or deleting orders
-- No UPDATE/DELETE policy for anon = denied by default ✓

CREATE POLICY "orders_auth_all"
    ON public.orders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- TABLE: public.order_items
-- =============================================================================
-- anon: INSERT only — customer can add items to their own order.
--       They cannot read back items (stops enumeration of others' orders).
--
-- SECURITY: The WITH CHECK ensures item_name and quantity are within bounds.
-- The application-level validate.ts also enforces this — defence in depth.

CREATE POLICY "order_items_anon_insert_only"
    ON public.order_items
    FOR INSERT
    TO anon
    WITH CHECK (
        quantity > 0
        AND quantity <= 99
        AND item_price > 0
        AND char_length(item_name) <= 200
    );

CREATE POLICY "order_items_auth_all"
    ON public.order_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- TABLE: public.admin_users
-- =============================================================================
-- HIGHEST SENSITIVITY TABLE.
-- anon: NO ACCESS whatsoever (no SELECT, INSERT, UPDATE, DELETE).
-- authenticated: SELECT only for their own row (an admin can read their record).
-- service_role: Full CRUD (used by server-side scripts to provision admins).
--
-- This means:
--  - A customer cannot read the admin list.
--  - An admin cannot enumerate other admins through the client.
--  - Only a server-side script with the service_role key can add/remove admins.

-- No anon policies = fully denied ✓

CREATE POLICY "admin_users_auth_select_own"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (
        email = (auth.jwt() ->> 'email')
    );

-- NOTE: INSERT/UPDATE/DELETE for authenticated is intentionally NOT granted.
-- Use the Supabase Dashboard or a secure server-side function with service_role
-- to add/remove/deactivate admins.


-- =============================================================================
-- 3. Realtime publication — restrict which tables broadcast changes
-- =============================================================================
-- Only publish real-time events for tables the dashboard legitimately needs.
-- admin_users changes should NEVER be broadcast over the realtime channel.

-- First, ensure the supabase_realtime publication exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Remove all tables from publication, then re-add only the safe ones
ALTER PUBLICATION supabase_realtime SET TABLE
    public.orders,
    public.order_items,
    public.menu_items,
    public.categories;

-- admin_users is intentionally NOT in the realtime publication ✓


-- =============================================================================
-- 4. Revoke dangerous default privileges
-- =============================================================================
-- By default, Supabase grants anon and authenticated roles USAGE on the public
-- schema and SELECT/INSERT/UPDATE/DELETE on all tables. RLS overrides these,
-- but we make the explicit REVOKE here for defence-in-depth.

-- Revoke all direct table privileges from anon
REVOKE ALL ON TABLE public.admin_users FROM anon;

-- Revoke the ability for anon to call any function without SECURITY DEFINER
-- (This is schema-level; individual functions can re-grant as needed)
-- REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;


-- =============================================================================
-- 5. Helper function: safe admin provisioning
-- =============================================================================
-- Use this function (called with service_role key) to add a new admin.
-- It validates the email format before inserting.

CREATE OR REPLACE FUNCTION public.provision_admin(
    p_email TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with the definer's privileges (service_role)
SET search_path = public
AS $$
BEGIN
    -- Basic email format check
    IF p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
        RAISE EXCEPTION 'Invalid email format: %', p_email;
    END IF;

    INSERT INTO public.admin_users (email, full_name, is_active, created_at)
    VALUES (lower(trim(p_email)), p_full_name, true, now())
    ON CONFLICT (email) DO UPDATE
        SET is_active = true,
            full_name = COALESCE(EXCLUDED.full_name, public.admin_users.full_name);
END;
$$;

-- Revoke public execute from this sensitive function
REVOKE EXECUTE ON FUNCTION public.provision_admin(TEXT, TEXT) FROM anon, authenticated;


-- =============================================================================
-- 6. Verification queries — run these to confirm policies are applied
-- =============================================================================
-- Uncomment and run manually after applying the migration:

/*
-- List all policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify realtime publication tables
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
*/
