import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { gsap } from 'gsap';
import { TradeSetup } from '../../types';
import { useAllSetups } from '../../hooks/useSetups';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { Tooltip } from '../ui/Tooltip';
import { DataTable, ColDef } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { PageContainer } from '../ui/PageContainer';
import { Button } from '../ui/Button';
import { BrandedLoader } from '../ui/BrandedLoader';
import { useMinimumLoading } from '../../hooks/useMinimumLoading';
import { setupsApi } from '../../services/api';
import { SetupAnalytics } from '../../types';

type SortKey = 'symbol' | 'strategy' | 'status' | 'entry' | 'rr' | 'pnl' | 'date';
type SortDir = 'asc' | 'desc';

const RR_LABEL = (
  <Tooltip content="Risk/Reward ratio — how much you stand to gain relative to what you risk per trade." width="w-52">
    <span>R/R</span>
  </Tooltip>
);

const HISTORY_COLS: ColDef<SortKey>[] = [
  { key: 'symbol',   label: 'Symbol',   cols: 'col-span-2', sortable: true },
  { key: 'strategy', label: 'Strategy', cols: 'col-span-2', sortable: true },
  { key: 'status',   label: 'Status',   cols: 'col-span-2', sortable: true },
  { key: 'entry',    label: 'Entry',    cols: 'col-span-1', align: 'right', sortable: true },
  { key: 'rr',       label: RR_LABEL,   cols: 'col-span-1', align: 'right', sortable: true },
  { key: 'pnl',      label: 'P&L',      cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'date',     label: 'Date',     cols: 'col-span-1', align: 'right', sortable: true },
  { key: '_',        label: '',         cols: 'col-span-1', sortable: false },
];

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const STRATEGY_CHIP = 'text-gray-300 bg-surface-700/80 border border-surface-600';

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
  if (s.realizedPnl > 0)       return 'border border-bull-500/30 text-data-up bg-bull-500/5';
  return 'border border-bear-500/30 text-data-down bg-bear-500/5';
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

export function HistoryPanel() {
  const { allSetups, loading }       = useAllSetups();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const showHistoryLoader = useMinimumLoading(loading, 450);

  const [symbolQuery, setSymbolQuery]         = useState('');
  const [statusFilter, setStatusFilter]       = useState<'all' | 'COMPLETED' | 'EXPIRED'>('all');
  const [strategyFilter, setStrategyFilter]   = useState<'all' | string>('all');
  const [dateFrom, setDateFrom]               = useState('');
  const [dateTo, setDateTo]                   = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [analytics, setAnalytics] = useState<SetupAnalytics | null>(null);

  useEffect(() => {
    setupsApi.analytics().then(setAnalytics).catch(() => {});
  }, []);

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

  useLayoutEffect(() => {
    if (prefersReducedMotion || showHistoryLoader || !pageRef.current) return;
    const surfaces = pageRef.current.querySelectorAll('[data-sf-history-surface]');
    if (surfaces.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        surfaces,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: 'power2.out',
          stagger: 0.06,
          clearProps: 'opacity,transform',
        },
      );
    }, pageRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, showHistoryLoader]);

  useLayoutEffect(() => {
    if (prefersReducedMotion || !rowsRef.current || showHistoryLoader || filtered.length === 0) return;
    const rows = rowsRef.current.querySelectorAll('[data-sf-history-row]');
    if (rows.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rows,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.2,
          ease: 'power2.out',
          stagger: 0.016,
          clearProps: 'opacity',
        },
      );
    }, rowsRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, showHistoryLoader, filtered.length]);

  if (showHistoryLoader) {
    return (
      <PageContainer>
        <BrandedLoader
          message="Loading trade history…"
          subtext="Crunching your setup outcomes"
          className="min-h-[16rem]"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <div ref={pageRef} className="space-y-5">
        {filtered.length > 0 && (
          <div data-sf-history-surface className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => exportCsv(filtered)} className="text-sf-label">
              <Download size={14} />
              Export CSV
            </Button>
          </div>
        )}

        {closedSetups.length > 0 && (
          <div data-sf-history-surface className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Trades" value={String(stats.total)} />
            <SummaryCard
              label="Win Rate"
              value={stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—'}
              valueClass={
                stats.winRate != null
                  ? stats.winRate >= 50 ? 'text-data-up' : 'text-data-down'
                  : 'text-gray-200'
              }
            />
            <SummaryCard
              label="Total P&L"
              value={stats.hasCompleted ? `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}` : '—'}
              valueClass={
                stats.hasCompleted
                  ? stats.totalPnl >= 0 ? 'text-data-up' : 'text-data-down'
                  : 'text-gray-200'
              }
            />
            <SummaryCard
              label="Avg R/R"
              value={stats.avgRR > 0 ? `${stats.avgRR.toFixed(1)}:1` : '—'}
              valueClass="text-data-neutral"
            />
          </div>
        )}

        {analytics && (
          <div data-sf-history-surface className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Weekly Setups" value={String(analytics.setupsGenerated)} />
            <SummaryCard label="Triggered" value={String(analytics.setupsTriggered)} />
            <SummaryCard label="Win Rate (Auto)" value={analytics.winRate != null ? `${analytics.winRate.toFixed(0)}%` : '—'} />
            <SummaryCard label="Notif Delivery" value={analytics.notificationDeliveryRate != null ? `${analytics.notificationDeliveryRate.toFixed(0)}%` : '—'} />
          </div>
        )}

        {closedSetups.length > 0 && (
          <div data-sf-history-surface className="bg-surface-800 rounded-2xl border border-surface-700 p-4">
            <p className="text-sf-section text-gray-400 mb-3">Filters</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sf-field text-gray-500 mb-1.5">Symbol</label>
                <input
                  type="text"
                  value={symbolQuery}
                  onChange={e => setSymbolQuery(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  maxLength={5}
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
                />
              </div>

              <div className="min-w-[130px]">
                <label className="block text-sf-field text-gray-500 mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors"
                >
                  <option value="all">All</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <div className="min-w-[150px]">
                <label className="block text-sf-field text-gray-500 mb-1.5">Strategy</label>
                <select
                  value={strategyFilter}
                  onChange={e => setStrategyFilter(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors"
                >
                  <option value="all">All Strategies</option>
                  {strategies.map(s => (
                    <option key={s} value={s}>{STRATEGY_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sf-field text-gray-500 mb-1.5">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors date-input-theme"
                />
              </div>

              <div>
                <label className="block text-sf-field text-gray-500 mb-1.5">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors date-input-theme"
                />
              </div>

              {hasFilters && (
                <Button type="button" variant="ghost" onClick={clearFilters} className="self-end pb-2">
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        )}

        <div ref={rowsRef} data-sf-history-surface>
          <DataTable
            id="tour-history-table"
            columns={HISTORY_COLS}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            isEmpty={filtered.length === 0}
            emptyState={<HistoryEmpty hasData={closedSetups.length > 0} />}
          >
            {filtered.map(s => (
              <TradeRow
                key={s.id}
                setup={s}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
              />
            ))}
          </DataTable>
        </div>
      </div>
    </PageContainer>
  );
}

function TradeRow({ setup: s, expanded, onToggle }: {
  setup: TradeSetup; expanded: boolean; onToggle: () => void;
}) {
  const date = rowDate(s);

  return (
    <div className="border-b border-surface-700 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        data-sf-history-row
        className="w-full grid grid-cols-12 items-center px-5 py-3 hover:bg-surface-750 transition-colors text-left text-sf-cell font-mono"
      >
        <span className="col-span-2 font-bold text-white">{s.symbol}</span>

        <div className="col-span-2">
          <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>
            {STRATEGY_LABELS[s.strategy] ?? s.strategy}
          </span>
        </div>

        <div className="col-span-2">
          <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${statusBadge(s)}`}>
            {statusLabel(s)}
          </span>
        </div>

        <span className="col-span-1 text-right text-gray-100">
          ${s.entry.toFixed(2)}
        </span>

        <span className="col-span-1 text-right text-data-neutral">
          {s.riskReward}:1
        </span>

        <span
          className={`col-span-2 text-right ${
            s.realizedPnl == null ? 'text-data-neutral'
            : s.realizedPnl >= 0  ? 'text-data-up'
            : 'text-data-down'
          }`}
        >
          {s.realizedPnl != null
            ? `${s.realizedPnl >= 0 ? '+' : ''}$${s.realizedPnl.toFixed(2)}`
            : '—'}
        </span>

        <div className="col-span-1 flex justify-end">
          <Tooltip content={format(new Date(date), 'MMM d, yyyy · h:mm a')} width="w-48">
            <span className="text-sf-field text-gray-500 tabular-nums">
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
              valueClass="text-data-neutral"
            />
            <DetailStat label="Stop"       value={`$${s.stop.toFixed(2)}`}   valueClass="text-data-down" />
            <DetailStat label="Target"     value={`$${s.target.toFixed(2)}`} valueClass="text-data-up" />
            {s.exitPrice != null && (
              <DetailStat label="Exit Price" value={`$${s.exitPrice.toFixed(2)}`} valueClass="text-gray-100" />
            )}
            <DetailStat label="Shares"     value={String(s.stockSuggestion?.shares ?? '—')} valueClass="text-gray-100" />
            <DetailStat label="Confidence" value={`${s.confidence}%`} valueClass="text-data-neutral" />
            <DetailStat
              label="Detected"
              value={format(new Date(s.detectedAt), 'MMM d, yyyy · h:mm a')}
              valueClass="text-gray-300"
            />
            {s.closedAt != null && (
              <DetailStat
                label="Closed"
                value={format(new Date(s.closedAt), 'MMM d, yyyy · h:mm a')}
                valueClass="text-gray-300"
              />
            )}
          </div>
          {s.notes && (
            <p className="mt-3 text-sf-body italic leading-relaxed border-t border-surface-700 pt-3">
              {s.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 p-4">
      <div className="text-sf-field text-gray-500 mb-1.5">{label}</div>
      <div className={`text-sf-value-lg font-mono ${valueClass ?? 'text-gray-100'}`}>{value}</div>
    </div>
  );
}

function DetailStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3">
      <div className="text-sf-field text-gray-500 mb-1">{label}</div>
      <div className={`text-sf-cell font-mono ${valueClass ?? 'text-gray-100'}`}>{value}</div>
    </div>
  );
}

function HistoryEmpty({ hasData }: { hasData: boolean }) {
  return (
    <EmptyState
      icon={ClipboardList}
      heading={hasData ? 'No trades match your filters' : 'No trade history yet'}
      subtext={hasData
        ? 'Try adjusting or clearing the filters above.'
        : 'Completed setups will appear here after you record a close.'
      }
    />
  );
}
