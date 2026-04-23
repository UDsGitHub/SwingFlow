import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSetupDetail } from '../../hooks/useSetups';
import { PriceChart } from './PriceChart';
import { TradePlan } from './TradePlan';
import { OptionsPanel } from './OptionsPanel';

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

export function TradeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setup, loading, error } = useSetupDetail(id ?? '');

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
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
      <div className="max-w-6xl mx-auto text-center py-16">
        <p className="text-gray-500 mb-4">Setup not found.</p>
        <button
          onClick={() => navigate('/')}
          className="text-brand-400 hover:text-brand-300 text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-center gap-3 flex-1">
          <h2 className="text-2xl font-bold text-white font-mono">{setup.symbol}</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${STRATEGY_BADGE[setup.strategy]}`}>
            {STRATEGY_LABELS[setup.strategy]}
          </span>
          <span className="text-xs text-gray-600 border border-surface-600 px-2 py-0.5 rounded-md">
            {setup.direction}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-600 mb-0.5">Confidence</div>
            <div className="text-lg font-bold font-mono text-warn-400">{setup.confidence}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-600 mb-0.5">R/R Ratio</div>
            <div className="text-lg font-bold font-mono text-bull-400">{setup.riskReward}:1</div>
          </div>
        </div>
      </div>

      <PriceChart symbol={setup.symbol} setup={setup} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TradePlan setup={setup} />
        <OptionsPanel suggestion={setup.optionsSuggestion} symbol={setup.symbol} />
      </div>
    </div>
  );
}
