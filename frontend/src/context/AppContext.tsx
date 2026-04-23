import { createContext, useContext, useEffect, useState } from 'react';
import { TradeSetup, MarketSummary } from '../types';
import { useSetups } from '../hooks/useSetups';
import { useMarketSummary } from '../hooks/useWatchlist';
import { configApi } from '../services/api';
import { registerServiceWorker } from '../services/notifications';

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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <AppContext.Provider value={{
      setups, summaries, accountSize, dailyGoal,
      loading, summariesLoading, lastUpdated,
      refresh, dismissSetup,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
