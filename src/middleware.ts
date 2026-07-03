import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — handles all nimagent.online URL routing.
 *
 * NimAgent is not yet a registered Nimiq Pay mini app, so the
 * nimiqpay://miniapp?url=... deep link scheme does NOT work yet.
 *
 * Instead, when a link is opened in a regular browser we show a clear
 * instruction page explaining how to open it inside Nimiq Pay's built-in
 * browser, which is how unregistered web apps work in the mini-app ecosystem.
 *
 * When already inside Nimiq Pay's WebView → pass through to React app.
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
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) return false;

  if (isNimiqPayWebView(req)) return false;

  return true;
}

function buildInstructionPage(targetUrl: string, label: string): string {
  const encodedUrl = encodeURIComponent(targetUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Open NimAgent</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#0f172a;color:#fff;
      min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
    }
    .card{
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:24px;padding:28px 22px;max-width:380px;width:100%;text-align:center;
    }
    .logo{
      width:64px;height:64px;background:linear-gradient(135deg,#F5A623,#e08c0a);
      border-radius:18px;margin:0 auto 20px;
      display:flex;align-items:center;justify-content:center;font-size:28px;
    }
    h1{font-size:20px;font-weight:800;margin-bottom:8px;line-height:1.3}
    .desc{font-size:13px;color:rgba(255,255,255,.55);line-height:1.6;margin-bottom:20px}
    .steps{
      text-align:left;padding:16px;border-radius:14px;
      background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
      margin-bottom:20px;
    }
    .steps-title{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;
      letter-spacing:.1em;font-weight:700;margin-bottom:12px}
    .step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
    .step:last-child{margin-bottom:0}
    .step-num{
      width:20px;height:20px;border-radius:50%;background:#F5A623;color:#000;
      font-size:10px;font-weight:800;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;margin-top:1px;
    }
    .step-text{font-size:13px;color:rgba(255,255,255,.7);line-height:1.5}
    .step-text strong{color:#fff}
    .url-box{
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
      border-radius:10px;padding:10px 12px;
      font-family:monospace;font-size:12px;color:#F5A623;
      word-break:break-all;text-align:left;margin-top:8px;margin-bottom:20px;
    }
    .btn{
      display:block;width:100%;padding:13px;
      background:#F5A623;color:#000;font-weight:700;font-size:14px;
      border-radius:14px;text-decoration:none;cursor:pointer;border:none;
    }
    .btn:active{opacity:.9}
    .btn-outline{
      display:block;width:100%;padding:11px;margin-top:10px;
      border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.65);
      font-weight:600;font-size:13px;border-radius:14px;
      text-decoration:none;background:transparent;cursor:pointer;
    }
    .note{font-size:11px;color:rgba(255,255,255,.3);margin-top:16px;line-height:1.5}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚡</div>
    <h1>Open NimAgent</h1>
    <p class="desc">${label}</p>

    <div class="steps">
      <p class="steps-title">How to open</p>
      <div class="step">
        <span class="step-num">1</span>
        <span class="step-text">Open the <strong>Nimiq Pay</strong> app on your phone</span>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        <span class="step-text">Tap the <strong>browser / globe icon</strong> inside Nimiq Pay</span>
      </div>
      <div class="step">
        <span class="step-num">3</span>
        <span class="step-text">Navigate to this address:</span>
      </div>
      <div class="url-box" id="urlBox">${targetUrl}</div>
    </div>

    <button class="btn" onclick="copyUrl()">📋 Copy Link</button>
    <a href="${NIMIQ_PAY_DOWNLOAD}" class="btn-outline">Get Nimiq Pay</a>

    <p class="note">
      NimAgent runs inside Nimiq Pay's browser.<br/>
      It will be available as a registered mini app soon.
    </p>
  </div>

  <script>
    function copyUrl() {
      var url = ${JSON.stringify(targetUrl)};
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          var btn = document.querySelector('.btn');
          btn.textContent = '✓ Copied!';
          setTimeout(function() { btn.textContent = '📋 Copy Link'; }, 2000);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        var btn = document.querySelector('.btn');
        btn.textContent = '✓ Copied!';
        setTimeout(function() { btn.textContent = '📋 Copy Link'; }, 2000);
      }
    }
  </script>
</body>
</html>`;
}

export function middleware(req: NextRequest) {
  if (!shouldIntercept(req)) return NextResponse.next();

  const targetUrl = `${FRONTEND_URL}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const { searchParams } = req.nextUrl;

  let label = 'NimAgent runs inside the Nimiq Pay app. Open it in Nimiq Pay\'s browser to continue.';
  if (searchParams.has('to')) {
    const amount = searchParams.get('amount');
    label = amount
      ? `Payment request for <strong>${amount} NIM</strong> — open in Nimiq Pay's browser to complete it.`
      : 'Payment request — open in Nimiq Pay\'s browser to complete it.';
  } else if (searchParams.has('ref')) {
    label = 'Referral link — open in Nimiq Pay\'s browser to activate it.';
  }

  return new NextResponse(buildInstructionPage(targetUrl, label), {
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
