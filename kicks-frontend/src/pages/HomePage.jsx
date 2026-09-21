import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '../components/ui/ProductCard';
import { productsApi } from '../api/products.api';

const categories = [
  { name: 'Running', image: 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80' },
  { name: 'Lifestyle', image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80' },
  { name: 'Training', image: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80' },
  { name: 'Basketball', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80' },
];

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => productsApi.getFeatured().then((response) => response?.data?.items || response?.data?.products || response?.data || []),
  });

  const heroProducts = data?.slice(0, 4) || [];

  return (
    <div className="bg-[#090909]">
      <section className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-12">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#101010] p-6 sm:p-8 md:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.10),_transparent_40%)]" />
          <div className="relative z-10">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#a8a8a8]">KICKS</p>
            <h1 className="mt-4 max-w-xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.08em] text-white sm:mt-6 sm:text-5xl md:text-7xl">
              Move <span className="text-[#dcdcdc]">different.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm text-[#c2c2c2] sm:mt-6 sm:text-base">
              Premium sneakers designed for movement, comfort, and everyday expression.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8 sm:gap-4">
              <Link
                to="/shop"
                aria-label="Shop KICKS sneakers"
                style={{ color: '#090909' }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium transition hover:bg-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#101010]"
              >
                Shop now <ArrowRight size={16} />
              </Link>
              <Link to="/about" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white">
                Learn more
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
          {heroProducts.slice(0, 4).map((product) => (
            <Link key={product?._id || product?.slug} to={`/products/${product?.slug}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101010] p-2 transition hover:border-white/20 sm:p-3">
              <img src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'} alt={product?.name} className="h-32 w-full rounded-[18px] object-cover sm:h-44" />
              <div className="mt-3 flex items-start justify-between gap-2 sm:mt-4 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#a2a2a2]">{product?.brand?.name || 'KICKS'}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-medium text-white sm:mt-2 sm:text-lg">{product?.name}</h3>
                </div>
                <span className="shrink-0 text-xs font-medium text-white sm:text-sm">₹{(product?.variants?.[0]?.price || product?.price || 0).toLocaleString('en-IN')}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Shop by category</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Featured styles</h2>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#d3d3d3] sm:text-sm">
            View all <ChevronRight size={16} />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <div key={category.name} className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111111]">
              <div className="relative h-40 overflow-hidden sm:h-64">
                <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#d5d5d5]">Collection</p>
                  <h3 className="mt-2 text-lg font-bold text-white sm:text-2xl">{category.name}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">New arrivals</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Best sellers</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-[260px] animate-pulse rounded-[24px] bg-[#151515] sm:h-[360px]" />
            ))}
          </div>
        ) : isError || !data || data.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-8 text-center text-sm text-[#d2d2d2] sm:mt-8 sm:p-10 sm:text-base">
            API unavailable. Connect the backend and reload to populate products.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
            {data.slice(0, 4).map((product) => (
              <ProductCard key={product?._id || product?.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">About us</p>
              <h2 className="mt-3 max-w-xl text-3xl font-black uppercase tracking-[-0.06em] text-white sm:text-4xl">
                More than just shoes.
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[#d6d6d6]">
              <Sparkles size={16} /> Minimal luxury for movement
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              ['10K+', 'Happy customers'],
              ['500+', 'Daily drops'],
              ['4.9/5', 'Average rating'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[20px] border border-white/10 bg-[#171717] p-5 sm:p-6">
                <p className="text-3xl font-black tracking-[-0.06em] text-white sm:text-4xl">{value}</p>
                <p className="mt-4 text-sm text-[#b8b8b8]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Journal</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Stories & style</h2>
          </div>
          <Link to="/blog" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#d3d3d3] sm:text-sm">
            Read all <ChevronRight size={16} />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <article key={item} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
              <img
                src="https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1000&q=80"
                alt="Editorial"
                className="h-44 w-full object-cover sm:h-72"
              />
              <div className="p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#a3a3a3]">Culture</p>
                <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">The future of everyday movement</h3>
                <Link to="/blog" className="mt-5 inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-white">
                  Read story <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
