import { PencilLine } from 'lucide-react';
import { SectionLabel } from '../ui/SectionLabel';

interface GoalTrackerProps {
  dailyGoal: number;
  accountSize: number;
  setupCount: number;
  bestRR: number;
  dailyPnl: number;
  onLogTrade: () => void;
}

export function GoalTracker({ dailyGoal, accountSize, setupCount, bestRR, dailyPnl, onLogTrade }: GoalTrackerProps) {
  const progressPercent = dailyGoal > 0 ? Math.min((dailyPnl / dailyGoal) * 100, 100) : 0;
  const barPositive = dailyPnl >= 0;
  const barClass =
    dailyPnl >= dailyGoal
      ? 'bg-gradient-to-r from-bull-600 to-data-up'
      : barPositive
        ? 'bg-gradient-to-r from-surface-500 to-data-up'
        : 'bg-gradient-to-r from-surface-600 to-data-down';

  return (
    <div id="tour-goal" className="bg-surface-800 rounded-2xl border border-surface-700 p-4 sm:p-5 space-y-4 sm:space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel as="p" noMargin className="mb-0">
            Today&apos;s P&L
          </SectionLabel>
          <button
            type="button"
            onClick={onLogTrade}
            title="Log a trade outcome"
            className="flex items-center gap-1 text-sf-field text-gray-500 hover:text-brand-400 transition-colors"
          >
            <PencilLine size={12} />
            Log trade
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
          <span
            className={`text-2xl sm:text-3xl font-bold font-mono leading-tight ${
              dailyPnl >= 0 ? 'text-data-up' : 'text-data-down'
            }`}
          >
            ${dailyPnl.toFixed(0)}
          </span>
          <span className="text-sf-body text-gray-500">/ ${dailyGoal} goal</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sf-field text-gray-500 mb-2">
          <span>Progress to goal</span>
          <span className="tabular-nums">{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barClass} rounded-full transition-all duration-700`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Account" value={`$${accountSize.toLocaleString()}`} />
        <Stat label="Best R/R" value={bestRR > 0 ? `${bestRR}:1` : '—'} />
        <Stat label="Pipeline" value={`${setupCount} active`} />
        <Stat label="Remaining" value={`$${Math.max(dailyGoal - dailyPnl, 0).toFixed(0)}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3 lg:p-2 xl:p-3">
      <div className="text-sf-field text-gray-500 mb-1">{label}</div>
      {/* lg–xl (1024–1279px): slightly smaller values only; labels unchanged */}
      <div className="font-mono font-semibold text-gray-100 text-sf-value lg:text-[0.75rem] lg:leading-5 xl:text-[1.125rem] xl:leading-6">
        {value}
      </div>
    </div>
  );
}
