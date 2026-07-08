import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Nimiq RPC Proxy
 * 
 * Proxies JSON-RPC requests to Nimiq nodes to avoid CORS issues.
 * Browser → This endpoint → Nimiq RPC → Browser
 *
 * IMPORTANT: Nimiq RPC nodes require the human-friendly grouped address format:
 *   "NQ07 XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX"
 * Stripped addresses (no spaces) are rejected with "Unknown format / Invalid params".
 * This proxy normalises any NQ address in the params array to the grouped format.
 */

const RPC_ENDPOINTS = [
  'https://rpc.nimiqwatch.com',
  'https://rpc.mainnet.nimiq.network',
];

const ALLOWED_RPC_METHODS = new Set(['getAccountByAddress']);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rpcRequestLog = new Map<string, number[]>();

/**
 * Ensure a Nimiq address is in the grouped format the RPC node expects.
 * Leaves non-address strings untouched.
 */
function toRpcAddress(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const stripped = value.replace(/\s/g, '').toUpperCase();
  if (!/^NQ[0-9A-Z]{34}$/.test(stripped)) return value;
  const prefix = stripped.slice(0, 4);
  const rest   = stripped.slice(4);
  const groups = rest.match(/.{1,4}/g) ?? [];
  return [prefix, ...groups].join(' ');
}

/** Normalise NQ addresses anywhere in a JSON-RPC params array. */
function normaliseParams(params: unknown): unknown {
  if (Array.isArray(params)) return params.map(toRpcAddress);
  if (typeof params === 'object' && params !== null) {
    return Object.fromEntries(
      Object.entries(params as Record<string, unknown>).map(([k, v]) => [k, toRpcAddress(v)])
    );
  }
  return params;
}

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(request: NextRequest): boolean {
  const now = Date.now();
  const clientKey = getClientKey(request);
  const recentRequests = (rpcRequestLog.get(clientKey) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    rpcRequestLog.set(clientKey, recentRequests);
    return true;
  }

  recentRequests.push(now);
  rpcRequestLog.set(clientKey, recentRequests);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(request)) {
      return NextResponse.json(
        { error: 'Too many RPC requests. Please slow down.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Validate JSON-RPC structure
    if (!body.jsonrpc || !body.method || body.id === undefined) {
      console.error('[RPC Proxy] Invalid request structure');
      return NextResponse.json(
        { error: 'Invalid JSON-RPC request' },
        { status: 400 }
      );
    }

    if (!ALLOWED_RPC_METHODS.has(body.method)) {
      return NextResponse.json(
        { error: `RPC method not allowed: ${body.method}` },
        { status: 403 }
      );
    }

    // Use mainnet RPC endpoints
    const endpoints = RPC_ENDPOINTS;
    
    // Try each endpoint until one succeeds
    let lastError: any = null;
    
    for (let i = 0; i < endpoints.length; i++) {
      const rpcUrl = endpoints[i];

      try {
        // Normalise address params before forwarding — Nimiq RPC requires
        // the human-friendly spaced format; stripped addresses are rejected.
        const forwardBody = {
          ...body,
          params: normaliseParams(body.params),
        };

        // Forward the request to the Nimiq RPC endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per endpoint

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(forwardBody),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        // Check if response is ok
        if (!response.ok) {
          console.error('[RPC Proxy] HTTP error from upstream endpoint:', response.status, response.statusText);
          lastError = new Error(`RPC endpoint returned ${response.status}: ${response.statusText}`);
          continue; // Try next endpoint
        }

        // Get response text first to handle parsing errors
        const responseText = await response.text();
        
        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[RPC Proxy] JSON parse error from upstream endpoint');
          lastError = new Error('Failed to parse RPC response as JSON');
          continue; // Try next endpoint
        }

        // Success! Log and return
        if (data.error) {
          console.error('[RPC Proxy] RPC error from upstream endpoint');
        }

        return NextResponse.json(data, {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
          },
        });
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          console.error('[RPC Proxy] Timeout from upstream endpoint');
          lastError = new Error('RPC request timeout');
        } else {
          console.error('[RPC Proxy] Fetch error from upstream endpoint');
          lastError = fetchError;
        }
        
        // Continue to next endpoint
        continue;
      }
    }
    
    // All endpoints failed
    console.error('[RPC Proxy] All endpoints failed.');
    return NextResponse.json(
      { 
        jsonrpc: '2.0',
        error: { 
          code: -32603, 
          message: lastError?.message || 'All RPC endpoints failed' 
        },
        id: body.id
      },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('[RPC Proxy] Unexpected error');
    return NextResponse.json(
      { 
        jsonrpc: '2.0',
        error: { 
          code: -32603, 
          message: error.message || 'Internal RPC proxy error' 
        },
        id: null
      },
      { status: 500 }
    );
  }
}
