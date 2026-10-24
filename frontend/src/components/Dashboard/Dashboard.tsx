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
    dismissSetup, scanFlash, refreshDailyPnl, developingSetups,
    developingHidden, setDevelopingHidden, developingConversionRate,
    developingCandidatesSeen, developingConverted,
    scanReasons, latestScan,
    isScanning, triggerScan, refresh,
  } = useAppContext();

  const [logTradeOpen, setLogTradeOpen] = useState(false);
  const showSetupsLoader = useMinimumLoading(loading, 450);

  const bestRR = setups.length > 0 ? Math.max(...setups.map(s => s.riskReward)) : 0;
  const rankedSetups = [...setups].sort((a, b) => (b.score ?? b.confidence) - (a.score ?? a.confidence));
  const topSetups = rankedSetups.slice(0, 3);
  const secondarySetups = rankedSetups.slice(3);

  // A closed trade leaves the active list and adds to today's P&L; refresh both.
  const handleTradeRecorded = async () => {
    await Promise.all([refreshDailyPnl(), refresh()]);
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
              <DashboardEmpty reasons={scanReasons} regime={latestScan?.regime.regime ?? null} />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sf-label text-gray-500 mb-2">Top ranked setups</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {topSetups.map(setup => (
                      <SetupCard
                        key={setup.id}
                        setup={setup}
                        priority="high"
                        onClick={() => navigate(`/setup/${setup.id}`, { state: { from: 'dashboard' } })}
                        onDismiss={() => dismissSetup(setup.id)}
                      />
                    ))}
                  </div>
                </div>
                {secondarySetups.length > 0 && (
                  <div>
                    <p className="text-sf-label text-gray-500 mb-2">Secondary setups</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {secondarySetups.map(setup => (
                        <SetupCard
                          key={setup.id}
                          setup={setup}
                          onClick={() => navigate(`/setup/${setup.id}`, { state: { from: 'dashboard' } })}
                          onDismiss={() => dismissSetup(setup.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {developingSetups.length > 0 && !developingHidden && (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel as="h3">Developing Setups (Watchlist)</SectionLabel>
                  <Button type="button" variant="ghost" onClick={() => setDevelopingHidden(true)}>
                    Hide
                  </Button>
                </div>
                <p className="text-sf-field text-gray-500 mb-3">
                  These are non-actionable candidates. They may never trigger; review only as potential watch ideas.
                </p>
                <p className="text-sf-field text-gray-500 mb-3">
                  Conversion tracker: {developingConverted}/{developingCandidatesSeen} converted
                  {developingConversionRate != null ? ` (${developingConversionRate.toFixed(0)}%)` : ''}.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {developingSetups.map((item) => (
                    <div key={`${item.symbol}-${item.strategy}`} className="rounded-xl border border-surface-700 bg-surface-800 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-gray-100">{item.symbol}</p>
                        <span className="text-sf-field text-brand-300">{item.strategy.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sf-field text-gray-400 mt-1">{item.explanation}</p>
                      {item.estimatedEntryZone && (
                        <p className="text-sf-field text-gray-500 mt-1">
                          Est. zone: ${item.estimatedEntryZone[0].toFixed(2)} - ${item.estimatedEntryZone[1].toFixed(2)}
                        </p>
                      )}
                      {item.sessionsSeen != null && (
                        <p className="text-sf-field text-gray-500 mt-1">
                          Sessions tracked: {item.sessionsSeen}/6
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {developingHidden && developingSetups.length > 0 && (
              <div className="mt-6 rounded-xl border border-surface-700 bg-surface-800 p-3 flex items-center justify-between">
                <p className="text-sf-field text-gray-400">
                  Developing setups hidden ({developingSetups.length} available).
                </p>
                <Button type="button" variant="ghost" onClick={() => setDevelopingHidden(false)}>
                  Show
                </Button>
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

function DashboardEmpty({ reasons, regime }: { reasons: string[]; regime: string | null }) {
  return (
    <div className="border border-dashed border-surface-600 rounded-2xl p-12 space-y-4">
      <EmptyState
        icon={BarChart3}
        heading="No active setups"
        subtext='Setups appear after the daily post-close scan. Run "Scan Now" to check the latest close across the market and your watchlist.'
      />
      <div className="max-w-2xl mx-auto bg-surface-800 rounded-xl border border-surface-700 p-4">
        <p className="text-sf-label text-gray-300 mb-2">Why no setups?</p>
        {regime && (
          <p className="text-sf-field text-gray-500 mb-2">
            Current market regime: <span className="text-gray-300">{regime}</span>
          </p>
        )}
        {reasons.length === 0 ? (
          <p className="text-sf-field text-gray-500">No diagnostics yet. Run a new scan for per-symbol reasons.</p>
        ) : (
          <ul className="space-y-1.5 text-sf-field text-gray-400">
            {reasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
