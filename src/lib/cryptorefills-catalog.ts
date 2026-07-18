/**
 * Cryptorefills Catalog Client (Frontend)
 * 
 * Provides a typed interface to the catalog API endpoints.
 * Data is fetched from the backend BFF (Backend-for-Frontend) routes.
 * 
 * This is a thin client - the heavy lifting is done server-side.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProductType = 'giftcard' | 'physical' | 'airtime' | 'data' | 'esim' | 'bills';

export interface CatalogCountry {
  code: string;
  name: string;
  loaded: boolean;
}

export interface CatalogBrand {
  name: string;
  family: string;
  brandId?: string;
  category?: string;
  min?: number;
  max?: number;
  productType: ProductType;
  logoUrl?: string;
}

export interface AmountValidation {
  valid: boolean;
  error?: string;
  suggestion?: number;
}

export interface CatalogSearchResult {
  brand: CatalogBrand;
  country: CatalogCountry;
}

// ─── API Client ──────────────────────────────────────────────────────────────

const API_BASE = '/api/cryptorefills-catalog';

// Cache for 5 minutes (catalog doesn't change frequently)
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Catalog API client
 */
class CryptorefillsCatalog {
  /**
   * Get all available countries
   */
  async getCountries(): Promise<CatalogCountry[]> {
    const cacheKey = 'countries';
    const cached = getCached<CatalogCountry[]>(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}/countries`);
    if (!res.ok) {
      throw new Error(`Failed to fetch countries: ${res.statusText}`);
    }

    const data = await res.json();
    const countries: CatalogCountry[] = data.countries || [];
    
    setCache(cacheKey, countries);
    return countries;
  }

  /**
   * Get popular countries (pre-loaded with products)
   */
  async getPopularCountries(): Promise<CatalogCountry[]> {
    const countries = await this.getCountries();
    
    // Popular countries based on usage
    const popularCodes = ['US', 'NG', 'GB', 'CA', 'KE', 'GH', 'ZA', 'IN', 'AU', 'DE'];
    
    return countries.filter(c => popularCodes.includes(c.code));
  }

  /**
   * Get products for a specific country
   */
  async getProducts(
    countryCode: string,
    productType?: ProductType
  ): Promise<CatalogBrand[]> {
    const cacheKey = `products:${countryCode}:${productType || 'all'}`;
    const cached = getCached<CatalogBrand[]>(cacheKey);
    if (cached) return cached;

    const url = productType
      ? `${API_BASE}/countries/${countryCode}/products?type=${productType}`
      : `${API_BASE}/countries/${countryCode}/products`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch products: ${res.statusText}`);
    }

    const data = await res.json();
    
    // Transform backend response to frontend format
    const brands: CatalogBrand[] = [];
    if (data.brands) {
      for (const [type, brandList] of Object.entries(data.brands)) {
        if (!productType || type === productType) {
          for (const brand of brandList as any[]) {
            brands.push({
              name: brand.name || brand.family,
              family: brand.family || brand.name,
              brandId: brand.brandId,
              category: brand.category,
              min: brand.min ? parseFloat(brand.min.replace('$', '')) : undefined,
              max: brand.max ? parseFloat(brand.max.replace('$', '')) : undefined,
              productType: type as ProductType,
              logoUrl: brand.logoUrl,
            });
          }
        }
      }
    }

    setCache(cacheKey, brands);
    return brands;
  }

  /**
   * Get brands for a specific product type (alias for getProducts)
   */
  async getBrands(
    countryCode: string,
    productType: ProductType
  ): Promise<CatalogBrand[]> {
    return this.getProducts(countryCode, productType);
  }

  /**
   * Search for brands across all countries
   */
  async searchBrands(
    query: string,
    productType?: ProductType
  ): Promise<CatalogSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const url = productType
      ? `${API_BASE}/search?q=${encodeURIComponent(query)}&type=${productType}`
      : `${API_BASE}/search?q=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to search brands: ${res.statusText}`);
    }

    const data = await res.json();
    return data.results || [];
  }

  /**
   * Validate amount against brand constraints
   */
  validateAmount(brand: CatalogBrand, amount: number): AmountValidation {
    // Client-side validation based on min/max
    if (brand.min !== undefined && amount < brand.min) {
      return {
        valid: false,
        error: `Amount too low. Minimum: $${brand.min}`,
        suggestion: brand.min,
      };
    }

    if (brand.max !== undefined && amount > brand.max) {
      return {
        valid: false,
        error: `Amount too high. Maximum: $${brand.max}`,
        suggestion: brand.max,
      };
    }

    return { valid: true };
  }

  /**
   * Find countries that have a specific brand
   */
  async findBrandCountries(brandName: string): Promise<CatalogSearchResult[]> {
    return this.searchBrands(brandName);
  }

  /**
   * Clear cache (useful after catalog updates)
   */
  clearCache(): void {
    cache.clear();
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

let catalogInstance: CryptorefillsCatalog | null = null;

/**
 * Get the catalog client instance
 */
export function getCatalog(): CryptorefillsCatalog {
  if (!catalogInstance) {
    catalogInstance = new CryptorefillsCatalog();
  }
  return catalogInstance;
}

// ─── Export Everything ───────────────────────────────────────────────────────

export { CryptorefillsCatalog };
export default getCatalog;
