import { useEffect, useState } from 'react';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { AuthPage } from './pages/AuthPage';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WatchlistPanel } from './components/Watchlist/WatchlistPanel';
import { TradeDetail } from './components/TradeDetail/TradeDetail';
import { HistoryPanel } from './components/History/HistoryPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useSetups } from './hooks/useSetups';
import { useMarketSummary } from './hooks/useWatchlist';
import { useAuth as useAppAuth } from './hooks/useAuth';
import { configApi } from './services/api';
import { setTokenGetter } from './lib/tokenStore';
import { TradeSetup } from './types';
import { registerServiceWorker } from './services/notifications';

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
        <AuthenticatedApp />
      </SignedIn>
    </ClerkProvider>
  );
}

// Registers Clerk's getToken into the axios interceptor store.
// Must be inside ClerkProvider and SignedIn so useAuth() is available.
function TokenRegistrar() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function AuthenticatedApp() {
  const { signOut } = useAppAuth();
  const [view, setView]                   = useState('dashboard');
  const [selectedSetup, setSelectedSetup] = useState<TradeSetup | null>(null);
  const [accountSize, setAccountSize]     = useState(5000);
  const [dailyGoal, setDailyGoal]         = useState(100);

  const { setups, loading, lastUpdated, refresh, dismissSetup } = useSetups(30000);
  const { summaries, loading: summariesLoading } = useMarketSummary(60000);

  useEffect(() => {
    configApi.get()
      .then(cfg => { setAccountSize(Number(cfg.accountSize)); setDailyGoal(Number(cfg.dailyGoal)); })
      .catch(() => {});
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('setup');
    if (id) {
      const found = setups.find(s => s.id === id);
      if (found) { setSelectedSetup(found); setView('detail'); }
    }
  }, [setups]);

  const handleSetupClick = (setup: TradeSetup) => { setSelectedSetup(setup); setView('detail'); };
  const handleBack = () => { setSelectedSetup(null); setView('dashboard'); };

  const renderContent = () => {
    if (view === 'detail' && selectedSetup) return <TradeDetail setup={selectedSetup} onBack={handleBack} />;
    switch (view) {
      case 'watchlist': return <WatchlistPanel summaries={summaries} onSymbolClick={() => {}} />;
      case 'history':   return <HistoryPanel onSetupClick={handleSetupClick} />;
      case 'settings':  return <SettingsPanel />;
      default: return (
        <Dashboard
          setups={setups}
          summaries={summaries}
          summariesLoading={summariesLoading}
          loading={loading}
          lastUpdated={lastUpdated}
          accountSize={accountSize}
          dailyGoal={dailyGoal}
          onSetupClick={handleSetupClick}
          onDismissSetup={dismissSetup}
          onSymbolClick={() => setView('watchlist')}
        />
      );
    }
  };

  return (
    <Layout
      activeView={view === 'detail' ? 'dashboard' : view}
      onViewChange={(v) => { setView(v); setSelectedSetup(null); }}
      onScanTrigger={refresh}
      onSignOut={signOut}
      setupCount={setups.length}
    >
      {renderContent()}
    </Layout>
  );
}
