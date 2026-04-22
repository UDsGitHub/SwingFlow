import { TradeSetup } from '../../types';

interface SetupCardProps {
  setup: TradeSetup;
  onClick: () => void;
  onDismiss: () => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT: 'Breakout',
  REVERSAL: 'Reversal',
};

const STRATEGY_COLORS: Record<string, string> = {
  TREND_PULLBACK: 'text-brand-400 bg-brand-500/10 border-brand-500/30',
  BREAKOUT:       'text-warn-400 bg-warn-500/10 border-warn-500/30',
  REVERSAL:       'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-bull-500' : value >= 65 ? 'bg-warn-500' : 'bg-brand-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right">{value}%</span>
    </div>
  );
}

export function SetupCard({ setup, onClick, onDismiss }: SetupCardProps) {
  const risk = setup.entry - setup.stop;
  const reward = setup.target - setup.entry;

  return (
    <div
      className="bg-surface-800 rounded-xl border border-surface-600 hover:border-brand-500/40 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white font-mono">{setup.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STRATEGY_COLORS[setup.strategy]}`}>
              {STRATEGY_LABELS[setup.strategy]}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="text-gray-600 hover:text-gray-400 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100"
            title="Dismiss"
          >
            ×
          </button>
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <PriceLevel label="Entry" value={setup.entry} className="text-brand-400" />
          <PriceLevel label="Stop"  value={setup.stop}  className="text-bear-400" />
          <PriceLevel label="Target" value={setup.target} className="text-bull-400" />
        </div>

        {/* Confidence */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Confidence</span>
          </div>
          <ConfidenceBar value={setup.confidence} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>R/R <span className="text-warn-400 font-mono font-bold">{setup.riskReward}:1</span></span>
          <span className="text-gray-600">
            {setup.stockSuggestion?.shares > 0 && `${setup.stockSuggestion.shares} shares`}
            {setup.optionsSuggestion && ` · ${setup.optionsSuggestion.contracts} ${setup.optionsSuggestion.type}s`}
          </span>
          <span className="text-gray-600">{setup.direction}</span>
        </div>
      </div>

      {/* Notes */}
      {setup.notes && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 italic border-t border-surface-700 pt-2">{setup.notes}</p>
        </div>
      )}
    </div>
  );
}

function PriceLevel({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="bg-surface-700 rounded-lg p-2 text-center">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono ${className}`}>${value.toFixed(2)}</div>
    </div>
  );
}
