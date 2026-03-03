import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/auth/proxy
 * ---------------
 * Server-side proxy for Supabase API calls (Auth + Rest).
 *
 * Why this exists:
 *   Some security software (Kaspersky, corporate firewalls) intercepts browser
 *   HTTPS traffic and blocks direct fetch() calls to supabase.co.
 *   By routing through a Next.js API route, the request goes server-side
 *   (Node.js process) where browser security software cannot intercept it.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SSRF guard — only allow these API namespaces
const ALLOWED_NAMESPACES = [
    'auth/v1',
    'rest/v1',
];

function buildTargetUrl(searchParams: URLSearchParams): string | null {
    const path = searchParams.get('path') ?? '';

    // Validate path starts with an allowed namespace
    const isAllowed = ALLOWED_NAMESPACES.some(ns => path.startsWith(ns));
    if (!isAllowed) return null;

    // Forward all query params except 'path' to Supabase
    const forwarded = new URLSearchParams();
    for (const [key, val] of searchParams.entries()) {
        if (key !== 'path') forwarded.append(key, val);
    }
    const qs = forwarded.toString();
    return `${SUPABASE_URL}/${path}${qs ? `?${qs}` : ''}`;
}

async function handleProxy(req: NextRequest) {
    const targetUrl = buildTargetUrl(req.nextUrl.searchParams);
    console.log(`[supabase-proxy] ${req.method} ${req.nextUrl.searchParams.get('path')} -> ${targetUrl ? 'ALLOW' : 'DENY'}`);

    if (!targetUrl) {
        return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
    }

    try {
        const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

        // Prepare headers — forward essentials
        const headers = new Headers();
        const headersToForward = ['content-type', 'authorization', 'apikey', 'prefer', 'range', 'if-none-match'];

        for (const h of headersToForward) {
            const val = req.headers.get(h);
            if (val) headers.set(h, val);
        }

        // Ensure apikey and basic auth are present if missing
        if (!headers.has('apikey')) headers.set('apikey', SUPABASE_ANON_KEY);
        if (!headers.has('authorization')) headers.set('authorization', `Bearer ${SUPABASE_ANON_KEY}`);

        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: body || undefined,
        });

        const responseBody = await response.text();
        const resHeaders: Record<string, string> = {
            'Content-Type': response.headers.get('content-type') ?? 'application/json',
        };

        // Forward certain response headers (like content-range for pagination)
        if (response.headers.has('content-range')) {
            resHeaders['Content-Range'] = response.headers.get('content-range')!;
        }

        return new NextResponse(responseBody, {
            status: response.status,
            headers: resHeaders,
        });
    } catch (err: any) {
        console.error('[supabase-proxy] Error:', err.message, 'URL:', targetUrl);
        return NextResponse.json(
            { error: 'Proxy failed', detail: err.message },
            { status: 502 }
        );
    }
}

export async function GET(req: NextRequest) { return handleProxy(req); }
export async function POST(req: NextRequest) { return handleProxy(req); }
export async function PUT(req: NextRequest) { return handleProxy(req); }
export async function PATCH(req: NextRequest) { return handleProxy(req); }
export async function DELETE(req: NextRequest) { return handleProxy(req); }
export async function OPTIONS(req: NextRequest) { return handleProxy(req); }

