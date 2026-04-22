import { TradeSetup } from '../../types';
import { PriceChart } from './PriceChart';
import { TradePlan } from './TradePlan';
import { OptionsPanel } from './OptionsPanel';

interface TradeDetailProps {
  setup: TradeSetup;
  onBack: () => void;
}

const STRATEGY_BADGE: Record<string, string> = {
  TREND_PULLBACK: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  BREAKOUT:       'bg-warn-500/20 text-warn-400 border-warn-500/30',
  REVERSAL:       'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export function TradeDetail({ setup, onBack }: TradeDetailProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
          aria-label="Back"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white font-mono">{setup.symbol}</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STRATEGY_BADGE[setup.strategy]}`}>
            {setup.strategy.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-500">{setup.direction}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-500">Confidence</div>
            <div className="text-lg font-bold font-mono text-warn-400">{setup.confidence}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">R/R Ratio</div>
            <div className="text-lg font-bold font-mono text-bull-400">{setup.riskReward}:1</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <PriceChart symbol={setup.symbol} setup={setup} />

      {/* Trade plan + Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TradePlan setup={setup} />
        <OptionsPanel suggestion={setup.optionsSuggestion} symbol={setup.symbol} />
      </div>
    </div>
  );
}
