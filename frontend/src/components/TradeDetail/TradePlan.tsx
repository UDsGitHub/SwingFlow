import { TradeSetup } from '../../types';

interface TradePlanProps {
  setup: TradeSetup;
}

const STRATEGY_INFO: Record<string, { name: string; description: string; icon: string }> = {
  TREND_PULLBACK: {
    name: 'Trend Pullback',
    icon: '📈',
    description: 'Stock in uptrend pulled back to EMA support. Buy the dip with trend.',
  },
  BREAKOUT: {
    name: 'Breakout',
    icon: '🚀',
    description: 'Consolidation base with volume-confirmed breakout above resistance.',
  },
  REVERSAL: {
    name: 'Oversold Reversal',
    icon: '🔄',
    description: 'Deeply oversold (RSI < 35) with bullish reversal candle at support.',
  },
};

export function TradePlan({ setup }: TradePlanProps) {
  const info = STRATEGY_INFO[setup.strategy];
  const risk = setup.entry - setup.stop;
  const reward = setup.target - setup.entry;
  const { stockSuggestion: stock } = setup;

  return (
    <div className="space-y-4">
      {/* Strategy overview */}
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">{info?.icon}</span>
          <div>
            <h3 className="font-semibold text-white">{info?.name}</h3>
            <p className="text-sm text-gray-400 mt-0.5">{info?.description}</p>
          </div>
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <PriceBox label="Entry" value={setup.entry} color="text-brand-400" bg="bg-brand-500/10 border-brand-500/20" />
          <PriceBox label="Stop Loss" value={setup.stop} color="text-bear-400" bg="bg-bear-500/10 border-bear-500/20" />
          <PriceBox label="Target" value={setup.target} color="text-bull-400" bg="bg-bull-500/10 border-bull-500/20" />
        </div>

        {/* Risk metrics */}
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Risk/Share" value={`$${risk.toFixed(2)}`} />
          <Metric label="Reward/Share" value={`$${reward.toFixed(2)}`} highlight />
          <Metric label="R/R Ratio" value={`${setup.riskReward}:1`} highlight />
        </div>
      </div>

      {/* Stock position sizing */}
      {stock && stock.shares > 0 && (
        <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Stock Position</h4>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Shares" value={String(stock.shares)} />
            <Metric label="Capital Required" value={`$${stock.capitalRequired.toLocaleString()}`} />
            <Metric label="Max Risk" value={`$${stock.riskDollars.toFixed(0)}`} warn />
            <Metric label="Potential Gain" value={`$${stock.potentialGainDollars.toFixed(0)}`} highlight />
          </div>

          {/* Checklist */}
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Trade Checklist</div>
            {[
              `Confirm ${setup.symbol} is above EMA 20 and EMA 50`,
              `Set stop at $${setup.stop} (hard stop, no exceptions)`,
              `Target $${setup.target} — consider partial exit at 1.5R`,
              `Position size: ${stock.shares} shares at $${setup.entry.toFixed(2)}`,
              'Check overall market trend before entry',
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-2 cursor-pointer group">
                <input type="checkbox" className="mt-0.5 rounded border-surface-600 bg-surface-700 text-brand-500" />
                <span className="text-xs text-gray-400 group-hover:text-gray-300">{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {setup.notes && (
        <div className="bg-surface-700/50 rounded-lg p-3 border border-surface-600">
          <p className="text-xs text-gray-400 italic">{setup.notes}</p>
        </div>
      )}
    </div>
  );
}

function PriceBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${bg}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-base font-bold font-mono ${color}`}>${value.toFixed(2)}</div>
    </div>
  );
}

function Metric({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="bg-surface-700 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${warn ? 'text-bear-400' : highlight ? 'text-bull-400' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
