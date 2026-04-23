import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { PriceChart } from '../TradeDetail/PriceChart';
import { SetupCard } from '../Dashboard/SetupCard';
import { PageContainer } from '../ui/PageContainer';
import { SectionLabel } from '../ui/SectionLabel';
import { EmptyState } from '../ui/EmptyState';

export function SymbolDetail() {
  const { sym }    = useParams<{ sym: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { summaries, setups } = useAppContext();

  const fromSource = (location.state as { from?: string } | null)?.from;
  const backLabel  = fromSource === 'dashboard' ? 'Back to Dashboard'
                   : fromSource === 'watchlist' ? 'Back to Watchlist'
                   : 'Back';

  const symbol  = sym?.toUpperCase() ?? '';
  const summary = summaries.find(s => s.symbol === symbol);
  const activeSetups = setups.filter(s => s.symbol === symbol);

  const isPositive = (summary?.changePercent ?? 0) >= 0;

  function rsiClass(rsi: number): string {
    if (rsi >= 70) return 'text-warn-400';
    return 'text-data-neutral';
  }

  return (
    <PageContainer className="space-y-6">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sf-body text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-2xl font-bold text-white font-mono">{symbol}</h2>

          {summary ? (
            <div className="flex flex-wrap items-center gap-5 flex-1">
              <div>
                <div className="text-sf-field text-gray-500 mb-0.5">Price</div>
                <div className="text-sf-value-lg font-mono text-gray-100">
                  ${summary.lastPrice.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sf-field text-gray-500 mb-0.5">Change</div>
                <div
                  className={`text-sf-value-lg font-mono flex items-center gap-1 ${
                    isPositive ? 'text-data-up' : 'text-data-down'
                  }`}
                >
                  {isPositive ? '+' : ''}{summary.changePercent.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sf-field text-gray-500 mb-0.5">RSI</div>
                <div className={`text-sf-value-lg font-mono flex items-center gap-1.5 ${rsiClass(summary.rsi)}`}>
                  {summary.rsi}
                  {summary.rsi >= 70 && (
                    <span className="text-[10px] font-semibold bg-warn-500/15 text-warn-400 px-1.5 py-0.5 rounded-md">OB</span>
                  )}
                  {summary.rsi <= 30 && (
                    <span className="text-[10px] font-semibold bg-surface-600 text-gray-300 px-1.5 py-0.5 rounded-md">OS</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sf-body text-gray-400 flex-1">No market data — refreshes every 60s</span>
          )}
        </div>

        <p className="text-sf-field text-gray-500">
          Run a full watchlist scan from the{' '}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-brand-400 hover:text-brand-300 font-medium"
          >
            Dashboard
          </button>
          .
        </p>
      </div>

      <PriceChart symbol={symbol} setup={null} />

      {activeSetups.length > 0 && (
        <div>
          <SectionLabel>
            Active Setups
            <span className="ml-2 text-gray-500 font-normal">({activeSetups.length})</span>
          </SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeSetups.map(setup => (
              <SetupCard
                key={setup.id}
                setup={setup}
                onClick={() => navigate(`/setup/${setup.id}`)}
                onDismiss={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {activeSetups.length === 0 && (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-10">
          <EmptyState
            icon={BarChart3}
            heading={`No active setups for ${symbol}`}
            subtext="Open the Dashboard and run Scan Now to detect opportunities across your watchlist."
          />
        </div>
      )}
    </PageContainer>
  );
}
