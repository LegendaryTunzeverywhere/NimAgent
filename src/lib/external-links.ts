function hasNimiqPayHost(): boolean {
  return typeof window !== 'undefined' && !!window.nimiqPay;
}

function isEmbeddedWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return hasNimiqPayHost() || /WebView|; wv\)|FBAN|FBAV|Instagram|Line\//i.test(ua);
}

/**
 * Opens an external URL without losing the current session.
 * 
 * For embedded webviews (Nimiq Pay mini-app):
 * - Attempts to open in new window/tab (system browser)
 * - Falls back to creating a temporary link with target="_blank"
 * - Avoids window.location.assign() which navigates away and loses session
 * 
 * For regular browsers:
 * - Uses window.open() with noopener,noreferrer for security
 */
export function openExternalUrl(url: string) {
  if (typeof window === 'undefined') return;

  if (isEmbeddedWebView()) {
    // CRITICAL FIX: Don't use window.location.assign() in embedded webview
    // as it navigates away from the app and loses the session/authentication.
    
    // Strategy 1: Try window.open() first - some webviews will open in system browser
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    
    // Strategy 2: If popup blocked or failed, create a temporary link element
    // This technique is more likely to trigger the system browser in webviews
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      console.log('[External Link] Using fallback link strategy for embedded webview');
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // iOS webviews often require user gesture context
      // Append to body temporarily to ensure proper context
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Programmatic click to trigger navigation
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    }
    
    return;
  }

  // Regular browser: standard popup behavior
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    // Popup blocked - fall back to current window navigation
    window.location.assign(url);
  }
}

