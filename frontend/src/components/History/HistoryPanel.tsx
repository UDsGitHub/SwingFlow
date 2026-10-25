import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { gsap } from 'gsap';
import { SetupAnalytics, Trade, TradeSetup } from '../../types';
import { useAllSetups } from '../../hooks/useSetups';
import { useClosedTrades } from '../../hooks/useTrades';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { Tooltip } from '../ui/Tooltip';
import { DataTable, ColDef } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { PageContainer } from '../ui/PageContainer';
import { Button } from '../ui/Button';
import { BrandedLoader } from '../ui/BrandedLoader';
import { useMinimumLoading } from '../../hooks/useMinimumLoading';
import { setupsApi } from '../../services/api';
import { EXIT_REASON_LABELS, STRATEGY_LABELS, TONE_BADGE, exitSummary, formatMoney, formatR, paperStatus } from '../../lib/setupDisplay';

type Tab = 'mine' | 'strategy';
type SortKey = 'symbol' | 'strategy' | 'status' | 'entry' | 'r' | 'date';
type SortDir = 'asc' | 'desc';
type TradeSortKey = 'symbol' | 'entry' | 'exit' | 'shares' | 'pnl' | 'date';

const R_LABEL = (
  <Tooltip content="Result in R: profit or loss as a multiple of the amount risked (entry minus stop)." width="w-56">
    <span>Result</span>
  </Tooltip>
);

const STRATEGY_COLS: ColDef<SortKey>[] = [
  { key: 'symbol',   label: 'Symbol',   cols: 'col-span-2', sortable: true },
  { key: 'strategy', label: 'Strategy', cols: 'col-span-2', sortable: true },
  { key: 'status',   label: 'Outcome',  cols: 'col-span-3', sortable: true },
  { key: 'entry',    label: 'Fill',     cols: 'col-span-1', align: 'right', sortable: true },
  { key: 'r',        label: R_LABEL,    cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'date',     label: 'Date',     cols: 'col-span-1', align: 'right', sortable: true },
  { key: '_',        label: '',         cols: 'col-span-1', sortable: false },
];

const TRADE_COLS: ColDef<TradeSortKey>[] = [
  { key: 'symbol', label: 'Symbol', cols: 'col-span-2', sortable: true },
  { key: 'entry',  label: 'Entry',  cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'exit',   label: 'Exit',   cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'shares', label: 'Shares', cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'pnl',    label: 'P&L',    cols: 'col-span-2', align: 'right', sortable: true },
  { key: 'date',   label: 'Closed', cols: 'col-span-2', align: 'right', sortable: true },
];

const STRATEGY_CHIP = 'text-gray-300 bg-surface-700/80 border border-surface-600';
const FINISHED = new Set(['CLOSED', 'EXPIRED', 'SKIPPED']);

const setupDate = (s: TradeSetup) => s.paperExitDate ?? s.signalDate ?? format(new Date(s.detectedAt), 'yyyy-MM-dd');

function download(name: string, headers: string[], rows: (string | number)[][]) {
  const csv  = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportStrategyCsv(rows: TradeSetup[]) {
  download('swingflow-strategy-record',
    ['Symbol', 'Strategy', 'Outcome', 'Entry', 'Stop', 'Fill', 'Fill date', 'Exit', 'Exit date', 'Exit reason', 'R', 'Sessions held', 'Signal date'],
    rows.map(s => [
      s.symbol, STRATEGY_LABELS[s.strategy] ?? s.strategy, paperStatus(s).label, s.entry.toFixed(2), s.stop.toFixed(2),
      s.paperFillPrice?.toFixed(2) ?? '', s.paperFillDate ?? '', s.paperExitPrice?.toFixed(2) ?? '', s.paperExitDate ?? '',
      s.paperExitReason ? EXIT_REASON_LABELS[s.paperExitReason] : '', s.paperR?.toFixed(2) ?? '', s.sessionsHeld, s.signalDate ?? '',
    ]));
}

function exportTradesCsv(rows: Trade[]) {
  download('swingflow-my-trades',
    ['Symbol', 'Strategy', 'Entry', 'Exit', 'Shares', 'P&L', 'Opened', 'Closed'],
    rows.map(t => [
      t.symbol, t.strategy ? STRATEGY_LABELS[t.strategy] : '', t.entryPrice.toFixed(2), t.exitPrice?.toFixed(2) ?? '', t.shares,
      t.realizedPnl?.toFixed(2) ?? '', format(new Date(t.openedAt), 'yyyy-MM-dd HH:mm'), t.closedAt ? format(new Date(t.closedAt), 'yyyy-MM-dd HH:mm') : '',
    ]));
}

export function HistoryPanel() {
  const { allSetups, loading }      = useAllSetups();
  const { closedTrades, loading: tradesLoading } = useClosedTrades();
  const [tab, setTab]               = useState<Tab>('mine');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const showHistoryLoader = useMinimumLoading(loading || tradesLoading, 450);

  const [symbolQuery, setSymbolQuery]       = useState('');
  const [statusFilter, setStatusFilter]     = useState<'all' | 'CLOSED' | 'EXPIRED' | 'SKIPPED'>('all');
  const [strategyFilter, setStrategyFilter] = useState<'all' | string>('all');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tradeSort, setTradeSort] = useState<{ key: TradeSortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });
  const [analytics, setAnalytics] = useState<SetupAnalytics | null>(null);

  useEffect(() => {
    setupsApi.analytics().then(setAnalytics).catch(() => {});
  }, []);

  const finished = useMemo(() => allSetups.filter(s => FINISHED.has(s.status)), [allSetups]);
  const strategies = useMemo(() => [...new Set(finished.map(s => s.strategy))], [finished]);

  const filtered = useMemo(() => {
    let rows = finished;
    if (symbolQuery) rows = rows.filter(s => s.symbol.includes(symbolQuery.toUpperCase()));
    if (statusFilter !== 'all')   rows = rows.filter(s => s.status === statusFilter);
    if (strategyFilter !== 'all') rows = rows.filter(s => s.strategy === strategyFilter);
    if (dateFrom) rows = rows.filter(s => setupDate(s) >= dateFrom);
    if (dateTo)   rows = rows.filter(s => setupDate(s) <= dateTo);

    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'symbol':   cmp = a.symbol.localeCompare(b.symbol); break;
        case 'strategy': cmp = (STRATEGY_LABELS[a.strategy] ?? '').localeCompare(STRATEGY_LABELS[b.strategy] ?? ''); break;
        case 'status':   cmp = paperStatus(a).label.localeCompare(paperStatus(b).label); break;
        case 'entry':    cmp = (a.paperFillPrice ?? a.entry) - (b.paperFillPrice ?? b.entry); break;
        case 'r':        cmp = (a.paperR ?? -Infinity) - (b.paperR ?? -Infinity); break;
        case 'date':     cmp = setupDate(a).localeCompare(setupDate(b)); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [finished, symbolQuery, statusFilter, strategyFilter, dateFrom, dateTo, sortKey, sortDir]);

  const strategyStats = useMemo(() => {
    const closed = filtered.filter(s => s.status === 'CLOSED' && s.paperR != null);
    const rs = closed.map(s => s.paperR as number);
    return {
      closed: closed.length,
      winRate: closed.length ? (rs.filter(r => r > 0).length / closed.length) * 100 : null,
      expectancy: closed.length ? rs.reduce((a, b) => a + b, 0) / closed.length : null,
      avgHold: closed.length ? closed.reduce((a, s) => a + s.sessionsHeld, 0) / closed.length : null,
    };
  }, [filtered]);

  const sortedTrades = useMemo(() => {
    const value = (t: Trade): number | string => {
      switch (tradeSort.key) {
        case 'symbol': return t.symbol;
        case 'entry':  return t.entryPrice;
        case 'exit':   return t.exitPrice ?? 0;
        case 'shares': return t.shares;
        case 'pnl':    return t.realizedPnl ?? 0;
        case 'date':   return t.closedAt ?? 0;
      }
    };
    return [...closedTrades].sort((a, b) => {
      const va = value(a), vb = value(b);
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
      return tradeSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [closedTrades, tradeSort]);

  const tradeStats = useMemo(() => {
    const wins = closedTrades.filter(t => (t.realizedPnl ?? 0) > 0).length;
    const total = closedTrades.reduce((a, t) => a + (t.realizedPnl ?? 0), 0);
    return { count: closedTrades.length, winRate: closedTrades.length ? (wins / closedTrades.length) * 100 : null, total };
  }, [closedTrades]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const handleTradeSort = (key: TradeSortKey) =>
    setTradeSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

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
      gsap.fromTo(surfaces, { autoAlpha: 0, y: 10 }, {
        autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out', stagger: 0.06, clearProps: 'opacity,transform',
      });
    }, pageRef);
    return () => ctx.revert();
  }, [prefersReducedMotion, showHistoryLoader, tab]);

  if (showHistoryLoader) {
    return (
      <PageContainer>
        <BrandedLoader message="Loading trade history…" subtext="Crunching your setup outcomes" className="min-h-[16rem]" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <div ref={pageRef} className="space-y-5">
        <div data-sf-history-surface className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="History view" className="inline-flex rounded-xl border border-surface-700 bg-surface-800 p-1">
            {([['mine', 'My trades'], ['strategy', 'Strategy record']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-lg text-sf-label transition-colors ${tab === key ? 'bg-surface-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'mine' && closedTrades.length > 0 && (
            <Button type="button" variant="secondary" onClick={() => exportTradesCsv(sortedTrades)} className="text-sf-label">
              <Download size={14} /> Export CSV
            </Button>
          )}
          {tab === 'strategy' && filtered.length > 0 && (
            <Button type="button" variant="secondary" onClick={() => exportStrategyCsv(filtered)} className="text-sf-label">
              <Download size={14} /> Export CSV
            </Button>
          )}
        </div>

        {tab === 'mine' ? (
          <>
            <div data-sf-history-surface className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Trades" value={String(tradeStats.count)} />
              <SummaryCard
                label="Win Rate"
                value={tradeStats.winRate != null ? `${tradeStats.winRate.toFixed(0)}%` : '—'}
                valueClass={tradeStats.winRate == null ? 'text-gray-200' : tradeStats.winRate >= 50 ? 'text-data-up' : 'text-data-down'}
              />
              <SummaryCard
                label="Total P&L"
                value={tradeStats.count ? formatMoney(tradeStats.total, true) : '—'}
                valueClass={!tradeStats.count ? 'text-gray-200' : tradeStats.total >= 0 ? 'text-data-up' : 'text-data-down'}
              />
              <SummaryCard label="Open Positions" value={String(analytics?.real.open ?? '—')} />
            </div>

            <div data-sf-history-surface>
              <DataTable
                id="tour-history-table"
                columns={TRADE_COLS}
                sortKey={tradeSort.key}
                sortDir={tradeSort.dir}
                onSort={handleTradeSort}
                isEmpty={sortedTrades.length === 0}
                emptyState={
                  <EmptyState
                    icon={ClipboardList}
                    heading="No closed trades yet"
                    subtext="Record a setup you took with “I took this trade”, then close it here when you exit."
                  />
                }
              >
                {sortedTrades.map(t => (
                  <div key={t.id} data-testid="my-trade-row" className="grid grid-cols-12 items-center px-5 py-3 border-b border-surface-700 last:border-0 text-sf-cell font-mono">
                    <span className="col-span-2 font-bold text-white">{t.symbol}</span>
                    <span className="col-span-2 text-right text-gray-100">${t.entryPrice.toFixed(2)}</span>
                    <span className="col-span-2 text-right text-gray-100">{t.exitPrice != null ? `$${t.exitPrice.toFixed(2)}` : '—'}</span>
                    <span className="col-span-2 text-right text-gray-300">{t.shares}</span>
                    <span className={`col-span-2 text-right ${(t.realizedPnl ?? 0) >= 0 ? 'text-data-up' : 'text-data-down'}`}>
                      {formatMoney(t.realizedPnl ?? 0, true)}
                    </span>
                    <span className="col-span-2 text-right text-sf-field text-gray-500 tabular-nums">
                      {t.closedAt ? format(new Date(t.closedAt), 'MMM d') : '—'}
                    </span>
                  </div>
                ))}
              </DataTable>
            </div>
          </>
        ) : (
          <>
            <div data-sf-history-surface className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Closed (paper)" value={String(strategyStats.closed)} />
              <SummaryCard label="Win Rate" value={strategyStats.winRate != null ? `${strategyStats.winRate.toFixed(0)}%` : '—'} />
              <SummaryCard
                label="Avg Result"
                value={strategyStats.expectancy != null ? formatR(strategyStats.expectancy) : '—'}
                valueClass={strategyStats.expectancy == null ? 'text-gray-200' : strategyStats.expectancy >= 0 ? 'text-data-up' : 'text-data-down'}
              />
              <SummaryCard label="Avg Hold" value={strategyStats.avgHold != null ? `${strategyStats.avgHold.toFixed(1)} d` : '—'} />
            </div>

            {analytics && (
              <div data-sf-history-surface className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard label="Setups This Week" value={String(analytics.setupsGeneratedThisWeek)} />
                <SummaryCard label="Paper Open" value={String(analytics.paper.open)} />
                <SummaryCard label="Waiting for Entry" value={String(analytics.paper.waiting)} />
                <SummaryCard label="Notif Delivery" value={analytics.notificationDeliveryRate != null ? `${analytics.notificationDeliveryRate.toFixed(0)}%` : '—'} />
              </div>
            )}

            {finished.length > 0 && (
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
                      maxLength={6}
                      className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
                    />
                  </div>
                  <div className="min-w-[130px]">
                    <label className="block text-sf-field text-gray-500 mb-1.5">Outcome</label>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                      className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="all">All</option>
                      <option value="CLOSED">Closed</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="SKIPPED">Skipped</option>
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
                      {strategies.map(s => <option key={s} value={s}>{STRATEGY_LABELS[s] ?? s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sf-field text-gray-500 mb-1.5">From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors date-input-theme" />
                  </div>
                  <div>
                    <label className="block text-sf-field text-gray-500 mb-1.5">To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sf-body text-white focus:outline-none focus:border-brand-500 transition-colors date-input-theme" />
                  </div>
                  {hasFilters && (
                    <Button type="button" variant="ghost" onClick={clearFilters} className="self-end pb-2">Clear filters</Button>
                  )}
                </div>
              </div>
            )}

            <div data-sf-history-surface>
              <DataTable
                id="tour-history-table"
                columns={STRATEGY_COLS}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                isEmpty={filtered.length === 0}
                emptyState={
                  <EmptyState
                    icon={ClipboardList}
                    heading={finished.length ? 'No setups match your filters' : 'No finished setups yet'}
                    subtext={finished.length ? 'Try adjusting or clearing the filters above.' : 'Every setup is paper-tracked; finished ones appear here.'}
                  />
                }
              >
                {filtered.map(s => (
                  <StrategyRow
                    key={s.id}
                    setup={s}
                    expanded={expandedId === s.id}
                    onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                  />
                ))}
              </DataTable>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function StrategyRow({ setup: s, expanded, onToggle }: { setup: TradeSetup; expanded: boolean; onToggle: () => void }) {
  const status = paperStatus(s);
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
          <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>{STRATEGY_LABELS[s.strategy] ?? s.strategy}</span>
        </div>
        <div className="col-span-3">
          <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${TONE_BADGE[status.tone]}`}>
            {s.paperExitReason ? EXIT_REASON_LABELS[s.paperExitReason] : status.label}
          </span>
        </div>
        <span className="col-span-1 text-right text-gray-100">{s.paperFillPrice != null ? `$${s.paperFillPrice.toFixed(2)}` : '—'}</span>
        <span className={`col-span-2 text-right ${s.paperR == null ? 'text-data-neutral' : s.paperR >= 0 ? 'text-data-up' : 'text-data-down'}`}>
          {s.paperR != null ? formatR(s.paperR) : '—'}
        </span>
        <span className="col-span-1 text-right text-sf-field text-gray-500 tabular-nums">{setupDate(s).slice(5)}</span>
        <div className="col-span-1 flex justify-end text-gray-500">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 bg-surface-750/40 border-t border-surface-700/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <DetailStat label="Entry" value={`$${s.entry.toFixed(2)}`} />
            <DetailStat label="Initial stop" value={`$${s.stop.toFixed(2)}`} valueClass="text-data-down" />
            <DetailStat label="Exit plan" value={exitSummary(s)} valueClass="text-gray-300" />
            <DetailStat label="Signal" value={s.signalDate ?? '—'} valueClass="text-gray-300" />
            {s.paperExitPrice != null && <DetailStat label="Exit" value={`$${s.paperExitPrice.toFixed(2)} · ${s.paperExitDate}`} />}
            <DetailStat label="Sessions held" value={String(s.sessionsHeld)} valueClass="text-data-neutral" />
            <DetailStat label="Confidence" value={`${s.confidence}%`} valueClass="text-data-neutral" />
            {s.dismissedAt != null && <DetailStat label="Dismissed" value={format(new Date(s.dismissedAt), 'MMM d')} valueClass="text-gray-400" />}
          </div>
          {s.notes && (
            <p className="mt-3 text-sf-body italic leading-relaxed border-t border-surface-700 pt-3">{s.notes}</p>
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
