import { TrendingUp, Rocket, RotateCcw } from 'lucide-react';
import { TradeSetup } from '../../types';

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

export function TradePlan({ setup }: TradePlanProps) {
  const info = STRATEGY_INFO[setup.strategy];
  const risk   = setup.entry - setup.stop;
  const reward = setup.target - setup.entry;
  const { stockSuggestion: stock } = setup;

  return (
    <div className="space-y-4">
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        {/* Strategy header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0">
            <info.Icon size={16} className="text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{info?.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{info?.description}</p>
          </div>
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <PriceBox label="Entry"     value={setup.entry}  color="text-brand-400" accent="border-brand-500/20 bg-brand-500/5" />
          <PriceBox label="Stop Loss" value={setup.stop}   color="text-bear-400"  accent="border-bear-500/20 bg-bear-500/5" />
          <PriceBox label="Target"    value={setup.target} color="text-bull-400"  accent="border-bull-500/20 bg-bull-500/5" />
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Risk/Share"   value={`$${risk.toFixed(2)}`} />
          <Metric label="Reward/Share" value={`$${reward.toFixed(2)}`} highlight />
          <Metric label="R/R Ratio"    value={`${setup.riskReward}:1`} highlight />
        </div>
      </div>

      {stock && stock.shares > 0 && (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Stock Position</h4>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Metric label="Shares"           value={String(stock.shares)} />
            <Metric label="Capital Required" value={`$${stock.capitalRequired.toLocaleString()}`} />
            <Metric label="Max Risk"         value={`$${stock.riskDollars.toFixed(0)}`} warn />
            <Metric label="Potential Gain"   value={`$${stock.potentialGainDollars.toFixed(0)}`} highlight />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Trade Checklist</p>
            {[
              `Confirm ${setup.symbol} is above EMA 20 and EMA 50`,
              `Set stop at $${setup.stop} — hard stop, no exceptions`,
              `Target $${setup.target} — consider partial exit at 1.5R`,
              `Position: ${stock.shares} shares at $${setup.entry.toFixed(2)}`,
              'Check overall market trend before entry',
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-surface-600 bg-surface-700 text-brand-500 flex-shrink-0"
                />
                <span className="text-xs text-gray-500 group-hover:text-gray-400 leading-relaxed">{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {setup.notes && (
        <div className="bg-surface-700/40 rounded-xl p-3 border border-surface-700">
          <p className="text-xs text-gray-500 italic leading-relaxed">{setup.notes}</p>
        </div>
      )}
    </div>
  );
}

function PriceBox({ label, value, color, accent }: {
  label: string; value: number; color: string; accent: string;
}) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent}`}>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`text-base font-bold font-mono ${color}`}>${value.toFixed(2)}</div>
    </div>
  );
}

function Metric({ label, value, highlight, warn }: {
  label: string; value: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className="bg-surface-700 rounded-xl p-3">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${warn ? 'text-bear-400' : highlight ? 'text-bull-400' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
