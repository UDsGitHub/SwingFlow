import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalFeasibilityPanel } from './GoalFeasibilityPanel';
import { makeFeasibility, makeGoal } from '../../test/fixtures';

const base = { fetching: false, invalid: false, onApply: () => {} };

describe('GoalFeasibilityPanel', () => {
  it('shows the verdict, expected P&L, hit rate, risk and drawdown at the form settings', () => {
    render(<GoalFeasibilityPanel {...base} preview={makeGoal()} />);
    expect(screen.getByTestId('goal-verdict')).toHaveTextContent('Unrealistic');
    expect(screen.getByText('Expected / week').nextSibling).toHaveTextContent('$10');
    expect(screen.getByText('Weekly hit rate').nextSibling).toHaveTextContent('3%');
    expect(screen.getByText('Risk / trade').nextSibling).toHaveTextContent('$75');
    expect(screen.getByText('Typical worst drawdown').nextSibling).toHaveTextContent('−$1,131');
    expect(screen.getByText(/816 trades at \+0\.23R/)).toBeInTheDocument();
    expect(screen.getByText(/Paper record so far: 0\/30/)).toBeInTheDocument();
  });

  it('offers a realistic goal, a longer period and the account size, and only fills the form', async () => {
    const onApply = vi.fn();
    render(<GoalFeasibilityPanel {...base} preview={makeGoal()} onApply={onApply} />);
    expect(screen.getByText(/takes an account of about/)).toHaveTextContent('$49,500');
    await userEvent.click(screen.getByRole('button', { name: 'Use $10 / week' }));
    expect(onApply).toHaveBeenLastCalledWith({ goalAmount: '10' });
    await userEvent.click(screen.getByRole('button', { name: 'Track monthly' }));
    expect(onApply).toHaveBeenLastCalledWith({ goalPeriod: 'MONTHLY' });
    expect(screen.getByText(/Nothing is saved until you press Save/)).toBeInTheDocument();
  });

  it('suggests more risk only when the engine says it is worth it, and explains when it is not', async () => {
    const onApply = vi.fn();
    const worth = makeFeasibility({ suggestions: { ...makeFeasibility().suggestions, riskPercent: 2 } });
    const { unmount } = render(<GoalFeasibilityPanel {...base} preview={makeGoal({ feasibility: worth })} onApply={onApply} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use 2% risk' }));
    expect(onApply).toHaveBeenCalledWith({ riskPercent: '2' });
    unmount();

    const notWorth = makeFeasibility({ suggestions: { ...makeFeasibility().suggestions, bestWithinCeiling: { riskPercent: 2, expectedPerPeriod: 10.4 } } });
    render(<GoalFeasibilityPanel {...base} preview={makeGoal({ feasibility: notWorth })} />);
    expect(screen.queryByRole('button', { name: /risk$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/limited by buying power/)).toHaveTextContent('Raising risk to 2% would only reach about $10');
  });

  it('shows no suggestions for a realistic goal', () => {
    render(<GoalFeasibilityPanel {...base} preview={makeGoal({ goalAmount: 10, feasibility: makeFeasibility({ verdict: 'REALISTIC' }) })} />);
    expect(screen.getByTestId('goal-verdict')).toHaveTextContent('Realistic');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says when the live edge is gone and which record it used', () => {
    const gone = makeFeasibility({
      expectedPerPeriod: 0,
      edge: { ...makeFeasibility().edge, source: 'PAPER', expectancyR: -0.1, paper: { closed: 34, expectancyR: -0.1 } },
      suggestions: { riskPercent: null, bestWithinCeiling: { riskPercent: 1.5, expectedPerPeriod: 0 }, accountSize: null, goalAmount: null, goalPeriod: null },
    });
    render(<GoalFeasibilityPanel {...base} preview={makeGoal({ feasibility: gone })} />);
    expect(screen.getByText(/no goal is realistic yet/)).toBeInTheDocument();
    expect(screen.getByText(/Your paper record: 34 closed trades at -0\.10R/)).toBeInTheDocument();
  });

  it('waits for valid input before judging', () => {
    render(<GoalFeasibilityPanel {...base} preview={null} invalid />);
    expect(screen.getByText(/Fix the highlighted fields/)).toBeInTheDocument();
  });
});
