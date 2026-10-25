import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaperRecordPanel } from './PaperRecordPanel';
import { makeSetup } from '../../test/fixtures';

describe('PaperRecordPanel', () => {
  it('shows a setup waiting for its entry', () => {
    render(<PaperRecordPanel setup={makeSetup()} />);
    expect(screen.getByText('Waiting for entry')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for a break above \$98\.35/)).toBeInTheDocument();
  });

  it('shows an open paper trade with its trailing stop and sessions held', () => {
    render(<PaperRecordPanel setup={makeSetup({ status: 'TRIGGERED', paperFillPrice: 98.4, paperFillDate: '2026-10-26', currentStop: 97.1, sessionsHeld: 6 })} />);
    expect(screen.getByText('Filled $98.40 on 2026-10-26')).toBeInTheDocument();
    expect(screen.getByText(/Stop \$97\.10 · 6\/40 sessions · Trailing stop 3× ATR/)).toBeInTheDocument();
  });

  it('shows how a closed paper trade ended, in R', () => {
    render(<PaperRecordPanel setup={makeSetup({
      status: 'CLOSED', paperFillPrice: 98.4, paperFillDate: '2026-10-26', paperExitPrice: 104.1, paperExitDate: '2026-11-04',
      paperExitReason: 'TRAIL_STOP', paperR: 1.28, sessionsHeld: 8,
    })} />);
    expect(screen.getByText('Closed +1.3R')).toBeInTheDocument();
    expect(screen.getByText('Trailing stop at $104.10 on 2026-11-04 · +1.3R after 8 sessions')).toBeInTheDocument();
  });

  it('explains setups that never entered', () => {
    const { rerender } = render(<PaperRecordPanel setup={makeSetup({ status: 'EXPIRED' })} />);
    expect(screen.getByText(/Never reached the entry within 3 sessions/)).toBeInTheDocument();
    rerender(<PaperRecordPanel setup={makeSetup({ status: 'SKIPPED' })} />);
    expect(screen.getByText(/opened more than 1% above the entry/)).toBeInTheDocument();
  });
});
