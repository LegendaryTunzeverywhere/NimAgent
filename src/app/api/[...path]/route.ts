import { NextRequest, NextResponse } from 'next/server';

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

    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    // Path already includes 'api/' from Next.js routing, use it directly
    const url = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

    console.log('[BFF] GET request to path:', path);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_SECRET,
      },
    });

    console.log('[BFF] Response status:', response.status);

    // If not OK, log the error without exposing backend details
    if (!response.ok) {
      const text = await response.text();
      console.error('[BFF] Backend error status:', response.status);
      return NextResponse.json(
        { error: 'Backend request failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[BFF] GET error:', error.message);
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

    const path = params.path.join('/');
    const body = await request.json();
    // Path already includes correct route from Next.js, use it directly
    const url = `${BACKEND_URL}/api/${path}`;

    console.log('[BFF] POST request to path:', path);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_SECRET,
      },
      body: JSON.stringify(body),
    });

    // Log non-2xx responses before parsing
    if (!response.ok) {
      const text = await response.text();
      console.error('[BFF] Backend POST error:', response.status, text.slice(0, 500));
      // Try to parse as JSON, fallback to text error
      try {
        const errorData = JSON.parse(text);
        return NextResponse.json(errorData, {
          status: response.status,
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
          },
        });
      } catch {
        return NextResponse.json(
          { error: 'Backend request failed', status: response.status, message: text.slice(0, 200) },
          { status: response.status }
        );
      }
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[BFF] POST error:', error.message);
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

    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    // Path already includes correct route from Next.js, use it directly
    const url = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

    console.log('[BFF] DELETE request to path:', path);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_SECRET,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[BFF] DELETE error:', error.message);
    return NextResponse.json(
      { error: 'Failed to delete from backend' },
      { status: 502 }
    );
  }
}
