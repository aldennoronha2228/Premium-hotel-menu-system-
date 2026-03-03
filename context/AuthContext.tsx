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
        let isActive = true;

        // SAFETY: If auth completely hangs (e.g. no network), release the gate after 2.5s
        const safetyTimer = setTimeout(() => {
            if (isActive && !hasInitialized.current) {
                console.warn('[AuthContext] Progressive safety release.');
                setState(prev => ({ ...prev, loading: false }));
                hasInitialized.current = true;
            }
        }, 2500);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[AuthContext] event: ${event}`);

            if (!session?.user) {
                if (isActive) {
                    setState({ session: null, user: null, isAdmin: false, loading: false, error: null });
                    hasInitialized.current = true;
                    clearTimeout(safetyTimer);
                }
                return;
            }

            // PROGRESSIVE LOAD: Set session/user immediately so the dashboard can render
            if (isActive) {
                setState(prev => ({
                    ...prev,
                    session,
                    user: session.user,
                    loading: false,
                    error: null
                }));
                hasInitialized.current = true;
                clearTimeout(safetyTimer);
            }

            // BACKGROUND TASK: Verify admin status without blocking the UI
            try {
                const isAdmin = await checkIsAdmin(session.user).catch(() => false);

                if (isActive) {
                    setState(prev => ({ ...prev, isAdmin }));

                    if (event === 'SIGNED_IN' && isAdmin) {
                        await updateLastLogin(session.user.email!).catch(() => { });
                    }
                }
            } catch (err: any) {
                console.error('[AuthContext] Background check error:', err);
            }
        });

        return () => {
            isActive = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
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
