import { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
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
import { addressesApi } from './api/addresses.api';
import { adminApi } from './api/admin.api';
import { authApi } from './api/auth.api';
import { blogApi } from './api/blog.api';
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

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().min(2, 'Last name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registrationFields = new Set(['firstName', 'lastName', 'email', 'password']);

function getRegistrationFieldError(message) {
  const field = message?.match(/^"([^"]+)"/)?.[1];
  return registrationFields.has(field) ? field : null;
}

function getRegistrationErrorMessage(error) {
  if (error?.status === 409) return 'An account with this email already exists.';
  if (error?.status === 429) return 'Too many attempts. Please try again shortly.';
  if (error?.status === 400 && error?.message === 'Validation failed') return 'Please check the highlighted fields.';
  return 'Unable to create your account. Please try again.';
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white">Checking session...</div>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white">Checking access...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
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

const unwrapPayload = (payload) => payload?.data ?? payload ?? {};
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

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
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogDetailPage />} />
        <Route path="/cms/:slug" element={<CmsPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/addresses" element={<AddressBookPage />} />
          <Route path="/account/notifications" element={<NotificationsPage />} />
          <Route path="/account/orders" element={<OrdersPage />} />
          <Route path="/account/orders/:id" element={<OrderDetailPage />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
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
          className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 pr-12 text-white outline-none transition focus:border-white/25"
          placeholder={placeholder}
          aria-label={label || placeholder}
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#d9d9d9] transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function CategoriesPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
      <PageMeta title="Categories | KICKS" description="Browse premium sneaker categories" />
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Shop all</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Categories</h1>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {['Running', 'Lifestyle', 'Training', 'Basketball', 'Football', 'Skate', 'Court', 'Performance'].map((category) => (
          <Link key={category} to="/shop" className="rounded-[26px] border border-white/10 bg-[#111111] p-4">
            <div className="h-64 overflow-hidden rounded-[20px]">
              <img src="https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1200&q=80" alt={category} className="h-full w-full object-cover" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xl font-semibold text-white">{category}</span>
              <ArrowRight size={18} className="text-white" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="About | KICKS" description="About KICKS" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">About us</p>
        <h1 className="mt-4 text-5xl font-black uppercase tracking-[-0.08em] text-white">More than a shoe store.</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#d0d0d0]">
          KICKS brings together premium craftsmanship, performance-driven design, and effortless street style for the modern mover.
        </p>
      </div>
    </div>
  );
}

function ContactPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Contact | KICKS" description="Contact the KICKS team" />
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Contact</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Let’s talk.</h1>
          <div className="mt-8 space-y-5 text-[#d2d2d2]">
            <p>support@kicks.example</p>
            <p>+91 98765 43210</p>
            <p>12 MG Road, Bengaluru, India</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <form className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <input className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Your name" />
              <input className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Your email" />
            </div>
            <input className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Subject" />
            <textarea rows={6} className="w-full rounded-[24px] border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Your message" />
            <button type="submit" className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Send message</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FaqPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="FAQ | KICKS" description="Frequently asked questions" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">FAQ</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Frequently asked questions</h1>
        <div className="mt-8 space-y-4 text-[#d6d6d6]">
          {['Do you ship nationwide?', 'How long does a return take?', 'Can I track my order?', 'Do you offer cash on delivery?'].map((question) => (
            <div key={question} className="rounded-[18px] border border-white/10 bg-[#171717] p-5">
              <strong className="text-white">{question}</strong>
              <p className="mt-2 text-sm text-[#b0b0b0]">Yes, KICKS supports fast domestic shipping and secure order tracking across key service zones.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolicyPage({ title }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title={`${title} | KICKS`} description={title} />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Policy</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">{title}</h1>
        <div className="mt-8 space-y-5 text-[#d1d1d1]">
          <p>These terms and policies are applied in line with the KICKS storefront experience and your purchase rights.</p>
          <p>For the live business rules, the backend is the source of truth for shipping timelines, returns, eligibility, and payment compliance.</p>
        </div>
      </div>
    </div>
  );
}

function WishlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['wishlist'], queryFn: () => wishlistApi.getWishlist() });
  const removeMutation = useMutation({
    mutationFn: (productId) => wishlistApi.removeFromWishlist(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  const wishlist = unwrapPayload(data)?.wishlist ?? unwrapPayload(data)?.items ?? unwrapPayload(data)?.products ?? [];
  const items = Array.isArray(wishlist) ? wishlist : wishlist.items ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Wishlist | KICKS" description="Your saved items" />
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Saved</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Wishlist</h1>
        </div>
        {items.length > 0 && <Link to="/shop" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">Browse styles</Link>}
      </div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => <div key={index} className="h-[280px] animate-pulse rounded-[24px] bg-[#111111]" />)}
        </div>
      ) : isError ? (
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 text-[#d7d7d7]">Unable to load wishlist from the backend.</div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-12 text-center">
          <h2 className="text-3xl font-black uppercase tracking-[-0.06em] text-white">Your wishlist is empty</h2>
          <p className="mt-4 text-[#c3c3c3]">Save the pairs you love to revisit them later.</p>
          <Link to="/shop" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Shop now</Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const product = item.product ?? item;
            const productId = product._id || product.id || item.productId;
            const price = Number(product?.price || 0);
            return (
              <div key={productId} className="rounded-[26px] border border-white/10 bg-[#111111] p-4">
                <img src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'} alt={product?.name || 'Saved product'} className="h-64 w-full rounded-[20px] object-cover" />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-[#a3a3a3]">{product?.brand?.name || 'KICKS'}</p>
                    <Link to={`/products/${product?.slug || productId}`} className="mt-2 block text-xl font-medium text-white">{product?.name}</Link>
                  </div>
                  <button type="button" onClick={() => removeMutation.mutate(productId)} className="rounded-full border border-white/10 p-2 text-white">✕</button>
                </div>
                <div className="mt-4 text-lg font-semibold text-white">{formatMoney(price)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CartPage() {
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

  const cartImageFallback = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80';

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Cart | KICKS" description="Shopping cart" />
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Your cart</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Cart</h1>
      </div>

      {isLoading ? (
        <div className="h-[300px] animate-pulse rounded-[28px] bg-[#111111]" />
      ) : isError ? (
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 text-[#d7d7d7]">Unable to load cart from the backend.</div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-12 text-center">
          <h2 className="text-3xl font-black uppercase tracking-[-0.06em] text-white">Your cart is empty</h2>
          <p className="mt-4 text-[#c3c3c3]">Add a few premium pairs and continue to checkout.</p>
          <Link to="/shop" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Continue shopping</Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {items.map((item) => {
              const product = item.product || (typeof item.productId === 'object' ? item.productId : {}) || {};
              const variantId = item.variantId || item.variant?._id || item._id;
              const quantity = Number(item.quantity || 0);
              const price = Number(item.unitPrice || item.price || 0);
              const subtotal = price * quantity;
              const image = product?.images?.[0] || item?.variant?.images?.[0] || cartImageFallback;
              const size = item.size || item.variant?.size || 'N/A';
              const color = item.color || item.variant?.color || 'N/A';

              return (
                <div key={variantId} className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-[#111111] p-4 md:flex-row md:items-center">
                  <img src={image} alt={product?.name || 'Cart item'} className="h-24 w-24 rounded-[18px] object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = cartImageFallback; }} />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">{product?.name || 'KICKS product'}</h3>
                    <p className="mt-1 text-sm text-[#9d9d9d]">{product?.brand?.name || 'KICKS'} • Size {size} • Color {color}</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatMoney(price)} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Decrease quantity" onClick={() => updateMutation.mutate({ variantId, quantity: Math.max(1, quantity - 1) })} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white">−</button>
                    <span className="min-w-8 text-center text-sm font-medium text-white">{quantity}</span>
                    <button type="button" aria-label="Increase quantity" onClick={() => updateMutation.mutate({ variantId, quantity: quantity + 1 })} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white">+</button>
                  </div>
                  <div className="text-lg font-semibold text-white">{formatMoney(subtotal)}</div>
                  <button type="button" onClick={() => removeMutation.mutate(variantId)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Remove</button>
                </div>
              );
            })}
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-[#111111] p-6">
            <h2 className="text-2xl font-bold text-white">Summary</h2>
            <div className="mt-6 space-y-4 text-[#d2d2d2]">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>Free</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{formatMoney(0)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-4 text-lg font-semibold text-white"><span>Total</span><span>{formatMoney(subtotal)}</span></div>
            </div>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['cart'] })} className="mt-6 block w-full rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-black">Proceed to checkout</button>
            <button type="button" disabled={clearMutation.isPending} onClick={() => clearMutation.mutate()} className="mt-4 w-full rounded-full border border-white/10 px-6 py-3 text-sm text-white disabled:cursor-wait disabled:opacity-60">{clearMutation.isPending ? 'Clearing...' : 'Clear cart'}</button>
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
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponDiscount(0);
      setCouponError('');
      return;
    }

    try {
      const response = await apiClient.get('/coupons/validate', { params: { code: couponCode.trim(), cartTotal: subtotal } });
      const payload = unwrapPayload(response.data);
      const nextDiscount = Number(payload?.discount ?? payload?.data?.discount ?? 0);
      setCouponDiscount(nextDiscount);
      setCouponError('');
      showToast('Coupon applied.', 'success');
    } catch (error) {
      setCouponDiscount(0);
      setCouponError(error?.message || 'Coupon is invalid');
      showToast(error?.message || 'Coupon is invalid', 'error');
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
        couponCode: couponCode.trim() || undefined,
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
        name: 'KICKS',
        description: `Order ${order.orderNumber || orderId}`,
        order_id: gatewayOrder.id,
        handler: async (razorpayResponse) => {
          await handlePaymentSuccess(orderId, razorpayResponse);
        },
        prefill: {
          name: `${order.customerSnapshot?.firstName || ''} ${order.customerSnapshot?.lastName || ''}`.trim() || 'KICKS customer',
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
  const discount = Number(couponDiscount || 0);
  const total = Math.max(subtotal - discount + shipping, 0);

  const submitAddress = (event) => {
    event.preventDefault();
    if (!addressForm.firstName || !addressForm.lastName || !addressForm.phone || !addressForm.addressLine1 || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      showToast('Please complete the required address fields.', 'error');
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
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <div className="h-[300px] animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  if (cartError || items.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-12 text-center">
          <h2 className="text-3xl font-black uppercase tracking-[-0.06em] text-white">Your cart is empty</h2>
          <p className="mt-4 text-[#c3c3c3]">Add a few premium pairs and continue to checkout.</p>
          <Link to="/shop" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Checkout | KICKS" description="Checkout" />
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Checkout</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Secure checkout</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-white">Shipping</h2>
              <button type="button" onClick={() => setShowAddressForm((current) => !current)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">
                {showAddressForm ? 'Close form' : 'Add new address'}
              </button>
            </div>

            {addressList.length > 0 ? (
              <div className="mt-5 space-y-3">
                {addressList.map((address) => {
                  const addressId = address._id || address.id;
                  const isSelected = activeAddressId === addressId;
                  return (
                    <button
                      key={addressId}
                      type="button"
                      onClick={() => setSelectedAddressId(addressId)}
                      className={`w-full rounded-[20px] border p-4 text-left transition ${isSelected ? 'border-white bg-[#1a1a1a]' : 'border-white/10 bg-[#181818]'}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{address.firstName} {address.lastName}</p>
                          <p className="mt-1 text-sm text-[#d7d7d7]">{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}</p>
                          <p className="text-sm text-[#d7d7d7]">{address.city}, {address.state} {address.postalCode}</p>
                          <p className="text-sm text-[#d7d7d7]">{address.country}</p>
                          <p className="mt-1 text-sm text-[#d7d7d7]">{address.phone}</p>
                        </div>
                        {address.isDefault && <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#d7d7d7]">Default</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {showAddressForm && (
              <form onSubmit={submitAddress} className="mt-5 grid gap-4 rounded-[20px] border border-white/10 bg-[#181818] p-4 md:grid-cols-2">
                <input value={addressForm.firstName} onChange={(event) => setAddressForm((current) => ({ ...current, firstName: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="First name" />
                <input value={addressForm.lastName} onChange={(event) => setAddressForm((current) => ({ ...current, lastName: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Last name" />
                <input value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none md:col-span-2" placeholder="Phone" />
                <input value={addressForm.addressLine1} onChange={(event) => setAddressForm((current) => ({ ...current, addressLine1: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none md:col-span-2" placeholder="Address line 1" />
                <input value={addressForm.addressLine2} onChange={(event) => setAddressForm((current) => ({ ...current, addressLine2: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none md:col-span-2" placeholder="Address line 2 (optional)" />
                <input value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="City" />
                <input value={addressForm.state} onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="State" />
                <input value={addressForm.postalCode} onChange={(event) => setAddressForm((current) => ({ ...current, postalCode: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Postal code" />
                <input value={addressForm.country} onChange={(event) => setAddressForm((current) => ({ ...current, country: event.target.value }))} className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Country" />
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={addressCreateMutation.isPending} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black disabled:cursor-wait disabled:opacity-60">
                    {addressCreateMutation.isPending ? 'Saving...' : 'Save address'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6">
            <h2 className="text-2xl font-bold text-white">Coupon</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} className="flex-1 rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white outline-none" placeholder="Enter coupon code" />
              <button type="button" onClick={validateCoupon} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">Apply</button>
            </div>
            {couponError && <p className="mt-3 text-sm text-red-300">{couponError}</p>}
            {couponDiscount > 0 && <p className="mt-3 text-sm text-[#9feec8]">Coupon applied: {formatMoney(couponDiscount)}</p>}
          </div>
        </div>

        <aside className="rounded-[28px] border border-white/10 bg-[#111111] p-6">
          <h2 className="text-2xl font-bold text-white">Order summary</h2>

          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const product = item.product || (typeof item.productId === 'object' ? item.productId : {}) || {};
              const productName = product?.name || 'Product';
              const image = product?.images?.[0] || item?.variant?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80';
              const unitPrice = Number(item.unitPrice || item.price || 0);
              const lineTotal = unitPrice * Number(item.quantity || 0);
              return (
                <div key={item.variantId || item._id || item.id} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#181818] p-3">
                  <img src={image} alt={productName} className="h-16 w-16 rounded-[14px] object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'; }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{productName}</div>
                    <div className="mt-1 text-xs text-[#d3d3d3]">{product?.brand?.name || 'KICKS'} • {item.size || item.variant?.size || 'N/A'} • {item.color || item.variant?.color || 'N/A'}</div>
                    <div className="mt-1 text-xs text-[#d3d3d3]">Qty {item.quantity}</div>
                  </div>
                  <div className="text-sm font-medium text-white">{formatMoney(lineTotal)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-4 text-[#d2d2d2]">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>{formatMoney(discount)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'Free' : formatMoney(shipping)}</span></div>
            <div className="flex justify-between border-t border-white/10 pt-4 text-lg font-semibold text-white"><span>Total</span><span>{formatMoney(total)}</span></div>
          </div>

          <button
            type="button"
            disabled={!selectedAddressId || isProcessingPayment}
            onClick={payNow}
            className="mt-6 block w-full rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessingPayment ? 'Preparing payment...' : 'Pay now'}
          </button>

          {!selectedAddressId && <p className="mt-3 text-sm text-red-300">Please select or add a delivery address.</p>}
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
      <div className="mx-auto max-w-[900px] px-4 py-12 lg:px-8">
        <PageMeta title="Order issue | KICKS" description="Order information unavailable" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12 text-center">
          <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Order unavailable</h1>
          <p className="mt-4 text-[#d3d3d3]">We could not load your order details.</p>
          <Link to="/shop" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Continue shopping</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-12 lg:px-8">
        <div className="h-[320px] animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  if (isError || !order?._id) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-12 lg:px-8">
        <PageMeta title="Order issue | KICKS" description="Order information unavailable" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12 text-center">
          <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Order unavailable</h1>
          <p className="mt-4 text-[#d3d3d3]">We could not load this order right now. Please try again.</p>
          <Link to="/shop" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Continue shopping</Link>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';

  if (!isPaid) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-12 lg:px-8">
        <PageMeta title="Payment pending | KICKS" description="Payment confirmation is still pending" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12 text-center">
          <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Payment pending</h1>
          <p className="mt-4 text-[#d3d3d3]">Your payment is still being confirmed. Please check again shortly.</p>
          <Link to="/shop" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-12 lg:px-8">
      <PageMeta title="Order placed | KICKS" description="Your order was successful" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-12">
        <div className="flex flex-col items-center text-center">
          <div aria-hidden="true" className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-black text-black">✓</div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Order status</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Order placed successfully</h1>
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
                    <div className="text-sm font-medium text-white">{item.productName || item.name || 'KICKS product'}</div>
                    <div className="mt-1 text-xs text-[#b4b4b4]">Qty {item.quantity || 1}</div>
                  </div>
                  <div className="text-sm font-medium text-white">{formatMoney(Number(item.unitPrice || item.finalPrice || 0) * Number(item.quantity || 1))}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to={`/account/orders/${id}`} className="inline-flex flex-1 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-medium text-black">View order</Link>
          <Link to="/shop" className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-white">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}

function OrdersPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['orders'], queryFn: () => ordersApi.listForUser() });
  const orders = unwrapPayload(data)?.orders ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="My orders | KICKS" description="Order history" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
        <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">My orders</h1>
        {isLoading ? (
          <div className="mt-6 h-[200px] animate-pulse rounded-[24px] bg-[#181818]" />
        ) : isError ? (
          <div className="mt-6 rounded-[20px] border border-white/10 bg-[#181818] p-5 text-[#d2d2d2]">Unable to load your orders.</div>
        ) : orders.length === 0 ? (
          <div className="mt-6 rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d2d2d2]">No orders yet. Your KICKS history will appear here.</div>
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

function OrderDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => ordersApi.getById(id),
    enabled: Boolean(id),
  });

  const order = unwrapPayload(data)?.order ?? {};
  const items = Array.isArray(order.items) ? order.items : [];
  const shippingAddress = order.shippingAddress ?? {};
  const subtotal = Number(order.subtotal || items.reduce((sum, item) => sum + Number(item.unitPrice || item.finalPrice || 0) * Number(item.quantity || 1), 0));
  const discount = Number(order.discountAmount || 0);
  const shippingCharge = Number(order.shippingCharge || 0);
  const tax = Number(order.tax || 0);
  const total = Number(order.grandTotal || order.total || subtotal - discount + shippingCharge + tax || 0);

  if (!id) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <PageMeta title="Order details | KICKS" description="Order details" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 text-center">
          <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Order not found</h1>
          <p className="mt-4 text-[#d3d3d3]">We could not find this order.</p>
          <Link to="/account/orders" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Back to orders</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <div className="h-[320px] animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  if (isError || !order._id) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <PageMeta title="Order details | KICKS" description="Order details" />
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 text-center">
          <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Order unavailable</h1>
          <p className="mt-4 text-[#d3d3d3]">We could not load this order right now.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/account/orders" className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Back to orders</Link>
            <Link to="/shop" className="inline-flex rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-white">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';
  const paymentMethod = order.paymentId ? 'Razorpay' : 'Payment pending';

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Order details | KICKS" description="Order details" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Order details</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">{order.orderNumber || order._id || id}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/account/orders" className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white">Back to orders</Link>
          <Link to="/shop" className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Continue shopping</Link>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Order date</p>
            <p className="mt-2 text-lg font-semibold text-white">{orderDate}</p>
          </div>
          <div className={`inline-flex rounded-full px-3 py-2 text-xs uppercase tracking-[0.2em] ${statusClasses[order.status] || statusClasses.DEFAULT}`}>
            {order.status || 'PENDING'}
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-[#181818] p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Order status</p>
            <p className="mt-4 text-lg font-semibold text-white">{order.status || 'PENDING'}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[#181818] p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Payment status</p>
            <p className="mt-4 text-lg font-semibold text-white">{order.paymentStatus || 'PENDING'}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[#181818] p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Payment method</p>
            <p className="mt-4 text-lg font-semibold text-white">{paymentMethod}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Products</h2>
            {items.map((item) => {
              const image = item.product?.images?.[0] || item.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80';
              const unitPrice = Number(item.unitPrice || item.finalPrice || 0);
              const lineTotal = Number(unitPrice * Number(item.quantity || 1));
              return (
                <div key={item._id || item.variantId || item.productId} className="flex flex-col gap-4 rounded-[20px] border border-white/10 bg-[#181818] p-4 md:flex-row md:items-center">
                  <img src={image} alt={item.productName || 'Ordered product'} className="h-24 w-24 rounded-[18px] object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'; }} />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">{item.productName || item.name || 'KICKS product'}</h3>
                    <p className="mt-1 text-sm text-[#a8a8a8]">{item.size || 'Size N/A'} • {item.color || 'Color N/A'}</p>
                    <p className="mt-2 text-sm text-[#d3d3d3]">Qty {item.quantity || 1}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm text-[#a8a8a8]">{formatMoney(unitPrice)} each</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatMoney(lineTotal)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-5">
            <div className="rounded-[22px] border border-white/10 bg-[#181818] p-6">
              <h2 className="text-2xl font-bold text-white">Summary</h2>
              <div className="mt-5 space-y-3 text-[#d9d9d9]">
                <div className="flex items-center justify-between gap-4"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                <div className="flex items-center justify-between gap-4"><span>Discount</span><span>{formatMoney(discount)}</span></div>
                <div className="flex items-center justify-between gap-4"><span>Shipping</span><span>{shippingCharge === 0 ? 'Free' : formatMoney(shippingCharge)}</span></div>
                <div className="flex items-center justify-between gap-4"><span>Tax</span><span>{formatMoney(tax)}</span></div>
                <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3 text-lg font-semibold text-white"><span>Total</span><span>{formatMoney(total)}</span></div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-[#181818] p-6">
              <h2 className="text-2xl font-bold text-white">Shipping address</h2>
              <div className="mt-5 space-y-1 text-[#d9d9d9]">
                <p className="text-white">{shippingAddress.firstName || ''} {shippingAddress.lastName || ''}</p>
                <p>{shippingAddress.phone || 'Phone unavailable'}</p>
                <p>{shippingAddress.addressLine1 || shippingAddress.address || 'Address unavailable'}</p>
                {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                <p>{[shippingAddress.city, shippingAddress.state, shippingAddress.postalCode].filter(Boolean).join(', ') || 'Location unavailable'}</p>
                <p>{shippingAddress.country || 'India'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountProfileSection({ user }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6 md:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#181818] text-3xl font-black text-white">
            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'K'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#181818] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#8d8d8d]">
              <Sparkles size={12} className="text-white" /> Verified Member
            </div>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.04em] text-white">
              {user?.firstName || 'Customer'} {user?.lastName || ''}
            </h2>
            <p className="mt-1 text-sm text-[#a1a1a1]">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">First name</p>
          <p className="mt-2 text-base font-semibold text-white">{user?.firstName || '—'}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Last name</p>
          <p className="mt-2 text-base font-semibold text-white">{user?.lastName || '—'}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Account email</p>
          <p className="mt-2 truncate text-base font-semibold text-white">{user?.email || '—'}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Phone number</p>
          <p className="mt-2 text-base font-semibold text-white">{user?.phone || 'Not provided'}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Account role</p>
          <p className="mt-2 text-base font-semibold text-white">{user?.role || 'CUSTOMER'}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d8d8d]">Member since</p>
          <p className="mt-2 text-base font-semibold text-white">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Active'}
          </p>
        </div>
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
    phone: z.string().min(8, 'Valid phone required'),
    addressLine1: z.string().min(3, 'Address line 1 required'),
    addressLine2: z.string().optional().or(z.literal('')),
    landmark: z.string().optional().or(z.literal('')),
    city: z.string().min(2, 'City required'),
    state: z.string().min(2, 'State required'),
    postalCode: z.string().min(3, 'Postal code required'),
    country: z.string().default('India'),
    isDefault: z.boolean().default(false),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
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
  };

  const handleEdit = (address) => {
    setIsAdding(true);
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
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[#e4e4e4]"
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
                <input {...register('firstName')} placeholder="First name" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
                {errors.firstName && <p className="mt-1 text-xs text-red-300">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Last Name *</label>
                <input {...register('lastName')} placeholder="Last name" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
                {errors.lastName && <p className="mt-1 text-xs text-red-300">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-[#c0c0c0]">Phone Number *</label>
              <input {...register('phone')} placeholder="+91 98765 43210" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
              {errors.phone && <p className="mt-1 text-xs text-red-300">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-xs text-[#c0c0c0]">Address Line 1 *</label>
              <input {...register('addressLine1')} placeholder="Flat / House No. / Building / Street" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
              {errors.addressLine1 && <p className="mt-1 text-xs text-red-300">{errors.addressLine1.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Address Line 2 (Optional)</label>
                <input {...register('addressLine2')} placeholder="Apartment, suite, etc." className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Landmark (Optional)</label>
                <input {...register('landmark')} placeholder="Near Metro / Park" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">City *</label>
                <input {...register('city')} placeholder="City" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
                {errors.city && <p className="mt-1 text-xs text-red-300">{errors.city.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">State *</label>
                <input {...register('state')} placeholder="State" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
                {errors.state && <p className="mt-1 text-xs text-red-300">{errors.state.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Postal / PIN Code *</label>
                <input {...register('postalCode')} placeholder="PIN Code" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
                {errors.postalCode && <p className="mt-1 text-xs text-red-300">{errors.postalCode.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs text-[#c0c0c0]">Country *</label>
                <input {...register('country')} placeholder="Country" className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
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
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#e4e4e4] disabled:opacity-60"
              >
                {(isSubmitting || createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                {editingAddressId ? 'Update Address' : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-white hover:bg-white/5"
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
        <div className="rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-10 text-center">
          <MapPin size={32} className="mx-auto text-[#666666]" />
          <h3 className="mt-3 text-lg font-bold text-white">No addresses saved</h3>
          <p className="mt-1 text-sm text-[#a0a0a0]">Add a delivery address to speed up checkout.</p>
          <button
            type="button"
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-black"
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#181818] px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMutation.mutate(addressId)}
                      disabled={setDefaultMutation.isPending}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#b8b8b8] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
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
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/20 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
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
        <div className="rounded-[24px] border border-dashed border-white/15 bg-[#111111] p-10 text-center">
          <Package size={32} className="mx-auto text-[#666666]" />
          <h3 className="mt-3 text-lg font-bold text-white">No orders yet</h3>
          <p className="mt-1 text-sm text-[#a0a0a0]">Explore our catalog and find your next favorite pair.</p>
          <Link
            to="/shop"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-black"
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
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-[0.2em] text-[#8d8d8d]">Order</span>
                      <span className="font-bold text-white">{order.orderNumber || orderId}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#a0a0a0]">
                      <span>{orderDate}</span>
                      <span>•</span>
                      <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                      <span>•</span>
                      <span>{formatMoney(totalAmount)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses[order.status] || statusClasses.DEFAULT}`}>
                      {order.status || 'PENDING'}
                    </span>
                    <Link
                      to={`/account/orders/${orderId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#181818] px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                    >
                      View Order <ChevronRight size={14} />
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

  return (
    <div className="max-w-[560px] space-y-6">
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AccountPage() {
  const { user, logout, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="h-64 animate-pulse rounded-[28px] bg-[#111111]" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User2 },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'orders', label: 'My Orders', icon: ShoppingBag },
    { id: 'security', label: 'Security', icon: KeyRound },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <PageMeta title="My Account | KICKS" description="Manage your KICKS customer account and preferences" />

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Customer Center</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-white md:text-4xl">
            My Account
          </h1>
        </div>
        <button
          onClick={() => logout()}
          type="button"
          className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-[#141414] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 sm:self-auto"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Account Layout */}
      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Navigation Sidebar */}
        <aside className="h-fit rounded-[24px] border border-white/10 bg-[#111111] p-3">
          <nav className="flex flex-row gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-x-visible lg:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-[#a0a0a0] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Section Content */}
        <main className="min-w-0">
          {activeTab === 'profile' && <AccountProfileSection user={user} />}
          {activeTab === 'addresses' && <AccountAddressesSection />}
          {activeTab === 'orders' && <AccountOrdersSection />}
          {activeTab === 'security' && <AccountPasswordSection />}
        </main>
      </div>
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await login(values);
      showToast('Welcome back. You are signed in.', 'success');
      navigate('/account', { replace: true });
    } catch (error) {
      showToast(error?.message || 'Login failed. Please check your credentials.', 'error');
    }
  };

  if (isAuthenticated) return <Navigate to="/account" replace />;

  return (
    <div className="mx-auto max-w-[600px] px-4 py-12 lg:px-8">
      <PageMeta title="Login | KICKS" description="Login to your KICKS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Welcome back</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Login</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
            <input {...register('email')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none transition focus:border-white/25" placeholder="you@example.com" />
            {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
          </div>

          <PasswordField
            label="Password"
            name="password"
            register={register}
            error={errors.password?.message}
            placeholder="Your password"
          />

          <button disabled={isSubmitting} type="submit" className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">
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
  const { register: registerUser, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await registerUser(values);
      showToast('Account created. Welcome to KICKS.', 'success');
      navigate('/account', { replace: true });
    } catch (error) {
      const fieldErrors = (error?.errors || [])
        .map((message) => ({ field: getRegistrationFieldError(message), message }))
        .filter(({ field }) => field);

      fieldErrors.forEach(({ field, message }) => {
        setError(field, { type: 'server', message });
      });

      showToast(getRegistrationErrorMessage(error), 'error');
    }
  };

  const onInvalid = () => showToast('Please check the highlighted fields.', 'error');

  if (isAuthenticated) return <Navigate to="/account" replace />;

  return (
    <div className="mx-auto max-w-[700px] px-4 py-12 lg:px-8">
      <PageMeta title="Register | KICKS" description="Create a KICKS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Start here</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Create account</h1>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-8 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]">First name</label>
              <input {...register('firstName')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none transition focus:border-white/25" />
              {errors.firstName && <p className="mt-2 text-sm text-red-300">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]">Last name</label>
              <input {...register('lastName')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none transition focus:border-white/25" />
              {errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
            <input {...register('email')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none transition focus:border-white/25" />
            {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
          </div>

          <PasswordField
            label="Password"
            name="password"
            register={register}
            error={errors.password?.message}
            placeholder="Create a password"
          />

          <button type="submit" className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>

          <div className="text-center text-sm text-[#c4c4c4]">
            Already have an account? <Link to="/login" className="text-white underline">Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function ForgotPasswordPage() {
  const { showToast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({ email: z.string().email('Valid email required') })),
    defaultValues: { email: '' },
  });
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (values) => {
    try {
      await authApi.forgotPassword(values);
      setSubmitted(true);
      showToast('Reset instructions were sent if the email is registered.', 'success');
    } catch (error) {
      showToast(error?.message || 'Could not send reset instructions.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-[520px] px-4 py-12 lg:px-8">
      <PageMeta title="Forgot password | KICKS" description="Recover your KICKS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Account</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Forgot password</h1>
        {submitted ? (
          <p className="mt-6 text-[#d0d0d0]">If the email exists, a reset link has been sent.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
              <input {...register('email')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none transition focus:border-white/25" />
              {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Sending...' : 'Send reset link'}</button>
          </form>
        )}
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
    <div className="mx-auto max-w-[520px] px-4 py-12 lg:px-8">
      <PageMeta title="Reset password | KICKS" description="Set a new password" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Security</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Reset password</h1>
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
            <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Updating...' : 'Reset password'}</button>
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
    <div className="mx-auto max-w-[520px] px-4 py-12 lg:px-8">
      <PageMeta title="Verify email | KICKS" description="Verify your account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Email verification</h1>
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
    <div className="mx-auto max-w-[520px] px-4 py-12 lg:px-8">
      <PageMeta title="Change password | KICKS" description="Change your password" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Security</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Change password</h1>
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
            <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Updating...' : 'Update password'}</button>
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
    phone: z.string().min(8, 'Phone required'),
    addressLine1: z.string().min(3, 'Address required'),
    addressLine2: z.string().optional().or(z.literal('')),
    landmark: z.string().optional().or(z.literal('')),
    city: z.string().min(2, 'City required'),
    state: z.string().min(2, 'State required'),
    postalCode: z.string().min(3, 'Postal code required'),
    country: z.string().default('India'),
    isDefault: z.boolean().default(false),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
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

  const createMutation = useMutation({
    mutationFn: (payload) => addressesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      reset();
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
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Addresses | KICKS" description="Manage delivery addresses" />
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Address book</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Add address</h1>
          <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="mt-8 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><input {...register('firstName')} placeholder="First name" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />{errors.firstName && <p className="mt-2 text-sm text-red-300">{errors.firstName.message}</p>}</div>
              <div><input {...register('lastName')} placeholder="Last name" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />{errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName.message}</p>}</div>
            </div>
            <input {...register('phone')} placeholder="Phone" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
            <input {...register('addressLine1')} placeholder="Address line 1" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
            <input {...register('addressLine2')} placeholder="Address line 2 (optional)" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
            <input {...register('landmark')} placeholder="Landmark (optional)" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
            <div className="grid gap-4 md:grid-cols-2">
              <input {...register('city')} placeholder="City" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
              <input {...register('state')} placeholder="State" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input {...register('postalCode')} placeholder="Postal code" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
              <input {...register('country')} placeholder="Country" className="w-full rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" />
            </div>
            <label className="flex items-center gap-3 text-sm text-[#d3d3d3]"><input type="checkbox" {...register('isDefault')} className="h-4 w-4" /> Set as default</label>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">{isSubmitting ? 'Saving...' : 'Save address'}</button>
          </form>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Saved</p>
          <h2 className="mt-4 text-3xl font-black uppercase tracking-[-0.06em] text-white">Your addresses</h2>
          {isLoading ? <div className="mt-6 h-[200px] animate-pulse rounded-[20px] bg-[#181818]" /> : isError ? <div className="mt-6 text-[#d2d2d2]">Unable to load addresses.</div> : addresses.length === 0 ? <div className="mt-6 rounded-[18px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d2d2d2]">No addresses saved yet.</div> : <div className="mt-6 space-y-4">{addresses.map((address) => (
            <div key={address._id || address.id} className="rounded-[20px] border border-white/10 bg-[#181818] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">{address.firstName} {address.lastName}</div>
                  <p className="mt-2 text-[#d1d1d1]">{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}, {address.city}, {address.state}, {address.postalCode}</p>
                  <p className="mt-2 text-sm text-[#a1a1a1]">{address.phone}</p>
                  {address.isDefault && <span className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#d4d4d4]">Default</span>}
                </div>
                <div className="flex gap-2">
                  {!address.isDefault && <button type="button" onClick={() => setDefaultMutation.mutate(address._id || address.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Set default</button>}
                  <button type="button" onClick={() => removeMutation.mutate(address._id || address.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white"><Trash2 size={14} /></button>
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
  const { data, isLoading, isError } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.list() });
  const notifications = unwrapPayload(data)?.notifications ?? unwrapPayload(data)?.items ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Notifications | KICKS" description="Your updates" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
        <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Notifications</h1>
        {isLoading ? <div className="mt-6 h-[200px] animate-pulse rounded-[20px] bg-[#181818]" /> : isError ? <div className="mt-6 text-[#d2d2d2]">Unable to load notifications.</div> : notifications.length === 0 ? <div className="mt-6 rounded-[18px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d2d2d2]">You are all caught up.</div> : <div className="mt-6 space-y-4">{notifications.map((notification) => (
          <div key={notification._id || notification.id} className="rounded-[20px] border border-white/10 bg-[#181818] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">{notification.title || 'Update'}</div>
                <p className="mt-2 text-[#d0d0d0]">{notification.message || notification.body || 'No message available.'}</p>
              </div>
              {!notification.readAt && <button type="button" onClick={() => markReadMutation.mutate(notification._id || notification.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Mark read</button>}
            </div>
          </div>
        ))}</div>}
      </div>
    </div>
  );
}

function BlogPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['blog'], queryFn: () => blogApi.list() });
  const posts = unwrapPayload(data)?.posts ?? unwrapPayload(data)?.items ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Journal | KICKS" description="KICKS stories and style insights" />
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Journal</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Stories & style</h1>
      </div>
      {isLoading ? <div className="grid gap-6 lg:grid-cols-3"><div className="h-[300px] animate-pulse rounded-[24px] bg-[#111111]" /><div className="h-[300px] animate-pulse rounded-[24px] bg-[#111111]" /><div className="h-[300px] animate-pulse rounded-[24px] bg-[#111111]" /></div> : isError ? <div className="rounded-[24px] border border-white/10 bg-[#111111] p-8 text-[#d4d4d4]">Unable to load editorial content.</div> : <div className="grid gap-6 lg:grid-cols-3">{posts.map((post) => (
        <Link key={post.slug || post._id} to={`/blog/${post.slug || post._id}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
          <img src={post.coverImage || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80'} alt={post.title || 'Blog article'} className="h-72 w-full object-cover" />
          <div className="p-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#a1a1a1]">{post.category || 'Culture'}</p>
            <h3 className="mt-3 text-2xl font-bold text-white">{post.title}</h3>
            <p className="mt-3 text-[#d0d0d0]">{post.shortDescription || post.excerpt || 'Read the latest KICKS conversation.'}</p>
          </div>
        </Link>
      ))}</div>}
    </div>
  );
}

function BlogDetailPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['blog-detail', slug],
    queryFn: () => blogApi.getBySlug(slug),
    enabled: Boolean(slug),
  });
  const post = unwrapPayload(data)?.post ?? unwrapPayload(data)?.blog ?? {};

  if (isLoading) return <div className="mx-auto max-w-[1200px] px-4 py-12 text-white lg:px-8">Loading story...</div>;
  if (isError || !post.title) return <div className="mx-auto max-w-[1200px] px-4 py-12 text-white lg:px-8">Story unavailable.</div>;

  return (
    <article className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title={`${post.title} | KICKS`} description={post.shortDescription || post.excerpt || 'KICKS editorial'} />
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#111111]">
        <img src={post.coverImage || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'} alt={post.title} className="h-[420px] w-full object-cover" />
      </div>
      <div className="mt-8 max-w-[900px]">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">{post.category || 'Journal'}</p>
        <h1 className="mt-4 text-5xl font-black uppercase tracking-[-0.08em] text-white">{post.title}</h1>
        <div className="mt-8 space-y-5 text-lg leading-8 text-[#d5d5d5]" dangerouslySetInnerHTML={{ __html: post.content || post.body || 'No article content available.' }} />
      </div>
    </article>
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
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title={`${page.title} | KICKS`} description={page.description || 'KICKS content page'} />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-12">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Content</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">{page.title}</h1>
        <div className="mt-8 space-y-5 text-[#d5d5d5] leading-8" dangerouslySetInnerHTML={{ __html: page.content || page.body || 'Content is unavailable.' }} />
      </div>
    </div>
  );
}

function DataTable({ columns = [], rows = [], emptyMessage = 'No records found.' }) {
  if (!rows.length) {
    return <div className="rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d5d5d5]">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-[22px] border border-white/10 bg-[#111111]">
      <table className="min-w-full text-left text-sm text-[#d8d8d8]">
        <thead className="bg-[#171717] text-[10px] uppercase tracking-[0.22em] text-[#9a9a9a]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row._id || rowIndex} className="border-t border-white/10">
              {columns.map((column) => (
                <td key={`${rowIndex}-${column.key}`} className="px-4 py-3 align-top">
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-40">Prev</button>
      <span className="text-sm text-[#d5d5d5]">Page {page} / {totalPages}</span>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-40">Next</button>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="rounded-full border border-white/10 bg-[#181818] px-4 py-3">
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm text-white placeholder:text-[#7d7d7d] outline-none" />
    </div>
  );
}

function FilterBar({ children }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}

function FormField({ label, children, hint }) {
  return (
    <label className="block">
      {label && <span className="mb-2 block text-sm text-[#d4d4d4]">{label}</span>}
      {children}
      {hint && <span className="mt-2 block text-xs text-[#8c8c8c]">{hint}</span>}
    </label>
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = String(status || 'DEFAULT').toUpperCase();
  const palette = {
    PUBLISHED: 'bg-[#10271d] text-[#8ff0a8]',
    DRAFT: 'bg-[#2d2a19] text-[#f3d87d]',
    ARCHIVED: 'bg-[#2c1a1a] text-[#f5a0a0]',
    ACTIVE: 'bg-[#10271d] text-[#8ff0a8]',
    INACTIVE: 'bg-[#2f2c2c] text-[#e7e7e7]',
    APPROVED: 'bg-[#10271d] text-[#8ff0a8]',
    REJECTED: 'bg-[#2c1a1a] text-[#f5a0a0]',
    PENDING: 'bg-[#2d2a19] text-[#f3d87d]',
    PROCESSING: 'bg-[#2d2a19] text-[#f3d87d]',
    SHIPPED: 'bg-[#112b2a] text-[#8ee9d3]',
    DELIVERED: 'bg-[#10271d] text-[#8ff0a8]',
    CANCELLED: 'bg-[#2c1a1a] text-[#f5a0a0]',
    PAID: 'bg-[#10271d] text-[#8ff0a8]',
    FAILED: 'bg-[#2c1a1a] text-[#f5a0a0]',
    REFUNDED: 'bg-[#2c1a1a] text-[#f5a0a0]',
    DEFAULT: 'bg-[#1d1d1d] text-[#e8e8e8]',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${palette[normalizedStatus] || palette.DEFAULT}`}>{normalizedStatus}</span>;
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/15 bg-[#121212] p-10 text-center">
      <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">{title}</h3>
      <p className="mt-3 text-[#d5d5d5]">{description}</p>
    </div>
  );
}

function ErrorState({ message }) {
  return <div className="rounded-[20px] border border-red-500/30 bg-[#1b1515] p-5 text-sm text-red-200">{message}</div>;
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-3">
      {[...Array(lines)].map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-[16px] bg-[#171717]" />
      ))}
    </div>
  );
}

function Toast({ message, type = 'info' }) {
  if (!message) return null;
  const tone = type === 'error' ? 'border-red-500/40 bg-[#201414] text-red-200' : 'border-white/10 bg-[#191919] text-[#e8e8e8]';

  return (
    <div className={`rounded-[18px] border ${tone} px-4 py-3 text-sm`}>
      {message}
    </div>
  );
}

function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('section') || 'dashboard';
  const sections = [
    'dashboard',
    'products',
    'categories',
    'brands',
    'inventory',
    'orders',
    'users',
    'reviews',
    'notifications',
    'ai',
    'blog',
    'cms',
    'audit',
    'settings',
  ];

  const setSection = (nextSection) => setSearchParams({ section: nextSection });

  const DashboardSection = () => {
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => adminApi.dashboard() });
    const metrics = unwrapPayload(data)?.metrics ?? {};
    const cards = [
      { title: 'Revenue', value: metrics.totalRevenue ? formatMoney(metrics.totalRevenue) : '—', detail: 'Gross sales' },
      { title: 'Orders', value: metrics.totalOrders ?? '—', detail: 'Processed' },
      { title: 'Users', value: metrics.totalUsers ?? '—', detail: 'Accounts' },
      { title: 'Products', value: metrics.totalProducts ?? '—', detail: 'Catalog' },
    ];
    const recentOrders = Array.isArray(metrics.recentOrders) ? metrics.recentOrders : [];
    const lowStockProducts = Array.isArray(metrics.lowStockProducts) ? metrics.lowStockProducts : [];
    const topSellingProducts = Array.isArray(metrics.topSellingProducts) ? metrics.topSellingProducts : [];

    if (isLoading) return <Skeleton lines={6} />;
    if (isError) return <ErrorState message="Unable to load the admin dashboard." />;

    return (
      <div className="space-y-8">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.title} className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">{card.title}</div>
              <div className="mt-5 text-4xl font-black tracking-[-0.06em] text-white">{card.value}</div>
              <div className="mt-3 text-sm text-[#c9c9c9]">{card.detail}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <h3 className="text-lg font-bold text-white">Recent orders</h3>
            {recentOrders.length === 0 ? <div className="mt-4 text-[#d3d3d3]">No recent orders available.</div> : (
              <div className="mt-5 space-y-3">
                {recentOrders.map((order) => (
                  <div key={order._id || order.id} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3">
                    <div>
                      <div className="font-semibold text-white">{order.orderNumber || order._id}</div>
                      <div className="text-xs text-[#a5a5a5]">{new Date(order.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">{formatMoney(order.grandTotal || 0)}</div>
                      <StatusBadge status={order.status || 'PENDING'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <h3 className="text-lg font-bold text-white">Low stock</h3>
            {lowStockProducts.length === 0 ? <div className="mt-4 text-[#d3d3d3]">No low-stock items right now.</div> : (
              <div className="mt-5 space-y-3">
                {lowStockProducts.map((product) => {
                  const variant = product.variants?.[0] || {};
                  return (
                    <div key={product._id} className="rounded-[18px] border border-white/10 bg-[#181818] p-4">
                      <div className="font-semibold text-white">{product.name}</div>
                      <div className="mt-1 text-sm text-[#bcbcbc]">SKU {variant.sku || '—'} • Stock {variant.stock ?? 0}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-lg font-bold text-white">Top sellers</h3>
          {topSellingProducts.length === 0 ? <div className="mt-4 text-[#d3d3d3]">No sales data yet.</div> : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topSellingProducts.map((product, index) => (
                <div key={product._id || index} className="rounded-[18px] border border-white/10 bg-[#181818] p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">#{index + 1}</div>
                  <div className="mt-2 font-semibold text-white">{product.name || 'Unknown product'}</div>
                  <div className="mt-2 text-sm text-[#d2d2d2]">Quantity: {product.quantity || 0}</div>
                  <div className="mt-1 text-sm text-[#d2d2d2]">Revenue: {formatMoney(product.revenue || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const ProductsSection = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [toast, setToast] = useState('');
    const [productForm, setProductForm] = useState({
      name: '',
      slug: '',
      brand: '',
      category: '',
      gender: 'UNISEX',
      price: 0,
      salePrice: '',
      status: 'DRAFT',
      featured: false,
      newArrival: false,
      bestSeller: false,
      shortDescription: '',
      description: '',
      tags: '',
      seo: { title: '', description: '', keywords: '' },
      images: '',
      variants: [{ sku: '', size: 'US 9', color: 'Black', stock: 0, price: 0, salePrice: '', images: '' }],
    });

    const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: () => apiClient.get('/categories').then((response) => response.data) });
    const { data: brandsData } = useQuery({ queryKey: ['admin-brands'], queryFn: () => apiClient.get('/brands').then((response) => response.data) });
    const { data, isLoading, isError } = useQuery({
      queryKey: ['admin-products', page, status, category, brand],
      queryFn: () => apiClient.get('/products', {
        params: { page, limit: 10, status: status || undefined, category: category || undefined, brand: brand || undefined },
      }).then((response) => response.data),
    });

    const categories = unwrapPayload(categoriesData) ?? [];
    const brands = unwrapPayload(brandsData) ?? [];
    const products = unwrapPayload(data)?.items ?? unwrapPayload(data)?.products ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;

    const filteredProducts = products.filter((product) => {
      const haystack = `${product.name} ${product.slug} ${product.description || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });

    const openCreate = () => {
      setEditingProduct(null);
      setProductForm({
        name: '',
        slug: '',
        brand: '',
        category: '',
        gender: 'UNISEX',
        price: 0,
        salePrice: '',
        status: 'DRAFT',
        featured: false,
        newArrival: false,
        bestSeller: false,
        shortDescription: '',
        description: '',
        tags: '',
        seo: { title: '', description: '', keywords: '' },
        images: '',
        variants: [{ sku: '', size: 'US 9', color: 'Black', stock: 0, price: 0, salePrice: '', images: '' }],
      });
      setIsFormOpen(true);
    };

    const openEdit = (product) => {
      setEditingProduct(product);
      setProductForm({
        name: product.name || '',
        slug: product.slug || '',
        brand: product.brand?._id || product.brand || '',
        category: product.category?._id || product.category || '',
        gender: product.gender || 'UNISEX',
        price: product.price || 0,
        salePrice: product.salePrice || '',
        status: product.status || 'DRAFT',
        featured: Boolean(product.featured),
        newArrival: Boolean(product.newArrival),
        bestSeller: Boolean(product.bestSeller),
        shortDescription: product.shortDescription || '',
        description: product.description || '',
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
        seo: {
          title: product.seo?.title || '',
          description: product.seo?.description || '',
          keywords: Array.isArray(product.seo?.keywords) ? product.seo.keywords.join(', ') : '',
        },
        images: Array.isArray(product.images) ? product.images.join(', ') : '',
        variants: (product.variants || []).map((variant) => ({
          sku: variant.sku || '',
          size: variant.size || 'US 9',
          color: variant.color || 'Black',
          stock: variant.stock ?? 0,
          price: variant.price ?? product.price ?? 0,
          salePrice: variant.salePrice ?? '',
          images: Array.isArray(variant.images) ? variant.images.join(', ') : '',
        })),
      });
      setIsFormOpen(true);
    };

    const saveProduct = async () => {
      const payload = {
        name: productForm.name,
        slug: productForm.slug || productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        brand: productForm.brand,
        category: productForm.category,
        gender: productForm.gender,
        price: Number(productForm.price || 0),
        salePrice: productForm.salePrice === '' ? null : Number(productForm.salePrice || 0),
        status: productForm.status,
        featured: Boolean(productForm.featured),
        newArrival: Boolean(productForm.newArrival),
        bestSeller: Boolean(productForm.bestSeller),
        shortDescription: productForm.shortDescription,
        description: productForm.description,
        tags: productForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        seo: {
          title: productForm.seo.title,
          description: productForm.seo.description,
          keywords: productForm.seo.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
        },
        images: productForm.images.split(',').map((image) => image.trim()).filter(Boolean),
        variants: productForm.variants.map((variant) => ({
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          price: Number(variant.price || productForm.price || 0),
          salePrice: variant.salePrice === '' ? null : Number(variant.salePrice || 0),
          stock: Number(variant.stock || 0),
          images: variant.images.split(',').map((image) => image.trim()).filter(Boolean),
        })),
      };

      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct._id}`, payload);
        setToast('Product updated successfully.');
      } else {
        await apiClient.post('/products', payload);
        setToast('Product created successfully.');
      }
      setIsFormOpen(false);
      setPage(1);
      setSearchParams({ section: 'products' });
    };

    const deleteProduct = async (productId) => {
      await apiClient.delete(`/products/${productId}`);
      setToast('Product archived successfully.');
      setPage(1);
    };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8b8b8b]">Catalog</div>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Products</h3>
            </div>
            <button type="button" onClick={openCreate} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">Add product</button>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search products" /></div>
            <FilterBar>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white">
                <option value="">All statuses</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white">
                <option value="">All categories</option>
                {categories.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}
              </select>
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className="rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white">
                <option value="">All brands</option>
                {brands.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}
              </select>
            </FilterBar>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
          {toast && <div className="mb-4"><Toast message={toast} /></div>}
          {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load products." /> : (
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => <div><div className="font-semibold text-white">{row.name}</div><div className="text-[11px] uppercase tracking-[0.2em] text-[#8d8d8d]">{row.slug}</div></div> },
                { key: 'brand', label: 'Brand', render: (row) => <span>{row.brand?.name || row.brand || '—'}</span> },
                { key: 'category', label: 'Category', render: (row) => <span>{row.category?.name || row.category || '—'}</span> },
                { key: 'price', label: 'Price', render: (row) => <span>{formatMoney(row.price || 0)}</span> },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'actions', label: 'Actions', render: (row) => (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(row)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Edit</button>
                    <button type="button" onClick={() => deleteProduct(row._id)} className="rounded-full border border-red-500/30 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-200">Delete</button>
                  </div>
                ) },
              ]}
              rows={filteredProducts}
              emptyMessage="No products match the current filters."
            />
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0d0d0d] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">{editingProduct ? 'Edit product' : 'Add product'}</h3>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">Close</button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FormField label="Name"><input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="Slug"><input value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="Brand"><select value={productForm.brand} onChange={(event) => setProductForm({ ...productForm, brand: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white"><option value="">Select brand</option>{brands.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}</select></FormField>
                <FormField label="Category"><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white"><option value="">Select category</option>{categories.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}</select></FormField>
                <FormField label="Gender"><select value={productForm.gender} onChange={(event) => setProductForm({ ...productForm, gender: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white"><option value="UNISEX">UNISEX</option><option value="MEN">MEN</option><option value="WOMEN">WOMEN</option><option value="KIDS">KIDS</option></select></FormField>
                <FormField label="Status"><select value={productForm.status} onChange={(event) => setProductForm({ ...productForm, status: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white"><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option><option value="ARCHIVED">ARCHIVED</option></select></FormField>
                <FormField label="Price"><input type="number" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: Number(event.target.value) })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="Sale price"><input type="number" value={productForm.salePrice} onChange={(event) => setProductForm({ ...productForm, salePrice: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="Featured"><input type="checkbox" checked={productForm.featured} onChange={(event) => setProductForm({ ...productForm, featured: event.target.checked })} className="h-4 w-4" /></FormField>
                <FormField label="New arrival"><input type="checkbox" checked={productForm.newArrival} onChange={(event) => setProductForm({ ...productForm, newArrival: event.target.checked })} className="h-4 w-4" /></FormField>
                <FormField label="Bestseller"><input type="checkbox" checked={productForm.bestSeller} onChange={(event) => setProductForm({ ...productForm, bestSeller: event.target.checked })} className="h-4 w-4" /></FormField>
                <FormField label="Tags"><input value={productForm.tags} onChange={(event) => setProductForm({ ...productForm, tags: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="Image URLs"><input value={productForm.images} onChange={(event) => setProductForm({ ...productForm, images: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="SEO title"><input value={productForm.seo.title} onChange={(event) => setProductForm({ ...productForm, seo: { ...productForm.seo, title: event.target.value } })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <FormField label="SEO description"><input value={productForm.seo.description} onChange={(event) => setProductForm({ ...productForm, seo: { ...productForm.seo, description: event.target.value } })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField>
                <div className="md:col-span-2"><FormField label="Short description"><textarea rows={3} value={productForm.shortDescription} onChange={(event) => setProductForm({ ...productForm, shortDescription: event.target.value })} className="w-full rounded-[20px] border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField></div>
                <div className="md:col-span-2"><FormField label="Description"><textarea rows={5} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} className="w-full rounded-[20px] border border-white/10 bg-[#181818] px-4 py-3 text-white" /></FormField></div>
                <div className="md:col-span-2 rounded-[20px] border border-white/10 bg-[#181818] p-4">
                  <div className="mb-3 text-sm font-medium text-white">Variant</div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <input value={productForm.variants[0]?.sku || ''} onChange={(event) => setProductForm({ ...productForm, variants: [{ ...productForm.variants[0], sku: event.target.value }] })} placeholder="SKU" className="rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-white" />
                    <input value={productForm.variants[0]?.size || ''} onChange={(event) => setProductForm({ ...productForm, variants: [{ ...productForm.variants[0], size: event.target.value }] })} placeholder="Size" className="rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-white" />
                    <input value={productForm.variants[0]?.color || ''} onChange={(event) => setProductForm({ ...productForm, variants: [{ ...productForm.variants[0], color: event.target.value }] })} placeholder="Color" className="rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-white" />
                    <input type="number" value={productForm.variants[0]?.price ?? productForm.price} onChange={(event) => setProductForm({ ...productForm, variants: [{ ...productForm.variants[0], price: Number(event.target.value) }], price: Number(event.target.value) })} placeholder="Variant price" className="rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-white" />
                    <input type="number" value={productForm.variants[0]?.stock ?? 0} onChange={(event) => setProductForm({ ...productForm, variants: [{ ...productForm.variants[0], stock: Number(event.target.value) }] })} placeholder="Stock" className="rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-white" />
                    <input value={productForm.variants[0]?.images || ''} onChange={(event) => setProductForm({ ...productForm, variants: [{ ...productForm.variants[0], images: event.target.value }] })} placeholder="Variant image URLs" className="rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-white" />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-full border border-white/10 px-5 py-3 text-sm text-white">Cancel</button>
                <button type="button" onClick={saveProduct} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Save product</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const CategoriesSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-categories'], queryFn: () => apiClient.get('/categories').then((response) => response.data) });
    const [form, setForm] = useState({ name: '', slug: '', description: '', image: '', sortOrder: 0, isActive: true });
    const [editingId, setEditingId] = useState(null);

    const categories = Array.isArray(unwrapPayload(data)) ? unwrapPayload(data) : unwrapPayload(data)?.categories ?? unwrapPayload(data)?.items ?? [];

    const saveCategory = async () => {
      const payload = { ...form, sortOrder: Number(form.sortOrder || 0) };
      if (editingId) {
        await apiClient.patch(`/categories/${editingId}`, payload);
      } else {
        await apiClient.post('/categories', payload);
      }
      setForm({ name: '', slug: '', description: '', image: '', sortOrder: 0, isActive: true });
      setEditingId(null);
      refetch();
    };

    const deleteCategory = async (id) => {
      await apiClient.delete(`/categories/${id}`);
      refetch();
    };

    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">{editingId ? 'Edit category' : 'Create category'}</h3>
          <div className="mt-5 space-y-4">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Category name" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Slug" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="Image URL" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} placeholder="Sort order" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <label className="flex items-center gap-3 text-sm text-[#d2d2d2]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4" /> Active</label>
            <button type="button" onClick={saveCategory} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">{editingId ? 'Update category' : 'Create category'}</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">Categories</h3>
          {isLoading ? <Skeleton lines={4} /> : isError ? <ErrorState message="Unable to load categories." /> : (
            <div className="mt-5 space-y-3">
              {categories.length === 0 ? <EmptyState title="No categories" description="Create your first category to organize products." /> : categories.map((category) => (
                <div key={category._id || category.id} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-[#181818] p-4">
                  <div>
                    <div className="font-semibold text-white">{category.name}</div>
                    <div className="mt-1 text-xs text-[#a3a3a3]">/{category.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditingId(category._id || category.id); setForm({ name: category.name || '', slug: category.slug || '', description: category.description || '', image: category.image || '', sortOrder: category.sortOrder || 0, isActive: category.isActive !== false }); }} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Edit</button>
                    <button type="button" onClick={() => deleteCategory(category._id || category.id)} className="rounded-full border border-red-500/30 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-200">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const BrandsSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-brands'], queryFn: () => apiClient.get('/brands').then((response) => response.data) });
    const [form, setForm] = useState({ name: '', slug: '', description: '', logo: '', isActive: true });
    const [editingId, setEditingId] = useState(null);
    const brands = Array.isArray(unwrapPayload(data)) ? unwrapPayload(data) : unwrapPayload(data)?.brands ?? unwrapPayload(data)?.items ?? [];

    const saveBrand = async () => {
      if (editingId) await apiClient.patch(`/brands/${editingId}`, form); else await apiClient.post('/brands', form);
      setForm({ name: '', slug: '', description: '', logo: '', isActive: true });
      setEditingId(null);
      refetch();
    };

    const deleteBrand = async (id) => { await apiClient.delete(`/brands/${id}`); refetch(); };

    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">{editingId ? 'Edit brand' : 'Create brand'}</h3>
          <div className="mt-5 space-y-4">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Brand name" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Slug" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} placeholder="Logo URL" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <label className="flex items-center gap-3 text-sm text-[#d2d2d2]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4" /> Active</label>
            <button type="button" onClick={saveBrand} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">{editingId ? 'Update brand' : 'Create brand'}</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">Brands</h3>
          {isLoading ? <Skeleton lines={4} /> : isError ? <ErrorState message="Unable to load brands." /> : (
            <div className="mt-5 space-y-3">
              {brands.length === 0 ? <EmptyState title="No brands" description="Create the first brand in your catalog." /> : brands.map((brand) => (
                <div key={brand._id || brand.id} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-[#181818] p-4">
                  <div>
                    <div className="font-semibold text-white">{brand.name}</div>
                    <div className="mt-1 text-xs text-[#a3a3a3]">/{brand.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditingId(brand._id || brand.id); setForm({ name: brand.name || '', slug: brand.slug || '', description: brand.description || '', logo: brand.logo || '', isActive: brand.isActive !== false }); }} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Edit</button>
                    <button type="button" onClick={() => deleteBrand(brand._id || brand.id)} className="rounded-full border border-red-500/30 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-200">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const InventorySection = () => {
    const [page, setPage] = useState(1);
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [adjustingVariant, setAdjustingVariant] = useState(null);
    const [delta, setDelta] = useState(0);
    const [reason, setReason] = useState('admin_adjustment');
    const [referenceId, setReferenceId] = useState('');
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-inventory', page, lowStockOnly], queryFn: () => apiClient.get('/admin/inventory', { params: { page, limit: 10, lowStock: lowStockOnly || undefined } }).then((response) => response.data) });
    const { data: lowStockData } = useQuery({ queryKey: ['admin-low-stock'], queryFn: () => apiClient.get('/admin/inventory/low-stock').then((response) => response.data) });
    const items = unwrapPayload(data)?.items ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;
    const lowStockItems = unwrapPayload(lowStockData)?.items ?? [];

    const adjustInventory = async () => {
      await apiClient.post(`/admin/inventory/${adjustingVariant}/adjust`, { delta: Number(delta), reason, referenceId });
      setAdjustingVariant(null);
      setDelta(0);
      setReason('admin_adjustment');
      setReferenceId('');
    };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Inventory</div>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Stock control</h3>
            </div>
            <label className="flex items-center gap-3 text-sm text-[#d8d8d8]"><input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} className="h-4 w-4" /> Low stock only</label>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-lg font-bold text-white">Low-stock summary</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {lowStockItems.length === 0 ? <span className="text-[#d3d3d3]">No stock alerts.</span> : lowStockItems.slice(0, 6).map((item) => <span key={item._id} className="rounded-full border border-white/10 bg-[#181818] px-3 py-2 text-xs text-white">{item.product?.name || 'Item'}: {item.availableStock}</span>)}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
          {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load inventory." /> : (
            <DataTable
              columns={[
                { key: 'product', label: 'Product', render: (row) => <div className="font-semibold text-white">{row.product?.name || 'Product'}</div> },
                { key: 'variant', label: 'Variant', render: (row) => <span>{row.variant || '—'}</span> },
                { key: 'availableStock', label: 'Stock', render: (row) => <span>{row.availableStock}</span> },
                { key: 'reservedStock', label: 'Reserved', render: (row) => <span>{row.reservedStock}</span> },
                { key: 'lowStockThreshold', label: 'Threshold', render: (row) => <span>{row.lowStockThreshold}</span> },
                { key: 'actions', label: 'Adjust', render: (row) => <button type="button" onClick={() => setAdjustingVariant(row.variant)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Adjust</button> },
              ]}
              rows={items}
              emptyMessage="No inventory records found."
            />
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>

        {adjustingVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0d0d0d] p-6">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">Adjust inventory</h3>
                <button type="button" onClick={() => setAdjustingVariant(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">Close</button>
              </div>
              <div className="space-y-4">
                <input type="number" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="Delta (+/-)" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
                <input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="Reference ID" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
                <button type="button" onClick={adjustInventory} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Apply adjustment</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const OrdersSection = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-orders', page, statusFilter], queryFn: () => apiClient.get('/orders', { params: { page, limit: 10 } }).then((response) => response.data) });
    const orders = unwrapPayload(data)?.orders ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;
    const filteredOrders = orders.filter((order) => {
      const haystack = `${order.orderNumber || ''} ${order.customerSnapshot?.email || ''} ${order.customerSnapshot?.phone || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase()) && (!statusFilter || order.status === statusFilter);
    });

    const updateStatus = async (id, status) => { await apiClient.patch(`/orders/${id}/status`, { status }); };
    const createShipment = async (id) => { const result = await apiClient.post(`/admin/orders/${id}/ship`); return unwrapPayload(result.data)?.shipment ?? result.data; };
    const downloadInvoice = async (id) => {
      const response = await apiClient.get(`/admin/orders/${id}/invoice`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `invoice-${id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    };
    const refundOrder = async (id) => {
      const amount = window.prompt('Refund amount (optional)', '0');
      const reason = window.prompt('Refund reason', 'Customer requested refund');
      if (amount === null || reason === null) return;
      await apiClient.post(`/admin/orders/${id}/refund`, { amount: Number(amount || 0), reason });
    };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Operations</div>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Orders</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search orders" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white">
                <option value="">All statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? <Skeleton lines={6} /> : isError ? <ErrorState message="Unable to load orders." /> : (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
            <DataTable
              columns={[
                { key: 'orderNumber', label: 'Order', render: (row) => <div><div className="font-semibold text-white">{row.orderNumber}</div><div className="text-[11px] uppercase tracking-[0.18em] text-[#8d8d8d]">{row.customerSnapshot?.email || 'Customer'}</div></div> },
                { key: 'items', label: 'Items', render: (row) => <span>{row.items?.length || 0}</span> },
                { key: 'grandTotal', label: 'Total', render: (row) => <span>{formatMoney(row.grandTotal || 0)}</span> },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'paymentStatus', label: 'Payment', render: (row) => <StatusBadge status={row.paymentStatus} /> },
                { key: 'actions', label: 'Actions', render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <select defaultValue={row.status} onChange={(event) => updateStatus(row._id, event.target.value)} className="rounded-full border border-white/10 bg-[#181818] px-3 py-2 text-xs text-white">
                      {['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((statusItem) => <option key={statusItem} value={statusItem}>{statusItem}</option>)}
                    </select>
                    <button type="button" onClick={() => createShipment(row._id)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Ship</button>
                    <button type="button" onClick={() => downloadInvoice(row._id)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Invoice</button>
                    <button type="button" onClick={() => refundOrder(row._id)} className="rounded-full border border-red-500/30 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-200">Refund</button>
                  </div>
                ) },
              ]}
              rows={filteredOrders}
              emptyMessage="No orders match the current filter."
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    );
  };

  const UsersSection = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-users', page], queryFn: () => apiClient.get('/admin/users', { params: { page, limit: 10 } }).then((response) => response.data) });
    const users = unwrapPayload(data)?.items ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;
    const filteredUsers = users.filter((user) => `${user.firstName || ''} ${user.lastName || ''} ${user.email || ''}`.toLowerCase().includes(search.toLowerCase()));

    const toggleStatus = async (id, isActive) => { await adminApi.updateUserStatus(id, isActive); };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">People</div>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Users</h3>
            </div>
            <div className="w-full max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Search users" /></div>
          </div>
        </div>

        {isLoading ? <Skeleton lines={6} /> : isError ? <ErrorState message="Unable to load user accounts." /> : (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => <span className="font-semibold text-white">{row.firstName} {row.lastName}</span> },
                { key: 'email', label: 'Email', render: (row) => <span>{row.email}</span> },
                { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} /> },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                { key: 'actions', label: 'Action', render: (row) => <button type="button" onClick={() => toggleStatus(row._id, !row.isActive)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">{row.isActive ? 'Disable' : 'Enable'}</button> },
              ]}
              rows={filteredUsers}
              emptyMessage="No users found."
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    );
  };

  const ReviewsSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-reviews'], queryFn: () => apiClient.get('/admin/reviews').then((response) => response.data) });
    const reviews = unwrapPayload(data)?.reviews ?? [];

    const updateReview = async (id, status) => {
      if (status === 'APPROVED') await apiClient.patch(`/admin/reviews/${id}/approve`); else await apiClient.patch(`/admin/reviews/${id}/reject`);
      refetch();
    };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Moderation</div>
          <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Reviews</h3>
        </div>

        {isLoading ? <Skeleton lines={6} /> : isError ? <ErrorState message="Unable to load reviews." /> : (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
            <DataTable
              columns={[
                { key: 'product', label: 'Product', render: (row) => <div className="font-semibold text-white">{row.product?.name || 'Product'}</div> },
                { key: 'user', label: 'Customer', render: (row) => <span>{row.user?.firstName || ''} {row.user?.lastName || ''}</span> },
                { key: 'rating', label: 'Rating', render: (row) => <span>{row.rating || 0}/5</span> },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || 'PENDING'} /> },
                { key: 'actions', label: 'Action', render: (row) => (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateReview(row._id, 'APPROVED')} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Approve</button>
                    <button type="button" onClick={() => updateReview(row._id, 'REJECTED')} className="rounded-full border border-red-500/30 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-200">Reject</button>
                  </div>
                ) },
              ]}
              rows={reviews}
              emptyMessage="No reviews await moderation."
            />
          </div>
        )}
      </div>
    );
  };

  const NotificationsSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-notifications'], queryFn: () => adminApi.notifications() });
    const notifications = unwrapPayload(data)?.items ?? unwrapPayload(data)?.notifications ?? [];
    const markRead = async (id) => { await adminApi.markNotificationRead(id); refetch(); };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Alerts</div>
          <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Notifications</h3>
        </div>

        {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load notifications." /> : (
          <div className="space-y-3">
            {notifications.length === 0 ? <EmptyState title="All clear" description="No admin notifications at the moment." /> : notifications.map((notification) => (
              <div key={notification._id || notification.id} className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">{notification.title || 'Notification'}</div>
                    <p className="mt-2 text-[#d1d1d1]">{notification.message || notification.body || 'No message available.'}</p>
                  </div>
                  {!notification.readAt && <button type="button" onClick={() => markRead(notification._id || notification.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">Mark read</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const BlogSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-blog'], queryFn: () => apiClient.get('/blog/admin/all').then((response) => response.data) });
    const posts = unwrapPayload(data)?.posts ?? [];
    const [form, setForm] = useState({ title: '', slug: '', status: 'DRAFT', excerpt: '', coverImage: '', content: '', seo: { title: '', description: '' }, tags: '' });

    const savePost = async () => {
      const payload = {
        title: form.title,
        slug: form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: form.status,
        excerpt: form.excerpt,
        coverImage: form.coverImage,
        content: form.content,
        seo: { title: form.seo.title, description: form.seo.description },
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };
      await apiClient.post('/blog', payload);
      refetch();
      setForm({ title: '', slug: '', status: 'DRAFT', excerpt: '', coverImage: '', content: '', seo: { title: '', description: '' }, tags: '' });
    };

    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">Create article</h3>
          <div className="mt-5 space-y-4">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Slug" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white"><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option></select>
            <input value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} placeholder="Cover image URL" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <textarea rows={3} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder="Excerpt" className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <textarea rows={6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Content" className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags, comma separated" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <button type="button" onClick={savePost} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Save article</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">Posts</h3>
          {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load blog posts." /> : (
            <div className="mt-5 space-y-3">
              {posts.length === 0 ? <EmptyState title="No posts" description="Publish the first story to the KICKS journal." /> : posts.map((post) => (
                <div key={post._id || post.id} className="rounded-[18px] border border-white/10 bg-[#181818] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{post.title}</div>
                      <div className="mt-1 text-xs text-[#a0a0a0]">{post.slug}</div>
                    </div>
                    <StatusBadge status={post.status || 'DRAFT'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const CmsSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-cms'], queryFn: () => apiClient.get('/cms/admin/all').then((response) => response.data) });
    const items = unwrapPayload(data)?.items ?? [];
    const [form, setForm] = useState({ key: '', type: 'HERO', content: '{}', sortOrder: 0, active: true });

    const saveCms = async () => {
      const payload = {
        key: form.key,
        type: form.type,
        content: JSON.parse(form.content || '{}'),
        sortOrder: Number(form.sortOrder || 0),
        active: Boolean(form.active),
      };
      await apiClient.post('/cms', payload);
      refetch();
      setForm({ key: '', type: 'HERO', content: '{}', sortOrder: 0, active: true });
    };

    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-[-0.05em] text-white">CMS content</h3>
          <div className="mt-5 space-y-4">
            <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="CMS key" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white"><option value="HERO">HERO</option><option value="BANNER">BANNER</option><option value="PROMOTION">PROMOTION</option><option value="FEATURED">FEATURED</option></select>
            <textarea rows={6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder='JSON payload e.g. {"title":"Welcome"}' className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} placeholder="Sort order" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
            <label className="flex items-center gap-3 text-sm text-[#d2d2d2]"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4" /> Active</label>
            <button type="button" onClick={saveCms} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Save CMS block</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load CMS items." /> : (
            <div className="space-y-3">
              {items.length === 0 ? <EmptyState title="No CMS blocks" description="Create content blocks for landing pages and promotions." /> : items.map((item) => (
                <div key={item._id || item.id} className="rounded-[18px] border border-white/10 bg-[#181818] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{item.key}</div>
                      <div className="mt-1 text-xs text-[#9e9e9e]">Type: {item.type}</div>
                    </div>
                    <StatusBadge status={item.active ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const AiSection = () => {
    const [prompt, setPrompt] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const generateDraft = async () => {
      const result = await adminApi.generateAiProduct({ prompt, imageUrl });
      setDraft(result?.data?.draft || result?.draft || null);
      setToast('AI draft generated successfully.');
    };

    const saveAsProduct = async () => {
      if (!draft) return;
      setSaving(true);
      try {
        await apiClient.post('/products', {
          name: draft.name || 'AI product',
          slug: draft.slug || (draft.name || 'ai-product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'DRAFT',
          shortDescription: draft.shortDescription || '',
          description: draft.description || '',
          tags: Array.isArray(draft.tags) ? draft.tags : [],
          price: 0,
          seo: { title: draft.seoTitle || draft.name, description: draft.seoDescription || draft.shortDescription },
          images: [],
          variants: [{ sku: 'AI-DRAFT', size: 'US 9', color: draft.color || 'Black', price: 0, stock: 0 }],
        });
        setToast('AI draft saved as a draft product.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">AI</div>
          <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Product generator</h3>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <div className="space-y-4">
              <textarea rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the product concept to generate a draft" className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-white" />
              <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Optional reference image URL" className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
              <button type="button" onClick={generateDraft} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Generate draft</button>
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            {draft ? (
              <div className="space-y-3 text-[#d7d7d7]">
                <div className="font-semibold text-white">{draft.name}</div>
                <div>{draft.shortDescription}</div>
                <div>{draft.description}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#a4a4a4]">Category: {draft.category || '—'} • Style: {draft.style || '—'} • Color: {draft.color || '—'}</div>
                <div className="flex gap-3">
                  <button type="button" onClick={saveAsProduct} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black" disabled={saving}>{saving ? 'Saving...' : 'Save as draft'}</button>
                  <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-white/10 px-5 py-2 text-sm text-white">Clear</button>
                </div>
              </div>
            ) : <div className="text-[#d8d8d8]">No draft generated yet. The backend AI flow never invents price, stock, SKU, or technical specs.</div>}
          </div>
        </div>
        {toast && <Toast message={toast} />}
      </div>
    );
  };

  const AuditSection = () => {
    const [page, setPage] = useState(1);
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-audit', page], queryFn: () => adminApi.auditLogs({ page, limit: 10 }) });
    const audits = unwrapPayload(data)?.items ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Compliance</div>
          <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Audit log</h3>
        </div>

        {isLoading ? <Skeleton lines={6} /> : isError ? <ErrorState message="Unable to load audit log." /> : (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
            <DataTable
              columns={[
                { key: 'action', label: 'Action', render: (row) => <div className="font-semibold text-white">{row.action}</div> },
                { key: 'resource', label: 'Resource', render: (row) => <span>{row.resource}</span> },
                { key: 'actor', label: 'Actor', render: (row) => <span>{row.actor || 'System'}</span> },
                { key: 'createdAt', label: 'Time', render: (row) => <span>{new Date(row.createdAt).toLocaleString()}</span> },
              ]}
              rows={audits}
              emptyMessage="No audit activity logged."
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    );
  };

  const SettingsSection = () => {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-settings'], queryFn: () => adminApi.settings() });
    const settings = unwrapPayload(data)?.settings ?? [];
    const [draft, setDraft] = useState({});

    const updateSetting = async (key, currentValue) => {
      await adminApi.updateSetting(key, { value: currentValue, description: 'Updated from admin UI' });
      refetch();
    };

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Workspace</div>
          <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">Settings</h3>
        </div>

        {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load settings." /> : (
          <div className="space-y-3">
            {settings.map((setting) => (
              <div key={setting._id || setting.key} className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex-1">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#8f8f8f]">{setting.key}</div>
                    <div className="mt-3 text-sm text-[#d7d7d7]">{typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value || {})}</div>
                  </div>
                  <div className="w-full max-w-xl">
                    <input value={draft[setting.key] ?? (typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value || {}))} onChange={(event) => setDraft({ ...draft, [setting.key]: event.target.value })} className="w-full rounded-full border border-white/10 bg-[#181818] px-4 py-3 text-white" />
                  </div>
                  <button type="button" onClick={() => updateSetting(setting.key, draft[setting.key] ?? setting.value)} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">Save</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <DashboardSection />;
      case 'products': return <ProductsSection />;
      case 'categories': return <CategoriesSection />;
      case 'brands': return <BrandsSection />;
      case 'inventory': return <InventorySection />;
      case 'orders': return <OrdersSection />;
      case 'users': return <UsersSection />;
      case 'reviews': return <ReviewsSection />;
      case 'notifications': return <NotificationsSection />;
      case 'ai': return <AiSection />;
      case 'blog': return <BlogSection />;
      case 'cms': return <CmsSection />;
      case 'audit': return <AuditSection />;
      case 'settings': return <SettingsSection />;
      default: return <DashboardSection />;
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 lg:px-8">
      <PageMeta title="Admin | KICKS" description="KICKS administrator dashboard" />
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Admin</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">KICKS control center</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">Storefront</Link>
          <div className="rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm text-white">Protected route</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[26px] border border-white/10 bg-[#111111] p-4">
          <div className="mb-4 text-[10px] uppercase tracking-[0.28em] text-[#8a8a8a]">Navigation</div>
          <nav className="space-y-2">
            {sections.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                className={`w-full rounded-full px-4 py-3 text-left text-sm uppercase tracking-[0.18em] ${section === item ? 'bg-white text-black' : 'border border-white/10 bg-transparent text-white'}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div>{renderSection()}</div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-20 text-center lg:px-8">
      <PageMeta title="Page not found | KICKS" description="The page you requested does not exist" />
      <h1 className="text-5xl font-black uppercase tracking-[-0.08em] text-white">404</h1>
      <p className="mt-5 text-[#c7c7c7]">This page does not exist yet.</p>
      <Link to="/" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">Back home</Link>
    </div>
  );
}
