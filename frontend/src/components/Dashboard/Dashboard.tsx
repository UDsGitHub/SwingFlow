import { TradeSetup, MarketSummary } from '../../types';
import { GoalTracker } from './GoalTracker';
import { SetupCard } from './SetupCard';
import { MarketSummaryPanel } from './MarketSummary';

interface DashboardProps {
  setups: TradeSetup[];
  summaries: MarketSummary[];
  summariesLoading: boolean;
  loading: boolean;
  lastUpdated: Date | null;
  accountSize: number;
  dailyGoal: number;
  onSetupClick: (setup: TradeSetup) => void;
  onDismissSetup: (id: string) => void;
  onSymbolClick: (symbol: string) => void;
}

export function Dashboard({
  setups, summaries, summariesLoading, loading, lastUpdated,
  accountSize, dailyGoal, onSetupClick, onDismissSetup, onSymbolClick,
}: DashboardProps) {
  const bestRR = setups.length > 0 ? Math.max(...setups.map(s => s.riskReward)) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Market overview */}
      <MarketSummaryPanel
        summaries={summaries}
        loading={summariesLoading}
        onSymbolClick={onSymbolClick}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Goal tracker */}
        <div className="lg:col-span-1">
          <GoalTracker
            dailyGoal={dailyGoal}
            accountSize={accountSize}
            setupCount={setups.length}
            bestRR={bestRR}
          />
        </div>

        {/* Setups grid */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Active Setups
              {setups.length > 0 && (
                <span className="ml-2 text-sm text-gray-500">({setups.length})</span>
              )}
            </h2>
            {lastUpdated && (
              <span className="text-xs text-gray-600">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface-800 animate-pulse rounded-xl h-48 border border-surface-600" />
              ))}
            </div>
          ) : setups.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {setups.map(setup => (
                <SetupCard
                  key={setup.id}
                  setup={setup}
                  onClick={() => onSetupClick(setup)}
                  onDismiss={() => onDismissSetup(setup.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface-800 border border-surface-600 border-dashed rounded-xl p-10 text-center">
      <div className="text-4xl mb-3">📊</div>
      <h3 className="text-white font-semibold mb-1">No active setups</h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto">
        Click "Scan Now" to run the strategy engine and find high-probability trade setups in your watchlist.
      </p>
    </div>
  );
}
