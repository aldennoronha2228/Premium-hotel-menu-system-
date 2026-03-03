import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * /api/admin/settings
 * 
 * Handles site-wide settings like 'Global Access'.
 * Requires the ADMIN_ACCESS_KEY in the headers.
 */

function verifyKey(req: NextRequest) {
    const key = (req.headers.get('x-admin-key') || '').trim();
    const secret = (process.env.ADMIN_ACCESS_KEY || '').trim();
    return key === secret && secret !== '';
}

export async function GET(req: NextRequest) {
    if (!verifyKey(req)) {
        return NextResponse.json({ error: 'Auth Error: Invalid Master Key (Settings-Get)' }, { status: 401 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('site_settings')
            .select('*');
        if (error) throw error;
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!verifyKey(req)) {
        return NextResponse.json({ error: 'Auth Error: Invalid Master Key (Settings-Set)' }, { status: 401 });
    }

    try {
        const { key, value } = await req.json();

        // Security check: Only allow updating certain keys
        const allowedKeys = ['is_site_public'];
        if (!allowedKeys.includes(key)) {
            return NextResponse.json({ error: 'Forbidden: Unauthorized Key Change' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('site_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key);

        if (error) throw error;

        return NextResponse.json({ message: 'Settings Updated Successfully' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Explanation for Beginners:
 * This API handles "Site State Management". 
 * Any state that affects the WHOLE app (like maintenance mode)
 * is stored in a special database table and guarded by our secret Master Key.
 */
