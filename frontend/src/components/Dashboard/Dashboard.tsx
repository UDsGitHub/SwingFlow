import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Zap, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { GoalTracker } from './GoalTracker';
import { SetupCard } from './SetupCard';
import { MarketSummaryPanel } from './MarketSummary';
import { RecentTrades } from './RecentTrades';
import { LogTradeModal } from './LogTradeModal';
import { EmptyState } from '../ui/EmptyState';

export function Dashboard() {
  const navigate = useNavigate();
  const {
    setups, summaries, summariesLoading, summariesLastUpdated,
    loading, lastUpdated, accountSize, dailyGoal, dailyPnl,
    dismissSetup, scanFlash, refreshDailyPnl,
    isScanning, triggerScan,
  } = useAppContext();

  const [logTradeOpen, setLogTradeOpen] = useState(false);

  const bestRR = setups.length > 0 ? Math.max(...setups.map(s => s.riskReward)) : 0;

  const handleTradeRecorded = async () => {
    await refreshDailyPnl();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <MarketSummaryPanel
        summaries={summaries}
        loading={summariesLoading}
        lastUpdated={summariesLastUpdated}
        onSymbolClick={sym => navigate(`/symbol/${sym}`, { state: { from: 'dashboard' } })}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Daily Goal */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Goal</h2>
          <GoalTracker
            dailyGoal={dailyGoal}
            accountSize={accountSize}
            setupCount={setups.length}
            bestRR={bestRR}
            dailyPnl={dailyPnl}
            onLogTrade={() => setLogTradeOpen(true)}
          />
        </div>

        {/* Active Setups */}
        <div id="tour-setups" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-300">
                Active Setups
                {setups.length > 0 && (
                  <span className="ml-2 text-gray-400">({setups.length})</span>
                )}
              </h2>
              {scanFlash && (
                <span className="text-xs font-medium text-bull-400 bg-bull-500/10 px-2.5 py-0.5 rounded-full">
                  ✓ {scanFlash}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-gray-400 tabular-nums">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                id="tour-scan"
                onClick={triggerScan}
                disabled={isScanning}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  isScanning
                    ? 'bg-surface-800 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-500 hover:bg-brand-600 text-white'
                }`}
              >
                {isScanning
                  ? <><Loader2 size={12} className="animate-spin" /> Scanning</>
                  : <><Zap size={12} /> Scan Now</>}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface-800 animate-pulse rounded-2xl h-52 border border-surface-700" />
              ))}
            </div>
          ) : setups.length === 0 ? (
            <DashboardEmpty />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {setups.map(setup => (
                <SetupCard
                  key={setup.id}
                  setup={setup}
                  onClick={() => navigate(`/setup/${setup.id}`, { state: { from: 'dashboard' } })}
                  onDismiss={() => dismissSetup(setup.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <RecentTrades />

      <LogTradeModal
        open={logTradeOpen}
        setups={setups}
        onClose={() => setLogTradeOpen(false)}
        onRecorded={handleTradeRecorded}
      />
    </div>
  );
}

function DashboardEmpty() {
  return (
    <div className="border border-dashed border-surface-600 rounded-2xl p-12">
      <EmptyState
        icon={BarChart3}
        iconBg="bg-surface-800"
        heading="No active setups"
        body='Click "Scan Now" to run the strategy engine and find high-probability setups in your watchlist.'
      />
    </div>
  );
}
