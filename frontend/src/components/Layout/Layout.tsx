import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
  onScanTrigger: () => void;
  onSignOut: () => void;
  setupCount: number;
}

export function Layout({ children, activeView, onViewChange, onScanTrigger, onSignOut, setupCount }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface-900 text-gray-100 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        activeView={activeView}
        onViewChange={(v) => { onViewChange(v); setSidebarOpen(false); }}
        onSignOut={onSignOut}
        setupCount={setupCount}
        open={sidebarOpen}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuToggle={() => setSidebarOpen(o => !o)}
          onScanTrigger={onScanTrigger}
          activeView={activeView}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
