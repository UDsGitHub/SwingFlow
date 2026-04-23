import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MarketSummary } from '../../types';
import { Tooltip } from '../ui/Tooltip';

interface MarketSummaryPanelProps {
  summaries: MarketSummary[];
  loading: boolean;
  lastUpdated: Date | null;
  onSymbolClick: (symbol: string) => void;
}

const RSI_TOOLTIP = 'RSI (Relative Strength Index): above 70 = overbought, below 30 = oversold. Normal range: 30–70.';

export function MarketSummaryPanel({ summaries, loading, lastUpdated, onSymbolClick }: MarketSummaryPanelProps) {
  return (
    <div id="tour-market" className="bg-surface-800 rounded-2xl border border-surface-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 tracking-wide">Market Overview</p>
        {lastUpdated && (
          <span className="text-xs text-gray-400 tabular-nums">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-surface-700 animate-pulse rounded-xl h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {summaries.map(s => (
            <button
              key={s.symbol}
              onClick={() => onSymbolClick(s.symbol)}
              className="bg-surface-700 hover:bg-surface-600 rounded-xl p-2.5 text-center transition-colors group"
            >
              <div className="text-sm font-bold text-gray-300 group-hover:text-white mb-1 transition-colors">
                {s.symbol}
              </div>
              <div className={`text-base font-mono font-bold ${s.changePercent >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>
                {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <TrendIcon trend={s.trend} />
                <Tooltip content={RSI_TOOLTIP} width="w-60">
                  <span className={`text-xs tabular-nums ${
                    s.rsi < 30 ? 'text-bear-400' :
                    s.rsi > 70 ? 'text-warn-400' :
                    'text-gray-400'
                  }`}>
                    {s.rsi}
                  </span>
                </Tooltip>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'UP' | 'DOWN' | 'NEUTRAL' }) {
  if (trend === 'UP')   return <TrendingUp  size={11} className="text-bull-400" />;
  if (trend === 'DOWN') return <TrendingDown size={11} className="text-bear-400" />;
  return <Minus size={11} className="text-gray-400" />;
}
