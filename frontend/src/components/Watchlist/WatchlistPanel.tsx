import { useState } from 'react';
import { MarketSummary } from '../../types';
import { useWatchlist } from '../../hooks/useWatchlist';

interface WatchlistPanelProps {
  summaries: MarketSummary[];
  onSymbolClick: (symbol: string) => void;
}

export function WatchlistPanel({ summaries, onSymbolClick }: WatchlistPanelProps) {
  const { symbols, addSymbol, removeSymbol } = useWatchlist();
  const [newSymbol, setNewSymbol] = useState('');
  const [adding, setAdding] = useState(false);

  const summaryMap = new Map(summaries.map(s => [s.symbol, s]));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    if (!sym || sym.length > 5) return;
    setAdding(true);
    try {
      await addSymbol(sym);
      setNewSymbol('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Add symbol */}
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Add to Watchlist</h3>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g. GOOGL)"
            maxLength={5}
            className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono uppercase"
          />
          <button
            type="submit"
            disabled={adding || !newSymbol}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-surface-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {adding ? '…' : '+ Add'}
          </button>
        </form>
      </div>

      {/* Symbol table */}
      <div className="bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
        <div className="grid grid-cols-6 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 border-b border-surface-600">
          <span className="col-span-1">Symbol</span>
          <span className="col-span-1 text-right">Price</span>
          <span className="col-span-1 text-right">Change</span>
          <span className="col-span-1 text-center">Trend</span>
          <span className="col-span-1 text-center">RSI</span>
          <span className="col-span-1 text-right">Actions</span>
        </div>

        {symbols.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Watchlist is empty. Add symbols above.
          </div>
        )}

        {symbols.map(sym => {
          const s = summaryMap.get(sym);
          return (
            <div
              key={sym}
              className="grid grid-cols-6 items-center px-4 py-3 border-b border-surface-700 last:border-0 hover:bg-surface-700/50 transition-colors"
            >
              <button
                className="col-span-1 text-left font-bold font-mono text-white hover:text-brand-400 transition-colors"
                onClick={() => onSymbolClick(sym)}
              >
                {sym}
              </button>

              <span className="col-span-1 text-right font-mono text-gray-200">
                {s ? `$${s.lastPrice.toFixed(2)}` : '—'}
              </span>

              <span className={`col-span-1 text-right font-mono text-sm ${!s ? '' : s.changePercent >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>
                {s ? `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%` : '—'}
              </span>

              <span className="col-span-1 text-center">
                {s ? (
                  <TrendIndicator trend={s.trend} />
                ) : <span className="text-gray-600">—</span>}
              </span>

              <span className={`col-span-1 text-center font-mono text-sm ${!s ? '' : s.rsi < 30 ? 'text-bear-400' : s.rsi > 70 ? 'text-warn-400' : 'text-gray-300'}`}>
                {s ? s.rsi : '—'}
              </span>

              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => removeSymbol(sym)}
                  className="text-xs text-gray-600 hover:text-bear-400 transition-colors px-2 py-1"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'UP' | 'DOWN' | 'NEUTRAL' }) {
  const config = {
    UP:      { color: 'text-bull-400', icon: '▲', bg: 'bg-bull-500/10' },
    DOWN:    { color: 'text-bear-400', icon: '▼', bg: 'bg-bear-500/10' },
    NEUTRAL: { color: 'text-gray-400', icon: '◆', bg: 'bg-surface-700' },
  }[trend];

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
      {config.icon} {trend}
    </span>
  );
}
