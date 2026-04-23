import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { AuthPage } from './pages/AuthPage';
import { RootLayout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WatchlistPanel } from './components/Watchlist/WatchlistPanel';
import { TradeDetail } from './components/TradeDetail/TradeDetail';
import { HistoryPanel } from './components/History/HistoryPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { AppProvider } from './context/AppContext';
import { setTokenGetter } from './lib/tokenStore';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in frontend .env');
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <SignedOut>
        <AuthPage />
      </SignedOut>
      <SignedIn>
        <TokenRegistrar />
        <AppProvider>
          <Routes>
            <Route element={<RootLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="watchlist" element={<WatchlistPanel />} />
              <Route path="history" element={<HistoryPanel />} />
              <Route path="settings" element={<SettingsPanel />} />
              <Route path="setup/:id" element={<TradeDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AppProvider>
      </SignedIn>
    </ClerkProvider>
  );
}

function TokenRegistrar() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}
