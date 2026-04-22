import { useState } from 'react';
import { scanApi } from '../../services/api';
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  getPermissionStatus,
} from '../../services/notifications';

interface HeaderProps {
  onMenuToggle: () => void;
  onScanTrigger: () => void;
  activeView: string;
}

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  watchlist: 'Watchlist',
  history: 'Trade History',
  settings: 'Settings',
};

export function Header({ onMenuToggle, onScanTrigger, activeView }: HeaderProps) {
  const [scanning, setScanning] = useState(false);
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus());

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanApi.trigger();
      setTimeout(() => { onScanTrigger(); setScanning(false); }, 4000);
    } catch {
      setScanning(false);
    }
  };

  const handleNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { setNotifStatus('denied'); return; }
    const reg = await registerServiceWorker();
    if (reg) {
      await subscribeToPush(reg);
      setNotifStatus('granted');
    }
  };

  return (
    <header className="h-14 bg-surface-800 border-b border-surface-600 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-gray-400 hover:text-white"
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <h1 className="text-base font-semibold text-white">
          {VIEW_TITLES[activeView] ?? 'SwingFlow'}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          onClick={handleNotifications}
          title={notifStatus === 'granted' ? 'Notifications active' : 'Enable notifications'}
          className={`p-2 rounded-lg transition-colors text-sm ${
            notifStatus === 'granted'
              ? 'text-brand-400 bg-brand-500/10'
              : 'text-gray-400 hover:text-white hover:bg-surface-700'
          }`}
        >
          {notifStatus === 'granted' ? '🔔' : '🔕'}
        </button>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={scanning}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${scanning
              ? 'bg-surface-700 text-gray-500 cursor-not-allowed'
              : 'bg-brand-500 hover:bg-brand-600 text-white'}
          `}
        >
          {scanning ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Scanning…
            </>
          ) : (
            <>⚡ Scan Now</>
          )}
        </button>
      </div>
    </header>
  );
}
