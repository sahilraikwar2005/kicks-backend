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
      <section className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-12">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#101010] p-8 md:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.10),_transparent_40%)]" />
          <div className="relative z-10">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#a8a8a8]">KICKS</p>
            <h1 className="mt-6 max-w-xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.08em] text-white md:text-7xl">
              Move <span className="text-[#dcdcdc]">different.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-[#c2c2c2]">
              Premium sneakers designed for movement, comfort, and everyday expression.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {heroProducts.slice(0, 4).map((product) => (
            <Link key={product?._id || product?.slug} to={`/products/${product?.slug}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101010] p-3 transition hover:border-white/20">
              <img src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'} alt={product?.name} className="h-44 w-full rounded-[18px] object-cover" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#a2a2a2]">{product?.brand?.name || 'KICKS'}</p>
                  <h3 className="mt-2 text-lg font-medium text-white">{product?.name}</h3>
                </div>
                <span className="text-sm font-medium text-white">₹{(product?.variants?.[0]?.price || product?.price || 0).toLocaleString('en-IN')}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Shop by category</p>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.06em] text-white">Featured styles</h2>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-[#d3d3d3]">
            View all <ChevronRight size={16} />
          </Link>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <div key={category.name} className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111111]">
              <div className="relative h-64 overflow-hidden">
                <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#d5d5d5]">Collection</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">{category.name}</h3>
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
            <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.06em] text-white">Best sellers</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-[360px] animate-pulse rounded-[24px] bg-[#151515]" />
            ))}
          </div>
        ) : isError || !data || data.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-10 text-center text-[#d2d2d2]">
            API unavailable. Connect the backend and reload to populate products.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {data.slice(0, 4).map((product) => (
              <ProductCard key={product?._id || product?.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-[#111111] p-8 md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">About us</p>
              <h2 className="mt-3 max-w-xl text-4xl font-black uppercase tracking-[-0.06em] text-white">
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
              <div key={label} className="rounded-[20px] border border-white/10 bg-[#171717] p-6">
                <p className="text-4xl font-black tracking-[-0.06em] text-white">{value}</p>
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
            <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.06em] text-white">Stories & style</h2>
          </div>
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-[#d3d3d3]">
            Read all <ChevronRight size={16} />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <article key={item} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
              <img
                src="https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1000&q=80"
                alt="Editorial"
                className="h-72 w-full object-cover"
              />
              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#a3a3a3]">Culture</p>
                <h3 className="mt-3 text-2xl font-bold text-white">The future of everyday movement</h3>
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
