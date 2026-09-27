import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Heart,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  User2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from './api/client';
import { adminAppUrl } from './utils/adminApp';
import { NEUTRAL_PRODUCT_IMAGE } from './components/ui/productImage';
import { cartLineImage } from './utils/productGallery';
import { addressesApi } from './api/addresses.api';
import { SearchableCombobox, PincodeField } from './components/ui/AddressFields';
import { INDIA_STATES, citySuggestions, pincodeStateConflictMessage } from './data/indiaLocations';
import { authApi } from './api/auth.api';
import { cartApi } from './api/cart.api';
import { cmsApi } from './api/cms.api';
import { notificationsApi } from './api/notifications.api';
import { ordersApi } from './api/orders.api';
import { wishlistApi } from './api/wishlist.api';
import { useAuth } from './context/useAuth';
import { ToastProvider } from './context/ToastProvider';
import { useToast } from './context/useToast';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerEmailSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm your password'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const registrationFields = new Set(['name', 'email', 'password', 'captchaToken']);

function getRegistrationFieldError(message) {
  const field = message?.match(/^"([^"]+)"/)?.[1];
  return registrationFields.has(field) ? field : null;
}

function getRegistrationErrorMessage(error) {
  if (error?.status === 409) return error?.message || 'An account with these details already exists.';
  if (error?.status === 429) return error?.message || 'Too many attempts. Please try again shortly.';
  if (error?.status === 400 && error?.message === 'Validation failed') return 'Please check the highlighted fields.';
  if (error?.status === 400 || error?.status === 503) return error?.message || 'Unable to create your account. Please try again.';
  return 'Unable to create your account. Please try again.';
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white">Checking session...</div>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

const isAdminRole = (role) => role === 'ADMIN';

function CustomerRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const adminTarget = isAdmin ? adminAppUrl('/admin') : null;
  useEffect(() => {
    if (adminTarget) window.location.assign(adminTarget);
  }, [adminTarget]);

  if (loading) return <div className="p-8 text-center text-white">Checking session...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin && !adminTarget) return <Navigate to="/admin" replace />;
  if (isAdmin) return null;
  return <Outlet />;
}

function PageMeta({ title, description = 'Premium sneaker storefront.' }) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, search, navigationType]);

  return null;
}

const unwrapPayload = (payload) => payload?.data ?? payload ?? {};
const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
};

const statusClasses = {
  PENDING: 'bg-[#1e1e1e] text-[#d9d9d9]',
  PROCESSING: 'bg-[#2b2610] text-[#f4d66a]',
  SHIPPED: 'bg-[#101d1a] text-[#7ee7c2]',
  DELIVERED: 'bg-[#13281d] text-[#92f3b5]',
  CANCELLED: 'bg-[#2c1717] text-[#ff9a9a]',
  PAID: 'bg-[#12251d] text-[#7de7b3]',
  FAILED: 'bg-[#2d1c1c] text-[#ff9999]',
  DEFAULT: 'bg-[#1a1a1a] text-white',
};

function AppShell() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/privacy-policy" element={<PolicyPage title="Privacy Policy" />} />
        <Route path="/terms" element={<PolicyPage title="Terms of Use" />} />
        <Route path="/shipping-policy" element={<PolicyPage title="Shipping Policy" />} />
        <Route path="/refund-cancellation-policy" element={<PolicyPage title="Refund & Cancellation Policy" />} />
        <Route path="/authenticity" element={<AuthenticityPage />} />
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/cms/:slug" element={<CmsPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<CustomerRoute />}>
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/profile" element={<AccountPage initialTab="profile" />} />
            <Route path="/account/security" element={<AccountPage initialTab="security" />} />
            <Route path="/account/addresses" element={<AddressBookPage />} />
            <Route path="/account/notifications" element={<NotificationsPage />} />
            <Route path="/account/orders" element={<OrdersPage />} />
            <Route path="/account/orders/:id" element={<OrderDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

function PasswordField({ label, name, register, error, placeholder = 'Enter password' }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      {label && (
        <label htmlFor={name} className="mb-2 block text-sm text-[#d5d5d5]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={name}
          type={showPassword ? 'text' : 'password'}
          {...register(name)}
          className="w-full kicks-field pr-12 text-white outline-none transition focus:border-white/25"
          placeholder={placeholder}
          aria-label={label || placeholder}
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#d9d9d9] transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function CategoriesPage() {
  const tiles = [
    { name: 'Running', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=70' },
    { name: 'Lifestyle', image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=70' },
    { name: 'Training', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=70' },
    { name: 'Basketball', image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=800&q=70' },
    { name: 'Football', image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=800&q=70' },
    { name: 'Skate', image: 'https://images.unsplash.com/photo-1605348532760-6753d2c43329?auto=format&fit=crop&w=800&q=70' },
    { name: 'Court', image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=800&q=70' },
    { name: 'Performance', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=800&q=70' },
  ];
  // Resolve each tile to the real backend category value (same contract as
  // ShopPage: _id → id → slug). Unmatched tiles fall back to plain /shop so
  // a missing category can never break the shop query.
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-tiles'],
    queryFn: () => apiClient.get('/categories').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = Array.isArray(unwrapPayload(categoriesData)) ? unwrapPayload(categoriesData) : [];
  const hrefFor = (name) => {
    const wanted = String(name || '').toLowerCase();
    const match = categoryOptions.find(
      (option) => String(option?.name || '').toLowerCase() === wanted || String(option?.slug || '').toLowerCase() === wanted,
    );
    const value = match?._id || match?.id || match?.slug;
    return value ? `/shop?category=${encodeURIComponent(value)}` : '/shop';
  };
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Categories | AJ SPORTS" description="Browse premium sneaker categories" />
      <div className="mb-5 sm:mb-8">
        <p className="kicks-eyebrow">Shop all</p>
        <h1 className="mt-3 kicks-section-title">Categories</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.name} to={hrefFor(tile.name)} className="rounded-[18px] border border-white/10 bg-[#111111] p-2.5 transition hover:border-white/25 sm:rounded-[22px] sm:p-3.5">
            <div className="h-32 overflow-hidden rounded-[12px] sm:h-44 sm:rounded-[16px] xl:h-52">
              <img src={tile.image} alt={tile.name} loading="lazy" className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-2 px-1 pb-0.5 pt-2.5 sm:pt-3">
              <span className="truncate text-sm font-semibold text-white sm:text-lg">{tile.name}</span>
              <ArrowRight size={15} className="shrink-0 text-white" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="About | AJ SPORTS" description="About AJ SPORTS" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="kicks-eyebrow">About us</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.08em] text-white sm:text-5xl">More than a shoe store.</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#d0d0d0]">
          AJ SPORTS brings together premium craftsmanship, performance-driven design, and effortless street style for the modern mover.
        </p>
      </div>
    </div>
  );
}

function ContactPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Contact | AJ SPORTS" description="Contact the AJ SPORTS team" />
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <p className="kicks-eyebrow">Contact</p>
          <h1 className="mt-4 kicks-section-title">Let’s talk.</h1>
          <div className="mt-8 space-y-5 text-[#d2d2d2]">
            <p>support@kicks.example</p>
            <p>+91 98765 43210</p>
            <p>12 MG Road, Bengaluru, India</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <form className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <input className="kicks-field text-white outline-none" placeholder="Your name" />
              <input className="kicks-field text-white outline-none" placeholder="Your email" />
            </div>
            <input className="w-full kicks-field text-white outline-none" placeholder="Subject" />
            <textarea rows={6} className="kicks-field" placeholder="Your message" />
            <button type="submit" className="kicks-btn kicks-btn-primary">Send message</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FaqPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="FAQ | AJ SPORTS" description="Frequently asked questions" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="kicks-eyebrow">FAQ</p>
        <h1 className="mt-4 kicks-section-title">Frequently asked questions</h1>
        <div className="mt-8 space-y-4 text-[#d6d6d6]">
          {['Do you ship nationwide?', 'How long does a return take?', 'Can I track my order?', 'Do you offer cash on delivery?'].map((question) => (
            <div key={question} className="rounded-[18px] border border-white/10 bg-[#171717] p-5">
              <strong className="text-white">{question}</strong>
              <p className="mt-2 text-sm text-[#b0b0b0]">Yes, AJ SPORTS supports fast domestic shipping and secure order tracking across key service zones.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolicyPage({ title }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title={`${title} | AJ SPORTS`} description={title} />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="kicks-eyebrow">Policy</p>
        <h1 className="mt-4 kicks-section-title">{title}</h1>
        <div className="mt-8 space-y-5 text-[#d1d1d1]">
          <p>These terms and policies are applied in line with the AJ SPORTS storefront experience and your purchase rights.</p>
          <p>For the live business rules, the backend is the source of truth for shipping timelines, returns, eligibility, and payment compliance.</p>
        </div>
      </div>
    </div>
  );
}

function AuthenticityPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Authenticity & Product Information | AJ SPORTS" description="Product authenticity and information disclosure" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-12">
        <p className="kicks-eyebrow">Product Information</p>
        <h1 className="mt-4 kicks-section-title">Authenticity &amp; Product Information</h1>
        <div className="mt-8 max-w-3xl space-y-5 text-sm leading-relaxed text-[#d1d1d1] sm:text-base">
          <p>Product descriptions, images, branding references, and availability are provided for informational purposes. Unless explicitly stated and verified, AJ SPORTS does not represent products as officially brand-authorized or independently authenticated.</p>
          <p>Customers should review the product information carefully before placing an order. If you have questions about a specific product, please contact our support team before purchase.</p>
          <p>By placing an order, you acknowledge the product information and authenticity disclosure shown on this website.</p>
        </div>
      </div>
    </div>
  );
}

function WishlistPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.getWishlist(),
    enabled: isAuthenticated,
  });

  const removeMutation = useMutation({
    mutationFn: (productId) => wishlistApi.removeFromWishlist(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast('Removed from wishlist', 'success');
    },
    onError: (error) => {
      if (error?.status === 401) {
        showToast('Please log in to continue', 'info');
        navigate('/login');
        return;
      }
      showToast(error?.message || 'Unable to remove from wishlist.', 'error');
    },
  });

  const cartMutation = useMutation({
    mutationFn: ({ productId, variantId }) =>
      cartApi.addItem({
        productId,
        variantId,
        quantity: 1,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      showToast('Added to cart', 'success');
    },
    onError: (error) => {
      if (error?.status === 401) {
        showToast('Please log in to continue', 'info');
        navigate('/login');
        return;
      }
      showToast(error?.message || 'Unable to add item to cart.', 'error');
    },
  });

  const wishlistPayload = unwrapPayload(wishlistQuery.data);
  const wishlist = wishlistPayload?.wishlist ?? [];
  const items = Array.isArray(wishlist) ? wishlist : wishlist?.productIds ?? wishlist?.items ?? [];

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:py-16 lg:px-8">
        <PageMeta title="Wishlist | AJ SPORTS" description="Your saved items" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 text-center sm:p-10">
          <h1 className="text-3xl font-black uppercase tracking-[-0.05em] text-white">
            Your wishlist
          </h1>
          <p className="mt-3 text-[#a8a8a8]">
            Log in to view your saved sneakers.
          </p>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-7 kicks-btn kicks-btn-primary kicks-btn-sm transition hover:bg-white/90"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Wishlist | AJ SPORTS" description="Your saved items" />

      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicks-eyebrow">
            Saved
          </p>

          <div className="mt-3 flex items-center gap-3">
            <h1 className="kicks-section-title">
              Wishlist
            </h1>

            {!wishlistQuery.isLoading && (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#a8a8a8]">
                {items.length}
              </span>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <Link
            to="/shop"
            className="inline-flex w-fit kicks-btn kicks-btn-secondary kicks-btn-sm transition hover:border-white/30"
          >
            Browse styles
          </Link>
        )}
      </div>

      {wishlistQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-[260px] animate-pulse rounded-[26px] border border-white/5 bg-[#111111] sm:h-[390px]"
            />
          ))}
        </div>
      ) : wishlistQuery.isError ? (
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <h2 className="text-xl font-semibold text-white">
            Unable to load wishlist
          </h2>

          <p className="mt-2 text-sm text-[#9f9f9f]">
            Please try again.
          </p>

          <button
            type="button"
            onClick={() => wishlistQuery.refetch()}
            className="mt-5 kicks-btn kicks-btn-primary kicks-btn-sm"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-6 text-center sm:p-10 md:p-14">
          <h2 className="text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">
            Your wishlist is empty
          </h2>

          <p className="mx-auto mt-4 max-w-md text-[#a8a8a8]">
            Save the pairs you love and come back to them anytime.
          </p>

          <Link
            to="/shop"
            className="mt-8 inline-flex kicks-btn kicks-btn-primary kicks-btn-sm transition hover:bg-white/90"
          >
            Shop now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const product = item?.product ?? item;
            const productId = product?._id || product?.id || item?.productId;

            const variants = Array.isArray(product?.variants)
              ? product.variants
              : [];

            const availableVariant = variants.find(
              (variant) =>
                variant?.status !== 'INACTIVE' &&
                Number(variant?.stock || 0) > 0,
            );

            const basePrice = Number(
              availableVariant?.price ?? product?.price ?? 0,
            );

            const salePrice =
              Number(
                availableVariant?.salePrice ?? product?.salePrice ?? 0,
              ) || null;

            const displayPrice = salePrice ?? basePrice;

            const discount =
              salePrice && basePrice > salePrice
                ? Math.round(((basePrice - salePrice) / basePrice) * 100)
                : 0;

            const isOutOfStock =
              variants.length > 0 && !availableVariant;

            return (
              <article
                key={productId}
                className="overflow-hidden rounded-[26px] border border-white/10 bg-[#111111] transition hover:-translate-y-1 hover:border-white/20"
              >
                <div className="relative overflow-hidden bg-[#181818]">
                  <Link
                    to={`/products/${product?.slug || productId}`}
                    className="block"
                  >
                    <img
                      src={product?.images?.[0] || NEUTRAL_PRODUCT_IMAGE}
                      alt={product?.name || 'Saved product'}
                      className="h-40 w-full object-cover transition duration-500 hover:scale-105 sm:h-56 lg:h-64"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE;
                      }}
                    />
                  </Link>

                  {discount > 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black sm:left-3 sm:top-3 sm:text-[10px]">
                      -{discount}%
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(productId)}
                    disabled={
                      removeMutation.isPending &&
                      removeMutation.variables === productId
                    }
                    aria-label={`Remove ${product?.name || 'product'} from wishlist`}
                    title="Remove from wishlist"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition hover:border-white/40 disabled:cursor-wait disabled:opacity-50 sm:right-3 sm:top-3 sm:h-9 sm:w-9"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="p-3 sm:p-4">
                  <p className="truncate text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">
                    {product?.brand?.name || 'AJ SPORTS'}
                  </p>

                  <Link
                    to={`/products/${product?.slug || productId}`}
                    className="mt-2 block break-words text-base font-semibold text-white line-clamp-2 hover:text-white/80 sm:text-lg"
                  >
                    {product?.name || 'Sneaker'}
                  </Link>

                  <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-3">
                    <span className="text-base font-semibold text-white sm:text-lg">
                      {formatMoney(displayPrice)}
                    </span>

                    {salePrice && (
                      <span className="min-w-0 truncate text-xs text-[#777] line-through sm:text-sm">
                        {formatMoney(basePrice)}
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${
                      isOutOfStock
                        ? 'text-red-200'
                        : 'text-[#9feec8]'
                    }`}
                  >
                    {isOutOfStock ? 'Out of stock' : 'In stock'}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 sm:mt-5 sm:gap-3">
                    {isOutOfStock ? (
                      <Link
                        to={`/products/${product?.slug || productId}`}
                        className="inline-flex h-9 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-white/15 px-2 text-center text-[11px] font-medium text-white transition hover:border-white/35 sm:h-auto sm:rounded-full sm:px-4 sm:py-3 sm:text-sm"
                      >
                        View details
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (!availableVariant?._id) {
                              navigate(
                                `/products/${product?.slug || productId}`,
                              );
                              return;
                            }

                            cartMutation.mutate({
                              productId,
                              variantId: availableVariant._id,
                            });
                          }}
                          disabled={
                            cartMutation.isPending &&
                            cartMutation.variables?.productId === productId
                          }
                          className="kicks-btn kicks-btn-primary kicks-btn-sm min-w-0 flex-1"
                        >
                          {cartMutation.isPending &&
                          cartMutation.variables?.productId === productId
                            ? 'Adding...'
                            : 'Add to cart'}
                        </button>

                        <Link
                          to={`/products/${product?.slug || productId}`}
                          aria-label={`View ${product?.name || 'product'}`}
                          title="View product"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white transition hover:border-white/35 sm:h-11 sm:w-11 sm:rounded-full"
                        >
                          <ShoppingBag size={16} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError } = useQuery({ queryKey: ['cart'], queryFn: () => cartApi.getCart() });

  const cart = unwrapPayload(data)?.cart ?? unwrapPayload(data) ?? {};
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || item.price || 0) * Number(item.quantity || 0), 0);

  const updateMutation = useMutation({
    mutationFn: ({ variantId, quantity }) => cartApi.updateItem(variantId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (error) => showToast(error?.message || 'Unable to update cart item.', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (variantId) => cartApi.removeItem(variantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (error) => showToast(error?.message || 'Unable to remove cart item.', 'error'),
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clearCart(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (error) => showToast(error?.message || 'Unable to clear your cart.', 'error'),
  });

  const cartImageFallback = NEUTRAL_PRODUCT_IMAGE;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Cart | AJ SPORTS" description="Shopping cart" />
      <div className="mb-6 sm:mb-8">
        <p className="kicks-eyebrow">Your cart</p>
        <h1 className="mt-3 kicks-section-title">Cart</h1>
      </div>

      {isLoading ? (
        <div className="h-[300px] animate-pulse rounded-[28px] bg-[#111111]" />
      ) : isError ? (
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 text-sm text-[#d7d7d7] sm:p-8 sm:text-base">Unable to load cart from the backend.</div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Your cart is empty</h2>
          <p className="mt-4 text-sm text-[#c3c3c3] sm:text-base">Add a few premium pairs and continue to checkout.</p>
          <Link to="/shop" className="mt-6 inline-flex kicks-btn kicks-btn-primary sm:mt-8">Continue shopping</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3 sm:space-y-4">
            {items.map((item) => {
              const product = item.product || (typeof item.productId === 'object' ? item.productId : {}) || {};
              const variantId = item.variantId || item.variant?._id || item._id;
              const quantity = Number(item.quantity || 0);
              const price = Number(item.unitPrice || item.price || 0);
              const subtotal = price * quantity;
              const image = cartLineImage(item, cartImageFallback);
              const size = item.size || item.variant?.size || 'N/A';
              const color = item.color || item.variant?.color || 'N/A';

              return (
                <div key={variantId} className="flex gap-3 rounded-[24px] border border-white/10 bg-[#111111] p-3 sm:gap-4 sm:p-4 md:items-center">
                  <img src={image} alt={product?.name || 'Cart item'} className="h-20 w-20 shrink-0 rounded-[16px] object-cover sm:h-24 sm:w-24 sm:rounded-[18px]" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = cartImageFallback; }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-base font-semibold text-white line-clamp-2 sm:text-xl">{product?.name || 'AJ SPORTS product'}</h3>
                    <p className="mt-1 truncate text-xs text-[#9d9d9d] sm:text-sm">{product?.brand?.name || 'AJ SPORTS'} • Size {size} • Color {color}</p>
                    <p className="mt-1 text-xs font-medium text-white sm:mt-2 sm:text-sm">{formatMoney(price)} each</p>
                    <div className="mt-2 flex items-center gap-2 sm:gap-3">
                      <button type="button" aria-label="Decrease quantity" title="Decrease quantity" onClick={() => updateMutation.mutate({ variantId, quantity: Math.max(1, quantity - 1) })} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white transition hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 sm:h-9 sm:w-9">−</button>
                      <span className="min-w-6 text-center text-sm font-medium text-white sm:min-w-8">{quantity}</span>
                      <button type="button" aria-label="Increase quantity" title="Increase quantity" onClick={() => updateMutation.mutate({ variantId, quantity: quantity + 1 })} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white transition hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 sm:h-9 sm:w-9">+</button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                    <div className="text-sm font-semibold text-white sm:text-lg">{formatMoney(subtotal)}</div>
                    <button type="button" onClick={() => removeMutation.mutate(variantId)} disabled={removeMutation.isPending && removeMutation.variables === variantId} aria-label="Remove item" title="Remove item" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white transition hover:border-red-500/40 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-wait disabled:opacity-60">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-[#111111] p-5 sm:p-6">
            <h2 className="text-xl font-bold text-white sm:text-2xl">Summary</h2>
            <div className="mt-5 space-y-3 text-sm text-[#d2d2d2] sm:mt-6 sm:space-y-4 sm:text-base">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>Free</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{formatMoney(0)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-4 text-lg font-semibold text-white"><span>Total</span><span>{formatMoney(subtotal)}</span></div>
            </div>
            <button type="button" onClick={() => navigate('/checkout')} className="mt-6 block w-full kicks-btn kicks-btn-primary">Proceed to checkout</button>
            <button type="button" disabled={clearMutation.isPending} onClick={() => clearMutation.mutate()} className="kicks-btn kicks-btn-secondary mt-3 w-full sm:mt-4">{clearMutation.isPending ? 'Clearing...' : 'Clear cart'}</button>
          </aside>
        </div>
      )}
    </div>
  );
}

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: cartData, isLoading: cartLoading, isError: cartError } = useQuery({ queryKey: ['cart'], queryFn: () => cartApi.getCart() });
  const { data: addressesData, isLoading: addressesLoading } = useQuery({ queryKey: ['addresses'], queryFn: () => addressesApi.list() });

  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pinLookup, setPinLookup] = useState({ status: 'idle', result: null });
  // Bumps whenever the address form session ends so the PIN field remounts
  // with fresh transient verification state (cached lookups are preserved).
  const [addressSession, setAddressSession] = useState(0);

  const [addressForm, setAddressForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  const cart = unwrapPayload(cartData)?.cart ?? unwrapPayload(cartData) ?? {};
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const addressList = unwrapPayload(addressesData)?.addresses ?? [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || item.price || 0) * Number(item.quantity || 0), 0);
  const defaultAddress = addressList.find((address) => address.isDefault) || addressList[0];
  const activeAddressId = selectedAddressId || defaultAddress?._id || defaultAddress?.id || '';

  const loadRazorpayScript = () => new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay checkout script failed to load.'));
    document.body.appendChild(script);
  });

  const handlePaymentSuccess = async (orderId, paymentResponse) => {
    try {
      const response = await apiClient.post('/payments/verify', {
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      const payload = unwrapPayload(response.data);
      if (payload?.payment?.status === 'PAID' || payload?.payment?.paymentId) {
        await queryClient.invalidateQueries({ queryKey: ['cart'] });
        navigate(`/order-success/${orderId}`);
        showToast('Payment successful.', 'success');
        return;
      }

      showToast('Payment verification failed. Please try again.', 'error');
    } catch (error) {
      showToast(error?.message || 'Payment verification failed.', 'error');
    }
  };

  const addressCreateMutation = useMutation({
    mutationFn: (payload) => addressesApi.create(payload),
    onSuccess: async (result) => {
      const nextAddress = unwrapPayload(result)?.address ?? result?.address ?? null;
      if (nextAddress) {
        setSelectedAddressId(nextAddress._id || nextAddress.id || '');
      }
      setShowAddressForm(false);
      setPinLookup({ status: 'idle', result: null });
      setAddressSession((session) => session + 1);
      setAddressForm({
        firstName: '',
        lastName: '',
        phone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
      });
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showToast('Address added.', 'success');
    },
    onError: (error) => showToast(error?.message || 'Unable to add address.', 'error'),
  });

  const payNow = async () => {
    if (!activeAddressId) {
      showToast('Please select or add a delivery address.', 'error');
      return;
    }

    if (isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      const orderResponse = await ordersApi.checkout({
        addressId: activeAddressId,
      });

      const order = unwrapPayload(orderResponse)?.order ?? orderResponse?.order ?? {};
      const orderId = order._id || order.id;
      if (!orderId) {
        throw new Error('Order could not be created.');
      }

      const paymentResponse = await apiClient.post(`/payments/orders/${orderId}`);
      const paymentPayload = unwrapPayload(paymentResponse);
      const gatewayOrder = paymentPayload?.gatewayOrder || paymentPayload?.data?.gatewayOrder || paymentPayload?.gatewayOrder || {};
      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

      if (!gatewayOrder?.id || !razorpayKey) {
        throw new Error('Razorpay is not configured for this checkout.');
      }

      await loadRazorpayScript();
      const options = {
        key: razorpayKey,
        amount: Number(gatewayOrder.amount || 0),
        currency: gatewayOrder.currency || 'INR',
        name: 'AJ SPORTS',
        description: `Order ${order.orderNumber || orderId}`,
        order_id: gatewayOrder.id,
        handler: async (razorpayResponse) => {
          await handlePaymentSuccess(orderId, razorpayResponse);
        },
        prefill: {
          name: `${order.customerSnapshot?.firstName || ''} ${order.customerSnapshot?.lastName || ''}`.trim() || 'AJ SPORTS customer',
          email: order.customerSnapshot?.email || '',
          contact: order.customerSnapshot?.phone || '',
        },
        theme: { color: '#111111' },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
            showToast('Payment cancelled.', 'info');
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', (failure) => {
        setIsProcessingPayment(false);
        showToast(failure?.error?.description || 'Payment failed. Please try again.', 'error');
      });
      razorpayInstance.open();
    } catch (error) {
      setIsProcessingPayment(false);
      showToast(error?.message || 'Unable to start payment.', 'error');
    }
  };

  const shipping = 0;
  const total = Math.max(subtotal + shipping, 0);

  const submitAddress = (event) => {
    event.preventDefault();
    if (!addressForm.firstName || !addressForm.lastName || !addressForm.phone || !addressForm.addressLine1 || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      showToast('Please complete the required address fields.', 'error');
      return;
    }
    if (!/^(\+91[\s-]?|91[\s-]?)?[6-9]\d{9}$/.test(addressForm.phone.trim())) {
      showToast('Enter a valid 10-digit mobile number.', 'error');
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(addressForm.postalCode.trim())) {
      showToast('Enter a valid 6-digit PIN code.', 'error');
      return;
    }
    if (pinLookup.status === 'invalid') {
      showToast('This pincode does not appear to exist. Please check the number.', 'error');
      return;
    }
    if (pinLookup.status === 'checking') {
      showToast('Please wait while the pincode is being verified.', 'info');
      return;
    }
    const conflict = pincodeStateConflictMessage(pinLookup, addressForm.state);
    if (conflict) {
      showToast(conflict, 'error');
      return;
    }

    addressCreateMutation.mutate({
      firstName: addressForm.firstName.trim(),
      lastName: addressForm.lastName.trim(),
      phone: addressForm.phone.trim(),
      addressLine1: addressForm.addressLine1.trim(),
      addressLine2: addressForm.addressLine2.trim(),
      city: addressForm.city.trim(),
      state: addressForm.state.trim(),
      postalCode: addressForm.postalCode.trim(),
      country: addressForm.country.trim() || 'India',
      isDefault: addressList.length === 0,
    });
  };

  if (cartLoading || addressesLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
        <div className="h-[300px] animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  if (cartError || items.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
        <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Your cart is empty</h2>
          <p className="mt-4 text-[#c3c3c3]">Add a few premium pairs and continue to checkout.</p>
          <Link to="/shop" className="mt-8 inline-flex kicks-btn kicks-btn-primary">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Checkout | AJ SPORTS" description="Checkout" />
      <div className="mb-6 sm:mb-8">
        <p className="kicks-eyebrow">Checkout</p>
        <h1 className="mt-3 kicks-section-title">Secure checkout</h1>
      </div>

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white sm:text-2xl">Delivery Address</h2>
              <button type="button" onClick={() => { if (showAddressForm) { setPinLookup({ status: 'idle', result: null }); setAddressSession((session) => session + 1); } setShowAddressForm((current) => !current); }} className="shrink-0 kicks-btn kicks-btn-secondary kicks-btn-sm transition hover:border-white/30">
                {showAddressForm ? 'Close form' : 'Add new address'}
              </button>
            </div>

            {addressList.length > 0 ? (
              <div className="mt-5 space-y-3" role="radiogroup" aria-label="Choose a delivery address">
                {addressList.map((address) => {
                  const addressId = address._id || address.id;
                  const isSelected = activeAddressId === addressId;
                  return (
                    <button
                      key={addressId}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Deliver to ${address.firstName} ${address.lastName}, ${address.city} ${address.postalCode}`}
                      onClick={() => setSelectedAddressId(addressId)}
                      className={`flex w-full items-start gap-3 rounded-[20px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/60 sm:gap-4 ${isSelected ? 'border-white bg-[#1a1a1a] ring-1 ring-white/60' : 'border-white/10 bg-[#181818] hover:border-white/25'}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${isSelected ? 'border-white bg-white text-black' : 'border-white/25 text-transparent'}`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{address.firstName} {address.lastName}</span>
                          {isSelected && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-black">Selected</span>}
                          {address.isDefault && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#d7d7d7]">Default</span>}
                        </span>
                        <span className="mt-1.5 block text-sm leading-relaxed text-[#d7d7d7]">{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}</span>
                        <span className="block text-sm text-[#d7d7d7]">{address.city}, {address.state} {address.postalCode}</span>
                        <span className="mt-1 block text-xs text-[#9d9d9d]">{address.phone}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-5 text-center" role="alert">
                <p className="text-sm font-semibold text-white">Select delivery address</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-[#a8a8a8]">No saved address yet. Add your first delivery address below — payment stays disabled until an address is selected.</p>
              </div>
            )}

            {showAddressForm && (
              <form onSubmit={submitAddress} className="mt-5 grid gap-4 rounded-[20px] border border-white/10 bg-[#181818] p-4 md:grid-cols-2">
                <input value={addressForm.firstName} onChange={(event) => setAddressForm((current) => ({ ...current, firstName: event.target.value }))} className="kicks-field text-white outline-none" placeholder="First name" />
                <input value={addressForm.lastName} onChange={(event) => setAddressForm((current) => ({ ...current, lastName: event.target.value }))} className="kicks-field text-white outline-none" placeholder="Last name" />
                <input value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} className="kicks-field text-white outline-none md:col-span-2" placeholder="Phone" />
                <input value={addressForm.addressLine1} onChange={(event) => setAddressForm((current) => ({ ...current, addressLine1: event.target.value }))} className="kicks-field text-white outline-none md:col-span-2" placeholder="Address line 1" />
                <input value={addressForm.addressLine2} onChange={(event) => setAddressForm((current) => ({ ...current, addressLine2: event.target.value }))} className="kicks-field text-white outline-none md:col-span-2" placeholder="Address line 2 (optional)" />
                <SearchableCombobox
                  id="checkout-city"
                  value={addressForm.city}
                  onChange={(next) => setAddressForm((current) => ({ ...current, city: next }))}
                  options={citySuggestions(addressForm.state, pinLookup.result?.city)}
                  placeholder="City"
                />
                <SearchableCombobox
                  id="checkout-state"
                  value={addressForm.state}
                  onChange={(next) => setAddressForm((current) => ({ ...current, state: next }))}
                  options={INDIA_STATES}
                  placeholder="State"
                />
                <PincodeField
                  key={`checkout-pin-${addressSession}`}
                  id="checkout-postalCode"
                  label=""
                  value={addressForm.postalCode}
                  onChange={(next) => setAddressForm((current) => ({ ...current, postalCode: next }))}
                  onLookup={setPinLookup}
                  onVerified={(found) => {
                    setAddressForm((current) => ({
                      ...current,
                      state: current.state || found?.state || current.state,
                      city: current.city || found?.city || current.city,
                    }));
                  }}
                />
                <input value={addressForm.country} onChange={(event) => setAddressForm((current) => ({ ...current, country: event.target.value }))} className="kicks-field text-white outline-none" placeholder="Country" />
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={addressCreateMutation.isPending} className="kicks-btn kicks-btn-primary disabled:cursor-wait disabled:opacity-60">
                    {addressCreateMutation.isPending ? 'Saving...' : 'Save address'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        <aside className="rounded-[28px] border border-white/10 bg-[#111111] p-5 sm:p-6 lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Order summary</h2>

          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const product = item.product || (typeof item.productId === 'object' ? item.productId : {}) || {};
              const productName = product?.name || 'Product';
              const image = cartLineImage(item, NEUTRAL_PRODUCT_IMAGE);
              const unitPrice = Number(item.unitPrice || item.price || 0);
              const lineTotal = unitPrice * Number(item.quantity || 0);
              return (
                <div key={item.variantId || item._id || item.id} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#181818] p-3">
                  <img src={image} alt={productName} className="h-16 w-16 rounded-[14px] object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{productName}</div>
                    <div className="mt-1 text-xs text-[#d3d3d3]">{product?.brand?.name || 'AJ SPORTS'} • {item.size || item.variant?.size || 'N/A'} • {item.color || item.variant?.color || 'N/A'}</div>
                    <div className="mt-1 text-xs text-[#d3d3d3]">Qty {item.quantity}</div>
                  </div>
                  <div className="text-sm font-medium text-white">{formatMoney(lineTotal)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-4 text-[#d2d2d2]">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'Free' : formatMoney(shipping)}</span></div>
            <div className="flex justify-between border-t border-white/10 pt-4 text-lg font-semibold text-white"><span>Total</span><span>{formatMoney(total)}</span></div>
          </div>

          <button
            type="button"
            disabled={!activeAddressId || isProcessingPayment}
            onClick={payNow}
            title={!activeAddressId ? 'Select a delivery address above to enable payment' : 'Pay securely with Razorpay'}
            className="mt-6 w-full kicks-btn kicks-btn-primary transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessingPayment && <Loader2 size={15} className="animate-spin" />}
            {isProcessingPayment ? 'Preparing payment...' : `Pay now • ${formatMoney(total)}`}
          </button>

          {!activeAddressId && <p role="alert" className="mt-3 text-center text-sm text-red-300">Select a delivery address above to enable payment.</p>}

          <p className="mt-4 text-center text-xs leading-relaxed text-[#8d8d8d]">
            By placing this order, you acknowledge the product information and authenticity disclosure shown on this website.{' '}
            <Link to="/authenticity" className="text-[#c4c4c4] underline decoration-white/25 underline-offset-2 hover:text-white">Learn more</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function OrderSuccessPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['order-success', id],
    queryFn: () => ordersApi.getById(id),
    enabled: Boolean(id),
  });

  const order = unwrapPayload(data)?.order ?? {};
  const orderNumber = order.orderNumber || order._id || id || 'Order';
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';
  const totalAmount = Number(order.grandTotal || order.total || 0);
  const itemCount = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0;

  if (!id) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:py-12 lg:px-8">
        <PageMeta title="Order issue | AJ SPORTS" description="Order information unavailable" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 text-center sm:p-8 md:p-12">
          <h1 className="kicks-section-title">Order unavailable</h1>
          <p className="mt-4 text-[#d3d3d3]">We could not load your order details.</p>
          <Link to="/shop" className="mt-8 inline-flex kicks-btn kicks-btn-primary">Continue shopping</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:py-12 lg:px-8">
        <div className="h-[320px] animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  if (isError || !order?._id) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:py-12 lg:px-8">
        <PageMeta title="Order issue | AJ SPORTS" description="Order information unavailable" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 text-center sm:p-8 md:p-12">
          <h1 className="kicks-section-title">Order unavailable</h1>
          <p className="mt-4 text-[#d3d3d3]">We could not load this order right now. Please try again.</p>
          <Link to="/shop" className="mt-8 inline-flex kicks-btn kicks-btn-primary">Continue shopping</Link>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';

  if (!isPaid) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:py-12 lg:px-8">
        <PageMeta title="Payment pending | AJ SPORTS" description="Payment confirmation is still pending" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 text-center sm:p-8 md:p-12">
          <h1 className="kicks-section-title">Payment pending</h1>
          <p className="mt-4 text-[#d3d3d3]">Your payment is still being confirmed. Please check again shortly.</p>
          <Link to="/shop" className="mt-8 inline-flex kicks-btn kicks-btn-primary">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Order placed | AJ SPORTS" description="Your order was successful" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-12">
        <div className="flex flex-col items-center text-center">
          <div aria-hidden="true" className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-black text-black">✓</div>
          <p className="kicks-eyebrow">Order status</p>
          <h1 className="mt-4 kicks-section-title">Order placed successfully</h1>
        </div>

        <div className="mt-8 grid gap-4 rounded-[24px] border border-white/10 bg-[#181818] p-5 text-left md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-[#8d8d8d]">Order number</p>
            <p className="mt-2 text-lg font-semibold text-white">{orderNumber}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-[#8d8d8d]">Order date</p>
            <p className="mt-2 text-lg font-semibold text-white">{orderDate}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-[#8d8d8d]">Payment status</p>
            <p className="mt-2 text-lg font-semibold text-white">{order.paymentStatus || 'PAID'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-[#8d8d8d]">Total</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(totalAmount)}</p>
          </div>
        </div>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-[#181818] p-5">
          <p className="text-[10px] uppercase tracking-[0.26em] text-[#8d8d8d]">Order summary</p>
          <div className="mt-4 flex items-center justify-between gap-4 text-sm text-[#d5d5d5]">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 text-sm text-[#d5d5d5]">
            <span>Order status</span>
            <span>{order.status || 'CONFIRMED'}</span>
          </div>
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="mt-5 space-y-3">
              {order.items.slice(0, 3).map((item) => (
                <div key={item._id || item.variantId || item.productId} className="flex items-center justify-between gap-4 rounded-[14px] border border-white/10 bg-[#111111] p-3">
                  <div>
                    <div className="text-sm font-medium text-white">{item.productName || item.name || 'AJ SPORTS product'}</div>
                    <div className="mt-1 text-xs text-[#b4b4b4]">Qty {item.quantity || 1}</div>
                  </div>
                  <div className="text-sm font-medium text-white">{formatMoney(Number(item.unitPrice || item.finalPrice || 0) * Number(item.quantity || 1))}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to={`/account/orders/${id}`} className="inline-flex flex-1 items-center justify-center kicks-btn kicks-btn-primary">View order</Link>
          <Link to="/shop" className="kicks-btn kicks-btn-secondary flex-1">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}

function OrdersPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['orders'], queryFn: () => ordersApi.listForUser() });
  const orders = unwrapPayload(data)?.orders ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="My orders | AJ SPORTS" description="Order history" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
        <h1 className="kicks-section-title">My orders</h1>
        {isLoading ? (
          <div className="mt-6 h-[200px] animate-pulse rounded-[24px] bg-[#181818]" />
        ) : isError ? (
          <div className="mt-6 rounded-[20px] border border-white/10 bg-[#181818] p-5 text-[#d2d2d2]">Unable to load your orders.</div>
        ) : orders.length === 0 ? (
          <div className="mt-6 rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d2d2d2]">No orders yet. Your AJ SPORTS history will appear here.</div>
        ) : (
          <div className="mt-6 space-y-4 text-[#d2d2d2]">
            {orders.map((order) => (
              <Link key={order._id || order.id} to={`/account/orders/${order._id || order.id}`} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-[#181818] p-5">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-[#a0a0a0]">Order</div>
                  <div className="mt-2 text-xl font-semibold text-white">{order.orderNumber || order._id || order.id}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-[#d9d9d9]">{order.status || 'PENDING'}</div>
                  <div className="text-sm font-medium text-white">{formatMoney(order.total || order.amount || 0)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order Details — compact, mobile-first building blocks.
// Every value below is derived from the order payload; nothing is hardcoded.
// ---------------------------------------------------------------------------

// Progress tracker steps: Placed → Processing → Shipped → Delivered.
const ORDER_PROGRESS_STEPS = ['Placed', 'Processing', 'Shipped', 'Delivered'];

// Maps the backend order status onto the tracker index it has reached.
const orderProgressIndex = (status) => {
  switch (status) {
    case 'CONFIRMED':
    case 'PROCESSING':
    case 'PACKED':
      return 1;
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      return 2;
    case 'DELIVERED':
      return 3;
    default:
      return 0;
  }
};

// Restrained status tones (dot + pill) used by the header badge.
const ORDER_STATUS_STYLES = {
  PENDING: { pill: 'border-white/15 bg-white/[0.04] text-[#cfcfcf]', dot: 'bg-[#8d8d8d]' },
  CONFIRMED: { pill: 'border-[#ffc800]/35 bg-[#ffc800]/10 text-[#ffd45c]', dot: 'bg-[#ffc800]' },
  PROCESSING: { pill: 'border-[#ffc800]/35 bg-[#ffc800]/10 text-[#ffd45c]', dot: 'bg-[#ffc800]' },
  PACKED: { pill: 'border-[#ffc800]/35 bg-[#ffc800]/10 text-[#ffd45c]', dot: 'bg-[#ffc800]' },
  SHIPPED: { pill: 'border-[#7fd4ff]/30 bg-[#7fd4ff]/10 text-[#9adcff]', dot: 'bg-[#7fd4ff]' },
  OUT_FOR_DELIVERY: { pill: 'border-[#7fd4ff]/30 bg-[#7fd4ff]/10 text-[#9adcff]', dot: 'bg-[#7fd4ff]' },
  DELIVERED: { pill: 'border-[#7de7b3]/30 bg-[#7de7b3]/10 text-[#9df0c5]', dot: 'bg-[#7de7b3]' },
  CANCELLED: { pill: 'border-[#ff9a9a]/30 bg-[#ff9a9a]/10 text-[#ffb0b0]', dot: 'bg-[#ff9a9a]' },
  REFUNDED: { pill: 'border-[#ff9a9a]/30 bg-[#ff9a9a]/10 text-[#ffb0b0]', dot: 'bg-[#ff9a9a]' },
};

const getOrderStatusStyle = (status) => ORDER_STATUS_STYLES[status] || ORDER_STATUS_STYLES.PENDING;

const humanizeStatus = (value, fallback = '—') => {
  const text = String(value || '').trim().replace(/_/g, ' ').toLowerCase();
  if (!text) return fallback;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

// Product image chain: order item snapshot → populated product gallery
// (color/variant aware) → neutral placeholder.
const orderItemImage = (item) => {
  const snapshot = typeof item?.image === 'string' ? item.image.trim() : '';
  if (snapshot) return snapshot;

  const product = item?.product ?? (typeof item?.productId === 'object' ? item.productId : null);
  const gallery = cartLineImage({ ...item, product }, '');
  if (gallery) return gallery;

  const images = Array.isArray(product?.images) ? product.images : [];
  return images.find(Boolean) || NEUTRAL_PRODUCT_IMAGE;
};

function OrderSectionLabel({ children }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8a8a8a]">
      {children}
    </p>
  );
}

function OrderStatusBadge({ status }) {
  const tone = getOrderStatusStyle(status);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.pill}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      {humanizeStatus(status, 'Pending')}
    </span>
  );
}

function OrderProgress({ status }) {
  const active = status !== 'CANCELLED' && status !== 'REFUNDED';
  const currentIndex = orderProgressIndex(status);
  const reached = (index) => active && index <= currentIndex;
  const lastIndex = ORDER_PROGRESS_STEPS.length - 1;

  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
      {ORDER_PROGRESS_STEPS.map((label, index) => {
        const isDone = active && index < currentIndex;
        const isCurrent = active && index === currentIndex;
        const leftFilled = reached(index);
        const rightFilled = reached(index + 1);

        const dotClass = isCurrent
          ? 'bg-[#ffc800] shadow-[0_0_0_4px_rgba(255,200,0,0.16)]'
          : isDone
            ? 'bg-[#ffc800]/45'
            : 'bg-white/12';

        const labelClass = isCurrent
          ? 'font-semibold text-white'
          : isDone
            ? 'text-[#c9c9c9]'
            : 'text-[#6a6a6a]';

        const lineClass = (filled) => (filled ? 'bg-[#ffc800]/45' : 'bg-white/10');

        return (
          <li
            key={label}
            className="flex min-w-0 flex-col items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="flex w-full items-center" aria-hidden="true">
              <span className={`h-px flex-1 ${index === 0 ? 'invisible' : lineClass(leftFilled)}`} />
              <span className={`mx-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
              <span className={`h-px flex-1 ${index === lastIndex ? 'invisible' : lineClass(rightFilled)}`} />
            </span>
            <span className={`text-center text-[9.5px] leading-tight tracking-[0.04em] ${labelClass}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderDetailPage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [invoiceUnavailable, setInvoiceUnavailable] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => ordersApi.getById(id),
    enabled: Boolean(id),
  });
  const trackingQuery = useQuery({
    queryKey: ['order-tracking', id],
    queryFn: () => ordersApi.track(id),
    enabled: Boolean(id),
  });

  const order = unwrapPayload(data)?.order ?? {};
  const shipment = unwrapPayload(trackingQuery.data)?.shipment ?? null;
  const trackingUrl = typeof shipment?.trackingUrl === 'string' && /^https?:\/\//i.test(shipment.trackingUrl)
    ? shipment.trackingUrl
    : '';
  const invoiceMutation = useMutation({
    mutationFn: (orderId) => ordersApi.invoice(orderId),
    onSuccess: (pdf) => {
      const pdfBlob = pdf instanceof Blob ? pdf : new Blob([pdf], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `invoice-${order.orderNumber || id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      showToast('Invoice downloaded', 'success');
    },
    onError: (error) => {
      if ([400, 404].includes(error?.status)) setInvoiceUnavailable(true);
      showToast(
        error?.status === 400 ? 'Invoice is not available yet.' : 'Unable to download invoice. Please try again.',
        'error',
      );
    },
  });
  const items = Array.isArray(order.items) ? order.items : [];
  const shippingAddress = order.shippingAddress ?? {};
  const subtotal = Number(order.subtotal || items.reduce((sum, item) => sum + Number(item.unitPrice || item.finalPrice || 0) * Number(item.quantity || 1), 0));
  const discount = Number(order.discountAmount || 0);
  const shippingCharge = Number(order.shippingCharge || 0);
  const tax = Number(order.tax || 0);
  const total = Number(order.grandTotal || order.total || subtotal - discount + shippingCharge + tax || 0);

  if (!id) {
    return (
      <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-4 sm:pt-6">
        <PageMeta title="Order details | AJ SPORTS" description="Order details" />
        <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 text-center">
          <h1 className="text-lg font-black uppercase tracking-[-0.02em] text-white">Order not found</h1>
          <p className="mt-2 text-[13px] text-[#b8b8b8]">We could not find this order.</p>
          <Link to="/account/orders" className="kicks-btn kicks-btn-primary kicks-btn-sm mt-5">Back to orders</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-4 sm:pt-6" aria-busy="true">
        <div className="h-7 w-2/3 animate-pulse rounded-lg bg-[#111111]" />
        <div className="mt-4 h-[76px] animate-pulse rounded-2xl bg-[#111111]" />
        <div className="mt-3 h-[44px] animate-pulse rounded-2xl bg-[#111111]" />
        <div className="mt-4 h-[92px] animate-pulse rounded-2xl bg-[#111111]" />
        <div className="mt-4 h-[132px] animate-pulse rounded-2xl bg-[#111111]" />
      </div>
    );
  }

  if (isError || !order._id) {
    return (
      <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-4 sm:pt-6">
        <PageMeta title="Order details | AJ SPORTS" description="Order details" />
        <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 text-center">
          <h1 className="text-lg font-black uppercase tracking-[-0.02em] text-white">Order unavailable</h1>
          <p className="mt-2 text-[13px] text-[#b8b8b8]">We could not load this order right now.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link to="/account/orders" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
              <span className="min-w-0 truncate leading-[1.45]">Back to orders</span>
            </Link>
            <Link to="/shop" className="kicks-btn kicks-btn-primary kicks-btn-sm">
              <span className="min-w-0 truncate leading-[1.45]">Continue shopping</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';
  const paymentMethod = order.paymentId ? 'Razorpay' : 'Payment pending';
  const orderStatus = order.status || 'PENDING';
  const paymentStatus = order.paymentStatus || 'PENDING';
  const paymentStatusDot = paymentStatus === 'PAID'
    ? 'bg-[#7de7b3]'
    : paymentStatus === 'FAILED'
      ? 'bg-[#ff9a9a]'
      : 'bg-[#ffc800]';

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-4 sm:pt-6">
      <PageMeta title="Order details | AJ SPORTS" description="Order details" />

      {/* Top navigation */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <Link
          to="/account/orders"
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#b0b0b0] transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Orders
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white">AJ SPORTS</span>
      </div>

      {/* Order header */}
      <header className="flex items-start justify-between gap-3 pt-4">
        <div className="min-w-0">
          <h1 className="break-all text-[22px] font-black leading-[1.1] tracking-[-0.03em] text-white sm:text-[26px]">
            {order.orderNumber || order._id || id}
          </h1>
          <p className="mt-1 text-[11px] tracking-[0.04em] text-[#8d8d8d]">Placed {orderDate}</p>
        </div>
        <OrderStatusBadge status={orderStatus} />
      </header>

      {/* Order progress */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-[#111111] px-3 py-4 sm:px-5">
        <OrderProgress status={orderStatus} />
      </div>

      {/* Invoice + tracking */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {invoiceUnavailable ? (
          <button
            type="button"
            disabled
            title="Invoice is not available yet"
            className="kicks-btn kicks-btn-secondary kicks-btn-sm w-full"
          >
            <span className="min-w-0 truncate leading-[1.45]">Invoice unavailable</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => invoiceMutation.mutate(order._id || id)}
            disabled={invoiceMutation.isPending}
            className="kicks-btn kicks-btn-secondary kicks-btn-sm w-full disabled:cursor-wait disabled:opacity-60"
          >
            {invoiceMutation.isPending
              ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
              : <FileText size={14} className="shrink-0" aria-hidden="true" />}
            <span className="min-w-0 truncate leading-[1.45]">
              {invoiceMutation.isPending ? 'Downloading...' : 'Download invoice'}
            </span>
          </button>
        )}

        {trackingQuery.isLoading ? (
          <button type="button" disabled className="kicks-btn kicks-btn-secondary kicks-btn-sm w-full">
            <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
            <span className="min-w-0 truncate leading-[1.45]">Checking tracking...</span>
          </button>
        ) : trackingUrl ? (
          <button
            type="button"
            onClick={() => window.open(trackingUrl, '_blank', 'noopener,noreferrer')}
            className="kicks-btn kicks-btn-secondary kicks-btn-sm w-full"
          >
            <span className="min-w-0 truncate leading-[1.45]">Track order</span>
            <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            title={trackingQuery.isError ? 'Tracking is temporarily unavailable' : 'Tracking not available yet'}
            className="kicks-btn kicks-btn-secondary kicks-btn-sm w-full"
          >
            <span className="min-w-0 truncate leading-[1.45]">
              {trackingQuery.isError ? 'Tracking unavailable' : 'Not available yet'}
            </span>
          </button>
        )}
      </div>

      {/* Payment */}
      <section className="mt-4" aria-label="Payment">
        <OrderSectionLabel>Payment</OrderSectionLabel>
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">Status</span>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-white">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${paymentStatusDot}`} aria-hidden="true" />
              <span className="truncate">{humanizeStatus(paymentStatus, 'Pending')}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">Method</span>
            <span className="min-w-0 truncate text-[13px] font-semibold text-white">{paymentMethod}</span>
          </div>
        </div>
      </section>

      {/* Product */}
      <section className="mt-4" aria-label="Product">
        <OrderSectionLabel>Product</OrderSectionLabel>
        <div className="space-y-2">
          {items.map((item) => {
            const image = orderItemImage(item);
            const unitPrice = Number(item.unitPrice || item.finalPrice || 0);
            const quantity = Number(item.quantity || 1);
            const lineTotal = Number(unitPrice * quantity);

            return (
              <article
                key={item._id || item.variantId || item.productId}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#111111] p-3"
              >
                <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d] sm:h-20 sm:w-20">
                  <img
                    src={image}
                    alt={item.productName || 'Ordered product'}
                    loading="lazy"
                    className="h-full w-full object-contain"
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-[13px] font-semibold leading-snug text-white sm:text-sm">
                    {item.productName || item.name || 'AJ SPORTS product'}
                  </h3>
                  <p className="mt-1 truncate text-[11px] text-[#8d8d8d]">
                    {item.size || 'Size N/A'} • {item.color || 'Color N/A'}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-[#c9c9c9]">Qty {quantity}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="whitespace-nowrap text-[11px] text-[#8d8d8d]">{formatMoney(unitPrice)} each</span>
                  <span className="whitespace-nowrap text-[14px] font-bold text-white">{formatMoney(lineTotal)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Totals */}
      <section className="mt-4" aria-label="Summary">
        <OrderSectionLabel>Summary</OrderSectionLabel>
        <div className="rounded-2xl border border-white/10 bg-[#111111] px-4 py-3">
          <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
            <span className="text-[#8d8d8d]">Subtotal</span>
            <span className="text-[#d9d9d9]">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
            <span className="text-[#8d8d8d]">Discount</span>
            <span className="text-[#d9d9d9]">{formatMoney(discount)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
            <span className="text-[#8d8d8d]">Shipping</span>
            <span className="text-[#d9d9d9]">{shippingCharge === 0 ? 'Free' : formatMoney(shippingCharge)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
            <span className="text-[#8d8d8d]">Tax</span>
            <span className="text-[#d9d9d9]">{formatMoney(tax)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Total</span>
            <span className="text-[17px] font-black tracking-[-0.02em] text-white">{formatMoney(total)}</span>
          </div>
        </div>
      </section>

      {/* Shipping information */}
      <section className="mt-4" aria-label="Shipping information">
        <OrderSectionLabel>Shipping</OrderSectionLabel>
        <div className="rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-[13px] leading-relaxed text-[#c4c4c4]">
          <p className="font-semibold text-white">{shippingAddress.firstName || ''} {shippingAddress.lastName || ''}</p>
          <p className="text-[#8d8d8d]">{shippingAddress.phone || 'Phone unavailable'}</p>
          <p className="mt-1 break-words">{shippingAddress.addressLine1 || shippingAddress.address || 'Address unavailable'}</p>
          {shippingAddress.addressLine2 && <p className="break-words">{shippingAddress.addressLine2}</p>}
          <p className="break-words">{[shippingAddress.city, shippingAddress.state, shippingAddress.postalCode].filter(Boolean).join(', ') || 'Location unavailable'}</p>
          <p>{shippingAddress.country || 'India'}</p>
        </div>
      </section>

      {/* Bottom actions */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link to="/account/orders" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
          <span className="min-w-0 truncate leading-[1.45]">Back to orders</span>
        </Link>
        <Link to="/shop" className="kicks-btn kicks-btn-primary kicks-btn-sm">
          <span className="min-w-0 truncate leading-[1.45]">Continue shopping</span>
        </Link>
      </div>
    </div>
  );
}

function AccountOverviewSection({ user, onNavigate }) {
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: () => ordersApi.listForUser() });
  const addressesQuery = useQuery({ queryKey: ['addresses'], queryFn: () => addressesApi.list() });
  const wishlistQuery = useQuery({ queryKey: ['wishlist'], queryFn: () => wishlistApi.getWishlist() });

  const orders = unwrapPayload(ordersQuery.data)?.orders ?? [];
  const addresses = unwrapPayload(addressesQuery.data)?.addresses ?? [];
  const wishlistPayload = unwrapPayload(wishlistQuery.data);
  const wishlist = wishlistPayload?.wishlist ?? [];
  const wishlistItems = Array.isArray(wishlist) ? wishlist : wishlist?.productIds ?? wishlist?.items ?? [];
  const wishlistCount = Array.isArray(wishlistItems) ? wishlistItems.length : 0;

  const loading = ordersQuery.isLoading || addressesQuery.isLoading || wishlistQuery.isLoading;
  const recentOrder = [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0] || null;
  const initials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'K';

  const cards = [
    {
      id: 'orders',
      label: 'Total Orders',
      value: loading ? '—' : String(orders.length),
      detail: recentOrder ? `Latest: ${recentOrder.orderNumber || 'recent order'}` : 'No orders yet',
      icon: Package,
    },
    {
      id: 'orders',
      label: 'Recent Order',
      value: loading ? '—' : recentOrder ? formatMoney(recentOrder.grandTotal || recentOrder.total || 0) : '—',
      detail: recentOrder ? `${recentOrder.status || 'PENDING'} • ${recentOrder.createdAt ? new Date(recentOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'recent'}` : 'Nothing purchased yet',
      icon: ShoppingBag,
    },
    {
      id: 'addresses',
      label: 'Saved Addresses',
      value: loading ? '—' : String(addresses.length),
      detail: defaultAddress ? `${defaultAddress.city || ''}${defaultAddress.city ? ', ' : ''}${defaultAddress.postalCode || ''}`.trim() || 'Default set' : 'None saved',
      icon: MapPin,
    },
    {
      id: 'profile',
      label: 'Wishlist',
      value: loading ? '—' : String(wishlistCount),
      detail: wishlistCount === 1 ? '1 saved item' : `${wishlistCount} saved items`,
      icon: Heart,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#181818] text-2xl font-black text-white sm:h-20 sm:w-20 sm:text-3xl" aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#181818] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#9feec8]">
                  <Check size={11} /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-[#181818] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#a0a0a0]">
                  Unverified
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-white/10 bg-[#181818] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#a0a0a0]">
                Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Active'}
              </span>
            </div>
            <h2 className="mt-2 truncate text-xl font-black uppercase tracking-[-0.04em] text-white sm:text-2xl">
              {user?.firstName || 'Customer'} {user?.lastName || ''}
            </h2>
            <p className="mt-1 truncate text-sm text-[#a1a1a1]">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="kicks-btn kicks-btn-secondary kicks-btn-sm w-fit shrink-0"
          >
            View profile <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={`${card.id}-${card.label}`}
              type="button"
              onClick={() => onNavigate(card.id)}
              className="rounded-[20px] border border-white/10 bg-[#111111] p-4 text-left transition hover:border-white/25 hover:bg-[#141414] focus:outline-none focus:ring-2 focus:ring-white/60 sm:p-5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#181818] text-white" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="mt-3 block text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">{card.label}</span>
              <span className="mt-1 block truncate text-xl font-bold text-white sm:text-2xl">{card.value}</span>
              <span className="mt-1 block truncate text-xs text-[#a0a0a0]">{card.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccountProfileSection({ user }) {
  const initials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'K';
  const details = [
    { label: 'First name', value: user?.firstName || '—' },
    { label: 'Last name', value: user?.lastName || '—' },
    { label: 'Account email', value: user?.email || '—', truncate: true },
    { label: 'Phone number', value: user?.phone || 'Not provided' },
    { label: 'Account role', value: user?.role || 'CUSTOMER' },
    {
      label: 'Member since',
      value: user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : 'Active',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#181818] text-2xl font-black text-white" aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#181818] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">
              <Sparkles size={12} className="text-white" /> Verified Member
            </div>
            <h2 className="mt-2 truncate text-xl font-black uppercase tracking-[-0.04em] text-white sm:text-2xl">
              {user?.firstName || 'Customer'} {user?.lastName || ''}
            </h2>
            <p className="mt-1 truncate text-sm text-[#a1a1a1]">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {details.map((item) => (
          <div key={item.label} className="min-w-0 rounded-[20px] border border-white/10 bg-[#111111] p-4 sm:p-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">{item.label}</p>
            <p className={`mt-2 text-sm font-semibold text-white sm:text-base ${item.truncate ? 'truncate' : 'break-words'}`} title={item.truncate ? item.value : undefined}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountAddressesSection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressesApi.list(),
  });

  const addressSchema = z.object({
    firstName: z.string().min(2, 'First name required'),
    lastName: z.string().min(2, 'Last name required'),
    phone: z.string().regex(/^(\+91[\s-]?|91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
    addressLine1: z.string().min(3, 'Address line 1 required'),
    addressLine2: z.string().optional().or(z.literal('')),
    landmark: z.string().optional().or(z.literal('')),
    city: z.string().min(2, 'City required'),
    state: z.string().min(2, 'State required'),
    postalCode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
    country: z.string().default('India'),
    isDefault: z.boolean().default(false),
  });

  const { register, handleSubmit, reset, setValue, watch, getValues, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      isDefault: false,
    },
  });

  // Verified-pincode lookup state: { status, result }. The verified pincode
  // is the source of truth for state; conflicts must be corrected.
  const [pinLookup, setPinLookup] = useState({ status: 'idle', result: null });
  const watchedState = watch('state');
  const watchedCity = watch('city');
  const watchedPostalCode = watch('postalCode');

  const addresses = unwrapPayload(data)?.addresses ?? [];

  const createMutation = useMutation({
    mutationFn: (payload) => addressesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showToast('Address saved successfully.', 'success');
      resetForm();
    },
    onError: (err) => showToast(err?.message || 'Unable to save address.', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => addressesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showToast('Address updated successfully.', 'success');
      resetForm();
    },
    onError: (err) => showToast(err?.message || 'Unable to update address.', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => addressesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showToast('Address deleted.', 'success');
    },
    onError: (err) => showToast(err?.message || 'Unable to delete address.', 'error'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id) => addressesApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showToast('Default address updated.', 'success');
    },
    onError: (err) => showToast(err?.message || 'Unable to set default address.', 'error'),
  });

  const resetForm = () => {
    reset({
      firstName: '',
      lastName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      isDefault: false,
    });
    setIsAdding(false);
    setEditingAddressId(null);
    setPinLookup({ status: 'idle', result: null });
  };

  const handleEdit = (address) => {
    setIsAdding(true);
    setPinLookup({ status: 'idle', result: null });
    setEditingAddressId(address._id || address.id);
    setValue('firstName', address.firstName || '');
    setValue('lastName', address.lastName || '');
    setValue('phone', address.phone || '');
    setValue('addressLine1', address.addressLine1 || '');
    setValue('addressLine2', address.addressLine2 || '');
    setValue('landmark', address.landmark || '');
    setValue('city', address.city || '');
    setValue('state', address.state || '');
    setValue('postalCode', address.postalCode || '');
    setValue('country', address.country || 'India');
    setValue('isDefault', Boolean(address.isDefault));
  };

  const onSubmit = (values) => {
    if (pinLookup.status === 'invalid') {
      setError('postalCode', { type: 'manual', message: 'This pincode does not appear to exist. Please check the number.' });
      showToast('Please fix the highlighted pincode.', 'error');
      return;
    }
    if (pinLookup.status === 'checking') {
      showToast('Please wait while the pincode is being verified.', 'info');
      return;
    }
    const conflict = pincodeStateConflictMessage(pinLookup, values.state);
    if (conflict) {
      setError('state', { type: 'manual', message: conflict });
      showToast('Pincode and state do not match.', 'error');
      return;
    }
    if (editingAddressId) {
      updateMutation.mutate({ id: editingAddressId, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Delivery locations</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em] text-white">Address Book</h2>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="inline-flex items-center gap-2 kicks-btn kicks-btn-primary kicks-btn-sm transition hover:bg-[#e4e4e4]"
          >
            <Plus size={15} /> Add New Address
          </button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6 md:p-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-white">
              {editingAddressId ? 'Edit Address' : 'Add New Address'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d0d0d0] hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">First Name *</label>
                <input {...register('firstName')} placeholder="First name" className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
                {errors.firstName && <p className="mt-1 text-xs text-red-300">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Last Name *</label>
                <input {...register('lastName')} placeholder="Last name" className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
                {errors.lastName && <p className="mt-1 text-xs text-red-300">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-[#c0c0c0]">Phone Number *</label>
              <input {...register('phone')} placeholder="+91 98765 43210" className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
              {errors.phone && <p className="mt-1 text-xs text-red-300">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-xs text-[#c0c0c0]">Address Line 1 *</label>
              <input {...register('addressLine1')} placeholder="Flat / House No. / Building / Street" className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
              {errors.addressLine1 && <p className="mt-1 text-xs text-red-300">{errors.addressLine1.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Address Line 2 (Optional)</label>
                <input {...register('addressLine2')} placeholder="Apartment, suite, etc." className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Landmark (Optional)</label>
                <input {...register('landmark')} placeholder="Near Metro / Park" className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SearchableCombobox
                id="account-city"
                label="City"
                required
                value={watchedCity}
                onChange={(next) => setValue('city', next, { shouldValidate: true })}
                options={citySuggestions(watchedState, pinLookup.result?.city)}
                placeholder="City"
                error={errors.city?.message}
                hint={pinLookup.result?.city ? `Pincode city: ${pinLookup.result.city}` : ''}
              />
              <SearchableCombobox
                id="account-state"
                label="State"
                required
                value={watchedState}
                onChange={(next) => setValue('state', next, { shouldValidate: true })}
                options={INDIA_STATES}
                placeholder="State"
                error={errors.state?.message}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PincodeField
                id="account-postalCode"
                value={watchedPostalCode}
                onChange={(next) => setValue('postalCode', next, { shouldValidate: true })}
                onLookup={setPinLookup}
                onVerified={(found) => {
                  if (found?.state && !getValues('state')) setValue('state', found.state, { shouldValidate: true });
                  if (found?.city && !getValues('city')) setValue('city', found.city, { shouldValidate: true });
                }}
                error={errors.postalCode?.message}
              />
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Country *</label>
                <input {...register('country')} placeholder="Country" className="w-full kicks-field text-sm text-white outline-none focus:border-white/30" />
              </div>
            </div>

            <label className="flex items-center gap-3 pt-2 text-sm text-[#d4d4d4]">
              <input type="checkbox" {...register('isDefault')} className="h-4 w-4 rounded accent-white" />
              <span>Make this my default shipping address</span>
            </label>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center gap-2 kicks-btn kicks-btn-primary kicks-btn-sm transition hover:bg-[#e4e4e4] disabled:opacity-60"
              >
                {(isSubmitting || createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                {editingAddressId ? 'Update Address' : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="kicks-btn kicks-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-[20px] bg-[#111111]" />
          <div className="h-40 animate-pulse rounded-[20px] bg-[#111111]" />
        </div>
      ) : isError ? (
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-8 text-center text-[#d2d2d2]">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
          <p>Unable to load addresses right now.</p>
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-6 text-center sm:p-10">
          <MapPin size={32} className="mx-auto text-[#666666]" />
          <h3 className="mt-3 text-lg font-bold text-white">No addresses saved</h3>
          <p className="mt-1 text-sm text-[#a0a0a0]">Add a delivery address to speed up checkout.</p>
          <button
            type="button"
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="mt-5 inline-flex items-center gap-2 kicks-btn kicks-btn-primary kicks-btn-sm"
          >
            <Plus size={14} /> Add Address
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => {
            const addressId = address._id || address.id;
            return (
              <div key={addressId} className="relative flex flex-col justify-between rounded-[20px] border border-white/10 bg-[#111111] p-5 transition hover:border-white/20">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-white">
                      {address.firstName} {address.lastName}
                    </h3>
                    {address.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                        <Check size={10} /> Default
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#c4c4c4]">
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                    {address.landmark ? ` (Near: ${address.landmark})` : ''}
                  </p>
                  <p className="text-sm text-[#c4c4c4]">
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                  <p className="text-sm text-[#8a8a8a]">{address.country || 'India'}</p>
                  <p className="mt-2 text-xs font-medium text-[#d0d0d0]">Phone: {address.phone}</p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => handleEdit(address)}
                    className="kicks-btn kicks-btn-dark kicks-btn-sm"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMutation.mutate(addressId)}
                      disabled={setDefaultMutation.isPending}
                      className="kicks-btn kicks-btn-secondary kicks-btn-sm"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this address?')) {
                        removeMutation.mutate(addressId);
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="kicks-btn kicks-btn-danger kicks-btn-sm ml-auto"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountOrdersSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.listForUser(),
  });

  const orders = unwrapPayload(data)?.orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Purchases & History</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em] text-white">My Orders</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-[20px] bg-[#111111]" />
          <div className="h-32 animate-pulse rounded-[20px] bg-[#111111]" />
        </div>
      ) : isError ? (
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-8 text-center text-[#d2d2d2]">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
          <p>Unable to load your orders right now.</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-6 text-center sm:p-10">
          <Package size={32} className="mx-auto text-[#666666]" />
          <h3 className="mt-3 text-lg font-bold text-white">No orders yet</h3>
          <p className="mt-1 text-sm text-[#a0a0a0]">Explore our catalog and find your next favorite pair.</p>
          <Link
            to="/shop"
            className="mt-5 inline-flex items-center gap-2 kicks-btn kicks-btn-primary kicks-btn-sm"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderId = order._id || order.id;
            const orderDate = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Recent';
            const items = Array.isArray(order.items) ? order.items : [];
            const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
            const totalAmount = Number(order.grandTotal || order.total || 0);

            return (
              <div key={orderId} className="rounded-[20px] border border-white/10 bg-[#111111] p-5 transition hover:border-white/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {items.length > 0 && (
                      <div aria-hidden="true" className="flex shrink-0 items-center pt-0.5">
                        {items.slice(0, 3).map((item, idx) => (
                          <span
                            key={item._id || item.variantId || idx}
                            className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#0d0d0d] sm:h-14 sm:w-14 ${idx > 0 ? '-ml-3' : ''}`}
                          >
                            <img
                              src={orderItemImage(item)}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain"
                              onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }}
                            />
                          </span>
                        ))}
                        {items.length > 3 && (
                          <span className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#1c1c1c] text-[11px] font-bold text-white sm:h-14 sm:w-14">
                            +{items.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.2em] text-[#8d8d8d]">Order</span>
                        <span className="truncate font-bold text-white">{order.orderNumber || orderId}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#a0a0a0]">
                        <span>{orderDate}</span>
                        <span>•</span>
                        <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                        <span>•</span>
                        <span>{formatMoney(totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses[order.status] || statusClasses.DEFAULT}`}>
                      {order.status || 'PENDING'}
                    </span>
                    <Link
                      to={`/account/orders/${orderId}`}
                      className="kicks-btn kicks-btn-dark kicks-btn-sm"
                    >
                      View Order <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                    {items.slice(0, 3).map((item, idx) => (
                      <span key={item._id || item.variantId || idx} className="rounded-lg border border-white/5 bg-[#161616] px-2.5 py-1 text-xs text-[#d0d0d0]">
                        {item.productName || item.name} <span className="text-[#888888]">×{item.quantity || 1}</span>
                      </span>
                    ))}
                    {items.length > 3 && (
                      <span className="rounded-lg border border-white/5 bg-[#161616] px-2 py-1 text-xs text-[#888888]">
                        +{items.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountPasswordSection() {
  const { showToast } = useToast();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const forgotHref = user?.email ? `/forgot-password?email=${encodeURIComponent(user.email)}` : '/forgot-password';
  const passwordChangeSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values) => {
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      showToast('Password changed successfully.', 'success');
      reset();
    } catch (error) {
      showToast(error?.message || 'Unable to update password. Please check your current password.', 'error');
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm('Sign out on all devices, including this one? You will need to log in again.')) return;
    try {
      await authApi.logoutAll();
    } catch (error) {
      showToast(error?.message || 'Unable to sign out everywhere.', 'error');
      return;
    }
    showToast('Signed out everywhere. Please log in again.', 'success');
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Security Settings</p>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em] text-white">Change Password</h2>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6 md:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <PasswordField
            label="Current Password"
            name="currentPassword"
            register={register}
            error={errors.currentPassword?.message}
            placeholder="Enter current password"
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <PasswordField
              label="New Password"
              name="newPassword"
              register={register}
              error={errors.newPassword?.message}
              placeholder="Minimum 8 characters"
            />

            <PasswordField
              label="Confirm New Password"
              name="confirmPassword"
              register={register}
              error={errors.confirmPassword?.message}
              placeholder="Confirm new password"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <span className="text-sm text-[#a8a8a8]">Can&apos;t remember your current password?</span>
            <Link to={forgotHref} className="text-sm font-bold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
              Forgot your current password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5 sm:p-6">
        <h3 className="text-base font-bold text-white sm:text-lg">Active sessions</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#a8a8a8]">
          Signed in on another phone or computer? End every session at once. You will be signed out here too and need to log in again.
        </p>
        <button
          type="button"
          onClick={signOutEverywhere}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] border border-red-500/30 px-4 h-9 text-xs font-semibold text-red-200 transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
        >
          <LogOut size={14} /> Sign out everywhere
        </button>
      </div>
    </div>
  );
}

function AccountPage({ initialTab }) {
  const { user, logout, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const activeTab = searchParams.get('tab') || initialTab || 'overview';

  const setTab = (tab) => {
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  // Hide the mobile bottom nav while the keyboard is open so forms stay usable.
  useEffect(() => {
    const onFocusIn = (event) => {
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        setKbOpen(true);
      }
    };
    const onFocusOut = () => setKbOpen(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
      showToast('Signed out. See you soon.', 'success');
      navigate('/', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-12 lg:px-8">
        <div className="h-64 animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'security', label: 'Security', icon: KeyRound },
    { id: 'profile', label: 'Profile', icon: User2 },
  ];

  const initials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'K';

  const navButtonClass = (isActive) => `flex shrink-0 items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-white/60 ${
    isActive ? 'bg-white text-black' : 'text-[#a0a0a0] hover:bg-white/5 hover:text-white'
  }`;

  const validTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'overview';

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-10 lg:px-8">
      <PageMeta title="My Account | AJ SPORTS" description="Manage your AJ SPORTS customer account and preferences" />

      <div className="mb-6 sm:mb-8">
        <p className="kicks-eyebrow">Customer Center</p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white sm:text-3xl md:text-4xl">
          My Account
        </h1>
      </div>

      {/* Mobile profile summary */}
      <div className="mb-4 rounded-[24px] border border-white/10 bg-[#111111] p-4 sm:p-5 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#181818] text-lg font-black text-white" aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-white">
              {user?.firstName || 'Customer'} {user?.lastName || ''}
            </p>
            <p className="truncate text-xs text-[#a1a1a1]">{user?.email}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${user?.emailVerified ? 'border-white/10 text-[#9feec8]' : 'border-white/10 text-[#a0a0a0]'}`}>
            {user?.emailVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>
      </div>

      {/* Mobile bottom navigation (replaces the scrollable pill row) */}
      <nav
        aria-label="Account sections"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0b0b]/92 backdrop-blur-md transition-transform duration-200 ease-out lg:hidden ${kbOpen ? 'translate-y-full' : 'translate-y-0'}`}
      >
        <div className="grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = validTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 pb-2.5 pt-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]/60 ${
                  isActive ? 'text-white' : 'text-[#7d7d7d] active:text-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-8 top-0 h-[2px] rounded-full transition ${isActive ? 'bg-[#FFC800] shadow-[0_0_8px_rgba(255,200,0,0.7)]' : 'bg-transparent'}`}
                />
                <Icon size={19} aria-hidden="true" className={isActive ? 'text-[#FFC800]' : ''} />
                <span className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${isActive ? 'text-white' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="hidden h-fit rounded-[24px] border border-white/10 bg-[#111111] p-3 lg:block">
          <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#151515] p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#181818] text-lg font-black text-white" aria-hidden="true">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {user?.firstName || 'Customer'} {user?.lastName || ''}
              </p>
              <p className="truncate text-xs text-[#a1a1a1]">{user?.email}</p>
            </div>
          </div>

          <p className="px-2 pb-2 pt-4 text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Account</p>
          <nav aria-label="Account sections" className="flex flex-col gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = validTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={navButtonClass(isActive)}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="my-3 border-t border-white/10" />

          <div className="flex flex-col gap-1.5">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <ExternalLink size={16} />
              <span>Storefront</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#f0a8a8] transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Section Content */}
        <main className="min-w-0">
          {validTab === 'overview' && <AccountOverviewSection user={user} onNavigate={setTab} />}
          {validTab === 'profile' && <AccountProfileSection user={user} />}
          {validTab === 'addresses' && <AccountAddressesSection />}
          {validTab === 'orders' && <AccountOrdersSection />}
          {validTab === 'security' && <AccountPasswordSection />}
        </main>
      </div>

      {/* Mobile logout */}
      <div className="mt-6 lg:hidden">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          aria-label="Log out of your account"
          className="kicks-btn kicks-btn-danger w-full"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>

      {/* Spacer so page content is never hidden behind the fixed bottom nav */}
      <div aria-hidden="true" className="h-[76px] lg:hidden" />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onClick={() => { if (!loggingOut) setShowLogoutConfirm(false); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#141414] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-200" aria-hidden="true">
              <LogOut size={20} />
            </div>
            <h2 id="logout-dialog-title" className="mt-4 text-center text-xl font-bold text-white">Log out?</h2>
            <p className="mt-2 text-center text-sm text-[#a8a8a8]">Are you sure you want to log out?</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="kicks-btn kicks-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                disabled={loggingOut}
                aria-label="Confirm log out"
                className="kicks-btn kicks-btn-primary"
              >
                {loggingOut ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      const payload = await login(values);
      const signedInUser = payload?.data?.user || payload?.user || null;
      showToast('Welcome back. You are signed in.', 'success');
      if (isAdminRole(signedInUser?.role)) {
        const target = adminAppUrl('/admin');
        if (target) {
          window.location.assign(target);
          return;
        }
      }
      navigate(isAdminRole(signedInUser?.role) ? '/admin' : '/account', { replace: true });
    } catch (error) {
      showToast(error?.message || 'Login failed. Please check your credentials.', 'error');
    }
  };

  if (isAuthenticated) {
    if (isAdmin) {
      const target = adminAppUrl('/admin');
      if (target) {
        window.location.assign(target);
        return null;
      }
    }
    return <Navigate to={isAdmin ? '/admin' : '/account'} replace />;
  }

  return (
    <div className="mx-auto max-w-[600px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Login | AJ SPORTS" description="Login to your AJ SPORTS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <p className="kicks-eyebrow">Welcome back</p>
        <h1 className="mt-4 kicks-section-title">Login</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
            <input {...register('email')} className="w-full kicks-field text-white outline-none transition focus:border-white/25" placeholder="you@example.com" />
            {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
          </div>

          <PasswordField
            label="Password"
            name="password"
            register={register}
            error={errors.password?.message}
            placeholder="Your password"
          />

          <button disabled={isSubmitting} type="submit" className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>

          <div className="flex items-center justify-between text-sm text-[#c4c4c4]">
            <Link to="/register">Create account</Link>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function RegisterPage() {
  const { isAuthenticated, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [phase, setPhase] = useState('form');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rawIdentifier, setRawIdentifier] = useState('');
  const [maskedTarget, setMaskedTarget] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const { register, handleSubmit, setValue, setError, formState: { errors } } = useForm({
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (values) => {
    setFormError('');
    // Browser autofill can fill the DOM without firing input events, leaving
    // the captured RHF submit object stale. Build fresh live values from the
    // DOM and use them for validation and the API payload below.
    const liveValues = {
      ...values,
      fullName: document.getElementById('register-fullname')?.value ?? values.fullName,
      email: document.getElementById('register-email')?.value ?? values.email,
      password: document.getElementById('password')?.value ?? values.password,
      confirmPassword: document.getElementById('confirmPassword')?.value ?? values.confirmPassword,
    };
    setValue('fullName', liveValues.fullName, { shouldDirty: true });
    setValue('email', liveValues.email, { shouldDirty: true });
    setValue('password', liveValues.password, { shouldDirty: true });
    setValue('confirmPassword', liveValues.confirmPassword, { shouldDirty: true });
    const parsed = registerEmailSchema.safeParse(liveValues);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === 'string') setError(field, { type: 'manual', message: issue.message });
      });
      showToast('Please check the highlighted fields.', 'error');
      return;
    }
    const data = parsed.data;
    const payload = {
      name: data.fullName.trim(),
      email: data.email.trim(),
      password: data.password,
      confirmPassword: data.confirmPassword,
    };

    setSubmitting(true);
    try {
      const response = await authApi.register(payload);
      const result = response?.data ?? response ?? {};
      setRawIdentifier(payload.email.toLowerCase());
      setMaskedTarget(result.identifier || '');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      setCooldown(Number(result.resendAfterSeconds) || 60);
      setPhase('otp');
      showToast('Code sent to your email.', 'success');
    } catch (error) {
      const fieldErrors = (error?.errors || [])
        .map((message) => ({ field: getRegistrationFieldError(message), message }))
        .filter(({ field }) => field);
      fieldErrors.forEach(({ field, message }) => setError(field, { type: 'server', message }));
      setFormError(getRegistrationErrorMessage(error));
      showToast(getRegistrationErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const focusOtpBox = (index) => {
    if (typeof document === 'undefined') return;
    const box = document.getElementById(`register-otp-${index}`);
    if (box) box.focus();
  };

  const handleOtpChange = (index, value) => {
    const digit = String(value || '').replace(/\D/g, '').slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    setOtpError('');
    if (digit && index < 5) focusOtpBox(index + 1);
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) focusOtpBox(index - 1);
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const digits = String(event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;
    setOtpDigits((current) => current.map((_, index) => digits[index] || ''));
    setOtpError('');
    focusOtpBox(Math.min(digits.length, 5));
  };

  const onVerify = async (event) => {
    event.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Enter the 6-digit code.');
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      await authApi.verifyRegistrationOtp({ identifier: rawIdentifier, code });
      showToast('Account verified. Welcome to AJ SPORTS.', 'success');
      window.location.href = '/account';
    } catch (error) {
      setOtpError(error?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setOtpError('');
    try {
      const response = await authApi.resendRegistrationOtp({ identifier: rawIdentifier });
      const result = response?.data ?? response ?? {};
      setCooldown(Number(result.resendAfterSeconds) || 60);
      setOtpDigits(['', '', '', '', '', '']);
      showToast('A new code was sent.', 'success');
      focusOtpBox(0);
    } catch (error) {
      setOtpError(error?.message || 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  const backToForm = (event) => {
    event.preventDefault();
    setPhase('form');
    setOtpError('');
  };

  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/account'} replace />;

  return (
    <div className="mx-auto max-w-[600px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Register | AJ SPORTS" description="Create an AJ SPORTS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <p className="kicks-eyebrow">Start here</p>
        <h1 className="mt-4 kicks-section-title">Create account</h1>

        {phase === 'form' ? (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]" htmlFor="register-fullname">Full name</label>
              <input id="register-fullname" {...register('fullName')} autoComplete="name" className="w-full kicks-field text-white outline-none transition focus:border-white/25" placeholder="Aisha Patel" />
              {errors.fullName && <p className="mt-2 text-sm text-red-300">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]" htmlFor="register-email">Email address</label>
              <input id="register-email" {...register('email')} type="email" autoComplete="email" className="w-full kicks-field text-white outline-none transition focus:border-white/25" placeholder="you@example.com" />
              {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
            </div>

            <PasswordField label="Password" name="password" register={register} error={errors.password?.message} placeholder="Create a password (min 8 characters)" />
            <PasswordField label="Confirm password" name="confirmPassword" register={register} error={errors.confirmPassword?.message} placeholder="Repeat your password" />

            {formError && <p role="alert" className="rounded-[14px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p>}

            <button type="submit" className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting}>
              {submitting ? 'Sending code...' : 'Create account'}
            </button>

            <div className="text-center text-sm text-[#c4c4c4]">
              Already have an account? <Link to="/login" className="text-white underline">Login</Link>
            </div>
          </form>
        ) : (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white">
              Verify email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#a8a8a8]">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-white">{maskedTarget || 'your device'}</span>.
            </p>

            <form onSubmit={onVerify} className="mt-6">
              <div className="flex justify-between gap-1.5 sm:gap-2" role="group" aria-label="6-digit verification code">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    id={`register-otp-${index}`}
                    value={digit}
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    onPaste={handleOtpPaste}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Digit ${index + 1}`}
                    maxLength={1}
                    className="h-12 min-w-0 flex-1 rounded-[10px] border border-white/10 bg-[#181818] text-center text-lg font-bold text-white outline-none transition focus:border-white/40"
                  />
                ))}
              </div>

              {otpError && <p role="alert" className="mt-3 rounded-[14px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{otpError}</p>}

              <button type="submit" disabled={verifying} className="mt-5 w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-wait disabled:opacity-60">
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
              {cooldown > 0 ? (
                <span className="text-[#8d8d8d]" aria-live="polite">
                  Resend code in 00:{String(cooldown).padStart(2, '0')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resending}
                  className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white disabled:opacity-60"
                >
                  {resending ? 'Sending...' : 'Resend OTP'}
                </button>
              )}
              <a href="/register" onClick={backToForm} className="text-[#a8a8a8] underline decoration-white/20 underline-offset-4 hover:text-white">
                Use a different email
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Parses "Resend available in N seconds." with a safe fallback (the shared
// error middleware only forwards status + message, not extra fields).
const parseCooldownSeconds = (message, fallback = 60) => {
  const match = String(message || '').match(/(\d+)\s*seconds?/i);
  const seconds = match ? Number(match[1]) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : fallback;
};

const errorStatus = (error) => error?.status ?? error?.response?.status ?? 0;

// Reusable email-OTP password reset flow shared by Login and Account Center.
// Phases: email -> otp -> password, then redirect to Login. Every async
// action clears its loading state in finally — the UI never hangs.
function PasswordResetFlow({ initialEmail = '' }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [phase, setPhase] = useState('email');
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');
  const [masked, setMasked] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const resetPasswordSchema = z.object({
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
  const passwordForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const normalizedEmail = String(email || '').trim().toLowerCase();

  const onSendOtp = async (event) => {
    event.preventDefault();
    if (!z.string().email('Valid email required').safeParse(normalizedEmail).success) {
      setEmailError('Valid email required');
      return;
    }
    setEmailError('');
    setSending(true);
    try {
      const response = await authApi.requestPasswordReset({ email: normalizedEmail });
      const result = response?.data ?? response ?? {};
      setMasked(result.identifier || '');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      setCooldown(Number(result.resendAfterSeconds) || 60);
      setPhase('otp');
      showToast('If an account exists for this email, a verification code has been sent.', 'success');
    } catch (error) {
      showToast(error?.message || 'Could not send the verification code.', 'error');
    } finally {
      setSending(false);
    }
  };

  const focusResetOtpBox = (index) => {
    if (typeof document === 'undefined') return;
    const box = document.getElementById(`reset-otp-${index}`);
    if (box) box.focus();
  };

  const handleResetOtpChange = (index, value) => {
    const digit = String(value || '').replace(/\D/g, '').slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    setOtpError('');
    if (digit && index < 5) focusResetOtpBox(index + 1);
  };

  const handleResetOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) focusResetOtpBox(index - 1);
  };

  const handleResetOtpPaste = (event) => {
    event.preventDefault();
    const digits = String(event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;
    setOtpDigits((current) => current.map((_, index) => digits[index] || ''));
    setOtpError('');
    focusResetOtpBox(Math.min(digits.length, 5));
  };

  const onVerifyOtp = async (event) => {
    event.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Enter the 6-digit code.');
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      const response = await authApi.verifyPasswordResetOtp({ email: normalizedEmail, code });
      const result = response?.data ?? response ?? {};
      if (!result.resetToken) throw new Error('Verification failed. Please try again.');
      setResetToken(result.resetToken);
      setPhase('password');
      showToast('Code verified. Choose a new password.', 'success');
    } catch (error) {
      setOtpError(error?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const response = await authApi.resendPasswordResetOtp({ email: normalizedEmail });
      const result = response?.data ?? response ?? {};
      setMasked(result.identifier || masked);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      setCooldown(Number(result.resendAfterSeconds) || 60);
      showToast('A new code was sent.', 'success');
    } catch (error) {
      if (errorStatus(error) === 429) setCooldown(parseCooldownSeconds(error?.message));
      showToast(error?.message || 'Could not resend the code.', 'error');
    } finally {
      setResending(false);
    }
  };

  const onResetPassword = async (values) => {
    try {
      await authApi.confirmPasswordReset({
        email: normalizedEmail,
        resetToken,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      showToast('Password reset successfully. Please log in again.', 'success');
      try {
        await logout();
      } finally {
        navigate('/login', { replace: true });
      }
    } catch (error) {
      showToast(error?.message || 'Could not reset the password.', 'error');
    }
  };

  if (phase === 'otp') {
    return (
      <div>
        <p className="text-sm text-[#d0d0d0]">
          Enter the 6-digit code{masked ? <> sent to <span className="font-semibold text-white">{masked}</span></> : ' sent to your email'}.
        </p>
        <form onSubmit={onVerifyOtp} className="mt-5">
          <div className="flex gap-1.5 sm:gap-2" role="group" aria-label="Enter the 6-digit verification code">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                id={`reset-otp-${index}`}
                value={digit}
                onChange={(event) => handleResetOtpChange(index, event.target.value)}
                onKeyDown={(event) => handleResetOtpKeyDown(index, event)}
                onPaste={handleResetOtpPaste}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={`Digit ${index + 1}`}
                maxLength={1}
                className="h-12 min-w-0 flex-1 rounded-[10px] border border-white/10 bg-[#181818] text-center text-lg font-bold text-white outline-none transition focus:border-white/40"
              />
            ))}
          </div>

          {otpError && <p role="alert" className="mt-3 rounded-[14px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{otpError}</p>}

          <button type="submit" disabled={verifying} className="mt-5 w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-wait disabled:opacity-60">
            {verifying ? 'Verifying...' : 'Verify code'}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          {cooldown > 0 ? (
            <span className="text-[#8d8d8d]" aria-live="polite">
              Resend code in 00:{String(cooldown).padStart(2, '0')}
            </span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white disabled:opacity-60"
            >
              {resending ? 'Sending...' : 'Resend OTP'}
            </button>
          )}
          <button type="button" onClick={() => { setPhase('email'); setOtpError(''); }} className="text-[#a8a8a8] underline decoration-white/20 underline-offset-4 hover:text-white">
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'password') {
    const { register: resetRegister, handleSubmit: handleResetSubmit, formState: { errors: resetErrors, isSubmitting: isResetting } } = passwordForm;
    return (
      <form onSubmit={handleResetSubmit(onResetPassword)} className="space-y-5">
        <PasswordField
          label="New Password"
          name="newPassword"
          register={resetRegister}
          error={resetErrors.newPassword?.message}
          placeholder="Minimum 8 characters"
        />
        <PasswordField
          label="Confirm New Password"
          name="confirmPassword"
          register={resetRegister}
          error={resetErrors.confirmPassword?.message}
          placeholder="Confirm new password"
        />
        <button type="submit" disabled={isResetting} className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">
          {isResetting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSendOtp} className="space-y-5" noValidate>
      <div>
        <label htmlFor="reset-email" className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
        <input
          id="reset-email"
          type="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setEmailError(''); }}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full kicks-field text-white outline-none transition focus:border-white/25"
        />
        {emailError && <p className="mt-2 text-sm text-red-300">{emailError}</p>}
      </div>
      <button type="submit" disabled={sending} className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">
        {sending ? 'Sending...' : 'Send OTP'}
      </button>
    </form>
  );
}

function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const prefill = searchParams.get('email') || '';
  return (
    <div className="mx-auto max-w-[520px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Forgot password | AJ SPORTS" description="Recover your AJ SPORTS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <p className="kicks-eyebrow">Account</p>
        <h1 className="mt-4 kicks-section-title">Forgot password</h1>
        <div className="mt-8">
          <PasswordResetFlow key={prefill} initialEmail={prefill} />
        </div>
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({ password: z.string().min(8, 'Minimum 8 characters') })),
    defaultValues: { password: '' },
  });
  const [status, setStatus] = useState('');

  const onSubmit = async (values) => {
    try {
      await authApi.resetPassword({ token, password: values.password });
      setStatus('Password updated successfully.');
      showToast('Your password was updated.', 'success');
    } catch (error) {
      showToast(error?.message || 'Reset failed. Please request a new link.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-[520px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Reset password | AJ SPORTS" description="Set a new password" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <p className="kicks-eyebrow">Security</p>
        <h1 className="mt-4 kicks-section-title">Reset password</h1>
        {status ? (
          <p className="mt-6 text-[#d0d0d0]">{status}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <PasswordField
              label="New password"
              name="password"
              register={register}
              error={errors.password?.message}
              placeholder="Choose a new password"
            />
            <button type="submit" disabled={isSubmitting} className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Updating...' : 'Reset password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isLoading, isError, data } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => authApi.verifyEmail({ token }),
    enabled: Boolean(token),
  });

  let message = 'Verifying your account...';

  if (!token) {
    message = 'Verification token missing';
  } else if (isLoading) {
    message = 'Verifying your account...';
  } else if (isError) {
    message = 'Verification failed';
  } else if (data) {
    message = 'Email verified successfully.';
  }

  return (
    <div className="mx-auto max-w-[520px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Verify email | AJ SPORTS" description="Verify your account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <h1 className="kicks-section-title">Email verification</h1>
        <p className="mt-6 text-[#d1d1d1]">{message}</p>
      </div>
    </div>
  );
}

function ChangePasswordPage() {
  const { showToast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({ currentPassword: z.string().min(6), newPassword: z.string().min(8) })),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const [status, setStatus] = useState('');

  const onSubmit = async (values) => {
    try {
      await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setStatus('Password changed successfully.');
      showToast('Your password was changed.', 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to change your password.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-[520px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Change password | AJ SPORTS" description="Change your password" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <p className="kicks-eyebrow">Security</p>
        <h1 className="mt-4 kicks-section-title">Change password</h1>
        {status ? (
          <p className="mt-6 text-[#d0d0d0]">{status}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <PasswordField
              label="Current password"
              name="currentPassword"
              register={register}
              error={errors.currentPassword?.message}
              placeholder="Current password"
            />
            <PasswordField
              label="New password"
              name="newPassword"
              register={register}
              error={errors.newPassword?.message}
              placeholder="New password"
            />
            <button type="submit" disabled={isSubmitting} className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Updating...' : 'Update password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function AddressBookPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['addresses'], queryFn: () => addressesApi.list() });

  const addressSchema = z.object({
    firstName: z.string().min(2, 'First name required'),
    lastName: z.string().min(2, 'Last name required'),
    phone: z.string().regex(/^(\+91[\s-]?|91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
    addressLine1: z.string().min(3, 'Address required'),
    addressLine2: z.string().optional().or(z.literal('')),
    landmark: z.string().optional().or(z.literal('')),
    city: z.string().min(2, 'City required'),
    state: z.string().min(2, 'State required'),
    postalCode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
    country: z.string().default('India'),
    isDefault: z.boolean().default(false),
  });

  const { register, handleSubmit, reset, setValue, watch, getValues, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      isDefault: false,
    },
  });

  const [pinLookup, setPinLookup] = useState({ status: 'idle', result: null });
  const watchedState = watch('state');
  const watchedCity = watch('city');
  const watchedPostalCode = watch('postalCode');

  const onSubmitAddress = (values) => {
    if (pinLookup.status === 'invalid') {
      setError('postalCode', { type: 'manual', message: 'This pincode does not appear to exist. Please check the number.' });
      return;
    }
    if (pinLookup.status === 'checking') return;
    const conflict = pincodeStateConflictMessage(pinLookup, values.state);
    if (conflict) {
      setError('state', { type: 'manual', message: conflict });
      return;
    }
    createMutation.mutate(values);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => addressesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      reset();
      setPinLookup({ status: 'idle', result: null });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id) => addressesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id) => addressesApi.setDefault(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const addresses = unwrapPayload(data)?.addresses ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Addresses | AJ SPORTS" description="Manage delivery addresses" />
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <p className="kicks-eyebrow">Address book</p>
          <h1 className="mt-4 kicks-section-title">Add address</h1>
          <form onSubmit={handleSubmit(onSubmitAddress)} className="mt-8 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><input {...register('firstName')} placeholder="First name" className="w-full kicks-field text-white" />{errors.firstName && <p className="mt-2 text-sm text-red-300">{errors.firstName.message}</p>}</div>
              <div><input {...register('lastName')} placeholder="Last name" className="w-full kicks-field text-white" />{errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName.message}</p>}</div>
            </div>
            <input {...register('phone')} placeholder="Phone" className="w-full kicks-field text-white" />
            <input {...register('addressLine1')} placeholder="Address line 1" className="w-full kicks-field text-white" />
            <input {...register('addressLine2')} placeholder="Address line 2 (optional)" className="w-full kicks-field text-white" />
            <input {...register('landmark')} placeholder="Landmark (optional)" className="w-full kicks-field text-white" />
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableCombobox
                id="book-city"
                value={watchedCity}
                onChange={(next) => setValue('city', next, { shouldValidate: true })}
                options={citySuggestions(watchedState, pinLookup.result?.city)}
                placeholder="City"
                error={errors.city?.message}
              />
              <SearchableCombobox
                id="book-state"
                value={watchedState}
                onChange={(next) => setValue('state', next, { shouldValidate: true })}
                options={INDIA_STATES}
                placeholder="State"
                error={errors.state?.message}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <PincodeField
                id="book-postalCode"
                label=""
                value={watchedPostalCode}
                onChange={(next) => setValue('postalCode', next, { shouldValidate: true })}
                onLookup={setPinLookup}
                onVerified={(found) => {
                  if (found?.state && !getValues('state')) setValue('state', found.state, { shouldValidate: true });
                  if (found?.city && !getValues('city')) setValue('city', found.city, { shouldValidate: true });
                }}
                error={errors.postalCode?.message}
              />
              <input {...register('country')} placeholder="Country" className="w-full kicks-field text-white" />
            </div>
            <label className="flex items-center gap-3 text-sm text-[#d3d3d3]"><input type="checkbox" {...register('isDefault')} className="h-4 w-4" /> Set as default</label>
            <button type="submit" disabled={isSubmitting} className="w-full kicks-btn kicks-btn-primary">{isSubmitting ? 'Saving...' : 'Save address'}</button>
          </form>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <p className="kicks-eyebrow">Saved</p>
          <h2 className="mt-4 text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Your addresses</h2>
          {isLoading ? <div className="mt-6 h-[200px] animate-pulse rounded-[20px] bg-[#181818]" /> : isError ? <div className="mt-6 text-[#d2d2d2]">Unable to load addresses.</div> : addresses.length === 0 ? <div className="mt-6 rounded-[18px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d2d2d2]">No addresses saved yet.</div> : <div className="mt-6 space-y-4">{addresses.map((address) => (
            <div key={address._id || address.id} className="rounded-[20px] border border-white/10 bg-[#181818] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">{address.firstName} {address.lastName}</div>
                  <p className="mt-2 text-[#d1d1d1]">{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}, {address.city}, {address.state}, {address.postalCode}</p>
                  <p className="mt-2 text-sm text-[#a1a1a1]">{address.phone}</p>
                  {address.isDefault && <span className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#d4d4d4]">Default</span>}
                </div>
                <div className="flex gap-1.5">
                  {!address.isDefault && <button type="button" onClick={() => setDefaultMutation.mutate(address._id || address.id)} className="kicks-btn kicks-btn-secondary kicks-btn-sm">Set default</button>}
                  <button type="button" onClick={() => removeMutation.mutate(address._id || address.id)} aria-label="Delete address" title="Delete address" className="kicks-icon-btn h-8 w-8"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.list() });
  const { data, isLoading, isError } = notificationsQuery;
  const notifications = unwrapPayload(data)?.notifications ?? unwrapPayload(data)?.items ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-count'] }),
      ]);
      showToast('Notification marked as read', 'success');
    },
    onError: (error) => showToast(error?.message || 'Unable to mark notification as read.', 'error'),
  });

  const markNotificationRead = (notification) => {
    const id = notification?._id || notification?.id;
    if (id && !notification?.readAt && !markReadMutation.isPending) markReadMutation.mutate(id);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Notifications | AJ SPORTS" description="Your updates" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
        <h1 className="kicks-section-title">Notifications</h1>
        {isLoading ? (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-[20px] bg-[#181818]" />)}
          </div>
        ) : isError ? (
          <div className="mt-6 rounded-[20px] border border-white/10 bg-[#181818] p-6 text-center">
            <p className="text-[#d2d2d2]">Unable to load notifications.</p>
            <button type="button" onClick={() => notificationsQuery.refetch()} className="kicks-btn kicks-btn-primary kicks-btn-sm mt-4">Retry</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d2d2d2]">You are all caught up.</div>
        ) : (
          <div className="mt-6 space-y-4">
            {notifications.map((notification) => {
              const isUnread = !notification.readAt;
              const notificationId = notification._id || notification.id;
              const timestamp = notification.createdAt
                ? new Date(notification.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Date unavailable';

              return (
                <article
                  key={notificationId}
                  role={isUnread ? 'button' : undefined}
                  tabIndex={isUnread ? 0 : undefined}
                  onClick={() => markNotificationRead(notification)}
                  onKeyDown={(event) => {
                    if (isUnread && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      markNotificationRead(notification);
                    }
                  }}
                  className={`rounded-[20px] border p-5 transition ${isUnread ? 'cursor-pointer border-white/25 bg-[#1c1c1c] shadow-[inset_3px_0_0_#ffffff] hover:border-white/40' : 'border-white/10 bg-[#181818]'}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{notification.title || 'Update'}</h2>
                        {isUnread && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black">Unread</span>}
                      </div>
                      <p className="mt-2 break-words text-[#d0d0d0]">{notification.message || 'No message available.'}</p>
                      <time dateTime={notification.createdAt || undefined} className="mt-3 block text-xs text-[#8d8d8d]">{timestamp}</time>
                    </div>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          markNotificationRead(notification);
                        }}
                        disabled={markReadMutation.isPending && markReadMutation.variables === notificationId}
                        className="kicks-btn kicks-btn-secondary kicks-btn-sm w-fit shrink-0"
                      >
                        {markReadMutation.isPending && markReadMutation.variables === notificationId ? 'Marking...' : 'Mark as read'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CmsPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cms-page', slug],
    queryFn: () => cmsApi.getBySlug(slug),
    enabled: Boolean(slug),
  });

  const page = unwrapPayload(data)?.page ?? unwrapPayload(data)?.cms ?? {};

  if (isLoading) return <div className="mx-auto max-w-[1200px] px-4 py-12 text-white lg:px-8">Loading page...</div>;
  if (isError || !page.title) return <div className="mx-auto max-w-[1200px] px-4 py-12 text-white lg:px-8">Page unavailable.</div>;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title={`${page.title} | AJ SPORTS`} description={page.description || 'AJ SPORTS content page'} />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="kicks-eyebrow">Content</p>
        <h1 className="mt-4 kicks-section-title">{page.title}</h1>
        <div className="mt-8 space-y-5 text-[#d5d5d5] leading-8" dangerouslySetInnerHTML={{ __html: page.content || page.body || 'Content is unavailable.' }} />
      </div>
    </div>
  );
}


function NotFoundPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-20 text-center lg:px-8">
      <PageMeta title="Page not found | AJ SPORTS" description="The page you requested does not exist" />
      <h1 className="text-4xl font-black uppercase tracking-[-0.08em] text-white sm:text-5xl">404</h1>
      <p className="mt-5 text-[#c7c7c7]">This page does not exist yet.</p>
      <Link to="/" className="mt-8 inline-flex kicks-btn kicks-btn-primary">Back home</Link>
    </div>
  );
}
