import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface-950 text-gray-100 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* lg:w-60 flex-shrink-0: reserve sidebar width; nav scrolls if many items */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-w-0">
        <Header onMenuToggle={() => setSidebarOpen(o => !o)} />
        {/* Horizontal padding lives in PageContainer per route for one global content measure */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-5 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
