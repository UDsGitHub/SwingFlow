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
const DEVELOPING_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const DEVELOPING_SESSION_CAP = 6;
const DEVELOPING_TRACKING_KEY = 'swingflow_developing_tracking';
const DEVELOPING_STATS_KEY = 'swingflow_developing_stats';
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

    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      setTimeout(() => setTourRun(true), 800);
    }
    try {
      const rawStats = localStorage.getItem(DEVELOPING_STATS_KEY);
      if (rawStats) {
        const parsed = JSON.parse(rawStats) as { totalCandidates: number; totalConverted: number };
        setDevelopingCandidatesSeen(parsed.totalCandidates ?? 0);
        setDevelopingConverted(parsed.totalConverted ?? 0);
      }
    } catch {
      // ignore corrupted local stats
    }
  }, [fetchNotifications, refreshDailyPnl]);

  const triggerScan = useCallback(async () => {
    setIsScanning(true);
    setScanFlash(null);
    try {
      const run = await scanApi.trigger();
      setLatestScan(run);
      setScanReasons(run.noSetupReasons ?? []);
      const diagnostics = await setupsApi.scanDiagnostics();
      setScanDiagnostics(diagnostics);
      const nowMs = Date.now();
      const rawDeveloping = (run.developingSetups ?? []).filter(
        s => nowMs - s.detectedAt <= DEVELOPING_MAX_AGE_MS,
      );
      let previousTracking: Record<string, { sessions: number }> = {};
      let stats = { totalCandidates: developingCandidatesSeen, totalConverted: developingConverted };
      try {
        previousTracking = JSON.parse(localStorage.getItem(DEVELOPING_TRACKING_KEY) ?? '{}') as Record<string, { sessions: number }>;
      } catch {
        previousTracking = {};
      }
      try {
        const rawStats = localStorage.getItem(DEVELOPING_STATS_KEY);
        if (rawStats) stats = JSON.parse(rawStats) as typeof stats;
      } catch {
        // ignore
      }

      const nextTracking: Record<string, { sessions: number }> = {};
      const withSessions: DevelopingSetup[] = [];
      for (const d of rawDeveloping) {
        const key = `${d.symbol}|${d.strategy}`;
        const prev = previousTracking[key];
        const sessions = (prev?.sessions ?? 0) + 1;
        if (sessions > DEVELOPING_SESSION_CAP) continue;
        if (!prev) stats.totalCandidates += 1;
        nextTracking[key] = { sessions };
        withSessions.push({ ...d, sessionsSeen: sessions });
      }
      await new Promise(r => setTimeout(r, 4000));
      const data = await refresh();
      const activeKeys = new Set(data.map(s => `${s.symbol}|${s.strategy}`));
      for (const key of Object.keys(nextTracking)) {
        if (activeKeys.has(key)) {
          stats.totalConverted += 1;
          delete nextTracking[key];
        }
      }
      localStorage.setItem(DEVELOPING_TRACKING_KEY, JSON.stringify(nextTracking));
      localStorage.setItem(DEVELOPING_STATS_KEY, JSON.stringify(stats));
      setDevelopingCandidatesSeen(stats.totalCandidates);
      setDevelopingConverted(stats.totalConverted);
      setDevelopingSetups(withSessions.filter(d => !activeKeys.has(`${d.symbol}|${d.strategy}`)));

      const now   = new Date();
      setLastScanned(now);
      const count = data.length;
      const msg =
        count === 0
          ? `Scan complete · no active setups${withSessions.length ? ` · ${withSessions.length} developing` : ''}`
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
  }, [refresh, fetchNotifications, refreshDailyPnl, developingCandidatesSeen, developingConverted]);

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
