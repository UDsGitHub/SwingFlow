import { createContext, useContext, useEffect, useState } from 'react';
import { TradeSetup, MarketSummary } from '../types';
import { useSetups } from '../hooks/useSetups';
import { useMarketSummary } from '../hooks/useWatchlist';
import { configApi } from '../services/api';
import { registerServiceWorker } from '../services/notifications';
import { ProductTour } from '../components/Tour/ProductTour';

const TOUR_STORAGE_KEY = 'swingflow_tour_done';

interface AppContextValue {
  setups: TradeSetup[];
  summaries: MarketSummary[];
  accountSize: number;
  dailyGoal: number;
  loading: boolean;
  summariesLoading: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
  dismissSetup: (id: string) => void;
  tourRun: boolean;
  startTour: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [accountSize, setAccountSize] = useState(5000);
  const [dailyGoal, setDailyGoal]     = useState(100);
  const [tourRun, setTourRun]         = useState(false);

  const { setups, loading, lastUpdated, refresh, dismissSetup } = useSetups(30000);
  const { summaries, loading: summariesLoading } = useMarketSummary(60000);

  useEffect(() => {
    configApi.get()
      .then(cfg => { setAccountSize(Number(cfg.accountSize)); setDailyGoal(Number(cfg.dailyGoal)); })
      .catch(() => {});
    registerServiceWorker();

    // Auto-start tour for first-time visitors
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      setTimeout(() => setTourRun(true), 800);
    }
  }, []);

  const startTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setTourRun(false);
    // brief gap so Joyride resets properly before re-running
    setTimeout(() => setTourRun(true), 100);
  };

  const handleTourFinish = () => {
    setTourRun(false);
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  };

  return (
    <AppContext.Provider value={{
      setups, summaries, accountSize, dailyGoal,
      loading, summariesLoading, lastUpdated,
      refresh, dismissSetup,
      tourRun: tourRun,
      startTour,
    }}>
      {children}
      <ProductTour run={tourRun} onFinish={handleTourFinish} />
    </AppContext.Provider>
  );
}


export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
