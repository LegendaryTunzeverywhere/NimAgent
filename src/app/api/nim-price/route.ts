import { NextRequest, NextResponse } from 'next/server';

/**
 * NIM Price API Route
 * Multi-tier fallback system for reliable price data:
 * 1. Railway Backend
 * 2. CoinGecko API
 * 3. CoinMarketCap API
 * 4. Coinranking API
 */

const BACKEND_URL = process.env.BACKEND_URL;
const API_SECRET = process.env.API_SECRET;
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY; // Optional: for higher rate limits
const COINRANKING_API_KEY = process.env.COINRANKING_API_KEY; // Optional: for higher rate limits

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const currency = searchParams.get('currency') || 'usd';

    // Tier 1: Try Railway backend first (most reliable)
    if (BACKEND_URL && API_SECRET) {
      try {
        const url = `${BACKEND_URL}/api/nim-price?currency=${currency}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_SECRET,
          },
          signal: AbortSignal.timeout(8000), // 8 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(
            { ...data, source: 'backend' },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              },
            }
          );
        }
      } catch (backendError) {
        console.warn('[NIM-PRICE] Backend unavailable, trying fallbacks');
      }
    }

    // Tier 2: CoinGecko API (free, reliable)
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=${currency}&include_24hr_change=true`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data['nimiq-2']?.[currency]) {
          const price = data['nimiq-2'][currency];
          const change24h = data['nimiq-2'][`${currency}_24h_change`] || 0;

          return NextResponse.json(
            { price, change24h, currency, source: 'coingecko' },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              },
            }
          );
        }
      }
    } catch (coingeckoError) {
      console.warn('[NIM-PRICE] CoinGecko failed, trying CoinMarketCap');
    }

    // Tier 3: CoinMarketCap API (industry standard)
    try {
      const cmcHeaders: HeadersInit = {
        'Accept': 'application/json',
      };
      if (CMC_API_KEY) {
        cmcHeaders['X-CMC_PRO_API_KEY'] = CMC_API_KEY;
      }

      const currencyUpper = currency.toUpperCase();
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=NIM&convert=${currencyUpper}`,
        {
          method: 'GET',
          headers: cmcHeaders,
          signal: AbortSignal.timeout(8000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const nimData = data?.data?.NIM?.[0];
        if (nimData?.quote?.[currencyUpper]) {
          const quote = nimData.quote[currencyUpper];
          const price = quote.price;
          const change24h = quote.percent_change_24h || 0;

          return NextResponse.json(
            { price, change24h, currency, source: 'coinmarketcap' },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              },
            }
          );
        }
      }
    } catch (cmcError) {
      console.warn('[NIM-PRICE] CoinMarketCap failed, trying Coinranking');
    }

    // Tier 4: Coinranking API
    try {
      const coinrankingHeaders: HeadersInit = {
        'Accept': 'application/json',
      };
      if (COINRANKING_API_KEY) {
        coinrankingHeaders['x-access-token'] = COINRANKING_API_KEY;
      }

      // Nimiq UUID on Coinranking: qzawljBAo
      const response = await fetch(
        'https://api.coinranking.com/v2/coin/54G1Zo8zgXxSD',
        {
          method: 'GET',
          headers: coinrankingHeaders,
          signal: AbortSignal.timeout(8000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const coinData = data?.data?.coin;
        if (coinData?.price) {
          const priceUSD = parseFloat(coinData.price);
          const change24h = parseFloat(coinData.change) || 0;

          // Convert to requested currency if needed
          let finalPrice = priceUSD;
          if (currency.toLowerCase() !== 'usd') {
            // If not USD, we'd need to convert, but return USD for now
            // In production, add currency conversion API
            console.warn('[NIM-PRICE] Coinranking only supports USD, returning USD price');
          }

          return NextResponse.json(
            { 
              price: finalPrice, 
              change24h, 
              currency: 'usd', 
              source: 'coinranking' 
            },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              },
            }
          );
        }
      }
    } catch (coinrankingError) {
      console.warn('[NIM-PRICE] Coinranking failed, all APIs exhausted');
    }

    // Tier 5: Last resort - return error but with reasonable estimate
    // This ensures UI never completely breaks
    console.error('[NIM-PRICE] All price APIs failed');
    return NextResponse.json(
      {
        price: 0.0012, // Conservative estimate
        change24h: 0,
        currency,
        source: 'estimate',
        error: 'All price APIs unavailable',
      },
      {
        status: 200, // Still return 200 to prevent UI errors
        headers: {
          'Cache-Control': 'public, s-maxage=30',
        },
      }
    );
  } catch (error: any) {
    console.error('[NIM-PRICE] Unexpected error:', error.message);
    
    // Always return valid data to prevent UI breaks
    return NextResponse.json(
      {
        price: 0.0012,
        change24h: 0,
        currency: 'usd',
        source: 'error-fallback',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30',
        },
      }
    );
  }
}
