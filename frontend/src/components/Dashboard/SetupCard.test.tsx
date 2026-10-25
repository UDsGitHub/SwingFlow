import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupCard } from './SetupCard';
import { makeSetup } from '../../test/fixtures';

describe('SetupCard', () => {
  it('shows the trade plan levels, sizing, status and execution instructions', () => {
    render(<SetupCard setup={makeSetup()} onClick={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('AXP')).toBeInTheDocument();
    expect(screen.getByText('Reversal')).toBeInTheDocument();
    expect(screen.getByText('$98.35')).toBeInTheDocument();
    expect(screen.getByText('$93.94')).toBeInTheDocument();
    expect(screen.getByText('17 sh')).toBeInTheDocument();
    expect(screen.getByText('WAIT for break above 98.35')).toBeInTheDocument();
    expect(screen.getByTestId('paper-status')).toHaveTextContent('Waiting for entry');
  });

  it('shows a trailing exit instead of a target when the plan has none', () => {
    render(<SetupCard setup={makeSetup()} onClick={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('Trailing')).toBeInTheDocument();
    expect(screen.queryByText('$109.37')).not.toBeInTheDocument();
    expect(screen.getByText('≤40d')).toBeInTheDocument();
  });

  it('shows a fixed target and R/R when the plan has one', () => {
    render(<SetupCard setup={makeSetup({ exitPlan: { maxHoldDays: 10 } })} onClick={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('$109.37')).toBeInTheDocument();
    expect(screen.getByText('2.5:1')).toBeInTheDocument();
  });

  it('shows the raised trailing stop and the paper fill once triggered', () => {
    render(<SetupCard setup={makeSetup({ status: 'TRIGGERED', paperFillPrice: 98.4, currentStop: 97.1 })} onClick={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('Trail stop')).toBeInTheDocument();
    expect(screen.getByText('$97.10')).toBeInTheDocument();
    expect(screen.getByTestId('paper-status')).toHaveTextContent('Triggered $98.40');
  });

  it('opens the setup on click, and dismissing does not open it', async () => {
    const onClick = vi.fn();
    const onDismiss = vi.fn();
    render(<SetupCard setup={makeSetup()} onClick={onClick} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByTitle('Dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('AXP'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
