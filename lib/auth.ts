import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export type { User, Session };

// ─── Sign in with Google OAuth ────────────────────────────────────────────────
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
                prompt: 'select_account',
            },
        },
    });
    if (error) throw error;
}

// ─── Sign in with Email + Password ───────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

// ─── Sign up with Email + Password ───────────────────────────────────────────
export async function signUpWithEmail(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// ─── Get current session ──────────────────────────────────────────────────────
export async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

// ─── Check if current user is an admin ───────────────────────────────────────
export async function checkIsAdmin(user: User): Promise<boolean> {
    const email = user.email;
    if (!email) return false;

    const { data, error } = await supabase
        .from('admin_users')
        .select('id, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        console.error('Admin check error:', error);
        return false;
    }
    return data !== null;
}

// ─── Update last_login timestamp ─────────────────────────────────────────────
export async function updateLastLogin(email: string) {
    await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('email', email);
}
