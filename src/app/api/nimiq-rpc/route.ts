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
  testnet: 'https://seed1.pos.nimiq-testnet.com:8648',
  mainnet: 'https://rpc.nimiqwatch.com',
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

    console.log('[RPC Proxy] Forwarding request:', body.method, 'to', network);

    // Forward the request to the Nimiq RPC endpoint
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Log errors for debugging
    if (data.error) {
      console.error('[RPC Proxy] RPC error:', data.error);
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[RPC Proxy] Error:', error.message);
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
