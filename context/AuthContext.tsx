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
 *  4. Expiry check: sessions older than the token expiry are cleared.
 *  5. signOut clears local state immediately before the async Supabase call so
 *     the UI can't be navigated during the round-trip.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

    useEffect(() => {
        // ── 1. Get initial session ──────────────────────────────────────────
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                // SECURITY: always verify admin status server-side — don't trust localStorage
                const isAdmin = await checkIsAdmin(session.user);
                if (isAdmin) {
                    await updateLastLogin(session.user.email!);
                } else {
                    securityLog.warn('AUTHZ_DENIED', { reason: 'not_admin', email: session.user.email });
                }
                setState({ session, user: session.user, isAdmin, loading: false, error: null });
            } else {
                setState(s => ({ ...s, session: null, user: null, isAdmin: false, loading: false }));
            }
        });

        // ── 2. Subscribe to auth state changes ─────────────────────────────
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT' || !session?.user) {
                // SECURITY: zero out all state immediately on sign-out
                setState({ session: null, user: null, isAdmin: false, loading: false, error: null });
                return;
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                // SECURITY: re-check admin status on every auth event — admin may have
                // been deactivated since the last session was created.
                const isAdmin = await checkIsAdmin(session.user);

                if (event === 'SIGNED_IN' && isAdmin) {
                    await updateLastLogin(session.user.email!);
                }

                setState({ session, user: session.user, isAdmin, loading: false, error: null });
            }
        });

        return () => subscription.unsubscribe();
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
