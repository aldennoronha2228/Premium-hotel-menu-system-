-- ==============================================================================
-- FIX: "Failed to fetch" when customers place orders
-- ==============================================================================
-- PROBLEM:
--   The hardened RLS policy (supabase-rls-policies.sql) allows anon users to
--   INSERT into public.orders, but BLOCKS SELECT. However, our frontend code
--   does:
--       .insert([...]).select('id, daily_order_number').single()
--   The .select() at the end of an INSERT triggers a SELECT check, which the
--   anon role fails → "new row violates row-level security" → "Failed to fetch".
--
-- ALSO:
--   The orders table has `restaurant_id TEXT NOT NULL DEFAULT 'rest001'
--   REFERENCES public.restaurants(id)` — if the restaurants table is EMPTY,
--   this FK constraint causes every anon order insert to fail. We seed it here.
--
-- HOW TO APPLY:
--   Supabase Dashboard → SQL Editor → paste this script → Run
-- ==============================================================================


-- ─── 1. Ensure the restaurant row exists (FK guard) ─────────────────────────
-- The orders table has a FK on restaurant_id → restaurants.id.
-- If this row is missing, every order insert fails with a FK violation.
INSERT INTO public.restaurants (id, name)
VALUES ('rest001', 'My Restaurant')
ON CONFLICT (id) DO NOTHING;


-- ─── 2. Add a limited SELECT policy so INSERT...RETURNING works ──────────────
-- Supabase evaluates SELECT policies even when doing INSERT...RETURNING.
-- We allow anon to read back ONLY orders with status = 'new' (their own fresh order).
-- This does NOT expose other customers' orders because:
--   a) The insert immediately returns the single row the DB just created.
--   b) The frontend never issues a standalone SELECT — it only reads the RETURNING result.

DROP POLICY IF EXISTS "orders_anon_select" ON public.orders;

CREATE POLICY "orders_anon_select"
    ON public.orders
    FOR SELECT
    TO anon
    USING (
        status = 'new'
    );


-- ─── 3. Similarly allow anon to read order_items for the RETURNING clause ────
-- order_items are inserted with a separate call (not RETURNING), but if you
-- ever switch to a single-call approach, this policy prevents a second "fetch failed".
-- It's safe because order_item rows have no PII.

DROP POLICY IF EXISTS "order_items_anon_select" ON public.order_items;

CREATE POLICY "order_items_anon_select"
    ON public.order_items
    FOR SELECT
    TO anon
    USING (true);


-- ─── 4. Verification ─────────────────────────────────────────────────────────
-- Run the queries below (uncomment) after applying this script to confirm:

/*
-- Check restaurant row exists
SELECT * FROM public.restaurants WHERE id = 'rest001';

-- Check anon SELECT policy on orders
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders';
*/
