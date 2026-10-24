# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SwingFlow is a personal swing-trading assistant: watchlist → strategy detectors → trade setups (with position sizing) → browser push notifications. It never places trades. Two independent npm packages live side by side — `backend/` (Express + TypeScript) and `frontend/` (React 18 + Vite + Tailwind) — with Supabase (Postgres) as the database and Clerk for auth.

## Commands

```bash
./start.sh                      # installs deps if missing, copies backend/.env.example → .env, runs both apps
                                # backend → http://localhost:3001, frontend → http://localhost:5173

cd backend && npm run dev       # ts-node-dev with respawn (transpile-only — does NOT type-check)
cd backend && npm run build     # tsc — the only type-check for the backend
cd frontend && npm run dev      # vite; proxies /api → localhost:3001
cd frontend && npm run build    # tsc && vite build
```

There is no test suite and no linter configured. CI (`.github/workflows/ci.yml`, Node 22) only runs `npm ci && npm run build` in each package, so run both builds before considering a change done.

Database schema lives in `supabase/migrations/NNN_*.sql` (numbered, applied in order to the Supabase project). Add new schema changes as a new numbered migration rather than editing existing ones.

## Environment

- `backend/.env` (see `.env.example`): Clerk keys, `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (the backend throws on startup if any Supabase var is missing), `DATA_PROVIDER` (`mock` | `alpaca` | `polygon`; defaults to `alpaca`), `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` / `ALPACA_DATA_FEED`, `POLYGON_API_KEY`, VAPID keys, `CORS_ORIGINS`, `SCAN_SCHEDULE`.
- Additional backend flags read in code: `ENABLE_REGIME_GATING` (default `true`), `ENABLE_LIFECYCLE_AUTOMATION`, `LIFECYCLE_POLL_SCHEDULE`, `REGIME_SYMBOL`, `DEVELOPING_SESSION_CAP`, `DEVELOPING_MAX_AGE_MS`.
- `frontend/.env`: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (defaults to `/api`, which Vite proxies in dev).

## Architecture

### Scan pipeline (backend)

Scans run two ways, both calling `runStrategyEngineWithDeveloping(symbols, userId)` in `backend/src/strategies/StrategyEngine.ts`:
- **Scheduled**: `scheduler/MarketScheduler.ts` uses node-cron (America/New_York) to scan every user's active watchlist, then runs `checkEntryZones` (entry-zone push notifications, 4h dedupe per setup) and `TradeLifecycleTracker` (which also has its own cron). A scan also fires 3s after server start.
- **Manual**: `POST /api/scan` in `app.ts`, scoped to the requesting user (optionally a subset of their watchlist).

Per symbol, the engine fetches OHLC + indicators from the market-data provider, then runs each **enabled** strategy (`strategies/strategyConfig.ts`: only `REVERSAL` by default, overridable via `ENABLED_STRATEGIES`; `TrendPullbackStrategy` and `BreakoutStrategy` exist but failed out-of-sample validation). All extend `BaseStrategy` and return a `StrategyResult`. `strategyConfig.ts` also holds `EXIT_PLANS` (per-strategy max hold / target override / ATR trail), shared by the backtest and (to be) the lifecycle tracker. Each result then passes through:
1. **Regime gating** — `MarketRegimeService` classifies the market (TRENDING_UP / TRENDING_DOWN / RANGING); `allowsRegime` blocks strategies that don't fit the regime.
2. **Scoring / explanation** — `SetupScoringService` and `StrategyExplainerService` produce a score and human-readable checks.
3. **Dedup** — skipped if an ACTIVE `trade_setups` row exists for the same user+symbol+strategy.
4. **Sizing** — `PositionSizingService` computes stock and options suggestions from the user's `settings` (account size, risk %).
5. **Persistence** — inserted into `trade_setups`; every evaluation (including NO_SETUP / BLOCKED_BY_REGIME / SKIPPED_DUPLICATE) is recorded as a `ScanEvaluation` for the scan-diagnostics view.

Results with `developing: true` but not `triggered` become **developing setups**, persisted via `DevelopingPersistenceService` into `developing_candidates` (tracked across sessions, expiring or marked CONVERTED when a real setup later triggers).

To add a strategy: implement a `BaseStrategy` subclass, register it in `ALL_STRATEGIES` and `EXIT_PLANS` in `strategies/strategyConfig.ts`, add its `StrategyType` (backend and frontend types), and add a case to `allowsRegime` (`strategies/regimeGate.ts`). Validate it with `npm run backtest -- --universe --years 10 --split 2023-01-01 --all-strategies` before enabling it.

### Backtest

`backtest/simulate.ts` replays daily bars through the same strategy classes, the same 120-bar indicator window, and the same regime gate (`classifyRegime` in `MarketRegimeService.ts` is pure and shared with the live scan), then simulates each setup forward with conservative rules (buy-stop fill within an entry window, skip >1% gaps, stop wins when a bar touches both levels, gap fills at the open, time exit, slippage). `backtest/stats.ts` reports win rate, expectancy in R, profit factor and drawdown by strategy, regime, and confidence bucket, separately for the regime-gated "live-equivalent" stream and an ungated stream, plus a cash-account portfolio simulation (`backtest/portfolio.ts`) that only takes trades fitting in capital and position slots. Use `--split` to report in-sample vs out-of-sample; judge changes on out-of-sample results. `config/universe.ts` is the liquid scan universe. Keep the backtest and the live engine in sync when changing strategy, sizing, or gating logic — the backtest must not import Supabase-dependent modules.

### Market data providers

`providers/MarketDataProvider.ts` is the interface. `getHistoricalPrices(symbol, days)` takes a **bar count** (not calendar days) and includes today's partial bar during the session. Implementations: `AlpacaProvider` (production; SIP feed is requested ≥16 min in the past to stay within the free plan; options not supported yet), `PolygonProvider` (legacy, paid), and `MockDataProvider`.

`resolveUserProvider.providerFromName` returns one shared instance per provider wrapped in `CachedProvider` (60s memo of daily history + in-flight dedupe), so a scan, the regime check, entry-zone and lifecycle jobs fetch each symbol once. Missing keys fall back to mock with a warning. `getProviderForUser` ignores the user and uses `DATA_PROVIDER` (default `alpaca`).

`MockDataProvider` is deterministic and time-aware: each trading day since 2024-01-02 is simulated from a (symbol, day-index) seed in 78 five-minute steps, so history is stable, a new bar appears daily, and today's bar grows during market hours (ET, via `lib/marketTime.ts`). It simulates any symbol. Technical indicators (`computeIndicators`: EMA, RSI, ATR, volume SMA) are in `indicators/technical.ts`.

### Auth and data access

- Clerk middleware runs globally; routes use `requireAuth` (`middleware/auth.ts`), which sets `req.userId` and lazily bootstraps `profiles`, `settings`, and a default watchlist on a user's first request.
- The backend uses `supabaseAdmin` (service role, bypasses RLS) for essentially all DB access, so **every query must filter by `user_id` explicitly**.
- DB rows are snake_case; API/TS types are camelCase. Map rows through `db/tradeSetupMapper.ts` rather than hand-mapping in routes.

### Frontend

- `services/api.ts` is the single axios client, grouped by resource (`setupsApi`, `watchlistApi`, …). A request interceptor attaches the Clerk JWT obtained via `lib/tokenStore.ts`, which bridges Clerk's `useAuth` hook (registered in `App.tsx`) to code outside React.
- Server state uses TanStack React Query (`hooks/useSetups.ts`, `hooks/useWatchlist.ts`); cross-cutting UI state is in `context/AppContext.tsx` and `context/ThemeContext.tsx`.
- Routes (in `App.tsx`): `/` Dashboard, `/watchlist`, `/history`, `/settings`, `/setup/:id` (TradeDetail), `/symbol/:sym`.
- `public/sw.js` is the push-notification service worker (notification click focuses/navigates an open window, else opens one).
- `frontend/src/types/index.ts` and `backend/src/types/index.ts` are separate hand-maintained copies of the shared API types — when changing an API shape, update both.

## Other docs

- `README.md` — user-facing explanation of the strategies' exact trigger conditions, setup cards, sizing, and Polygon/VAPID setup.
- `BACKLOG.md` — planned work (theme toggle, motion, SEO, etc.).
- `HANDOFF.md` — older session-handoff notes; some details (e.g. per-user `data_provider`) are out of date relative to the code.
