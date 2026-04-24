import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Zap, ArrowUp, ArrowDown, HelpCircle, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { scanApi } from '../../services/api';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmModal } from '../ui/ConfirmModal';
import { DataTable, ColDef } from '../ui/DataTable';
import { PageContainer } from '../ui/PageContainer';
import { SectionLabel } from '../ui/SectionLabel';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SymbolSearchModal } from './SymbolSearchModal';

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
  { key: 'symbol', label: 'Symbol', cols: 'col-span-3', sortable: false },
  { key: 'price',  label: 'Price',  cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'change', label: 'Change', cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'rsi',    label: RSI_LABEL, cols: 'col-span-3', sortable: true },
  { key: '_',      label: '',       cols: 'col-span-2', sortable: false },
];

export function WatchlistPanel() {
  const navigate = useNavigate();
  const { summaries, summariesLastUpdated } = useAppContext();
  const { symbols, isPending: watchlistPending, addSymbol, removeSymbol } = useWatchlist();

  const [filterQuery, setFilterQuery]   = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [status, setStatus]             = useState<StatusMsg | null>(null);
  const [sortKey, setSortKey]           = useState<SortKey>('symbol');
  const [sortDir, setSortDir]           = useState<SortDir>('asc');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [scanningSymbol, setScanningSymbol] = useState<string | null>(null);

  const filterTrim = filterQuery.trim().toUpperCase();

  const summaryMap = useMemo(
    () => new Map(summaries.map(s => [s.symbol, s])),
    [summaries],
  );

  const sortedRows = useMemo(() => {
    const base = filterTrim ? symbols.filter(sym => sym.includes(filterTrim)) : symbols;
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
  }, [symbols, filterTrim, sortKey, sortDir, summaryMap]);

  const obCount = summaries.filter(s => s.rsi >= 70).length;
  const osCount = summaries.filter(s => s.rsi <= 30).length;

  const flash = (msg: StatusMsg) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3500);
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

  const tableEmpty = sortedRows.length === 0;
  const loadingStateNode = (
    <div className="flex flex-col items-center justify-center gap-3 py-14" role="status" aria-live="polite">
      <Loader2 size={28} className="animate-spin text-brand-400" aria-hidden />
      <p className="text-sm text-gray-400">Loading watchlist…</p>
    </div>
  );
  const emptyStateNode =
    symbols.length === 0 ? (
      <EmptyState
        heading="Watchlist is empty"
        subtext='Use "Search & add symbol" to find tickers (Massive market data). Your list drives every scan.'
      />
    ) : (
      <EmptyState
        heading="No symbols match"
        subtext={`Nothing on your list matches "${filterTrim}". Clear the filter or try different letters.`}
      />
    );

  return (
    <PageContainer className="space-y-6">
      <div id="tour-watchlist-add" className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <SectionLabel>Add symbol</SectionLabel>
        <p className="text-sm text-gray-400 mt-1 mb-4 leading-relaxed">
          Search by ticker or company name (Massive market data). This does not filter the table below.
        </p>
        <Button type="button" variant="primary" onClick={() => { setStatus(null); setAddModalOpen(true); }}>
          <Plus size={14} />
          Search &amp; add symbol
        </Button>
        {status && (
          <p
            className={`text-sf-body mt-3 leading-relaxed ${
              status.type === 'success' ? 'text-data-up' :
              status.type === 'warning' ? 'text-warn-400' :
              'text-data-down'
            }`}
          >
            {status.text}
          </p>
        )}
      </div>

      <SymbolSearchModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        watchedSymbols={symbols}
        onAdd={addSymbol}
        flash={flash}
      />

      <div>
        <div
          id="tour-watchlist-filter"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3"
        >
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value.toUpperCase())}
              placeholder="Filter watchlist by symbol…"
              maxLength={16}
              className="w-full bg-surface-800 border border-surface-600 rounded-lg pl-9 pr-3 py-2 text-sf-body text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
              aria-label="Filter watchlist"
            />
          </div>
          {summariesLastUpdated && (
            <span className="text-sf-field text-gray-500 tabular-nums flex-shrink-0">
              Updated {summariesLastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <DataTable
          id="tour-watchlist-table"
          columns={WATCHLIST_COLS}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          isEmpty={watchlistPending || tableEmpty}
          emptyState={watchlistPending ? loadingStateNode : emptyStateNode}
        >
          {sortedRows.map(sym => {
            const s          = summaryMap.get(sym);
            const isScanning = scanningSymbol === sym;
            const isPositive = (s?.changePercent ?? 0) >= 0;

            return (
              <div
                key={sym}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/symbol/${encodeURIComponent(sym)}`, { state: { from: 'watchlist' } })
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/symbol/${encodeURIComponent(sym)}`, { state: { from: 'watchlist' } });
                  }
                }}
                className="grid grid-cols-12 items-center px-5 py-3 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors cursor-pointer text-sf-cell font-mono"
              >
                <span className="col-span-3 font-bold text-white">{sym}</span>

                <span className="col-span-2 text-right text-gray-100">
                  {s ? `$${s.lastPrice.toFixed(2)}` : '—'}
                </span>

                <span
                  className={`col-span-2 text-right flex items-center justify-end gap-1 ${
                    !s ? 'text-data-neutral' : isPositive ? 'text-data-up' : 'text-data-down'
                  }`}
                >
                  {s && (isPositive
                    ? <ArrowUp size={11} className="flex-shrink-0" />
                    : <ArrowDown size={11} className="flex-shrink-0" />
                  )}
                  {s ? `${isPositive ? '+' : ''}${s.changePercent.toFixed(2)}%` : '—'}
                </span>

                <div className="col-span-3 flex items-center justify-start pl-4 gap-1.5">
                  {s ? <RsiCell rsi={s.rsi} /> : <span className="text-data-neutral">—</span>}
                </div>

                <div
                  className="col-span-2 flex items-center justify-end gap-1"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={e => handleScanSymbol(sym, e)}
                    disabled={isScanning}
                    title={`Scan ${sym}`}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-surface-700 transition-colors disabled:opacity-40"
                  >
                    {isScanning
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Zap size={13} />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(sym)}
                    title="Remove"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-data-down hover:bg-surface-700 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </DataTable>

        {symbols.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 mt-3 text-sf-field text-gray-500">
            <span>{symbols.length} symbol{symbols.length !== 1 ? 's' : ''} watched</span>
            {obCount > 0 && <span className="text-warn-400">{obCount} overbought</span>}
            {osCount > 0 && <span className="text-data-neutral">{osCount} oversold</span>}
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
    </PageContainer>
  );
}

function RsiCell({ rsi }: { rsi: number }) {
  const isOB = rsi >= 70;
  const isOS = rsi <= 30;
  return (
    <span className="flex items-center gap-1.5 text-data-neutral">
      {rsi}
      {isOB && (
        <span className="text-[10px] font-semibold bg-warn-500/15 text-warn-400 px-1.5 py-0.5 rounded-md leading-none">
          OB
        </span>
      )}
      {isOS && (
        <span className="text-[10px] font-semibold bg-surface-700 text-gray-500 px-1.5 py-0.5 rounded-md leading-none">
          OS
        </span>
      )}
    </span>
  );
}
