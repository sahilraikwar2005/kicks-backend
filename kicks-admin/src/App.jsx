import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import {
  Archive,
  ArrowLeft,
  Bell,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
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
  Trash2,
  Truck,
  RefreshCw,
  Users,
  X,
  User2,
  IndianRupee,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from './api/client';
import { colorKey, dedupeColors, normalizeColorName } from './utils/variantMatrix';
import { NEUTRAL_PRODUCT_IMAGE } from './components/ui/productImage';
import { adminApi } from './api/admin.api';
import { authApi } from './api/auth.api';
import { useAuth } from './context/useAuth';
import { ToastProvider } from './context/ToastProvider';
import { useToast } from './context/useToast';
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

// Absolute URL of the customer storefront (separate app). Returns null when
// unconfigured so admin UI never links into a dead route.
const storefrontUrl = (path = '') => {
  const base = String(import.meta.env.VITE_STOREFRONT_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  const suffix = String(path || '');
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
};

function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white">Checking access...</div>;
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace />;
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

// Simplified business model: ONE PRODUCT = ONE COLOR. Product type drives
// the size UI (shoe sizes vs apparel sizes vs quantity-only). No backend
// change needed: type is an optional product field, sizes stay variant rows,
// and quantity-only products use a single "Free Size" variant.
const PRODUCT_TYPES = {
  SHOES: { label: 'Shoes', sizes: SIZE_SYSTEMS.UK, mode: 'sizes' },
  SLIDES: { label: 'Slides', sizes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'], mode: 'sizes' },
  CROCKS: { label: 'Crocks', sizes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'], mode: 'sizes' },
  TSHIRT: { label: 'T-Shirts', sizes: ['S', 'M', 'L', 'XL', 'XXL'], mode: 'sizes' },
  LOWER: { label: 'Lower', sizes: ['S', 'M', 'L', 'XL', 'XXL'], mode: 'sizes' },
  SHORTS: { label: 'Shorts', sizes: ['S', 'M', 'L', 'XL'], mode: 'sizes' },
  JERSEY: { label: 'Jerseys', sizes: ['S', 'M', 'L', 'XL', 'XXL'], mode: 'sizes' },
  SOCKS: { label: 'Socks', sizes: ['Free Size'], mode: 'sizes' },
  ACCESSORIES: { label: 'Accessories', sizes: ['Free Size'], mode: 'quantity' },
  OTHER: { label: 'Other', sizes: ['Free Size'], mode: 'quantity' },
};

const productTypeOf = (product) => (PRODUCT_TYPES[product?.type] ? product.type : 'SHOES');
const sizesForType = (type) => PRODUCT_TYPES[type]?.sizes || PRODUCT_TYPES.SHOES.sizes;

// Single display color for a product (all variants share one color in the
// simplified model; legacy multi-color products show their first color).
const productColor = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return String(variants[0]?.color || '').trim();
};

// Optimized Cloudinary thumbnails for admin lists/cards. Only rewrites
// delivery URLs (…/upload/…); every other URL passes through untouched so
// non-Cloudinary images keep working.
const cloudinaryThumb = (url, width = 160) => {
  if (typeof url !== 'string' || !url) return url;
  const marker = '/upload/';
  const index = url.indexOf(marker);
  if (index < 0) return url;
  const after = url.slice(index + marker.length);
  if (/^(w_|h_|c_|q_|f_|e_)/.test(after)) return url;
  const size = Math.max(1, Math.floor(Number(width) || 160));
  return `${url.slice(0, index + marker.length)}w_${size},q_auto,f_auto/${after}`;
};

// Compact stacked product thumbnails for admin order rows. Uses the
// order-item image snapshot first (the exact purchased image), then a
// populated product image, then the neutral placeholder — never broken.
const orderItemThumbSrc = (item) => {
  if (item?.image) return item.image;
  const product = item?.productId;
  if (product && typeof product === 'object' && Array.isArray(product.images) && product.images[0]) {
    return product.images[0];
  }
  return NEUTRAL_PRODUCT_IMAGE;
};

const orderItemThumbName = (item) => item?.name || item?.productName
  || (item?.productId && typeof item.productId === 'object' ? item.productId.name : '') || 'Product';

const OrderProductThumbs = ({ items }) => {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;
  const visible = list.slice(0, 3);
  const extra = list.length - visible.length;
  return (
    <span className="inline-flex items-center">
      {visible.map((item, index) => (
        <img
          key={item?._id || item?.variantId || index}
          src={cloudinaryThumb(orderItemThumbSrc(item), 96)}
          alt=""
          title={orderItemThumbName(item)}
          loading="lazy"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }}
          className={`h-10 w-10 rounded-lg border border-white/10 bg-[#181818] object-cover ${index > 0 ? '-ml-3' : ''}`}
        />
      ))}
      {extra > 0 && (
        <span className="-ml-3 flex h-10 min-w-10 items-center justify-center rounded-lg border border-white/10 bg-[#181818] px-1 text-[11px] font-bold text-white">+{extra}</span>
      )}
    </span>
  );
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
function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await login(values);
      showToast('Welcome back. You are signed in.', 'success');
      const next = searchParams.get('next');
      navigate(next && next.startsWith('/admin') ? next : '/admin', { replace: true });
    } catch (error) {
      showToast(error?.message || 'Login failed. Please check your credentials.', 'error');
    }
  };

  if (isAuthenticated) return <Navigate to="/" replace />;

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

          <p className="text-center text-sm text-[#8d8d8d]">Restricted to store administrators.</p>
        </form>
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
  soldFlash,
  stepBusy,
  onSell,
  onStep,
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
    const justSold = soldFlash === String(variant._id);
    return (
      <span className={`flex items-center ${compact ? 'gap-1.5' : 'gap-1.5 justify-end'}`}>
        <button
          type="button"
          onClick={() => onSell(variant)}
          disabled={stock <= 0 || busy}
          aria-label={justSold ? `Sold 1 ${variant.size} offline` : `Sell 1 ${variant.size} offline`}
          title={stock <= 0 ? 'Out of stock' : 'Sell 1 offline'}
          className="inline-flex h-8 min-w-[64px] items-center justify-center rounded-[8px] bg-[#FFC800] px-2.5 text-[11px] font-bold text-black transition hover:bg-[#ffd233] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Selling…' : justSold ? 'Sold ✓' : 'Sell 1'}
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
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onStep(variant, -1)}
                              disabled={getVariantStock(variant) <= 0 || stepBusy === String(variant._id)}
                              aria-label={`Decrease stock for ${variant.size}`}
                              className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/15 text-sm leading-none text-white transition hover:border-white/35 disabled:opacity-30"
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center font-bold text-white" aria-live="polite">
                              {stepBusy === String(variant._id) ? '…' : getVariantStock(variant)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onStep(variant, 1)}
                              disabled={stepBusy === String(variant._id)}
                              aria-label={`Increase stock for ${variant.size}`}
                              className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/15 text-sm leading-none text-white transition hover:border-white/35 disabled:opacity-30"
                            >
                              +
                            </button>
                          </span>
                        </td>
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
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStep(variant, -1)}
                        disabled={getVariantStock(variant) <= 0 || stepBusy === String(variant._id)}
                        aria-label={`Decrease stock for ${variant.size}`}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/15 text-base leading-none text-white transition hover:border-white/35 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-base font-bold text-white" aria-live="polite">
                        {stepBusy === String(variant._id) ? '…' : getVariantStock(variant)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onStep(variant, 1)}
                        disabled={stepBusy === String(variant._id)}
                        aria-label={`Increase stock for ${variant.size}`}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/15 text-base leading-none text-white transition hover:border-white/35 disabled:opacity-30"
                      >
                        +
                      </button>
                    </span>
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
    <div className="rounded-[18px] border border-white/[0.08] bg-[#0d0d0d] p-5 transition hover:border-white/[0.16]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium tracking-[0.04em] text-[#a0a0a0]">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-[#FFC800]" aria-hidden="true">
            <Icon size={14} />
          </span>
        )}
      </div>
      <p className="mt-2.5 truncate text-[28px] font-black leading-none tracking-[-0.03em] text-white">{value}</p>
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

    const [salesRange, setSalesRange] = useState('today');
    const salesQuery = useQuery({
      queryKey: ['admin-sales-overview', salesRange],
      queryFn: () => adminApi.salesOverview(salesRange),
      staleTime: 30 * 1000,
    });
    const sales = unwrapPayload(salesQuery.data)?.overview ?? {
      online: { revenue: 0, orders: 0, items: 0 },
      offline: { revenue: null, items: 0 },
      total: { revenue: 0, orders: 0, items: 0 },
    };
    const onlineShare = sales.total.items > 0 ? Math.round((sales.online.items / sales.total.items) * 100) : 0;

    if (isLoading) return <Skeleton lines={6} />;
    if (isError) return <ErrorState message="Unable to load the admin dashboard." />;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <AdminKpi icon={IndianRupee} label="Revenue" value={metrics.totalRevenue ? formatMoney(metrics.totalRevenue) : '—'} sub="Gross sales" />
          <AdminKpi icon={Package} label="Orders" value={metrics.totalOrders ?? '—'} sub={`${metrics.pendingOrders || 0} pending`} />
          <AdminKpi icon={Users} label="Customers" value={metrics.totalUsers ?? '—'} sub="Accounts" />
          <AdminKpi icon={ShoppingBag} label="Products" value={metrics.totalProducts ?? '—'} sub="Catalog" />
        </div>

        <AdminCard
          eyebrow="Sales overview"
          title="Online vs offline"
          action={(
            <div className="flex flex-wrap gap-1 rounded-[12px] border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Sales time range">
              {[
                { value: 'today', label: 'Today' },
                { value: '7d', label: '7 days' },
                { value: '30d', label: '30 days' },
                { value: 'all', label: 'All time' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSalesRange(option.value)}
                  aria-pressed={salesRange === option.value}
                  className={`inline-flex h-8 items-center rounded-[8px] px-3.5 text-[12px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#FFC800]/60 ${
                    salesRange === option.value
                      ? 'bg-[#FFC800] text-black'
                      : 'text-[#a8a8a8] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        >
          {salesQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((index) => <div key={index} className="admin-skeleton h-[92px] animate-pulse rounded-[12px]" />)}
            </div>
          ) : salesQuery.isError ? (
            <p className="text-sm text-[#a0a0a0]">Unable to load sales overview right now.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
                  <p className="text-[13px] font-medium text-[#d5d5d5]">Online sales</p>
                  <p className="mt-2 truncate text-[26px] font-black tracking-[-0.03em] text-white">{formatMoney(sales.online.revenue)}</p>
                  <p className="mt-1 truncate text-xs text-[#8d8d8d]">{sales.online.orders} order{sales.online.orders === 1 ? '' : 's'} • {sales.online.items} item{sales.online.items === 1 ? '' : 's'}</p>
                </div>
                <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
                  <p className="text-[13px] font-medium text-[#d5d5d5]">Offline sales</p>
                  <p className="mt-2 truncate text-[26px] font-black tracking-[-0.03em] text-white">{sales.offline.items} item{sales.offline.items === 1 ? '' : 's'}</p>
                  <p className="mt-1 truncate text-xs text-[#8d8d8d]">Revenue not tracked</p>
                </div>
                <div className="rounded-[16px] border border-[#FFC800]/25 bg-[#FFC800]/[0.07] p-5">
                  <p className="text-[13px] font-medium text-[#d5d5d5]">Total sales</p>
                  <p className="mt-2 truncate text-[26px] font-black tracking-[-0.03em] text-[#FFC800]">{formatMoney(sales.total.revenue)}</p>
                  <p className="mt-1 truncate text-xs text-[#8d8d8d]">{sales.total.orders} order{sales.total.orders === 1 ? '' : 's'} • {sales.total.items} item{sales.total.items === 1 ? '' : 's'}</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-[16px] border border-white/[0.08] bg-white/[0.01] px-2">
                <table className="w-full min-w-[420px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-xs text-[#8d8d8d]">
                      <th scope="col" className="px-3 py-3 font-medium"><span className="sr-only">Metric</span></th>
                      <th scope="col" className="px-3 py-3 font-medium">Online</th>
                      <th scope="col" className="px-3 py-3 font-medium">Offline</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.06]">
                      <td className="px-3 py-3 text-[#d5d5d5]">Orders</td>
                      <td className="px-3 py-3 font-semibold text-white">{sales.online.orders}</td>
                      <td className="px-3 py-3 text-[#767676]">—</td>
                      <td className="px-3 py-3 text-right font-semibold text-white">{sales.total.orders}</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="px-3 py-3 text-[#d5d5d5]">Items</td>
                      <td className="px-3 py-3 font-semibold text-white">{sales.online.items}</td>
                      <td className="px-3 py-3 font-semibold text-white">{sales.offline.items}</td>
                      <td className="px-3 py-3 text-right font-semibold text-white">{sales.total.items}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 text-[#d5d5d5]">Revenue</td>
                      <td className="px-3 py-3 font-semibold text-white">{formatMoney(sales.online.revenue)}</td>
                      <td className="px-3 py-3 text-[#767676]">—</td>
                      <td className="px-3 py-3 text-right font-semibold text-white">{formatMoney(sales.total.revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4" aria-label={`Online ${onlineShare}% of items sold`}>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#FFC800] transition-all" style={{ width: `${onlineShare}%` }} />
                  <div className="h-full flex-1 rounded-full bg-white/25" />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-[#8d8d8d]">
                  <span>Online {onlineShare}%</span>
                  <span>Offline {100 - onlineShare}%</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#767676]">
                Offline counts one-click counter sales only; undone sales are netted out. Offline revenue isn&apos;t tracked because sale movements store no price.
              </p>
            </>
          )}
        </AdminCard>

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
    const [typeFilter, setTypeFilter] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [toast, setToast] = useState('');
    const [mediaItems, setMediaItems] = useState([]);
    const [sessionUploadIds, setSessionUploadIds] = useState([]);
    const [urlInput, setUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [savingProduct, setSavingProduct] = useState(false);
    const [formError, setFormError] = useState('');
    const [brandDialogOpen, setBrandDialogOpen] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [brandSaving, setBrandSaving] = useState(false);
    const [brandError, setBrandError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [legacyColors, setLegacyColors] = useState([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [productForm, setProductForm] = useState({
      name: '',
      slug: '',
      brand: '',
      category: '',
      gender: 'UNISEX',
      type: 'SHOES',
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
      if (typeFilter && productTypeOf(product) !== typeFilter) return false;
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
        type: 'SHOES',
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
      setLegacyColors([]);
      setShowAdvanced(false);
      setMediaItems([]);
      setSessionUploadIds([]);
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
        type: PRODUCT_TYPES[product.type] ? product.type : 'SHOES',
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
      // Legacy multi-color products keep working: extra colors are preserved
      // untouched on save (see saveProduct merge). The editor manages one color.
      setLegacyColors(dedupeColors((product.variants || []).map((variant) => variant?.color)).slice(1));
      setShowAdvanced(false);
      setMediaItems(Array.isArray(product.images) ? product.images.filter(Boolean).map((url) => ({ id: makeMediaId(), kind: 'manual', url })) : []);
      setSessionUploadIds([]);
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

    // Simplified model: ONE PRODUCT = ONE COLOR. The single color input
    // drives every variant row; legacy multi-color variants (if any) are
    // preserved untouched on save (see saveProduct merge).
    const singleColorName = () => normalizeColorName(productForm.defaultColor) || 'Black';

    const setSingleColor = (name) => {
      const raw = String(name ?? '');
      const color = normalizeColorName(raw) || 'Black';
      setProductForm((current) => ({
        ...current,
        defaultColor: raw,
        colors: [color],
        variants: current.variants.map((row) => ({ ...row, color, touched: { ...row.touched, color: true } })),
      }));
      setFormError('');
    };

    const toggleSize = (size) => {
      const color = singleColorName();
      const existing = productForm.variants.find((row) => row.size === size);
      if (existing) {
        if (isRowConfigured(existing) && !window.confirm(`Remove ${size}? Entered stock/price data will be lost.`)) {
          return;
        }
        setProductForm((current) => ({ ...current, variants: current.variants.filter((row) => row.size !== size) }));
        setFormError('');
        return;
      }
      const { price, salePrice } = defaultVariantPrices();
      setProductForm((current) => ({
        ...current,
        colors: [color],
        variants: [...current.variants, makeMatrixRow(size, color)].map((row) => (
          row.size === size && !row.price ? { ...row, price, salePrice } : row
        )),
      }));
      setFormError('');
    };

    const stepStock = (key, delta) => {
      const row = productForm.variants.find((entry) => entry.key === key);
      if (!row) return;
      const stock = Math.max(0, Math.floor(Number(row.stock || 0)) + delta);
      updateVariant(key, { stock }, ['stock']);
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
        const singleColor = singleColorName();
        const editedVariants = productForm.variants.map((row) => ({
          sku: skuByKey[row.key] || buildVariantSku({ brand: formBrandName, model: productForm.name, color: row.color, size: row.size }),
          size: String(row.size || '').trim(),
          color: String(row.color || '').trim(),
          price: Number(row.price || 0),
          salePrice: row.salePrice === '' || row.salePrice === null || row.salePrice === undefined ? null : Number(row.salePrice),
          stock: Math.max(0, Math.floor(Number(row.stock || 0))),
          images: Array.isArray(row.images) ? row.images.filter(Boolean) : [],
        }));
        const editedColorKeys = new Set(editedVariants.map((variant) => colorKey(variant.color)));
        // Legacy preservation: server variants in other colors pass through
        // untouched with their stored SKUs, stock, prices and images, so
        // editing a legacy multi-color product can never delete data.
        const preservedVariants = editingProduct && Array.isArray(editingProduct.variants)
          ? editingProduct.variants
            .filter((variant) => ![...editedColorKeys].some((key) => key === colorKey(variant?.color)))
            .map((variant) => ({
              sku: variant.sku,
              size: variant.size,
              color: variant.color,
              price: Number(variant.price ?? 0),
              salePrice: variant.salePrice ?? null,
              stock: Number(variant.stock ?? 0),
              images: Array.isArray(variant.images) ? variant.images.filter(Boolean) : [],
            }))
          : [];
        const cleanGallery = (urls) => (Array.isArray(urls) ? urls : []).filter((url) => typeof url === 'string' && url.trim());
        const editedGalleries = Object.fromEntries(
          Object.entries(productForm.colorImages || {})
            .filter(([color]) => colorKey(color) === colorKey(singleColor))
            .map(([color, urls]) => [String(color || '').trim(), cleanGallery(urls)])
            .filter(([, urls]) => urls.length > 0),
        );
        const serverGalleries = editingProduct ? normalizePersistedColorImages(editingProduct.colorImages) : {};
        const preservedGalleries = Object.fromEntries(
          Object.entries(serverGalleries)
            .filter(([color, urls]) => cleanGallery(urls).length > 0 && ![...editedColorKeys].some((key) => key === colorKey(color)))
            .map(([color, urls]) => [String(color || '').trim(), cleanGallery(urls)]),
        );
        const payload = {
          name: productForm.name.trim(),
          slug,
          brand: productForm.brand || undefined,
          category: productForm.category || undefined,
          gender: productForm.gender,
          type: PRODUCT_TYPES[productForm.type] ? productForm.type : 'SHOES',
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
          colorImages: { ...preservedGalleries, ...editedGalleries },
          variants: [...editedVariants, ...preservedVariants],
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
      await Promise.allSettled([
        ...stale.map((item) => apiClient.delete(`/uploads/images/${encodeURIComponent(item.publicId)}`)),
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
              {legacyColors.length > 0 && (
                <p className="mb-4 rounded-[12px] border border-[#FFC800]/30 bg-[#FFC800]/[0.06] p-3 text-xs leading-relaxed text-[#f3d87d]">
                  Legacy multi-color product — you are editing <strong className="text-white">{singleColorName()}</strong>. Variants
                  in {legacyColors.join(', ')} are preserved untouched on save. Create a separate product for another color.
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Step 2 — Product information</p>
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
                    <FormField label="Product type">
                      <select value={PRODUCT_TYPES[productForm.type] ? productForm.type : 'SHOES'} onChange={(event) => setProductForm({ ...productForm, type: event.target.value, sizeSystem: 'UK' })} className="w-full kicks-field text-white">
                        {Object.entries(PRODUCT_TYPES).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Color" hint="One product = one color. Another color needs a separate product.">
                      <input value={productForm.defaultColor} onChange={(event) => setSingleColor(event.target.value)} placeholder="White" className="w-full kicks-field text-white" />
                    </FormField>
                    <FormField label="Gender"><select value={productForm.gender} onChange={(event) => setProductForm({ ...productForm, gender: event.target.value })} className="w-full kicks-field text-white"><option value="UNISEX">UNISEX</option><option value="MEN">MEN</option><option value="WOMEN">WOMEN</option><option value="KIDS">KIDS</option></select></FormField>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Pricing</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <FormField label="Default price (₹)" hint="New sizes start with this price."><input type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} className="w-full kicks-field text-white" /></FormField>
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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Step 3 — Size & stock</p>
                    {productForm.variants.length > 0 && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#a8a8a8]">
                        {productForm.variants.length} size{productForm.variants.length === 1 ? '' : 's'} • Total stock {totalVariantStock}
                      </span>
                    )}
                  </div>

                  {productForm.type === 'SHOES' ? (
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
                      <div className="flex items-end pb-1">
                        <p className="text-[11px] leading-relaxed text-[#767676]">{singleColorName()} • tap sizes to add/remove</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] leading-relaxed text-[#767676]">
                      {PRODUCT_TYPES[productForm.type]?.label || 'Product'} sizes • {singleColorName()} • tap to add/remove
                    </p>
                  )}

                  <p className="mb-1.5 mt-3 block text-xs font-medium text-[#c9c9c9]">Available sizes</p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available sizes">
                    {(productForm.type === 'SHOES' ? (SIZE_SYSTEMS[productForm.sizeSystem] || SIZE_SYSTEMS.UK) : sizesForType(productForm.type)).map((size) => {
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
                      Tap a size above to add it with {singleColorName()} color. Enter any stock quantity — SKUs generate automatically.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {productForm.variants.map((row) => (
                        <div key={row.key} className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-2">
                          <div className="min-w-[72px] flex-1">
                            <p className="text-sm font-bold text-white">{row.size}</p>
                            <p className="truncate font-mono text-[10px] text-[#767676]" title="Auto-generated SKU">{skuByKey[row.key] || '—'} • AUTO</p>
                          </div>
                          <div className="flex items-center gap-1" role="group" aria-label={`Stock for ${row.size}`}>
                            <button type="button" onClick={() => stepStock(row.key, -1)} disabled={Number(row.stock || 0) <= 0} aria-label={`Decrease stock for ${row.size}`} className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/15 text-base leading-none text-white transition hover:border-white/35 disabled:opacity-30">−</button>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.stock}
                              onChange={(event) => updateVariant(row.key, { stock: event.target.value }, ['stock'])}
                              aria-label={`Stock quantity for ${row.size}`}
                              className="kicks-field kicks-field-sm w-16 text-center"
                            />
                            <button type="button" onClick={() => stepStock(row.key, 1)} aria-label={`Increase stock for ${row.size}`} className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/15 text-base leading-none text-white transition hover:border-white/35">+</button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={row.price}
                            onChange={(event) => updateVariant(row.key, { price: event.target.value }, ['price'])}
                            aria-label={`Price for ${row.size}`}
                            title="Price (₹)"
                            className="kicks-field kicks-field-sm w-[76px]"
                          />
                          <input
                            type="number"
                            min="0"
                            value={row.salePrice}
                            onChange={(event) => updateVariant(row.key, { salePrice: event.target.value === '' ? '' : Number(event.target.value) }, ['salePrice'])}
                            placeholder="Sale"
                            aria-label={`Sale price for ${row.size}`}
                            title="Sale price (₹, optional)"
                            className="kicks-field kicks-field-sm w-[76px]"
                          />
                          <button type="button" onClick={() => removeVariantRow(row.key)} aria-label={`Remove ${row.size} variant`} title="Remove variant" className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-red-500/30 text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/60">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    aria-expanded={showAdvanced}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Step 4 — More product details (optional)</span>
                    <span className="text-[#8d8d8d]">{showAdvanced ? '−' : '+'}</span>
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 grid gap-3">
                      <FormField label="Tags"><input value={productForm.tags} onChange={(event) => setProductForm({ ...productForm, tags: event.target.value })} placeholder="running, comfort (comma separated)" className="w-full kicks-field text-white" /></FormField>
                      <FormField label="Short description"><textarea rows={2} value={productForm.shortDescription} onChange={(event) => setProductForm({ ...productForm, shortDescription: event.target.value })} className="kicks-field" /></FormField>
                      <FormField label="Description"><textarea rows={3} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} className="kicks-field" /></FormField>
                    </div>
                  )}
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

          <aside className="admin-scroll order-first min-w-0 space-y-4 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <AdminCard eyebrow="Step 1 — Product image" title="Product media">
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
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by product type" className="kicks-field text-sm text-white">
                <option value="">All types</option>
                {Object.entries(PRODUCT_TYPES).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
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
                    { key: 'image', label: '', render: (row) => (row.images?.[0] ? <img src={cloudinaryThumb(row.images[0], 96)} alt={row.name || 'Product'} className="h-11 w-11 rounded-xl object-cover" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }} /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#181818] text-xs text-[#666]">—</span>) },
                    { key: 'name', label: 'Name', render: (row) => <div><div className="font-semibold text-white">{row.name}</div><div className="text-[11px] uppercase tracking-[0.2em] text-[#8d8d8d]">{productColor(row) || '—'} • {PRODUCT_TYPES[productTypeOf(row)]?.label}</div></div> },
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
                      <img src={cloudinaryThumb(row.images[0], 128)} alt={row.name || 'Product'} className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }} />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#181818] text-xs text-[#666]">—</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{row.name}</div>
                      <div className="mt-0.5 truncate text-xs text-[#8d8d8d]">{productColor(row) || '—'} • {row.brand?.name || row.brand || ''} • {formatMoney(row.price || 0)}</div>
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
    const [saleBusy, setSaleBusy] = useState('');
    const [adjustTarget, setAdjustTarget] = useState(null);
    const [adjustType, setAdjustType] = useState('Offline Sale');
    const [adjustSign, setAdjustSign] = useState(-1);
    const [adjustQty, setAdjustQty] = useState(1);
    const [adjustNote, setAdjustNote] = useState('');
    const [adjustError, setAdjustError] = useState('');
    const [adjustBusy, setAdjustBusy] = useState(false);
    const [movementsVariantId, setMovementsVariantId] = useState(null);
    const [typeFilter, setTypeFilter] = useState('all');
    const [lastSale, setLastSale] = useState(null);
    const [stepBusy, setStepBusy] = useState('');
    const undoTimer = useRef(null);

    useEffect(() => () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    }, []);

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
      if (typeFilter !== 'all' && productTypeOf(product) !== typeFilter) return false;
      if (statusFilter === 'all') return true;
      const stats = productStats(product);
      if (statusFilter === 'out') return stats.state === 'out';
      if (statusFilter === 'low') return stats.low > 0;
      return stats.state === 'in' && stats.low === 0;
    });

    const presentTypes = [...new Set(allProducts.map((product) => productTypeOf(product)))];

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

    const saleErrorMessage = (error) => {
      const message = String(error?.message || '');
      if (error?.status === 409 || /insufficient|negative|available/i.test(message)) {
        return 'Stock changed — refresh required.';
      }
      return message || 'Could not complete sale.';
    };

    // True one-click offline sale: exactly 1 unit, straight to the atomic
    // server adjustment. No modal, no customer details, no quantity prompt.
    // Multi-unit sales stay available through the Adjust Stock dialog.
    const [soldFlash, setSoldFlash] = useState('');
    const flashTimer = useRef(null);

    const quickSellOneClick = async (product, variant) => {
      const key = String(variant._id);
      if (saleBusy) return;
      const before = getVariantStock(variant);
      if (before <= 0) {
        showToast('Already sold out.', 'error');
        return;
      }
      setSaleBusy(key);
      try {
        await postAdjustment({ variantId: key, delta: -1, reason: 'Offline sale' });
        const after = before - 1;
        setSoldFlash(key);
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setSoldFlash(''), 1500);
        if (undoTimer.current) window.clearTimeout(undoTimer.current);
        setLastSale({
          key: `${key}-${Date.now()}`,
          variantId: key,
          qty: 1,
          label: `${product?.name || 'Product'} • ${variant.color} / ${variant.size}`,
          before,
          after,
        });
        undoTimer.current = window.setTimeout(() => setLastSale(null), 15000);
        showToast(`✓ ${variant.size} sold offline — stock ${before} → ${after}.`, 'success');
      } catch (error) {
        await refreshAfterStockChange();
        showToast(saleErrorMessage(error), 'error');
      } finally {
        setSaleBusy('');
      }
    };

    const undoLastSale = async () => {
      if (!lastSale) return;
      const { variantId, qty, label } = lastSale;
      setLastSale(null);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      try {
        await postAdjustment({ variantId, delta: qty, reason: 'Undo offline sale' });
        showToast(`Restored: ${label}.`, 'success');
      } catch (error) {
        showToast(error?.message || 'Unable to undo sale.', 'error');
      }
    };

    const quickStep = async (variant, delta) => {
      const key = String(variant._id);
      if (stepBusy) return;
      if (delta < 0 && getVariantStock(variant) + delta < 0) {
        showToast('Stock cannot go below zero.', 'error');
        return;
      }
      setStepBusy(key);
      try {
        await postAdjustment({
          variantId: key,
          delta,
          reason: delta < 0 ? 'Offline sale' : 'Restock',
        });
      } catch (error) {
        showToast(error?.message || 'Unable to update stock.', 'error');
      } finally {
        setStepBusy('');
      }
    };

    const saveAdjustment = async () => {
      if (!adjustTarget || adjustBusy) return;
      const qty = Math.floor(Number(adjustQty));
      if (!Number.isInteger(qty) || qty < 1) {
        setAdjustError('Enter a valid quantity of 1 or more.');
        return;
      }
      if (qty > 10000) {
        setAdjustError('Quantity must not exceed 10,000 units per adjustment.');
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
      <img src={cloudinaryThumb(product.images[0], 128)} alt={product?.name || 'Product'} className={`${sizeClass} shrink-0 rounded-xl object-cover`} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }} />
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

        {lastSale && (
          <div className="admin-fade-in flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3" role="status">
            <p className="text-[13px] text-emerald-200">
              ✓ {lastSale.label} sold offline{lastSale.before !== undefined ? ` — stock ${lastSale.before} → ${lastSale.after}` : ''}.
            </p>
            <button type="button" onClick={undoLastSale} className="kicks-btn kicks-btn-secondary kicks-btn-sm">Undo</button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by product type">
          {['all', ...presentTypes].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              aria-pressed={typeFilter === type}
              className="kicks-pill"
            >
              {type === 'all' ? 'All' : PRODUCT_TYPES[type]?.label || type}
            </button>
          ))}
        </div>

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
            soldFlash={soldFlash}
            stepBusy={stepBusy}
            onSell={(variant) => quickSellOneClick(selectedProduct, variant)}
            onStep={(variant, delta) => quickStep(variant, delta)}
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
                  const color = productColor(product);
                  const variants = Array.isArray(product?.variants) ? product.variants : [];
                  return (
                    <div key={product._id} className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-3 transition hover:border-white/20">
                      <div className="flex items-center gap-3">
                        {productImage(product, 'h-16 w-16')}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-white">{product.name}</p>
                          {color ? <p className="mt-0.5 truncate text-xs text-[#a8a8a8]">{color}</p> : null}
                          <p className="mt-0.5 text-sm font-bold text-white">{formatMoney(product.price || 0)}</p>
                        </div>
                        {stockPill(stats.state, stats.state === 'out' ? 'Out' : `${stats.total} pcs`)}
                      </div>
                      {variants.length > 0 && (
                        <div className="mt-2.5 space-y-1.5" aria-label={`Sizes for ${product.name}`}>
                          {variants.map((variant) => {
                            const stock = getVariantStock(variant);
                            const state = variantState(variant);
                            const busy = saleBusy === String(variant._id);
                            const justSold = soldFlash === String(variant._id);
                            return (
                              <div
                                key={variant._id || `${variant.size}-${variant.color}`}
                                className={`flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 ${
                                  state === 'out'
                                    ? 'border-red-500/20 bg-red-500/[0.05]'
                                    : state === 'low'
                                      ? 'border-[#FFC800]/20 bg-[#FFC800]/[0.05]'
                                      : 'border-white/[0.08] bg-black/20'
                                }`}
                              >
                                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{variant.size}</span>
                                <span className={`w-12 shrink-0 text-right text-[13px] font-bold tabular-nums ${state === 'out' ? 'text-red-200' : state === 'low' ? 'text-[#f3d87d]' : 'text-white'}`} aria-live="polite">
                                  {busy ? '…' : stock}
                                </span>
                                {stock <= 0 ? (
                                  <span className="inline-flex h-9 min-w-[72px] shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold uppercase tracking-[0.08em] text-red-200/70">
                                    Sold out
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => quickSellOneClick(product, variant)}
                                    disabled={busy}
                                    title={`Sell 1 × ${variant.size} offline`}
                                    aria-label={`Sell 1 ${variant.size} of ${product.name} offline`}
                                    className="inline-flex h-9 min-w-[72px] shrink-0 items-center justify-center rounded-[10px] bg-[#FFC800] px-3 text-[12px] font-bold text-black transition hover:bg-[#ffd233] disabled:cursor-wait disabled:opacity-60"
                                  >
                                    {busy ? 'Selling…' : justSold ? 'Sold ✓' : 'Sell'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setSelectedProductId(product._id); setMovementsVariantId(null); }}
                        aria-label={`Inventory details for ${product.name}`}
                        className="kicks-btn kicks-btn-secondary kicks-btn-sm mt-2.5 w-full"
                      >
                        Details
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
                    <input
                      value={adjustQty}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, '').slice(0, 5);
                        setAdjustQty(digits === '' ? '' : Number(digits));
                        setAdjustError('');
                      }}
                      inputMode="numeric"
                      aria-label="Adjustment quantity"
                      className="h-9 w-16 rounded-[10px] border border-white/15 bg-black/30 text-center text-sm font-bold text-white outline-none transition focus:border-white/35"
                    />
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
    const expandedShipmentQuery = useQuery({
      queryKey: ['admin-order-shipment', expandedOrderId],
      queryFn: () => adminApi.shipmentById(expandedOrderId).catch(() => null),
      enabled: Boolean(expandedOrderId),
    });
    const expandedShipment = unwrapPayload(expandedShipmentQuery.data)?.shipment ?? null;

    // Mirrors the backend order state machine: the dropdown only ever offers
    // the current status plus its legal successors. Past PACKED there are no
    // manual moves — SHIPPED / OUT_FOR_DELIVERY / DELIVERED arrive exclusively
    // through shipment/carrier events, never the generic dropdown.
    const ORDER_NEXT_ACTIONS = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['PACKED'],
      PACKED: [],
      SHIPPED: [],
      OUT_FOR_DELIVERY: [],
      DELIVERED: [],
      CANCELLED: [],
      REFUNDED: [],
    };
    const validNextStatuses = (status) => ORDER_NEXT_ACTIONS[status] || [];

    // Translates a backend race rejection into the useful next step.
    const statusErrorMessage = (error) => {
      const message = String(error?.message || '');
      if (/PROCESSING to SHIPPED/i.test(message)) {
        return 'Please mark the order as PACKED first, then create the shipment.';
      }
      if (/PACKED to (SHIPPED|OUT_FOR_DELIVERY|DELIVERED)/i.test(message)) {
        return 'Please create the shipment before marking this order as shipped — statuses past PACKED come from carrier events.';
      }
      return message || 'Unable to update order status.';
    };

    const orderActions = (row) => {
      const expanded = String(expandedOrderId) === String(row._id);
      const nextStatuses = validNextStatuses(row.status);
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={row.status} onChange={(event) => updateStatus(row._id, event.target.value)} aria-label={`Update status for ${row.orderNumber || 'order'}`} title={nextStatuses.length > 0 ? 'Update order status' : 'Order status is advanced by the shipping workflow'} className="rounded-full border border-white/10 bg-[#181818] px-2.5 py-1.5 text-[11px] text-white">
            {[row.status, ...nextStatuses.filter((statusItem) => statusItem !== row.status)].map((statusItem) => <option key={statusItem} value={statusItem}>{statusItem}</option>)}
          </select>
          {row.status === 'PROCESSING' && (
            <button type="button" onClick={() => updateStatus(row._id, 'PACKED')} aria-label={`Mark ${row.orderNumber || 'order'} as packed`} title="Mark packed" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
              Mark Packed
            </button>
          )}
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
        setActionError(statusErrorMessage(error));
      }
    };
    const createShipment = async (id) => {
      setActionError('');
      try {
        const result = await apiClient.post(`/admin/orders/${id}/ship`);
        await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-order-shipment'] });
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
              <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Shipping</p>
                {expandedShipmentQuery.isLoading ? (
                  <div className="mt-2 h-10 animate-pulse rounded-[10px] bg-white/5" />
                ) : expandedShipment ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={expandedShipment.status} />
                      {expandedShipment.isTest && (
                        <span className="rounded-full border border-[#FFC800]/40 bg-[#FFC800]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFC800]">TEST</span>
                      )}
                    </div>
                    <p className="truncate font-mono text-xs text-white">{expandedShipment.awb || expandedShipment.shipmentId || '—'}</p>
                    <Link to="/admin/shipping" className="inline-block text-xs text-[#a8a8a8] underline decoration-white/20 underline-offset-4 hover:text-white">
                      Manage in Shipping →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-[#8d8d8d]">
                      {expandedOrder.status === 'PACKED'
                        ? 'Ready to ship — create the shipment to continue.'
                        : 'No shipment yet.'}
                    </p>
                    {expandedOrder.status === 'PACKED' && (
                      <button
                        type="button"
                        onClick={() => createShipment(expandedOrder._id)}
                        className="kicks-btn kicks-btn-secondary kicks-btn-sm"
                      >
                        <Truck size={13} /> Create Shipment
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {Array.isArray(expandedOrder.items) && expandedOrder.items.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {expandedOrder.items.map((item, index) => (
                  <div key={item._id || item.variantId || index} className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3">
                    {item.image && <img src={cloudinaryThumb(item.image, 128)} alt={item.name || item.productName || 'Product'} className="h-11 w-11 shrink-0 rounded-lg object-cover" loading="lazy" />}
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
                  { key: 'items', label: 'Items', render: (row) => <span className="inline-flex items-center gap-2"><OrderProductThumbs items={row.items} /><span>{row.items?.length || 0}</span></span> },
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
                  {Array.isArray(row.items) && row.items.length > 0 && (
                    <div className="mt-2"><OrderProductThumbs items={row.items} /></div>
                  )}
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
    const [mockBusy, setMockBusy] = useState('');
    const [mockError, setMockError] = useState('');

    // Mirrors the backend mock transition map: only currently-valid
    // simulation buttons are shown for a mock shipment.
    const MOCK_EVENT_BUTTONS = {
      pickup: { target: 'PICKED_UP', label: 'Pickup' },
      shipped: { target: 'IN_TRANSIT', label: 'Shipped' },
      out_for_delivery: { target: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
      delivered: { target: 'DELIVERED', label: 'Delivered' },
      ndr: { target: 'NDR', label: 'NDR' },
      rto: { target: 'RTO_INITIATED', label: 'RTO' },
      rto_transit: { target: 'RTO_IN_TRANSIT', label: 'RTO Transit' },
      returned: { target: 'RETURNED', label: 'Returned' },
    };
    const MOCK_NEXT_STATUSES = {
      READY_FOR_PICKUP: ['PICKUP_SCHEDULED', 'PICKED_UP'],
      PICKUP_SCHEDULED: ['PICKED_UP'],
      PICKED_UP: ['IN_TRANSIT'],
      IN_TRANSIT: ['OUT_FOR_DELIVERY', 'NDR'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'NDR'],
      NDR: ['OUT_FOR_DELIVERY', 'RTO_INITIATED'],
      RTO_INITIATED: ['RTO_IN_TRANSIT'],
      RTO_IN_TRANSIT: ['RETURNED'],
    };
    const mockValidEvents = (status) => {
      const allowed = MOCK_NEXT_STATUSES[status] || [];
      return Object.entries(MOCK_EVENT_BUTTONS).filter(([, button]) => allowed.includes(button.target));
    };

    const runMockAction = async (key, action) => {
      if (mockBusy) return;
      setMockBusy(key);
      setMockError('');
      try {
        await action();
        await detailQuery.refetch();
        await refetch();
      } catch (err) {
        setMockError(err?.message || 'Mock action failed.');
      } finally {
        setMockBusy('');
      }
    };

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

    const shipmentStatuses = ['PENDING', 'PROCESSING', 'CREATED', 'AWB_ASSIGNED', 'READY_FOR_PICKUP', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NDR', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RETURNED', 'CANCELLED', 'FAILED', 'SHIPPED'];

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
                <option value="mock">Mock</option>
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

                  {/* Mock shipment controls (MOCK test shipments only) */}
                  {detail.provider === 'MOCK' && detail.isTest && (
                    <div className="rounded-[20px] border border-[#FFC800]/25 bg-[#FFC800]/[0.04] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-[#8c8c8c]">Mock shipment controls</div>
                        <span className="rounded-full border border-[#FFC800]/40 bg-[#FFC800]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFC800]">TEST SHIPMENT</span>
                      </div>
                      {detail.pickup?.requestId && (
                        <p className="mt-3 text-sm text-[#d2d2d2]">
                          Pickup: <span className="font-semibold text-white">{detail.pickup.status || 'SCHEDULED'}</span>
                          {detail.pickup.date ? ` • ${fmtDate(detail.pickup.date)}` : ''}
                          {detail.pickup.slot ? ` • ${detail.pickup.slot}` : ''}
                        </p>
                      )}
                      {detail.estimatedDeliveryDate && (
                        <p className="mt-1 text-xs text-[#8d8d8d]">Estimated delivery: {fmtDate(detail.estimatedDeliveryDate)}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={adminApi.shipmentLabelUrl(detail._id)} target="_blank" rel="noopener noreferrer" className="kicks-btn kicks-btn-secondary kicks-btn-sm">
                          View Label
                        </a>
                        {detail.status === 'READY_FOR_PICKUP' && !detail.pickup?.requestId && (
                          <button
                            type="button"
                            onClick={() => runMockAction('pickup-schedule', () => adminApi.scheduleMockPickup(detail._id))}
                            disabled={Boolean(mockBusy)}
                            className="kicks-btn kicks-btn-secondary kicks-btn-sm disabled:cursor-wait disabled:opacity-60"
                          >
                            {mockBusy === 'pickup-schedule' ? 'Scheduling…' : 'Schedule Pickup'}
                          </button>
                        )}
                      </div>
                      <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-[#8d8d8d]">Simulate carrier event</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {mockValidEvents(detail.status)
                          .filter(([event]) => ['pickup', 'shipped', 'out_for_delivery', 'delivered'].includes(event))
                          .map(([event, button]) => (
                            <button
                              key={event}
                              type="button"
                              onClick={() => runMockAction(`mock-${event}`, () => adminApi.simulateMockEvent(detail._id, event))}
                              disabled={Boolean(mockBusy)}
                              className="kicks-btn kicks-btn-secondary kicks-btn-sm disabled:cursor-wait disabled:opacity-60"
                            >
                              {mockBusy === `mock-${event}` ? 'Sending…' : `Simulate ${button.label}`}
                            </button>
                          ))}
                      </div>
                      {mockValidEvents(detail.status).some(([event]) => ['ndr', 'rto', 'rto_transit', 'returned'].includes(event)) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {mockValidEvents(detail.status)
                            .filter(([event]) => ['ndr', 'rto', 'rto_transit', 'returned'].includes(event))
                            .map(([event, button]) => (
                              <button
                                key={event}
                                type="button"
                                onClick={() => runMockAction(`mock-${event}`, () => adminApi.simulateMockEvent(detail._id, event))}
                                disabled={Boolean(mockBusy)}
                                className="kicks-btn kicks-btn-danger kicks-btn-sm uppercase disabled:cursor-wait disabled:opacity-60"
                              >
                                {mockBusy === `mock-${event}` ? 'Sending…' : `Simulate ${button.label}`}
                              </button>
                            ))}
                        </div>
                      )}
                      {mockError && <p role="alert" className="mt-3 rounded-[14px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{mockError}</p>}
                    </div>
                  )}

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
                        {detail.order.items.map((item) => (
                          <div key={item._id || item.variantId || item.productId} className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-[#181818] p-3">
                            {item.image && <img src={item.image} alt={item.productName || item.name || 'Product'} className="h-12 w-12 rounded-lg object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = NEUTRAL_PRODUCT_IMAGE; }} />}
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-semibold text-white">{item.productName || item.name || 'Product'}</div>
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
                          <div key={`${event.status || 'event'}-${event.occurredAt || ''}-${event.providerReference || ''}-${idx}`} className="relative flex gap-4 pb-4">
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
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                  <span className="text-sm text-[#a8a8a8]">Can&apos;t remember your current password?</span>
                  <Link
                    to={adminUser?.email ? `/forgot-password?email=${encodeURIComponent(adminUser.email)}` : '/forgot-password'}
                    className="text-sm font-bold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                  >
                    Forgot your current password?
                  </Link>
                </div>
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
    <div className="admin-shell mx-auto w-full max-w-none px-2 py-4 sm:px-3 sm:py-5 lg:px-4">
      <PageMeta title="Admin | AJ SPORTS" description="AJ SPORTS administrator dashboard" />

      <div className="grid items-start gap-4 xl:grid-cols-[216px_minmax(0,1fr)]">
        <aside className="admin-scroll sticky top-4 hidden h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-[14px] border border-white/[0.08] bg-[#0b0b0b] p-2.5 xl:flex">
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
              {storefrontUrl('/') && (
                <a
                  href={storefrontUrl('/')}
                  aria-label="Open storefront"
                  title="Storefront"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white transition hover:border-white/30 sm:h-8 sm:w-auto sm:px-3 sm:text-[11px] sm:font-semibold"
                >
                  <ExternalLink size={12} /> <span className="hidden sm:inline">Storefront</span>
                </a>
              )}
              <div className="relative hidden shrink-0 sm:block">
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

function AdminGate() {
  const { isAuthenticated, isAdmin, loading, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  if (loading) return <div className="p-8 text-center text-white">Checking session...</div>;
  if (isAuthenticated && isAdmin) return <AdminPage />;
  if (isAuthenticated) {
    return (
      <div className="mx-auto max-w-[520px] px-4 py-16 text-center">
        <PageMeta title="Restricted area | AJ SPORTS Admin" description="Store administrators only" />
        <h1 className="text-2xl font-black uppercase tracking-[-0.04em] text-white">Restricted area</h1>
        <p className="mt-3 text-sm text-[#a8a8a8]">This console is for store administrators. Your account does not have admin access.</p>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => { setSigningOut(true); try { await logout(); } finally { setSigningOut(false); } }}
          className="kicks-btn kicks-btn-secondary mt-6"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    );
  }
  return <LoginPage />;
}

function AdminShell() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<AdminGate />} />
        <Route path="/login" element={<LoginPage />} />
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
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AdminShell />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

