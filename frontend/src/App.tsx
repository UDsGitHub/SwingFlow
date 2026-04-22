import { useState, useEffect } from 'react';
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
  const [view, setView] = useState('dashboard');
  const [selectedSetup, setSelectedSetup] = useState<TradeSetup | null>(null);
  const [accountSize, setAccountSize] = useState(5000);
  const [dailyGoal, setDailyGoal] = useState(100);

  const { setups, loading, lastUpdated, refresh, dismissSetup } = useSetups(30000);
  const { summaries, loading: summariesLoading } = useMarketSummary(60000);

  useEffect(() => {
    configApi.get().then(cfg => {
      setAccountSize(Number(cfg.accountSize));
      setDailyGoal(Number(cfg.dailyGoal));
    }).catch(() => {});
    registerServiceWorker();
  }, []);

  // Check URL param for setup deep-link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupId = params.get('setup');
    if (setupId) {
      const found = setups.find(s => s.id === setupId);
      if (found) { setSelectedSetup(found); setView('detail'); }
    }
  }, [setups]);

  const handleSetupClick = (setup: TradeSetup) => {
    setSelectedSetup(setup);
    setView('detail');
  };

  const handleSymbolClick = (symbol: string) => {
    // Navigate to watchlist filtered by symbol
    setView('watchlist');
  };

  const handleBack = () => {
    setSelectedSetup(null);
    setView('dashboard');
  };

  const renderContent = () => {
    if (view === 'detail' && selectedSetup) {
      return <TradeDetail setup={selectedSetup} onBack={handleBack} />;
    }
    switch (view) {
      case 'watchlist':
        return <WatchlistPanel summaries={summaries} onSymbolClick={handleSetupClick as unknown as (s: string) => void} />;
      case 'history':
        return <HistoryPanel onSetupClick={handleSetupClick} />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return (
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
            onSymbolClick={handleSymbolClick}
          />
        );
    }
  };

  return (
    <Layout
      activeView={view === 'detail' ? 'dashboard' : view}
      onViewChange={(v) => { setView(v); setSelectedSetup(null); }}
      onScanTrigger={refresh}
      setupCount={setups.length}
    >
      {renderContent()}
    </Layout>
  );
}
