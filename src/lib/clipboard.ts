/**
 * Cross-platform clipboard utility with WebView fallback.
 * 
 * WebViews often block the Clipboard API. This utility provides
 * a textarea-based fallback for broader compatibility.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: create hidden textarea and use execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch {
      success = false;
    }
    
    document.body.removeChild(ta);
    return success;
  }
}
