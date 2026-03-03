-- ============================================================
-- Hotel Menu — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 0. RESTAURANTS
CREATE TABLE IF NOT EXISTS public.restaurants (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT
);

-- 0.5 ADMIN USERS
CREATE TABLE IF NOT EXISTS public.admin_users (
    email      TEXT PRIMARY KEY,
    full_name  TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 1. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_order INT DEFAULT 0
);

-- 2. MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    price       NUMERIC(10,2) NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type        TEXT CHECK (type IN ('veg','non-veg')) DEFAULT 'veg',
    image_url   TEXT,
    available   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_order_number SERIAL,
    restaurant_id      TEXT NOT NULL DEFAULT 'rest001' REFERENCES public.restaurants(id),
    table_number       TEXT NOT NULL,
    total              NUMERIC(10,2) NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','preparing','done','paid','cancelled')),
    user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ORDER ITEMS  (linked to orders; item details copied at order time)
CREATE TABLE IF NOT EXISTS public.order_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name    TEXT NOT NULL,
    item_price   NUMERIC(10,2) NOT NULL,
    quantity     INT NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "public_read_categories"  ON public.categories;
DROP POLICY IF EXISTS "public_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "public_update_categories" ON public.categories;
DROP POLICY IF EXISTS "public_delete_categories" ON public.categories;

DROP POLICY IF EXISTS "public_read_menu_items"  ON public.menu_items;
DROP POLICY IF EXISTS "public_insert_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "public_update_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "public_delete_menu_items" ON public.menu_items;

DROP POLICY IF EXISTS "public_insert_orders"    ON public.orders;
DROP POLICY IF EXISTS "public_read_orders"      ON public.orders;
DROP POLICY IF EXISTS "auth_update_orders"      ON public.orders;
DROP POLICY IF EXISTS "auth_delete_orders"      ON public.orders;
DROP POLICY IF EXISTS "public_insert_oi"        ON public.order_items;
DROP POLICY IF EXISTS "public_read_oi"          ON public.order_items;

-- Categories: public CRUD
CREATE POLICY "public_read_categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "public_insert_categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "public_delete_categories" ON public.categories FOR DELETE USING (true);

-- Menu items: public CRUD
CREATE POLICY "public_read_menu_items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "public_insert_menu_items" ON public.menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_menu_items" ON public.menu_items FOR UPDATE USING (true);
CREATE POLICY "public_delete_menu_items" ON public.menu_items FOR DELETE USING (true);

-- Orders: anyone can INSERT (customer places order), anyone can SELECT (dashboard reads), auth can UPDATE/DELETE
CREATE POLICY "public_insert_orders" ON public.orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read_orders" ON public.orders
    FOR SELECT USING (true);

CREATE POLICY "auth_update_orders" ON public.orders
    FOR UPDATE USING (true);

CREATE POLICY "auth_delete_orders" ON public.orders
    FOR DELETE USING (true);

-- Order items: same pattern
CREATE POLICY "public_insert_oi" ON public.order_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read_oi" ON public.order_items
    FOR SELECT USING (true);

-- ============================================================
-- REALTIME  (lets the dashboard receive live order updates)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;


-- ============================================================
-- SEED — sample categories & menu items (optional, delete if not needed)
-- ============================================================
INSERT INTO public.restaurants (id, name) VALUES
    ('rest001', 'My Restaurant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (name, display_order) VALUES
    ('Breakfast',    1),
    ('Appetizers',   2),
    ('Main Course',  3),
    ('Desserts',     4),
    ('Beverages',    5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.menu_items (name, price, category_id, type, available) VALUES
    ('Classic Eggs Benedict',  18.50, (SELECT id FROM public.categories WHERE name='Breakfast'),   'non-veg', true),
    ('Avocado Toast Deluxe',   16.00, (SELECT id FROM public.categories WHERE name='Breakfast'),   'veg',     true),
    ('Pancake Stack',          14.00, (SELECT id FROM public.categories WHERE name='Breakfast'),   'veg',     true),
    ('Continental Breakfast',  12.00, (SELECT id FROM public.categories WHERE name='Breakfast'),   'veg',     true),
    ('Lobster Bisque',         16.00, (SELECT id FROM public.categories WHERE name='Appetizers'),  'non-veg', true),
    ('Burrata & Tomatoes',     18.00, (SELECT id FROM public.categories WHERE name='Appetizers'),  'veg',     true),
    ('Crispy Calamari',        15.00, (SELECT id FROM public.categories WHERE name='Appetizers'),  'non-veg', true),
    ('Grilled Ribeye Steak',   48.00, (SELECT id FROM public.categories WHERE name='Main Course'), 'non-veg', true),
    ('Pan-Seared Salmon',      36.00, (SELECT id FROM public.categories WHERE name='Main Course'), 'non-veg', true),
    ('Mushroom Risotto',       28.00, (SELECT id FROM public.categories WHERE name='Main Course'), 'veg',     true),
    ('Crème Brûlée',           12.00, (SELECT id FROM public.categories WHERE name='Desserts'),    'veg',     true),
    ('Chocolate Lava Cake',    14.00, (SELECT id FROM public.categories WHERE name='Desserts'),    'veg',     true),
    ('Fresh Juice Bar',         8.00, (SELECT id FROM public.categories WHERE name='Beverages'),   'veg',     true),
    ('Artisan Coffee',          6.00, (SELECT id FROM public.categories WHERE name='Beverages'),   'veg',     true)
ON CONFLICT DO NOTHING;
