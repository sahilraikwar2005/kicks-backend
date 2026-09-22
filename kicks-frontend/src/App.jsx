import { Fragment, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Heart,
  Info,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Package,
  Pencil,
  Plus,
  Settings,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  Truck,
  RefreshCw,
  Users,
  X,
  User2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from './api/client';
import { colorKey, dedupeColors, distinctSizes, normalizeColorName, syncMatrixRows } from './utils/variantMatrix';
import { NEUTRAL_PRODUCT_IMAGE } from './components/ui/productImage';
import { cartLineImage } from './utils/productGallery';
import { addressesApi } from './api/addresses.api';
import { SearchableCombobox, PincodeField } from './components/ui/AddressFields';
import { INDIA_STATES, citySuggestions, pincodeStateConflictMessage } from './data/indiaLocations';
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

function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white">Checking access...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

const isAdminRole = (role) => role === 'ADMIN';

function CustomerRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white">Checking session...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
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
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

// Size systems/ranges for the admin variant manager. Stored size strings keep
// the system prefix (e.g. "UK 6") to match the existing catalog + storefront
// size filters. UK is the KICKS catalog default (see seed data).
const SIZE_SYSTEMS = {
  UK: ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
  US: ['US 6', 'US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12', 'US 13'],
  EU: ['EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44', 'EU 45', 'EU 46'],
};

const detectSizeSystem = (size) => {
  const prefix = String(size || '').trim().split(' ')[0]?.toUpperCase();
  return SIZE_SYSTEMS[prefix] ? prefix : 'UK';
};

// Normalizes persisted product.colorImages into { DisplayName: [urls] }.
const normalizePersistedColorImages = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, urls] of Object.entries(value)) {
    const name = String(key || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const list = (Array.isArray(urls) ? urls : [])
      .filter((url) => typeof url === 'string' && url.trim())
      .map((url) => url.trim());
    if (list.length > 0) result[name] = list;
  }
  return result;
};

// Deterministic SKU generation mirrored from src/modules/products/sku.js.
// Format: BRAND-MODEL-COLOR-SIZE. The backend revalidates/regenerates, so the
// admin never types a SKU and displayed values match persisted ones.
const SKU_COLOR_CODES = {
  WHITE: 'WHT', BLACK: 'BLK', RED: 'RED', BLUE: 'BLU', GREEN: 'GRN', GREY: 'GRY', GRAY: 'GRY',
  YELLOW: 'YLW', ORANGE: 'ORG', PINK: 'PNK', PURPLE: 'PUR', BROWN: 'BRN', BEIGE: 'BGE',
  NAVY: 'NVY', GOLD: 'GLD', SILVER: 'SLV', CREAM: 'CRM', IVORY: 'IVR', TAN: 'TAN',
  MAROON: 'MRN', TEAL: 'TEA', CYAN: 'CYN', LIME: 'LIM', OLIVE: 'OLV', KHAKI: 'KHK',
  CORAL: 'COR', SALMON: 'SAL', BURGUNDY: 'BUR', CHARCOAL: 'CHR', MINT: 'MNT', SKY: 'SKY',
  ROYAL: 'RYL', CRIMSON: 'CRM', INDIGO: 'IND', VIOLET: 'VIO', MAGENTA: 'MAG',
  TURQUOISE: 'TRQ', MUSTARD: 'MUS', RUST: 'RST', COBALT: 'CBL', DENIM: 'DNM',
  MULTI: 'MLT', MULTICOLOR: 'MLT', MULTICOLOUR: 'MLT',
};

const sanitizeSkuSegment = (value) => String(value || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-');

const skuBrandToken = (brandName) => sanitizeSkuSegment(brandName).replace(/-/g, '').slice(0, 10);

const skuModelToken = (productName, brandName) => {
  const brand = sanitizeSkuSegment(brandName).replace(/-/g, '');
  let compact = sanitizeSkuSegment(productName).replace(/-/g, '');
  if (brand && compact.startsWith(brand)) compact = compact.slice(brand.length);
  compact = compact.slice(0, 12);
  return compact || 'ITEM';
};

const skuColorCode = (color) => {
  const tokens = String(color || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean).slice(0, 3);
  if (tokens.length === 0) return '';
  return tokens.map((token) => SKU_COLOR_CODES[token] || token.slice(0, 3)).join('').slice(0, 9);
};

const skuSizeCode = (size) => sanitizeSkuSegment(size).replace(/-/g, '');

const buildVariantSku = ({ brand, model, color, size }) => {
  const segments = [skuBrandToken(brand), skuModelToken(model, brand), skuColorCode(color), skuSizeCode(size)].filter(Boolean);
  if (segments.length < 2) return `KICKS-${segments.join('-') || 'ITEM'}`;
  return segments.join('-');
};

// Maps real upload API failures (POST /uploads/images) to user-friendly text.
// Backend contract: 400 invalid/empty file, 413 over size limit, 415 unsupported
// type, 401/403 auth, 502/503 Cloudinary/storage unavailable.
function getUploadErrorMessage(error) {
  const status = Number(error?.status);
  if (status === 415) return 'Unsupported file type. Use JPG, PNG or WebP, then choose the file again.';
  if (status === 413) return 'File exceeds the 5 MB limit. Choose a smaller image to retry.';
  if (status === 401 || status === 403) return 'Your session expired. Please log in again, then retry the upload.';
  if (status === 502 || status === 503) return 'Upload service unavailable. Please try again in a moment.';
  if (error?.message) return `${error.message} Choose the files again to retry.`;
  return 'Image upload failed. Choose the files again to retry.';
}

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
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogDetailPage />} />
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
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/products" element={<AdminPage initialSection="products" />} />
          <Route path="/admin/inventory" element={<AdminPage initialSection="inventory" />} />
          <Route path="/admin/orders" element={<AdminPage initialSection="orders" />} />
          <Route path="/admin/customers" element={<AdminPage initialSection="customers" />} />
          <Route path="/admin/shipping" element={<AdminPage initialSection="shipping" />} />
          <Route path="/admin/settings" element={<AdminPage initialSection="settings" />} />
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
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Categories | AJ SPORTS" description="Browse premium sneaker categories" />
      <div className="mb-8">
        <p className="kicks-eyebrow">Shop all</p>
        <h1 className="mt-3 kicks-section-title">Categories</h1>
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

// function WishlistPage() {
//   const queryClient = useQueryClient();
//   const { data, isLoading, isError } = useQuery({ queryKey: ['wishlist'], queryFn: () => wishlistApi.getWishlist() });
//   const removeMutation = useMutation({
//     mutationFn: (productId) => wishlistApi.removeFromWishlist(productId),
//     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
//   });

//   const wishlist = unwrapPayload(data)?.wishlist ?? unwrapPayload(data)?.items ?? unwrapPayload(data)?.products ?? [];
//   const items = Array.isArray(wishlist) ? wishlist : wishlist.items ?? [];

//   return (
//     <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
//       <PageMeta title="Wishlist | AJ SPORTS" description="Your saved items" />
//       <div className="mb-8 flex items-center justify-between gap-4">
//         <div>
//           <p className="kicks-eyebrow">Saved</p>
//           <h1 className="mt-3 kicks-section-title">Wishlist</h1>
//         </div>
//         {items.length > 0 && <Link to="/shop" className="kicks-btn kicks-btn-secondary kicks-btn-sm text-sm">Browse styles</Link>}
//       </div>

//       {isLoading ? (
//         <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
//           {[...Array(4)].map((_, index) => <div key={index} className="h-[280px] animate-pulse rounded-[24px] bg-[#111111]" />)}
//         </div>
//       ) : isError ? (
//         <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 text-[#d7d7d7]">Unable to load wishlist from the backend.</div>
//       ) : items.length === 0 ? (
//         <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-8 text-center sm:p-12">
//           <h2 className="text-2xl font-black uppercase tracking-[-0.06em] text-white sm:text-3xl">Your wishlist is empty</h2>
//           <p className="mt-4 text-[#c3c3c3]">Save the pairs you love to revisit them later.</p>
//           <Link to="/shop" className="mt-8 inline-flex kicks-btn kicks-btn-primary">Shop now</Link>
//         </div>
//       ) : (
//         <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
//           {items.map((item) => {
//             const product = item.product ?? item;
//             const productId = product._id || product.id || item.productId;
//             const price = Number(product?.price || 0);
//             return (
//               <div key={productId} className="rounded-[26px] border border-white/10 bg-[#111111] p-4">
//                 <img src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'} alt={product?.name || 'Saved product'} className="h-64 w-full rounded-[20px] object-cover" />
//                 <div className="mt-4 flex items-start justify-between gap-3">
//                   <div>
//                     <p className="text-[10px] uppercase tracking-[0.26em] text-[#a3a3a3]">{product?.brand?.name || 'AJ SPORTS'}</p>
//                     <Link to={`/products/${product?.slug || productId}`} className="mt-2 block text-xl font-medium text-white">{product?.name}</Link>
//                   </div>
//                   <button type="button" onClick={() => removeMutation.mutate(productId)} className="rounded-full border border-white/10 p-2 text-white">✕</button>
//                 </div>
//                 <div className="mt-4 text-lg font-semibold text-white">{formatMoney(price)}</div>
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }
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
              <button type="button" onClick={() => setShowAddressForm((current) => !current)} className="shrink-0 kicks-btn kicks-btn-secondary kicks-btn-sm transition hover:border-white/30">
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
  const { logout } = useAuth();
  const navigate = useNavigate();
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
            className="inline-flex items-center gap-2 kicks-btn kicks-btn-primary kicks-btn-sm transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-60"
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
      navigate(isAdminRole(signedInUser?.role) ? '/admin' : '/account', { replace: true });
    } catch (error) {
      showToast(error?.message || 'Login failed. Please check your credentials.', 'error');
    }
  };

  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/account'} replace />;

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
    <div className="mx-auto max-w-[520px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Forgot password | AJ SPORTS" description="Recover your AJ SPORTS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-10">
        <p className="kicks-eyebrow">Account</p>
        <h1 className="mt-4 kicks-section-title">Forgot password</h1>
        {submitted ? (
          <p className="mt-6 text-[#d0d0d0]">If the email exists, a reset link has been sent.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
              <input {...register('email')} className="w-full kicks-field text-white outline-none transition focus:border-white/25" />
              {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full kicks-btn kicks-btn-primary transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Sending...' : 'Send reset link'}</button>
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

function BlogPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['blog'], queryFn: () => blogApi.list() });
  const posts = unwrapPayload(data)?.posts ?? unwrapPayload(data)?.items ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title="Journal | AJ SPORTS" description="AJ SPORTS stories and style insights" />
      <div className="mb-8">
        <p className="kicks-eyebrow">Journal</p>
        <h1 className="mt-3 kicks-section-title">Stories & style</h1>
      </div>
      {isLoading ? <div className="grid gap-6 lg:grid-cols-3"><div className="h-[300px] animate-pulse rounded-[24px] bg-[#111111]" /><div className="h-[300px] animate-pulse rounded-[24px] bg-[#111111]" /><div className="h-[300px] animate-pulse rounded-[24px] bg-[#111111]" /></div> : isError ? <div className="rounded-[24px] border border-white/10 bg-[#111111] p-8 text-[#d4d4d4]">Unable to load editorial content.</div> : <div className="grid gap-6 lg:grid-cols-3">{posts.map((post) => (
        <Link key={post.slug || post._id} to={`/blog/${post.slug || post._id}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
          <img src={post.coverImage || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80'} alt={post.title || 'Blog article'} className="h-72 w-full object-cover" />
          <div className="p-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#a1a1a1]">{post.category || 'Culture'}</p>
            <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">{post.title}</h3>
            <p className="mt-3 text-[#d0d0d0]">{post.shortDescription || post.excerpt || 'Read the latest AJ SPORTS conversation.'}</p>
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
    <article className="mx-auto max-w-[1200px] px-4 py-6 sm:py-12 lg:px-8">
      <PageMeta title={`${post.title} | AJ SPORTS`} description={post.shortDescription || post.excerpt || 'AJ SPORTS editorial'} />
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#111111]">
        <img src={post.coverImage || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'} alt={post.title} className="h-[420px] w-full object-cover" />
      </div>
      <div className="mt-8 max-w-[900px]">
        <p className="kicks-eyebrow">{post.category || 'Journal'}</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.08em] text-white sm:text-5xl">{post.title}</h1>
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

function DataTable({ columns = [], rows = [], emptyMessage = 'No records found.' }) {
  if (!rows.length) {
    return <div className="rounded-[14px] border border-dashed border-white/15 bg-[#0d0d0d] p-8 text-center text-sm text-[#a0a0a0]">{emptyMessage}</div>;
  }

  return (
    <div className="admin-scroll overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#0d0d0d]">
      <table className="min-w-full text-left text-[13px] text-[#d8d8d8]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2.5 font-semibold">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row._id || rowIndex}>
              {columns.map((column) => (
                <td key={`${rowIndex}-${column.key}`} className="px-3 py-2.5 align-top">
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
    <div className="mt-4 flex items-center justify-end gap-1.5">
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="inline-flex h-8 items-center rounded-[8px] border border-white/10 bg-white/[0.02] px-3 text-xs font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40">Prev</button>
      <span className="px-1 text-xs tabular-nums text-[#8d8d8d]">Page {page} / {totalPages}</span>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="inline-flex h-8 items-center rounded-[8px] border border-white/10 bg-white/[0.02] px-3 text-xs font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
    </div>
  );
}

function MovementHistory({ movements, movementsQuery, variantLabel }) {
  if (movementsQuery.isLoading) return <Skeleton lines={2} />;
  if (movementsQuery.isError) return <p className="text-xs text-red-300">Unable to load movement history.</p>;
  if (movements.length === 0) return <p className="text-xs text-[#a0a0a0]">No movements recorded for {variantLabel}.</p>;
  return (
    <ul className="space-y-2">
      {movements.map((movement) => (
        <li key={movement._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-white/5 bg-[#101010] px-3 py-2 text-xs">
          <span className="text-[#767676]">
            {movement.createdAt ? new Date(movement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d2d2d2]">{movement.type}</span>
          <span className={`font-bold ${Number(movement.quantity) < 0 ? 'text-red-200' : 'text-emerald-300'}`}>
            {Number(movement.quantity) > 0 ? `+${movement.quantity}` : movement.quantity}
          </span>
          <span className="min-w-0 flex-1 truncate text-[#8d8d8d]">{movement.reason || ''}</span>
        </li>
      ))}
    </ul>
  );
}

function ProductInventoryDetail({
  product,
  stats,
  onBack,
  productImage,
  stockPill,
  getVariantStock,
  variantState,
  saleBusy,
  onSell,
  onAdjust,
  movementsVariantId,
  onToggleMovements,
  movements,
  movementsQuery,
}) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const colors = [...new Set(variants.map((variant) => String(variant?.color || '—')))];
  const showColorGroups = colors.length > 1;
  const groups = showColorGroups
    ? colors.map((color) => ({ color, rows: variants.filter((variant) => String(variant?.color || '—') === color) }))
    : [{ color: null, rows: variants }];

  const variantById = (id) => variants.find((variant) => String(variant?._id) === String(id));
  const activeMovementVariant = movementsVariantId ? variantById(movementsVariantId) : null;

  const renderActions = (variant, compact = false) => {
    const stock = getVariantStock(variant);
    const busy = saleBusy === String(variant._id);
    return (
      <span className={`flex items-center ${compact ? 'gap-1.5' : 'gap-1.5 justify-end'}`}>
        <button
          type="button"
          onClick={() => onSell(variant)}
          disabled={stock <= 0 || busy}
          aria-label={`Sell 1 ${variant.size} offline`}
          title={stock <= 0 ? 'Out of stock' : 'Sell 1 offline'}
          className="inline-flex h-8 items-center rounded-[8px] bg-[#FFC800] px-2.5 text-[11px] font-bold text-black transition hover:bg-[#ffd233] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : 'Sell 1'}
        </button>
        <button
          type="button"
          onClick={() => onAdjust(variant)}
          aria-label={`Adjust stock for ${variant.size}`}
          title="Adjust stock"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/15 text-white transition hover:border-white/35"
        >
          <Settings size={13} />
        </button>
      </span>
    );
  };

  return (
    <AdminCard>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to products" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
          <ArrowLeft size={13} /> Products
        </button>
        {productImage(product, 'h-14 w-14')}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-white">{product.name}</h3>
          <p className="mt-0.5 truncate text-xs text-[#8d8d8d]">
            Brand: {(product.brand?.name || product.brand || '—')} • Category: {(product.category?.name || product.category || '—')}
          </p>
        </div>
        {stockPill(stats.state, stats.state === 'out' ? 'Out of stock' : 'Available')}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Total stock', value: String(stats.total) },
          { label: 'Sizes', value: String(stats.sizes) },
          { label: 'Low', value: String(stats.low) },
          { label: 'Out', value: String(stats.out) },
        ].map((card) => (
          <div key={card.label} className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">{card.label}</p>
            <p className="mt-0.5 text-xl font-black text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d8d8d]">Size inventory</p>

      <div className="hidden overflow-x-auto rounded-[14px] border border-white/10 md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">
              <th scope="col" className="px-3 py-2.5 font-semibold">Size</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Color</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">SKU</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Price</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Sale</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Stock</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.color || 'all'}>
                {group.color && (
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <td colSpan={8} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d8c26a]">{group.color}</td>
                  </tr>
                )}
                {group.rows.map((variant) => {
                  const state = variantState(variant);
                  const historyOpen = String(movementsVariantId) === String(variant._id);
                  return (
                    <Fragment key={variant._id}>
                      <tr className="border-b border-white/5 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-white">{variant.size}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[#d5d5d5]">{variant.color}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[#a0a0a0]">{variant.sku}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-white">{formatMoney(variant.price)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[#d5d5d5]">{variant.salePrice ? formatMoney(variant.salePrice) : '—'}</td>
                        <td className="px-3 py-2 font-bold text-white">{getVariantStock(variant)}</td>
                        <td className="px-3 py-2">{stockPill(state)}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center justify-end gap-1.5">
                            {renderActions(variant)}
                            <button
                              type="button"
                              onClick={() => onToggleMovements(variant._id)}
                              aria-expanded={historyOpen}
                              aria-label={`Movement history for ${variant.size}`}
                              title="Movement history"
                              className="inline-flex h-8 items-center rounded-[8px] border border-white/15 px-2.5 text-[11px] font-semibold text-white transition hover:border-white/35"
                            >
                              History
                            </button>
                          </span>
                        </td>
                      </tr>
                      {historyOpen && (
                        <tr>
                          <td colSpan={8} className="border-b border-white/5 bg-black/20 px-3 py-2.5">
                            <MovementHistory movements={movements} movementsQuery={movementsQuery} variantLabel={`${variant.color} / ${variant.size}`} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 md:hidden">
        {groups.map((group) => (
          <div key={group.color || 'all'} className="space-y-2.5">
            {group.color && <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d8c26a]">{group.color}</p>}
            {group.rows.map((variant) => {
              const state = variantState(variant);
              const historyOpen = String(movementsVariantId) === String(variant._id);
              return (
                <div key={variant._id} className="rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white">
                      {variant.size} <span className="font-medium text-[#a8a8a8]">• {variant.color}</span>
                    </p>
                    {stockPill(state)}
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#767676]">{variant.sku}</p>
                  <p className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#a0a0a0]">
                      {formatMoney(variant.price)}{variant.salePrice ? ` • Sale ${formatMoney(variant.salePrice)}` : ''}
                    </span>
                    <span className="text-[#a0a0a0]">Stock <strong className="text-base text-white">{getVariantStock(variant)}</strong></span>
                  </p>
                  <div className="mt-2.5 flex gap-1.5">
                    {renderActions(variant, true)}
                    <button
                      type="button"
                      onClick={() => onToggleMovements(variant._id)}
                      aria-expanded={historyOpen}
                      className="inline-flex h-8 flex-1 items-center justify-center rounded-[8px] border border-white/15 px-2.5 text-[11px] font-semibold text-white transition hover:border-white/35"
                    >
                      {historyOpen ? 'Hide history' : 'History'}
                    </button>
                  </div>
                  {historyOpen && (
                    <div className="mt-2.5">
                      <MovementHistory movements={movements} movementsQuery={movementsQuery} variantLabel={`${variant.color} / ${variant.size}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {activeMovementVariant && (
        <p className="mt-3 text-xs text-[#767676]">
          History for {activeMovementVariant.color} / {activeMovementVariant.size} • {product.name}
        </p>
      )}
    </AdminCard>
  );
}

function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-[#121212] px-3.5 py-2 transition focus-within:border-[#FFC800]/50 focus-within:shadow-[0_0_0_3px_rgba(255,200,0,0.1)]">
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent text-[13px] text-white placeholder:text-[#6f6f6f] outline-none" />
    </div>
  );
}

function FilterBar({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
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
    PUBLISHED: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    DRAFT: 'border-[#FFC800]/25 bg-[#FFC800]/10 text-[#f3d87d]',
    ARCHIVED: 'border-red-400/25 bg-red-400/10 text-red-300',
    ACTIVE: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    INACTIVE: 'border-white/15 bg-white/5 text-[#d5d5d5]',
    APPROVED: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    REJECTED: 'border-red-400/25 bg-red-400/10 text-red-300',
    PENDING: 'border-[#FFC800]/25 bg-[#FFC800]/10 text-[#f3d87d]',
    PROCESSING: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    SHIPPED: 'border-teal-400/25 bg-teal-400/10 text-teal-300',
    DELIVERED: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    CANCELLED: 'border-red-400/25 bg-red-400/10 text-red-300',
    PAID: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    FAILED: 'border-red-400/25 bg-red-400/10 text-red-300',
    REFUNDED: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
    DEFAULT: 'border-white/15 bg-white/5 text-[#e8e8e8]',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${palette[normalizedStatus] || palette.DEFAULT}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {normalizedStatus}
    </span>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-[14px] border border-dashed border-white/15 bg-[#0d0d0d] p-6 text-center sm:p-10">
      <h3 className="text-xl font-black uppercase tracking-[-0.04em] text-white sm:text-2xl">{title}</h3>
      <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-[#a0a0a0]">{description}</p>
    </div>
  );
}

function ErrorState({ message }) {
  return <div className="rounded-[14px] border border-red-500/25 bg-red-500/[0.06] p-5 text-sm leading-relaxed text-red-200">{message}</div>;
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-3">
      {[...Array(lines)].map((_, index) => (
        <div key={index} className="admin-skeleton h-14 animate-pulse rounded-[12px]" />
      ))}
    </div>
  );
}

function Toast({ message, type = 'info' }) {
  if (!message) return null;
  const tone = type === 'error'
    ? 'border-red-500/30 bg-[#171112] text-red-200'
    : type === 'success'
      ? 'border-emerald-500/30 bg-[#0f1713] text-emerald-200'
      : 'border-[#FFC800]/25 bg-[#15130a] text-[#f0e2b0]';

  return (
    <div className={`admin-fade-in flex items-start gap-2.5 rounded-[12px] border ${tone} px-4 py-3 text-[13px] leading-relaxed`}>
      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span>{message}</span>
    </div>
  );
}

function AdminPageHeader({ eyebrow, title, meta, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8d8d8d]">{eyebrow}</p>}
        <h2 className="mt-2 text-3xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white sm:text-4xl">{title}</h2>
        {meta && <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#a0a0a0]">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function AdminKpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#0d0d0d] p-4 transition hover:border-white/[0.16]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#FFC800]/25 bg-[#FFC800]/[0.08] text-[#FFC800]" aria-hidden="true">
            <Icon size={14} />
          </span>
        )}
      </div>
      <p className="mt-2.5 truncate text-[26px] font-black leading-none tracking-[-0.03em] text-white">{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-[#8d8d8d]">{sub}</p>}
    </div>
  );
}

function AdminCard({ eyebrow, title, action, children, className = '' }) {
  return (
    <section className={`rounded-[14px] border border-white/[0.08] bg-[#0d0d0d] p-4 sm:p-5 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">{eyebrow}</p>}
            {title && <h3 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-white">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function AdminPage({ initialSection }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionFromQuery = searchParams.get('section');
  const section = sectionFromQuery || initialSection || 'dashboard';

  const setSection = (nextSection) => {
    setDrawerOpen(false);
    setMenuOpen(false);
    navigate(nextSection === 'dashboard' ? '/admin' : `/admin/${nextSection}`);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    setDrawerOpen(false);
    await logout().catch(() => {});
    navigate('/', { replace: true });
  };

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const navGroups = [
    {
      label: 'Workspace',
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders', icon: Package },
        { id: 'products', label: 'Products', icon: ShoppingBag },
        { id: 'inventory', label: 'Inventory', icon: Archive },
        { id: 'customers', label: 'Customers', icon: Users },
      ],
    },
    {
      label: 'Manage',
      items: [
        { id: 'shipping', label: 'Shipping', icon: Truck },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const adminName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Store Admin';
  const adminInitials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'A';
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const renderSidebarBody = () => (
    <>
      <Link to="/admin" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 transition hover:bg-white/[0.04]" aria-label="AJ SPORTS admin home">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FFC800] text-xs font-black text-black shadow-[0_0_20px_rgba(255,200,0,0.25)]">A</span>
        <span className="leading-tight">
          <span className="block text-sm font-black uppercase tracking-[0.24em] text-white">AJ Sports</span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8d8d8d]">Control Center</span>
        </span>
      </Link>

      <div className="mt-5 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#6f6f6f]">{group.label}</p>
            <nav aria-label={group.label} className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    data-active={isActive}
                    className="admin-nav-item flex w-full items-center gap-2.5 rounded-[10px] py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a8a8] hover:bg-white/[0.04] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#FFC800]/60"
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-5">
        <div className="rounded-[14px] border border-white/[0.08] bg-[#0d0d0d] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#FFC800]/40 bg-[#FFC800]/10 text-xs font-black text-[#FFC800]" aria-hidden="true">
              {adminInitials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white">{adminName}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8d8d8d]">Store admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-white/10 px-4 text-[11px] font-semibold text-[#d5d5d5] transition hover:border-red-500/40 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>
    </>
  );

  const DashboardSection = () => {
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => adminApi.dashboard() });
    const metrics = unwrapPayload(data)?.metrics ?? {};
    const totalOrders = Number(metrics.totalOrders || 0);
    const statusPipeline = [
      { label: 'Pending', value: Number(metrics.pendingOrders || 0) },
      { label: 'Confirmed', value: Number(metrics.confirmedOrders || 0) },
      { label: 'Shipped', value: Number(metrics.shippedOrders || 0) },
      { label: 'Delivered', value: Number(metrics.deliveredOrders || 0) },
      { label: 'Cancelled', value: Number(metrics.cancelledOrders || 0) },
    ];
    const recentOrders = Array.isArray(metrics.recentOrders) ? metrics.recentOrders : [];
    const lowStockProducts = Array.isArray(metrics.lowStockProducts) ? metrics.lowStockProducts : [];
    const topSellingProducts = Array.isArray(metrics.topSellingProducts) ? metrics.topSellingProducts : [];
    const maxTopQuantity = Math.max(1, ...topSellingProducts.map((product) => Number(product.quantity || 0)));

    if (isLoading) return <Skeleton lines={6} />;
    if (isError) return <ErrorState message="Unable to load the admin dashboard." />;

    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminKpi icon={TrendingUp} label="Revenue" value={metrics.totalRevenue ? formatMoney(metrics.totalRevenue) : '—'} sub="Gross sales" />
          <AdminKpi icon={Package} label="Orders" value={metrics.totalOrders ?? '—'} sub={`${metrics.pendingOrders || 0} pending`} />
          <AdminKpi icon={Users} label="Customers" value={metrics.totalUsers ?? '—'} sub="Accounts" />
          <AdminKpi icon={ShoppingBag} label="Products" value={metrics.totalProducts ?? '—'} sub="Catalog" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminCard eyebrow="Order pipeline" title="Live status distribution">
            {totalOrders === 0 ? (
              <p className="text-sm text-[#a0a0a0]">No orders in the pipeline yet.</p>
            ) : (
              <div className="space-y-4">
                {statusPipeline.map((entry) => (
                  <div key={entry.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[#d2d2d2]">{entry.label}</span>
                      <span className="font-semibold text-white">{entry.value}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#FFC800]"
                        style={{ width: `${Math.min(100, Math.round((entry.value / totalOrders) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard
            eyebrow="Inventory health"
            title="Low stock alerts"
            action={(
              <button
                type="button"
                onClick={() => setSection('inventory')}
                className="kicks-btn kicks-btn-secondary kicks-btn-sm"
              >
                Manage <ChevronRight size={13} />
              </button>
            )}
          >
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-[#a0a0a0]">No low-stock items right now.</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 5).map((product) => {
                  const variant = product.variants?.[0] || {};
                  const stock = Number(variant.stock ?? 0);
                  return (
                    <div key={product._id} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{product.name}</div>
                        <div className="mt-0.5 truncate text-xs text-[#8d8d8d]">SKU {variant.sku || '—'}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${stock <= 0 ? 'bg-red-500/10 text-red-200' : 'bg-[#FFC800]/10 text-[#FFC800]'}`}>
                        {stock <= 0 ? 'Out' : `${stock} left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <AdminCard
            eyebrow="Latest activity"
            title="Recent orders"
            action={(
              <button
                type="button"
                onClick={() => setSection('orders')}
                className="kicks-btn kicks-btn-secondary kicks-btn-sm"
              >
                View all <ChevronRight size={13} />
              </button>
            )}
          >
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[#a0a0a0]">No recent orders available.</p>
            ) : (
              <>
                <div className="admin-scroll hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm text-[#d8d8d8]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">
                        <th className="py-2 pr-4 font-medium">Order</th>
                        <th className="py-2 pr-4 font-medium">Amount</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.slice(0, 6).map((order) => (
                        <tr key={order._id || order.id} className="border-t border-white/10">
                          <td className="py-3 pr-4 font-semibold text-white">{order.orderNumber || order._id}</td>
                          <td className="py-3 pr-4 text-white">{formatMoney(order.grandTotal || 0)}</td>
                          <td className="py-3 pr-4"><StatusBadge status={order.status || 'PENDING'} /></td>
                          <td className="py-3 text-xs text-[#a0a0a0]">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 md:hidden">
                  {recentOrders.slice(0, 6).map((order) => (
                    <div key={order._id || order.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{order.orderNumber || order._id}</div>
                        <div className="mt-0.5 text-xs text-[#a0a0a0]">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'} • {formatMoney(order.grandTotal || 0)}</div>
                      </div>
                      <StatusBadge status={order.status || 'PENDING'} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </AdminCard>

          <AdminCard
            eyebrow="Top movers"
            title="Best sellers"
            action={(
              <button
                type="button"
                onClick={() => setSection('products')}
                className="kicks-btn kicks-btn-secondary kicks-btn-sm"
              >
                Manage <ChevronRight size={13} />
              </button>
            )}
          >
            {topSellingProducts.length === 0 ? (
              <p className="text-sm text-[#a0a0a0]">No sales data yet.</p>
            ) : (
              <div className="space-y-4">
                {topSellingProducts.slice(0, 5).map((product, index) => (
                  <div key={product._id || index}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-white">
                        <span className="mr-2 text-[#FFC800]">#{index + 1}</span>
                        {product.name || 'Unknown product'}
                      </p>
                      <p className="shrink-0 text-xs text-[#a0a0a0]">{product.quantity || 0} sold</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#FFC800]"
                        style={{ width: `${Math.min(100, Math.round((Number(product.quantity || 0) / maxTopQuantity) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[#a0a0a0]">{formatMoney(product.revenue || 0)} revenue</p>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      </div>
    );
  };

  const ProductsSection = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [toast, setToast] = useState('');
    const [mediaItems, setMediaItems] = useState([]);
    const [sessionUploadIds, setSessionUploadIds] = useState([]);
    const [colorSessionUploads, setColorSessionUploads] = useState([]);
    const [uploadingColor, setUploadingColor] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [savingProduct, setSavingProduct] = useState(false);
    const [formError, setFormError] = useState('');
    const [bulkStock, setBulkStock] = useState('');
    const [colorInput, setColorInput] = useState('');
    const [brandDialogOpen, setBrandDialogOpen] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [brandSaving, setBrandSaving] = useState(false);
    const [brandError, setBrandError] = useState('');
    const [dragActive, setDragActive] = useState(false);
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
      sizeSystem: 'UK',
      defaultColor: 'Black',
      colors: [],
      colorImages: {},
      variants: [],
    });
    const makeMediaId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const makeVariantKey = () => `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const blankVariant = (overrides = {}) => ({
      key: makeVariantKey(),
      size: '',
      color: 'Black',
      price: 0,
      salePrice: '',
      stock: 0,
      images: [],
      touched: {},
      orig: null,
      ...overrides,
    });

    const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: () => apiClient.get('/categories').then((response) => response.data) });
    const { data: brandsData } = useQuery({ queryKey: ['admin-brands'], queryFn: () => apiClient.get('/brands').then((response) => response.data) });
    const { data, isLoading, isError } = useQuery({
      queryKey: ['admin-products', page, status, category, brand],
      queryFn: () => apiClient.get('/admin/products', {
        params: { page, limit: 10, status: status || undefined, category: category || undefined, brand: brand || undefined },
      }).then((response) => response.data),
    });

    const categoriesPayload = unwrapPayload(categoriesData);
    const brandsPayload = unwrapPayload(brandsData);
    const categories = Array.isArray(categoriesPayload) ? categoriesPayload : [];
    const brands = Array.isArray(brandsPayload) ? brandsPayload : [];
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
        sizeSystem: 'UK',
        defaultColor: 'Black',
        colors: [],
        colorImages: {},
        variants: [],
      });
      setMediaItems([]);
      setSessionUploadIds([]);
      setColorSessionUploads([]);
      setUrlInput('');
      setUrlInput('');
      setUploadError('');
      setFormError('');
      setBrandDialogOpen(false);
      setBrandName('');
      setBrandError('');
      setIsFormOpen(true);
    };

    const hydrateVariant = (variant, fallbackPrice, identity = null) => ({
      key: makeVariantKey(),
      size: variant?.size || '',
      color: variant?.color || 'Black',
      serverSku: variant?.sku || '',
      price: Number(variant?.price ?? fallbackPrice ?? 0),
      salePrice: variant?.salePrice ?? '',
      stock: Number(variant?.stock ?? 0),
      images: Array.isArray(variant?.images) ? variant.images.filter(Boolean) : [],
      touched: { color: true, price: true, salePrice: true, stock: true },
      orig: identity ? {
        size: variant?.size || '',
        color: variant?.color || 'Black',
        name: identity.name || '',
        brand: identity.brand || '',
      } : null,
    });

    const openEdit = (product) => {
      setEditingProduct(product);
      const hydrated = (product.variants || []).map((variant) => hydrateVariant(variant, product.price, {
        name: product.name || '',
        brand: product.brand?._id || product.brand || '',
      }));
      setProductForm({
        name: product.name || '',
        slug: product.slug || '',
        brand: product.brand?._id || product.brand || '',
        category: product.category?._id || product.category || '',
        gender: product.gender || 'UNISEX',
        price: product.price || 0,
        salePrice: product.salePrice ?? '',
        status: product.status || 'DRAFT',
        featured: Boolean(product.featured),
        newArrival: Boolean(product.newArrival),
        bestSeller: Boolean(product.bestSeller),
        shortDescription: product.shortDescription || '',
        description: product.description || '',
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
        sizeSystem: detectSizeSystem(product.variants?.[0]?.size),
        defaultColor: product.variants?.[0]?.color || 'Black',
        colors: dedupeColors((product.variants || []).map((variant) => variant?.color)),
        colorImages: normalizePersistedColorImages(product.colorImages),
        variants: hydrated,
      });
      setMediaItems(Array.isArray(product.images) ? product.images.filter(Boolean).map((url) => ({ id: makeMediaId(), kind: 'manual', url })) : []);
      setSessionUploadIds([]);
      setColorSessionUploads([]);
      setUrlInput('');
      setUploadError('');
      setFormError('');
      setBrandDialogOpen(false);
      setBrandName('');
      setBrandError('');
      setIsFormOpen(true);
    };

    const slugifyText = (value) => String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    const updateVariant = (key, patch, touchedKeys = []) => {
      setProductForm((current) => ({
        ...current,
        variants: current.variants.map((row) => (row.key === key
          ? { ...row, ...patch, touched: { ...row.touched, ...Object.fromEntries(touchedKeys.map((field) => [field, true])) } }
          : row)),
      }));
    };

    const isRowConfigured = (row) => Number(row.stock || 0) > 0
      || Boolean(row.touched.price)
      || Boolean(row.touched.salePrice && (row.salePrice !== '' && row.salePrice !== null && row.salePrice !== undefined));

    const defaultVariantPrices = () => {
      const price = Number(productForm.price || 0);
      const salePrice = productForm.salePrice === '' || productForm.salePrice === null || productForm.salePrice === undefined
        ? ''
        : Number(productForm.salePrice);
      return { price, salePrice };
    };

    const makeMatrixRow = (size, color) => {
      const { price, salePrice } = defaultVariantPrices();
      return blankVariant({ size, color, price, salePrice });
    };

    const toggleSize = (size) => {
      const colors = productForm.colors.length > 0 ? productForm.colors : [productForm.defaultColor || 'Black'];
      const rowsForSize = productForm.variants.filter((row) => row.size === size);
      const missing = colors.filter((color) => !rowsForSize.some((row) => colorKey(row.color) === colorKey(color)));
      if (rowsForSize.length > 0 && missing.length === 0) {
        const configured = rowsForSize.filter(isRowConfigured);
        if (configured.length > 0 && !window.confirm(`Remove ${size} (${configured.length} configured row${configured.length > 1 ? 's' : ''})? Entered stock/price data will be lost.`)) {
          return;
        }
        const keys = new Set(rowsForSize.map((row) => row.key));
        setProductForm((current) => ({ ...current, variants: current.variants.filter((row) => !keys.has(row.key)) }));
        setFormError('');
        return;
      }
      // Add only the missing Size × Color combinations; existing rows keep
      // their stock, price, sale price and SKU data untouched.
      const needed = colors.filter((color) => !rowsForSize.some((row) => colorKey(row.color) === colorKey(color)));
      if (needed.length === 0) return;
      setProductForm((current) => ({
        ...current,
        colors: current.colors.length > 0 ? current.colors : colors,
        variants: syncMatrixRows({ rows: current.variants, sizes: [size], colors: needed, makeRow: (nextSize, nextColor) => makeMatrixRow(nextSize, nextColor) }),
      }));
      setFormError('');
    };

    const addColor = () => {
      const name = normalizeColorName(colorInput);
      if (!name) {
        setFormError('Enter a color name first.');
        return;
      }
      if (productForm.colors.some((color) => colorKey(color) === colorKey(name))) {
        setFormError(`Color "${name}" already exists.`);
        return;
      }
      const sizes = distinctSizes(productForm.variants);
      const { price, salePrice } = defaultVariantPrices();
      setProductForm((current) => ({
        ...current,
        colors: [...current.colors, name],
        variants: syncMatrixRows({
          rows: current.variants,
          sizes,
          colors: [name],
          makeRow: (size, color) => blankVariant({ size, color, price, salePrice }),
        }),
      }));
      setColorInput('');
      setFormError('');
    };

    const removeColor = (name) => {
      const rowsForColor = productForm.variants.filter((row) => colorKey(row.color) === colorKey(name));
      const configured = rowsForColor.filter(isRowConfigured);
      const galleryCount = (productForm.colorImages?.[name] || []).length;
      if ((configured.length > 0 || galleryCount > 0) && !window.confirm(`Remove color "${name}" (${configured.length} configured row${configured.length > 1 ? 's' : ''}${galleryCount > 0 ? `, ${galleryCount} galler${galleryCount > 1 ? 'ies' : 'y'} image${galleryCount > 1 ? 's' : ''}` : ''})? Entered data will be lost.`)) {
        return;
      }
      const keys = new Set(rowsForColor.map((row) => row.key));
      const staleUploads = colorSessionUploads.filter((item) => colorKey(item.color) === colorKey(name) && item.publicId);
      setProductForm((current) => {
        const nextColorImages = { ...current.colorImages };
        for (const key of Object.keys(nextColorImages)) {
          if (colorKey(key) === colorKey(name)) delete nextColorImages[key];
        }
        return {
          ...current,
          colors: current.colors.filter((color) => colorKey(color) !== colorKey(name)),
          colorImages: nextColorImages,
          variants: current.variants.filter((row) => !keys.has(row.key)),
        };
      });
      if (staleUploads.length > 0) {
        setColorSessionUploads((entries) => entries.filter((item) => colorKey(item.color) !== colorKey(name)));
        Promise.allSettled(staleUploads.map((item) => deleteStoredUpload(item.publicId)));
      }
      setFormError('');
    };

    const removeVariantRow = (key) => {
      const row = productForm.variants.find((entry) => entry.key === key);
      if (row && isRowConfigured(row) && !window.confirm(`Remove ${row.size || 'this'} / ${row.color || ''} variant? Entered stock/price data will be lost.`)) {
        return;
      }
      setProductForm((current) => ({ ...current, variants: current.variants.filter((entry) => entry.key !== key) }));
    };

    const applyDefaultsToAll = () => {
      const price = Number(productForm.price || 0);
      const salePrice = productForm.salePrice === '' || productForm.salePrice === null || productForm.salePrice === undefined
        ? ''
        : Number(productForm.salePrice);
      setProductForm((current) => ({
        ...current,
        variants: current.variants.map((row) => ({
          ...row,
          price,
          salePrice,
          touched: { ...row.touched, price: true, salePrice: true },
        })),
      }));
      setToast('Default price applied to all sizes.');
    };

    const applyColorToAll = () => {
      const color = String(productForm.defaultColor || '').trim();
      if (!color) {
        setFormError('Enter a default color first.');
        return;
      }
      setProductForm((current) => ({
        ...current,
        colors: [normalizeColorName(color)],
        variants: current.variants.map((row) => ({ ...row, color, touched: { ...row.touched, color: true } })),
      }));
      setFormError('');
      setToast(`Color "${color}" applied to all variants.`);
    };

    const applyStockToAll = (value) => {
      const stock = Math.floor(Number(value));
      if (!Number.isFinite(stock) || stock < 0) {
        setFormError('Enter a valid stock quantity (0 or more).');
        return;
      }
      setProductForm((current) => ({
        ...current,
        variants: current.variants.map((row) => ({ ...row, stock, touched: { ...row.touched, stock: true } })),
      }));
      setFormError('');
    };

    const saveBrand = async () => {
      if (brandSaving) return;
      const name = brandName.trim().replace(/\s+/g, ' ');
      if (!name) {
        setBrandError('Brand name is required.');
        return;
      }
      if (name.length > 60) {
        setBrandError('Brand name must be 60 characters or fewer.');
        return;
      }
      setBrandSaving(true);
      setBrandError('');
      try {
        const response = await apiClient.post('/brands', { name });
        const created = unwrapPayload(response.data)?.brand ?? null;
        const createdId = created?._id || created?.id || '';
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-brands'] }),
          queryClient.invalidateQueries({ queryKey: ['shop-brands'] }),
        ]);
        // Auto-select only when the admin has not already chosen a brand.
        if (createdId && !productForm.brand) {
          setProductForm((current) => (current.brand ? current : { ...current, brand: createdId }));
        }
        setBrandDialogOpen(false);
        setBrandName('');
        setToast(`Brand "${created?.name || name}" created.`);
      } catch (error) {
        if (Number(error?.status) === 409) setBrandError('Brand already exists.');
        else setBrandError(error?.message || 'Could not create brand. Try again.');
      } finally {
        setBrandSaving(false);
      }
    };

    // Fully automatic SKU generation (mirrors the backend builder). The SKU a row
    // will be saved with: the stored SKU when size/color/name/brand are
    // unchanged since the product was opened, otherwise a fresh deterministic
    // BRAND-MODEL-COLOR-SIZE value (deduplicated within the form).
    const formBrandName = (brands.find((item) => String(item?._id || item?.id) === String(productForm.brand))?.name) || '';

    const skuByKey = useMemo(() => {
      const assigned = {};
      const taken = new Set();
      for (const row of productForm.variants) {
        const unchanged = Boolean(row.orig?.size)
          && row.size === row.orig.size
          && row.color === row.orig.color
          && productForm.name === row.orig.name
          && String(productForm.brand) === String(row.orig.brand)
          && row.serverSku;
        let sku;
        if (unchanged) {
          sku = String(row.serverSku).trim().toUpperCase();
        } else {
          const base = buildVariantSku({ brand: formBrandName, model: productForm.name, color: row.color, size: row.size });
          sku = base;
          let counter = 1;
          while (taken.has(sku)) {
            counter += 1;
            sku = `${base}-${counter}`;
          }
        }
        taken.add(sku);
        assigned[row.key] = sku;
      }
      return assigned;
    }, [productForm.variants, productForm.name, productForm.brand, formBrandName]);

    const validateProductForm = () => {
      if (!productForm.name.trim()) return 'Product name is required.';
      const price = Number(productForm.price);
      if (!Number.isFinite(price) || price < 0) return 'Enter a valid base price (0 or more).';
      const saleRaw = productForm.salePrice;
      if (saleRaw !== '' && saleRaw !== null && saleRaw !== undefined) {
        const sale = Number(saleRaw);
        if (!Number.isFinite(sale) || sale < 0) return 'Enter a valid sale price (0 or more).';
        if (sale > price) return 'Sale price cannot exceed price.';
      }
      if (productForm.variants.length === 0) return 'Select at least one available size to create a variant.';
      const seenCombos = new Set();
      for (const row of productForm.variants) {
        const label = `${row.size || 'size'} / ${row.color || 'color'}`;
        if (!String(row.size || '').trim()) return 'Every variant needs a size.';
        if (!String(row.color || '').trim()) return `Every variant needs a color (${label}).`;
        const combo = `${String(row.size).trim().toLowerCase()}::${String(row.color).trim().toLowerCase()}`;
        if (seenCombos.has(combo)) return `Duplicate size/color combination "${label}".`;
        seenCombos.add(combo);
        const rowPrice = Number(row.price);
        if (!Number.isFinite(rowPrice) || rowPrice <= 0) return `Enter a valid price greater than 0 for ${label}.`;
        if (row.salePrice !== '' && row.salePrice !== null && row.salePrice !== undefined) {
          const rowSale = Number(row.salePrice);
          if (!Number.isFinite(rowSale) || rowSale < 0) return `Enter a valid sale price for ${label}.`;
          if (rowSale > rowPrice) return `Sale price cannot exceed price for ${label}.`;
        }
        const stock = Number(row.stock);
        if (!Number.isInteger(stock) || stock < 0) return `Enter a valid whole stock quantity (0 or more) for ${label}.`;
      }
      return '';
    };

    const totalVariantStock = productForm.variants.reduce((sum, row) => sum + (Number.isFinite(Number(row.stock)) ? Number(row.stock) : 0), 0);

    const saveProduct = async () => {
      if (savingProduct || uploading) return;
      const validationError = validateProductForm();
      if (validationError) {
        setFormError(validationError);
        setToast(validationError);
        return;
      }
      setFormError('');
      setSavingProduct(true);
      try {
        const slug = productForm.slug || slugifyText(productForm.name);
        const payload = {
          name: productForm.name.trim(),
          slug,
          brand: productForm.brand || undefined,
          category: productForm.category || undefined,
          gender: productForm.gender,
          price: Number(productForm.price || 0),
          salePrice: productForm.salePrice === '' || productForm.salePrice === null || productForm.salePrice === undefined
            ? null
            : Number(productForm.salePrice || 0),
          status: productForm.status,
          featured: Boolean(productForm.featured),
          newArrival: Boolean(productForm.newArrival),
          bestSeller: Boolean(productForm.bestSeller),
          shortDescription: productForm.shortDescription,
          description: productForm.description,
          tags: productForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          images: mediaItems.map((item) => item.url).filter(Boolean),
          colorImages: Object.fromEntries(
            Object.entries(productForm.colorImages || {})
              .map(([color, urls]) => [String(color || '').trim(), (Array.isArray(urls) ? urls : []).filter((url) => typeof url === 'string' && url.trim())])
              .filter(([, urls]) => urls.length > 0),
          ),
          variants: productForm.variants.map((row) => ({
            sku: skuByKey[row.key] || buildVariantSku({ brand: formBrandName, model: productForm.name, color: row.color, size: row.size }),
            size: String(row.size || '').trim(),
            color: String(row.color || '').trim(),
            price: Number(row.price || 0),
            salePrice: row.salePrice === '' || row.salePrice === null || row.salePrice === undefined ? null : Number(row.salePrice),
            stock: Math.max(0, Math.floor(Number(row.stock || 0))),
            images: Array.isArray(row.images) ? row.images.filter(Boolean) : [],
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
        setSessionUploadIds([]);
        setColorSessionUploads([]);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
          queryClient.invalidateQueries({ queryKey: ['products-list'] }),
          queryClient.invalidateQueries({ queryKey: ['featured-products'] }),
          queryClient.invalidateQueries({ queryKey: ['product-detail'] }),
        ]);
      } catch (error) {
        setToast(error?.message || 'Unable to save product.');
      } finally {
        setSavingProduct(false);
      }
    };

    const cleanupSessionUploads = async () => {
      const stale = mediaItems.filter((item) => item.kind === 'upload' && item.publicId && sessionUploadIds.includes(item.id));
      setSessionUploadIds([]);
      const staleColorUploads = colorSessionUploads.filter((item) => item.publicId);
      setColorSessionUploads([]);
      await Promise.allSettled([
        ...stale.map((item) => apiClient.delete(`/uploads/images/${encodeURIComponent(item.publicId)}`)),
        ...staleColorUploads.map((item) => apiClient.delete(`/uploads/images/${encodeURIComponent(item.publicId)}`)),
      ]);
    };

    const closeEditor = async () => {
      await cleanupSessionUploads();
      setIsFormOpen(false);
      setEditingProduct(null);
      setUploadError('');
    };

    const uploadFiles = async (files) => {
      const list = Array.from(files || []);
      if (list.length === 0 || uploading) return;
      setUploadError('');
      const valid = [];
      for (const file of list) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setUploadError(`Unsupported file type: ${file.name || 'file'}. Use JPG, PNG or WebP.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          setUploadError(`"${file.name || 'file'}" exceeds the 5 MB limit.`);
          continue;
        }
        valid.push(file);
      }
      if (valid.length === 0) return;
      setUploading(true);
      try {
        for (const file of valid) {
          const form = new FormData();
          form.append('image', file);
          // NOTE: apiClient defaults to Content-Type: application/json, which makes
          // axios JSON-stringify FormData (file never leaves the browser) and multer
          // then sees no file -> backend 400 "Invalid upload file". Strip the header
          // for this request only so the browser sets multipart/form-data + boundary.
          const response = await apiClient.post('/uploads/images', form, {
            transformRequest: [
              (data, headers) => {
                if (headers && typeof headers.delete === 'function') headers.delete('Content-Type');
                else if (headers) delete headers['Content-Type'];
                return data;
              },
            ],
          });
          const uploaded = unwrapPayload(response.data) ?? {};
          if (!uploaded.url) throw new Error(`Upload failed for "${file.name || 'file'}". Choose the file again to retry.`);
          const id = makeMediaId();
          setMediaItems((items) => [...items, { id, kind: 'upload', url: uploaded.url, publicId: uploaded.publicId || '' }]);
          setSessionUploadIds((ids) => [...ids, id]);
        }
      } catch (error) {
        setUploadError(getUploadErrorMessage(error));
      } finally {
        setUploading(false);
      }
    };

    const addImageUrl = () => {
      const url = urlInput.trim();
      if (!url) return;
      setMediaItems((items) => [...items, { id: makeMediaId(), kind: 'manual', url }]);
      setUrlInput('');
    };

    const removeMediaItem = async (id) => {
      const item = mediaItems.find((entry) => entry.id === id);
      setMediaItems((items) => items.filter((entry) => entry.id !== id));
      if (item && item.kind === 'upload' && item.publicId && sessionUploadIds.includes(id)) {
        setSessionUploadIds((ids) => ids.filter((entry) => entry !== id));
        try {
          await apiClient.delete(`/uploads/images/${encodeURIComponent(item.publicId)}`);
        } catch {
          setUploadError('Removed from the product, but the uploaded file could not be deleted from storage.');
        }
      }
    };

    const moveMediaItem = (id, direction) => {
      setMediaItems((items) => {
        const index = items.findIndex((entry) => entry.id === id);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= items.length) return items;
        const reordered = [...items];
        [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
        return reordered;
      });
    };

    const validateImageFiles = (files) => {
      const list = Array.from(files || []);
      const valid = [];
      for (const file of list) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setUploadError(`Unsupported file type: ${file.name || 'file'}. Use JPG, PNG or WebP.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          setUploadError(`"${file.name || 'file'}" exceeds the 5 MB limit.`);
          continue;
        }
        valid.push(file);
      }
      return valid;
    };

    // Uploads one File to Cloudinary via the existing endpoint. Each file is
    // uploaded exactly once per call; the caller decides where the URL lands.
    const uploadSingleImage = async (file) => {
      const form = new FormData();
      form.append('image', file);
      // NOTE: apiClient defaults to Content-Type: application/json, which makes
      // axios JSON-stringify FormData (file never leaves the browser) and multer
      // then sees no file -> backend 400 "Invalid upload file". Strip the header
      // for this request only so the browser sets multipart/form-data + boundary.
      const response = await apiClient.post('/uploads/images', form, {
        transformRequest: [
          (data, headers) => {
            if (headers && typeof headers.delete === 'function') headers.delete('Content-Type');
            else if (headers) delete headers['Content-Type'];
            return data;
          },
        ],
      });
      const uploaded = unwrapPayload(response.data) ?? {};
      if (!uploaded.url) throw new Error(`Upload failed for "${file.name || 'file'}". Choose the file again to retry.`);
      return { url: uploaded.url, publicId: uploaded.publicId || '' };
    };

    const deleteStoredUpload = async (publicId) => {
      if (!publicId) return;
      try {
        await apiClient.delete(`/uploads/images/${encodeURIComponent(publicId)}`);
      } catch {
        setUploadError('Removed from the product, but the uploaded file could not be deleted from storage.');
      }
    };

    const uploadColorImages = async (color, files) => {
      const valid = validateImageFiles(files);
      if (valid.length === 0 || uploading) return;
      setUploadError('');
      setUploading(true);
      setUploadingColor(color);
      try {
        for (const file of valid) {
          const uploaded = await uploadSingleImage(file);
          setColorSessionUploads((entries) => [...entries, { color, url: uploaded.url, publicId: uploaded.publicId }]);
          setProductForm((current) => ({
            ...current,
            colorImages: {
              ...current.colorImages,
              [color]: [...(current.colorImages?.[color] || []), uploaded.url],
            },
          }));
        }
      } catch (error) {
        setUploadError(getUploadErrorMessage(error));
      } finally {
        setUploading(false);
        setUploadingColor('');
      }
    };

    const forgetColorSessionUpload = (color, url) => {
      const entry = colorSessionUploads.find((item) => item.color === color && item.url === url);
      if (entry?.publicId) {
        setColorSessionUploads((entries) => entries.filter((item) => !(item.color === color && item.url === url)));
        return deleteStoredUpload(entry.publicId);
      }
      return Promise.resolve();
    };

    const removeColorImage = (color, index) => {
      const urls = productForm.colorImages?.[color] || [];
      const url = urls[index];
      if (!url) return;
      setProductForm((current) => ({
        ...current,
        colorImages: { ...current.colorImages, [color]: (current.colorImages?.[color] || []).filter((_, position) => position !== index) },
      }));
      forgetColorSessionUpload(color, url);
    };

    const moveColorImage = (color, index, direction) => {
      setProductForm((current) => {
        const urls = [...(current.colorImages?.[color] || [])];
        const next = index + direction;
        if (index < 0 || next < 0 || next >= urls.length) return current;
        [urls[index], urls[next]] = [urls[next], urls[index]];
        return { ...current, colorImages: { ...current.colorImages, [color]: urls } };
      });
    };

    const moveColorImageTo = (fromColor, index, toColor) => {
      if (!toColor || colorKey(fromColor) === colorKey(toColor)) return;
      const url = (productForm.colorImages?.[fromColor] || [])[index];
      if (!url) return;
      setProductForm((current) => {
        const source = [...(current.colorImages?.[fromColor] || [])];
        const [moved] = source.splice(index, 1);
        if (!moved) return current;
        return {
          ...current,
          colorImages: {
            ...current.colorImages,
            [fromColor]: source,
            [toColor]: [...(current.colorImages?.[toColor] || []), moved],
          },
        };
      });
      setColorSessionUploads((entries) => entries.map((item) => (
        item.color === fromColor && item.url === url ? { ...item, color: toColor } : item
      )));
    };

    const deleteProduct = async (productId, productName) => {
      if (!window.confirm(`Archive "${productName || 'this product'}"? It will be hidden from the storefront.`)) return;
      try {
        await apiClient.delete(`/products/${productId}`);
        setToast('Product archived successfully.');
        setPage(1);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
          queryClient.invalidateQueries({ queryKey: ['products-list'] }),
          queryClient.invalidateQueries({ queryKey: ['featured-products'] }),
          queryClient.invalidateQueries({ queryKey: ['product-detail'] }),
        ]);
      } catch (error) {
        setToast(error?.message || 'Unable to archive product.');
      }
    };

    if (isFormOpen) {
      return (
        <div className="admin-product-form space-y-4">
          <AdminPageHeader
            eyebrow="Catalog"
            title={editingProduct ? 'Edit product' : 'Add product'}
            actions={(
              <>
                <button type="button" onClick={closeEditor} aria-label="Back to products" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
                  <ArrowLeft size={13} /> Back to Products
                </button>
                <button
                  type="button"
                  onClick={saveProduct}
                  disabled={savingProduct || uploading}
                  className="kicks-btn kicks-btn-accent kicks-btn-sm"
                >
                  {(savingProduct || uploading) && <Loader2 size={13} className="animate-spin" />}
                  {savingProduct ? 'Saving...' : uploading ? 'Uploading...' : editingProduct ? 'Save changes' : 'Create product'}
                </button>
              </>
            )}
          />

          {toast && <div><Toast message={toast} /></div>}
          {formError && <div><Toast message={formError} type="error" /></div>}

          <div className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4 lg:order-2">
            <AdminCard className="admin-product-main">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Product information</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <FormField label="Name"><input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} className="w-full kicks-field text-white" /></FormField>
                    <FormField label="Slug"><input value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value })} className="w-full kicks-field text-white" placeholder="auto-generated from name" /></FormField>
                    <div>
                      <FormField label="Brand"><select value={productForm.brand} onChange={(event) => setProductForm({ ...productForm, brand: event.target.value })} className="w-full kicks-field text-white"><option value="">Select brand</option>{brands.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}</select></FormField>
                      {!brandDialogOpen ? (
                        <button
                          type="button"
                          onClick={() => { setBrandDialogOpen(true); setBrandName(''); setBrandError(''); }}
                          className="mt-1.5 inline-flex h-[32px] items-center gap-1.5 rounded-[8px] border border-white/12 px-3 text-[11px] font-semibold text-[#d5d5d5] transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
                        >
                          <Plus size={12} aria-hidden="true" /> Add new brand
                        </button>
                      ) : (
                        <div className="admin-pop mt-2 rounded-[14px] border border-white/[0.08] bg-[#101010] p-3" role="dialog" aria-label="Add new brand">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Add brand</p>
                          <label className="mt-2 block">
                            <span className="mb-1.5 block text-xs text-[#d4d4d4]">Brand name</span>
                            <input
                              value={brandName}
                              onChange={(event) => { setBrandName(event.target.value); setBrandError(''); }}
                              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveBrand(); } }}
                              placeholder="e.g. New Balance"
                              maxLength={60}
                              autoFocus
                              className="kicks-field kicks-field-sm w-full"
                            />
                          </label>
                          {brandError && <p role="alert" className="mt-2 text-xs text-red-300">{brandError}</p>}
                          <div className="mt-2.5 flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setBrandDialogOpen(false); setBrandName(''); setBrandError(''); }}
                              disabled={brandSaving}
                              className="inline-flex h-[32px] flex-1 items-center justify-center rounded-[8px] border border-white/15 px-3 text-[11px] font-semibold text-white transition hover:border-white/35 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveBrand}
                              disabled={brandSaving}
                              className="inline-flex h-[32px] flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-white px-3 text-[11px] font-semibold text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
                            >
                              {brandSaving && <Loader2 size={12} className="animate-spin" />}
                              {brandSaving ? 'Saving...' : 'Save brand'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <FormField label="Category"><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} className="w-full kicks-field text-white"><option value="">Select category</option>{categories.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}</select></FormField>
                    <FormField label="Gender"><select value={productForm.gender} onChange={(event) => setProductForm({ ...productForm, gender: event.target.value })} className="w-full kicks-field text-white"><option value="UNISEX">UNISEX</option><option value="MEN">MEN</option><option value="WOMEN">WOMEN</option><option value="KIDS">KIDS</option></select></FormField>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Pricing</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <FormField label="Default price (₹)" hint="New sizes start with this price."><input type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: Number(event.target.value) })} className="w-full kicks-field text-white" /></FormField>
                    <FormField label="Default sale price (₹)" hint="Optional. Must not exceed price."><input type="number" min="0" value={productForm.salePrice} onChange={(event) => setProductForm({ ...productForm, salePrice: event.target.value })} className="w-full kicks-field text-white" /></FormField>
                  </div>
                  <button
                    type="button"
                    onClick={applyDefaultsToAll}
                    disabled={productForm.variants.length === 0}
                    className="mt-2.5 inline-flex h-[30px] items-center rounded-[8px] border border-white/15 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/35 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/60"
                  >
                    Apply to all sizes
                  </button>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Variants</p>
                    {productForm.variants.length > 0 && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#a8a8a8]">
                        {productForm.variants.length} variant{productForm.variants.length === 1 ? '' : 's'} • Total stock {totalVariantStock}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <FormField label="Size system">
                      <select
                        value={productForm.sizeSystem}
                        onChange={(event) => setProductForm({ ...productForm, sizeSystem: event.target.value })}
                        className="w-full kicks-field text-white"
                      >
                        {Object.keys(SIZE_SYSTEMS).map((system) => <option key={system} value={system}>{system}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Default color" hint="New sizes start with this color.">
                      <input value={productForm.defaultColor} onChange={(event) => setProductForm({ ...productForm, defaultColor: event.target.value })} placeholder="Black" className="w-full kicks-field text-white" />
                    </FormField>
                  </div>

                  <p className="mb-1.5 mt-3 block text-xs font-medium text-[#c9c9c9]">Colors</p>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Product colors">
                    {productForm.colors.map((color) => (
                      <span
                        key={colorKey(color)}
                        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-[10px] border border-white bg-white py-1 pl-3.5 pr-1.5 text-xs font-semibold text-black"
                      >
                        {color}
                        <button
                          type="button"
                          onClick={() => removeColor(color)}
                          aria-label={`Remove color ${color}`}
                          title={`Remove color ${color}`}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-black/60 transition hover:bg-black/10 hover:text-black focus:outline-none focus:ring-2 focus:ring-black/40"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <span className="inline-flex min-h-[30px] items-center gap-1.5">
                      <input
                        value={colorInput}
                        onChange={(event) => { setColorInput(event.target.value); setFormError(''); }}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addColor(); } }}
                        placeholder="Add color"
                        aria-label="New color name"
                        className="kicks-field kicks-field-sm w-28"
                      />
                      <button
                        type="button"
                        onClick={addColor}
                        aria-label="Add color"
                        title="Add color"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-white/15 text-white transition hover:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/60"
                      >
                        <Plus size={14} />
                      </button>
                    </span>
                  </div>

                  <p className="mb-1.5 mt-3 block text-xs font-medium text-[#c9c9c9]">Available sizes</p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available sizes">
                    {(SIZE_SYSTEMS[productForm.sizeSystem] || SIZE_SYSTEMS.UK).map((size) => {
                      const selected = productForm.variants.some((row) => row.size === size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleSize(size)}
                          aria-pressed={selected}
                          className="kicks-pill"
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>

                  {productForm.variants.length === 0 ? (
                    <p className="mt-3 rounded-[12px] border border-dashed border-white/15 bg-[#141414] p-3 text-center text-xs leading-relaxed text-[#8d8d8d]">
                      Select sizes above to auto-generate variant rows. Stock and prices stay empty until you enter them. SKUs generate automatically.
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={applyColorToAll}
                          className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-[8px] border border-white/15 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/60"
                        >
                          Apply color to all
                        </button>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={bulkStock}
                            onChange={(event) => setBulkStock(event.target.value)}
                            placeholder="Qty"
                            aria-label="Stock quantity for all variants"
                            className="kicks-field kicks-field-sm w-16 shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => { applyStockToAll(bulkStock); setBulkStock(''); }}
                            className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-[8px] border border-white/15 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/60"
                          >
                            Set stock for all
                          </button>
                        </span>
                      </div>

                      <div className="mt-3 hidden overflow-x-auto rounded-[14px] border border-white/10 md:block">
                        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">
                              <th scope="col" className="px-3 py-2.5 font-semibold">Size</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Color</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">SKU</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Price (₹)</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Sale (₹)</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Stock</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold"><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {productForm.variants.map((row) => (
                              <tr key={row.key} className="border-b border-white/5 last:border-0">
                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-white">{row.size}</td>
                                <td className="whitespace-nowrap px-3 py-2 font-medium text-white">{row.color}</td>
                                <td className="px-3 py-2">
                                  <span className="block whitespace-nowrap font-mono text-xs text-white" title="Auto-generated SKU">{skuByKey[row.key] || '—'}</span>
                                  <span className="mt-0.5 block text-[9px] uppercase tracking-[0.16em] text-[#767676]">Auto</span>
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="0" value={row.price} onChange={(event) => updateVariant(row.key, { price: Number(event.target.value) }, ['price'])} aria-label={`Price for ${row.size}`} className="kicks-field kicks-field-sm w-24" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="0" value={row.salePrice} onChange={(event) => updateVariant(row.key, { salePrice: event.target.value === '' ? '' : Number(event.target.value) }, ['salePrice'])} placeholder="—" aria-label={`Sale price for ${row.size}`} className="kicks-field kicks-field-sm w-24" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="0" step="1" value={row.stock} onChange={(event) => updateVariant(row.key, { stock: event.target.value === '' ? 0 : Number(event.target.value) }, ['stock'])} aria-label={`Stock for ${row.size}`} className="kicks-field kicks-field-sm w-20" />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button type="button" onClick={() => removeVariantRow(row.key)} aria-label={`Remove ${row.size} variant`} title="Remove variant" className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-red-500/30 text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/60">
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-2.5 space-y-2 md:hidden">
                        {productForm.variants.map((row) => (
                          <div key={row.key} className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-white">{row.size} <span className="font-medium text-[#a8a8a8]">• {row.color || 'No color'}</span></p>
                              <button type="button" onClick={() => removeVariantRow(row.key)} aria-label={`Remove ${row.size} variant`} title="Remove variant" className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/60">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="mt-2.5 grid grid-cols-2 gap-2">
                              <div>
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">Color</span>
                                <span className="block truncate text-sm font-medium text-white">{row.color || '—'}</span>
                              </div>
                              <div>
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">SKU • Auto</span>
                                <span className="block break-all font-mono text-xs text-white">{skuByKey[row.key] || '—'}</span>
                              </div>
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">Price (₹)</span>
                                <input type="number" min="0" value={row.price} onChange={(event) => updateVariant(row.key, { price: Number(event.target.value) }, ['price'])} className="kicks-field kicks-field-sm w-full" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">Sale (₹)</span>
                                <input type="number" min="0" value={row.salePrice} onChange={(event) => updateVariant(row.key, { salePrice: event.target.value === '' ? '' : Number(event.target.value) }, ['salePrice'])} placeholder="—" className="kicks-field kicks-field-sm w-full" />
                              </label>
                              <label className="col-span-2 block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">Stock</span>
                                <input type="number" min="0" step="1" value={row.stock} onChange={(event) => updateVariant(row.key, { stock: event.target.value === '' ? 0 : Number(event.target.value) }, ['stock'])} className="kicks-field kicks-field-sm w-full" />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Description</p>
                  <div className="mt-3 grid gap-3">
                    <FormField label="Tags"><input value={productForm.tags} onChange={(event) => setProductForm({ ...productForm, tags: event.target.value })} placeholder="running, comfort (comma separated)" className="w-full kicks-field text-white" /></FormField>
                    <FormField label="Short description"><textarea rows={2} value={productForm.shortDescription} onChange={(event) => setProductForm({ ...productForm, shortDescription: event.target.value })} className="kicks-field" /></FormField>
                    <FormField label="Description"><textarea rows={3} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} className="kicks-field" /></FormField>
                  </div>
                </div>
              </div>
            </AdminCard>

            <AdminCard eyebrow="Publishing" title="Status & visibility">
              <FormField label="Status"><select value={productForm.status} onChange={(event) => setProductForm({ ...productForm, status: event.target.value })} className="w-full kicks-field text-white"><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option><option value="ARCHIVED">ARCHIVED</option></select></FormField>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#d5d5d5]">
                  <input type="checkbox" checked={productForm.featured} onChange={(event) => setProductForm({ ...productForm, featured: event.target.checked })} className="h-4 w-4 accent-[#FFC800]" /> Featured
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#d5d5d5]">
                  <input type="checkbox" checked={productForm.newArrival} onChange={(event) => setProductForm({ ...productForm, newArrival: event.target.checked })} className="h-4 w-4 accent-[#FFC800]" /> New arrival
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#d5d5d5]">
                  <input type="checkbox" checked={productForm.bestSeller} onChange={(event) => setProductForm({ ...productForm, bestSeller: event.target.checked })} className="h-4 w-4 accent-[#FFC800]" /> Bestseller
                </label>
              </div>
            </AdminCard>
          </div>

          <aside className="admin-scroll min-w-0 space-y-4 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <AdminCard eyebrow="Media" title="Product media">
              <label
                htmlFor="admin-product-images"
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => { event.preventDefault(); setDragActive(false); uploadFiles(event.dataTransfer?.files); }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed px-4 py-5 text-center transition focus-within:border-white/40 ${dragActive ? 'border-[#FFC800] bg-[#FFC800]/5' : 'border-white/15 bg-[#141414] hover:border-white/30'}`}
              >
                <input
                  id="admin-product-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => { uploadFiles(event.target.files); event.target.value = ''; }}
                />
                {uploading ? (
                  <>
                    <Loader2 size={22} className="animate-spin text-[#FFC800]" aria-hidden="true" />
                    <span className="mt-3 text-sm font-semibold text-white">Uploading...</span>
                    <span className="mt-1 text-xs text-[#8d8d8d]">Please wait, do not close this page.</span>
                  </>
                ) : (
                  <>
                    <Plus size={22} className="text-white" aria-hidden="true" />
                    <span className="mt-3 text-sm font-semibold text-white">Drop images here</span>
                    <span className="mt-1 text-xs text-[#8d8d8d]">or click to browse • JPG, PNG or WebP • max 5 MB each</span>
                  </>
                )}
              </label>

              {uploadError && (
                <p role="alert" className="mt-3 rounded-[10px] border border-red-500/30 bg-red-500/10 p-2.5 text-xs leading-relaxed text-red-200">
                  {uploadError}
                </p>
              )}

              {mediaItems.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {mediaItems.map((item, index) => (
                    <div key={item.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#181818]">
                      <img src={item.url} alt={`Product image ${index + 1}`} className="h-16 w-full object-cover sm:h-20" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = '0.25'; }} />
                      {index === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#FFC800] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-black">Main</span>
                      )}
                      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                        <span className="flex gap-1">
                          <button type="button" onClick={() => moveMediaItem(item.id, -1)} disabled={index === 0} aria-label={`Move image ${index + 1} left`} title="Move left" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white backdrop-blur-sm transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-30">
                            <ChevronLeft size={13} />
                          </button>
                          <button type="button" onClick={() => moveMediaItem(item.id, 1)} disabled={index === mediaItems.length - 1} aria-label={`Move image ${index + 1} right`} title="Move right" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white backdrop-blur-sm transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-30">
                            <ChevronRight size={13} />
                          </button>
                        </span>
                        <button type="button" onClick={() => removeMediaItem(item.id)} aria-label={`Remove image ${index + 1}`} title="Remove image" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-red-500/30 bg-black/60 text-red-200 backdrop-blur-sm transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/60">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <label htmlFor="admin-image-url" className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-[#8d8d8d]">Image URL <span className="normal-case tracking-normal text-[#767676]">• optional</span></label>
                <div className="flex gap-2">
                  <input
                    id="admin-image-url"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addImageUrl(); } }}
                    placeholder="https://…"
                    inputMode="url"
                    className="min-w-0 flex-1 kicks-field kicks-field-sm"
                  />
                  <button type="button" onClick={addImageUrl} disabled={!urlInput.trim()} aria-label="Add image URL" title="Add image URL" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Color images</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#767676]">Each color gets its own gallery. First image is that color&apos;s main image.</p>
                {productForm.colors.length === 0 ? (
                  <p className="mt-3 rounded-[12px] border border-dashed border-white/15 bg-[#141414] p-3 text-center text-xs text-[#8d8d8d]">
                    Add a color in the form to assign it dedicated images.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {productForm.colors.map((color) => {
                      const urls = productForm.colorImages?.[color] || [];
                      const others = productForm.colors.filter((entry) => colorKey(entry) !== colorKey(color));
                      const inputId = `admin-color-images-${colorKey(color) || 'color'}`;
                      return (
                        <div key={colorKey(color)} className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-white">{color}</p>
                            <label
                              htmlFor={inputId}
                              className={`inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-[8px] border border-white/15 px-2.5 text-[11px] font-semibold text-white transition hover:border-white/35 ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                            >
                              {uploading && uploadingColor === color
                                ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                                : <Plus size={12} aria-hidden="true" />}
                              Upload
                            </label>
                            <input
                              id={inputId}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              className="sr-only"
                              disabled={uploading}
                              onChange={(event) => { uploadColorImages(color, event.target.files); event.target.value = ''; }}
                            />
                          </div>
                          {urls.length > 0 ? (
                            <div className="mt-2 grid grid-cols-3 gap-1.5">
                              {urls.map((url, index) => (
                                <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-lg border border-white/10 bg-[#181818]">
                                  <img src={url} alt={`${color} image ${index + 1}`} className="h-16 w-full object-cover" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = '0.25'; }} />
                                  {index === 0 && (
                                    <span className="absolute left-1 top-1 rounded bg-[#FFC800] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-black">Main</span>
                                  )}
                                  <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-0.5">
                                    <span className="flex gap-0.5">
                                      <button type="button" onClick={() => moveColorImage(color, index, -1)} disabled={index === 0} aria-label={`Move ${color} image ${index + 1} left`} title="Move left" className="flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/60 text-white backdrop-blur-sm transition hover:border-white/40 disabled:opacity-30">
                                        <ChevronLeft size={11} />
                                      </button>
                                      <button type="button" onClick={() => moveColorImage(color, index, 1)} disabled={index === urls.length - 1} aria-label={`Move ${color} image ${index + 1} right`} title="Move right" className="flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/60 text-white backdrop-blur-sm transition hover:border-white/40 disabled:opacity-30">
                                        <ChevronRight size={11} />
                                      </button>
                                    </span>
                                    <button type="button" onClick={() => removeColorImage(color, index)} aria-label={`Remove ${color} image ${index + 1}`} title="Remove image" className="flex h-6 w-6 items-center justify-center rounded-md border border-red-500/30 bg-black/60 text-red-200 backdrop-blur-sm transition hover:bg-red-500/20">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-[#767676]">No dedicated images — falls back to general images.</p>
                          )}
                          {others.length > 0 && urls.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <label htmlFor={`${inputId}-move`} className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#8d8d8d]">Move last to</label>
                              <select
                                id={`${inputId}-move`}
                                defaultValue=""
                                onChange={(event) => { moveColorImageTo(color, urls.length - 1, event.target.value); event.target.value = ''; }}
                                aria-label={`Move last ${color} image to another color`}
                                className="kicks-field kicks-field-sm min-w-0 flex-1"
                              >
                                <option value="">Select color…</option>
                                {others.map((entry) => <option key={colorKey(entry)} value={entry}>{entry}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-[#8d8d8d]">The first image is used as the main storefront image.</p>
            </AdminCard>
          </aside>
        </div>

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeEditor} className="inline-flex h-9 items-center justify-center rounded-[10px] border border-white/10 px-5 text-[13px] text-white transition hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60">Cancel</button>
            <button
              type="button"
              onClick={saveProduct}
              disabled={savingProduct || uploading}
              className="kicks-btn kicks-btn-accent kicks-btn-sm"
            >
              {(savingProduct || uploading) && <Loader2 size={14} className="animate-spin" />}
              {savingProduct ? 'Saving...' : uploading ? 'Uploading...' : editingProduct ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Products"
          meta={`${unwrapPayload(data)?.total ?? filteredProducts.length} products in catalog`}
          actions={(
            <button type="button" onClick={openCreate} className="kicks-btn kicks-btn-accent">
              <Plus size={14} /> Add product
            </button>
          )}
        />

        <AdminCard>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search products" /></div>
            <FilterBar>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="kicks-field text-sm text-white">
                <option value="">All statuses</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="kicks-field text-sm text-white">
                <option value="">All categories</option>
                {categories.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}
              </select>
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className="kicks-field text-sm text-white">
                <option value="">All brands</option>
                {brands.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}
              </select>
            </FilterBar>
          </div>
        </AdminCard>

        <AdminCard>
          {toast && <div className="mb-4"><Toast message={toast} /></div>}
          {isLoading ? <Skeleton lines={5} /> : isError ? <ErrorState message="Unable to load products." /> : (
            <>
              <div className="hidden lg:block">
                <DataTable
                  columns={[
                    { key: 'image', label: '', render: (row) => (row.images?.[0] ? <img src={row.images[0]} alt={row.name || 'Product'} className="h-11 w-11 rounded-xl object-cover" loading="lazy" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#181818] text-xs text-[#666]">—</span>) },
                    { key: 'name', label: 'Name', render: (row) => <div><div className="font-semibold text-white">{row.name}</div><div className="text-[11px] uppercase tracking-[0.2em] text-[#8d8d8d]">{row.slug}</div></div> },
                    { key: 'brand', label: 'Brand', render: (row) => <span>{row.brand?.name || row.brand || '—'}</span> },
                    { key: 'category', label: 'Category', render: (row) => <span>{row.category?.name || row.category || '—'}</span> },
                    { key: 'price', label: 'Price', render: (row) => <span>{formatMoney(row.price || 0)}</span> },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'actions', label: 'Actions', render: (row) => (
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`} title="Edit product" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white transition hover:border-white/30">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => deleteProduct(row._id, row.name)} aria-label={`Delete ${row.name}`} title="Archive product" className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 text-red-200 transition hover:bg-red-500/10">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) },
                  ]}
                  rows={filteredProducts}
                  emptyMessage="No products match the current filters."
                />
              </div>
              <div className="space-y-3 lg:hidden">
                {filteredProducts.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d5d5d5]">No products match the current filters.</div>
                ) : filteredProducts.map((row) => (
                  <div key={row._id} className="flex items-center gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.02] p-3">
                    {row.images?.[0] ? (
                      <img src={row.images[0]} alt={row.name || 'Product'} className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#181818] text-xs text-[#666]">—</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{row.name}</div>
                      <div className="mt-0.5 truncate text-xs text-[#8d8d8d]">{row.brand?.name || row.brand || ''} • {formatMoney(row.price || 0)}</div>
                      <div className="mt-1.5"><StatusBadge status={row.status} /></div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button type="button" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => deleteProduct(row._id, row.name)} aria-label={`Delete ${row.name}`} title="Archive product" className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/30 text-red-200">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="mt-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
        </AdminCard>


      </div>
    );
  };

  const InventorySection = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [saleTarget, setSaleTarget] = useState(null);
    const [saleQty, setSaleQty] = useState(1);
    const [saleBusy, setSaleBusy] = useState('');
    const [adjustTarget, setAdjustTarget] = useState(null);
    const [adjustType, setAdjustType] = useState('Offline Sale');
    const [adjustSign, setAdjustSign] = useState(-1);
    const [adjustQty, setAdjustQty] = useState(1);
    const [adjustNote, setAdjustNote] = useState('');
    const [adjustError, setAdjustError] = useState('');
    const [adjustBusy, setAdjustBusy] = useState(false);
    const [movementsVariantId, setMovementsVariantId] = useState(null);

    useEffect(() => {
      const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
      return () => window.clearTimeout(timer);
    }, [search]);

    const { data, isLoading, isError, refetch } = useQuery({
      queryKey: ['admin-products-inventory', debouncedSearch],
      queryFn: () => apiClient.get('/admin/products', { params: { page: 1, limit: 100, search: debouncedSearch || undefined } }).then((response) => response.data),
    });
    const productsPayload = unwrapPayload(data);
    const allProducts = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
    const totalProducts = Number(productsPayload?.total ?? allProducts.length);

    const LOW_STOCK_AT = 5;
    const getVariantStock = (variant) => Number(variant?.stock ?? 0);
    const variantState = (variant) => {
      const stock = getVariantStock(variant);
      if (stock <= 0) return 'out';
      if (stock <= LOW_STOCK_AT) return 'low';
      return 'in';
    };

    const productStats = (product) => {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const total = variants.reduce((sum, variant) => sum + getVariantStock(variant), 0);
      const low = variants.filter((variant) => variantState(variant) === 'low').length;
      const out = variants.filter((variant) => variantState(variant) === 'out').length;
      return { total, sizes: variants.length, low, out, state: variants.length === 0 || out === variants.length ? 'out' : 'in' };
    };

    const filteredProducts = allProducts.filter((product) => {
      if (statusFilter === 'all') return true;
      const stats = productStats(product);
      if (statusFilter === 'out') return stats.state === 'out';
      if (statusFilter === 'low') return stats.low > 0;
      return stats.state === 'in' && stats.low === 0;
    });

    const summary = allProducts.reduce((acc, product) => {
      const stats = productStats(product);
      acc.units += stats.total;
      acc.sizes += stats.sizes;
      acc.low += stats.low;
      acc.out += stats.out;
      return acc;
    }, { units: 0, sizes: 0, low: 0, out: 0 });

    const selectedProduct = allProducts.find((product) => String(product?._id) === String(selectedProductId)) || null;

    const movementsQuery = useQuery({
      queryKey: ['admin-inventory-movements', movementsVariantId],
      queryFn: () => adminApi.inventoryMovements(movementsVariantId, { page: 1, limit: 10 }),
      enabled: Boolean(movementsVariantId),
    });
    const movements = unwrapPayload(movementsQuery.data)?.items ?? [];

    const refreshAfterStockChange = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-products-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-low-stock'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['products-list'] }),
        queryClient.invalidateQueries({ queryKey: ['featured-products'] }),
        queryClient.invalidateQueries({ queryKey: ['product-detail'] }),
      ]);
    };

    const postAdjustment = async ({ variantId, delta, reason }) => {
      await apiClient.post(`/admin/inventory/${variantId}/adjust`, { delta, reason });
      await refreshAfterStockChange();
    };

    const confirmOfflineSale = async () => {
      if (!saleTarget || saleBusy) return;
      const qty = Math.floor(Number(saleQty));
      if (!Number.isInteger(qty) || qty < 1) {
        showToast('Enter a valid quantity of 1 or more.', 'error');
        return;
      }
      if (qty > getVariantStock(saleTarget.variant)) {
        showToast(`Only ${getVariantStock(saleTarget.variant)} unit(s) available for ${saleTarget.variant.size}.`, 'error');
        return;
      }
      setSaleBusy(saleTarget.variantId);
      try {
        await postAdjustment({ variantId: saleTarget.variantId, delta: -qty, reason: 'Offline sale' });
        setSaleTarget(null);
        setSaleQty(1);
        showToast(`Offline sale recorded: ${saleTarget.variant.size} × ${qty}.`, 'success');
      } catch (error) {
        showToast(error?.message || 'Unable to record offline sale.', 'error');
      } finally {
        setSaleBusy('');
      }
    };

    const saveAdjustment = async () => {
      if (!adjustTarget || adjustBusy) return;
      const qty = Math.floor(Number(adjustQty));
      if (!Number.isInteger(qty) || qty < 1) {
        setAdjustError('Enter a valid quantity of 1 or more.');
        return;
      }
      const delta = adjustType === 'Correction' ? adjustSign * qty : adjustType === 'Restock' ? qty : -qty;
      if (delta < 0 && qty > getVariantStock(adjustTarget.variant)) {
        setAdjustError(`Only ${getVariantStock(adjustTarget.variant)} unit(s) available. Stock cannot go below zero.`);
        return;
      }
      const reason = adjustNote.trim() ? `${adjustType} — ${adjustNote.trim().slice(0, 160)}` : adjustType;
      setAdjustBusy(true);
      setAdjustError('');
      try {
        await postAdjustment({ variantId: adjustTarget.variantId, delta, reason });
        setAdjustTarget(null);
        setAdjustQty(1);
        setAdjustNote('');
        setAdjustType('Offline Sale');
        setAdjustSign(-1);
        showToast('Inventory adjusted.', 'success');
      } catch (error) {
        setAdjustError(error?.message || 'Unable to adjust inventory.');
      } finally {
        setAdjustBusy(false);
      }
    };

    const openSale = (product, variant) => {
      setSaleTarget({ productId: product._id, variantId: variant._id, product, variant });
      setSaleQty(1);
    };

    const openAdjust = (product, variant) => {
      setAdjustTarget({ productId: product._id, variantId: variant._id, product, variant });
      setAdjustType('Offline Sale');
      setAdjustSign(-1);
      setAdjustQty(1);
      setAdjustNote('');
      setAdjustError('');
    };

    const stockPill = (state, label) => (
      <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
        state === 'out' ? 'bg-red-500/10 text-red-200' : state === 'low' ? 'bg-[#FFC800]/10 text-[#FFC800]' : 'bg-emerald-500/10 text-emerald-300'
      }`}>
        {label || (state === 'out' ? 'Out' : state === 'low' ? 'Low' : 'In stock')}
      </span>
    );

    const productImage = (product, sizeClass) => (product?.images?.[0] ? (
      <img src={product.images[0]} alt={product?.name || 'Product'} className={`${sizeClass} shrink-0 rounded-xl object-cover`} loading="lazy" />
    ) : (
      <span className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#181818] text-[#666]`} aria-label="No product image">
        <Package size={16} />
      </span>
    ));

    return (
      <div className="space-y-5">
        <AdminPageHeader
          eyebrow="Stock control"
          title="Inventory"
          meta={`${totalProducts} product${totalProducts === 1 ? '' : 's'} • ${summary.units} units • ${summary.low} low • ${summary.out} out`}
          actions={(
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                <SearchInput value={search} onChange={(value) => setSearch(value)} placeholder="Search products" />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by stock status"
                className="kicks-field kicks-field-sm w-auto"
              >
                <option value="all">All stock</option>
                <option value="in">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </select>
            </div>
          )}
        />

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { label: 'Total products', value: String(totalProducts) },
            { label: 'Total units', value: String(summary.units) },
            { label: 'Low-stock sizes', value: String(summary.low) },
            { label: 'Out-of-stock sizes', value: String(summary.out) },
          ].map((card) => (
            <div key={card.label} className="rounded-[16px] border border-white/10 bg-[#111111] p-3.5">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8d8d8d]">{card.label}</p>
              <p className="mt-1.5 truncate text-2xl font-black tracking-[-0.03em] text-white">{card.value}</p>
            </div>
          ))}
        </div>

        {selectedProduct ? (
          <ProductInventoryDetail
            product={selectedProduct}
            stats={productStats(selectedProduct)}
            onBack={() => { setSelectedProductId(null); setMovementsVariantId(null); }}
            productImage={productImage}
            stockPill={stockPill}
            getVariantStock={getVariantStock}
            variantState={variantState}
            saleBusy={saleBusy}
            onSell={(variant) => openSale(selectedProduct, variant)}
            onAdjust={(variant) => openAdjust(selectedProduct, variant)}
            movementsVariantId={movementsVariantId}
            onToggleMovements={(variantId) => setMovementsVariantId((current) => (current === variantId ? null : variantId))}
            movements={movements}
            movementsQuery={movementsQuery}
          />
        ) : (
          <AdminCard>
            {isLoading ? <Skeleton lines={5} /> : isError ? (
              <div>
                <ErrorState message="Unable to load inventory." />
                <button type="button" onClick={() => refetch()} className="kicks-btn kicks-btn-secondary kicks-btn-sm mt-3">Retry</button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/15 bg-[#141414] p-8 text-center text-sm text-[#d5d5d5]">
                No products match this filter.
              </div>
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                {filteredProducts.map((product) => {
                  const stats = productStats(product);
                  return (
                    <div key={product._id} className="flex items-center gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-3 transition hover:border-white/20">
                      {productImage(product, 'h-14 w-14')}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{product.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#8d8d8d]">
                          {(product.brand?.name || product.brand || 'AJ SPORTS')} • {(product.category?.name || product.category || 'Sneakers')}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#a0a0a0]">
                          <span><strong className="text-white">{stats.total}</strong> units</span>
                          <span aria-hidden="true">•</span>
                          <span>{stats.sizes} size{stats.sizes === 1 ? '' : 's'}</span>
                          <span aria-hidden="true">•</span>
                          <span>{stats.low} low • {stats.out} out</span>
                          {stockPill(stats.state, stats.state === 'out' ? 'Out of stock' : 'Available')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedProductId(product._id); setMovementsVariantId(null); }}
                        aria-label={`View inventory for ${product.name}`}
                        className="kicks-btn kicks-btn-secondary kicks-btn-sm shrink-0"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {totalProducts > allProducts.length && (
              <p className="mt-3 text-xs text-[#767676]">Showing {allProducts.length} of {totalProducts} products. Refine search to find more.</p>
            )}
          </AdminCard>
        )}

        {saleTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Record offline sale">
            <div className="w-full max-w-sm rounded-[20px] border border-white/10 bg-[#0d0d0d] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d8d8d]">Offline sale</p>
              <h3 className="mt-1.5 text-lg font-bold text-white">{saleTarget.product?.name}</h3>
              <p className="mt-1 text-xs text-[#a0a0a0]">{saleTarget.variant?.color} / {saleTarget.variant?.size} • Current stock {getVariantStock(saleTarget.variant)}</p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3">
                <span className="text-xs uppercase tracking-[0.16em] text-[#8d8d8d]">Quantity sold</span>
                <span className="inline-flex items-center gap-2">
                  <button type="button" onClick={() => setSaleQty((qty) => Math.max(1, Math.floor(Number(qty) || 1) - 1))} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 text-lg text-white transition hover:border-white/35">−</button>
                  <span className="min-w-8 text-center text-sm font-bold text-white" aria-live="polite">{saleQty}</span>
                  <button type="button" onClick={() => setSaleQty((qty) => Math.min(getVariantStock(saleTarget.variant), Math.floor(Number(qty) || 0) + 1))} aria-label="Increase quantity" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 text-lg text-white transition hover:border-white/35">+</button>
                </span>
              </div>
              <p className="mt-3 text-sm text-[#d5d5d5]">New stock: <strong className="text-white">{getVariantStock(saleTarget.variant) - Math.floor(Number(saleQty) || 0)}</strong></p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => { setSaleTarget(null); setSaleQty(1); }} className="kicks-btn kicks-btn-secondary kicks-btn-sm flex-1">Cancel</button>
                <button
                  type="button"
                  onClick={confirmOfflineSale}
                  disabled={Boolean(saleBusy)}
                  className="kicks-btn kicks-btn-accent kicks-btn-sm flex-1"
                >
                  {saleBusy && <Loader2 size={13} className="animate-spin" />}
                  Confirm sale
                </button>
              </div>
            </div>
          </div>
        )}

        {adjustTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Adjust stock">
            <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[20px] border border-white/10 bg-[#0d0d0d] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d8d8d]">Stock adjustment</p>
              <h3 className="mt-1.5 text-lg font-bold text-white">{adjustTarget.product?.name}</h3>
              <p className="mt-1 text-xs text-[#a0a0a0]">{adjustTarget.variant?.color} / {adjustTarget.variant?.size} • Current stock {getVariantStock(adjustTarget.variant)}</p>
              {adjustError && <p role="alert" className="mt-3 rounded-[12px] border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">{adjustError}</p>}
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">Type</span>
                  <select value={adjustType} onChange={(event) => setAdjustType(event.target.value)} className="kicks-field kicks-field-sm w-full">
                    {['Offline Sale', 'Restock', 'Damage', 'Lost', 'Correction'].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                {adjustType === 'Correction' && (
                  <div className="flex gap-1.5" role="group" aria-label="Correction direction">
                    {[{ value: -1, label: '− Remove' }, { value: 1, label: '+ Add' }].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setAdjustSign(option.value)}
                        aria-pressed={adjustSign === option.value}
                        className="kicks-pill flex-1"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-[#8d8d8d]">Quantity</span>
                  <span className="inline-flex items-center gap-2">
                    <button type="button" onClick={() => setAdjustQty((qty) => Math.max(1, Math.floor(Number(qty) || 1) - 1))} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 text-lg text-white transition hover:border-white/35">−</button>
                    <span className="min-w-8 text-center text-sm font-bold text-white" aria-live="polite">{adjustQty}</span>
                    <button type="button" onClick={() => setAdjustQty((qty) => Math.floor(Number(qty) || 0) + 1)} aria-label="Increase quantity" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 text-lg text-white transition hover:border-white/35">+</button>
                  </span>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8d8d8d]">Note (optional)</span>
                  <input value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} placeholder="Optional note" className="kicks-field kicks-field-sm w-full" />
                </label>
                <p className="text-sm text-[#d5d5d5]">
                  New stock:{' '}
                  <strong className="text-white">
                    {getVariantStock(adjustTarget.variant) + (adjustType === 'Correction' ? adjustSign * Math.floor(Number(adjustQty) || 0) : adjustType === 'Restock' ? Math.floor(Number(adjustQty) || 0) : -Math.floor(Number(adjustQty) || 0))}
                  </strong>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setAdjustTarget(null); setAdjustError(''); }} className="kicks-btn kicks-btn-secondary kicks-btn-sm flex-1">Cancel</button>
                  <button
                    type="button"
                    onClick={saveAdjustment}
                    disabled={adjustBusy}
                    className="kicks-btn kicks-btn-accent kicks-btn-sm flex-1"
                  >
                    {adjustBusy && <Loader2 size={13} className="animate-spin" />}
                    Save adjustment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const OrdersSection = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [actionError, setActionError] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-orders', page, statusFilter, search], queryFn: () => apiClient.get('/orders', { params: { page, limit: 10, status: statusFilter || undefined, search: search.trim() || undefined } }).then((response) => response.data) });
    const orders = unwrapPayload(data)?.orders ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;
    const totalOrders = unwrapPayload(data)?.total ?? orders.length;
    const expandedOrder = orders.find((order) => String(order._id) === String(expandedOrderId)) || null;

    const orderActions = (row) => {
      const expanded = String(expandedOrderId) === String(row._id);
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={row.status} onChange={(event) => updateStatus(row._id, event.target.value)} aria-label={`Update status for ${row.orderNumber || 'order'}`} title="Update order status" className="rounded-full border border-white/10 bg-[#181818] px-2.5 py-1.5 text-[11px] text-white">
            {['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((statusItem) => <option key={statusItem} value={statusItem}>{statusItem}</option>)}
          </select>
          <button type="button" onClick={() => createShipment(row._id)} aria-label={`Create shipment for ${row.orderNumber || 'order'}`} title="Create shipment" className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white transition hover:border-white/30">
            <Truck size={14} />
          </button>
          <button type="button" onClick={() => downloadInvoice(row._id)} aria-label={`Download invoice for ${row.orderNumber || 'order'}`} title="Download invoice" className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white transition hover:border-white/30">
            <FileText size={14} />
          </button>
          <button type="button" onClick={() => setExpandedOrderId((current) => (String(current) === String(row._id) ? null : row._id))} aria-expanded={expanded} aria-label={expanded ? 'Hide order details' : 'View order details'} title={expanded ? 'Hide details' : 'View details'} className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${expanded ? 'border-[#FFC800]/50 bg-[#FFC800]/10 text-[#FFC800]' : 'border-[#FFC800]/40 text-[#FFC800] hover:bg-[#FFC800]/10'}`}>
            <Eye size={14} />
          </button>
        </div>
      );
    };

    const updateStatus = async (id, status) => {
      setActionError('');
      try {
        await apiClient.patch(`/orders/${id}/status`, { status });
        await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        showToast('Order status updated.', 'success');
      } catch (error) {
        setActionError(error?.message || 'Unable to update order status.');
      }
    };
    const createShipment = async (id) => {
      setActionError('');
      try {
        const result = await apiClient.post(`/admin/orders/${id}/ship`);
        await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        showToast('Shipment created.', 'success');
        return unwrapPayload(result.data)?.shipment ?? result.data;
      } catch (error) {
        setActionError(error?.message || 'Unable to create shipment.');
        return null;
      }
    };
    const downloadInvoice = async (id) => {
      setActionError('');
      try {
        const response = await apiClient.get(`/admin/orders/${id}/invoice`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `invoice-${id}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        setActionError(error?.message || 'Unable to download invoice.');
      }
    };

    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Order management"
          title="Orders"
          meta={`${totalOrders} order${totalOrders === 1 ? '' : 's'} in view`}
          actions={(
            <div className="flex flex-wrap gap-3">
              <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search orders" />
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by status" className="kicks-field text-sm text-white">
                <option value="">All statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          )}
        />

        {actionError && <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{actionError}</div>}

        {expandedOrder && (
          <AdminCard
            eyebrow="Order detail"
            title={expandedOrder.orderNumber || 'Order'}
            action={(
              <button type="button" onClick={() => setExpandedOrderId(null)} className="kicks-btn kicks-btn-secondary kicks-btn-sm">
                Close
              </button>
            )}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Status</p>
                <div className="mt-2"><StatusBadge status={expandedOrder.status} /></div>
                <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Payment</p>
                <div className="mt-2"><StatusBadge status={expandedOrder.paymentStatus} /></div>
                <p className="mt-3 text-xs text-[#8d8d8d]">Placed {expandedOrder.createdAt ? new Date(expandedOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
              </div>
              <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Customer</p>
                <p className="mt-2 truncate text-sm font-semibold text-white">{`${expandedOrder.customerSnapshot?.firstName || ''} ${expandedOrder.customerSnapshot?.lastName || ''}`.trim() || '—'}</p>
                <p className="mt-1 truncate text-xs text-[#a0a0a0]">{expandedOrder.customerSnapshot?.email || '—'}</p>
                {expandedOrder.customerSnapshot?.phone && <p className="mt-1 text-xs text-[#a0a0a0]">{expandedOrder.customerSnapshot.phone}</p>}
              </div>
              <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Ship to</p>
                <p className="mt-2 text-xs leading-relaxed text-[#d2d2d2]">
                  {[expandedOrder.shippingAddress?.firstName, expandedOrder.shippingAddress?.lastName].filter(Boolean).join(' ') || '—'}<br />
                  {expandedOrder.shippingAddress?.line1 || ''}{expandedOrder.shippingAddress?.line2 ? `, ${expandedOrder.shippingAddress.line2}` : ''}<br />
                  {[expandedOrder.shippingAddress?.city, expandedOrder.shippingAddress?.state, expandedOrder.shippingAddress?.postalCode].filter(Boolean).join(', ') || ''}
                </p>
              </div>
              <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Amounts</p>
                <div className="mt-2 space-y-1.5 text-xs text-[#d2d2d2]">
                  <div className="flex justify-between gap-3"><span>Subtotal</span><span className="text-white">{formatMoney(expandedOrder.subtotal || 0)}</span></div>
                  <div className="flex justify-between gap-3"><span>Shipping</span><span className="text-white">{formatMoney(expandedOrder.shippingCharge || 0)}</span></div>
                  <div className="flex justify-between gap-3"><span>Tax</span><span className="text-white">{formatMoney(expandedOrder.tax || 0)}</span></div>
                  <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5 text-sm font-semibold text-white"><span>Total</span><span>{formatMoney(expandedOrder.grandTotal || 0)}</span></div>
                  {expandedOrder.paymentId && <div className="truncate text-[#8d8d8d]">Payment ID: {expandedOrder.paymentId}</div>}
                </div>
              </div>
            </div>
            {Array.isArray(expandedOrder.items) && expandedOrder.items.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {expandedOrder.items.map((item, index) => (
                  <div key={item._id || item.variantId || index} className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3">
                    {item.image && <img src={item.image} alt={item.name || item.productName || 'Product'} className="h-11 w-11 shrink-0 rounded-lg object-cover" loading="lazy" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{item.name || item.productName || 'Product'}</div>
                      <div className="mt-0.5 truncate text-xs text-[#8d8d8d]">{[item.size, item.color].filter(Boolean).join(' • ') || ''} × {item.quantity || 1}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-white">{formatMoney(Number(item.unitPrice || item.finalPrice || 0) * Number(item.quantity || 1))}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadInvoice(expandedOrder._id)} className="kicks-btn kicks-btn-secondary kicks-btn-sm">Download invoice</button>
            </div>
          </AdminCard>
        )}

        {isLoading ? <Skeleton lines={6} /> : isError ? <ErrorState message="Unable to load orders." /> : (
          <AdminCard>
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  { key: 'orderNumber', label: 'Order', render: (row) => <div><div className="font-semibold text-white">{row.orderNumber}</div><div className="mt-0.5 text-[11px] text-[#8d8d8d]">{row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</div></div> },
                  { key: 'customer', label: 'Customer', render: (row) => <div><div className="text-white">{`${row.customerSnapshot?.firstName || ''} ${row.customerSnapshot?.lastName || ''}`.trim() || '—'}</div><div className="text-[11px] text-[#8d8d8d]">{row.customerSnapshot?.email || ''}</div></div> },
                  { key: 'items', label: 'Items', render: (row) => <span>{row.items?.length || 0}</span> },
                  { key: 'grandTotal', label: 'Amount', render: (row) => <span className="font-semibold text-white">{formatMoney(row.grandTotal || 0)}</span> },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                  { key: 'paymentStatus', label: 'Payment', render: (row) => <StatusBadge status={row.paymentStatus} /> },
                  { key: 'actions', label: 'Actions', render: (row) => orderActions(row) },
                ]}
                rows={orders}
                emptyMessage="No orders match the current filter."
              />
            </div>
            <div className="space-y-3 lg:hidden">
              {orders.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d5d5d5]">No orders match the current filter.</div>
              ) : orders.map((row) => (
                <div key={row._id} className="rounded-[18px] border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{row.orderNumber}</div>
                      <div className="mt-0.5 truncate text-xs text-[#8d8d8d]">{row.customerSnapshot?.email || 'Customer'} • {row.items?.length || 0} items</div>
                    </div>
                    <span className="shrink-0 font-semibold text-white">{formatMoney(row.grandTotal || 0)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={row.status} />
                    <StatusBadge status={row.paymentStatus} />
                  </div>
                  <div className="mt-3 border-t border-white/10 pt-3">{orderActions(row)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </AdminCard>
        )}
      </div>
    );
  };

  const CustomersSection = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState('');
    const { data, isLoading, isError } = useQuery({ queryKey: ['admin-customers', page], queryFn: () => apiClient.get('/admin/users', { params: { page, limit: 10 } }).then((response) => response.data) });
    const users = unwrapPayload(data)?.items ?? [];
    const totalPages = unwrapPayload(data)?.totalPages || 1;
    const filteredUsers = users.filter((user) => `${user.firstName || ''} ${user.lastName || ''} ${user.email || ''}`.toLowerCase().includes(search.toLowerCase()));

    const toggleStatus = async (row) => {
      setActionError('');
      const nextActive = !row.isActive;
      if (!nextActive && !window.confirm(`Disable ${row.firstName || ''} ${row.lastName || ''} (${row.email || 'account'})? They will be signed out and blocked from logging in.`)) return;
      try {
        await adminApi.updateUserStatus(row._id, nextActive);
        await queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
        showToast(nextActive ? 'Account enabled.' : 'Account disabled.', 'success');
      } catch (error) {
        setActionError(error?.message || 'Unable to update account status.');
      }
    };

    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Customer management"
          title="Customers"
          meta={`${unwrapPayload(data)?.total ?? users.length} accounts`}
          actions={(
            <div className="w-full max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Search customers" /></div>
          )}
        />

        {actionError && <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{actionError}</div>}

        {isLoading ? <Skeleton lines={6} /> : isError ? <ErrorState message="Unable to load user accounts." /> : (
          <AdminCard>
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  { key: 'name', label: 'Name', render: (row) => <span className="font-semibold text-white">{row.firstName} {row.lastName}</span> },
                  { key: 'email', label: 'Email', render: (row) => <span>{row.email}</span> },
                  { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} /> },
                  { key: 'verified', label: 'Verified', render: (row) => <span className={row.emailVerified ? 'text-emerald-300' : 'text-[#8d8d8d]'}>{row.emailVerified ? 'Yes' : 'No'}</span> },
                  { key: 'joined', label: 'Joined', render: (row) => <span className="text-xs">{row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span> },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                  { key: 'actions', label: 'Action', render: (row) => <button type="button" onClick={() => toggleStatus(row)} className="kicks-btn kicks-btn-secondary kicks-btn-sm">{row.isActive ? 'Disable' : 'Enable'}</button> },
                ]}
                rows={filteredUsers}
                emptyMessage="No users found."
              />
            </div>
            <div className="space-y-3 lg:hidden">
              {filteredUsers.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/15 bg-[#181818] p-8 text-center text-[#d5d5d5]">No users found.</div>
              ) : filteredUsers.map((row) => (
                <div key={row._id} className="rounded-[18px] border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{row.firstName} {row.lastName}</div>
                      <div className="mt-0.5 truncate text-xs text-[#8d8d8d]">{row.email}</div>
                    </div>
                    <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8d8d8d]">
                    <StatusBadge status={row.role} />
                    <span>{row.emailVerified ? 'Verified' : 'Unverified'}</span>
                    <span>•</span>
                    <span>Joined {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                  </div>
                  <button type="button" onClick={() => toggleStatus(row)} className="kicks-btn kicks-btn-secondary kicks-btn-sm mt-3 w-full">{row.isActive ? 'Disable' : 'Enable'}</button>
                </div>
              ))}
            </div>
            <div className="mt-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </AdminCard>
        )}
      </div>
    );
  };

  const ShippingSection = () => {
    const queryClientRef = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [providerFilter, setProviderFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [createOrderId, setCreateOrderId] = useState('');
    const [createBusy, setCreateBusy] = useState(false);
    const [createError, setCreateError] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
      queryKey: ['admin-shipments', page, statusFilter, providerFilter, search],
      queryFn: () => adminApi.shipments({ page, limit: 20, status: statusFilter || undefined, provider: providerFilter || undefined, search: search.trim() || undefined }),
      keepPreviousData: true,
    });

    const shipments = unwrapPayload(data)?.shipments ?? [];
    const total = unwrapPayload(data)?.total ?? 0;
    const totalPages = unwrapPayload(data)?.totalPages || 1;

    const detailQuery = useQuery({
      queryKey: ['admin-shipment-detail', selectedShipment],
      queryFn: () => adminApi.shipmentById(selectedShipment),
      enabled: !!selectedShipment,
    });
    const detail = unwrapPayload(detailQuery.data)?.shipment ?? null;

    const openDetail = (id) => {
      setSelectedShipment(id);
      setDetailOpen(true);
    };
    const closeDetail = () => {
      setDetailOpen(false);
      setSelectedShipment(null);
    };

    const handleCreateShipment = async () => {
      if (!createOrderId.trim()) return;
      setCreateBusy(true);
      setCreateError('');
      try {
        await adminApi.createShipment(createOrderId.trim());
        setCreateOrderId('');
        refetch();
        queryClientRef.invalidateQueries({ queryKey: ['admin-orders'] });
      } catch (err) {
        setCreateError(err?.response?.data?.message || err?.message || 'Failed to create shipment');
      } finally {
        setCreateBusy(false);
      }
    };

    const shipmentStatuses = ['PENDING', 'PROCESSING', 'CREATED', 'AWB_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED', 'SHIPPED'];

    const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const getTrackingUrl = (s) => {
      if (!s) return '';
      if (typeof s.trackingUrl === 'string' && /^https?:\/\//i.test(s.trackingUrl)) return s.trackingUrl;
      return '';
    };

    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Fulfillment"
          title="Shipping"
          meta={`${total} shipment${total !== 1 ? 's' : ''} tracked`}
          actions={(
            <button type="button" onClick={() => refetch()} className="kicks-btn kicks-btn-secondary kicks-btn-sm">
              <RefreshCw size={13} /> Refresh
            </button>
          )}
        />

        <AdminCard>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search orders, AWB, customer…" /></div>
            <div className="flex flex-wrap gap-3">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter by status" className="kicks-field text-sm text-white">
                <option value="">All statuses</option>
                {shipmentStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={providerFilter} onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }} aria-label="Filter by provider" className="kicks-field text-sm text-white">
                <option value="">All providers</option>
                <option value="shiprocket">Shiprocket</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
        </AdminCard>

        <AdminCard eyebrow="New shipment" title="Create shipment">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={createOrderId}
              onChange={(e) => { setCreateOrderId(e.target.value); setCreateError(''); }}
              placeholder="Enter Order ID to ship…"
              aria-label="Order ID to ship"
              className="flex-1 kicks-field text-sm text-white placeholder:text-[#666]"
            />
            <button
              type="button"
              onClick={handleCreateShipment}
              disabled={createBusy || !createOrderId.trim()}
              className="kicks-btn kicks-btn-accent"
            >
              {createBusy ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              Create shipment
            </button>
          </div>
          {createError && <p className="mt-3 text-sm text-red-300">{createError}</p>}
        </AdminCard>

        {/* Shipment Table (Desktop) */}
        {isLoading ? <Skeleton lines={8} /> : isError ? (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <ErrorState message="Unable to load shipments." />
            <button type="button" onClick={() => refetch()} className="mt-4 kicks-btn kicks-btn-secondary kicks-btn-sm">Retry</button>
          </div>
        ) : shipments.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <EmptyState title="No shipments found" description="Adjust your filters or create a new shipment above." />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden rounded-[24px] border border-white/10 bg-[#111111] p-4 lg:block">
              <DataTable
                columns={[
                  { key: 'order', label: 'Order', render: (row) => (
                    <div>
                      <div className="font-semibold text-white">{row.order?.orderNumber || '—'}</div>
                      <div className="text-[11px] text-[#8d8d8d]">{row.order?.customerSnapshot?.email || '—'}</div>
                    </div>
                  ) },
                  { key: 'awb', label: 'AWB', render: (row) => <span className="font-mono text-sm text-white">{row.awb || '—'}</span> },
                  { key: 'provider', label: 'Provider', render: (row) => <span className="text-sm capitalize text-[#d2d2d2]">{row.provider || '—'}</span> },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                  { key: 'total', label: 'Total', render: (row) => <span className="text-sm text-white">{formatMoney(row.order?.grandTotal || 0)}</span> },
                  { key: 'created', label: 'Created', render: (row) => <span className="text-xs text-[#a5a5a5]">{fmtDate(row.createdAt)}</span> },
                  { key: 'actions', label: 'Actions', render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openDetail(row._id)} className="kicks-btn kicks-btn-secondary kicks-btn-sm">Details</button>
                      {getTrackingUrl(row) && (
                        <a href={getTrackingUrl(row)} target="_blank" rel="noopener noreferrer" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
                          Track <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ) },
                ]}
                rows={shipments}
                emptyMessage="No shipments match the current filter."
              />
            </div>

            {/* Mobile Cards */}
            <div className="space-y-2.5 lg:hidden">
              {shipments.map((s) => (
                <div key={s._id} className="rounded-[20px] border border-white/10 bg-[#111111] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-white">{s.order?.orderNumber || '—'}</div>
                      <div className="mt-1 text-xs text-[#a0a0a0]">{s.order?.customerSnapshot?.email || '—'}</div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#8c8c8c]">AWB:</span> <span className="font-mono text-white">{s.awb || '—'}</span></div>
                    <div><span className="text-[#8c8c8c]">Provider:</span> <span className="capitalize text-white">{s.provider || '—'}</span></div>
                    <div><span className="text-[#8c8c8c]">Total:</span> <span className="text-white">{formatMoney(s.order?.grandTotal || 0)}</span></div>
                    <div><span className="text-[#8c8c8c]">Created:</span> <span className="text-white">{fmtDate(s.createdAt)}</span></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => openDetail(s._id)} className="kicks-btn kicks-btn-secondary kicks-btn-sm">Details</button>
                    {getTrackingUrl(s) && (
                      <a href={getTrackingUrl(s)} target="_blank" rel="noopener noreferrer" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
                        Track <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}

        {/* Detail Drawer/Modal */}
        {detailOpen && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={closeDetail}>
            <div className="h-full w-full max-w-[560px] overflow-y-auto bg-[#0a0a0a] p-5 shadow-2xl md:p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-[-0.04em] text-white">Shipment details</h3>
                <button type="button" onClick={closeDetail} aria-label="Close details" className="kicks-icon-btn h-9 w-9">
                  <X size={15} />
                </button>
              </div>

              {detailQuery.isLoading ? <Skeleton lines={10} /> : detailQuery.isError ? (
                <ErrorState message="Unable to load shipment details." />
              ) : detail ? (
                <div className="space-y-6">
                  {/* Shipment Info */}
                  <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Shipment</div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[#8c8c8c]">Status</span><StatusBadge status={detail.status} /></div>
                      <div className="flex justify-between"><span className="text-[#8c8c8c]">Provider</span><span className="capitalize text-white">{detail.provider}</span></div>
                      <div className="flex justify-between"><span className="text-[#8c8c8c]">Shipment ID</span><span className="font-mono text-white">{detail.shipmentId || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-[#8c8c8c]">AWB</span><span className="font-mono text-white">{detail.awb || '—'}</span></div>
                      {getTrackingUrl(detail) && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#8c8c8c]">Tracking</span>
                          <a href={getTrackingUrl(detail)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#7ee7c2] underline underline-offset-2">
                            Track shipment <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      <div className="flex justify-between"><span className="text-[#8c8c8c]">Created</span><span className="text-white">{fmtDate(detail.createdAt)}</span></div>
                      <div className="flex justify-between"><span className="text-[#8c8c8c]">Updated</span><span className="text-white">{fmtDate(detail.updatedAt)}</span></div>
                      {detail.failureReason && (
                        <div className="mt-2 rounded-[14px] border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{detail.failureReason}</div>
                      )}
                    </div>
                  </div>

                  {/* Order Info */}
                  {detail.order && (
                    <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Order</div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Order #</span><span className="font-semibold text-white">{detail.order.orderNumber}</span></div>
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Status</span><StatusBadge status={detail.order.status} /></div>
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Payment</span><StatusBadge status={detail.order.paymentStatus} /></div>
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Grand total</span><span className="font-semibold text-white">{formatMoney(detail.order.grandTotal || 0)}</span></div>
                        {detail.order.subtotal != null && <div className="flex justify-between"><span className="text-[#8c8c8c]">Subtotal</span><span className="text-white">{formatMoney(detail.order.subtotal)}</span></div>}
                        {detail.order.tax != null && <div className="flex justify-between"><span className="text-[#8c8c8c]">Tax</span><span className="text-white">{formatMoney(detail.order.tax)}</span></div>}
                        {detail.order.shippingCharge != null && <div className="flex justify-between"><span className="text-[#8c8c8c]">Shipping</span><span className="text-white">{formatMoney(detail.order.shippingCharge)}</span></div>}
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Placed</span><span className="text-white">{fmtDate(detail.order.createdAt)}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  {detail.order?.customerSnapshot && (
                    <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Customer</div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Name</span><span className="text-white">{detail.order.customerSnapshot.firstName || ''} {detail.order.customerSnapshot.lastName || ''}</span></div>
                        <div className="flex justify-between"><span className="text-[#8c8c8c]">Email</span><span className="text-white">{detail.order.customerSnapshot.email || '—'}</span></div>
                        {detail.order.customerSnapshot.phone && <div className="flex justify-between"><span className="text-[#8c8c8c]">Phone</span><span className="text-white">{detail.order.customerSnapshot.phone}</span></div>}
                      </div>
                    </div>
                  )}

                  {/* Shipping Address */}
                  {detail.order?.shippingAddress && (
                    <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Shipping address</div>
                      <div className="mt-3 text-sm leading-relaxed text-[#d2d2d2]">
                        {[detail.order.shippingAddress.firstName, detail.order.shippingAddress.lastName].filter(Boolean).join(' ')}<br />
                        {detail.order.shippingAddress.line1}{detail.order.shippingAddress.line2 ? `, ${detail.order.shippingAddress.line2}` : ''}<br />
                        {[detail.order.shippingAddress.city, detail.order.shippingAddress.state, detail.order.shippingAddress.postalCode].filter(Boolean).join(', ')}<br />
                        {detail.order.shippingAddress.country || 'India'}
                        {detail.order.shippingAddress.phone && <><br />{detail.order.shippingAddress.phone}</>}
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  {detail.order?.items?.length > 0 && (
                    <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Items ({detail.order.items.length})</div>
                      <div className="mt-3 space-y-3">
                        {detail.order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-[#181818] p-3">
                            {item.image && <img src={item.image} alt={item.name || 'Product'} className="h-12 w-12 rounded-lg object-cover" />}
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-semibold text-white">{item.name || item.productName || 'Product'}</div>
                              <div className="mt-0.5 text-xs text-[#a0a0a0]">
                                {item.size && `Size: ${item.size}`}{item.size && item.color ? ' • ' : ''}{item.color && `Color: ${item.color}`}
                                {' × '}{item.quantity || 1}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-white">{formatMoney((item.unitPrice || item.finalPrice || 0) * (item.quantity || 1))}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shipment Events Timeline */}
                  {detail.events?.length > 0 && (
                    <div className="rounded-[20px] border border-white/10 bg-[#111111] p-5">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Timeline</div>
                      <div className="mt-4 space-y-0">
                        {detail.events.map((event, idx) => (
                          <div key={idx} className="relative flex gap-4 pb-4">
                            <div className="flex flex-col items-center">
                              <div className="h-3 w-3 rounded-full border-2 border-[#7ee7c2] bg-[#111111]" />
                              {idx < detail.events.length - 1 && <div className="w-px flex-1 bg-white/10" />}
                            </div>
                            <div className="-mt-0.5">
                              <div className="text-sm font-semibold text-white">{event.status}</div>
                              <div className="text-xs text-[#a0a0a0]">{fmtDate(event.occurredAt)}</div>
                              {event.providerReference && <div className="mt-0.5 text-xs text-[#666]">Ref: {event.providerReference}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState title="Shipment not found" description="The requested shipment could not be loaded." />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const SETTINGS_DEFAULTS = {
    'store.name': 'AJ SPORTS',
    'store.tagline': 'Premium sneakers for movement and everyday expression',
    'store.description': '',
    'store.logoUrl': '',
    'store.currency': 'INR',
    'store.country': 'India',
    'store.timezone': 'Asia/Kolkata',
    'contact.email': 'support@kicks.example',
    'contact.phone': '+91 98765 43210',
    'contact.address': '12 MG Road, Bengaluru, India',
    'contact.hours': '',
    'checkout.reviewsEnabled': true,
    'notifications.orderEmails': true,
    'notifications.paymentEmails': true,
    'notifications.shippingEmails': true,
    'notifications.deliveryEmails': true,
  };

  const SETTINGS_GROUPS = [
    {
      id: 'store',
      label: 'Store',
      icon: ShoppingBag,
      fields: [
        { key: 'store.name', label: 'Store name', type: 'text', placeholder: 'AJ SPORTS' },
        { key: 'store.tagline', label: 'Tagline', type: 'text', placeholder: 'Premium sneakers for movement' },
        { key: 'store.description', label: 'Description', type: 'textarea', placeholder: 'Short store description' },
        { key: 'store.logoUrl', label: 'Logo URL', type: 'url', placeholder: 'https://…', hint: 'Used only where the storefront renders a custom logo.' },
        { key: 'store.currency', label: 'Currency', type: 'text', placeholder: 'INR' },
        { key: 'store.country', label: 'Country', type: 'text', placeholder: 'India' },
        { key: 'store.timezone', label: 'Timezone', type: 'text', placeholder: 'Asia/Kolkata' },
      ],
    },
    {
      id: 'contact',
      label: 'Contact',
      icon: MapPin,
      fields: [
        { key: 'contact.email', label: 'Support email', type: 'email', placeholder: 'support@example.com' },
        { key: 'contact.phone', label: 'Support phone', type: 'text', placeholder: '+91 90000 00000' },
        { key: 'contact.address', label: 'Business address', type: 'textarea', placeholder: 'Street, city, country' },
        { key: 'contact.hours', label: 'Support hours', type: 'text', placeholder: 'Mon–Sat, 9am–7pm' },
      ],
    },
    {
      id: 'checkout',
      label: 'Checkout & Orders',
      icon: Package,
      note: 'Order totals are computed server-side. Shipping and tax handling is fixed by the checkout flow and cannot be changed here.',
      fields: [
        { key: 'checkout.reviewsEnabled', label: 'Product reviews', type: 'toggle', hint: 'When off, customers cannot submit new product reviews.' },
      ],
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      note: 'Controls transactional emails sent by the backend. Templates are unchanged.',
      fields: [
        { key: 'notifications.orderEmails', label: 'Order emails', type: 'toggle', hint: 'Order confirmation and cancellation emails.' },
        { key: 'notifications.paymentEmails', label: 'Payment emails', type: 'toggle', hint: 'Payment confirmation emails.' },
        { key: 'notifications.shippingEmails', label: 'Shipping emails', type: 'toggle', hint: 'Shipped and out-for-delivery emails.' },
        { key: 'notifications.deliveryEmails', label: 'Delivery emails', type: 'toggle', hint: 'Delivered emails.' },
      ],
    },
    { id: 'account', label: 'Admin Account', icon: User2, custom: true },
  ];

  const SettingsToggle = ({ checked, onChange, label }) => (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative flex h-7 w-12 shrink-0 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-white/60 ${checked ? 'justify-end border-white/40 bg-white/15' : 'justify-start border-white/10 bg-[#181818]'}`}
    >
      <span className={`mx-1 h-5 w-5 rounded-full ${checked ? 'bg-white' : 'bg-[#555]'}`} />
    </button>
  );

  const SettingsSection = () => {
    const { showToast } = useToast();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeGroup, setActiveGroup] = useState('store');
    const [drafts, setDrafts] = useState({});
    const [saving, setSaving] = useState(false);
    const [formStatus, setFormStatus] = useState(null);
    const [pwError, setPwError] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const pwForm = useForm({
      resolver: zodResolver(z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(8, 'New password must be at least 8 characters'),
        confirmPassword: z.string().min(1, 'Please confirm your new password'),
      }).refine((values) => values.newPassword === values.confirmPassword, {
        message: 'New passwords do not match',
        path: ['confirmPassword'],
      })),
      defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: () => adminApi.settings() });
    const meQuery = useQuery({ queryKey: ['admin-me'], queryFn: () => authApi.me() });

    const savedMap = useMemo(() => {
      const items = unwrapPayload(settingsQuery.data)?.settings ?? [];
      const map = { ...SETTINGS_DEFAULTS };
      for (const item of items) {
        if (item && typeof item.key === 'string') map[item.key] = item.value;
      }
      return map;
    }, [settingsQuery.data]);

    const group = SETTINGS_GROUPS.find((entry) => entry.id === activeGroup) || SETTINGS_GROUPS[0];
    const groupFields = group.fields || [];
    const dirtyKeys = groupFields
      .filter((field) => drafts[field.key] !== undefined && drafts[field.key] !== savedMap[field.key])
      .map((field) => field.key);
    const valueFor = (key) => (drafts[key] !== undefined ? drafts[key] : savedMap[key]);

    const saveSection = async () => {
      if (saving || dirtyKeys.length === 0) return;
      setSaving(true);
      setFormStatus(null);
      try {
        for (const key of dirtyKeys) {
          await adminApi.updateSetting(key, { value: drafts[key] });
        }
        await settingsQuery.refetch();
        setDrafts((current) => {
          const next = { ...current };
          dirtyKeys.forEach((key) => { delete next[key]; });
          return next;
        });
        const message = `Saved ${dirtyKeys.length} setting${dirtyKeys.length === 1 ? '' : 's'}.`;
        setFormStatus({ type: 'success', message });
        showToast(message, 'success');
      } catch (error) {
        setFormStatus({ type: 'error', message: error?.message || 'Unable to save settings.' });
      } finally {
        setSaving(false);
      }
    };

    const changeAdminPassword = async (values) => {
      setPwError('');
      setPwSaving(true);
      try {
        await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
        showToast('Password changed. Please log in again.', 'success');
        await logout().catch(() => {});
        navigate('/login', { replace: true });
      } catch (error) {
        setPwError(error?.message || 'Unable to change password.');
      } finally {
        setPwSaving(false);
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
      await logout().catch(() => {});
      navigate('/login', { replace: true });
    };

    const adminUser = unwrapPayload(meQuery.data)?.user || null;

    const renderField = (field) => {
      const value = valueFor(field.key);
      if (field.type === 'toggle') {
        return (
          <div key={field.key} className="flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{field.label}</p>
              {field.hint && <p className="mt-1 text-xs text-[#8d8d8d]">{field.hint}</p>}
            </div>
            <SettingsToggle checked={Boolean(value)} onChange={(next) => setDrafts((current) => ({ ...current, [field.key]: next }))} label={field.label} />
          </div>
        );
      }
      return (
        <div key={field.key}>
          <label htmlFor={`setting-${field.key}`} className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#a8a8a8]">
            {field.label}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              id={`setting-${field.key}`}
              rows={3}
              value={value ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
              className="w-full rounded-[18px] border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
            />
          ) : (
            <input
              id={`setting-${field.key}`}
              type={field.type === 'email' || field.type === 'url' ? 'text' : 'text'}
              inputMode={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
              value={value ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
              className="w-full kicks-field text-sm text-white outline-none transition focus:border-white/30"
            />
          )}
          {field.hint && <p className="mt-1.5 text-xs text-[#8d8d8d]">{field.hint}</p>}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <AdminPageHeader eyebrow="Workspace" title="Settings" />
        <AdminCard>
          <nav aria-label="Settings sections" className="flex gap-1.5 overflow-x-auto pb-1">
            {SETTINGS_GROUPS.map((entry) => {
              const Icon = entry.icon;
              const isActive = entry.id === group.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => { setActiveGroup(entry.id); setFormStatus(null); }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#FFC800]/60 ${
                    isActive ? 'bg-[#FFC800] text-black' : 'border border-white/10 text-[#c4c4c4] hover:border-white/30 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </nav>
        </AdminCard>

        {settingsQuery.isLoading ? (
          <Skeleton lines={5} />
        ) : settingsQuery.isError ? (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <ErrorState message="Unable to load settings." />
            <button type="button" onClick={() => settingsQuery.refetch()} className="mt-4 kicks-btn kicks-btn-secondary kicks-btn-sm">Retry</button>
          </div>
        ) : group.custom ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
              <h4 className="text-lg font-bold text-white">Administrator</h4>
              {meQuery.isLoading ? (
                <div className="mt-4 h-20 animate-pulse rounded-[18px] bg-[#181818]" />
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8d8d8d]">Name</span>
                    <span className="font-semibold text-white">{adminUser ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || '—' : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8d8d8d]">Email</span>
                    <span className="truncate font-semibold text-white">{adminUser?.email || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8d8d8d]">Role</span>
                    <StatusBadge status={adminUser?.role || 'ADMIN'} />
                  </div>
                  <p className="rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3 text-xs leading-relaxed text-[#8d8d8d]">
                    The administrator role cannot be changed here, and no additional admin accounts can be created from this screen.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
              <h4 className="text-lg font-bold text-white">Change password</h4>
              <form onSubmit={pwForm.handleSubmit(changeAdminPassword)} className="mt-4 space-y-4">
                <PasswordField label="Current password" name="currentPassword" register={pwForm.register} error={pwForm.formState.errors.currentPassword?.message} placeholder="Current password" />
                <PasswordField label="New password" name="newPassword" register={pwForm.register} error={pwForm.formState.errors.newPassword?.message} placeholder="Minimum 8 characters" />
                <PasswordField label="Confirm new password" name="confirmPassword" register={pwForm.register} error={pwForm.formState.errors.confirmPassword?.message} placeholder="Confirm new password" />
                <button
                  type="submit"
                  disabled={pwSaving || pwForm.formState.isSubmitting}
                  className="w-full kicks-btn kicks-btn-primary kicks-btn-sm transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
                >
                  {pwSaving ? 'Updating...' : 'Update password'}
                </button>
                {pwError && <p className="text-sm text-red-300">{pwError}</p>}
                <p className="text-xs text-[#8d8d8d]">Changing the password signs out every active session, including this one.</p>
              </form>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6 lg:col-span-2">
              <h4 className="text-lg font-bold text-white">Active sessions</h4>
              <p className="mt-2 text-sm text-[#a8a8a8]">End every admin session at once, including this device. You will need to log in again.</p>
              <button
                type="button"
                onClick={signOutEverywhere}
                className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] border border-red-500/30 px-4 h-9 text-xs font-semibold text-red-200 transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                <LogOut size={14} /> Sign out everywhere
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-lg font-bold text-white">{group.label}</h4>
              {dirtyKeys.length > 0 && <span className="text-xs uppercase tracking-[0.18em] text-[#f4d66a]">• Unsaved changes</span>}
            </div>
            {group.note && <p className="mt-2 text-sm text-[#8d8d8d]">{group.note}</p>}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {groupFields.map(renderField)}
            </div>
            {formStatus && (
              <p className={`mt-4 text-sm ${formStatus.type === 'success' ? 'text-[#9feec8]' : 'text-red-300'}`}>{formStatus.message}</p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveSection}
                disabled={saving || dirtyKeys.length === 0}
                className="kicks-btn kicks-btn-primary kicks-btn-sm"
              >
                {saving ? 'Saving...' : dirtyKeys.length > 0 ? `Save ${dirtyKeys.length} change${dirtyKeys.length === 1 ? '' : 's'}` : 'Saved'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <DashboardSection />;
      case 'products': return <ProductsSection />;
      case 'inventory': return <InventorySection />;
      case 'orders': return <OrdersSection />;
      case 'customers': return <CustomersSection />;
      case 'users': return <CustomersSection />;
      case 'shipping': return <ShippingSection />;
      case 'settings': return <SettingsSection />;
      default: return <DashboardSection />;
    }
  };

  return (
    <div className="admin-shell mx-auto w-full max-w-[1500px] px-4 py-6 sm:py-8 lg:px-8">
      <PageMeta title="Admin | AJ SPORTS" description="AJ SPORTS administrator dashboard" />

      <div className="grid items-start gap-5 xl:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="admin-scroll sticky top-20 hidden h-[calc(100vh-6rem)] flex-col overflow-y-auto rounded-[14px] border border-white/[0.08] bg-[#0b0b0b] p-3 xl:flex">
          {renderSidebarBody()}
        </aside>

        {drawerOpen && (
          <div className="admin-fade-in fixed inset-0 z-[70] xl:hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <aside className="admin-drawer-in admin-scroll absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto rounded-r-[16px] border-r border-white/[0.08] bg-[#0b0b0b] p-4" role="dialog" aria-modal="true" aria-label="Admin menu">
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close admin menu"
                  className="kicks-icon-btn"
                >
                  <X size={15} />
                </button>
              </div>
              {renderSidebarBody()}
            </aside>
          </div>
        )}

        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-white/[0.08] bg-[#0d0d0d] px-3.5 py-3 sm:px-4">
            <span className="shrink-0 xl:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open admin menu"
                className="kicks-icon-btn"
              >
                <Menu size={15} />
              </button>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] uppercase tracking-[0.24em] text-[#8d8d8d]">{todayLabel}</p>
              <p className="mt-0.5 truncate text-base font-bold text-white sm:text-lg">
                {greeting}, {user?.firstName || 'Admin'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden shrink-0 sm:inline-flex">
                <Link
                  to="/faq"
                  aria-label="Help and FAQs"
                  title="Help and FAQs"
                  className="kicks-icon-btn"
                >
                  <Info size={15} />
                </Link>
              </span>
              <Link
                to="/"
                className="hidden h-8 items-center gap-1.5 rounded-[10px] border border-white/10 px-3 text-[11px] font-semibold text-white transition hover:border-white/30 sm:inline-flex"
              >
                <ExternalLink size={12} /> Storefront
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  aria-label="Admin account menu"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  title="Admin account"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#FFC800]/40 bg-[#FFC800]/10 text-[13px] font-black text-[#FFC800] transition hover:bg-[#FFC800]/20"
                >
                  {adminInitials}
                </button>
                {menuOpen && (
                  <div role="menu" aria-label="Admin account" className="admin-pop absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-[14px] border border-white/[0.08] bg-[#101010] p-2 shadow-2xl shadow-black/60">
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-bold text-white">{adminName}</p>
                      <p className="truncate text-xs text-[#8d8d8d]">{user?.email || ''}</p>
                    </div>
                    <div className="border-t border-white/10 pt-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-xs font-semibold text-[#f0a8a8] transition hover:bg-red-500/10"
                      >
                        <LogOut size={14} /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>{renderSection()}</div>
        </div>
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
