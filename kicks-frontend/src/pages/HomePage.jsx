import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '../components/ui/ProductCard';
import SectionHeading from '../components/ui/SectionHeading';
import ProductRail from '../components/ui/ProductRail';
import { productsApi } from '../api/products.api';
import {
  ESSENTIALS_TYPES,
  FOOTWEAR_TYPES,
  PRODUCT_TYPES,
  PRODUCT_TYPE_ORDER,
  SPORTSWEAR_TYPES,
} from '../data/productTypes';

const SPORTSWEAR_TILES = ['TSHIRT', 'LOWER', 'SHORTS'];

function unwrapPayload(payload) {
  return payload?.data ?? payload ?? {};
}

function CategoryTile({ type, large = false }) {
  const meta = PRODUCT_TYPES[type];
  if (!meta) return null;
  return (
    <Link
      to={`/shop?type=${type}`}
      aria-label={`Shop ${meta.label}`}
      className={`group relative block overflow-hidden rounded-[20px] border border-white/10 transition hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 sm:rounded-[24px] ${
        large ? 'lg:col-span-2 lg:row-span-2' : ''
      }`}
    >
      <img
        src={meta.image}
        alt={meta.label}
        className={`w-full object-cover transition duration-500 group-hover:scale-105 ${large ? 'h-64 sm:h-72 lg:h-full lg:min-h-[30rem]' : 'h-44 sm:h-56 lg:h-60'}`}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5 sm:p-5">
        <h3 className={`truncate font-black uppercase tracking-[-0.02em] text-white ${large ? 'text-2xl sm:text-4xl' : 'text-base sm:text-xl'}`}>{meta.label}</h3>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition group-hover:border-white/60 group-hover:bg-white/10" aria-hidden="true">
          <ArrowUpRight size={13} />
        </span>
      </div>
    </Link>
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
  const arrivals = items.filter((product) => product?.newArrival).slice(0, 8);
  const newFallback = arrivals.length > 0 ? arrivals : items.slice(0, 8);
  const essentials = ofTypes(ESSENTIALS_TYPES).slice(0, 6);

  const loadingGrid = (
    <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, index) => (
        <div key={index}>
          <div className="aspect-square animate-pulse rounded-[14px] bg-[#151515]" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#1c1c1c]" />
        </div>
      ))}
    </div>
  );

  const errorBlock = (
    <div className="mt-8 rounded-2xl border border-white/10 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
      <p className="kicks-body">Unable to load products right now.</p>
      <button type="button" onClick={() => refetch()} className="kicks-btn kicks-btn-secondary kicks-btn-sm mt-5">
        Retry
      </button>
    </div>
  );

  return (
    <div className="bg-[#090909]">
      {/* HERO — static, footwear-first */}
      <section className="theme-keep-dark relative overflow-hidden" aria-label="Featured collection">
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

      {/* SHOP BY CATEGORY — editorial asymmetric grid, rail on mobile */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Shop by category">
        <SectionHeading
          eyebrow="Find your fit"
          title="Shop by category"
          description="Footwear leads, sportswear follows — every lane of the AJ SPORTS catalog."
          ctaTo="/shop"
          ctaLabel="Shop all"
          ctaAria="Shop the full collection"
        />
        <div className="kicks-scroll-row -mx-4 mt-8 snap-x px-4 sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {PRODUCT_TYPE_ORDER.map((type, index) => (
            <div key={type} className="w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-auto sm:max-w-none">
              <CategoryTile type={type} large={index === 0} />
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED SHOES */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Featured footwear">
        <SectionHeading
          eyebrow="Shoe-first, always"
          title="Featured footwear"
          ctaTo="/shop?type=SHOES"
          ctaLabel="Shop shoes"
          ctaAria="Shop all shoes"
        />
        {isLoading ? loadingGrid : isError ? errorBlock : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {featuredFallback.map((product) => (
              <ProductCard key={product?._id || product?.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* SPORTSWEAR — three category blocks */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Sportswear">
        <SectionHeading
          eyebrow="Train / Play / Move"
          title="Sportswear"
          description="Tees, lowers and shorts cut for training days and rest days alike."
          ctaTo={`/shop?type=${SPORTSWEAR_TYPES.join(',')}`}
          ctaLabel="Shop sportswear"
          ctaAria="Shop all sportswear"
        />
        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-5">
          {SPORTSWEAR_TILES.map((type) => (
            <CategoryTile key={type} type={type} />
          ))}
        </div>
        {sportswear.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
            {sportswear.map((product) => (
              <ProductCard key={product?._id || product?.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* NEW ARRIVALS — rail */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="New arrivals">
        <SectionHeading
          eyebrow="Just landed"
          title="New arrivals"
          ctaTo="/shop"
          ctaLabel="Shop all"
          ctaAria="Shop the full collection"
        />
        {isLoading ? loadingGrid : isError ? errorBlock : <ProductRail items={newFallback} label="new arrivals" />}
      </section>

      {/* ESSENTIALS — rail */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:py-16 lg:px-8 lg:py-20" aria-label="Sports essentials">
        <SectionHeading
          eyebrow="Finish the kit"
          title="Sports essentials"
          ctaTo={`/shop?type=${ESSENTIALS_TYPES.join(',')}`}
          ctaLabel="Shop essentials"
          ctaAria="Shop sports essentials"
        />
        {isLoading ? loadingGrid : isError ? errorBlock : <ProductRail items={essentials} label="sports essentials" />}
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
