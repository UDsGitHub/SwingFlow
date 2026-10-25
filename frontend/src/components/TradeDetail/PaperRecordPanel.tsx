import { TradeSetup } from '../../types';
import { SectionLabel } from '../ui/SectionLabel';
import { EXIT_REASON_LABELS, TONE_BADGE, exitSummary, formatR, paperStatus } from '../../lib/setupDisplay';

interface Step {
  label: string;
  value: string;
  done: boolean;
}

/** The strategy's own (paper) trade for this setup, tracked automatically with the backtest's rules. */
export function PaperRecordPanel({ setup }: { setup: TradeSetup }) {
  const status = paperStatus(setup);
  const maxHold = setup.exitPlan?.maxHoldDays ?? 40;

  const entryStep: Step = setup.paperFillPrice != null
    ? { label: 'Entry', value: `Filled $${setup.paperFillPrice.toFixed(2)} on ${setup.paperFillDate}`, done: true }
    : setup.status === 'EXPIRED'
      ? { label: 'Entry', value: 'Never reached the entry within 3 sessions', done: true }
      : setup.status === 'SKIPPED'
        ? { label: 'Entry', value: 'Skipped — opened more than 1% above the entry', done: true }
        : { label: 'Entry', value: `Waiting for a break above $${setup.entry.toFixed(2)} (up to 3 sessions)`, done: false };

  const steps: Step[] = [
    { label: 'Signal', value: `${setup.signalDate ?? new Date(setup.detectedAt).toISOString().slice(0, 10)} close`, done: true },
    entryStep,
  ];
  if (setup.status === 'TRIGGERED') {
    steps.push({
      label: 'Managing',
      value: `Stop $${setup.currentStop.toFixed(2)} · ${setup.sessionsHeld}/${maxHold} sessions · ${exitSummary(setup)}`,
      done: false,
    });
  }
  if (setup.status === 'CLOSED' && setup.paperExitPrice != null) {
    steps.push({
      label: 'Exit',
      value: `${EXIT_REASON_LABELS[setup.paperExitReason ?? 'STOP']} at $${setup.paperExitPrice.toFixed(2)} on ${setup.paperExitDate}`
        + (setup.paperR != null ? ` · ${formatR(setup.paperR)} after ${setup.sessionsHeld} sessions` : ''),
      done: true,
    });
  }

  return (
    <div id="paper-record" className="bg-surface-800 rounded-2xl border border-surface-700 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel as="h3" noMargin>Strategy Record</SectionLabel>
        <span className={`text-sf-field px-2 py-0.5 rounded-md ${TONE_BADGE[status.tone]}`}>{status.label}</span>
      </div>
      <p className="text-sf-field text-gray-500">
        SwingFlow tracks every setup as a paper trade with the same rules as the backtest, whether or not you take it.
      </p>
      <ol className="space-y-2">
        {steps.map(step => (
          <li key={step.label} className="flex gap-3 text-sf-body">
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${step.done ? 'bg-brand-400' : 'border border-gray-500'}`} />
            <span>
              <span className="text-gray-400">{step.label}: </span>
              <span className="text-gray-200">{step.value}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
