import { X, Info } from 'lucide-react';
import { TradeSetup } from '../../types';
import { Tooltip } from '../ui/Tooltip';

interface SetupCardProps {
  setup: TradeSetup;
  onClick: () => void;
  onDismiss: () => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const STRATEGY_COLORS: Record<string, string> = {
  TREND_PULLBACK: 'text-brand-400 bg-brand-500/10',
  BREAKOUT:       'text-warn-400 bg-warn-500/10',
  REVERSAL:       'text-purple-400 bg-purple-500/10',
};

const SIGNAL_BREAKDOWN: Record<string, string[]> = {
  TREND_PULLBACK: ['Price above EMA 20 & EMA 50', 'Pullback to EMA support', 'RSI mid-range (momentum intact)'],
  BREAKOUT:       ['Consolidation base formed', 'Volume surge on breakout', 'Close above resistance'],
  REVERSAL:       ['RSI below 35 (oversold)', 'Bullish reversal candle at support', 'Volume above average'],
};

function confidenceLabel(c: number) {
  if (c >= 80) return 'Strong confirmation across all signals';
  if (c >= 65) return 'Partial confirmation — moderate risk';
  return 'Developing pattern — higher risk';
}

export function SetupCard({ setup, onClick, onDismiss }: SetupCardProps) {
  const confidenceColor =
    setup.confidence >= 80 ? 'bg-bull-500' :
    setup.confidence >= 65 ? 'bg-warn-500' : 'bg-brand-500';

  const signals = SIGNAL_BREAKDOWN[setup.strategy] ?? [];

  const confidenceTooltip = (
    <div>
      <p className="font-semibold text-white mb-1.5">{setup.confidence}% confidence</p>
      <ul className="space-y-1 mb-2">
        {signals.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-brand-400 flex-shrink-0" />
            {s}
          </li>
        ))}
      </ul>
      <p className="text-gray-400 border-t border-surface-600 pt-1.5">{confidenceLabel(setup.confidence)}</p>
    </div>
  );

  return (
    // overflow-visible so tooltip escapes the card; stripe container handles its own clipping
    <div
      onClick={onClick}
      className="group relative bg-surface-800 rounded-2xl border border-surface-700 hover:border-surface-500 transition-all cursor-pointer"
    >
      {/* Confidence stripe — clipped by its own container, not the card */}
      <div className="rounded-t-2xl overflow-hidden">
        <div className={`h-0.5 ${confidenceColor}`} style={{ width: `${setup.confidence}%` }} />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-lg font-bold text-white font-mono tracking-tight">{setup.symbol}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STRATEGY_COLORS[setup.strategy]}`}>
                {STRATEGY_LABELS[setup.strategy]}
              </span>
              <span className="text-xs text-gray-400">{setup.direction}</span>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-surface-700 transition-colors opacity-0 group-hover:opacity-100"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* Price levels — larger values for clear hierarchy */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <PriceLevel label="Entry"  value={setup.entry}  color="text-gray-200" />
          <PriceLevel label="Stop"   value={setup.stop}   color="text-bear-400" />
          <PriceLevel label="Target" value={setup.target} color="text-bull-400" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1 text-xs text-gray-400"
            onClick={e => e.stopPropagation()}
          >
            <Tooltip content={confidenceTooltip} width="w-64">
              <span className="flex items-center gap-1 cursor-help">
                {setup.confidence}% confidence
                <Info size={11} className="text-gray-500" />
              </span>
            </Tooltip>
          </span>
          <span className="font-mono text-xs font-semibold text-warn-400">{setup.riskReward}:1</span>
          <span className="text-xs text-gray-400">
            {setup.stockSuggestion?.shares > 0 ? `${setup.stockSuggestion.shares} sh` : ''}
          </span>
        </div>
      </div>

      {setup.notes && (
        <div className="px-4 pb-3 border-t border-surface-700">
          <p className="text-xs text-gray-400 italic pt-2 leading-relaxed">{setup.notes}</p>
        </div>
      )}
    </div>
  );
}

function PriceLevel({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`text-base font-bold font-mono ${color}`}>${value.toFixed(2)}</div>
    </div>
  );
}
