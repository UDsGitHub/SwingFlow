import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useAllSetups } from '../../hooks/useSetups';
import { DataTable, ColDef } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { SectionLabel } from '../ui/SectionLabel';
import { EXIT_REASON_LABELS, STRATEGY_LABELS, TONE_BADGE, formatR, paperStatus } from '../../lib/setupDisplay';
import { TradeSetup } from '../../types';

type RecentKey = 'sym' | 'strat' | 'fill' | 'exit' | 'res' | 'why' | 'dt';

const RECENT_COLS: ColDef<RecentKey>[] = [
  { key: 'sym',   label: 'Symbol',   cols: 'col-span-2', sortable: false },
  { key: 'strat', label: 'Strategy', cols: 'col-span-2', sortable: false },
  { key: 'fill',  label: 'Fill',     cols: 'col-span-2', align: 'right', sortable: false },
  { key: 'exit',  label: 'Exit',     cols: 'col-span-2', align: 'right', sortable: false },
  { key: 'res',   label: 'Result',   cols: 'col-span-1', align: 'right', sortable: false },
  { key: 'why',   label: 'Outcome',  cols: 'col-span-2', align: 'center', sortable: false },
  { key: 'dt',    label: 'Date',     cols: 'col-span-1', align: 'right', sortable: false },
];

const STRATEGY_CHIP = 'text-gray-200 bg-surface-700/80 border border-surface-600';
const FINISHED = new Set(['CLOSED', 'EXPIRED', 'SKIPPED']);

const finishedOn = (s: TradeSetup) => s.paperExitDate ?? s.signalDate ?? '';

/** The latest finished paper trades — the strategy's live track record. */
export function RecentTrades() {
  const navigate = useNavigate();
  const { allSetups, loading } = useAllSetups();
  const setups = allSetups
    .filter(s => FINISHED.has(s.status))
    .sort((a, b) => finishedOn(b).localeCompare(finishedOn(a)))
    .slice(0, 8);

  return (
    <div>
      <SectionLabel>Recent Strategy Results</SectionLabel>
      {loading ? (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden space-y-px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={RECENT_COLS}
          sortKey="sym"
          sortDir="asc"
          isEmpty={setups.length === 0}
          emptyState={
            <EmptyState
              icon={ClipboardList}
              heading="No finished setups yet"
              subtext="Every setup is paper-tracked automatically; results appear here when they finish."
            />
          }
        >
          {setups.map(s => {
            const status = paperStatus(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/setup/${s.id}`, { state: { from: 'history' } })}
                className="w-full grid grid-cols-12 items-center px-5 py-3 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors text-left text-sf-cell font-mono"
              >
                <span className="col-span-2 font-bold text-white">{s.symbol}</span>
                <div className="col-span-2">
                  <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>
                    {STRATEGY_LABELS[s.strategy] ?? s.strategy}
                  </span>
                </div>
                <span className="col-span-2 text-right text-gray-100">
                  {s.paperFillPrice != null ? `$${s.paperFillPrice.toFixed(2)}` : '—'}
                </span>
                <span className="col-span-2 text-right text-gray-100">
                  {s.paperExitPrice != null ? `$${s.paperExitPrice.toFixed(2)}` : '—'}
                </span>
                <span className={`col-span-1 text-right ${s.paperR == null ? 'text-data-neutral' : s.paperR >= 0 ? 'text-data-up' : 'text-data-down'}`}>
                  {s.paperR != null ? formatR(s.paperR) : '—'}
                </span>
                <div className="col-span-2 flex justify-center">
                  <span className={`text-sf-field px-1.5 py-0.5 rounded font-medium ${TONE_BADGE[status.tone]}`}>
                    {s.paperExitReason ? EXIT_REASON_LABELS[s.paperExitReason] : status.label}
                  </span>
                </div>
                <span className="col-span-1 text-right text-sf-field text-gray-500 tabular-nums">
                  {finishedOn(s).slice(5)}
                </span>
              </button>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
