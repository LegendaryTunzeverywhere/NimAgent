import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — deep-links all nimagent.online URLs into Nimiq Pay.
 *
 * Any link opened in a regular browser that should run inside Nimiq Pay
 * gets intercepted here and redirected through the nimiqpay:// scheme.
 *
 * Handled link types:
 *   - Payment links:  /?to=NQ...&amount=1&message=...
 *   - Referral links: /?ref=CODE
 *   - Any other path: the full URL is passed through to the mini app
 *
 * If Nimiq Pay is installed → OS opens the app directly into NimAgent
 * If not installed → fallback to the Nimiq Pay download page after 1.5s
 */

const NIMIQ_PAY_DOWNLOAD = 'https://www.nimiq.com/nimiq-pay/';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nimagent.online';

function isNimiqPayWebView(req: NextRequest): boolean {
  const ua       = (req.headers.get('user-agent') || '').toLowerCase();
  const platform = (req.headers.get('x-client-platform') || '').toLowerCase();
  return (
    platform.includes('nimiq-pay') ||
    ua.includes('nimiqpay') ||
    ua.includes('nimiq-pay')
  );
}

function shouldIntercept(req: NextRequest): boolean {
  const { pathname, searchParams } = req.nextUrl;

  // Skip API routes, static files, Next internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) return false;

  // Skip if already inside Nimiq Pay WebView
  if (isNimiqPayWebView(req)) return false;

  // Intercept payment links
  if (searchParams.has('to')) return true;

  // Intercept referral links
  if (searchParams.has('ref')) return true;

  // Intercept any other nimagent.online path that isn't the bare root
  // (e.g. /pay/NQ..., future routes, etc.)
  if (pathname !== '/') return true;

  return false;
}

function buildDeepLinkPage(deepLink: string, label: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Opening NimAgent…</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#0f172a;color:#fff;
      min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    }
    .card{
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      border-radius:24px;padding:32px 24px;
      max-width:380px;width:100%;text-align:center;
    }
    .logo{
      width:64px;height:64px;
      background:linear-gradient(135deg,#F5A623,#e08c0a);
      border-radius:18px;margin:0 auto 20px;
      display:flex;align-items:center;justify-content:center;font-size:28px;
    }
    h1{font-size:20px;font-weight:800;margin-bottom:8px}
    p{font-size:14px;color:rgba(255,255,255,.6);line-height:1.6}
    .spinner{
      width:32px;height:32px;
      border:3px solid rgba(245,166,35,.3);border-top-color:#F5A623;
      border-radius:50%;animation:spin .8s linear infinite;margin:20px auto 0;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .btn{
      display:inline-block;margin-top:24px;padding:12px 24px;
      background:#F5A623;color:#000;font-weight:700;font-size:14px;
      border-radius:14px;text-decoration:none;
    }
    .sub{margin-top:12px;font-size:12px;color:rgba(255,255,255,.35)}
    .dl{
      display:block;margin-top:12px;font-size:12px;
      color:rgba(245,166,35,.7);text-decoration:underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚡</div>
    <h1>Opening NimAgent</h1>
    <p>${label}</p>
    <div class="spinner" id="spinner"></div>
    <a href="${deepLink}" class="btn" id="openBtn" style="display:none">Open in Nimiq Pay</a>
    <p class="sub" id="sub"></p>
    <a href="${NIMIQ_PAY_DOWNLOAD}" class="dl" id="dlLink" style="display:none">
      Download Nimiq Pay
    </a>
  </div>
  <script>
    window.location.href="${deepLink}";
    setTimeout(function(){
      document.getElementById('spinner').style.display='none';
      document.getElementById('openBtn').style.display='inline-block';
      document.getElementById('sub').textContent="If Nimiq Pay isn't installed yet, use the button above or download it below.";
      document.getElementById('dlLink').style.display='block';
      setTimeout(function(){ window.location.href="${NIMIQ_PAY_DOWNLOAD}"; }, 3000);
    }, 1500);
  </script>
</body>
</html>`;
}

export function middleware(req: NextRequest) {
  if (!shouldIntercept(req)) return NextResponse.next();

  // Build the exact URL we want Nimiq Pay to open
  const targetUrl = `${FRONTEND_URL}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const deepLink  = `nimiqpay://miniapp?url=${encodeURIComponent(targetUrl)}`;

  // Pick a human-readable label based on what kind of link it is
  const { searchParams, pathname } = req.nextUrl;
  let label = 'This link opens inside the Nimiq Pay app.';
  if (searchParams.has('to')) {
    const amount = searchParams.get('amount');
    label = amount
      ? `Payment request for ${amount} NIM — opens in Nimiq Pay.`
      : 'Payment request — opens inside Nimiq Pay.';
  } else if (searchParams.has('ref')) {
    label = 'Referral link — opens inside Nimiq Pay.';
  }

  return new NextResponse(buildDeepLinkPage(deepLink, label), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
