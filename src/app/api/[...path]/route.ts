import { NextRequest, NextResponse } from 'next/server';

const NIMIQ_PAY_PLATFORM = 'nimiq-pay-miniapp';

// Mark this route as dynamic (not statically generated)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * BFF (Backend-for-Frontend) Proxy Layer
 * 
 * This API route acts as a secure proxy between the browser and Railway backend.
 * The API secret is kept on the server and never exposed to the browser.
 * 
 * Flow: Browser → Next.js API Route → Railway Backend → Reloadly
 * 
 * SECURITY: Backend URL and API secret are never logged or exposed to client
 */

const BACKEND_URL = process.env.BACKEND_URL;
const API_SECRET = process.env.API_SECRET;

if (!BACKEND_URL) {
  console.error('[BFF] BACKEND_URL not configured. Set it in environment variables.');
}

if (!API_SECRET) {
  console.error('[BFF] API_SECRET not configured. Set it in environment variables.');
}

/**
 * Helper to create headers with forwarded CSRF token and cookies
 */
function createProxyHeaders(request: NextRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_SECRET as string,
  };

  // Forward X-CSRF-Token header if present
  const csrfToken = request.headers.get('x-csrf-token');
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const clientPlatform = request.headers.get('x-client-platform');
  const walletKind = request.headers.get('x-wallet-kind');
  if (clientPlatform) headers['x-client-platform'] = clientPlatform;
  if (walletKind) headers['x-wallet-kind'] = walletKind;

  // Forward cookies from frontend to backend
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    headers['cookie'] = cookieHeader;
  }

  return headers;
}

/**
 * Helper to copy headers from backend response to Next.js response
 */
function copyResponseHeaders(backendResponse: Response, nextResponse: NextResponse) {
  // Don't gate on .get('set-cookie') — it's unreliable for this specific
  // header when there are multiple Set-Cookie values. Call getSetCookie()
  // directly and check its length instead.
  const cookies = backendResponse.headers.getSetCookie();
  
  // Diagnostic logging to confirm the bug
  // console.log('[BFF] set-cookie via .get():', backendResponse.headers.get('set-cookie')); commented out <-
  // console.log('[BFF] set-cookie via getSetCookie():', cookies); <-
  
  if (cookies.length > 0) {
    cookies.forEach(cookie => {
      nextResponse.headers.append('set-cookie', cookie);
    });
  }

  // Forward other relevant headers
  const cacheControl = backendResponse.headers.get('cache-control');
  if (cacheControl) {
    nextResponse.headers.set('cache-control', cacheControl);
  }

  const walletMode = backendResponse.headers.get('x-wallet-mode');
  if (walletMode) {
    nextResponse.headers.set('x-wallet-mode', walletMode);
  }
}

function hasTrustedOrigin(request: NextRequest) {
  const appOrigin = request.nextUrl.origin;
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin && origin !== appOrigin) {
    return false;
  }

  if (referer) {
    try {
      return new URL(referer).origin === appOrigin;
    } catch {
      return false;
    }
  }

  return true;
}

function ensureNimiqPayAccess(request: NextRequest) {
  const clientPlatform = (request.headers.get('x-client-platform') || '').toLowerCase();
  const walletKind = (request.headers.get('x-wallet-kind') || '').toLowerCase();
  if (clientPlatform !== NIMIQ_PAY_PLATFORM || walletKind !== 'miniapp') {
    return NextResponse.json(
      { error: 'NimAgent is only available inside the Nimiq Pay app.' },
      { status: 403 }
    );
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json(
      { error: 'Blocked untrusted browser origin.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Handle GET requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    if (!BACKEND_URL || !API_SECRET) {
      return NextResponse.json(
        { error: 'Backend configuration missing' },
        { status: 500 }
      );
    }

    const accessError = ensureNimiqPayAccess(request);
    if (accessError) return accessError;

    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    // Path already includes 'api/' from Next.js routing, use it directly
    const url = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: createProxyHeaders(request),
      credentials: 'include', // Important for cookies
    });

    // If not OK, log the error without exposing backend details
    if (!response.ok) {
      console.error('[BFF] Backend error status:', response.status);
      const errorResponse = NextResponse.json(
        { error: 'Backend request failed', status: response.status },
        { status: response.status }
      );
      copyResponseHeaders(response, errorResponse);
      return errorResponse;
    }

    const data = await response.json();

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });
    copyResponseHeaders(response, nextResponse);
    return nextResponse;
  } catch (error: any) {
    console.error('[BFF] GET error');
    return NextResponse.json(
      { error: 'Failed to fetch from backend' },
      { status: 502 }
    );
  }
}

/**
 * Handle POST requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    if (!BACKEND_URL || !API_SECRET) {
      return NextResponse.json(
        { error: 'Backend configuration missing' },
        { status: 500 }
      );
    }

    const accessError = ensureNimiqPayAccess(request);
    if (accessError) return accessError;

    const path = params.path.join('/');
    const body = await request.json();
    // Path already includes correct route from Next.js, use it directly
    const url = `${BACKEND_URL}/api/${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: createProxyHeaders(request),
      body: JSON.stringify(body),
      credentials: 'include', // Important for cookies
    });

    // Log non-2xx responses before parsing
    if (!response.ok) {
      const text = await response.text();
      console.error('[BFF] Backend POST error:', response.status);
      // Try to parse as JSON, fallback to text error
      try {
        const errorData = JSON.parse(text);
        const errorResponse = NextResponse.json(errorData, {
          status: response.status,
        });
        copyResponseHeaders(response, errorResponse);
        return errorResponse;
      } catch {
        const errorResponse = NextResponse.json(
          { error: 'Backend request failed', status: response.status, message: text.slice(0, 200) },
          { status: response.status }
        );
        copyResponseHeaders(response, errorResponse);
        return errorResponse;
      }
    }

    const data = await response.json();

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });
    copyResponseHeaders(response, nextResponse);
    return nextResponse;
  } catch (error: any) {
    console.error('[BFF] POST error');
    return NextResponse.json(
      { error: 'Failed to post to backend' },
      { status: 502 }
    );
  }
}

/**
 * Handle DELETE requests
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    if (!BACKEND_URL || !API_SECRET) {
      return NextResponse.json(
        { error: 'Backend configuration missing' },
        { status: 500 }
      );
    }

    const accessError = ensureNimiqPayAccess(request);
    if (accessError) return accessError;

    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    // Path already includes correct route from Next.js, use it directly
    const url = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: createProxyHeaders(request),
      credentials: 'include', // Important for cookies
    });

    const data = await response.json();

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });
    copyResponseHeaders(response, nextResponse);
    return nextResponse;
  } catch (error: any) {
    console.error('[BFF] DELETE error');
    return NextResponse.json(
      { error: 'Failed to delete from backend' },
      { status: 502 }
    );
  }
}

/**
 * Handle PUT requests
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    if (!BACKEND_URL || !API_SECRET) {
      return NextResponse.json(
        { error: 'Backend configuration missing' },
        { status: 500 }
      );
    }

    const accessError = ensureNimiqPayAccess(request);
    if (accessError) return accessError;

    const path = params.path.join('/');
    const body = await request.json();
    const url = `${BACKEND_URL}/api/${path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: createProxyHeaders(request),
      body: JSON.stringify(body),
      credentials: 'include', // Important for cookies
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BFF] Backend PUT error:', response.status);
      try {
        const errorData = JSON.parse(text);
        const errorResponse = NextResponse.json(errorData, {
          status: response.status,
        });
        copyResponseHeaders(response, errorResponse);
        return errorResponse;
      } catch {
        const errorResponse = NextResponse.json(
          { error: 'Backend request failed', status: response.status, message: text.slice(0, 200) },
          { status: response.status }
        );
        copyResponseHeaders(response, errorResponse);
        return errorResponse;
      }
    }

    const data = await response.json();

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });
    copyResponseHeaders(response, nextResponse);
    return nextResponse;
  } catch (error: any) {
    console.error('[BFF] PUT error');
    return NextResponse.json(
      { error: 'Failed to put to backend' },
      { status: 502 }
    );
  }
}
