'use client';

/**
 * app/auth/callback/page.tsx
 * ---------------------------
 * Handles the OAuth redirect from Supabase (Google sign-in).
 *
 * With PKCE flow (flowType: 'pkce' in lib/supabase.ts), Supabase redirects
 * the user back to /auth/callback?code=XXXX. The Supabase JS client must
 * exchange that `code` for a session by calling exchangeCodeForSession().
 *
 * Without this exchange, onAuthStateChange never fires SIGNED_IN,
 * so the user is stuck on the callback page indefinitely.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Suspense } from 'react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth error response from provider
        if (errorParam) {
            setError(errorDescription ?? errorParam);
            setTimeout(() => router.replace('/login'), 3000);
            return;
        }

        if (code) {
            // PKCE flow: exchange the authorization code for a session
            supabase.auth.exchangeCodeForSession(code)
                .then(({ data, error: exchangeError }) => {
                    if (exchangeError || !data.session) {
                        console.error('Code exchange failed:', exchangeError);
                        setError(exchangeError?.message ?? 'Sign-in failed. Please try again.');
                        setTimeout(() => router.replace('/login'), 3000);
                        return;
                    }
                    // Successfully signed in — redirect to dashboard
                    router.replace('/dashboard/orders');
                })
                .catch((err) => {
                    console.error('Unexpected error during code exchange:', err);
                    setError('An unexpected error occurred. Redirecting to login…');
                    setTimeout(() => router.replace('/login'), 3000);
                });
        } else {
            // No code in URL — may be an implicit flow or direct navigation
            // Check if we already have a session (e.g. email magic link)
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    router.replace('/dashboard/orders');
                } else {
                    // Nothing to do — redirect back to login
                    router.replace('/login');
                }
            });
        }
    }, [router, searchParams]);

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center max-w-sm px-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center mx-auto mb-4">
                        <span className="text-white font-bold text-xl">!</span>
                    </div>
                    <p className="text-rose-400 text-sm font-medium mb-2">Sign-in failed</p>
                    <p className="text-slate-500 text-xs">{error}</p>
                    <p className="text-slate-600 text-xs mt-2">Redirecting to login…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-white font-bold">H</span>
                </div>
                <p className="text-slate-400 text-sm">Completing sign in…</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto animate-pulse">
                    <span className="text-white font-bold">H</span>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
