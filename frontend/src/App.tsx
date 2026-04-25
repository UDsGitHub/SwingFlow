import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { AuthPage } from './pages/AuthPage';
import { RootLayout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WatchlistPanel } from './components/Watchlist/WatchlistPanel';
import { TradeDetail } from './components/TradeDetail/TradeDetail';
import { HistoryPanel } from './components/History/HistoryPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { SymbolDetail } from './components/Symbol/SymbolDetail';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { setTokenGetter } from './lib/tokenStore';
import { BrandedLoader } from './components/ui/BrandedLoader';
import { useMinimumLoading } from './hooks/useMinimumLoading';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in frontend .env');
}

export default function App() {
  return (
    <ThemeProvider>
      <ClerkProvider publishableKey={CLERK_KEY}>
        <ClerkAuthGate />
      </ClerkProvider>
    </ThemeProvider>
  );
}

/**
 * While Clerk is loading session state, `<SignedOut>` renders nothing (it only matches `userId === null`).
 * That caused a blank flash before `<AuthPage />` appeared. We gate on `isLoaded` and show a stable shell instead.
 */
function ClerkAuthGate() {
  const { isLoaded, userId } = useAuth();
  const showAuthLoader = useMinimumLoading(!isLoaded, 450);
  const location = useLocation();
  const isPrivateAppRoute = Boolean(userId);

  useEffect(() => {
    const path = location.pathname;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const canonical = origin ? `${origin}${path}` : path;

    const setMetaByName = (name: string, content: string) => {
      let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setMetaByProperty = (property: string, content: string) => {
      let el = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setCanonical = (href: string) => {
      let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = href;
    };

    if (isPrivateAppRoute) {
      document.title = 'SwingFlow App — Trading Workspace';
      setMetaByName('description', 'Private SwingFlow trading workspace for watchlists, setup tracking, and risk-aware execution workflows.');
      setMetaByName('robots', 'noindex,nofollow');
      setMetaByProperty('og:title', 'SwingFlow App — Trading Workspace');
      setMetaByProperty('og:description', 'Private trading workspace with disciplined setup tracking and execution tools.');
      setMetaByProperty('og:url', canonical);
      setMetaByName('twitter:title', 'SwingFlow App — Trading Workspace');
      setMetaByName('twitter:description', 'Private trading workspace with setup tracking and risk-aware workflow tools.');
      setCanonical(canonical);
      return;
    }

    document.title = 'SwingFlow — Swing Trading Assistant';
    setMetaByName('description', 'SwingFlow is an educational swing-trading assistant with setup tracking, watchlists, and risk controls.');
    setMetaByName('robots', 'index,follow');
    setMetaByProperty('og:title', 'SwingFlow — Swing Trading Assistant');
    setMetaByProperty('og:description', 'Educational swing-trading assistant for disciplined setup tracking and execution workflows.');
    setMetaByProperty('og:url', canonical);
    setMetaByName('twitter:title', 'SwingFlow — Swing Trading Assistant');
    setMetaByName('twitter:description', 'Educational swing-trading assistant for setup tracking, watchlists, and risk controls.');
    setCanonical(canonical);
  }, [location.pathname, isPrivateAppRoute]);

  if (showAuthLoader) {
    return <BrandedLoader mode="fullscreen" message="Loading your workspace…" subtext="Preparing secure session" />;
  }

  if (!userId) {
    return <AuthPage />;
  }

  return (
    <>
      <TokenRegistrar />
      <AppProvider>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="watchlist" element={<WatchlistPanel />} />
            <Route path="history" element={<HistoryPanel />} />
            <Route path="settings" element={<SettingsPanel />} />
            <Route path="setup/:id" element={<TradeDetail />} />
            <Route path="symbol/:sym" element={<SymbolDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </>
  );
}

function TokenRegistrar() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}
