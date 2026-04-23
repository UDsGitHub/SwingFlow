import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { useSetupDetail } from '../../hooks/useSetups';
import { useAppContext } from '../../context/AppContext';
import { PriceChart } from './PriceChart';
import { TradePlan } from './TradePlan';
import { OptionsPanel } from './OptionsPanel';
import { CloseTradeForm } from './CloseTradeForm';

const STRATEGY_BADGE: Record<string, string> = {
  TREND_PULLBACK: 'bg-brand-500/15 text-brand-400',
  BREAKOUT:       'bg-warn-500/15 text-warn-400',
  REVERSAL:       'bg-purple-500/15 text-purple-400',
};

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const FROM_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  history:   'History',
  watchlist: 'Watchlist',
};

export function TradeDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { refreshDailyPnl, summaries } = useAppContext();
  const { setup, loading, error, refetch } = useSetupDetail(id ?? '');

  const handleClosed = async () => {
    await refetch();
    await refreshDailyPnl();
  };

  // Context-aware back label from navigation state
  const fromSource = (location.state as { from?: string } | null)?.from;
  const backLabel  = fromSource && FROM_LABELS[fromSource]
    ? `Back to ${FROM_LABELS[fromSource]}`
    : 'Back';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="h-10 bg-surface-800 animate-pulse rounded-xl w-48" />
        <div className="h-72 bg-surface-800 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-64 bg-surface-800 animate-pulse rounded-2xl" />
          <div className="h-64 bg-surface-800 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !setup) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <p className="text-gray-400 mb-4">Setup not found.</p>
        <button
          onClick={() => navigate('/')}
          className="text-brand-400 hover:text-brand-300 text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Live price from AppContext market summaries
  const marketSummary  = summaries.find(s => s.symbol === setup.symbol);
  const currentPrice   = marketSummary?.lastPrice ?? null;
  const aboveEntry     = currentPrice !== null ? currentPrice > setup.entry : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-white font-mono">{setup.symbol}</h2>

          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${STRATEGY_BADGE[setup.strategy]}`}>
            {STRATEGY_LABELS[setup.strategy]}
          </span>

          <span className="text-xs text-gray-400 border border-surface-600 px-2 py-0.5 rounded-md">
            {setup.direction}
          </span>

          {/* Live price with direction indicator */}
          {currentPrice !== null && (
            <div className={`flex items-center gap-1 text-sm font-mono font-bold ${
              aboveEntry ? 'text-bull-400' : 'text-bear-400'
            }`}>
              {aboveEntry
                ? <ArrowUp size={13} className="flex-shrink-0" />
                : <ArrowDown size={13} className="flex-shrink-0" />
              }
              ${currentPrice.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div id="tour-chart">
        <PriceChart symbol={setup.symbol} setup={setup} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div id="tour-trade-plan">
          <TradePlan setup={setup} />
        </div>
        <div className="space-y-6">
          <div id="tour-options">
            <OptionsPanel
              suggestion={setup.optionsSuggestion}
              symbol={setup.symbol}
              target={setup.target}
            />
          </div>
          <CloseTradeForm setup={setup} onClosed={handleClosed} />
        </div>
      </div>
    </div>
  );
}
