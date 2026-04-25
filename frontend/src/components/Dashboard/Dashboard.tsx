import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Zap, Loader2 } from 'lucide-react';
import { gsap } from 'gsap';
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
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { BrandedLoader } from '../ui/BrandedLoader';
import { useMinimumLoading } from '../../hooks/useMinimumLoading';

export function Dashboard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const {
    setups, summaries, summariesLoading, summariesLastUpdated,
    loading, lastUpdated, accountSize, dailyGoal, dailyPnl,
    dismissSetup, scanFlash, refreshDailyPnl,
    isScanning, triggerScan,
  } = useAppContext();

  const [logTradeOpen, setLogTradeOpen] = useState(false);
  const showSetupsLoader = useMinimumLoading(loading, 450);

  const bestRR = setups.length > 0 ? Math.max(...setups.map(s => s.riskReward)) : 0;

  const handleTradeRecorded = async () => {
    await refreshDailyPnl();
  };

  useLayoutEffect(() => {
    if (prefersReducedMotion || !rootRef.current) return;

    const surfaces = rootRef.current.querySelectorAll('[data-sf-dash-surface]');
    if (surfaces.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        surfaces,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: 'power2.out',
          stagger: 0.06,
          clearProps: 'opacity,transform',
        },
      );
    }, rootRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <PageContainer className="space-y-8">
      <div ref={rootRef} className="space-y-8">
        <div data-sf-dash-surface>
          <MarketSummaryPanel
            summaries={summaries}
            loading={summariesLoading}
            lastUpdated={summariesLastUpdated}
            onSymbolClick={sym => navigate(`/symbol/${sym}`, { state: { from: 'dashboard' } })}
          />
        </div>

        <div data-sf-dash-surface className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                <SectionLabel as="h2" noMargin className="inline-flex flex-wrap items-center gap-2">
                  <span>Active Setups</span>
                  {setups.length > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-h-6 min-w-6 px-2 rounded-full bg-brand-500/15 border border-brand-500/25 text-xs font-semibold tabular-nums text-brand-300"
                      title={`${setups.length} active setup${setups.length === 1 ? '' : 's'}`}
                    >
                      {setups.length}
                    </span>
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

            {showSetupsLoader ? (
              <BrandedLoader
                message="Scanning active setups…"
                subtext="Fetching latest opportunities"
                className="min-h-[14rem]"
              />
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

        <div data-sf-dash-surface>
          <RecentTrades />
        </div>
      </div>

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
