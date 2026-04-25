import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell, HelpCircle, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { gsap } from 'gsap';
import { useAppContext } from '../../context/AppContext';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface HeaderProps {
  onMenuToggle: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/watchlist': 'Watchlist',
  '/history':   'Trade History',
  '/settings':  'Settings',
};

const NOTIF_LABELS: Record<string, string> = {
  NEW_SETUP:  'New setup detected',
  ENTRY_ZONE: 'Entry zone alert',
};

export function Header({ onMenuToggle }: HeaderProps) {
  const { pathname } = useLocation();
  const {
    startTour,
    lastScanned,
    notifications, unreadCount, markNotificationsRead,
  } = useAppContext();

  const title = pathname.startsWith('/setup/')
    ? 'Setup Detail'
    : (ROUTE_TITLES[pathname] ?? 'SwingFlow');

  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  useLayoutEffect(() => {
    if (!panelOpen || prefersReducedMotion || !dropdownRef.current) return;
    gsap.fromTo(
      dropdownRef.current,
      { autoAlpha: 0, y: 8, scale: 0.985, transformOrigin: 'top right' },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.24,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
      },
    );
  }, [panelOpen, prefersReducedMotion]);

  const handleBellClick = () => {
    if (!panelOpen) markNotificationsRead();
    setPanelOpen(v => !v);
  };

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-surface-700 flex-shrink-0 relative z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-800 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={startTour}
          title="Replay product tour"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-surface-800 transition-colors"
        >
          <HelpCircle size={16} />
        </button>

        {/* In-app notification center */}
        <div className="relative" ref={panelRef}>
          <button
            id="tour-notifications"
            onClick={handleBellClick}
            title="Notifications"
            className={`relative p-1.5 rounded-lg transition-colors ${
              panelOpen
                ? 'text-brand-400 bg-brand-500/10'
                : 'text-gray-400 hover:text-gray-300 hover:bg-surface-800'
            }`}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-bear-500 ring-2 ring-surface-950" />
            )}
          </button>

          {panelOpen && (
            <div ref={dropdownRef} className="absolute right-0 top-full mt-2 w-80 bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
                <span className="text-sm font-semibold text-white">Notifications</span>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-surface-700 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-surface-700">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={20} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No notifications yet.</p>
                    <p className="text-xs text-gray-500 mt-1">Run a scan to detect setups.</p>
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-surface-750 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sf-field font-medium text-gray-300">
                          {NOTIF_LABELS[n.type] ?? n.type}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${n.delivered ? 'text-data-up' : 'text-warn-400'}`}>
                            {n.delivered ? 'delivered' : 'pending'}
                          </span>
                          <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                            {formatDistanceToNow(new Date(n.sent_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                        <p className="text-sf-field text-gray-400 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Last scanned timestamp */}
        {lastScanned && (
          <span className="hidden sm:block text-xs text-gray-500 tabular-nums">
            Scanned {format(lastScanned, 'HH:mm')}
          </span>
        )}
      </div>
    </header>
  );
}
