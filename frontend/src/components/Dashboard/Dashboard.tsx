import { useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { GoalTracker } from './GoalTracker';
import { SetupCard } from './SetupCard';
import { MarketSummaryPanel } from './MarketSummary';

export function Dashboard() {
  const navigate = useNavigate();
  const {
    setups, summaries, summariesLoading, loading, lastUpdated,
    accountSize, dailyGoal, dismissSetup,
  } = useAppContext();

  const bestRR = setups.length > 0 ? Math.max(...setups.map(s => s.riskReward)) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <MarketSummaryPanel
        summaries={summaries}
        loading={summariesLoading}
        onSymbolClick={() => navigate('/watchlist')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <GoalTracker
            dailyGoal={dailyGoal}
            accountSize={accountSize}
            setupCount={setups.length}
            bestRR={bestRR}
          />
        </div>

        <div id="tour-setups" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">
              Active Setups
              {setups.length > 0 && (
                <span className="ml-2 text-gray-400">({setups.length})</span>
              )}
            </h2>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface-800 animate-pulse rounded-2xl h-52 border border-surface-700" />
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
                  onClick={() => navigate(`/setup/${setup.id}`)}
                  onDismiss={() => dismissSetup(setup.id)}
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
    <div className="border border-dashed border-surface-600 rounded-2xl p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
        <BarChart3 size={22} className="text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-300 mb-1">No active setups</h3>
      <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
        Click "Scan Now" to run the strategy engine and find high-probability setups in your watchlist.
      </p>
    </div>
  );
}
