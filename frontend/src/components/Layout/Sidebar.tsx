import { useLayoutEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Eye, Clock, Settings2, LogOut,
} from 'lucide-react';
import { gsap } from 'gsap';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../context/AppContext';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/watchlist', label: 'Watchlist', icon: Eye },
  { to: '/history',   label: 'History',   icon: Clock },
  { to: '/settings',  label: 'Settings',  icon: Settings2 },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { setups } = useAppContext();
  const asideRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const initial = user?.email?.[0]?.toUpperCase() ?? '?';

  useLayoutEffect(() => {
    if (prefersReducedMotion || !asideRef.current) return;
    if (!open && window.innerWidth < 1024) return;

    const navItems = asideRef.current.querySelectorAll('[data-sf-nav-item]');
    if (navItems.length === 0) return;

    gsap.fromTo(
      navItems,
      { autoAlpha: 0, x: -8 },
      { autoAlpha: 1, x: 0, duration: 0.22, stagger: 0.028, ease: 'power2.out', clearProps: 'opacity,transform' },
    );
  }, [open, prefersReducedMotion]);

  return (
    <aside ref={asideRef} className={`
      fixed lg:relative z-30 h-full w-60 min-w-[15rem] max-w-[15rem] flex flex-col flex-shrink-0
      bg-surface-900 border-r border-surface-700
      sf-motion-surface transition-transform duration-200
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-surface-700">
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          SF
        </div>
        <span className="font-semibold text-white tracking-tight">SwingFlow</span>
      </div>

      {/* Nav */}
      {/* Future: collapsible / icon-rail below ~1280px if nav grows further */}
      <nav id="tour-sidebar" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium sf-motion-surface
              ${isActive
                ? 'bg-brand-500/10 text-brand-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'}
            `}
            data-sf-nav-item="true"
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-brand-400' : 'text-gray-400'} />
                <span>{label}</span>
                {label === 'Dashboard' && setups.length > 0 && (
                  <span
                    className="ml-auto min-w-[1.25rem] text-center text-xs font-semibold tabular-nums bg-brand-500 text-white px-1.5 py-0.5 rounded-full leading-none"
                    title={`${setups.length} active setup${setups.length === 1 ? '' : 's'}`}
                  >
                    {setups.length}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 border-t border-surface-700 pt-3 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-surface-600 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
            {initial}
          </div>
          <span className="text-sm text-gray-400 truncate">{user?.email}</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-bull-500 flex-shrink-0" />
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-gray-300 hover:bg-surface-800 sf-motion-surface"
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>

        <p className="px-3 pt-3 text-[10px] text-gray-500 leading-snug">
          Market data by{' '}
          <a
            href="https://alpaca.markets"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 underline-offset-2 hover:text-brand-400 hover:underline"
          >
            Alpaca
          </a>
        </p>
      </div>
    </aside>
  );
}
