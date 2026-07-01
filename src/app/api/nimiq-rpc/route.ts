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

const RPC_ENDPOINTS = {
  testnet: [
    'https://rpc.nimiq-testnet.com',
    'https://test.nimiq.watch:8443',
    'https://nimiq-testnet.tromod.com',
  ],
  mainnet: [
    'https://rpc.nimiqwatch.com',
    'https://rpc.mainnet.nimiq.network',
  ],
};

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate JSON-RPC structure
    if (!body.jsonrpc || !body.method || body.id === undefined) {
      console.error('[RPC Proxy] Invalid request structure:', body);
      return NextResponse.json(
        { error: 'Invalid JSON-RPC request' },
        { status: 400 }
      );
    }

    // Determine which RPC endpoint to use
    const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK;
    const endpoints = RPC_ENDPOINTS[network as keyof typeof RPC_ENDPOINTS] || RPC_ENDPOINTS.mainnet;
    
    // Try each endpoint until one succeeds
    let lastError: any = null;
    
    for (let i = 0; i < endpoints.length; i++) {
      const rpcUrl = endpoints[i];
      
      console.log('[RPC Proxy] Attempting endpoint', i + 1, 'of', endpoints.length, ':', {
        method: body.method,
        network,
        rpcUrl,
        paramsType: Array.isArray(body.params) ? 'array' : typeof body.params,
        paramsLength: Array.isArray(body.params) ? body.params.length : 'n/a'
      });

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
          console.error('[RPC Proxy] HTTP error from', rpcUrl, ':', response.status, response.statusText);
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
          console.error('[RPC Proxy] JSON parse error from', rpcUrl, ':', parseError);
          console.error('[RPC Proxy] Response text:', responseText.slice(0, 500));
          lastError = new Error('Failed to parse RPC response as JSON');
          continue; // Try next endpoint
        }

        // Success! Log and return
        if (data.error) {
          console.error('[RPC Proxy] RPC error from', rpcUrl, ':', data.error);
        } else {
          console.log('[RPC Proxy] Success from', rpcUrl);
        }

        return NextResponse.json(data, {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
          },
        });
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          console.error('[RPC Proxy] Timeout from', rpcUrl);
          lastError = new Error('RPC request timeout');
        } else {
          console.error('[RPC Proxy] Fetch error from', rpcUrl, ':', fetchError.message);
          lastError = fetchError;
        }
        
        // Continue to next endpoint
        continue;
      }
    }
    
    // All endpoints failed
    console.error('[RPC Proxy] All endpoints failed. Last error:', lastError?.message);
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
    console.error('[RPC Proxy] Error:', error.message);
    console.error('[RPC Proxy] Stack:', error.stack);
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
