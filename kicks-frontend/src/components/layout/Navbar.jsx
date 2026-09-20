import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Heart, Menu, Search, ShieldCheck, ShoppingBag, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications.api';
import { cartApi } from '../../api/cart.api';
import { useAuth } from '../../context/useAuth';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
  { label: 'Policy', to: '/privacy-policy' },
  { label: 'Categories', to: '/categories' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const payload = await notificationsApi.list();
      const notifications = Array.isArray(payload?.data?.notifications)
        ? payload.data.notifications
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : [];
      return notifications.filter((item) => !item?.read && !item?.isRead).length;
    },
    enabled: isAuthenticated,
  });

  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.getCart(),
    enabled: isAuthenticated,
  });
  const cartItems = cartData?.data?.cart?.items || cartData?.cart?.items || [];
  const cartCount = cartItems.reduce((total, item) => total + Number(item?.quantity || 0), 0);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/90 backdrop-blur-xl">
      <nav className="mx-auto max-w-[1400px] px-4 py-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white lg:hidden"
            >
              <Menu size={18} />
            </button>
            <Link to="/" className="text-xl font-black uppercase tracking-[0.35em] text-white">
              KICKS
            </Link>
          </div>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm uppercase tracking-[0.2em] transition ${isActive ? 'text-white' : 'text-[#a5a5a5] hover:text-white'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Search" className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white sm:inline-flex">
              <Search size={16} />
            </button>

            {isAuthenticated && (
              <Link
                to="/account/notifications"
                aria-label={`${unreadNotifications} unread notifications`}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white"
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold text-black">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </Link>
            )}

            <Link to="/wishlist" aria-label="Wishlist" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white">
              <Heart size={16} />
            </Link>
            <Link to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white">
              <ShoppingBag size={16} />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold text-black">{cartCount > 9 ? '9+' : cartCount}</span>}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link to="/admin" className="hidden items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white md:inline-flex">
                    <ShieldCheck size={14} /> Admin
                  </Link>
                )}
                <Link
                  to="/account"
                  aria-label="Open account"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#181818] text-sm font-medium text-white transition hover:border-white/40 hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-white/50 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2"
                >
                  <User size={14} /> <span className="hidden sm:inline">{user?.firstName || 'Account'}</span>
                </Link>
                <button type="button" onClick={logout} className="hidden rounded-full border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white sm:inline-flex">
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                aria-label="Log in to your account"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#181818] px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <User size={14} /> Login
              </Link>
            )}
          </div>
        </div>

        {mobileOpen && (
          <div className="mt-4 rounded-[22px] border border-white/10 bg-[#111111] p-3 lg:hidden">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm uppercase tracking-[0.18em] ${isActive ? 'bg-white text-black' : 'text-[#d4d4d4]'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
