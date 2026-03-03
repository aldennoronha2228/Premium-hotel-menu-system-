'use client';

/**
 * context/AuthContext.tsx  (hardened)
 * --------------------------------------
 * SECURITY changes vs original:
 *  1. Session re-validation: on SIGNED_IN events, the user's admin status is
 *     ALWAYS re-checked — not cached from a previous check.
 *  2. isAdmin is NEVER true-by-default. It starts false and only becomes true
 *     after an explicit, successful checkIsAdmin() call.
 *  3. TOKEN_REFRESHED events: re-check admin status when access tokens refresh
 *     (in case the admin was deactivated between sessions).
 *  4. signOut clears local state immediately before the async Supabase call so
 *     the UI can't be navigated during the round-trip.
 *  5. FIX: Race condition between getSession() and onAuthStateChange(SIGNED_IN)
 *     that caused GoTrue "Lock broken by another request" errors is resolved by
 *     letting onAuthStateChange be the single source of truth for state updates
 *     during the initial load window.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { checkIsAdmin, updateLastLogin, signOut as authSignOut } from '@/lib/auth';
import { securityLog } from '@/lib/logger';
import type { User, Session } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
    session: Session | null;
    user: User | null;
    isAdmin: boolean;
    loading: boolean;
    error: string | null;
}

interface AuthContextValue extends AuthState {
    signOut: () => Promise<void>;
    clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        isAdmin: false,     // SECURITY: always false until explicitly verified
        loading: true,
        error: null,
    });

    // Track if we've handled the initial session load
    const hasInitialized = useRef(false);

    useEffect(() => {
        // onAuthStateChange handles the initial session check AND all subsequent changes.
        // It fires a callback immediately upon subscription with the current session.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[AuthContext] event: ${event}`, session ? 'has session' : 'no session');

            if (!session?.user) {
                // SECURITY: clear state immediately
                setState({ session: null, user: null, isAdmin: false, loading: false, error: null });
                hasInitialized.current = true;
                return;
            }

            // For all authenticated events (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, etc.)
            try {
                // LOCK FIX: Give the auth client a small tick to finalize its own state 
                // and release storage locks before we start a new DB request.
                await new Promise(r => setTimeout(r, 10));

                // SECURITY: re-check admin status
                const isAdmin = await checkIsAdmin(session.user);

                if (event === 'SIGNED_IN' && isAdmin) {
                    await updateLastLogin(session.user.email!);
                }

                setState({ session, user: session.user, isAdmin, loading: false, error: null });
            } catch (err: any) {
                console.error('[AuthContext] Admin check failed:', err);
                setState({ session, user: session.user, isAdmin: false, loading: false, error: err.message });
            } finally {
                hasInitialized.current = true;
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // SECURITY: clear local state FIRST, then call the async signOut, so the
    // UI cannot be navigated during the Supabase round-trip.
    const signOut = async () => {
        setState({ session: null, user: null, isAdmin: false, loading: false, error: null });
        await authSignOut();
    };

    const clearError = () => setState(s => ({ ...s, error: null }));

    return (
        <AuthContext.Provider value={{ ...state, signOut, clearError }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
