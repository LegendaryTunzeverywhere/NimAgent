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
  testnet: 'https://rpc.pos.nimiq-testnet.com',
  mainnet: 'https://rpc.mainnet.nimiq.network',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate JSON-RPC structure
    if (!body.jsonrpc || !body.method || body.id === undefined) {
      return NextResponse.json(
        { error: 'Invalid JSON-RPC request' },
        { status: 400 }
      );
    }

    // Determine which RPC endpoint to use
    const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
    const rpcUrl = RPC_ENDPOINTS[network as keyof typeof RPC_ENDPOINTS] || RPC_ENDPOINTS.testnet;

    console.log('[RPC Proxy] Forwarding request:', body.method, 'to', network, rpcUrl);

    // Forward the request to the Nimiq RPC endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
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
        console.error('[RPC Proxy] HTTP error:', response.status, response.statusText);
        return NextResponse.json(
          { 
            jsonrpc: '2.0',
            error: { 
              code: -32603, 
              message: `RPC endpoint returned ${response.status}: ${response.statusText}` 
            },
            id: body.id
          },
          { status: 500 }
        );
      }

      // Get response text first to handle parsing errors
      const responseText = await response.text();
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[RPC Proxy] JSON parse error:', parseError);
        console.error('[RPC Proxy] Response text:', responseText.slice(0, 500));
        return NextResponse.json(
          { 
            jsonrpc: '2.0',
            error: { 
              code: -32603, 
              message: 'Failed to parse RPC response as JSON' 
            },
            id: body.id
          },
          { status: 500 }
        );
      }

      // Log errors for debugging
      if (data.error) {
        console.error('[RPC Proxy] RPC error:', data.error);
      }

      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('[RPC Proxy] Request timeout');
        return NextResponse.json(
          { 
            jsonrpc: '2.0',
            error: { 
              code: -32603, 
              message: 'RPC request timeout after 30 seconds' 
            },
            id: body.id
          },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
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
