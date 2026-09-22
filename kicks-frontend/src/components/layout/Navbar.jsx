import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Heart, LogOut, Menu, Search, ShieldCheck, ShoppingBag, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications.api';
import { cartApi } from '../../api/cart.api';
import { useAuth } from '../../context/useAuth';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'Collections', to: '/categories' },
  { label: 'Stories', to: '/blog' },
  { label: 'About', to: '/about' },
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
    enabled: isAuthenticated && !isAdmin,
  });

  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.getCart(),
    enabled: isAuthenticated && !isAdmin,
  });
  const cartItems = cartData?.data?.cart?.items || cartData?.cart?.items || [];
  const cartCount = cartItems.reduce((total, item) => total + Number(item?.quantity || 0), 0);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-md">
      <nav className="kicks-page py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5 lg:justify-self-start">
            <span className="shrink-0 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen((current) => !current)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileOpen}
                className="kicks-icon-btn"
              >
                <Menu size={16} />
              </button>
            </span>
            <Link to="/" className="truncate text-sm font-black uppercase tracking-[0.3em] text-white sm:text-base" aria-label="AJ SPORTS home">
              AJ SPORTS
            </Link>
          </div>

          {!isAdmin && (
            <div className="hidden items-center gap-7 lg:flex lg:justify-self-center">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `relative py-1 text-[11px] uppercase tracking-[0.22em] transition ${isActive ? 'text-white' : 'text-[#8f8f8f] hover:text-white'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span>{item.label}</span>
                      {isActive && <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-white" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}

          {isAdmin ? (
            <div className="flex shrink-0 items-center gap-2 lg:justify-self-end">
              <Link
                to="/admin"
                aria-label="Open Admin Control Center"
                title="Admin Control Center"
                className="kicks-btn kicks-btn-dark kicks-btn-sm"
              >
                <ShieldCheck size={13} /> <span className="hidden sm:inline">Control Center</span><span className="sm:hidden">Admin</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="kicks-btn kicks-btn-secondary kicks-btn-sm"
              >
                <LogOut size={13} /> <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:justify-self-end">
            <span className="hidden shrink-0 sm:inline-flex">
              <Link to="/shop" aria-label="Search products" title="Search products" className="kicks-icon-btn">
                <Search size={15} />
              </Link>
            </span>

            {isAuthenticated && (
              <Link
                to="/account/notifications"
                aria-label={`${unreadNotifications} unread notifications`}
                className="kicks-icon-btn relative"
              >
                <Bell size={15} />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold text-black">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </Link>
            )}

            <Link to="/wishlist" aria-label="Wishlist" className="kicks-icon-btn">
              <Heart size={15} />
            </Link>
            <Link to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} className="kicks-icon-btn relative">
              <ShoppingBag size={15} />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold text-black">{cartCount > 9 ? '9+' : cartCount}</span>}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-1.5">
                <Link
                  to="/account"
                  aria-label="Open account"
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-white/15 bg-[#181818] px-3 text-xs font-medium text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <User size={13} /> <span className="hidden sm:inline max-w-20 truncate">{user?.firstName || 'Account'}</span>
                </Link>
                <button type="button" onClick={logout} aria-label="Log out" className="hidden h-9 items-center rounded-[10px] border border-white/15 px-3 text-[11px] uppercase tracking-[0.14em] text-white sm:inline-flex">
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                aria-label="Log in to your account"
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-white/15 bg-[#181818] px-3 text-xs font-medium text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <User size={13} /> Login
              </Link>
            )}
          </div>
          )}
        </div>

        {mobileOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-[#111111] p-2.5 lg:hidden">
            <div className="flex flex-col gap-1.5">
              {isAdmin ? (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="kicks-btn kicks-btn-primary kicks-btn-sm w-full"
                  >
                    Admin Panel
                  </Link>
                  <Link
                    to="/"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-[10px] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#d4d4d4]"
                  >
                    Storefront
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="rounded-[10px] px-4 py-2 text-left text-xs uppercase tracking-[0.18em] text-red-200"
                  >
                    Log out
                  </button>
                </>
              ) : (
                navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `rounded-[10px] px-4 py-2.5 text-xs uppercase tracking-[0.18em] ${isActive ? 'bg-white text-black' : 'text-[#d4d4d4]'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
