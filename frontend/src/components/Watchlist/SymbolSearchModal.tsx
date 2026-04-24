import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { marketApi } from '../../services/api';
import { TickerSearchResult } from '../../types';
import { Button } from '../ui/Button';

const QUICK_PICKS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'SPY', 'QQQ'];

type StatusMsg = { type: 'success' | 'error' | 'warning'; text: string };

interface SymbolSearchModalProps {
  open: boolean;
  onClose: () => void;
  watchedSymbols: string[];
  onAdd: (symbol: string) => Promise<void>;
  flash: (msg: StatusMsg) => void;
}

export function SymbolSearchModal({
  open,
  onClose,
  watchedSymbols,
  onAdd,
  flash,
}: SymbolSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSearchQuery('');
    setResults([]);
    setSearchError(null);
    setHighlight(0);
    setAddingSymbol(null);
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const q = searchQuery.trim();
    if (q.length < 1) {
      setResults([]);
      setSearchError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError(null);
    const t = window.setTimeout(async () => {
      try {
        const data = await marketApi.search(q);
        setResults(data);
        setHighlight(0);
      } catch {
        setSearchError('Search failed. Check your network and try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => window.clearTimeout(t);
  }, [searchQuery, open]);

  const tryAdd = async (symbol: string) => {
    const upper = symbol.trim().toUpperCase();
    if (!upper) return;
    if (watchedSymbols.includes(upper)) {
      flash({ type: 'warning', text: `${upper} is already on your watchlist.` });
      return;
    }
    setAddingSymbol(upper);
    try {
      await onAdd(upper);
      flash({ type: 'success', text: `${upper} added to watchlist.` });
      onClose();
      reset();
    } catch {
      flash({ type: 'error', text: 'Could not add symbol. Check the ticker and try again.' });
    } finally {
      setAddingSymbol(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, Math.max(results.length - 1, 0)));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    }
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const row = results[highlight];
      if (row) void tryAdd(row.symbol);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-md shadow-2xl flex flex-col max-h-[min(90vh,560px)]"
        role="dialog"
        aria-labelledby="symbol-search-title"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-surface-700 flex-shrink-0">
          <h2 id="symbol-search-title" className="text-sm font-semibold text-white">
            Search &amp; add symbol
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 pt-4 space-y-3 flex-shrink-0">
          <p className="text-xs text-gray-500 leading-relaxed">
            Search by ticker or company name (Massive). Popular:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PICKS.map(sym => (
              <button
                key={sym}
                type="button"
                disabled={!!addingSymbol}
                onClick={() => void tryAdd(sym)}
                className="text-xs font-mono px-2 py-1 rounded-md bg-surface-700 border border-surface-600 text-gray-200 hover:border-brand-500/50 hover:text-white transition-colors disabled:opacity-40"
              >
                {sym}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="Type ticker or name…"
              maxLength={32}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg pl-9 pr-3 py-2.5 text-sf-body text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Searching…
            </div>
          )}
          {searchError && (
            <p className="text-xs text-data-down">{searchError}</p>
          )}
        </div>

        <div className="px-5 pb-2 flex-1 min-h-0 overflow-y-auto">
          {results.length > 0 && (
            <ul className="border border-surface-600 rounded-lg overflow-hidden divide-y divide-surface-700">
              {results.map((r, i) => (
                <li key={`${r.symbol}-${i}`}>
                  <button
                    type="button"
                    disabled={!!addingSymbol}
                    onClick={() => void tryAdd(r.symbol)}
                    className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors disabled:opacity-40 ${
                      i === highlight ? 'bg-surface-700/80' : 'hover:bg-surface-700/60'
                    }`}
                  >
                    <span className="font-mono font-semibold text-white">{r.symbol}</span>
                    <span className="text-xs text-gray-400 line-clamp-2">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && searchQuery.trim().length >= 1 && results.length === 0 && !searchError && (
            <p className="text-xs text-gray-500 py-2">No matches. Try another spelling or ticker.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5 pt-3 border-t border-surface-700 flex-shrink-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
