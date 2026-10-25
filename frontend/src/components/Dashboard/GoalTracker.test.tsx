import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalTracker } from './GoalTracker';

const props = { dailyGoal: 100, accountSize: 5000, setupCount: 2, bestRR: 2.5, dailyPnl: 0, onLogTrade: () => {} };

describe('GoalTracker', () => {
  it('shows progress toward the goal and what remains', () => {
    render(<GoalTracker {...props} dailyPnl={40} />);
    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('$60')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(screen.getByText('2.5:1')).toBeInTheDocument();
  });

  it('caps progress at 100% and remaining at $0 once the goal is exceeded', () => {
    render(<GoalTracker {...props} dailyPnl={187} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('shows 0% progress for a losing day', () => {
    render(<GoalTracker {...props} dailyPnl={-50} />);
    expect(screen.getByText('$-50')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows a dash when there is no risk/reward yet', () => {
    render(<GoalTracker {...props} bestRR={0} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('opens the trade log', async () => {
    const onLogTrade = vi.fn();
    render(<GoalTracker {...props} onLogTrade={onLogTrade} />);
    await userEvent.click(screen.getByRole('button', { name: /close trade/i }));
    expect(onLogTrade).toHaveBeenCalledOnce();
  });
});
