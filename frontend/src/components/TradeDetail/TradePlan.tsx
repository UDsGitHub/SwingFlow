import { useState } from 'react';
import { TrendingUp, Rocket, RotateCcw, Check } from 'lucide-react';
import { TradeSetup } from '../../types';
import { SectionLabel } from '../ui/SectionLabel';

interface TradePlanProps {
  setup: TradeSetup;
}

const STRATEGY_INFO: Record<string, { name: string; description: string; Icon: React.ElementType }> = {
  TREND_PULLBACK: {
    name:        'Trend Pullback',
    Icon:        TrendingUp,
    description: 'Stock in uptrend pulled back to EMA support. Buy the dip with trend.',
  },
  BREAKOUT: {
    name:        'Breakout',
    Icon:        Rocket,
    description: 'Consolidation base with volume-confirmed breakout above resistance.',
  },
  REVERSAL: {
    name:        'Oversold Reversal',
    Icon:        RotateCcw,
    description: 'Deeply oversold (RSI < 35) with bullish reversal candle at support.',
  },
};

function loadChecklist(setupId: string, count: number): boolean[] {
  try {
    const raw = localStorage.getItem(`swingflow_checklist_${setupId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as boolean[];
      if (Array.isArray(parsed) && parsed.length === count) return parsed;
    }
  } catch { /* ignore */ }
  return Array(count).fill(false);
}

export function TradePlan({ setup }: TradePlanProps) {
  const info   = STRATEGY_INFO[setup.strategy];
  const risk   = setup.entry - setup.stop;
  const reward = setup.target - setup.entry;
  const { stockSuggestion: stock } = setup;

  const checklistItems = stock && stock.shares > 0 ? [
    `Confirm ${setup.symbol} is above EMA 20 and EMA 50`,
    `Set stop at $${setup.stop} — hard stop, no exceptions`,
    `Target $${setup.target} — consider partial exit at 1.5R`,
    `Position: ${stock.shares} shares at $${setup.entry.toFixed(2)}`,
    'Check overall market trend before entry',
  ] : [];

  const [checked, setChecked] = useState<boolean[]>(() =>
    loadChecklist(setup.id, checklistItems.length),
  );

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = prev.map((v, idx) => idx === i ? !v : v);
      try {
        localStorage.setItem(`swingflow_checklist_${setup.id}`, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const allChecked = checklistItems.length > 0 && checked.every(Boolean);

  return (
    <div className="space-y-4">
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0">
            <info.Icon size={16} className="text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sf-body">{info?.name}</h3>
            <p className="text-sf-body mt-0.5 leading-relaxed">{info?.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <PriceBox label="Entry"     value={setup.entry}  valueClass="text-gray-100"  accent="border-surface-600 bg-surface-700/50" />
          <PriceBox label="Stop Loss" value={setup.stop}   valueClass="text-data-down" accent="border-bear-500/20 bg-bear-500/5" />
          <PriceBox label="Target"    value={setup.target} valueClass="text-data-up"   accent="border-bull-500/20 bg-bull-500/5" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Risk/Share"   value={`$${risk.toFixed(2)}`}   valueClass="text-data-down" />
          <Metric label="Reward/Share" value={`$${reward.toFixed(2)}`} valueClass="text-data-up" />
          <Metric label="R/R Ratio"    value={`${setup.riskReward}:1`} valueClass="text-data-neutral" />
          <Metric label="Confidence"   value={`${setup.confidence}%`}  valueClass="text-data-neutral" />
        </div>

        {setup.notes && (
          <div className="mt-4 pt-4 border-t border-surface-700">
            <SectionLabel as="p" noMargin className="mb-2">
              Signal Summary
            </SectionLabel>
            <p className="text-sf-body italic leading-relaxed">{setup.notes}</p>
          </div>
        )}
      </div>

      {stock && stock.shares > 0 && (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <SectionLabel as="h3">Stock Position</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Metric label="Shares"           value={String(stock.shares)} valueClass="text-gray-100" />
            <Metric label="Capital Required" value={`$${stock.capitalRequired.toLocaleString()}`} valueClass="text-gray-100" />
            <Metric label="Max Risk"         value={`$${stock.riskDollars.toFixed(0)}`} valueClass="text-data-down" />
            <Metric label="Potential Gain"   value={`$${stock.potentialGainDollars.toFixed(0)}`} valueClass="text-data-up" />
          </div>

          <div className="space-y-1.5">
            <SectionLabel as="p" noMargin className="mb-3">Trade Checklist</SectionLabel>
            {checklistItems.map((item, i) => (
              <CheckboxItem
                key={i}
                label={item}
                checked={checked[i]}
                onChange={() => toggle(i)}
              />
            ))}
            {allChecked && (
              <p className="text-sf-field text-data-up pt-1.5 flex items-center gap-1.5">
                <Check size={11} /> All checks passed — ready to trade
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full flex items-start gap-3 text-left group py-1.5 px-2 rounded-lg hover:bg-surface-700/50 transition-colors"
    >
      <span
        className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
          checked
            ? 'bg-brand-500 border-brand-500'
            : 'border-surface-500 bg-surface-700 group-hover:border-surface-400'
        }`}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </span>
      <span className={`text-sf-body leading-relaxed transition-colors ${
        checked ? 'text-gray-500 line-through' : 'text-gray-400'
      }`}>
        {label}
      </span>
    </button>
  );
}

function PriceBox({ label, value, valueClass, accent }: {
  label: string; value: number; valueClass: string; accent: string;
}) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent}`}>
      <div className="text-sf-field text-gray-500 mb-1">{label}</div>
      <div className={`text-sf-value font-mono ${valueClass}`}>${value.toFixed(2)}</div>
    </div>
  );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3">
      <div className="text-sf-field text-gray-500 mb-1">{label}</div>
      <div className={`text-sf-value font-mono ${valueClass}`}>{value}</div>
    </div>
  );
}
