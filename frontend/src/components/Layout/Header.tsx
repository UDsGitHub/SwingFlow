import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell, BellOff, Zap, Loader2 } from 'lucide-react';
import { scanApi } from '../../services/api';
import { useAppContext } from '../../context/AppContext';
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  getPermissionStatus,
} from '../../services/notifications';

interface HeaderProps {
  onMenuToggle: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/watchlist': 'Watchlist',
  '/history':   'Trade History',
  '/settings':  'Settings',
};

export function Header({ onMenuToggle }: HeaderProps) {
  const { pathname } = useLocation();
  const { refresh } = useAppContext();
  const [scanning, setScanning]       = useState(false);
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus());

  const title = pathname.startsWith('/setup/')
    ? 'Setup Detail'
    : (ROUTE_TITLES[pathname] ?? 'SwingFlow');

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanApi.trigger();
      setTimeout(() => { refresh(); setScanning(false); }, 4000);
    } catch {
      setScanning(false);
    }
  };

  const handleNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { setNotifStatus('denied'); return; }
    const reg = await registerServiceWorker();
    if (reg) { await subscribeToPush(reg); setNotifStatus('granted'); }
  };

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-surface-700 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-800 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          id="tour-notifications"
          onClick={handleNotifications}
          title={notifStatus === 'granted' ? 'Notifications active' : 'Enable notifications'}
          className={`p-1.5 rounded-lg transition-colors ${
            notifStatus === 'granted'
              ? 'text-brand-400 bg-brand-500/10'
              : 'text-gray-400 hover:text-gray-300 hover:bg-surface-800'
          }`}
        >
          {notifStatus === 'granted' ? <Bell size={16} /> : <BellOff size={16} />}
        </button>

        <button
          id="tour-scan"
          onClick={handleScan}
          disabled={scanning}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${scanning
              ? 'bg-surface-800 text-gray-400 cursor-not-allowed'
              : 'bg-brand-500 hover:bg-brand-600 text-white'}
          `}
        >
          {scanning ? (
            <><Loader2 size={12} className="animate-spin" /> Scanning</>
          ) : (
            <><Zap size={12} /> Scan Now</>
          )}
        </button>
      </div>
    </header>
  );
}
