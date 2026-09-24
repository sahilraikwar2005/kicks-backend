import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, Heart, LogOut, Menu, Moon, Search, ShieldCheck, ShoppingBag, Sun, User } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications.api';
import { cartApi } from '../../api/cart.api';
import { useAuth } from '../../context/useAuth';
import useTheme from '../../hooks/useTheme';
import { ESSENTIALS_TYPES, FOOTWEAR_TYPES, SPORTSWEAR_TYPES, typeLabel } from '../../data/productTypes';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop', menu: true },
  { label: 'Shoes', to: '/shop?type=SHOES' },
  { label: 'Sportswear', to: `/shop?type=${SPORTSWEAR_TYPES.join(',')}` },
  { label: 'Footwear', to: `/shop?type=${FOOTWEAR_TYPES.join(',')}` },
  { label: 'Collections', to: '/categories' },
  { label: 'Stories', to: '/blog' },
  { label: 'About', to: '/about' },
];

const shopMenuGroups = [
  { heading: null, links: [{ label: 'Shop All', to: '/shop' }] },
  { heading: 'Footwear', links: FOOTWEAR_TYPES.map((type) => ({ label: typeLabel(type), to: `/shop?type=${type}` })) },
  { heading: 'Sportswear', links: SPORTSWEAR_TYPES.map((type) => ({ label: typeLabel(type), to: `/shop?type=${type}` })) },
  { heading: 'Essentials', links: ESSENTIALS_TYPES.map((type) => ({ label: typeLabel(type), to: `/shop?type=${type}` })) },
];

const mobileMenuSections = [
  { heading: null, links: [{ label: 'Shop All', to: '/shop' }] },
  { heading: 'Footwear', links: FOOTWEAR_TYPES.map((type) => ({ label: typeLabel(type), to: `/shop?type=${type}` })) },
  { heading: 'Sportswear', links: SPORTSWEAR_TYPES.map((type) => ({ label: typeLabel(type), to: `/shop?type=${type}` })) },
  { heading: 'Essentials', links: ESSENTIALS_TYPES.map((type) => ({ label: typeLabel(type), to: `/shop?type=${type}` })) },
  { heading: null, links: [{ label: 'Collections', to: '/categories' }, { label: 'Stories', to: '/blog' }, { label: 'About', to: '/about' }] },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  // Scroll-aware admin top navbar (Header 1 only): visible at the top, slides
  // away on scroll down, returns on any upward scroll. Customer navbar keeps
  // its existing sticky behavior. Header 2 (admin content header) is untouched.
  const [navHidden, setNavHidden] = useState(false);
  const [barH, setBarH] = useState(57);
  const barRef = useRef(null);

  // Reset to visible on route change (render-time adjustment, no effect).
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    if (navHidden) setNavHidden(false);
  }

  useEffect(() => {
    if (!isAdmin) return undefined;
    const measure = () => {
      if (barRef.current) setBarH(barRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isAdmin, pathname, mobileOpen]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let lastY = window.scrollY || 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY || 0;
        const dy = y - lastY;
        lastY = y;
        if (y <= 8) {
          setNavHidden(false);
          return;
        }
        if (Math.abs(dy) < 3) return;
        setNavHidden(dy > 0);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isAdmin]);

  // Keep the bar visible while its mobile menu is open so the menu stays usable.
  const barHidden = isAdmin && navHidden && !mobileOpen;

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
    <>
    <header
      ref={barRef}
      className={
        isAdmin
          ? `fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-md transition-transform duration-200 ease-out will-change-transform ${barHidden ? '-translate-y-full' : 'translate-y-0'}`
          : 'sticky top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-md'
      }
    >
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
            <div className="hidden items-center gap-6 lg:flex lg:justify-self-center">
              {navItems.map((item) => (
                item.menu ? (
                  <div key={item.to} className="group relative">
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `relative flex items-center gap-1 py-1 text-[11px] uppercase tracking-[0.22em] transition ${isActive ? 'text-white' : 'text-[#8f8f8f] hover:text-white'}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span>{item.label}</span>
                          <ChevronDown size={12} aria-hidden="true" />
                          {isActive && <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-white" />}
                        </>
                      )}
                    </NavLink>
                    <div className="invisible absolute left-1/2 top-full z-50 w-[440px] -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-2xl shadow-black/60">
                        {shopMenuGroups.map((group) => (
                          <div key={group.heading || 'all'}>
                            {group.heading && (
                              <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8d8d8d]">{group.heading}</p>
                            )}
                            {group.links.map((link) => (
                              <Link
                                key={link.to}
                                to={link.to}
                                className="block rounded-[8px] px-1 py-1.5 text-xs uppercase tracking-[0.18em] text-[#d4d4d4] transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
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
                )
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
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="kicks-icon-btn"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
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
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-[10px] border border-white/10 px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-[#d4d4d4] transition active:bg-white/10"
            >
              <span className="inline-flex items-center gap-2">
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
              <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${theme === 'dark' ? 'bg-white/15' : 'bg-black/20'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${theme === 'dark' ? 'left-0.5' : 'left-[18px]'}`} />
              </span>
            </button>
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
                    className="rounded-[10px] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#d4d4d4] transition active:bg-white/10 active:text-white"
                  >
                    Storefront
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="rounded-[10px] px-4 py-2 text-left text-xs uppercase tracking-[0.18em] text-red-200 transition active:bg-red-500/20"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  {mobileMenuSections.map((section, sectionIndex) => (
                    <div key={section.heading || `top-${sectionIndex}`}>
                      {section.heading && (
                        <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8d8d8d]">
                          {section.heading}
                        </p>
                      )}
                      {section.links.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `block rounded-[10px] px-4 py-2.5 text-xs uppercase tracking-[0.18em] transition ${isActive ? 'bg-white text-black active:bg-[#e8e8e8]' : 'text-[#d4d4d4] active:bg-white/10 active:text-white'}`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
    {isAdmin && <div aria-hidden="true" style={{ height: barH }} />}
    </>
  );
}
