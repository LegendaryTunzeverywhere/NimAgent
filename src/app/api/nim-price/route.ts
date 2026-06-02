import { NextRequest, NextResponse } from 'next/server';

/**
 * NIM Price API Route
 * Proxies to CoinGecko or backend with fallback for reliability
 */

const BACKEND_URL = process.env.BACKEND_URL;
const API_SECRET = process.env.API_SECRET;

// Fallback prices (approximate) in case all APIs fail
const FALLBACK_PRICES = {
  usd: 0.0012,
  ngn: 0.85,
  eur: 0.0011,
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const currency = searchParams.get('currency') || 'usd';

    // Try Railway backend first
    if (BACKEND_URL && API_SECRET) {
      try {
        const url = `${BACKEND_URL}/api/nim-price?currency=${currency}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_SECRET,
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
          });
        }
      } catch (backendError) {
        console.error('[NIM-PRICE] Backend fetch failed:', backendError instanceof Error ? backendError.message : 'Unknown error');
      }
    }

    // Fallback to CoinGecko directly
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=${currency}&include_24hr_change=true`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000), // 8 second timeout
        }
      );

      if (response.ok) {
        const data = await response.json();
        const price = data['nimiq-2']?.[currency] || FALLBACK_PRICES[currency as keyof typeof FALLBACK_PRICES] || 0.001;
        const change24h = data['nimiq-2']?.[`${currency}_24h_change`] || 0;

        return NextResponse.json(
          {
            price,
            change24h,
            currency,
            source: 'coingecko',
          },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
          }
        );
      }
    } catch (coingeckoError) {
      console.error('[NIM-PRICE] CoinGecko fetch failed:', coingeckoError instanceof Error ? coingeckoError.message : 'Unknown error');
    }

    // Final fallback - return hardcoded estimate
    console.warn('[NIM-PRICE] All sources failed, using fallback price');
    return NextResponse.json(
      {
        price: FALLBACK_PRICES[currency as keyof typeof FALLBACK_PRICES] || 0.001,
        change24h: 0,
        currency,
        source: 'fallback',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    console.error('[NIM-PRICE] Unexpected error:', error.message);
    
    // Always return something so the UI doesn't break
    return NextResponse.json(
      {
        price: 0.001,
        change24h: 0,
        currency: 'usd',
        source: 'error-fallback',
      },
      {
        status: 200, // Return 200 to prevent UI errors
        headers: {
          'Cache-Control': 'public, s-maxage=30',
        },
      }
    );
  }
}
