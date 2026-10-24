import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogTradeModal } from './LogTradeModal';
import { setupsApi } from '../../services/api';
import { makeSetup } from '../../test/fixtures';

vi.mock('../../services/api', () => ({ setupsApi: { close: vi.fn() } }));
const close = vi.mocked(setupsApi.close);

describe('LogTradeModal', () => {
  // Braces matter: a function returned from beforeEach runs as teardown, and mockReset() returns the mock.
  beforeEach(() => { close.mockReset(); });

  it('explains that a scan is needed when there are no setups', () => {
    render(<LogTradeModal open setups={[]} onClose={() => {}} onRecorded={() => {}} />);
    expect(screen.getByText(/Run a scan first/)).toBeInTheDocument();
  });

  it('previews P&L and records the close at the chosen exit', async () => {
    close.mockResolvedValue({ success: true, realizedPnl: 187.34 });
    const onRecorded = vi.fn();
    const onClose = vi.fn();
    render(<LogTradeModal open setups={[makeSetup()]} onClose={onClose} onRecorded={onRecorded} />);

    await userEvent.click(screen.getByRole('button', { name: /AXP/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Target $109.37' }));
    // 17 shares × (109.37 − 98.35) = $187.34
    expect(screen.getByText(/187\.34/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record Close' }));

    expect(close).toHaveBeenCalledWith('setup-1', 109.37);
    expect(onRecorded).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('tells the user when the trade was already closed', async () => {
    close.mockRejectedValue(new Error('Request failed with status code 409'));
    const onRecorded = vi.fn();
    render(<LogTradeModal open setups={[makeSetup()]} onClose={() => {}} onRecorded={onRecorded} />);
    await userEvent.click(screen.getByRole('button', { name: /AXP/ }));
    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Record Close' }));
    expect(await screen.findByText('This trade is already closed.')).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<LogTradeModal open={false} setups={[makeSetup()]} onClose={() => {}} onRecorded={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
