import { useQuery } from '@tanstack/react-query';
import { Heart, ShieldCheck, ShoppingBag, Star } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { productsApi } from '../api/products.api';
import ProductCard from '../components/ui/ProductCard';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-detail', slug],
    queryFn: () => productsApi.getBySlug(slug).then((response) => response?.data?.product || response?.product || null),
    enabled: Boolean(slug),
  });

  const product = data;
  const variant = product?.variants?.[0] || {};
  const sizes = Array.from(new Set((product?.variants || []).map((item) => item.size).filter(Boolean))).slice(0, 8);

  const price = Number(variant?.price ?? product?.price ?? 0);
  const salePrice = Number(variant?.salePrice ?? product?.salePrice ?? 0) || null;

  const recommendationQuery = useQuery({
    queryKey: ['product-recommendations', slug],
    queryFn: () => productsApi.getRecommendations(slug, { limit: 4 }).then((response) => response?.data?.items || response?.items || []),
    enabled: Boolean(slug),
  });

  const discount = salePrice ? Math.round(((price - salePrice) / price) * 100) : 0;

  if (isLoading) {
    return <div className="mx-auto max-w-[1400px] px-4 py-10 text-white lg:px-8">Loading product...</div>;
  }

  if (isError || !product) {
    return <div className="mx-auto max-w-[1400px] px-4 py-10 text-white lg:px-8">Product could not be loaded from the backend.</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-3">
            <img src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'} alt={product?.name} className="h-[560px] w-full rounded-[22px] object-cover" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(product?.images || Array.from({ length: 3 })).slice(0, 3).map((image, index) => (
              <div key={index} className="overflow-hidden rounded-[22px] border border-white/10 bg-[#111111] p-2">
                <img src={image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'} alt={`${product?.name || 'Product'} ${index + 1}`} className="h-32 w-full rounded-[16px] object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#a3a3a3]">{product?.brand?.name || 'KICKS'}</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">{product?.name}</h1>

          <div className="mt-5 flex items-center gap-3 text-sm text-[#d3d3d3]">
            <span className="flex items-center gap-2"><Star size={15} className="fill-white text-white" /> 4.8</span>
            <span>•</span>
            <span>Free delivery</span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            {salePrice ? (
              <>
                <span className="text-3xl font-black text-white">₹{salePrice.toLocaleString('en-IN')}</span>
                <span className="text-lg text-[#8d8d8d] line-through">₹{price.toLocaleString('en-IN')}</span>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-black">-{discount}%</span>
              </>
            ) : (
              <span className="text-3xl font-black text-white">₹{price.toLocaleString('en-IN')}</span>
            )}
          </div>

          <p className="mt-6 text-base leading-7 text-[#d2d2d2]">{product?.description || product?.shortDescription || 'Premium everyday performance sneaker built for the rhythm of urban movement.'}</p>

          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#9a9a9a]">Size</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((size) => (
                <button key={size} type="button" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:border-white/30">
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-medium text-black">
              <ShoppingBag size={16} /> Add to cart
            </button>
            <button type="button" className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-4 text-sm text-white">
              <Heart size={16} />
            </button>
          </div>

          <div className="mt-8 rounded-[20px] border border-white/10 bg-[#181818] p-4 text-sm text-[#d3d3d3]">
            <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-white" /> 30-day easy returns</div>
          </div>
        </div>
      </div>

      <section className="mt-16">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">More like this</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.06em] text-white">You may also like</h2>
        </div>

        {recommendationQuery.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-[330px] animate-pulse rounded-[24px] bg-[#111111]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {(recommendationQuery.data || []).map((item) => (
              <ProductCard key={item?._id || item?.slug} product={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
