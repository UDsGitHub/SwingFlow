import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenPositions } from './OpenPositions';
import { tradesApi } from '../../services/api';
import { makeTrade } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

vi.mock('../../services/api', () => ({ tradesApi: { update: vi.fn() } }));
const update = vi.mocked(tradesApi.update);

describe('OpenPositions', () => {
  beforeEach(() => { update.mockReset(); });

  it('renders nothing without positions', () => {
    const { container } = renderWithProviders(<OpenPositions trades={[]} onCloseTrade={() => {}} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each position with the broker stop and the trailing stop', () => {
    renderWithProviders(<OpenPositions trades={[makeTrade()]} onCloseTrade={() => {}} onChanged={() => {}} />);
    expect(screen.getByText('AXP')).toBeInTheDocument();
    expect(screen.getByText('17 sh @ $98.40')).toBeInTheDocument();
    expect(screen.queryByText(/Raise stop/)).not.toBeInTheDocument();
  });

  it('asks to raise the stop and records it once the user confirms', async () => {
    update.mockResolvedValue(makeTrade({ stopPrice: 97.1 }));
    const onChanged = vi.fn();
    renderWithProviders(<OpenPositions trades={[makeTrade({ suggestedStop: 97.1 })]} onCloseTrade={() => {}} onChanged={onChanged} />);
    expect(screen.getByText(/Raise stop to \$97\.10/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I moved it' }));
    expect(update).toHaveBeenCalledWith('trade-1', { stopPrice: 97.1 });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('opens the close dialog for that position', async () => {
    const onCloseTrade = vi.fn();
    renderWithProviders(<OpenPositions trades={[makeTrade()]} onCloseTrade={onCloseTrade} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCloseTrade).toHaveBeenCalledWith('trade-1');
  });
});
