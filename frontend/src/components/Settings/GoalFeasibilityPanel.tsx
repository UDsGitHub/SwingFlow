import { Loader2 } from 'lucide-react';
import { AccountConfig, GoalStatus } from '../../types';
import { PERIOD_ADJECTIVE, PERIOD_NOUN, VERDICT_CLASSES, VERDICT_LABELS, money } from '../../lib/goalDisplay';
import { Button } from '../ui/Button';

interface GoalFeasibilityPanelProps {
  /** Feasibility of the settings in the form (saved or not). */
  preview: GoalStatus | null;
  fetching: boolean;
  /** The form has errors, so there is nothing to judge. */
  invalid: boolean;
  /** Fill form fields from a suggestion. Never saves. */
  onApply: (patch: Partial<AccountConfig>) => void;
}

/** Live check of the goal in the form against the measured edge, with suggestions that only fill the form. */
export function GoalFeasibilityPanel({ preview, fetching, invalid, onApply }: GoalFeasibilityPanelProps) {
  if (invalid) return <p className="text-sf-body text-gray-500">Fix the highlighted fields to check your goal.</p>;
  if (!preview) {
    return (
      <p className="flex items-center gap-2 text-sf-body text-gray-500">
        <Loader2 size={14} className="animate-spin" /> Checking your goal…
      </p>
    );
  }

  const f = preview.feasibility;
  const noun = PERIOD_NOUN[preview.goalPeriod];
  const s = f.suggestions;
  const riskDollars = preview.accountSize * (preview.riskPercent / 100);
  const moreRiskBarelyHelps = s.riskPercent === null && s.bestWithinCeiling.riskPercent > preview.riskPercent;
  const edgeLine = f.edge.source === 'PAPER'
    ? `Your paper record: ${f.edge.paper.closed} closed trades at ${f.edge.expectancyR >= 0 ? '+' : ''}${f.edge.expectancyR.toFixed(2)}R each (below the backtest's +${f.edge.backtest.expectancyR.toFixed(2)}R).`
    : `Backtest ${f.edge.backtest.from} → ${f.edge.backtest.to}: ${f.edge.backtest.closedTrades} trades at +${f.edge.backtest.expectancyR.toFixed(2)}R each. Paper record so far: ${f.edge.paper.closed}/${f.edge.paperMinTrades} trades.`;

  return (
    <div data-testid="goal-preview" className={`space-y-4 transition-opacity ${fetching ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span data-testid="goal-verdict" className={`text-sf-label font-semibold px-2.5 py-0.5 rounded-full border ${VERDICT_CLASSES[f.verdict]}`}>
          {VERDICT_LABELS[f.verdict]}
        </span>
        <span className="text-sf-body text-gray-300">
          {money(preview.goalAmount)} / {noun}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Stat label={`Expected / ${noun}`} value={money(f.expectedPerPeriod)} />
        <Stat label={`${PERIOD_ADJECTIVE[preview.goalPeriod]} hit rate`} value={`${f.hitRate.toFixed(0)}%`} />
        <Stat label="Risk / trade" value={money(riskDollars)} />
        <Stat label="Typical worst drawdown" value={money(-f.worstDrawdown)} />
      </dl>

      <p className="text-sf-field text-gray-400">
        About {f.annualReturnPct.toFixed(1)}% a year on capital, {f.tradesPerWeek.toFixed(1)} trades a week.
        The median {noun} made {money(f.medianPerPeriod)}.
      </p>

      {f.verdict !== 'REALISTIC' && (
        <div className="space-y-3 pt-3 border-t border-surface-700">
          {s.goalAmount !== null && (
            <Suggestion
              text={`These settings have averaged about ${money(s.goalAmount)} a ${noun}.`}
              action={`Use ${money(s.goalAmount)} / ${noun}`}
              onClick={() => onApply({ goalAmount: String(s.goalAmount) })}
            />
          )}
          {s.goalPeriod && (
            <Suggestion
              text={`Trades are lumpy, so few ${noun}s reach even the average. A ${PERIOD_ADJECTIVE[s.goalPeriod].toLowerCase()} goal smooths that out.`}
              action={`Track ${PERIOD_ADJECTIVE[s.goalPeriod].toLowerCase()}`}
              onClick={() => onApply({ goalPeriod: s.goalPeriod as AccountConfig['goalPeriod'] })}
            />
          )}
          {s.riskPercent !== null && (
            <Suggestion
              text={`Risking ${s.riskPercent}% per trade (within your ceiling) would reach this goal on average.`}
              action={`Use ${s.riskPercent}% risk`}
              onClick={() => onApply({ riskPercent: String(s.riskPercent) })}
            />
          )}
          {moreRiskBarelyHelps && (
            <p className="text-sf-field text-gray-400">
              Raising risk to {s.bestWithinCeiling.riskPercent}% would only reach about {money(s.bestWithinCeiling.expectedPerPeriod)} a {noun}:
              positions are already limited by buying power, so more risk mostly deepens drawdowns.
            </p>
          )}
          {s.accountSize !== null && (
            <p className="text-sf-field text-gray-400">
              Reaching {money(preview.goalAmount)} a {noun} at {preview.riskPercent}% risk takes an account of about{' '}
              <span className="font-mono text-gray-200">{money(s.accountSize)}</span>.
            </p>
          )}
          {s.goalAmount === null && (
            <p className="text-sf-field text-data-down">The current edge projects no profit, so no goal is realistic yet.</p>
          )}
          <p className="text-sf-field text-gray-500">Suggestions only fill the form. Nothing is saved until you press Save.</p>
        </div>
      )}

      <p className="text-sf-field text-gray-500">{edgeLine}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3">
      <dt className="text-sf-field text-gray-500 mb-1">{label}</dt>
      <dd className="font-mono text-sf-value text-gray-100">{value}</dd>
    </div>
  );
}

function Suggestion({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sf-field text-gray-300">{text}</p>
      <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}
