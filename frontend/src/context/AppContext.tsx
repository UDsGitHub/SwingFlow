import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TradeSetup, MarketSummary, AppNotification, ScanEvaluation, ScanResponse } from '../types';
import { DevelopingSetup } from '../types';
import { useSetups } from '../hooks/useSetups';
import { useMarketSummary } from '../hooks/useWatchlist';
import { configApi, scanApi, notificationsApi, setupsApi } from '../services/api';
import { registerServiceWorker } from '../services/notifications';
import { ProductTour } from '../components/Tour/ProductTour';

const TOUR_STORAGE_KEY  = 'swingflow_tour_done';
const NOTIF_LAST_READ_KEY = 'swingflow_notif_last_read';
const DEVELOPING_HIDDEN_KEY = 'swingflow_developing_hidden';

function getLastReadTs(): number {
  return Number(localStorage.getItem(NOTIF_LAST_READ_KEY) ?? 0);
}

interface AppContextValue {
  setups: TradeSetup[];
  summaries: MarketSummary[];
  accountSize: number;
  dailyGoal: number;
  dailyPnl: number;
  loading: boolean;
  summariesLoading: boolean;
  lastUpdated: Date | null;
  summariesLastUpdated: Date | null;
  refresh: () => Promise<TradeSetup[]>;
  dismissSetup: (id: string) => void;
  tourRun: boolean;
  startTour: () => void;
  isScanning: boolean;
  lastScanned: Date | null;
  scanFlash: string | null;
  developingSetups: DevelopingSetup[];
  developingHidden: boolean;
  setDevelopingHidden: (hidden: boolean) => void;
  developingConversionRate: number | null;
  developingCandidatesSeen: number;
  developingConverted: number;
  scanReasons: string[];
  latestScan: ScanResponse | null;
  scanDiagnostics: ScanEvaluation[];
  triggerScan: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsRead: () => void;
  refreshDailyPnl: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [accountSize, setAccountSize] = useState(5000);
  const [dailyGoal, setDailyGoal]     = useState(100);
  const [dailyPnl, setDailyPnl]       = useState(0);
  const [tourRun, setTourRun]         = useState(false);
  const [isScanning, setIsScanning]   = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [scanFlash, setScanFlash]     = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [developingSetups, setDevelopingSetups] = useState<DevelopingSetup[]>([]);
  const [developingHidden, setDevelopingHiddenState] = useState<boolean>(
    () => localStorage.getItem(DEVELOPING_HIDDEN_KEY) === '1',
  );
  const [developingCandidatesSeen, setDevelopingCandidatesSeen] = useState(0);
  const [developingConverted, setDevelopingConverted] = useState(0);

  const setDevelopingHidden = useCallback((hidden: boolean) => {
    setDevelopingHiddenState(hidden);
    localStorage.setItem(DEVELOPING_HIDDEN_KEY, hidden ? '1' : '0');
  }, []);
  const [scanReasons, setScanReasons] = useState<string[]>([]);
  const [latestScan, setLatestScan] = useState<ScanResponse | null>(null);
  const [scanDiagnostics, setScanDiagnostics] = useState<ScanEvaluation[]>([]);

  const { setups, loading, lastUpdated, refresh, dismissSetup } = useSetups(30000);
  const {
    summaries,
    loading: summariesLoading,
    lastUpdated: summariesLastUpdated,
  } = useMarketSummary(60000);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.history();
      setNotifications(data);
      setUnreadCount(data.filter(n => n.sent_at > getLastReadTs()).length);
    } catch {
      // non-critical; fail silently
    }
  }, []);

  const refreshDailyPnl = useCallback(async () => {
    try {
      const { pnl } = await setupsApi.dailyPnl();
      setDailyPnl(pnl);
    } catch {
      // non-critical
    }
  }, []);

  const fetchDevelopingData = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([
        setupsApi.developingList(),
        setupsApi.developingStats(),
      ]);
      setDevelopingSetups(list);
      setDevelopingCandidatesSeen(stats.everTracked);
      setDevelopingConverted(stats.converted);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    configApi.get()
      .then(cfg => {
        setAccountSize(Number(cfg.accountSize));
        setDailyGoal(Number(cfg.dailyGoal));
      })
      .catch(() => {});
    registerServiceWorker();
    fetchNotifications();
    refreshDailyPnl();
    fetchDevelopingData();

    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      setTimeout(() => setTourRun(true), 800);
    }
  }, [fetchNotifications, refreshDailyPnl, fetchDevelopingData]);

  const triggerScan = useCallback(async () => {
    setIsScanning(true);
    setScanFlash(null);
    try {
      const run = await scanApi.trigger();
      setLatestScan(run);
      setScanReasons(run.noSetupReasons ?? []);
      const diagnostics = await setupsApi.scanDiagnostics();
      setScanDiagnostics(diagnostics);
      await new Promise(r => setTimeout(r, 4000));
      const data = await refresh();
      await fetchDevelopingData();

      const now   = new Date();
      setLastScanned(now);
      const count = data.length;
      const devCount = (run.developingSetups ?? []).length;
      const msg =
        count === 0
          ? `Scan complete · no active setups${devCount ? ` · ${devCount} developing` : ''}`
          : `Scan complete · ${count} active setup${count !== 1 ? 's' : ''}`;
      setScanFlash(msg);
      setTimeout(() => setScanFlash(null), 4000);
      await fetchNotifications();
      await refreshDailyPnl();
    } catch {
      // silent
    } finally {
      setIsScanning(false);
    }
  }, [refresh, fetchNotifications, refreshDailyPnl, fetchDevelopingData]);

  const developingConversionRate = developingCandidatesSeen > 0
    ? (developingConverted / developingCandidatesSeen) * 100
    : null;

  const markNotificationsRead = useCallback(() => {
    localStorage.setItem(NOTIF_LAST_READ_KEY, String(Date.now()));
    setUnreadCount(0);
  }, []);

  const startTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setTourRun(false);
    setTimeout(() => setTourRun(true), 100);
  };

  const handleTourFinish = () => {
    setTourRun(false);
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  };

  return (
    <AppContext.Provider value={{
      setups, summaries, accountSize, dailyGoal, dailyPnl,
      loading, summariesLoading, lastUpdated, summariesLastUpdated,
      refresh, dismissSetup,
      tourRun, startTour,
      isScanning, lastScanned, scanFlash, triggerScan,
      developingSetups, developingHidden, setDevelopingHidden,
      developingConversionRate, developingCandidatesSeen, developingConverted,
      scanReasons, latestScan, scanDiagnostics,
      notifications, unreadCount, markNotificationsRead,
      refreshDailyPnl,
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
