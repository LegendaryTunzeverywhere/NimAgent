'use client';

import { useEffect } from 'react';

// Prefetch CSRF token on initial load for better UX
export default function CsrfPrefetcher() {
  useEffect(() => {
    // Prefetch the token in the background
    const prefetchToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        if (response.ok) {
          const data = await response.json();
          // Store the token in a global variable or state if needed
          // For now, just having fetched it will cache the cookie
          console.log('[CSRF] Token prefetched successfully');
        }
      } catch (error) {
        // Non-blocking: if prefetch fails, we'll fetch when needed
        console.warn('[CSRF] Token prefetch failed, will fetch later');
      }
    };

    prefetchToken();
  }, []);

  return null;
}
