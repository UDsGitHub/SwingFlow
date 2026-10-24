import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockDataProvider } from '../../src/providers/MockDataProvider';
import { CachedProvider } from '../../src/providers/CachedProvider';
import { AlpacaProvider } from '../../src/providers/AlpacaProvider';
import { MarketDataProvider } from '../../src/providers/MarketDataProvider';
import { marketClock } from '../../src/lib/marketTime';
import { OHLC } from '../../src/types';

const at = (iso: string) => { process.env.MOCK_MARKET_TIME = iso; };
const lastDate = (bars: OHLC[]) => marketClock(bars[bars.length - 1].timestamp).date;

describe('MockDataProvider', () => {
  afterEach(() => { delete process.env.MOCK_MARKET_TIME; });

  it('returns identical bars regardless of request length', async () => {
    at('2026-10-23T20:30:00Z');
    const p = new MockDataProvider();
    const short = await p.getHistoricalPrices('AAPL', 2);
    const long = await p.getHistoricalPrices('AAPL', 120);
    expect(short).toEqual(long.slice(-2));
  });

  it('keeps past history stable and adds one bar per trading day', async () => {
    at('2026-10-22T20:30:00Z');
    const thu = await new MockDataProvider().getHistoricalPrices('MSFT', 50);
    at('2026-10-23T20:30:00Z');
    const fri = await new MockDataProvider().getHistoricalPrices('MSFT', 51);
    expect(lastDate(thu)).toBe('2026-10-22');
    expect(lastDate(fri)).toBe('2026-10-23');
    expect(fri.slice(0, 50)).toEqual(thu);
  });

  it('adds no bar on weekends', async () => {
    at('2026-10-24T16:00:00Z');
    expect(lastDate(await new MockDataProvider().getHistoricalPrices('SPY', 5))).toBe('2026-10-23');
  });

  it('builds today\'s bar from the session elapsed so far', async () => {
    at('2026-10-23T13:00:00Z'); // 09:00 ET — before the open
    expect(lastDate(await new MockDataProvider().getHistoricalPrices('NVDA', 3))).toBe('2026-10-22');
    at('2026-10-23T16:45:00Z'); // 12:45 ET — mid-session
    const midP = new MockDataProvider();
    const mid = (await midP.getHistoricalPrices('NVDA', 1))[0];
    const intraday = await midP.getIntradayPrices('NVDA');
    expect(intraday.length).toBe(39);
    expect(mid.close).toBe(intraday[intraday.length - 1].close);
    at('2026-10-23T20:30:00Z');
    const full = (await new MockDataProvider().getHistoricalPrices('NVDA', 1))[0];
    expect(full.open).toBe(mid.open);
    expect(full.volume).toBeGreaterThan(mid.volume);
  });

  it('simulates any symbol deterministically', async () => {
    at('2026-10-23T20:30:00Z');
    const a = await new MockDataProvider().getHistoricalPrices('ZZZQ', 10);
    const b = await new MockDataProvider().getHistoricalPrices('zzzq', 10);
    expect(a).toEqual(b);
    expect(a.every(x => x.low <= Math.min(x.open, x.close) && x.high >= Math.max(x.open, x.close))).toBe(true);
  });

  it('offers a typed ticker in search even when it is not a known name', async () => {
    const hits = await new MockDataProvider().searchTickers('coin');
    expect(hits.map(h => h.symbol)).toContain('COIN');
  });
});

describe('CachedProvider', () => {
  function fakeInner(): MarketDataProvider & { calls: number[] } {
    const calls: number[] = [];
    return {
      name: 'fake', calls,
      getHistoricalPrices: async (_s: string, days = 120) => {
        calls.push(days);
        return Array.from({ length: days }, (_, i) => ({ timestamp: i, open: i, high: i, low: i, close: i, volume: 1 }));
      },
      getIntradayPrices: async () => [],
      getIndicators: async () => { throw new Error('unused'); },
      getOptionsChain: async () => { throw new Error('unused'); },
      isAvailable: async () => true,
      searchTickers: async () => [],
    };
  }

  it('shares one fetch between concurrent history, indicator and smaller requests', async () => {
    const inner = fakeInner();
    const c = new CachedProvider(inner);
    const [full, , two] = await Promise.all([c.getHistoricalPrices('SPY', 120), c.getIndicators('SPY'), c.getHistoricalPrices('spy', 2)]);
    expect(inner.calls).toEqual([120]);
    expect(two).toEqual(full.slice(-2));
  });

  it('refetches for a larger request, then serves smaller ones from it', async () => {
    const inner = fakeInner();
    const c = new CachedProvider(inner);
    await c.getHistoricalPrices('SPY', 120);
    await c.getHistoricalPrices('SPY', 260);
    await c.getHistoricalPrices('SPY', 120);
    expect(inner.calls).toEqual([120, 260]);
  });

  it('expires entries after the TTL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const inner = fakeInner();
    const c = new CachedProvider(inner, 1000);
    await c.getHistoricalPrices('SPY', 10);
    vi.setSystemTime(Date.now() + 1500);
    await c.getHistoricalPrices('SPY', 10);
    expect(inner.calls).toHaveLength(2);
    vi.useRealTimers();
  });

  it('treats entries as stale if the clock moves backwards', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const inner = fakeInner();
    const c = new CachedProvider(inner, 1000);
    await c.getHistoricalPrices('SPY', 10);
    vi.setSystemTime(Date.now() - 5000);
    await c.getHistoricalPrices('SPY', 10);
    expect(inner.calls).toHaveLength(2);
    vi.useRealTimers();
  });

  it('does not cache failures', async () => {
    const inner = fakeInner();
    let fail = true;
    const orig = inner.getHistoricalPrices;
    inner.getHistoricalPrices = async (s, d) => { if (fail) { fail = false; throw new Error('boom'); } return orig(s, d); };
    const c = new CachedProvider(inner);
    await expect(c.getHistoricalPrices('SPY', 5)).rejects.toThrow('boom');
    await expect(c.getHistoricalPrices('SPY', 5)).resolves.toHaveLength(5);
  });
});

describe('AlpacaProvider', () => {
  const fetchMock = vi.fn();
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });
  const bar = (iso: string, c = 1) => ({ t: iso, o: c, h: c, l: c, c, v: 10 });

  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.ALPACA_DATA_FEED; });

  it('sends auth headers, requests the SIP feed with a 16-minute delay, and follows pagination', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ bars: [bar('2026-10-21T04:00:00Z', 1)], next_page_token: 'p2' }))
      .mockResolvedValueOnce(json({ bars: [bar('2026-10-22T04:00:00Z', 2), bar('2026-10-23T04:00:00Z', 3)], next_page_token: null }));
    const before = Date.now();
    const bars = await new AlpacaProvider('KEY', 'SECRET').getHistoricalPrices('AAPL', 2);

    expect(bars.map(b => b.close)).toEqual([2, 3]);
    const [url1, init] = fetchMock.mock.calls[0];
    const params = new URL(url1).searchParams;
    expect(init.headers).toMatchObject({ 'APCA-API-KEY-ID': 'KEY', 'APCA-API-SECRET-KEY': 'SECRET' });
    expect(params.get('feed')).toBe('sip');
    expect(params.get('timeframe')).toBe('1Day');
    expect(before - Date.parse(params.get('end')!)).toBeGreaterThanOrEqual(16 * 60 * 1000 - 50);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('page_token')).toBe('p2');
  });

  it('does not delay the IEX feed', async () => {
    process.env.ALPACA_DATA_FEED = 'iex';
    fetchMock.mockResolvedValueOnce(json({ bars: [], next_page_token: null }));
    const before = Date.now();
    await new AlpacaProvider('K', 'S').getHistoricalPrices('AAPL', 1);
    expect(before - Date.parse(new URL(fetchMock.mock.calls[0][0]).searchParams.get('end')!)).toBeLessThan(5000);
  });

  it('retries after a 429 using Retry-After', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock
      .mockResolvedValueOnce(json({ message: 'slow down' }, 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(json({ bars: [bar('2026-10-23T04:00:00Z')], next_page_token: null }));
    const p = new AlpacaProvider('K', 'S').getHistoricalPrices('AAPL', 1);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throws on other HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'forbidden' }, 403));
    await expect(new AlpacaProvider('K', 'S').getHistoricalPrices('AAPL', 1)).rejects.toThrow('Alpaca 403');
  });

  it('keeps only regular-session bars of the most recent session for intraday', async () => {
    fetchMock.mockResolvedValueOnce(json({
      bars: [
        bar('2026-10-22T19:55:00Z'),      // Thu 15:55 ET — previous session
        bar('2026-10-23T12:00:00Z'),      // Fri 08:00 ET — pre-market
        bar('2026-10-23T13:30:00Z', 5),   // Fri 09:30 ET
        bar('2026-10-23T19:55:00Z', 6),   // Fri 15:55 ET
        bar('2026-10-23T20:00:00Z'),      // Fri 16:00 ET — after hours
      ],
      next_page_token: null,
    }));
    const bars = await new AlpacaProvider('K', 'S').getIntradayPrices('AAPL');
    expect(bars.map(b => b.close)).toEqual([5, 6]);
  });

  it('searches tradable assets, symbol prefix matches first, and caches the asset list', async () => {
    fetchMock.mockResolvedValueOnce(json([
      { symbol: 'NVDL', name: 'Leveraged NVDA', tradable: true },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', tradable: true },
      { symbol: 'XNVD', name: 'Halted NVD fund', tradable: false },
      { symbol: 'ABC', name: 'Invidia-ish', tradable: true },
    ]));
    const p = new AlpacaProvider('K', 'S');
    const hits = await p.searchTickers('nvd');
    expect(hits.map(h => h.symbol)).toEqual(['NVDA', 'NVDL']);
    await p.searchTickers('abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not provide options chains yet', async () => {
    await expect(new AlpacaProvider('K', 'S').getOptionsChain('AAPL')).rejects.toThrow(/not enabled/);
  });
});
