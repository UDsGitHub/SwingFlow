import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { useSetupDetail } from '../../hooks/useSetups';
import { useAppContext } from '../../context/AppContext';
import { PriceChart } from './PriceChart';
import { TradePlan } from './TradePlan';
import { OptionsPanel } from './OptionsPanel';
import { PaperRecordPanel } from './PaperRecordPanel';
import { PositionPanel } from './PositionPanel';
import { useRefreshTrades } from '../../hooks/useTrades';
import { TONE_BADGE, paperStatus } from '../../lib/setupDisplay';
import { PageContainer } from '../ui/PageContainer';
import { BrandedLoader } from '../ui/BrandedLoader';
import { useMinimumLoading } from '../../hooks/useMinimumLoading';

const STRATEGY_CHIP = 'text-gray-200 bg-surface-700/80 border border-surface-600';

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
  const { summaries } = useAppContext();
  const { setup, loading, error, refetch } = useSetupDetail(id ?? '');
  const showDetailLoader = useMinimumLoading(loading, 450);
  const refreshTrades = useRefreshTrades();

  const handlePositionChanged = async () => {
    await Promise.all([refetch(), refreshTrades()]);
  };

  const fromSource = (location.state as { from?: string } | null)?.from;
  const backLabel  = fromSource && FROM_LABELS[fromSource]
    ? `Back to ${FROM_LABELS[fromSource]}`
    : 'Back';

  if (showDetailLoader) {
    return (
      <PageContainer>
        <BrandedLoader
          message="Loading setup details…"
          subtext="Preparing chart and trade plan"
          className="min-h-[20rem]"
        />
      </PageContainer>
    );
  }

  if (error || !setup) {
    return (
      <PageContainer className="text-center py-16">
        <p className="text-sf-body text-gray-400 mb-4">Setup not found.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-medium text-brand-400 hover:text-brand-300"
        >
          Back to Dashboard
        </button>
      </PageContainer>
    );
  }

  const marketSummary  = summaries.find(s => s.symbol === setup.symbol);
  const currentPrice   = marketSummary?.lastPrice ?? null;
  const aboveEntry     = currentPrice !== null ? currentPrice > setup.entry : null;

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

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-white font-mono">{setup.symbol}</h2>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <span className={`text-sf-field font-semibold px-2.5 py-1 rounded-lg ${STRATEGY_CHIP}`}>
              {STRATEGY_LABELS[setup.strategy]}
            </span>

            <span className="text-sf-field text-data-neutral border border-surface-600 px-2 py-0.5 rounded-md">
              {setup.direction}
            </span>
            <span className={`text-sf-field px-2 py-0.5 rounded-md ${TONE_BADGE[paperStatus(setup).tone]}`}>
              {paperStatus(setup).label}
            </span>

            {currentPrice !== null && (
              <div
                className={`flex items-center gap-1 text-sf-value font-mono ${
                  aboveEntry ? 'text-data-up' : 'text-data-down'
                }`}
              >
                {aboveEntry
                  ? <ArrowUp size={13} className="flex-shrink-0" />
                  : <ArrowDown size={13} className="flex-shrink-0" />
                }
                ${currentPrice.toFixed(2)}
              </div>
            )}
            </div>
        </div>
      </div>

      <div id="tour-chart">
        <PriceChart symbol={setup.symbol} setup={setup} />
      </div>

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
          <PositionPanel setup={setup} onChanged={handlePositionChanged} />
          <PaperRecordPanel setup={setup} />
        </div>
      </div>
    </PageContainer>
  );
}
