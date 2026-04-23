import { TradeSetup } from '../types';

export function mapTradeSetupRow(r: Record<string, unknown>): TradeSetup {
  return {
    id:               r.id as string,
    symbol:           r.symbol as string,
    strategy:         r.strategy as TradeSetup['strategy'],
    direction:        r.direction as TradeSetup['direction'],
    entry:            Number(r.entry),
    stop:             Number(r.stop),
    target:           Number(r.target),
    confidence:       Number(r.confidence),
    riskReward:       Number(r.risk_reward),
    detectedAt:       Number(r.detected_at),
    status:           r.status as TradeSetup['status'],
    notes:            (r.notes as string) ?? '',
    stockSuggestion:  r.stock_suggestion as TradeSetup['stockSuggestion'],
    optionsSuggestion: r.options_suggestion as TradeSetup['optionsSuggestion'] ?? null,
    exitPrice:        r.exit_price != null ? Number(r.exit_price) : null,
    realizedPnl:      r.realized_pnl != null ? Number(r.realized_pnl) : null,
    closedAt:         r.closed_at != null ? Number(r.closed_at) : null,
  };
}
