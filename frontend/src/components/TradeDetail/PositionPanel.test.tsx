import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PositionPanel } from './PositionPanel';
import { setupsApi, tradesApi } from '../../services/api';
import { makeSetup, makeTrade } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

vi.mock('../../services/api', () => ({
  setupsApi: { take: vi.fn() },
  tradesApi: { list: vi.fn(), close: vi.fn() },
}));
const take = vi.mocked(setupsApi.take);
const list = vi.mocked(tradesApi.list);
const close = vi.mocked(tradesApi.close);

describe('PositionPanel', () => {
  beforeEach(() => {
    take.mockReset(); list.mockReset(); close.mockReset();
    list.mockResolvedValue([]);
  });

  it('records taking the setup, prefilled with the paper fill (or entry) and suggested shares', async () => {
    take.mockResolvedValue(makeTrade());
    const onChanged = vi.fn();
    renderWithProviders(<PositionPanel setup={makeSetup({ paperFillPrice: 98.42 })} onChanged={onChanged} />);
    expect(screen.getByLabelText('Fill price')).toHaveValue(98.42);
    expect(screen.getByLabelText('Shares')).toHaveValue(17);
    await userEvent.clear(screen.getByLabelText('Fill price'));
    await userEvent.type(screen.getByLabelText('Fill price'), '98.50');
    await userEvent.click(screen.getByRole('button', { name: 'I took this trade' }));
    expect(take).toHaveBeenCalledWith('setup-1', { fillPrice: 98.5, shares: 17 });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('rejects fractional shares without calling the API', async () => {
    renderWithProviders(<PositionPanel setup={makeSetup()} onChanged={() => {}} />);
    await userEvent.clear(screen.getByLabelText('Shares'));
    await userEvent.type(screen.getByLabelText('Shares'), '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'I took this trade' }));
    // The browser's own validation (step="1") blocks the submit before any API call.
    expect((screen.getByLabelText('Shares') as HTMLInputElement).validity.stepMismatch).toBe(true);
    expect(take).not.toHaveBeenCalled();
  });

  it('shows the open position, nudges to raise the stop, and closes it', async () => {
    list.mockImplementation(async status => (status === 'OPEN' ? [makeTrade({ suggestedStop: 97.1 })] : []));
    close.mockResolvedValue(makeTrade({ status: 'CLOSED' }));
    const onChanged = vi.fn();
    renderWithProviders(<PositionPanel setup={makeSetup()} onChanged={onChanged} />);
    expect(await screen.findByTestId('position-summary')).toHaveTextContent('17 sh @ $98.40 · your stop $93.94');
    expect(screen.getByText(/trailing stop is now \$97\.10/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Exit price'), '104');
    await userEvent.click(screen.getByRole('button', { name: 'Close my trade' }));
    expect(close).toHaveBeenCalledWith('trade-1', 104);
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('lists previous closed trades on the setup with their P&L', async () => {
    list.mockImplementation(async status => (status === 'CLOSED' ? [makeTrade({ status: 'CLOSED', exitPrice: 109.4, realizedPnl: 187 })] : []));
    renderWithProviders(<PositionPanel setup={makeSetup()} onChanged={() => {}} />);
    expect(await screen.findByText('+$187.00')).toBeInTheDocument();
  });
});
