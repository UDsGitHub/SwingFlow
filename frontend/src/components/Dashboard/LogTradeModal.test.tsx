import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogTradeModal } from './LogTradeModal';
import { tradesApi } from '../../services/api';
import { makeTrade } from '../../test/fixtures';

vi.mock('../../services/api', () => ({ tradesApi: { close: vi.fn() } }));
const close = vi.mocked(tradesApi.close);

describe('LogTradeModal (close a position)', () => {
  // Braces matter: a function returned from beforeEach runs as teardown, and mockReset() returns the mock.
  beforeEach(() => { close.mockReset(); });

  it('explains how to record a position when there are none', () => {
    render(<LogTradeModal open trades={[]} onClose={() => {}} onRecorded={() => {}} />);
    expect(screen.getByText(/I took this trade/)).toBeInTheDocument();
  });

  it('previews realized P&L and closes the selected trade at the chosen exit', async () => {
    close.mockResolvedValue(makeTrade({ status: 'CLOSED' }));
    const onRecorded = vi.fn();
    const onClose = vi.fn();
    render(<LogTradeModal open trades={[makeTrade()]} onClose={onClose} onRecorded={onRecorded} />);

    await userEvent.type(screen.getByLabelText('Exit Price'), '109.40');
    // 17 shares × (109.40 − 98.40) = $187.00
    expect(screen.getByText('+$187.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record Close' }));

    expect(close).toHaveBeenCalledWith('trade-1', 109.4);
    expect(onRecorded).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preselects the trade it was opened for, and quick-fills the stop', async () => {
    const trades = [makeTrade(), makeTrade({ id: 'trade-2', symbol: 'CB', entryPrice: 232.3, stopPrice: 222.73 })];
    render(<LogTradeModal open trades={trades} initialTradeId="trade-2" onClose={() => {}} onRecorded={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop $222.73' }));
    expect(screen.getByLabelText('Exit Price')).toHaveValue(222.73);
  });

  it('tells the user when the trade was already closed', async () => {
    close.mockRejectedValue(new Error('Request failed with status code 409'));
    const onRecorded = vi.fn();
    render(<LogTradeModal open trades={[makeTrade()]} onClose={() => {}} onRecorded={onRecorded} />);
    await userEvent.type(screen.getByLabelText('Exit Price'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Record Close' }));
    expect(await screen.findByText('This trade is already closed.')).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<LogTradeModal open={false} trades={[makeTrade()]} onClose={() => {}} onRecorded={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
