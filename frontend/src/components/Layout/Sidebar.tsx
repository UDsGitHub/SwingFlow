interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  setupCount: number;
  open: boolean;
}

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',   icon: '▦' },
  { id: 'watchlist',  label: 'Watchlist',    icon: '◎' },
  { id: 'history',    label: 'History',      icon: '⏱' },
  { id: 'settings',   label: 'Settings',     icon: '⚙' },
];

export function Sidebar({ activeView, onViewChange, setupCount, open }: SidebarProps) {
  return (
    <aside className={`
      fixed lg:relative z-30 h-full w-64 bg-surface-800 border-r border-surface-600
      flex flex-col transition-transform duration-200
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="p-5 border-b border-surface-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
            SF
          </div>
          <div>
            <div className="font-bold text-white tracking-wide">SwingFlow</div>
            <div className="text-xs text-gray-500">Trading Assistant</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${activeView === item.id
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700'}
            `}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'dashboard' && setupCount > 0 && (
              <span className="ml-auto bg-brand-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {setupCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Provider badge */}
      <div className="p-4 border-t border-surface-600">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-bull-500 animate-pulse" />
          <span>Mock Data Provider</span>
        </div>
      </div>
    </aside>
  );
}
