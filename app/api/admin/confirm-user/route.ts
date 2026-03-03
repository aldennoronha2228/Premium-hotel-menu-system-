import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * /api/admin/confirm-user
 * -----------------------
 * EMERGENCY TOOL: Manually confirms a Supabase user if they aren't receiving the email.
 * This uses the 'supabaseAdmin' (Service Role) client to bypass RLS and Auth requirements.
 * 
 * SECURITY: This is protected by the same ADMIN_ACCESS_KEY used for the dashboard.
 */

function verifyKey(req: NextRequest) {
    const key = (req.headers.get('x-admin-key') || '').trim();
    const secret = (process.env.ADMIN_ACCESS_KEY || '').trim();
    return key === secret && secret !== '';
}

export async function POST(req: NextRequest) {
    if (!verifyKey(req)) {
        return NextResponse.json({ error: 'Unauthorized: Invalid Admin Key' }, { status: 401 });
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        console.log(`[ConfirmUser] Manually confirming email: ${email}`);

        // 1. Find the user in the auth system
        const { data: { users }, error: findError } = await supabaseAdmin.auth.admin.listUsers();

        if (findError) throw findError;

        const user = users.find(u => u.email === email);

        if (!user) {
            return NextResponse.json({ error: 'User not found in Supabase Auth' }, { status: 404 });
        }

        // 2. Update the user to mark their email as confirmed
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { email_confirm: true }
        );

        if (updateError) throw updateError;

        return NextResponse.json({
            message: `Successfully confirmed ${email}! You can now sign in.`,
            userId: user.id
        });

    } catch (err: any) {
        console.error('[ConfirmUser] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
