function hasNimiqPayHost(): boolean {
  return typeof window !== 'undefined' && !!window.nimiqPay;
}

function isEmbeddedWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return hasNimiqPayHost() || /WebView|; wv\)|FBAN|FBAV|Instagram|Line\//i.test(ua);
}

export function openExternalUrl(url: string) {
  if (typeof window === 'undefined') return;

  if (isEmbeddedWebView()) {
    window.location.assign(url);
    return;
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.assign(url);
  }
}
