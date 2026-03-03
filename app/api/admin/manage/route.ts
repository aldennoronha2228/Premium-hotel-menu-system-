import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_ACCESS_KEY = process.env.ADMIN_ACCESS_KEY ?? '';

/**
 * /api/admin/manage
 * 
 * Handles management of admin users.
 * Uses the privileged supabaseAdmin client to bypass Row Level Security (RLS).
 * Requires the ADMIN_ACCESS_KEY in the headers for all operations.
 */

// ─── Verification Gate ───────────────────────────────────────────────────────
function verifyKey(req: NextRequest) {
    const key = (req.headers.get('x-admin-key') || '').trim();
    const secret = (process.env.ADMIN_ACCESS_KEY || '').trim();

    // ERROR: If the server itself doesn't have the key set, that's a config issue.
    if (!secret) return { isValid: false, reason: 'SERVER_CONFIG_MISSING' };

    const isValid = key === secret;
    return { isValid, reason: isValid ? null : 'KEY_MISMATCH' };
}

export async function GET(req: NextRequest) {
    console.log('[admin-manage] GET request received');

    try {
        const { isValid, reason } = verifyKey(req);
        if (!isValid) {
            if (reason === 'SERVER_CONFIG_MISSING') {
                return NextResponse.json({
                    error: 'Server Misconfigured: Missing ADMIN_ACCESS_KEY',
                    detail: 'Please add ADMIN_ACCESS_KEY to your hosting environment variables.'
                }, { status: 500 });
            }
            return NextResponse.json({ error: 'Auth Error: Invalid Master Key (Manage)' }, { status: 401 });
        }

        const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!roleKey) {
            console.error('[admin-manage] SUPABASE_SERVICE_ROLE_KEY is missing from .env!');
            return NextResponse.json({
                error: 'Server Misconfigured: Missing Service Role Key',
                detail: 'Please add SUPABASE_SERVICE_ROLE_KEY to your .env file to enable this feature.'
            }, { status: 500 });
        }

        console.log('[admin-manage] Fetching admin list from Supabase (ADMIN)...');
        const { data, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[admin-manage] Supabase error:', error.message);
            throw error;
        }

        console.log('[admin-manage] Success. Found', data?.length, 'admins');
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('[admin-manage] GET CRASH:', err.message);
        return NextResponse.json({
            error: 'Server Error',
            detail: err.message,
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { isValid, reason } = verifyKey(req);
    if (!isValid) {
        if (reason === 'SERVER_CONFIG_MISSING') {
            return NextResponse.json({ error: 'Server Config Error: Secret Missing' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Auth Error: Invalid Master Key (Action)' }, { status: 401 });
    }

    try {
        const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!roleKey) {
            console.error('[admin-manage] SUPABASE_SERVICE_ROLE_KEY is missing from .env!');
            return NextResponse.json({
                error: 'Server Misconfigured: Missing Service Role Key',
                detail: 'Please add SUPABASE_SERVICE_ROLE_KEY to your .env file to enable this feature.'
            }, { status: 500 });
        }

        const { email, action } = await req.json();

        if (action === 'add') {
            const { error } = await supabaseAdmin
                .from('admin_users')
                .upsert({ email, is_active: true });
            if (error) throw error;
            return NextResponse.json({ message: 'Admin added successfully' });
        } else if (action === 'remove') {
            const { error } = await supabaseAdmin
                .from('admin_users')
                .update({ is_active: false })
                .eq('email', email);
            if (error) throw error;
            return NextResponse.json({ message: 'Admin deactivated' });
        } else if (action === 'delete') {
            const { error } = await supabaseAdmin
                .from('admin_users')
                .delete()
                .eq('email', email);
            if (error) throw error;
            return NextResponse.json({ message: 'Admin deleted' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Explanation for Beginners:
 * 
 * "State Management" is how we keep track of what is happening in the app.
 * In this file, we use "Server-Side Verification" – the server checks the
 * x-admin-key header against a secret key stored on the server (.env).
 * If they don't match, we stop the request before touching the database.
 */
