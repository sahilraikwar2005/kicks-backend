import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CookieConsent from '../ui/CookieConsent';
import { useAuth } from '../../context/useAuth';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const showCookieBanner = !isAdmin && !pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <Navbar />
      <main>{children}</main>
      <Footer />
      {showCookieBanner && <CookieConsent />}
    </div>
  );
}
