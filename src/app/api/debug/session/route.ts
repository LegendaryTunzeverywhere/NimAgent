import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Debug endpoint to check session cookie status
 * GET /api/debug/session
 * 
 * Returns information about cookies and session state for troubleshooting
 */
export async function GET(request: NextRequest) {
  const cookies = request.cookies.getAll();
  const cookieHeader = request.headers.get('cookie');
  
  return NextResponse.json({
    hasCookieHeader: !!cookieHeader,
    cookieCount: cookies.length,
    cookies: cookies.map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0,
      valuePrefix: c.value?.slice(0, 10) + '...',
    })),
    hasSessionCookie: cookies.some(c => c.name === 'nimagent_session'),
    sessionCookie: cookies.find(c => c.name === 'nimagent_session') ? {
      name: 'nimagent_session',
      valueLength: cookies.find(c => c.name === 'nimagent_session')?.value?.length || 0,
    } : null,
    headers: {
      cookie: cookieHeader?.slice(0, 100) + '...',
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')?.slice(0, 50) + '...',
    },
  });
}
