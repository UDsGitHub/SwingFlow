import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { SectionLabel } from '../ui/SectionLabel';
import { GoalStatus } from '../../types';
import { PERIOD_ADJECTIVE, PERIOD_CURRENT, PERIOD_NOUN, VERDICT_CLASSES, VERDICT_LABELS, money } from '../../lib/goalDisplay';

interface GoalTrackerProps {
  goal: GoalStatus | null;
  setupCount: number;
  onLogTrade: () => void;
}

export function GoalTracker({ goal, setupCount, onLogTrade }: GoalTrackerProps) {
  const pnl = goal?.progress.realizedPnl ?? 0;
  const target = goal?.goalAmount ?? 0;
  const noun = goal ? PERIOD_NOUN[goal.goalPeriod] : 'period';
  const f = goal?.feasibility;

  // Progress toward the goal stays within 0–100%; a loss shows in the P&L figure, not as negative progress.
  const progressPercent = target > 0 ? Math.min(Math.max((pnl / target) * 100, 0), 100) : 0;
  const barClass =
    target > 0 && pnl >= target
      ? 'bg-gradient-to-r from-bull-600 to-data-up'
      : pnl >= 0
        ? 'bg-gradient-to-r from-surface-500 to-data-up'
        : 'bg-gradient-to-r from-surface-600 to-data-down';

  return (
    <div id="tour-goal" className="bg-surface-800 rounded-2xl border border-surface-700 p-4 sm:p-5 space-y-4 sm:space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel as="p" noMargin className="mb-0">
            {goal ? `${PERIOD_CURRENT[goal.goalPeriod]}'s` : 'Real'} P&L
          </SectionLabel>
          <button
            type="button"
            onClick={onLogTrade}
            title="Close one of your open trades"
            className="flex items-center gap-1 text-sf-field text-gray-500 hover:text-brand-400 transition-colors"
          >
            <PencilLine size={12} />
            Close trade
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
          <span
            className={`text-2xl sm:text-3xl font-bold font-mono leading-tight ${
              pnl >= 0 ? 'text-data-up' : 'text-data-down'
            }`}
          >
            {money(pnl)}
          </span>
          {goal && <span className="text-sf-body text-gray-500">/ {money(target)} {PERIOD_ADJECTIVE[goal.goalPeriod].toLowerCase()} goal</span>}
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

      {f && (
        <div data-testid="goal-feasibility" className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sf-field font-semibold px-2 py-0.5 rounded-full border ${VERDICT_CLASSES[f.verdict]}`}>
              {VERDICT_LABELS[f.verdict]}
            </span>
            <span className="text-sf-field text-gray-400">
              Hit in {f.hitRate.toFixed(0)}% of past {noun}s
            </span>
          </div>
          {f.verdict !== 'REALISTIC' && (
            <Link to="/settings" className="inline-block text-sf-field text-brand-400 hover:text-brand-300">
              See what&apos;s realistic →
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Account" value={goal ? money(goal.accountSize) : '—'} />
        <Stat label="Pipeline" value={`${setupCount} active`} />
        <Stat label={`Expected / ${noun}`} value={f ? money(f.expectedPerPeriod) : '—'} />
        <Stat label="Remaining" value={goal ? money(Math.max(target - pnl, 0)) : '—'} />
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
