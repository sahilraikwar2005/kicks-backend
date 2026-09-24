import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '../components/ui/ProductCard';
import { productsApi } from '../api/products.api';
import {
  ESSENTIALS_TYPES,
  FOOTWEAR_TYPES,
  PRODUCT_TYPES,
  PRODUCT_TYPE_ORDER,
  SPORTSWEAR_TYPES,
} from '../data/productTypes';

function unwrapPayload(payload) {
  return payload?.data ?? payload ?? {};
}

function SectionHeader({ eyebrow, title, ctaTo, ctaLabel, ctaAria }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="kicks-eyebrow">{eyebrow}</p>
        <h2 className="kicks-section-title mt-3">{title}</h2>
      </div>
      {ctaTo && (
        <Link
          to={ctaTo}
          aria-label={ctaAria || ctaLabel}
          className="kicks-btn kicks-btn-secondary kicks-btn-sm shrink-0"
        >
          {ctaLabel} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

function ProductGrid({ products }) {
  if (products.length === 0) {
    return (
      <div className="kicks-body mt-8 rounded-2xl border border-dashed border-white/15 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
        Fresh drops landing soon. Browse the full collection meanwhile.
      </div>
    );
  }
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product?._id || product?.slug} product={product} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['home-catalog'],
    queryFn: () => productsApi.getList({ limit: 60, sort: 'newest' }).then((response) => unwrapPayload(response)),
    staleTime: 5 * 60 * 1000,
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  const ofTypes = (types) => items.filter((product) => types.includes(product?.type));
  const featuredShoes = items.filter((product) => product?.featured && product?.type === 'SHOES').slice(0, 4);
  const featuredFallback = featuredShoes.length > 0 ? featuredShoes : ofTypes(['SHOES']).slice(0, 4);
  const sportswear = ofTypes(SPORTSWEAR_TYPES).slice(0, 4);
  const newArrivals = items.filter((product) => product?.newArrival).slice(0, 8);
  const newFallback = newArrivals.length > 0 ? newArrivals : items.slice(0, 8);
  const essentials = ofTypes(ESSENTIALS_TYPES).slice(0, 4);

  return (
    <div className="bg-[#090909]">
      {/* HERO — static, footwear-first, no slider */}
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
          <p className="hero-rise kicks-eyebrow">
            Footwear-first sports store
          </p>
          <h1 className="mt-4 font-black uppercase leading-[0.88] tracking-[-0.05em] text-white text-[16vw] sm:mt-5 sm:text-7xl lg:text-8xl xl:text-[8.5rem]">
            <span className="hero-rise block" style={{ animationDelay: '90ms' }}>Move</span>
            <span className="hero-rise block text-[#e2e2e2]" style={{ animationDelay: '200ms' }}>Different</span>
          </h1>
          <p className="hero-rise kicks-body mt-5 max-w-md sm:mt-6" style={{ animationDelay: '300ms' }}>
            Footwear, sportswear and essentials built for every move.
          </p>
          <div className="hero-rise mt-7 flex flex-wrap items-center gap-3 sm:mt-9" style={{ animationDelay: '400ms' }}>
            <Link
              to="/shop?type=SHOES"
              aria-label="Shop AJ SPORTS shoes"
              className="kicks-btn kicks-btn-primary"
            >
              Shop shoes
            </Link>
            <Link
              to="/shop"
              aria-label="Shop the full AJ SPORTS collection"
              className="kicks-btn kicks-btn-secondary"
            >
              Shop all
            </Link>
          </div>
        </div>
      </section>

      {/* SHOP BY CATEGORY — grid on desktop, rail on mobile */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Shop by category">
        <SectionHeader eyebrow="Find your fit" title="Shop by category" ctaTo="/shop" ctaLabel="Shop all" ctaAria="Shop the full collection" />
        <div className="kicks-scroll-row -mx-4 mt-8 snap-x px-4 sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-7 xl:gap-4">
          {PRODUCT_TYPE_ORDER.map((type) => (
            <Link
              key={type}
              to={`/shop?type=${type}`}
              aria-label={`Shop ${PRODUCT_TYPES[type].label}`}
              className="group relative block w-[62vw] max-w-[260px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-white/10 transition hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 sm:w-auto sm:max-w-none"
            >
              <img
                src={PRODUCT_TYPES[type].image}
                alt={PRODUCT_TYPES[type].label}
                className="h-44 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-56 lg:h-48 xl:h-44"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5 sm:p-4">
                <h3 className="truncate text-base font-black uppercase tracking-[-0.02em] text-white sm:text-lg">{PRODUCT_TYPES[type].label}</h3>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition group-hover:border-white/60 group-hover:bg-white/10" aria-hidden="true">
                  <ArrowUpRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED SHOES */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Featured footwear">
        <SectionHeader eyebrow="Shoe-first, always" title="Featured footwear" ctaTo="/shop?type=SHOES" ctaLabel="Shop shoes" ctaAria="Shop all shoes" />
        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index}>
                <div className="aspect-square animate-pulse rounded-[14px] bg-[#151515]" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#1c1c1c]" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
            <p className="kicks-body">Unable to load featured footwear right now.</p>
            <button type="button" onClick={() => refetch()} className="kicks-btn kicks-btn-secondary kicks-btn-sm mt-5">
              Retry
            </button>
          </div>
        ) : (
          <ProductGrid products={featuredFallback} />
        )}
      </section>

      {/* SPORTSWEAR */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Sportswear">
        <SectionHeader eyebrow="Train / Play / Move" title="Sportswear" ctaTo={`/shop?type=${SPORTSWEAR_TYPES.join(',')}`} ctaLabel="Shop sportswear" ctaAria="Shop all sportswear" />
        {!isLoading && !isError && <ProductGrid products={sportswear} />}
        {(isLoading || isError) && (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index}>
                <div className="aspect-square animate-pulse rounded-[14px] bg-[#151515]" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#1c1c1c]" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* NEW ARRIVALS — mixed types */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="New arrivals">
        <SectionHeader eyebrow="Just landed" title="New arrivals" ctaTo="/shop" ctaLabel="Shop all" ctaAria="Shop the full collection" />
        {!isLoading && !isError && <ProductGrid products={newFallback} />}
        {(isLoading || isError) && (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index}>
                <div className="aspect-square animate-pulse rounded-[14px] bg-[#151515]" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#1c1c1c]" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ESSENTIALS */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Sports essentials">
        <SectionHeader eyebrow="Finish the kit" title="Sports essentials" ctaTo={`/shop?type=${ESSENTIALS_TYPES.join(',')}`} ctaLabel="Shop essentials" ctaAria="Shop sports essentials" />
        {!isLoading && !isError && <ProductGrid products={essentials} />}
        {(isLoading || isError) && (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index}>
                <div className="aspect-square animate-pulse rounded-[14px] bg-[#151515]" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#1c1c1c]" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EVERYDAY FOOTWEAR — editorial banner */}
      <section className="mx-auto max-w-[1400px] px-4 pb-12 sm:pb-16 lg:px-8 lg:pb-20" aria-label="Everyday footwear collection">
        <Link
          to={`/shop?type=${FOOTWEAR_TYPES.join(',')}`}
          aria-label="Explore the everyday footwear collection"
          className="group relative block overflow-hidden rounded-[24px] border border-white/10 transition hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          <img
            src="https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1600&q=75"
            alt="Everyday footwear collection"
            className="h-64 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-80"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" aria-hidden="true" />
          <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-10">
            <p className="kicks-eyebrow">Collection</p>
            <h2 className="mt-3 max-w-md text-3xl font-black uppercase leading-[0.95] tracking-[-0.03em] text-white sm:text-5xl">
              Everyday footwear
            </h2>
            <p className="mt-3 max-w-sm text-sm text-[#d5d5d5]">Shoes, slides and clogs for every part of your day.</p>
            <span className="kicks-btn kicks-btn-primary mt-6 w-fit">
              Explore collection <ArrowRight size={14} />
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
