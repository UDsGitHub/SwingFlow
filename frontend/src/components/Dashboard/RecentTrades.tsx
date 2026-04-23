import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { useAllSetups } from '../../hooks/useSetups';
import { DataTable, ColDef } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { SectionLabel } from '../ui/SectionLabel';

type RecentKey = 'sym' | 'strat' | 'entry' | 'tgt' | 'rr' | 'st' | 'dt';

const RECENT_COLS: ColDef<RecentKey>[] = [
  { key: 'sym',   label: 'Symbol',   cols: 'col-span-2', sortable: false },
  { key: 'strat', label: 'Strategy', cols: 'col-span-3', sortable: false },
  { key: 'entry', label: 'Entry',    cols: 'col-span-2', align: 'right', sortable: false },
  { key: 'tgt',   label: 'Target',   cols: 'col-span-2', align: 'right', sortable: false },
  { key: 'rr',    label: 'R/R',      cols: 'col-span-1', align: 'center', sortable: false },
  { key: 'st',    label: 'Status',   cols: 'col-span-1', align: 'center', sortable: false },
  { key: 'dt',    label: 'Date',     cols: 'col-span-1', align: 'right', sortable: false },
];

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const STRATEGY_CHIP = 'text-gray-200 bg-surface-700/80 border border-surface-600';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'border border-surface-500 text-gray-300 bg-surface-700/50',
  TRIGGERED: 'border border-surface-500 text-gray-300 bg-surface-700/50',
  COMPLETED: 'border border-surface-500 text-gray-300 bg-surface-700/50',
  EXPIRED:   'border border-surface-600 text-gray-400 bg-surface-800',
};

export function RecentTrades() {
  const navigate = useNavigate();
  const { allSetups, loading } = useAllSetups();
  const setups = allSetups
    .filter(s => s.status === 'COMPLETED' || s.status === 'EXPIRED')
    .slice(0, 8);

  return (
    <div>
      <SectionLabel>Recent Closed Setups</SectionLabel>

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
              heading="No recent trades"
              subtext="Closed setups will appear here after you record outcomes."
            />
          }
        >
          {setups.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/setup/${s.id}`, { state: { from: 'history' } })}
              className="w-full grid grid-cols-12 items-center px-5 py-3 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors text-left text-sf-cell font-mono"
            >
              <span className="col-span-2 font-bold text-white">{s.symbol}</span>

              <div className="col-span-3">
                <span className={`text-sf-field px-2 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>
                  {STRATEGY_LABELS[s.strategy] ?? s.strategy}
                </span>
              </div>

              <span className="col-span-2 text-right text-gray-100">
                ${s.entry.toFixed(2)}
              </span>
              <span className="col-span-2 text-right text-data-up">
                ${s.target.toFixed(2)}
              </span>
              <span className="col-span-1 text-center text-data-neutral">
                {s.riskReward}:1
              </span>

              <div className="col-span-1 flex justify-center">
                <span className={`text-sf-field px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[s.status] ?? ''}`}>
                  {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                </span>
              </div>

              <span className="col-span-1 text-right text-sf-field text-gray-500 tabular-nums">
                {format(new Date(s.detectedAt), 'MMM d')}
              </span>
            </button>
          ))}
        </DataTable>
      )}
    </div>
  );
}
