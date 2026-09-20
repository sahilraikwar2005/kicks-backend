import { Link } from 'react-router-dom';

const footerLinks = {
  Shop: [
    { label: 'Featured', to: '/shop' },
    { label: 'Categories', to: '/categories' },
    { label: 'Search', to: '/shop' },
  ],
  About: [
    { label: 'About us', to: '/about' },
    { label: 'FAQ', to: '/faq' },
    { label: 'Contact', to: '/contact' },
  ],
  Policies: [
    { label: 'Privacy', to: '/privacy-policy' },
    { label: 'Terms', to: '/terms' },
    { label: 'Shipping', to: '/shipping-policy' },
    { label: 'Returns', to: '/refund-cancellation-policy' },
  ],
};

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#090909]">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1fr] lg:px-8">
        <div>
          <p className="text-[12px] uppercase tracking-[0.35em] text-[#9a9a9a]">KICKS</p>
          <h3 className="mt-6 text-3xl font-black uppercase tracking-[-0.06em] text-white">Move different.</h3>
          <p className="mt-4 max-w-sm text-sm text-[#a7a7a7]">
            Premium sneaker essentials for movement, culture, and everyday confidence.
          </p>
        </div>

        {Object.entries(footerLinks).map(([title, links]) => (
          <div key={title}>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8d8d]">{title}</p>
            <ul className="mt-5 space-y-3 text-sm text-[#d3d3d3]">
              {links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8d8d]">Connect</p>
          <div className="mt-5 space-y-3 text-sm text-[#d3d3d3]">
            <p>support@kicks.example</p>
            <p>+91 98765 43210</p>
            <p>12 MG Road, Bengaluru</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-6 text-xs uppercase tracking-[0.18em] text-[#777] lg:px-8">
          <span>© 2026 KICKS</span>
          <span>Built for movement</span>
        </div>
      </div>
    </footer>
  );
}
