import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupCard } from './SetupCard';
import { makeSetup } from '../../test/fixtures';

describe('SetupCard', () => {
  it('shows the trade plan levels, sizing and execution instructions', () => {
    render(<SetupCard setup={makeSetup()} onClick={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('AXP')).toBeInTheDocument();
    expect(screen.getByText('Reversal')).toBeInTheDocument();
    expect(screen.getByText('$98.35')).toBeInTheDocument();
    expect(screen.getByText('$93.94')).toBeInTheDocument();
    expect(screen.getByText('$109.37')).toBeInTheDocument();
    expect(screen.getByText('17 sh')).toBeInTheDocument();
    expect(screen.getByText('WAIT for break above 98.35')).toBeInTheDocument();
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
