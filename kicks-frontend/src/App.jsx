import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { ArrowRight, Lock, ShoppingBag, User2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from './context/useAuth';
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
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<AccountPage />} />
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
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
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
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Wishlist | KICKS" description="Your saved items" />
      <div className="rounded-[28px] border border-dashed border-white/15 bg-[#111111] p-12 text-center">
        <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Wishlist</h1>
        <p className="mt-4 text-[#c3c3c3]">Your saved sneakers will appear here after you add them.</p>
      </div>
    </div>
  );
}

function CartPage() {
  const sampleItems = [
    { name: 'Nike Air Force 1', price: 8999, quantity: 1 },
    { name: 'Puma RS-X', price: 8499, quantity: 1 },
  ];
  const subtotal = sampleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Cart | KICKS" description="Shopping cart" />
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Your cart</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Cart</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {sampleItems.map((item) => (
            <div key={item.name} className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[#111111] p-4">
              <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80" alt={item.name} className="h-24 w-24 rounded-[18px] object-cover" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white">{item.name}</h3>
                <p className="mt-1 text-sm text-[#9d9d9d]">Qty: {item.quantity}</p>
              </div>
              <div className="text-lg font-semibold text-white">₹{item.price.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>

        <aside className="rounded-[28px] border border-white/10 bg-[#111111] p-6">
          <h2 className="text-2xl font-bold text-white">Summary</h2>
          <div className="mt-6 space-y-4 text-[#d2d2d2]">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>Free</span></div>
            <div className="flex justify-between"><span>Discount</span><span>₹0</span></div>
            <div className="flex justify-between border-t border-white/10 pt-4 text-lg font-semibold text-white"><span>Total</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
          </div>
          <Link to="/checkout" className="mt-6 block rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-black">Proceed to checkout</Link>
        </aside>
      </div>
    </div>
  );
}

function CheckoutPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Checkout | KICKS" description="Checkout" />
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Checkout</p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Secure checkout</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
          <h2 className="text-2xl font-bold text-white">Shipping information</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" placeholder="First name" />
            <input className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" placeholder="Last name" />
            <input className="md:col-span-2 rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" placeholder="Phone number" />
            <input className="md:col-span-2 rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" placeholder="Address" />
            <input className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" placeholder="City" />
            <input className="rounded-full border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white" placeholder="Postal code" />
          </div>
        </div>

        <aside className="rounded-[28px] border border-white/10 bg-[#111111] p-6">
          <h2 className="text-2xl font-bold text-white">Order summary</h2>
          <div className="mt-6 space-y-4 text-[#d2d2d2]">
            <div className="flex justify-between"><span>Nike Air Force 1</span><span>₹8,999</span></div>
            <div className="flex justify-between"><span>Puma RS-X</span><span>₹8,499</span></div>
            <div className="flex justify-between border-t border-white/10 pt-4 text-lg font-semibold text-white"><span>Total</span><span>₹17,498</span></div>
          </div>
          <Link to="/order-success/123" className="mt-6 block rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-black">Place order</Link>
        </aside>
      </div>
    </div>
  );
}

function OrderSuccessPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-12 lg:px-8">
      <PageMeta title="Order placed | KICKS" description="Your order was successful" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-black text-black">✓</div>
        <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">Order placed</h1>
        <p className="mt-4 text-[#c3c3c3]">Your purchase is confirmed and is being prepared for shipping.</p>
        <Link to="/account/orders" className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">View order</Link>
      </div>
    </div>
  );
}

function OrdersPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="My orders | KICKS" description="Order history" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8">
        <h1 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">My orders</h1>
        <div className="mt-6 space-y-4 text-[#d2d2d2]">
          {[{ id: 'KICKS-1001', state: 'Shipped' }, { id: 'KICKS-1002', state: 'Processing' }].map((order) => (
            <div key={order.id} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-[#181818] p-5">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-[#a0a0a0]">Order</div>
                <div className="mt-2 text-xl font-semibold text-white">{order.id}</div>
              </div>
              <div className="text-sm text-[#d9d9d9]">{order.state}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderDetailPage() {
  return <div className="p-12 text-center text-white">Order detail page placeholder.</div>;
}

function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
      <PageMeta title="Account | KICKS" description="Customer account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Account</p>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">{user?.firstName || 'Welcome'} {user?.lastName || ''}</h1>
          </div>
          <button onClick={logout} type="button" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">Logout</button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[20px] border border-white/10 bg-[#181818] p-5">
            <div className="flex items-center gap-3"><User2 size={18} className="text-white" /><span className="text-[#d7d7d7]">{user?.email || 'customer@example.com'}</span></div>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#181818] p-5">
            <div className="flex items-center gap-3"><ShoppingBag size={18} className="text-white" /><span className="text-[#d7d7d7]">Orders</span></div>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#181818] p-5">
            <div className="flex items-center gap-3"><Lock size={18} className="text-white" /><span className="text-[#d7d7d7]">Security</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await login(values);
      navigate('/account', { replace: true });
    } catch (error) {
      console.error(error);
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
            <input {...register('email')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none" placeholder="you@example.com" />
            {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#d5d5d5]">Password</label>
            <input type="password" {...register('password')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none" placeholder="Your password" />
            {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password.message}</p>}
          </div>

          <button disabled={isSubmitting} type="submit" className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black">
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await registerUser(values);
      navigate('/account', { replace: true });
    } catch (error) {
      console.error(error);
    }
  };

  if (isAuthenticated) return <Navigate to="/account" replace />;

  return (
    <div className="mx-auto max-w-[700px] px-4 py-12 lg:px-8">
      <PageMeta title="Register | KICKS" description="Create a KICKS account" />
      <div className="rounded-[28px] border border-white/10 bg-[#111111] p-8 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Start here</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-white">Create account</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]">First name</label>
              <input {...register('firstName')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white" />
              {errors.firstName && <p className="mt-2 text-sm text-red-300">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm text-[#d5d5d5]">Last name</label>
              <input {...register('lastName')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white" />
              {errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#d5d5d5]">Email</label>
            <input {...register('email')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white" />
            {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#d5d5d5]">Password</label>
            <input type="password" {...register('password')} className="w-full rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white" />
            {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password.message}</p>}
          </div>

          <button type="submit" className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black" disabled={isSubmitting}>
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

function AdminPage() {
  const cards = [
    { title: 'Orders', value: '183', detail: 'This week' },
    { title: 'Revenue', value: '₹2.4L', detail: 'Gross sales' },
    { title: 'Customers', value: '4,220', detail: 'Active' },
    { title: 'Low stock', value: '14', detail: 'Items' },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
      <PageMeta title="Admin | KICKS" description="KICKS administration dashboard" />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d8d8d]">Dashboard</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-white">Admin panel</h1>
        </div>
        <div className="rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm text-white">Protected route</div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-[24px] border border-white/10 bg-[#111111] p-6">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#8e8e8e]">{card.title}</div>
            <div className="mt-5 text-4xl font-black tracking-[-0.06em] text-white">{card.value}</div>
            <div className="mt-3 text-sm text-[#c0c0c0]">{card.detail}</div>
          </div>
        ))}
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
