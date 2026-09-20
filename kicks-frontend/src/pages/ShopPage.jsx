import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ui/ProductCard';
import { apiClient } from '../api/client';
import { productsApi } from '../api/products.api';

const colorOptions = ['Black', 'White', 'Grey'];
const sizeOptions = ['UK 6', 'UK 7', 'UK 8', 'UK 9'];
const genderOptions = ['MEN', 'WOMEN', 'UNISEX'];

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
  const totalPages = Math.max(Number(query.data?.totalPages || 1), 1);
  const activeFilterCount = [filters.category, filters.brand, filters.gender, filters.search, filters.minPrice, filters.maxPrice, filters.size, filters.color].filter(Boolean).length;

  const applyPrice = () => {
    const next = new URLSearchParams(params);
    if (minPriceInput) next.set('minPrice', minPriceInput);
    else next.delete('minPrice');
    if (maxPriceInput) next.set('maxPrice', maxPriceInput);
    else next.delete('maxPrice');
    next.delete('page');
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Shop</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">All sneakers</h1>
          <p className="mt-3 text-sm text-[#a7a7a7]">{query.data?.total ?? 0} styles in the current selection</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          aria-label="Open filters"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 lg:hidden"
        >
          <SlidersHorizontal size={16} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${mobileFiltersOpen ? 'fixed inset-0 z-[80] block overflow-y-auto bg-[#090909] p-4' : 'hidden'} lg:static lg:block lg:overflow-visible lg:bg-transparent lg:p-0`}>
          <div className="space-y-6 rounded-[24px] border border-white/10 bg-[#111111] p-5">
            <div className="flex items-center justify-between lg:hidden">
              <h2 className="text-lg font-bold text-white">Filters</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white focus:outline-none focus:ring-2 focus:ring-white/60">
                <X size={18} />
              </button>
            </div>

            <div>
              <label htmlFor="shop-search" className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Search</label>
              <div className="relative mt-3">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#777]" />
                <input id="shop-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search styles" className="w-full rounded-full border border-white/10 bg-[#181818] py-3 pl-11 pr-10 text-sm text-white placeholder:text-[#7e7e7e] outline-none transition focus:border-white/30" />
                {searchInput && <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search" className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#aaa] hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"><X size={14} /></button>}
              </div>
            </div>

            <FilterSelect label="Category" value={filters.category} onChange={(value) => setFilter('category', value)} options={categoryOptions} placeholder="All categories" />
            <FilterSelect label="Brand" value={filters.brand} onChange={(value) => setFilter('brand', value)} options={brandOptions} placeholder="All brands" />

            <div>
              <label htmlFor="shop-sort" className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Sort by</label>
              <select id="shop-sort" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)} className="mt-3 w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none focus:border-white/30">
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="featured">Featured</option>
              </select>
            </div>

            <FilterChoices label="Gender" value={filters.gender} options={genderOptions} onChange={(value) => setFilter('gender', value)} />
            <FilterChoices label="Size" value={filters.size} options={sizeOptions} onChange={(value) => setFilter('size', value)} />
            <FilterChoices label="Color" value={filters.color} options={colorOptions} onChange={(value) => setFilter('color', value)} />

            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Price range</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input type="number" min="0" value={minPriceInput} onChange={(event) => setMinPriceInput(event.target.value)} placeholder="Min" aria-label="Minimum price" className="w-full rounded-full border border-white/10 bg-[#181818] px-3 py-3 text-sm text-white placeholder:text-[#7e7e7e] outline-none focus:border-white/30" />
                <input type="number" min="0" value={maxPriceInput} onChange={(event) => setMaxPriceInput(event.target.value)} placeholder="Max" aria-label="Maximum price" className="w-full rounded-full border border-white/10 bg-[#181818] px-3 py-3 text-sm text-white placeholder:text-[#7e7e7e] outline-none focus:border-white/30" />
              </div>
              <button type="button" onClick={applyPrice} className="mt-3 w-full rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60">Apply price</button>
            </div>

            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 text-sm text-[#d5d5d5] underline decoration-white/30 underline-offset-4 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"><RotateCcw size={14} /> Clear all filters</button>}
          </div>
        </aside>

        <section className="space-y-6" aria-live="polite">
          {query.isError ? (
            <div className="rounded-[24px] border border-red-500/30 bg-[#1b1515] p-10 text-center">
              <h2 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">Unable to load products</h2>
              <p className="mt-3 text-sm text-red-100">Please try again.</p>
              <button type="button" onClick={() => query.refetch()} className="mt-6 rounded-full border border-white/15 px-5 py-3 text-sm text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60">Retry</button>
            </div>
          ) : query.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, index) => <div key={index} className="h-[430px] animate-pulse rounded-[24px] bg-[#111111]" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-12 text-center">
              <h2 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">No sneakers found</h2>
              <p className="mt-3 text-[#d1d1d1]">Try changing your search or filters.</p>
              <button type="button" onClick={clearFilters} className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-white/70"><RotateCcw size={15} /> Clear filters</button>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => <ProductCard key={product?._id || product?.slug} product={product} />)}
              </div>
              {totalPages > 1 && (
                <nav aria-label="Product pages" className="flex items-center justify-center gap-4 pt-4">
                  <button type="button" onClick={() => setFilter('page', String(filters.page - 1))} disabled={filters.page <= 1} aria-label="Previous page" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={17} /></button>
                  <span className="text-sm text-[#d0d0d0]">Page {filters.page} of {totalPages}</span>
                  <button type="button" onClick={() => setFilter('page', String(filters.page + 1))} disabled={filters.page >= totalPages} aria-label="Next page" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={17} /></button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="mt-3 w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none focus:border-white/30">
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option._id || option.slug || option} value={option._id || option.slug || option}>{option.name || option}</option>)}
      </select>
    </div>
  );
}

function FilterChoices({ label, value, options, onChange }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {['', ...options].map((option) => (
          <button key={option || 'all'} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={`rounded-full px-3 py-2 text-xs transition focus:outline-none focus:ring-2 focus:ring-white/60 ${value === option ? 'bg-white text-black' : 'border border-white/10 bg-[#181818] text-white hover:border-white/30'}`}>
            {option || 'All'}
          </button>
        ))}
      </div>
    </div>
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
