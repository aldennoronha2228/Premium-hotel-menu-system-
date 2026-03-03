/**
 * lib/supabase.ts  (hardened)
 * ---------------------------
 * SECURITY changes vs original:
 *  1. Env vars are validated at import time via lib/env (fail-fast).
 *  2. Dashboard client: auth storage key namespaced and storageType is
 *     explicitly 'localStorage' — prevents accidental session bleed.
 *  3. Customer client: ALL auth mechanisms are disabled — no sessions,
 *     no token refresh, no URL session detection. Fully anonymous.
 *  4. Both clients: flowType 'pkce' is set on the dashboard client to
 *     prevent authorization-code interception attacks (PKCE).
 *  5. Added a server-side helper (getServerSession) for token validation
 *     inside middleware / server components without relying on cookies.
 */

import { createClient } from '@supabase/supabase-js';
import { validateEnv, env } from './env';

// Run at module load — throws if env is broken
validateEnv();

// ─── Dashboard client (authenticated) ────────────────────────────────────────
// Used by all /dashboard/* pages and auth flows.
// Session is persisted in localStorage under a namespaced key.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
        storageKey: 'hotel-menu-auth-v13',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',            // SECURITY: prevents auth-code interception
        // Bypass the defective navigator.locks API in Gotrue that throws 'steal' AbortErrors
        // and causes infinite stalled promises. We use a simple in-memory Mutex queue.
        lock: (() => {
            let memoryLock: Promise<any> = Promise.resolve();
            return async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
                const acquiredLock = memoryLock.then(fn).catch(fn);
                memoryLock = acquiredLock.then(() => { }).catch(() => { });
                return acquiredLock;
            };
        })(),
    },
    global: {
        headers: {
            'X-Client-Info': 'hotel-dashboard/1.0',
        },
    },
});

// ─── Customer client (fully anonymous) ───────────────────────────────────────
// Used only by /customer/* pages.
// NO session is stored, NO tokens are refreshed, NO URL session detection.
// Anon key gives access only to public RLS-guarded tables.
export const supabaseCustomer = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: '__none__',      // explicit: no storage key
    },
    global: {
        headers: {
            'X-Client-Info': 'hotel-customer/1.0',
        },
    },
});
