import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ui/ProductCard';
import { apiClient } from '../api/client';
import { productsApi } from '../api/products.api';

const sizeOptions = ['UK 6', 'UK 7', 'UK 8', 'UK 9'];
const colorOptions = ['Black', 'White', 'Grey'];
const genderOptions = ['MEN', 'WOMEN', 'UNISEX'];

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'featured', label: 'Featured' },
];

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(params.get('search') || '');
  const [minPriceInput, setMinPriceInput] = useState(params.get('minPrice') || '');
  const [maxPriceInput, setMaxPriceInput] = useState(params.get('maxPrice') || '');

  const filters = useMemo(
    () => ({
      page: Number(params.get('page') || 1),
      limit: Number(params.get('limit') || 12),
      category: params.get('category') || '',
      brand: params.get('brand') || '',
      gender: params.get('gender') || '',
      sort: params.get('sort') || 'newest',
      search: params.get('search') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      size: params.get('size') || '',
      color: params.get('color') || '',
    }),
    [params],
  );

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const clearFilters = () => {
    setParams(new URLSearchParams({ limit: String(filters.limit) }));
    setSearchInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchInput(filters.search), 0);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinPriceInput(filters.minPrice);
      setMaxPriceInput(filters.maxPrice);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters.minPrice, filters.maxPrice]);

  useEffect(() => {
    if (searchInput === filters.search) return undefined;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (searchInput) next.set('search', searchInput);
      else next.delete('search');
      next.delete('page');
      setParams(next);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search, params, setParams]);

  const categoriesQuery = useQuery({
    queryKey: ['shop-categories'],
    queryFn: () => apiClient.get('/categories').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

  const brandsQuery = useQuery({
    queryKey: ['shop-brands'],
    queryFn: () => apiClient.get('/brands').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

  const query = useQuery({
    queryKey: ['products-list', filters],
    queryFn: () => productsApi.getList(filters).then((response) => unwrapPayload(response)),
    placeholderData: (previousData) => previousData,
  });

  const categoryOptions = toArray(unwrapPayload(categoriesQuery.data));
  const brandOptions = toArray(unwrapPayload(brandsQuery.data));
  const products = Array.isArray(query.data?.items) ? query.data.items : [];
  const total = Number(query.data?.total ?? products.length ?? 0);
  const totalPages = Math.max(Number(query.data?.totalPages || 1), 1);
  const activeFilterCount = [filters.category, filters.brand, filters.gender, filters.search, filters.minPrice, filters.maxPrice, filters.size, filters.color].filter(Boolean).length;
  const activeSortLabel = sortOptions.find((option) => option.value === filters.sort)?.label || 'Newest';

  const applyPrice = () => {
    const next = new URLSearchParams(params);
    if (minPriceInput) next.set('minPrice', minPriceInput);
    else next.delete('minPrice');
    if (maxPriceInput) next.set('maxPrice', maxPriceInput);
    else next.delete('maxPrice');
    next.delete('page');
    setParams(next);
  };

  const getCategoryValue = (option) => option?._id || option?.id || option?.slug || option?.name || option;

  return (
    <div className="bg-[#0a0a0a]">
      <div className="kicks-page pb-14 pt-8 sm:pt-12">
        {/* Header — editorial hierarchy */}
        <nav aria-label="Breadcrumb" className="kicks-eyebrow flex flex-wrap items-center gap-2 text-[10.5px]">
          <Link to="/" className="transition hover:text-white">Home</Link>
          <span aria-hidden="true" className="text-[#4d4d4d]">/</span>
          <Link to="/shop" className="transition hover:text-white">Shop</Link>
          <span aria-hidden="true" className="text-[#4d4d4d]">/</span>
          <span className="text-white">All sneakers</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div className="min-w-0">
            <h1 className="kicks-page-title">All sneakers</h1>
            <p className="mt-3 text-[13px] text-[#9a9a9a]" aria-live="polite">
              {query.isLoading ? 'Loading styles…' : `${total} ${total === 1 ? 'style' : 'styles'} in the current selection`}
            </p>
          </div>

          {/* Compact sort — large desktop right; toolbar owns it below lg */}
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <label htmlFor="shop-sort-desktop" className="text-[10.5px] uppercase tracking-[0.22em] text-[#8d8d8d]">
              Sort
            </label>
            <div className="relative">
              <ArrowUpDown size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
              <select
                id="shop-sort-desktop"
                value={filters.sort}
                onChange={(event) => setFilter('sort', event.target.value)}
                aria-label="Sort products"
                className="kicks-field kicks-field-sm w-auto min-w-[168px] cursor-pointer appearance-none pl-10 pr-8"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <span className="hidden text-xs text-[#6d6d6d] md:block">{activeSortLabel}</span>
          </div>
        </div>

        {/* Category row — real backend categories only */}
        <div className="mt-7 border-y border-white/10 py-3">
          <div className="kicks-scroll-row" role="tablist" aria-label="Filter by category">
            <button
              type="button"
              role="tab"
              aria-selected={!filters.category}
              aria-pressed={!filters.category}
              onClick={() => setFilter('category', '')}
              className="kicks-pill"
            >
              All
            </button>
            {categoryOptions.map((option) => {
              const value = getCategoryValue(option);
              const label = option?.name || option?.title || String(option);
              const isActive = String(filters.category) === String(value);
              return (
                <button
                  key={value || label}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-pressed={isActive}
                  onClick={() => setFilter('category', isActive ? '' : value)}
                  className="kicks-pill"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar — one responsive row: [ search ][ filter ][ sort ] */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="relative min-w-0 flex-1 basis-[120px] sm:max-w-xs sm:flex-none sm:basis-64">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" />
            <input
              id="shop-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search styles"
              aria-label="Search styles"
              className="kicks-field kicks-field-sm pl-10 pr-8"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#aaa] hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((current) => !current)}
            aria-expanded={filtersOpen}
            aria-controls="shop-advanced-filters"
            className={`kicks-btn kicks-btn-sm shrink-0 ${filtersOpen || activeFilterCount > 0 ? 'kicks-btn-primary' : 'kicks-btn-secondary'}`}
          >
            <SlidersHorizontal size={13} />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              aria-label="Clear all filters"
              title="Clear all"
              className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-[#b5b5b5] transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <RotateCcw size={13} />
            </button>
          )}

          <div className="relative w-auto lg:hidden">
            <ArrowUpDown size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
            <select
              id="shop-sort"
              value={filters.sort}
              onChange={(event) => setFilter('sort', event.target.value)}
              aria-label="Sort products"
              className="kicks-field kicks-field-sm w-[190px] max-w-full cursor-pointer appearance-none pl-10 pr-7 text-xs min-[400px]:w-[128px] sm:w-[150px]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
        </div>
      </div>

      {/* Advanced filters — collapsible, preserves all behavior */}
      {filtersOpen && (
        <div id="shop-advanced-filters" className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-[#111111] p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div>
            <label htmlFor="shop-brand" className="kicks-meta">Brand</label>
            <select id="shop-brand" value={filters.brand} onChange={(event) => setFilter('brand', event.target.value)} aria-label="Brand" className="kicks-field kicks-field-sm mt-2">
              <option value="">All brands</option>
              {brandOptions.map((option) => {
                const value = option?._id || option?.id || option?.slug || option?.name || option;
                return <option key={value} value={value}>{option?.name || option}</option>;
              })}
            </select>
          </div>

          <div>
            <p className="kicks-meta">Gender</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['', ...genderOptions].map((option) => (
                <button key={option || 'all'} type="button" onClick={() => setFilter('gender', option)} aria-pressed={filters.gender === option} className="kicks-pill min-h-[30px] px-3 text-[11px]">
                  {option || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="kicks-meta">Size</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['', ...sizeOptions].map((option) => (
                <button key={option || 'all'} type="button" onClick={() => setFilter('size', option)} aria-pressed={filters.size === option} className="kicks-pill min-h-[30px] px-3 text-[11px]">
                  {option || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="kicks-meta">Color</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['', ...colorOptions].map((option) => (
                <button key={option || 'all'} type="button" onClick={() => setFilter('color', option)} aria-pressed={filters.color === option} className="kicks-pill min-h-[30px] px-3 text-[11px]">
                  {option || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="kicks-meta">Price range</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <input type="number" min="0" value={minPriceInput} onChange={(event) => setMinPriceInput(event.target.value)} placeholder="Min" aria-label="Minimum price" className="kicks-field kicks-field-sm" />
              <input type="number" min="0" value={maxPriceInput} onChange={(event) => setMaxPriceInput(event.target.value)} placeholder="Max" aria-label="Maximum price" className="kicks-field kicks-field-sm" />
            </div>
            <button type="button" onClick={applyPrice} className="kicks-btn kicks-btn-dark kicks-btn-sm mt-2 w-full">Apply price</button>
          </div>
        </div>
      )}

      {/* Product grid */}
      <section className="mt-7" aria-live="polite" aria-label="Products">
        {query.isError ? (
          <div className="rounded-2xl border border-red-500/25 bg-[#151111] p-10 text-center">
            <h2 className="text-lg font-bold uppercase tracking-tight text-white">Unable to load products</h2>
            <p className="mt-2 text-[13px] text-red-100/80">Please try again.</p>
            <button type="button" onClick={() => query.refetch()} className="kicks-btn kicks-btn-secondary kicks-btn-sm mt-5">Retry</button>
          </div>
        ) : query.isLoading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, index) => (
              <div key={index}>
                <div className="aspect-square animate-pulse rounded-[14px] bg-[#151515]" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#1b1b1b]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#1b1b1b]" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#111111] p-12 text-center">
            <h2 className="text-lg font-bold uppercase tracking-tight text-white">No sneakers found</h2>
            <p className="kicks-body mt-2">Try changing your search or filters.</p>
            <button type="button" onClick={clearFilters} className="kicks-btn kicks-btn-primary kicks-btn-sm mt-5">
              <RotateCcw size={13} /> Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => <ProductCard key={product?._id || product?.slug} product={product} />)}
            </div>
            {totalPages > 1 && (
              <nav aria-label="Product pages" className="flex items-center justify-center gap-3 pt-10">
                <button
                  type="button"
                  onClick={() => setFilter('page', String(filters.page - 1))}
                  disabled={filters.page <= 1}
                  aria-label="Previous page"
                  className="kicks-icon-btn disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-24 text-center text-xs text-[#a8a8a8]">Page {filters.page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setFilter('page', String(filters.page + 1))}
                  disabled={filters.page >= totalPages}
                  aria-label="Next page"
                  className="kicks-icon-btn disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
    </div >
  );
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.categories)) return value.categories;
  if (Array.isArray(value?.brands)) return value.brands;
  return [];
}

function unwrapPayload(payload) {
  return payload?.data ?? payload ?? {};
}
