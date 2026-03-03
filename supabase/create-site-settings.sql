-- migration: Create site_settings table for global access toggle
-- This table will store global configuration that applies to the entire website.

CREATE TABLE IF NOT EXISTS site_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert the initial 'is_site_public' setting.
-- If it already exists, do nothing.
INSERT INTO site_settings (key, value)
VALUES ('is_site_public', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- SECURITY: Enable Row Level Security (RLS)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- 1. Allow EVERYONE (even non-logged-in users) to READ the settings.
-- This is necessary so the website can check if it should show the "Maintenance" page.
CREATE POLICY "Allow public read access to site_settings"
ON site_settings FOR SELECT
USING (true);

-- 2. Allow only service_role (our server-side admin client) to MODIFY settings.
-- This ensures that customers or unauthorized users cannot flip the "Public Access" toggle.
CREATE POLICY "Allow service_role full access to site_settings"
ON site_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Explanation:
-- PostgreSQL 'JSONB' allows us to store different types of settings (booleans, strings, objects) 
-- in a single table without changing the schema every time we add a new feature.
