import { Heart, ShoppingBag, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductCard({ product }) {
  const primaryVariant = product?.variants?.[0] || {};
  const price = Number(primaryVariant?.price ?? product?.price ?? 0);
  const salePrice = Number(primaryVariant?.salePrice ?? product?.salePrice ?? 0) || null;

  const discount = salePrice ? Math.round(((price - salePrice) / price) * 100) : 0;

  return (
    <article className="group rounded-[24px] border border-white/10 bg-[#111111] p-4 transition hover:-translate-y-1 hover:border-white/20">
      <div className="relative overflow-hidden rounded-[20px] bg-[#1a1a1a]">
        <img
          src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'}
          alt={product?.name || 'Product'}
          className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <button
          type="button"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-sm"
          aria-label="Add to wishlist"
        >
          <Heart size={16} />
        </button>
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black">
            -{discount}%
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#b7b7b7]">
        <span>{product?.brand?.name || product?.brand || 'KICKS'}</span>
        <span className="flex items-center gap-1 text-white">
          <Star size={12} className="fill-white text-white" /> {product?.rating ?? 4.8}
        </span>
      </div>

      <Link to={`/products/${product?.slug}`} className="mt-3 block text-xl font-medium text-white hover:text-white/80">
        {product?.name}
      </Link>

      <div className="mt-3 flex items-center gap-3 text-sm">
        {salePrice ? (
          <>
            <span className="text-lg font-semibold text-white">₹{salePrice.toLocaleString('en-IN')}</span>
            <span className="text-[#8e8e8e] line-through">₹{price.toLocaleString('en-IN')}</span>
          </>
        ) : (
          <span className="text-lg font-semibold text-white">₹{price.toLocaleString('en-IN')}</span>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" className="flex-1 rounded-full border border-white/15 px-4 py-3 text-sm font-medium text-white transition hover:border-white/40">
          Quick add
        </button>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:scale-105">
          <ShoppingBag size={16} />
        </button>
      </div>
    </article>
  );
}
