import { useState, useMemo } from 'react';
import {
  ClipboardList, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { TradeSetup } from '../../types';
import { useAllSetups } from '../../hooks/useSetups';
import { Tooltip } from '../ui/Tooltip';
import { DataTable, ColDef } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';

// ── Types ─────────────────────────────────────────────────────────

type SortKey = 'symbol' | 'strategy' | 'status' | 'entry' | 'rr' | 'pnl' | 'date';
type SortDir = 'asc' | 'desc';

const RR_LABEL = (
  <Tooltip content="Risk/Reward ratio — how much you stand to gain relative to what you risk per trade." width="w-52">
    <span>R/R</span>
  </Tooltip>
);

const HISTORY_COLS: ColDef<SortKey>[] = [
  { key: 'symbol',   label: 'Symbol',   cols: 'col-span-2',                   sortable: true  },
  { key: 'strategy', label: 'Strategy', cols: 'col-span-2',                   sortable: true  },
  { key: 'status',   label: 'Status',   cols: 'col-span-2',                   sortable: true  },
  { key: 'entry',    label: 'Entry',    cols: 'col-span-1', align: 'right',   sortable: true  },
  { key: 'rr',       label: RR_LABEL,   cols: 'col-span-1', align: 'right',   sortable: true  },
  { key: 'pnl',      label: 'P&L',      cols: 'col-span-2', align: 'right',   sortable: true  },
  { key: 'date',     label: 'Date',     cols: 'col-span-1', align: 'right',   sortable: true  },
  { key: '_',        label: '',         cols: 'col-span-1',                   sortable: false },
];

// ── Lookup tables ─────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const STRATEGY_BADGE: Record<string, string> = {
  TREND_PULLBACK: 'bg-brand-500/10 text-brand-400',
  BREAKOUT:       'bg-warn-500/10 text-warn-400',
  REVERSAL:       'bg-purple-500/10 text-purple-400',
};

// ── Helpers ───────────────────────────────────────────────────────

function statusLabel(s: TradeSetup): string {
  if (s.status === 'EXPIRED') return 'Expired';
  if (s.realizedPnl == null)   return 'Closed';
  if (s.realizedPnl > 0)       return 'Win';
  if (s.realizedPnl < 0)       return 'Loss';
  return 'Closed';
}

function statusBadge(s: TradeSetup): string {
  if (s.status === 'EXPIRED')  return 'bg-surface-600 text-gray-400';
  if (s.realizedPnl == null)   return 'border border-surface-500 text-gray-300';
  if (s.realizedPnl > 0)       return 'border border-bull-500/30 text-bull-400 bg-bull-500/5';
  return 'border border-bear-500/30 text-bear-400 bg-bear-500/5';
}

function rowDate(s: TradeSetup): number {
  return s.closedAt ?? s.detectedAt;
}

function exportCsv(rows: TradeSetup[]) {
  const headers = ['Symbol', 'Direction', 'Strategy', 'Status', 'Entry', 'Stop', 'Target', 'Shares', 'Exit Price', 'P&L', 'R/R', 'Date'];
  const lines = rows.map(s =>
    [
      s.symbol,
      s.direction,
      STRATEGY_LABELS[s.strategy] ?? s.strategy,
      statusLabel(s),
      s.entry.toFixed(2),
      s.stop.toFixed(2),
      s.target.toFixed(2),
      String(s.stockSuggestion?.shares ?? ''),
      s.exitPrice != null ? s.exitPrice.toFixed(2) : '',
      s.realizedPnl != null ? s.realizedPnl.toFixed(2) : '',
      String(s.riskReward),
      format(new Date(rowDate(s)), 'yyyy-MM-dd HH:mm'),
    ].map(v => `"${v}"`).join(','),
  );
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `swingflow-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────

export function HistoryPanel() {
  const { allSetups, loading }       = useAllSetups();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [symbolQuery, setSymbolQuery]         = useState('');
  const [statusFilter, setStatusFilter]       = useState<'all' | 'COMPLETED' | 'EXPIRED'>('all');
  const [strategyFilter, setStrategyFilter]   = useState<'all' | string>('all');
  const [dateFrom, setDateFrom]               = useState('');
  const [dateTo, setDateTo]                   = useState('');

  // Sort — default: newest first
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const closedSetups = useMemo(
    () => allSetups.filter(s => s.status === 'COMPLETED' || s.status === 'EXPIRED'),
    [allSetups],
  );

  const strategies = useMemo(
    () => [...new Set(closedSetups.map(s => s.strategy))],
    [closedSetups],
  );

  const filtered = useMemo(() => {
    let rows = closedSetups;

    if (symbolQuery) {
      const q = symbolQuery.toUpperCase();
      rows = rows.filter(s => s.symbol.includes(q));
    }
    if (statusFilter !== 'all')   rows = rows.filter(s => s.status === statusFilter);
    if (strategyFilter !== 'all') rows = rows.filter(s => s.strategy === strategyFilter);
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      rows = rows.filter(s => rowDate(s) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000;
      rows = rows.filter(s => rowDate(s) < to);
    }

    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'symbol':   cmp = a.symbol.localeCompare(b.symbol); break;
        case 'strategy': cmp = (STRATEGY_LABELS[a.strategy] ?? '').localeCompare(STRATEGY_LABELS[b.strategy] ?? ''); break;
        case 'status':   cmp = statusLabel(a).localeCompare(statusLabel(b)); break;
        case 'entry':    cmp = a.entry - b.entry; break;
        case 'rr':       cmp = a.riskReward - b.riskReward; break;
        case 'pnl':      cmp = (a.realizedPnl ?? -Infinity) - (b.realizedPnl ?? -Infinity); break;
        case 'date':     cmp = rowDate(a) - rowDate(b); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [closedSetups, symbolQuery, statusFilter, strategyFilter, dateFrom, dateTo, sortKey, sortDir]);

  const stats = useMemo(() => {
    const completed = filtered.filter(s => s.status === 'COMPLETED' && s.realizedPnl != null);
    const wins      = completed.filter(s => (s.realizedPnl ?? 0) > 0);
    const totalPnl  = completed.reduce((sum, s) => sum + (s.realizedPnl ?? 0), 0);
    const avgRR     = filtered.length > 0
      ? filtered.reduce((sum, s) => sum + s.riskReward, 0) / filtered.length
      : 0;
    return { total: filtered.length, winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : null, totalPnl, avgRR, hasCompleted: completed.length > 0 };
  }, [filtered]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setSymbolQuery(''); setStatusFilter('all'); setStrategyFilter('all');
    setDateFrom(''); setDateTo('');
  };

  const hasFilters = !!(symbolQuery || statusFilter !== 'all' || strategyFilter !== 'all' || dateFrom || dateTo);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-800 animate-pulse rounded-xl h-14 border border-surface-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Export */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => exportCsv(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-300 bg-surface-700 hover:bg-surface-600 border border-surface-600 transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      )}

      {/* Performance summary strip */}
      {closedSetups.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard label="Trades" value={String(stats.total)} />
          <SummaryCard
            label="Win Rate"
            value={stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—'}
            color={stats.winRate != null ? (stats.winRate >= 50 ? 'text-bull-400' : 'text-bear-400') : undefined}
          />
          <SummaryCard
            label="Total P&L"
            value={stats.hasCompleted ? `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}` : '—'}
            color={stats.hasCompleted ? (stats.totalPnl >= 0 ? 'text-bull-400' : 'text-bear-400') : undefined}
          />
          <SummaryCard
            label="Avg R/R"
            value={stats.avgRR > 0 ? `${stats.avgRR.toFixed(1)}:1` : '—'}
            color="text-warn-400"
          />
        </div>
      )}

      {/* Filter bar */}
      {closedSetups.length > 0 && (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1.5">Symbol</label>
              <input
                type="text"
                value={symbolQuery}
                onChange={e => setSymbolQuery(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL"
                maxLength={5}
                className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono uppercase transition-colors"
              />
            </div>

            <div className="min-w-[130px]">
              <label className="block text-xs text-gray-400 mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="all">All</option>
                <option value="COMPLETED">Completed</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className="min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1.5">Strategy</label>
              <select
                value={strategyFilter}
                onChange={e => setStrategyFilter(e.target.value)}
                className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="all">All Strategies</option>
                {strategies.map(s => (
                  <option key={s} value={s}>{STRATEGY_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors [color-scheme:dark]"
              />
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-400 hover:text-white transition-colors self-end pb-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div id="tour-history-table">
        {filtered.length === 0 ? (
          <EmptyState hasData={closedSetups.length > 0} />
        ) : (
          <DataTable columns={HISTORY_COLS} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
            {filtered.map(s => (
              <TradeRow
                key={s.id}
                setup={s}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
              />
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function TradeRow({ setup: s, expanded, onToggle }: {
  setup: TradeSetup; expanded: boolean; onToggle: () => void;
}) {
  const date = rowDate(s);

  return (
    <div className="border-b border-surface-700 last:border-0">
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-12 items-center px-5 py-3.5 hover:bg-surface-750 transition-colors text-left"
      >
        <span className="col-span-2 font-bold font-mono text-white text-sm">{s.symbol}</span>

        <div className="col-span-2">
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STRATEGY_BADGE[s.strategy] ?? 'bg-surface-700 text-gray-400'}`}>
            {STRATEGY_LABELS[s.strategy] ?? s.strategy}
          </span>
        </div>

        <div className="col-span-2">
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusBadge(s)}`}>
            {statusLabel(s)}
          </span>
        </div>

        <span className="col-span-1 text-right font-mono text-sm text-gray-200">
          ${s.entry.toFixed(2)}
        </span>

        <span className="col-span-1 text-right font-mono text-sm text-warn-400">
          {s.riskReward}:1
        </span>

        <span className={`col-span-2 text-right font-mono text-sm ${
          s.realizedPnl == null ? 'text-gray-500'
          : s.realizedPnl >= 0  ? 'text-bull-400'
          : 'text-bear-400'
        }`}>
          {s.realizedPnl != null
            ? `${s.realizedPnl >= 0 ? '+' : ''}$${s.realizedPnl.toFixed(2)}`
            : '—'}
        </span>

        <div className="col-span-1 flex justify-end">
          <Tooltip content={format(new Date(date), 'MMM d, yyyy · h:mm a')} width="w-48">
            <span className="text-xs text-gray-400 tabular-nums">
              {format(new Date(date), 'MMM d')}
            </span>
          </Tooltip>
        </div>

        <div className="col-span-1 flex justify-end text-gray-500">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 bg-surface-750/40 border-t border-surface-700/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <DetailStat
              label="Direction"
              value={s.direction}
              color={s.direction === 'LONG' ? 'text-bull-400' : 'text-bear-400'}
            />
            <DetailStat label="Stop"       value={`$${s.stop.toFixed(2)}`}   color="text-bear-400" />
            <DetailStat label="Target"     value={`$${s.target.toFixed(2)}`} color="text-bull-400" />
            {s.exitPrice != null && (
              <DetailStat label="Exit Price" value={`$${s.exitPrice.toFixed(2)}`} />
            )}
            <DetailStat label="Shares"     value={String(s.stockSuggestion?.shares ?? '—')} />
            <DetailStat label="Confidence" value={`${s.confidence}%`} color="text-warn-400" />
            <DetailStat
              label="Detected"
              value={format(new Date(s.detectedAt), 'MMM d, yyyy · h:mm a')}
            />
            {s.closedAt != null && (
              <DetailStat
                label="Closed"
                value={format(new Date(s.closedAt), 'MMM d, yyyy · h:mm a')}
              />
            )}
          </div>
          {s.notes && (
            <p className="mt-3 text-xs text-gray-400 italic leading-relaxed border-t border-surface-700 pt-3">
              {s.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 p-4">
      <div className="text-xs text-gray-400 mb-1.5">{label}</div>
      <div className={`text-xl font-bold font-mono ${color ?? 'text-gray-200'}`}>{value}</div>
    </div>
  );
}

function DetailStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-sm font-mono font-semibold ${color ?? 'text-gray-200'}`}>{value}</div>
    </div>
  );
}

function HistoryEmpty({ hasData }: { hasData: boolean }) {
  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 py-16">
      <EmptyState
        icon={ClipboardList}
        heading={hasData ? 'No trades match your filters' : 'No trade history yet'}
        body={hasData
          ? 'Try adjusting or clearing the filters above.'
          : 'Completed setups will appear here. Act on an active setup to record your first trade.'
        }
      />
    </div>
  );
}
