import { Heart, ShoppingBag } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi } from '../../api/cart.api';
import { wishlistApi } from '../../api/wishlist.api';
import { primaryProductImage, NEUTRAL_PRODUCT_IMAGE } from './productImage';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isAdmin } = useAuth();
  const { showToast } = useToast();

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const availableVariant = variants.find((variant) => variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0);
  const primaryVariant = availableVariant || variants[0] || {};
  const price = Number(primaryVariant?.price ?? product?.price ?? 0);
  const salePrice = Number(primaryVariant?.salePrice ?? product?.salePrice ?? 0) || null;
  const discount = salePrice && price > salePrice ? Math.round(((price - salePrice) / price) * 100) : 0;
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

  const brand = product?.brand?.name || product?.brand || 'AJ SPORTS';
  const category = product?.category?.name || product?.category || 'Sneakers';

  return (
    <article className="kicks-product-card group min-w-0">
      <div className="kicks-product-media">
        <Link to={`/products/${product?.slug}`} className="block h-full w-full" aria-label={`View ${product?.name || 'product'}`}>
          <img
            src={primaryProductImage(product)}
            alt={product?.name || 'Product'}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE;
            }}
          />
        </Link>
        {!isAdmin && (
          <button
            type="button"
            onClick={handleWishlist}
            disabled={wishlistMutation.isPending}
            className="kicks-wishlist-btn"
            aria-label={isWishlisted ? `Remove ${product?.name || 'product'} from wishlist` : `Add ${product?.name || 'product'} to wishlist`}
            aria-pressed={isWishlisted}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={15} className={isWishlisted ? 'fill-white' : ''} />
          </button>
        )}
        {discount > 0 && <span className="kicks-badge">-{discount}%</span>}
      </div>

      <div className="px-0.5 pt-3">
        <p className="kicks-meta truncate">{brand}</p>
        <p className="mt-1 truncate text-[11px] tracking-[0.08em] text-[#767676]">
          {category}{isOutOfStock ? ' • Out of stock' : isLowStock ? ' • Low stock' : ''}
        </p>

        <Link
          to={`/products/${product?.slug}`}
          className="mt-1.5 block break-words text-[13.5px] font-semibold leading-snug text-white line-clamp-2 hover:text-white/75"
        >
          {product?.name}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          {salePrice ? (
            <>
              <span className="kicks-price">₹{salePrice.toLocaleString('en-IN')}</span>
              <span className="truncate text-xs text-[#767676] line-through">₹{price.toLocaleString('en-IN')}</span>
            </>
          ) : (
            <span className="kicks-price">₹{price.toLocaleString('en-IN')}</span>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          {isOutOfStock || isAdmin ? (
            <Link to={`/products/${product?.slug}`} className="kicks-quickadd">
              View details
            </Link>
          ) : (
            <>
              <button type="button" onClick={handleQuickAdd} disabled={cartMutation.isPending} className="kicks-quickadd">
                {cartMutation.isPending ? 'Adding...' : 'Quick add'}
              </button>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={cartMutation.isPending}
                aria-label={`Add ${product?.name || 'product'} to cart`}
                title="Add to cart"
                className="kicks-bag-btn"
              >
                <ShoppingBag size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function getActionError(error, action) {
  if (error?.status === 401) return 'Please log in to continue';
  if (error?.status === 429) return 'Too many attempts. Please try again shortly.';
  return action === 'wishlist' ? 'Unable to update your wishlist. Please try again.' : 'Unable to add this item to your cart. Please try again.';
}
