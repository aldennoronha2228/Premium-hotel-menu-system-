'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { checkIsAdmin, updateLastLogin, signOut as authSignOut } from '@/lib/auth';
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
        isAdmin: false,
        loading: true,
        error: null,
    });

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const isAdmin = await checkIsAdmin(session.user);
                if (isAdmin) await updateLastLogin(session.user.email!);
                setState({ session, user: session.user, isAdmin, loading: false, error: null });
            } else {
                setState(s => ({ ...s, loading: false }));
            }
        });

        // 2. Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const isAdmin = await checkIsAdmin(session.user);
                if (event === 'SIGNED_IN' && isAdmin) {
                    await updateLastLogin(session.user.email!);
                }
                setState({ session, user: session.user, isAdmin, loading: false, error: null });
            } else {
                setState({ session: null, user: null, isAdmin: false, loading: false, error: null });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await authSignOut();
        setState({ session: null, user: null, isAdmin: false, loading: false, error: null });
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
