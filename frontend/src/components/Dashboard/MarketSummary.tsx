import { MarketSummary } from '../../types';

interface MarketSummaryPanelProps {
  summaries: MarketSummary[];
  loading: boolean;
  onSymbolClick: (symbol: string) => void;
}

export function MarketSummaryPanel({ summaries, loading, onSymbolClick }: MarketSummaryPanelProps) {
  if (loading) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Market Overview</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-surface-700 animate-pulse rounded-lg h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Market Overview</h3>
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {summaries.map(s => (
          <button
            key={s.symbol}
            onClick={() => onSymbolClick(s.symbol)}
            className="bg-surface-700 hover:bg-surface-600 rounded-lg p-2.5 text-center transition-colors"
          >
            <div className="text-xs font-bold text-white mb-1">{s.symbol}</div>
            <div className={`text-sm font-mono font-bold ${s.changePercent >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>
              {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendDot trend={s.trend} />
              <span className="text-xs text-gray-500">RSI {s.rsi}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrendDot({ trend }: { trend: 'UP' | 'DOWN' | 'NEUTRAL' }) {
  const color = trend === 'UP' ? 'bg-bull-500' : trend === 'DOWN' ? 'bg-bear-500' : 'bg-gray-500';
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}
