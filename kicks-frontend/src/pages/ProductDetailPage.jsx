import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Info, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cartApi } from '../api/cart.api';
import { productsApi } from '../api/products.api';
import { recentlyViewedApi } from '../api/recentlyViewed.api';
import { reviewsApi } from '../api/reviews.api';
import { wishlistApi } from '../api/wishlist.api';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import ProductCard from '../components/ui/ProductCard';

const reviewSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  title: z.string().trim().min(2, 'Title required').max(80),
  comment: z.string().trim().min(10, 'Review must be at least 10 characters').max(500),
});

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const normalizeImageList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
};

const getImageFallback = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['product-detail', slug],
    queryFn: () => productsApi.getBySlug(slug).then((response) => response?.data?.product || response?.product || null),
    enabled: Boolean(slug),
    retry: false,
  });

  const product = data;
  const variantOptions = product?.variants || [];

  const sizeOptions = useMemo(() => Array.from(new Set(variantOptions.map((variant) => variant?.size).filter(Boolean))), [variantOptions]);
  const sizeAvailability = useMemo(
    () =>
      sizeOptions.reduce((acc, size) => {
        acc[size] = variantOptions.some(
          (variant) => String(variant?.size) === String(size) && variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0,
        );
        return acc;
      }, {}),
    [sizeOptions, variantOptions],
  );

  // Derive default selected size without useEffect
  const firstAvailable = variantOptions.find((variant) => variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0);
  const defaultSizeValue = firstAvailable?.size || variantOptions[0]?.size || '';
  const resolvedSize = sizeOptions.includes(selectedSize) ? selectedSize : defaultSizeValue;

  const sizeVariants = useMemo(
    () => (resolvedSize ? variantOptions.filter((variant) => variant?.size === resolvedSize) : []),
    [resolvedSize, variantOptions],
  );
  const colorOptions = useMemo(() => Array.from(new Set(sizeVariants.map((variant) => variant?.color).filter(Boolean))), [sizeVariants]);
  const colorAvailability = useMemo(
    () =>
      colorOptions.reduce((acc, color) => {
        acc[color] = sizeVariants.some(
          (variant) => String(variant?.color) === String(color) && variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0,
        );
        return acc;
      }, {}),
    [colorOptions, sizeVariants],
  );

  // Derive default selected color without useEffect
  const preferredColor =
    sizeVariants.find((variant) => variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0)?.color ||
    sizeVariants[0]?.color ||
    '';
  const resolvedColor =
    resolvedSize && sizeVariants.length > 0 && sizeVariants.some((variant) => variant?.color === selectedColor)
      ? selectedColor
      : preferredColor;

  const selectedVariant = useMemo(
    () =>
      variantOptions.find(
        (variant) => String(variant?.size) === String(resolvedSize) && String(variant?.color) === String(resolvedColor),
      ) ||
      sizeVariants.find((variant) => variant?.status !== 'INACTIVE' && Number(variant?.stock || 0) > 0) ||
      sizeVariants[0] ||
      variantOptions[0] ||
      null,
    [resolvedColor, resolvedSize, sizeVariants, variantOptions],
  );

  const currentPrice = Number(selectedVariant?.price ?? product?.price ?? 0);
  const currentSalePrice = Number(selectedVariant?.salePrice ?? product?.salePrice ?? 0) || null;
  const currentStock = Number(selectedVariant?.stock ?? 0);
  const isOutOfStock = Boolean(selectedVariant) && (selectedVariant?.status === 'INACTIVE' || Number(selectedVariant?.stock || 0) <= 0);
  const isLowStock = currentStock > 0 && currentStock <= 3;

  // Derive active image index: reset to 0 when selection changes via key tracking
  const galleryImages = useMemo(() => {
    const variantImages = normalizeImageList(selectedVariant?.images);
    const productImages = normalizeImageList(product?.images);
    return variantImages.length ? variantImages : productImages.length ? productImages : [getImageFallback];
  }, [product?.images, selectedVariant]);

  const reviewsQuery = useQuery({
    queryKey: ['product-reviews', product?._id],
    queryFn: () => reviewsApi.list(product._id).then((response) => response?.data?.reviews || response?.reviews || []),
    enabled: Boolean(product?._id),
    retry: false,
  });

  const recommendationQuery = useQuery({
    queryKey: ['product-recommendations', slug],
    queryFn: () => productsApi.getRecommendations(slug, { limit: 4 }).then((response) => response?.data?.items || response?.items || []),
    enabled: Boolean(slug),
    retry: false,
  });

  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.getWishlist(),
    enabled: isAuthenticated,
    retry: false,
  });

  const wishlistIds = wishlistQuery.data?.data?.wishlist?.productIds || wishlistQuery.data?.wishlist?.productIds || [];
  const isWishlisted = Boolean(product?._id && wishlistIds.some((item) => String(item?._id || item) === String(product._id)));

  useEffect(() => {
    if (!product?._id || !isAuthenticated) return;
    recentlyViewedApi.add(product._id).catch(() => undefined);
  }, [isAuthenticated, product?._id]);

  const wishlistMutation = useMutation({
    mutationFn: () =>
      isWishlisted ? wishlistApi.removeFromWishlist(product._id) : wishlistApi.addToWishlist(product._id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist', 'success');
    },
    onError: (requestError) => showToast(requestError?.message || 'Unable to update wishlist.', 'error'),
  });

  const cartMutation = useMutation({
    mutationFn: () =>
      cartApi.addItem({
        productId: product._id,
        variantId: selectedVariant?._id,
        quantity,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      showToast('Added to cart', 'success');
    },
    onError: (requestError) => showToast(requestError?.message || 'Unable to add this item to your cart.', 'error'),
  });

  const reviewForm = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5, title: '', comment: '' },
  });

  const reviewMutation = useMutation({
    mutationFn: (values) => reviewsApi.create(product._id, { ...values, rating: Number(values.rating) }),
    onSuccess: async () => {
      reviewForm.reset({ rating: 5, title: '', comment: '' });
      await queryClient.invalidateQueries({ queryKey: ['product-reviews', product?._id] });
      showToast('Review submitted for moderation', 'success');
    },
    onError: (requestError) => showToast(requestError?.message || 'Unable to submit review.', 'error'),
  });

  const handleQuantityChange = (delta) => {
    if (isOutOfStock) return;
    setQuantity((current) => Math.min(Math.max(1, current + delta), currentStock > 0 ? currentStock : 1));
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    if (!product?._id || !selectedVariant?._id) {
      showToast('Please select a size and color to continue.', 'info');
      return;
    }

    if (isOutOfStock) {
      showToast('This variant is currently unavailable.', 'error');
      return;
    }

    if (quantity < 1 || quantity > (currentStock || 1)) {
      showToast('Please choose a valid quantity.', 'error');
      return;
    }

    cartMutation.mutate();
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    if (!product?._id || !selectedVariant?._id) {
      showToast('Select a product variant to continue.', 'info');
      return;
    }

    if (isOutOfStock) {
      showToast('This variant is out of stock.', 'error');
      return;
    }

    try {
      await cartApi.addItem({ productId: product._id, variantId: selectedVariant._id, quantity });
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate('/checkout');
    } catch (requestError) {
      showToast(requestError?.message || 'Unable to begin checkout.', 'error');
    }
  };

  const handleWishlistToggle = () => {
    if (!isAuthenticated) {
      showToast('Please log in to continue', 'info');
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    if (!product?._id) return;
    wishlistMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <div className="h-[300px] animate-pulse rounded-[28px] bg-[#111111] sm:h-[420px] md:h-[560px]" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[22px] bg-[#111111]" />)}
            </div>
          </div>
          <div className="space-y-5 rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-8">
            <div className="h-4 w-28 animate-pulse rounded-full bg-[#1c1c1c]" />
            <div className="h-12 w-4/5 animate-pulse rounded-full bg-[#1c1c1c]" />
            <div className="h-6 w-40 animate-pulse rounded-full bg-[#1c1c1c]" />
            <div className="h-10 w-40 animate-pulse rounded-full bg-[#1c1c1c]" />
            <div className="h-20 w-full animate-pulse rounded-[18px] bg-[#1c1c1c]" />
            <div className="h-10 w-full animate-pulse rounded-full bg-[#1c1c1c]" />
            <div className="h-12 w-full animate-pulse rounded-full bg-[#1c1c1c]" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    const isNotFound = error?.status === 404;
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 text-center md:p-12">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Product unavailable</p>
          <h1 className="mt-4 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl md:text-5xl">
            {isNotFound ? 'Product not found' : 'Unable to load product'}
          </h1>
          <p className="mt-4 text-[#d2d2d2]">
            {isNotFound ? 'This sneaker isn’t available in the catalog right now.' : 'Please check your connection and try again.'}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/shop" className="kicks-btn kicks-btn-primary">
              Back to Shop
            </Link>
            {!isNotFound && (
              <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['product-detail', slug] })} className="kicks-btn kicks-btn-secondary">
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{product?.seo?.title || `${product?.name} | KICKS`}</title>
        <meta name="description" content={product?.seo?.description || product?.shortDescription || product?.description || 'Premium KICKS sneaker product.'} />
      </Helmet>

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:py-10 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate(-1)} className="kicks-btn kicks-btn-dark kicks-btn-sm">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="kicks-meta text-right">{product?.brand?.name || 'KICKS'} / {product?.category?.name || 'Sneaker'}</div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-3">
              <div className="pointer-events-none absolute inset-x-3 inset-y-0 z-10 flex items-center justify-between">
                <button type="button" aria-label="Previous image" onClick={() => setActiveImageIndex((index) => (index === 0 ? galleryImages.length - 1 : index - 1))} className="pointer-events-auto kicks-icon-btn h-9 w-9">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Next image" onClick={() => setActiveImageIndex((index) => (index === galleryImages.length - 1 ? 0 : index + 1))} className="pointer-events-auto kicks-icon-btn h-9 w-9">
                  <ChevronRight size={16} />
                </button>
              </div>
              <img
                src={galleryImages[activeImageIndex] || getImageFallback}
                alt={product?.name || 'Product'}
                className="h-[300px] w-full rounded-[22px] object-cover sm:h-[420px] md:h-[560px]"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = getImageFallback;
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`View product image ${index + 1}`}
                  onClick={() => setActiveImageIndex(index)}
                  className={`overflow-hidden rounded-[22px] border p-2 transition ${activeImageIndex === index ? 'border-white/60 bg-[#161616]' : 'border-white/10 bg-[#111111]'}`}
                >
                  <img
                    src={image || getImageFallback}
                    alt={`${product?.name || 'Product'} ${index + 1}`}
                    className="h-20 w-full rounded-[16px] object-cover sm:h-28 md:h-32"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = getImageFallback;
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-5 md:p-8">
            <p className="kicks-meta">{product?.brand?.name || 'KICKS'}</p>
            <h1 className="mt-3 break-words text-2xl font-black uppercase tracking-[-0.04em] text-white sm:text-3xl">{product?.name}</h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#d3d3d3]">
              {product?.rating != null && (
                <>
                  <span className="flex items-center gap-2"><Star size={15} className="fill-white text-white" /> {product.rating}</span>
                  <span>•</span>
                </>
              )}
              <span>{product?.gender || 'UNISEX'}</span>
              <span>•</span>
              <span>Free delivery</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {currentSalePrice ? (
                <>
                  <span className="text-2xl font-black text-white sm:text-3xl">{formatMoney(currentSalePrice)}</span>
                  <span className="text-lg text-[#8d8d8d] line-through">{formatMoney(currentPrice)}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                    -{Math.round(((currentPrice - currentSalePrice) / currentPrice) * 100)}%
                  </span>
                </>
              ) : (
                <span className="text-2xl font-black text-white sm:text-3xl">{formatMoney(currentPrice)}</span>
              )}
            </div>

            {(product?.shortDescription || product?.description) && (
              <p className="mt-6 text-base leading-7 text-[#d2d2d2]">{product?.description || product?.shortDescription}</p>
            )}

            {product?.tags?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {product.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-[#181818] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#d3d3d3]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-8 space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#9a9a9a]">Size</p>
                  {selectedSize && <span className="text-xs text-[#d3d3d3]">{selectedSize}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sizeOptions.map((size) => {
                    const isAvailable = Boolean(sizeAvailability[size]);
                    const isSelected = size === selectedSize;
                    return (
                      <button
                        key={size}
                        type="button"
                        aria-label={`Select size ${size}`}
                        disabled={!isAvailable}
                        onClick={() => setSelectedSize(size)}
                        aria-pressed={isSelected}
                        className="kicks-pill"
                        style={isAvailable ? undefined : { opacity: 0.35, cursor: 'not-allowed' }}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {sizeOptions.length > 0 && colorOptions.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#9a9a9a]">Color</p>
                    {selectedColor && <span className="text-xs text-[#d3d3d3]">{selectedColor}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {colorOptions.map((color) => {
                      const hasStock = Boolean(colorAvailability[color]);
                      const isSelected = color === selectedColor;
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Select color ${color}`}
                          disabled={!hasStock}
                          onClick={() => setSelectedColor(color)}
                          aria-pressed={isSelected}
                          className="kicks-pill"
                          style={hasStock ? undefined : { opacity: 0.35, cursor: 'not-allowed' }}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between rounded-[20px] border border-white/10 bg-[#181818] p-4 text-sm text-[#d3d3d3]">
              <div className="flex items-center gap-3">
                <Truck size={16} className="text-white" />
                <span>Free delivery</span>
              </div>
              <span className={isOutOfStock ? 'text-red-300' : isLowStock ? 'text-[#f6d98c]' : 'text-[#9feec8]'}>
                {isOutOfStock ? 'Out of stock' : isLowStock ? `Low stock: ${currentStock} left` : 'In stock'}
              </span>
            </div>

            {isAdmin ? (
              <div className="mt-6 flex flex-col gap-3 rounded-[20px] border border-white/10 bg-[#141414] p-4 text-sm text-[#c4c4c4] sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
                <span>You are signed in with an admin account. Shopping actions are disabled.</span>
                <Link to="/admin" className="kicks-btn kicks-btn-dark kicks-btn-sm w-fit shrink-0">
                  Admin Panel
                </Link>
              </div>
            ) : (
            <>
            <div className="mt-6 flex items-center gap-2 sm:mt-8">
              <div className="inline-flex h-10 shrink-0 items-center rounded-[10px] border border-white/10 bg-[#171717]">
                <button type="button" aria-label="Decrease quantity" title="Decrease quantity" onClick={() => handleQuantityChange(-1)} disabled={isOutOfStock || quantity <= 1} className="flex h-10 w-9 items-center justify-center text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <Minus size={15} />
                </button>
                <span className="min-w-8 text-center text-[13px] font-medium text-white">{quantity}</span>
                <button type="button" aria-label="Increase quantity" title="Increase quantity" onClick={() => handleQuantityChange(1)} disabled={isOutOfStock || quantity >= Math.max(currentStock || 1, 1)} className="flex h-10 w-9 items-center justify-center text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <Plus size={15} />
                </button>
              </div>

              <button type="button" onClick={handleAddToCart} disabled={cartMutation.isPending || isOutOfStock || !selectedVariant} className="kicks-btn kicks-btn-primary min-w-0 flex-1">
                {cartMutation.isPending ? 'Adding...' : 'Add to cart'}
              </button>

              <button type="button" onClick={handleWishlistToggle} disabled={wishlistMutation.isPending} aria-label={isWishlisted ? `Remove ${product?.name || 'product'} from wishlist` : `Add ${product?.name || 'product'} to wishlist`} aria-pressed={isWishlisted} title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'} className="kicks-icon-btn h-10 w-10 shrink-0">
                <Heart size={16} className={isWishlisted ? 'fill-white' : ''} />
              </button>
            </div>

            <button type="button" onClick={handleBuyNow} className="kicks-btn kicks-btn-secondary mt-2.5 w-full" disabled={isOutOfStock || !selectedVariant}>
              <ShoppingBag size={14} /> Buy now
            </button>
            </>
            )}

            <div className="mt-4 flex gap-3 rounded-[18px] border border-white/10 bg-[#141414] p-4">
              <Info size={16} className="mt-0.5 shrink-0 text-[#b8b8b8]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Authenticity Notice</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#b8b8b8]">
                  KICKS does not represent this product as officially brand-authorized or independently authenticated.
                  Please review the product details carefully before purchase.{' '}
                  <Link to="/authenticity" className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">Learn more</Link>
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[20px] border border-white/10 bg-[#181818] p-4 text-sm text-[#d3d3d3]">
              <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-white" /> 30-day easy returns</div>
            </div>
          </div>
        </div>

        <section className="mt-10 grid gap-6 sm:mt-16 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#9a9a9a]">Overview</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Product details</h2>
            <div className="mt-6 space-y-5 text-base leading-7 text-[#d0d0d0]">
              {product?.description && <p>{product.description}</p>}
              {product?.shortDescription && <p>{product.shortDescription}</p>}
              <div className="grid gap-4 text-sm text-[#d3d3d3] md:grid-cols-2">
                {product?.brand?.name && <div className="rounded-[18px] border border-white/10 bg-[#181818] p-4"><span className="text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">Brand</span><p className="mt-2 font-medium text-white">{product.brand.name}</p></div>}
                {product?.category?.name && <div className="rounded-[18px] border border-white/10 bg-[#181818] p-4"><span className="text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">Category</span><p className="mt-2 font-medium text-white">{product.category.name}</p></div>}
                {product?.gender && <div className="rounded-[18px] border border-white/10 bg-[#181818] p-4"><span className="text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">Gender</span><p className="mt-2 font-medium text-white">{product.gender}</p></div>}
                {selectedVariant?.sku && <div className="rounded-[18px] border border-white/10 bg-[#181818] p-4"><span className="text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">SKU</span><p className="mt-2 font-medium text-white">{selectedVariant.sku}</p></div>}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#9a9a9a]">Reviews</p>
            <div className="mt-3 flex items-center gap-3">
              {product?.rating != null && (
                <span className="flex items-center gap-2 text-2xl font-bold text-white"><Star size={18} className="fill-white text-white" /> {product.rating}</span>
              )}
              <span className="text-sm text-[#d3d3d3]">{reviewsQuery.data?.length || 0} verified reviews</span>
            </div>

            {reviewsQuery.isLoading ? (
              <div className="mt-6 animate-pulse space-y-3">
                <div className="h-16 rounded-[18px] bg-[#181818]" />
                <div className="h-16 rounded-[18px] bg-[#181818]" />
              </div>
            ) : reviewsQuery.data?.length ? (
              <div className="mt-6 space-y-4">
                {reviewsQuery.data.slice(0, 2).map((review) => (
                  <div key={review?._id || review?.title} className="rounded-[18px] border border-white/10 bg-[#181818] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-white">{review?.title || 'Verified review'}</span>
                      <span className="flex items-center gap-1 text-[#f5d273]">
                        {[...Array(5)].map((_, index) => <Star key={index} size={12} className={index < Number(review?.rating || 0) ? 'fill-[#f5d273] text-[#f5d273]' : 'text-[#555]'} />)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#d3d3d3]">{review?.comment}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">{review?.user?.firstName || 'Verified'} {review?.user?.lastName || 'customer'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#d3d3d3]">No verified reviews yet for this product.</p>
            )}

            {!isAuthenticated ? (
              <p className="mt-6 text-sm text-[#d3d3d3]">Log in to leave a review.</p>
            ) : (
              <form onSubmit={reviewForm.handleSubmit((values) => reviewMutation.mutate(values))} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="review-rating" className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#a8a8a8]">Rating</label>
                  <select id="review-rating" {...reviewForm.register('rating')} className="kicks-field">
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="review-title" className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#a8a8a8]">Title</label>
                  <input id="review-title" {...reviewForm.register('title')} className="kicks-field" placeholder="A solid everyday trainer" />
                  {reviewForm.formState.errors.title && <p className="mt-2 text-sm text-red-300">{reviewForm.formState.errors.title.message}</p>}
                </div>
                <div>
                  <label htmlFor="review-comment" className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#a8a8a8]">Comment</label>
                  <textarea id="review-comment" rows={4} {...reviewForm.register('comment')} className="kicks-field" placeholder="Share what you liked about this sneaker." />
                  {reviewForm.formState.errors.comment && <p className="mt-2 text-sm text-red-300">{reviewForm.formState.errors.comment.message}</p>}
                </div>
                <button type="submit" disabled={reviewMutation.isPending} className="kicks-btn kicks-btn-primary kicks-btn-sm">
                  {reviewMutation.isPending ? 'Submitting...' : 'Submit review'}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="mt-10 sm:mt-16">
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">More like this</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">You may also like</h2>
          </div>

          {recommendationQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-[14px] bg-[#111111]" />)}
            </div>
          ) : recommendationQuery.data?.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
              {recommendationQuery.data.map((item) => (
                <ProductCard key={item?._id || item?.slug} product={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-[#111111] p-8 text-center text-sm text-[#d3d3d3]">
              No recommendations yet for this style.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
