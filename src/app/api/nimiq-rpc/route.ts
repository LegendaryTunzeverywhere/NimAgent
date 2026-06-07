import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Nimiq RPC Proxy
 * 
 * Proxies JSON-RPC requests to Nimiq nodes to avoid CORS issues.
 * Browser → This endpoint → Nimiq RPC → Browser
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
    const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
    const endpoints = RPC_ENDPOINTS[network as keyof typeof RPC_ENDPOINTS] || RPC_ENDPOINTS.testnet;
    
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
        // Forward the request to the Nimiq RPC endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per endpoint

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
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
