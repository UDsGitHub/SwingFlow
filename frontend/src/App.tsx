import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WatchlistPanel } from './components/Watchlist/WatchlistPanel';
import { TradeDetail } from './components/TradeDetail/TradeDetail';
import { HistoryPanel } from './components/History/HistoryPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useSetups } from './hooks/useSetups';
import { useMarketSummary } from './hooks/useWatchlist';
import { configApi } from './services/api';
import { TradeSetup } from './types';
import { registerServiceWorker } from './services/notifications';

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  // Don't render anything until auth state is known
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <AuthenticatedApp onSignOut={signOut} />;
}

function AuthenticatedApp({ onSignOut }: { onSignOut: () => void }) {
  const [view, setView]               = useState('dashboard');
  const [selectedSetup, setSelectedSetup] = useState<TradeSetup | null>(null);
  const [accountSize, setAccountSize] = useState(5000);
  const [dailyGoal, setDailyGoal]     = useState(100);

  const { setups, loading, lastUpdated, refresh, dismissSetup } = useSetups(30000);
  const { summaries, loading: summariesLoading } = useMarketSummary(60000);

  useEffect(() => {
    configApi.get()
      .then(cfg => { setAccountSize(Number(cfg.accountSize)); setDailyGoal(Number(cfg.dailyGoal)); })
      .catch(() => {});
    registerServiceWorker();
  }, []);

  // Deep-link: ?setup=<id>
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
      onSignOut={onSignOut}
      setupCount={setups.length}
    >
      {renderContent()}
    </Layout>
  );
}
