import { Heart, ShoppingBag, Star } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi } from '../../api/cart.api';
import { wishlistApi } from '../../api/wishlist.api';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const availableVariant = variants.find((variant) => variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0);
  const primaryVariant = availableVariant || variants[0] || {};
  const price = Number(primaryVariant?.price ?? product?.price ?? 0);
  const salePrice = Number(primaryVariant?.salePrice ?? product?.salePrice ?? 0) || null;
  const discount = salePrice ? Math.round(((price - salePrice) / price) * 100) : 0;
  const isOutOfStock = variants.length > 0 && !availableVariant;
  const isLowStock = Boolean(availableVariant && Number(availableVariant.stock) <= 3);

  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.getWishlist(),
    enabled: isAuthenticated,
  });

  const wishlistIds = wishlistQuery.data?.data?.wishlist?.productIds || wishlistQuery.data?.wishlist?.productIds || [];
  const isWishlisted = wishlistIds.some((item) => String(item?._id || item) === String(product?._id));

  const cartMutation = useMutation({
    mutationFn: () => cartApi.addItem({ productId: product._id, variantId: availableVariant._id, quantity: 1 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      showToast('Added to cart', 'success');
    },
    onError: (error) => showToast(getActionError(error, 'cart'), 'error'),
  });

  const wishlistMutation = useMutation({
    mutationFn: () => (isWishlisted ? wishlistApi.removeFromWishlist(product._id) : wishlistApi.addToWishlist(product._id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist', 'success');
    },
    onError: (error) => showToast(getActionError(error, 'wishlist'), 'error'),
  });

  const handleQuickAdd = async () => {
    if (!isAuthenticated) {
      showToast('Please log in to continue', 'info');
      navigate('/login');
      return;
    }

    if (!product?._id || !availableVariant?._id) {
      showToast('Select a size on the product page to continue', 'info');
      navigate(`/products/${product?.slug}`);
      return;
    }

    cartMutation.mutate();
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      showToast('Please log in to continue', 'info');
      navigate('/login');
      return;
    }

    if (!product?._id) {
      return;
    }

    wishlistMutation.mutate();
  };

  return (
    <article className="group rounded-[24px] border border-white/10 bg-[#111111] p-4 transition hover:-translate-y-1 hover:border-white/20">
      <div className="relative overflow-hidden rounded-[20px] bg-[#1a1a1a]">
        <img
          src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'}
          alt={product?.name || 'Product'}
          className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80';
          }}
        />
        <button
          type="button"
          onClick={handleWishlist}
          disabled={wishlistMutation.isPending}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-sm transition hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-wait disabled:opacity-60"
          aria-label={isWishlisted ? `Remove ${product?.name || 'product'} from wishlist` : `Add ${product?.name || 'product'} to wishlist`}
          aria-pressed={isWishlisted}
        >
          <Heart size={16} className={isWishlisted ? 'fill-white' : ''} />
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

      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em]">
        <span className="text-[#8f8f8f]">{product?.category?.name || product?.category || 'Sneakers'}</span>
        {isOutOfStock ? <span className="text-red-200">Out of stock</span> : isLowStock ? <span className="text-[#f3d87d]">Low stock</span> : <span className="text-[#9feec8]">In stock</span>}
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
        {isOutOfStock ? (
          <Link to={`/products/${product?.slug}`} className="flex-1 rounded-full border border-white/15 px-4 py-3 text-center text-sm font-medium text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/70">
            View details
          </Link>
        ) : (
          <>
            <button type="button" onClick={handleQuickAdd} disabled={cartMutation.isPending} className="flex-1 rounded-full border border-white/15 px-4 py-3 text-sm font-medium text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-wait disabled:opacity-60">
              {cartMutation.isPending ? 'Adding...' : 'Quick add'}
            </button>
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={cartMutation.isPending}
              aria-label={`Add ${product?.name || 'product'} to cart`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#111111] disabled:cursor-wait disabled:opacity-60"
            >
              <ShoppingBag size={16} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function getActionError(error, action) {
  if (error?.status === 401) return 'Please log in to continue';
  if (error?.status === 429) return 'Too many attempts. Please try again shortly.';
  return action === 'wishlist' ? 'Unable to update your wishlist. Please try again.' : 'Unable to add this item to your cart. Please try again.';
}
