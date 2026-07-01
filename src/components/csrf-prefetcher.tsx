'use client';

import { useEffect } from 'react';
import { hasNimiqPayHostHint } from '@/lib/wallet/detect';
import { getClientPlatformHeaders } from '@/lib/client-platform';

// Prefetch CSRF token on initial load for better UX
export default function CsrfPrefetcher() {
  useEffect(() => {
    if (!hasNimiqPayHostHint()) return;

    // Prefetch the token in the background
    const prefetchToken = async () => {
      try {
        const response = await fetch('/api/csrf-token', {
          credentials: 'include',
          headers: getClientPlatformHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          // Store the token in a global variable or state if needed
          // For now, just having fetched it will cache the cookie
        }
      } catch (error) {
        // Non-blocking: if prefetch fails, we'll fetch when needed
      }
    };

    prefetchToken();
  }, []);

  return null;
}
