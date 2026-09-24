import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  const subscribe = (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNote('Enter a valid email address.');
      return;
    }
    setEmail('');
    setNote('Newsletter is not live yet — read Stories for the latest drops.');
  };

  return (
    <footer className="border-t border-white/10 bg-[#090909]">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:py-16 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1.1fr] lg:px-8">
        <div>
          <p className="text-xl font-black uppercase tracking-[0.3em] text-white">AJ SPORTS</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#a7a7a7]">
            Good shoes take you good places. Discover footwear for performance, style, and every move between.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white">Explore</p>
          <ul className="mt-5 space-y-3 text-sm text-[#b8b8b8]">
            <li>
              <Link to="/shop" className="transition hover:text-white">
                Shop All
              </Link>
            </li>
            <li>
              <Link to="/shop?type=SHOES" className="transition hover:text-white">
                Shoes
              </Link>
            </li>
            <li>
              <Link to="/shop?type=SLIDES" className="transition hover:text-white">
                Slides
              </Link>
            </li>
            <li>
              <Link to="/shop?type=CROCS" className="transition hover:text-white">
                Crocs / Clogs
              </Link>
            </li>
            <li>
              <Link to="/shop?type=TSHIRT" className="transition hover:text-white">
                T-Shirts
              </Link>
            </li>
            <li>
              <Link to="/shop?type=LOWER" className="transition hover:text-white">
                Lowers
              </Link>
            </li>
            <li>
              <Link to="/shop?type=SHORTS" className="transition hover:text-white">
                Shorts
              </Link>
            </li>
            <li>
              <Link to="/shop?type=SOCKS" className="transition hover:text-white">
                Socks
              </Link>
            </li>
            <li>
              <Link to="/categories" className="transition hover:text-white">
                Collections
              </Link>
            </li>
            <li>
              <Link to="/blog" className="transition hover:text-white">
                Stories
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white">Company</p>
          <ul className="mt-5 space-y-3 text-sm text-[#b8b8b8]">
            <li>
              <Link to="/about" className="transition hover:text-white">
                About Us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="transition hover:text-white">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/account" className="transition hover:text-white">
                Account
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white">Stay Moving</p>
          <p className="mt-5 text-sm text-[#a7a7a7]">New drops and stories, once a week.</p>
          <form onSubmit={subscribe} className="mt-4" noValidate>
            <div className="flex items-center gap-2 border-b border-white/20 pb-2 focus-within:border-white/50">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setNote('');
                }}
                placeholder="Email address"
                className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-[#777] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Subscribe to newsletter"
                title="Subscribe"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <ArrowRight size={16} />
              </button>
            </div>
            {note && <p className="mt-2 text-xs text-[#a0a0a0]">{note}</p>}
          </form>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-6 text-[11px] uppercase tracking-[0.2em] text-[#777] sm:flex-row lg:px-8">
          <span>© 2026 AJ SPORTS</span>
          <Link to="/authenticity" className="transition hover:text-white">
            Authenticity &amp; Product Information
          </Link>
          <span>Move Different.</span>
        </div>
      </div>
    </footer>
  );
}
