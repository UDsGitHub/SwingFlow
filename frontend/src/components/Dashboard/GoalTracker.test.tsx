import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalTracker } from './GoalTracker';
import { renderWithProviders } from '../../test/render';
import { makeFeasibility, makeGoal } from '../../test/fixtures';

const withPnl = (realizedPnl: number, over = {}) => makeGoal({ progress: { periodStart: '2026-10-19', realizedPnl }, ...over });
const props = { setupCount: 2, onLogTrade: () => {} };

describe('GoalTracker', () => {
  it('shows this period\'s P&L against the goal and what remains', () => {
    renderWithProviders(<GoalTracker {...props} goal={withPnl(40)} />);
    expect(screen.getByText("This week's P&L")).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByText('/ $100 weekly goal')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('$60')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(screen.getByText('Expected / week')).toBeInTheDocument();
    expect(screen.getByText('Expected / week').nextSibling).toHaveTextContent('$10');
  });

  it('labels the period it tracks', () => {
    renderWithProviders(<GoalTracker {...props} goal={withPnl(0, { goalPeriod: 'MONTHLY' })} />);
    expect(screen.getByText("This month's P&L")).toBeInTheDocument();
    expect(screen.getByText('/ $100 monthly goal')).toBeInTheDocument();
    expect(screen.getByText('Hit in 3% of past months')).toBeInTheDocument();
  });

  it('caps progress at 100% and remaining at $0 once the goal is exceeded', () => {
    renderWithProviders(<GoalTracker {...props} goal={withPnl(187)} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('shows 0% progress for a losing period', () => {
    renderWithProviders(<GoalTracker {...props} goal={withPnl(-50)} />);
    expect(screen.getByText('−$50')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows the verdict and links to settings when the goal is out of reach', () => {
    renderWithProviders(<GoalTracker {...props} goal={withPnl(0)} />);
    expect(screen.getByText('Unrealistic')).toBeInTheDocument();
    expect(screen.getByText('Hit in 3% of past weeks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /what's realistic/i })).toHaveAttribute('href', '/settings');
  });

  it('drops the settings link for a realistic goal', () => {
    renderWithProviders(<GoalTracker {...props} goal={withPnl(0, { feasibility: makeFeasibility({ verdict: 'REALISTIC' }) })} />);
    expect(screen.getByText('Realistic')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /what's realistic/i })).not.toBeInTheDocument();
  });

  it('shows placeholders while the goal loads', () => {
    renderWithProviders(<GoalTracker {...props} goal={null} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByTestId('goal-feasibility')).not.toBeInTheDocument();
  });

  it('opens the trade log', async () => {
    const onLogTrade = vi.fn();
    renderWithProviders(<GoalTracker {...props} goal={withPnl(0)} onLogTrade={onLogTrade} />);
    await userEvent.click(screen.getByRole('button', { name: /close trade/i }));
    expect(onLogTrade).toHaveBeenCalledOnce();
  });
});
