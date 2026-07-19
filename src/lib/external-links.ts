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
 * - NEVER uses window.location.assign() which destroys session
 * - Creates a properly configured link element to trigger system browser
 * - Uses multiple strategies to ensure external browser opens
 * 
 * For regular browsers:
 * - Uses window.open() with noopener,noreferrer for security
 */
export function openExternalUrl(url: string) {
  if (typeof window === 'undefined') return;

  console.log('[External Link] Opening URL:', url, 'inWebview:', isEmbeddedWebView());

  if (isEmbeddedWebView()) {
    // CRITICAL FIX: In embedded webview, NEVER navigate the current window
    // as it destroys the app's session and state.
    
    // Strategy: Create a properly configured link element
    // Most mobile webviews will intercept target="_blank" and open in system browser
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // Hide the link (don't pollute UI)
    link.style.display = 'none';
    link.style.position = 'absolute';
    link.style.left = '-9999px';
    
    // Append to body (required for iOS/Android webviews to detect user gesture)
    document.body.appendChild(link);
    
    console.log('[External Link] Triggering link click in webview');
    
    // Trigger the link
    try {
      link.click();
    } catch (err) {
      console.error('[External Link] Click failed:', err);
    }
    
    // Clean up after a short delay
    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    }, 500);
    
    // ABSOLUTELY DO NOT fall back to window.location.assign()
    // That would defeat the entire purpose of this fix
    return;
  }

  // Regular browser: try window.open() first
  console.log('[External Link] Opening in regular browser');
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  
  if (!popup) {
    // Popup blocked - only now do we fall back to navigation
    // This only happens in regular browsers, never in webview
    console.warn('[External Link] Popup blocked, falling back to navigation');
    window.location.assign(url);
  }
}

