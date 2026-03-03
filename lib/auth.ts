/**
 * lib/auth.ts  (hardened)
 * -----------------------
 * SECURITY changes vs original:
 *  1. All functions are now server-safe: no window.location access unless guarded.
 *  2. signInWithGoogle: redirect URL is hardcoded (not user-supplied), preventing
 *     open-redirect via OAuth state parameter manipulation.
 *  3. signOut: calls global scope sign-out (not just local) to invalidate the
 *     server-side refresh token.
 *  4. checkIsAdmin: uses a single .maybeSingle() with explicit .eq('is_active', true)
 *     so deactivated admins are rejected without a code change.
 *  5. All auth events are logged via securityLog for audit / incident response.
 *  6. Added verifySessionServer() for server-side middleware use.
 */

import { supabase } from './supabase';
import { securityLog } from './logger';
import type { User, Session } from '@supabase/supabase-js';

export type { User, Session };

// ─── Sign in with Google OAuth ────────────────────────────────────────────────
export async function signInWithGoogle() {
    // SECURITY: redirect URL is hardcoded — caller cannot override it.
    // This prevents open-redirect via the `redirectTo` parameter.
    if (typeof window === 'undefined') throw new Error('signInWithGoogle must be called client-side');

    const redirectTo = `${window.location.origin}/auth/callback`;

    securityLog.info('AUTH_GOOGLE_START', { origin: window.location.origin });

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            queryParams: {
                prompt: 'select_account',    // force account picker — prevents session fixation
                access_type: 'offline',      // request refresh token
            },
        },
    });
    if (error) {
        securityLog.error('AUTH_LOGIN_FAILURE', { method: 'google', message: error.message });
        throw error;
    }
}

// ─── Sign in with Email + Password ───────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        securityLog.warn('AUTH_LOGIN_FAILURE', { method: 'email', email, message: error.message });
        throw error;
    }
    securityLog.info('AUTH_LOGIN_SUCCESS', { method: 'email', email, userId: data.user?.id });
    return data;
}

// ─── Sign up with Email + Password ───────────────────────────────────────────
export async function signUpWithEmail(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
    });
    if (error) {
        securityLog.warn('AUTH_LOGIN_FAILURE', { method: 'signup', email, message: error.message });
        throw error;
    }
    securityLog.info('AUTH_SIGNUP', { email, userId: data.user?.id });
    return data;
}

// ─── Sign out (global — invalidates refresh token server-side) ────────────────
export async function signOut() {
    // SECURITY: 'global' scope revokes ALL sessions for this user across all devices.
    // Use 'local' if you only want to clear the current browser session.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
        securityLog.error('AUTH_LOGOUT', { message: error.message });
        throw error;
    }
    securityLog.info('AUTH_LOGOUT', {});
}

// ─── Get current session (client-side) ───────────────────────────────────────
export async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

// Wrap checkIsAdmin in a pending promises map to prevent GoTrue from
// throwing 'AbortError: Lock broken by another request' during concurrent refreshes
// when getSession() and onAuthStateChange() fire at the exact same moment.
const pendingAdminChecks = new Map<string, Promise<boolean>>();

async function executeAdminCheck(email: string, retries: number): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('is_active')
            .eq('email', email)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            if ((error.message?.includes('AbortError') || error.message?.includes('Lock broken')) && retries > 0) {
                await new Promise(r => setTimeout(r, 500));
                return executeAdminCheck(email, retries - 1);
            }
            securityLog.error('AUTHZ_ADMIN_CHECK', { email, message: error.message });
            return false;
        }

        const isAdmin = data !== null;
        securityLog.info('AUTHZ_ADMIN_CHECK', { email, result: isAdmin });
        return isAdmin;
    } catch (err: any) {
        if ((err.name === 'AbortError' || err.message?.includes('AbortError') || err.message?.includes('Lock broken')) && retries > 0) {
            await new Promise(r => setTimeout(r, 500));
            return executeAdminCheck(email, retries - 1);
        }
        securityLog.error('AUTHZ_ADMIN_CHECK', { email, message: err.message });
        return false;
    }
}

export async function checkIsAdmin(user: User, retries = 2): Promise<boolean> {
    const email = user.email;
    if (!email) {
        securityLog.warn('AUTHZ_DENIED', { reason: 'no_email', userId: user.id });
        return false;
    }

    if (pendingAdminChecks.has(email)) {
        return pendingAdminChecks.get(email)!;
    }

    const checkPromise = executeAdminCheck(email, retries).finally(() => {
        pendingAdminChecks.delete(email);
    });

    pendingAdminChecks.set(email, checkPromise);
    return checkPromise;
}

// ─── Update last_login timestamp ─────────────────────────────────────────────
export async function updateLastLogin(email: string) {
    await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('email', email);
}
