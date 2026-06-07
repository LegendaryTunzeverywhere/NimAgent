import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Set security headers (applies to all routes)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy - allows Nimiq RPC connections for staking and camera access for QR scanning
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.coingecko.com https://api.coinmarketcap.com https://api.coinranking.com https://seed1.pos.nimiq-testnet.com:8648 https://seed2.pos.nimiq-testnet.com:8648 https://seed3.pos.nimiq-testnet.com:8648 https://seed4.pos.nimiq-testnet.com:8648 https://rpc.testnet.nimiqwatch.com https://api.nimiq.watch https://test.nimiq.watch https://seed1.pos.nimiq.com:8648 https://seed2.pos.nimiq.com:8648 https://seed3.pos.nimiq.com:8648 https://seed4.pos.nimiq.com:8648",
    "img-src 'self' data: https:",
    "media-src 'self' blob:",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// Apply middleware to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
