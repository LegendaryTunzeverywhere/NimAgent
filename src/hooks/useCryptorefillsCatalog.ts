/**
 * React Hooks for Cryptorefills Catalog
 * 
 * Provides easy-to-use hooks for accessing catalog data in React components.
 */

import { useState, useEffect } from 'react';
import {
  getCatalog,
  type ProductType,
  type CatalogCountry,
  type CatalogBrand,
  type AmountValidation,
} from '@/lib/cryptorefills-catalog';

/**
 * Hook to fetch all countries
 */
export function useCatalogCountries() {
  const [countries, setCountries] = useState<CatalogCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const catalog = getCatalog();
    
    catalog.getCountries()
      .then(setCountries)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading, error };
}

/**
 * Hook to fetch popular countries
 */
export function usePopularCountries() {
  const [countries, setCountries] = useState<CatalogCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const catalog = getCatalog();
    
    catalog.getPopularCountries()
      .then(setCountries)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading, error };
}

/**
 * Hook to fetch brands for a specific product type
 */
export function useCatalogBrands(
  countryCode: string | null,
  productType: ProductType | null
) {
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCode || !productType) {
      setBrands([]);
      return;
    }

    setLoading(true);
    setError(null);

    const catalog = getCatalog();
    
    catalog.getBrands(countryCode, productType)
      .then(setBrands)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [countryCode, productType]);

  return { brands, loading, error };
}

/**
 * Hook to search for brands
 */
export function useCatalogSearch(query: string, productType?: ProductType) {
  const [results, setResults] = useState<Array<{
    brand: CatalogBrand;
    country: CatalogCountry;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    const catalog = getCatalog();
    
    catalog.searchBrands(query, productType)
      .then(setResults)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, productType]);

  return { results, loading, error };
}

/**
 * Hook to validate an amount against a brand's constraints
 */
export function useAmountValidation(
  brand: CatalogBrand | null,
  amount: number | null
): AmountValidation {
  const [validation, setValidation] = useState<AmountValidation>({ valid: true });

  useEffect(() => {
    if (!brand || !amount) {
      setValidation({ valid: true });
      return;
    }

    const catalog = getCatalog();
    setValidation(catalog.validateAmount(brand, amount));
  }, [brand, amount]);

  return validation;
}

/**
 * Hook to get products for a country
 */
export function useCatalogProducts(
  countryCode: string | null,
  productType?: ProductType
) {
  const [products, setProducts] = useState<CatalogBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCode) {
      setProducts([]);
      return;
    }

    setLoading(true);
    setError(null);

    const catalog = getCatalog();
    
    catalog.getProducts(countryCode, productType)
      .then(setProducts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [countryCode, productType]);

  return { products, loading, error };
}
