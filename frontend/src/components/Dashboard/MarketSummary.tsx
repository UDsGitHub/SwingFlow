import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MarketSummary } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { SectionLabel } from '../ui/SectionLabel';

interface MarketSummaryPanelProps {
  summaries: MarketSummary[];
  loading: boolean;
  lastUpdated: Date | null;
  onSymbolClick: (symbol: string) => void;
}

const RSI_TOOLTIP = 'RSI (Relative Strength Index): above 70 = overbought, below 30 = oversold. Normal range: 30–70.';

function rsiTextClass(rsi: number): string {
  if (rsi >= 70) return 'text-warn-400';
  return 'text-data-neutral';
}

export function MarketSummaryPanel({ summaries, loading, lastUpdated, onSymbolClick }: MarketSummaryPanelProps) {
  return (
    <div id="tour-market" className="bg-surface-800 rounded-2xl border border-surface-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel as="p" noMargin className="mb-0">
          Market Overview
        </SectionLabel>
        {lastUpdated && (
          <span className="text-sf-field text-gray-500 tabular-nums">
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
              <div className="text-sf-label font-semibold text-gray-300 group-hover:text-white mb-1 transition-colors">
                {s.symbol}
              </div>
              <div
                className={`text-sf-value font-mono ${
                  s.changePercent >= 0 ? 'text-data-up' : 'text-data-down'
                }`}
              >
                {s.changePercent >= 0 ? '+' : ''}
                {s.changePercent.toFixed(2)}%
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <TrendIcon trend={s.trend} />
                <Tooltip content={RSI_TOOLTIP} width="w-60">
                  <span className={`text-sf-field font-mono tabular-nums ${rsiTextClass(s.rsi)}`}>{s.rsi}</span>
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
  if (trend === 'UP') return <TrendingUp size={11} className="text-data-up" />;
  if (trend === 'DOWN') return <TrendingDown size={11} className="text-data-down" />;
  return <Minus size={11} className="text-data-neutral" />;
}
