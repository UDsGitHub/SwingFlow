import { useLayoutEffect, useRef } from 'react';
import { X, Info } from 'lucide-react';
import { gsap } from 'gsap';
import { TradeSetup } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

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

/** Strategy tags are categorical, not P&L — keep neutral (no accent on chips) */
const STRATEGY_CHIP = 'text-gray-300 bg-surface-700/90 border border-surface-600';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (!cardRef.current || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 10, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.34,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        },
      );
    }, cardRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, setup.id]);

  const confidenceStripe =
    setup.confidence >= 80 ? 'bg-data-up' :
    setup.confidence >= 65 ? 'bg-data-neutral' :
    'bg-surface-500';

  const signals = SIGNAL_BREAKDOWN[setup.strategy] ?? [];

  const confidenceTooltip = (
    <div>
      <p className="font-semibold text-white mb-1.5">{setup.confidence}% confidence</p>
      <ul className="space-y-1 mb-2">
        {signals.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-gray-500 flex-shrink-0" />
            {s}
          </li>
        ))}
      </ul>
      <p className="text-gray-400 border-t border-surface-600 pt-1.5">{confidenceLabel(setup.confidence)}</p>
    </div>
  );

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="group relative bg-surface-800 rounded-2xl border border-surface-700 hover:border-surface-500 sf-motion-surface cursor-pointer overflow-hidden hover:-translate-y-0.5"
    >
      <div className={`absolute top-0 left-0 h-0.5 ${confidenceStripe}`} style={{ width: `${setup.confidence}%` }} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-sf-value-lg text-white font-mono tracking-tight">{setup.symbol}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>
                {STRATEGY_LABELS[setup.strategy]}
              </span>
              <span className="text-sf-field text-data-neutral">{setup.direction}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-surface-700 transition-colors opacity-0 group-hover:opacity-100"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <PriceLevel label="Entry"  value={setup.entry}  valueClass="text-gray-100" />
          <PriceLevel label="Stop"   value={setup.stop}   valueClass="text-data-down" />
          <PriceLevel label="Target" value={setup.target} valueClass="text-data-up" />
        </div>

        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1 text-sf-field text-gray-500"
            onClick={e => e.stopPropagation()}
          >
            <Tooltip content={confidenceTooltip} width="w-64">
              <span className="flex items-center gap-1 cursor-help">
                {setup.confidence}% confidence
                <Info size={11} className="text-gray-500" />
              </span>
            </Tooltip>
          </span>
          <span className="font-mono text-sf-label text-data-neutral">{setup.riskReward}:1</span>
          <span className="text-sf-field text-gray-500">
            {setup.stockSuggestion?.shares > 0 ? `${setup.stockSuggestion.shares} sh` : ''}
          </span>
        </div>
      </div>

      {setup.notes && (
        <div className="px-4 pb-3 border-t border-surface-700">
          <p className="text-sf-body italic pt-2 leading-relaxed">{setup.notes}</p>
        </div>
      )}
    </div>
  );
}

function PriceLevel({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
  return (
    <div>
      <div className="text-sf-field text-gray-500 mb-0.5">{label}</div>
      <div
        className={`font-mono font-semibold text-[1.125rem] leading-[1.5rem] xl:text-[1rem] xl:leading-5 2xl:text-[1.125rem] 2xl:leading-[1.5rem] ${valueClass}`}
      >
        ${value.toFixed(2)}
      </div>
    </div>
  );
}
