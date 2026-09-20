import { Menu, Search, ShoppingBag, User, Heart, ShieldCheck } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
  { label: 'Policy', to: '/privacy-policy' },
  { label: 'Categories', to: '/categories' },
];

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 lg:hidden">
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
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white sm:inline-flex">
            <Search size={16} />
          </button>
          <Link to="/wishlist" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white">
            <Heart size={16} />
          </Link>
          <Link to="/cart" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white">
            <ShoppingBag size={16} />
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">
                  <ShieldCheck size={14} /> Admin
                </Link>
              )}
              <Link to="/account" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
                <User size={14} /> {user?.firstName || 'Account'}
              </Link>
              <button type="button" onClick={logout} className="rounded-full border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
