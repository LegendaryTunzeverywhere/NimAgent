import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — handles nimagent.online link routing.
 *
 * IMPORTANT: Nimiq Pay's WebView uses a standard Chrome/Android UA with no
 * "nimiqpay" string, so we cannot reliably detect it server-side.
 *
 * Strategy:
 *   - Root path "/" with NO params → always pass through. React handles
 *     isInsideNimiqPay() detection client-side via window.nimiqPay / init().
 *   - Root path "/" with ?to= or ?ref= params → show the instruction page
 *     only when opened from a regular external browser (share link scenario).
 *     But we CANNOT distinguish Nimiq Pay's browser from a regular browser
 *     here, so we pass ALL requests with params through to React too.
 *     React's PaymentLinkHandler will process them correctly inside Nimiq Pay.
 *   - Any other path → pass through (React handles it).
 *
 * Result: The middleware is now a no-op pass-through. The instruction page
 * for external browsers is shown by React's NimiqPayRequired component
 * (when isInsideNimiqPay() returns false after client-side detection).
 */

export function middleware(_req: NextRequest) {
  // Always pass through — let React handle detection client-side
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
