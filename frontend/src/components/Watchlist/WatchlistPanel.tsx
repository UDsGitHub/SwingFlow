import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useWatchlist } from '../../hooks/useWatchlist';

export function WatchlistPanel() {
  const { summaries } = useAppContext();
  const { symbols, addSymbol, removeSymbol } = useWatchlist();
  const [newSymbol, setNewSymbol] = useState('');
  const [adding, setAdding]       = useState(false);

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
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Symbol</p>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            placeholder="Ticker symbol (e.g. GOOGL)"
            maxLength={5}
            className="flex-1 bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 font-mono uppercase transition-colors"
          />
          <button
            type="submit"
            disabled={adding || !newSymbol}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-surface-700 disabled:text-gray-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
        <div className="grid grid-cols-6 text-xs font-medium text-gray-600 uppercase tracking-wider px-5 py-3 border-b border-surface-700">
          <span className="col-span-1">Symbol</span>
          <span className="col-span-1 text-right">Price</span>
          <span className="col-span-1 text-right">Change</span>
          <span className="col-span-1 text-center">Trend</span>
          <span className="col-span-1 text-center">RSI</span>
          <span className="col-span-1" />
        </div>

        {symbols.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-gray-600">
            Your watchlist is empty. Add a ticker above.
          </div>
        )}

        {symbols.map(sym => {
          const s = summaryMap.get(sym);
          return (
            <div
              key={sym}
              className="grid grid-cols-6 items-center px-5 py-3.5 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors"
            >
              <span className="col-span-1 font-bold font-mono text-white text-sm">{sym}</span>

              <span className="col-span-1 text-right font-mono text-sm text-gray-300">
                {s ? `$${s.lastPrice.toFixed(2)}` : '—'}
              </span>

              <span className={`col-span-1 text-right font-mono text-sm ${
                !s ? 'text-gray-600' : s.changePercent >= 0 ? 'text-bull-400' : 'text-bear-400'
              }`}>
                {s ? `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%` : '—'}
              </span>

              <div className="col-span-1 flex justify-center">
                {s ? <TrendIcon trend={s.trend} /> : <span className="text-gray-700">—</span>}
              </div>

              <span className={`col-span-1 text-center font-mono text-sm ${
                !s ? 'text-gray-600' :
                s.rsi < 30 ? 'text-bear-400' :
                s.rsi > 70 ? 'text-warn-400' : 'text-gray-400'
              }`}>
                {s ? s.rsi : '—'}
              </span>

              <div className="flex justify-end">
                <button
                  onClick={() => removeSymbol(sym)}
                  className="p-1.5 rounded-lg text-gray-700 hover:text-bear-400 hover:bg-surface-700 transition-colors"
                  title="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'UP' | 'DOWN' | 'NEUTRAL' }) {
  if (trend === 'UP')   return <TrendingUp   size={14} className="text-bull-400" />;
  if (trend === 'DOWN') return <TrendingDown  size={14} className="text-bear-400" />;
  return <Minus size={14} className="text-gray-600" />;
}
