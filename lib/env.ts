/**
 * lib/env.ts
 * -----------
 * SECURITY: Fail-fast environment validation.
 *
 * Threats mitigated:
 *  - App booting with missing credentials (silent data leakage / misconfiguration)
 *  - Dangerously-open CORS / QR base-URL defaults reaching production
 *  - Accidental exposure of server-only secrets in client bundles
 *
 * This module is imported by lib/supabase.ts so it runs on every cold start.
 * Server-only vars (no NEXT_PUBLIC_ prefix) must only be used in this file
 * and server-side code; Next.js tree-shakes them out of client bundles.
 */

const REQUIRED_PUBLIC: string[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_RESTAURANT_ID',
];

function assertEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(
            `[env] Missing required environment variable: ${key}. ` +
            `Set it in .env.local (development) or your hosting platform (production).`
        );
    }
    return value.trim();
}

function validateSupabaseUrl(url: string): void {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            // Allow http only in local dev
            if (process.env.NODE_ENV === 'production') {
                throw new Error('[env] NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production.');
            }
        }
        if (!parsed.hostname.includes('supabase')) {
            // Warn if pointing at a non-Supabase host (can be a custom domain — not fatal)
            console.warn('[env] NEXT_PUBLIC_SUPABASE_URL does not appear to be a Supabase host. Ensure this is intentional.');
        }
    } catch (e: any) {
        if (e.message.startsWith('[env]')) throw e;
        throw new Error(`[env] NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${url}`);
    }
}

function validateAnonKey(key: string): void {
    // Supabase anon keys come in two formats:
    //  - Legacy JWT format: starts with "eyJ" (base64-encoded JSON header)
    //  - New publishable key format: starts with "sb_publishable_"
    const isLegacyJwt = key.startsWith('eyJ');
    const isPublishableKey = key.startsWith('sb_publishable_') || key.startsWith('sb_');
    if (!isLegacyJwt && !isPublishableKey) {
        throw new Error(
            '[env] NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a valid Supabase key. ' +
            'Expected a JWT (eyJ...) or publishable key (sb_publishable_...). ' +
            'Check your Supabase project settings.'
        );
    }
}

export function validateEnv(): void {
    // IMPORTANT: Only validate on the server (Node.js).
    // On the client, Next.js statically inlines NEXT_PUBLIC_* values at bundle
    // time — process.env is not populated during client-side module evaluation,
    // so running assertEnv() in the browser always fails even with a correct .env.
    if (typeof window !== 'undefined') return;

    if (process.env.SKIP_ENV_VALIDATION === 'true') return;

    for (const key of REQUIRED_PUBLIC) {
        assertEnv(key);
    }

    validateSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    validateAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // Warn (don't throw) about insecure defaults in production
    if (process.env.NODE_ENV === 'production') {
        const baseUrl = process.env.NEXT_PUBLIC_MENU_BASE_URL ?? '';
        if (!baseUrl || baseUrl.includes('localhost') || baseUrl.startsWith('http://')) {
            console.warn(
                '[env] WARNING: NEXT_PUBLIC_MENU_BASE_URL is using an insecure or localhost value in production. ' +
                'Update it to your production HTTPS domain.'
            );
        }
    }
}

// Derived, typed env accessors — safe to use on both client and server.
// On the client, Next.js statically replaces these at build time (no process.env needed).
export const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID ?? 'rest001',
    menuBaseUrl: process.env.NEXT_PUBLIC_MENU_BASE_URL ?? '',
    menuCustomerPath: process.env.NEXT_PUBLIC_MENU_CUSTOMER_PATH ?? '/customer',
} as const;
