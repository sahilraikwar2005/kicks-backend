import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '../components/ui/ProductCard';
import { apiClient } from '../api/client';
import { productsApi } from '../api/products.api';

const categoryTiles = [
  { slug: 'running', title: 'RUNNING', subtitle: 'Speed Redefined' },
  { slug: 'lifestyle', title: 'LIFESTYLE', subtitle: 'Everyday Style' },
  { slug: 'basketball', title: 'BASKETBALL', subtitle: 'Play Harder' },
  { slug: 'training', title: 'TRAINING', subtitle: 'Built Stronger' },
];

const featurePillars = ['Performance', 'Style', 'Community', 'Purpose'];

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.categories)) return value.categories;
  return [];
}

function unwrapPayload(payload) {
  return payload?.data ?? payload ?? {};
}

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => productsApi.getFeatured().then((response) => response?.data?.items || response?.data?.products || response?.data || []),
  });

  const newArrivals = Array.isArray(data) ? data.filter((product) => product?.newArrival).slice(0, 4) : [];
  const bestSellers = Array.isArray(data) ? data.filter((product) => product?.bestSeller).slice(0, 4) : [];

  const categoriesQuery = useQuery({
    queryKey: ['home-categories'],
    queryFn: () => apiClient.get('/categories').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });
  const apiCategories = toArray(unwrapPayload(categoriesQuery.data));
  const tiles = categoryTiles
    .map((tile) => ({ ...tile, category: apiCategories.find((item) => item.slug === tile.slug) }))
    .filter((tile) => tile.category);

  return (
    <div className="bg-[#090909]">
      <section className="relative overflow-hidden" aria-label="Featured collection">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="hero-zoom h-full w-full object-cover"
            loading="eager"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=2000&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-transparent to-black/30" />
        </div>

        <div className="relative mx-auto flex min-h-[82vh] w-full max-w-[1400px] flex-col justify-center px-4 py-16 sm:py-20 lg:min-h-[90vh] lg:px-8">
          <p className="hero-rise text-[11px] font-medium uppercase tracking-[0.4em] text-[#cfcfcf]">
            Premium sneakers · Engineered for motion
          </p>
          <h1 className="mt-4 font-black uppercase leading-[0.88] tracking-[-0.05em] text-white text-[19vw] sm:mt-5 sm:text-8xl lg:text-[8.5rem] xl:text-[10rem]">
            <span className="hero-rise block" style={{ animationDelay: '90ms' }}>Move</span>
            <span className="hero-rise block text-[#e2e2e2]" style={{ animationDelay: '200ms' }}>Different</span>
          </h1>
          <p className="hero-rise mt-5 max-w-md text-sm leading-relaxed text-[#c9c9c9] sm:mt-6 sm:text-base" style={{ animationDelay: '300ms' }}>
            Premium sneakers designed for movement, comfort, and everyday expression.
          </p>
          <div className="hero-rise mt-7 flex flex-wrap items-center gap-4 sm:mt-9" style={{ animationDelay: '400ms' }}>
            <Link
              to="/shop"
              aria-label="Shop KICKS sneakers"
              className="group/btn inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:border-white hover:bg-white/20 hover:text-white focus:outline-none focus:ring-3 focus:ring-white/60 focus:ring-offset-0"
            >
              Shop KICKS
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent text-white transition-all duration-200 group-hover/btn:bg-black/90">
                <ArrowRight size={16} strokeWidth={2.6} className="translate-x-0 transition-transform duration-200 group-hover/btn:translate-x-1" />
              </span>
            </Link>
            <a
              href="#best-sellers"
              aria-label="Scroll to best sellers"
              title="Scroll to best sellers"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <ArrowDown size={18} />
            </a>
          </div>
        </div>
      </section>

      <section aria-label="Why KICKS" className="border-y border-white/10 bg-[#090909]">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
          {featurePillars.map((pillar) => (
            <div key={pillar} className="bg-[#090909] px-4 py-6 text-center sm:py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white sm:text-sm">{pillar}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#b5b5b5]">Choose your pace</p>
            <h2 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Shop by category</h2>
          </div>
          <Link
            to="/shop"
            aria-label="Explore all categories"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/60 sm:px-5"
          >
            Explore all <ArrowRight size={14} />
          </Link>
        </div>

        {categoriesQuery.isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-[24px] bg-[#151515] sm:h-72 lg:h-[26rem]" />
            ))}
          </div>
        ) : categoriesQuery.isError || tiles.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-white/10 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
            <p className="text-sm text-[#d2d2d2] sm:text-base">Categories are unavailable right now. Browse the full collection instead.</p>
            <Link
              to="/shop"
              className="mt-5 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40"
            >
              Shop all
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Link
                key={tile.slug}
                to={`/shop?category=${tile.category._id || tile.category.id}`}
                aria-label={`Shop ${tile.title} sneakers`}
                className="group relative block overflow-hidden rounded-[24px] border border-white/10 transition hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <img
                  src={tile.category.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'}
                  alt={tile.category.name || tile.title}
                  className="h-56 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-72 lg:h-[26rem]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-black uppercase tracking-[-0.02em] text-white sm:text-2xl lg:text-3xl">{tile.title}</h3>
                    <p className="mt-1 truncate text-xs text-[#d5d5d5] sm:text-sm">{tile.subtitle}</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition group-hover:border-white/60 group-hover:bg-white/10" aria-hidden="true">
                    <ArrowUpRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="best-sellers" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-12 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#b5b5b5]">Curated for movement</p>
            <h2 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">New arrivals</h2>
          </div>
          <Link
            to="/shop"
            aria-label="View all new arrivals"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/60 sm:px-5"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-[300px] animate-pulse rounded-[24px] bg-[#151515] sm:h-[380px]" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-8 rounded-[24px] border border-white/10 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
            <p className="text-sm text-[#d2d2d2] sm:text-base">Unable to load new arrivals right now.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-5 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40"
            >
              Retry
            </button>
          </div>
        ) : newArrivals.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-8 text-center text-sm text-[#d2d2d2] sm:mt-10 sm:p-10 sm:text-base">
            Fresh drops landing soon. Browse the full collection meanwhile.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product?._id || product?.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#b5b5b5]">Most wanted</p>
            <h2 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Best sellers</h2>
          </div>
          <Link
            to="/shop"
            aria-label="Shop all best sellers"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/60 sm:px-5"
          >
            Shop all <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-[300px] animate-pulse rounded-[24px] bg-[#151515] sm:h-[380px]" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-8 rounded-[24px] border border-white/10 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
            <p className="text-sm text-[#d2d2d2] sm:text-base">Unable to load best sellers right now.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-5 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40"
            >
              Retry
            </button>
          </div>
        ) : bestSellers.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-8 text-center text-sm text-[#d2d2d2] sm:mt-10 sm:p-10 sm:text-base">
            No best sellers flagged right now. Explore the full collection.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product?._id || product?.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#FFC800]">
        <div className="mx-auto max-w-[1400px] px-4 py-16 text-center sm:py-24 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-black/70">Our philosophy</p>
          <h2 className="mx-auto mt-5 max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] text-black sm:text-6xl lg:text-7xl">
            Movement changes everything.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-black/75 sm:text-base">
            We make space for people who move with purpose, express themselves freely, and never settle for standing still.
          </p>
          <Link
            to="/about"
            aria-label="Meet KICKS"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-black/50 focus:ring-offset-2 focus:ring-offset-[#FFC800]"
          >
            Meet Kicks <ArrowRight size={16} />
          </Link>
        </div>
      </section>

    </div>
  );
}
