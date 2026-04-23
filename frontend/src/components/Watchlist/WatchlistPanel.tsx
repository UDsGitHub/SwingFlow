import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Zap, ArrowUp, ArrowDown, HelpCircle, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { scanApi } from '../../services/api';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmModal } from '../ui/ConfirmModal';
import { DataTable, ColDef } from '../ui/DataTable';

type SortKey = 'symbol' | 'price' | 'change' | 'rsi';
type SortDir = 'asc' | 'desc';
type StatusMsg = { type: 'success' | 'error' | 'warning'; text: string };

const RSI_LABEL = (
  <span className="flex items-center gap-1.5 pl-4">
    RSI
    <Tooltip
      content="RSI above 70 = overbought (selling pressure likely). RSI below 30 = oversold (potential reversal)."
      width="w-56"
    >
      <span className="text-gray-500 hover:text-gray-400 transition-colors cursor-help">
        <HelpCircle size={11} />
      </span>
    </Tooltip>
  </span>
);

const WATCHLIST_COLS: ColDef<SortKey>[] = [
  { key: 'symbol', label: 'Symbol', cols: 'col-span-3',                           sortable: false },
  { key: 'price',  label: 'Price',  cols: 'col-span-2', align: 'right',            sortable: true  },
  { key: 'change', label: 'Change', cols: 'col-span-2', align: 'right',            sortable: true  },
  { key: 'rsi',    label: RSI_LABEL, cols: 'col-span-3',                           sortable: true  },
  { key: '_',      label: '',       cols: 'col-span-2',                            sortable: false },
];

export function WatchlistPanel() {
  const navigate = useNavigate();
  const { summaries, summariesLastUpdated } = useAppContext();
  const { symbols, addSymbol, removeSymbol } = useWatchlist();

  const [input, setInput]               = useState('');
  const [adding, setAdding]             = useState(false);
  const [status, setStatus]             = useState<StatusMsg | null>(null);
  const [sortKey, setSortKey]           = useState<SortKey>('symbol');
  const [sortDir, setSortDir]           = useState<SortDir>('asc');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [scanningSymbol, setScanningSymbol] = useState<string | null>(null);

  const query = input.trim().toUpperCase();

  const summaryMap = useMemo(
    () => new Map(summaries.map(s => [s.symbol, s])),
    [summaries],
  );

  const sortedRows = useMemo(() => {
    const base = query ? symbols.filter(sym => sym.includes(query)) : symbols;
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'symbol') {
        cmp = a.localeCompare(b);
      } else {
        const sa = summaryMap.get(a);
        const sb = summaryMap.get(b);
        const va = sortKey === 'price'  ? (sa?.lastPrice    ?? 0)
                 : sortKey === 'change' ? (sa?.changePercent ?? 0)
                 : (sa?.rsi ?? 0);
        const vb = sortKey === 'price'  ? (sb?.lastPrice    ?? 0)
                 : sortKey === 'change' ? (sb?.changePercent ?? 0)
                 : (sb?.rsi ?? 0);
        cmp = va - vb;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [symbols, query, sortKey, sortDir, summaryMap]);

  const obCount = summaries.filter(s => s.rsi >= 70).length;
  const osCount = summaries.filter(s => s.rsi <= 30).length;

  const flash = (msg: StatusMsg) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3500);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    if (symbols.includes(query)) {
      flash({ type: 'warning', text: `${query} is already on your watchlist.` });
      return;
    }
    setAdding(true);
    try {
      await addSymbol(query);
      flash({ type: 'success', text: `${query} added to watchlist.` });
      setInput('');
    } catch {
      flash({ type: 'error', text: 'Symbol not found. Please enter a valid ticker.' });
    } finally {
      setAdding(false);
    }
  };

  const handleScanSymbol = async (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScanningSymbol(sym);
    try {
      await scanApi.triggerSymbol(sym);
      await new Promise(r => setTimeout(r, 3000));
      navigate('/');
    } finally {
      setScanningSymbol(null);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    await removeSymbol(removeTarget);
    setRemoveTarget(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Add / filter */}
      <div id="tour-watchlist-form" className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value.toUpperCase()); setStatus(null); }}
            placeholder="Add or filter by ticker (e.g. GOOGL)"
            maxLength={5}
            className="flex-1 bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono uppercase transition-colors"
          />
          <button
            type="submit"
            disabled={adding || !query}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-surface-700 disabled:text-gray-400 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={14} />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
        {status && (
          <p className={`text-sm mt-2 leading-relaxed ${
            status.type === 'success' ? 'text-bull-400' :
            status.type === 'warning' ? 'text-warn-400' :
            'text-bear-400'
          }`}>
            {status.text}
          </p>
        )}
      </div>

      {/* Table */}
      <div id="tour-watchlist-table">
        {summariesLastUpdated && (
          <div className="flex justify-end mb-2">
            <span className="text-xs text-gray-400 tabular-nums">
              Updated {summariesLastUpdated.toLocaleTimeString()}
            </span>
          </div>
        )}

        <DataTable
          columns={WATCHLIST_COLS}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        >
          {sortedRows.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              {query ? `No symbols matching "${query}".` : 'Your watchlist is empty. Add a ticker above.'}
            </div>
          )}

          {sortedRows.map(sym => {
            const s          = summaryMap.get(sym);
            const isScanning = scanningSymbol === sym;
            const isPositive = (s?.changePercent ?? 0) >= 0;

            return (
              <div
                key={sym}
                onClick={() => navigate(`/symbol/${sym}`, { state: { from: 'watchlist' } })}
                className="grid grid-cols-12 items-center px-5 py-3.5 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors cursor-pointer"
              >
                <span className="col-span-3 font-bold font-mono text-white text-sm">{sym}</span>

                <span className="col-span-2 text-right font-mono text-sm text-gray-300">
                  {s ? `$${s.lastPrice.toFixed(2)}` : '—'}
                </span>

                <span className={`col-span-2 text-right font-mono text-sm flex items-center justify-end gap-1 ${
                  !s ? 'text-gray-400' : isPositive ? 'text-bull-400' : 'text-bear-400'
                }`}>
                  {s && (isPositive
                    ? <ArrowUp size={11} className="flex-shrink-0" />
                    : <ArrowDown size={11} className="flex-shrink-0" />
                  )}
                  {s ? `${isPositive ? '+' : ''}${s.changePercent.toFixed(2)}%` : '—'}
                </span>

                <div className="col-span-3 flex items-center justify-start pl-4 gap-1.5">
                  {s ? <RsiCell rsi={s.rsi} /> : <span className="text-gray-400 text-sm">—</span>}
                </div>

                <div
                  className="col-span-2 flex items-center justify-end gap-1"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={e => handleScanSymbol(sym, e)}
                    disabled={isScanning}
                    title={`Scan ${sym}`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-surface-700 transition-colors disabled:opacity-40"
                  >
                    {isScanning
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Zap size={13} />
                    }
                  </button>
                  <button
                    onClick={() => setRemoveTarget(sym)}
                    title="Remove"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-bear-400 hover:bg-surface-700 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </DataTable>

        {symbols.length > 0 && (
          <div className="flex items-center gap-5 px-1 mt-3">
            <span className="text-xs text-gray-500">{symbols.length} symbol{symbols.length !== 1 ? 's' : ''} watched</span>
            {obCount > 0 && <span className="text-xs text-warn-400">{obCount} overbought</span>}
            {osCount > 0 && <span className="text-xs text-bull-400">{osCount} oversold</span>}
          </div>
        )}
      </div>

      <ConfirmModal
        open={removeTarget !== null}
        title="Remove from Watchlist"
        message={`Remove ${removeTarget} from your watchlist? It will no longer be included in scans.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function RsiCell({ rsi }: { rsi: number }) {
  const isOB = rsi >= 70;
  const isOS = rsi <= 30;
  return (
    <span className={`flex items-center gap-1.5 font-mono text-sm ${
      isOB ? 'text-warn-400' : isOS ? 'text-bull-400' : 'text-gray-400'
    }`}>
      {rsi}
      {isOB && (
        <span className="text-[10px] font-semibold bg-warn-500/15 text-warn-400 px-1.5 py-0.5 rounded-md leading-none">
          OB
        </span>
      )}
      {isOS && (
        <span className="text-[10px] font-semibold bg-bull-500/15 text-bull-400 px-1.5 py-0.5 rounded-md leading-none">
          OS
        </span>
      )}
    </span>
  );
}
