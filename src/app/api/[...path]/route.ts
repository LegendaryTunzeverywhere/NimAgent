import { NextRequest, NextResponse } from 'next/server';

/**
 * BFF (Backend-for-Frontend) Proxy Layer
 * 
 * This API route acts as a secure proxy between the browser and Railway backend.
 * The API secret is kept on the server and never exposed to the browser.
 * 
 * Flow: Browser → Next.js API Route → Railway Backend → Reloadly
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://nserver-production.up.railway.app';
const API_SECRET = process.env.API_SECRET || '';

if (!API_SECRET) {
  console.warn('[BFF] API_SECRET not configured. Set it in Vercel environment variables.');
}

/**
 * Handle GET requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    // Add /api prefix if not already present
    const apiPath = path.startsWith('api/') ? path : `api/${path}`;
    const url = `${BACKEND_URL}/${apiPath}${searchParams ? `?${searchParams}` : ''}`;

    console.log('[BFF] GET', url);
    console.log('[BFF] API_SECRET present:', !!API_SECRET);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_SECRET,
      },
    });

    console.log('[BFF] Response status:', response.status);
    console.log('[BFF] Response headers:', Object.fromEntries(response.headers.entries()));

    // If not OK, log the raw response
    if (!response.ok) {
      const text = await response.text();
      console.error('[BFF] Error response:', text.substring(0, 200));
      return NextResponse.json(
        { error: 'Backend returned error', status: response.status, preview: text.substring(0, 100) },
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
      { error: 'Failed to fetch from backend', message: error.message },
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
    const path = params.path.join('/');
    const body = await request.json();
    // Add /api prefix if not already present
    const apiPath = path.startsWith('api/') ? path : `api/${path}`;
    const url = `${BACKEND_URL}/${apiPath}`;

    console.log('[BFF] POST', url);
    console.log('[BFF] API_SECRET present:', !!API_SECRET);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_SECRET,
      },
      body: JSON.stringify(body),
    });

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
      { error: 'Failed to post to backend', message: error.message },
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
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    // Add /api prefix if not already present
    const apiPath = path.startsWith('api/') ? path : `api/${path}`;
    const url = `${BACKEND_URL}/${apiPath}${searchParams ? `?${searchParams}` : ''}`;

    console.log('[BFF] DELETE', url);
    console.log('[BFF] API_SECRET present:', !!API_SECRET);

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
      { error: 'Failed to delete from backend', message: error.message },
      { status: 502 }
    );
  }
}
