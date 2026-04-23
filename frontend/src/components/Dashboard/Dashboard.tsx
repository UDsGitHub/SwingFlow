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
import { PageContainer } from '../ui/PageContainer';
import { SectionLabel } from '../ui/SectionLabel';
import { Button } from '../ui/Button';

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
    <PageContainer className="space-y-8">
      <MarketSummaryPanel
        summaries={summaries}
        loading={summariesLoading}
        lastUpdated={summariesLastUpdated}
        onSymbolClick={sym => navigate(`/symbol/${sym}`, { state: { from: 'dashboard' } })}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <SectionLabel>Daily Goal</SectionLabel>
          <GoalTracker
            dailyGoal={dailyGoal}
            accountSize={accountSize}
            setupCount={setups.length}
            bestRR={bestRR}
            dailyPnl={dailyPnl}
            onLogTrade={() => setLogTradeOpen(true)}
          />
        </div>

        <div id="tour-setups" className="lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <SectionLabel as="h2" noMargin>
                Active Setups
                {setups.length > 0 && (
                  <span className="ml-2 text-gray-500 font-normal">({setups.length})</span>
                )}
              </SectionLabel>
              {scanFlash && (
                <span className="text-sf-label font-medium text-data-up bg-bull-500/10 px-2.5 py-0.5 rounded-full">
                  ✓ {scanFlash}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {lastUpdated && (
                <span className="text-sf-field text-gray-500 tabular-nums">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button
                id="tour-scan"
                onClick={triggerScan}
                disabled={isScanning}
                variant="primary"
                className={isScanning ? '!bg-surface-700 !text-gray-400 hover:!bg-surface-700' : ''}
              >
                {isScanning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Scanning
                  </>
                ) : (
                  <>
                    <Zap size={14} /> Scan Now
                  </>
                )}
              </Button>
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
    </PageContainer>
  );
}

function DashboardEmpty() {
  return (
    <div className="border border-dashed border-surface-600 rounded-2xl p-12">
      <EmptyState
        icon={BarChart3}
        heading="No active setups"
        subtext='Run "Scan Now" above to detect opportunities from your watchlist.'
      />
    </div>
  );
}
