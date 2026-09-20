import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import { productsApi } from '../api/products.api';

const colorOptions = ['Black', 'White', 'Brown', 'Blue', 'Red'];
const sizeOptions = ['6', '7', '8', '9', '10', '11'];
const genderOptions = ['MEN', 'WOMEN', 'UNISEX'];

export default function ShopPage() {
  const [params, setParams] = useSearchParams();

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

  const query = useQuery({
    queryKey: ['products-list', filters],
    queryFn: () =>
      productsApi
        .getList({
          page: filters.page,
          limit: filters.limit,
          category: filters.category,
          brand: filters.brand,
          gender: filters.gender,
          sort: filters.sort,
          search: filters.search,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          size: filters.size,
          color: filters.color,
        })
        .then((response) => response?.data || response || { items: [], total: 0, page: 1, limit: 12 }),
  });

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next);
  };

  const products = query.data?.items || [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Shop</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">All sneakers</h1>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white">
          <SlidersHorizontal size={16} /> Filters
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-6 rounded-[24px] border border-white/10 bg-[#111111] p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Search</p>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Search styles"
              className="mt-3 w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white placeholder:text-[#7e7e7e] outline-none focus:border-white/20"
            />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Sort by</p>
            <select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)} className="mt-3 w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="featured">Featured</option>
            </select>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Gender</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['', ...genderOptions].map((gender) => (
                <button
                  key={gender || 'all'}
                  type="button"
                  onClick={() => setFilter('gender', gender)}
                  className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.18em] ${filters.gender === gender ? 'bg-white text-black' : 'border border-white/10 bg-[#181818] text-white'}`}
                >
                  {gender || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Size</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['', ...sizeOptions].map((size) => (
                <button
                  key={size || 'all'}
                  type="button"
                  onClick={() => setFilter('size', size)}
                  className={`rounded-full px-3 py-2 text-xs ${filters.size === size ? 'bg-white text-black' : 'border border-white/10 bg-[#181818] text-white'}`}
                >
                  {size || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Color</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['', ...colorOptions].map((color) => (
                <button
                  key={color || 'all'}
                  type="button"
                  onClick={() => setFilter('color', color)}
                  className={`rounded-full px-3 py-2 text-xs ${filters.color === color ? 'bg-white text-black' : 'border border-white/10 bg-[#181818] text-white'}`}
                >
                  {color || 'All'}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {query.isLoading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-[360px] animate-pulse rounded-[24px] bg-[#111111]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-12 text-center text-[#d1d1d1]">
              No products matched the current filters.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product?._id || product?.slug} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
