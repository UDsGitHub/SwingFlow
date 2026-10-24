/**
 * Liquid scan universe: large, heavily traded US stocks (S&P 100-style) plus major ETFs.
 * Users' watchlists are favorites layered on top; the scan is not limited to them.
 *
 * Note: this is today's membership, so backtests over past years carry survivorship bias.
 */
export const LIQUID_UNIVERSE: readonly string[] = [
  // ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'SMH', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU',
  // Technology & communication
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'AMD', 'CSCO', 'ACN',
  'TXN', 'INTU', 'QCOM', 'IBM', 'NOW', 'AMAT', 'MU', 'INTC', 'PLTR', 'ANET', 'PANW', 'UBER',
  'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'SMCI',
  // Consumer
  'AMZN', 'TSLA', 'HD', 'COST', 'WMT', 'PG', 'KO', 'PEP', 'MCD', 'LOW', 'NKE', 'SBUX', 'TJX',
  'BKNG', 'MDLZ', 'CL', 'MO', 'PM', 'KHC', 'F', 'GM',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'SCHW', 'AXP', 'V', 'MA', 'PYPL', 'SPGI', 'CB',
  'MMC', 'USB', 'MET', 'AIG', 'BK', 'BRK.B',
  // Health care
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN', 'PFE', 'ISRG', 'SYK', 'ELV',
  'MDT', 'BMY', 'GILD', 'CVS', 'CI',
  // Industrials, energy, materials, utilities, real estate
  'CAT', 'GE', 'HON', 'UNP', 'RTX', 'LMT', 'BA', 'DE', 'UPS', 'FDX', 'GD', 'EMR', 'ADP',
  'XOM', 'CVX', 'COP', 'LIN', 'NEE', 'SO', 'DUK', 'PLD',
];
