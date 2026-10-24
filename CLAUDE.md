# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SwingFlow is a personal swing-trading assistant: watchlist → strategy detectors → trade setups (with position sizing) → browser push notifications. It never places trades. Two independent npm packages live side by side — `backend/` (Express + TypeScript) and `frontend/` (React 18 + Vite + Tailwind) — with Supabase (Postgres) as the database and Clerk for auth.

## Commands

```bash
./start.sh                      # installs deps if missing, copies backend/.env.example → .env, runs both apps
                                # backend → http://localhost:3001, frontend → http://localhost:5173

cd backend && npm run dev       # ts-node-dev with respawn (transpile-only — does NOT type-check)
cd backend && npm run build     # tsc → dist/
cd frontend && npm run dev      # vite; proxies /api → localhost:3001
cd frontend && npm run build    # tsc && vite build

# Checks (each package: backend/, frontend/, e2e/)
npm run typecheck               # tsc --noEmit (backend includes tests/)
npm run lint                    # ESLint 9 flat config
npm test                        # backend: unit + integration; frontend: unit; e2e: Playwright

cd backend && npm run test:unit         # fast, no Docker
cd backend && npm run test:integration  # needs Docker: starts local Supabase, resets it from migrations
cd backend && npx vitest run tests/unit/simulate.test.ts -t "gap"   # single file / test name
cd backend && npx vitest -u             # update snapshots after an intended signal change
cd e2e && npm test                       # needs Docker + Clerk dev keys (backend/.env or env vars)
cd backend && npm run backtest -- --universe --years 10 --split 2023-01-01 [--all-strategies] [--symbols AAPL,MSFT] [--provider mock]
                                # replays history through the live strategies; report → backend/backtest-results/
```

CI (`.github/workflows/ci.yml`, Node 22) runs typecheck, lint, unit tests and build for backend and frontend, the backend integration suite against a local Supabase, and the Playwright e2e flow (Clerk dev keys come from the `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` repo secrets). Nothing in CI calls live Alpaca.

Database schema lives in `supabase/migrations/NNN_*.sql` (numbered, applied in order to the Supabase project). Add new schema changes as a new numbered migration rather than editing existing ones.

## Environment

- `backend/.env` (see `.env.example`): Clerk keys, `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (the backend throws on startup if any Supabase var is missing), `DATA_PROVIDER` (`mock` | `alpaca` | `polygon`; defaults to `alpaca`), `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` / `ALPACA_DATA_FEED`, `POLYGON_API_KEY`, VAPID keys, `CORS_ORIGINS`, `POST_CLOSE_SCAN_SCHEDULE`, `MONITOR_SCHEDULE` (`SCAN_SCHEDULE` is obsolete and ignored).
- Additional backend flags read in code: `ENABLE_REGIME_GATING` (default `true`), `ENABLE_LIFECYCLE_AUTOMATION`, `ENABLED_STRATEGIES`, `REGIME_SYMBOL`, `DEVELOPING_SESSION_CAP`, `DEVELOPING_MAX_AGE_MS`.
- `frontend/.env`: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (defaults to `/api`, which Vite proxies in dev).

## Architecture

### Scan pipeline (backend)

Setups are created from **completed daily candles only** (`completedBars` in `lib/marketTime.ts` drops today's bar before 4:20 PM ET). The engine (`strategies/StrategyEngine.ts`) is split into `evaluateMarket(symbols)`, which runs once per scan and is shared by all users, and `runScanForUser(userId, snapshot, symbols)`, which handles per-user sizing, inserts and diagnostics. Each user scans `LIQUID_UNIVERSE` (`config/universe.ts`) plus their watchlist (`scanSymbolsForUser`). Scans run in three ways:
- **Post-close** (`scheduler/MarketScheduler.ts`): node-cron at 4:30 PM ET. It runs once per trading day, enforced by a `scan_runs` row whose unique `(kind, session_date)` key works as a lock across restarts and overlapping instances. It records holidays as `MARKET_CLOSED`, retries a `FAILED` run, and catches up on startup if the run was missed. It expires unfilled setups (`scheduler/expireSetups.ts`, after `ENTRY_WINDOW_DAYS` sessions), creates setups for every profile, and sends one push per user (`notifyNewSetups`, a digest when there are several).
- **Monitor**: every 10 min during market hours. It only runs `checkEntryZones` (4h dedupe per setup) and `TradeLifecycleTracker`, and creates no setups.
- **Manual**: `POST /api/scan` in `app.ts`, for the requesting user only (optionally a subset of their symbols).

A partial unique index allows at most one ACTIVE `trade_setups` row per user+symbol+strategy (migration 006). An insert conflict is recorded as `SKIPPED_DUPLICATE`.

Per symbol, the engine fetches OHLC + indicators from the market-data provider, then runs each **enabled** strategy (`strategies/strategyConfig.ts`: only `REVERSAL` by default, overridable via `ENABLED_STRATEGIES`; `TrendPullbackStrategy` and `BreakoutStrategy` exist but failed out-of-sample validation). All extend `BaseStrategy` and return a `StrategyResult`. `strategyConfig.ts` also holds `EXIT_PLANS` (per-strategy max hold / target override / ATR trail), shared by the backtest and (to be) the lifecycle tracker. Each result then passes through:
1. **Regime gating** — `classifyRegime` (`services/MarketRegimeService.ts`) classifies the market (TRENDING_UP / TRENDING_DOWN / RANGING); `allowsRegime` blocks strategies that don't fit the regime.
2. **Scoring / explanation** — `SetupScoringService` and `StrategyExplainerService` produce a score and human-readable checks.
3. **Sizing** — `PositionSizingService` computes stock and options suggestions from the user's `settings` (account size, risk %).
4. **Persistence** — inserted into `trade_setups`; every evaluation (including NO_SETUP / BLOCKED_BY_REGIME / SKIPPED_DUPLICATE) is recorded as a `ScanEvaluation` for the scan-diagnostics view.

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

### Testing

- **Backend unit** (`backend/tests/unit/`, Vitest): pure logic only. Anything importing `db/supabase.ts` throws at import without Supabase env, so keep pure rules (e.g. `isEntryWindowOver` in `strategyConfig.ts`, push copy in `services/notificationMessages.ts`) out of DB modules. `strategies.test.ts` holds a **signal-regression snapshot**: every signal the strategies produce on the pinned mock market. A diff means signals changed; review it before running `vitest -u`. Helpers for building bars are in `tests/helpers/bars.ts`.
- **Backend integration** (`backend/tests/integration/`): `globalSetup.ts` starts the repo's local Supabase (`supabase/config.toml`), runs `supabase db reset` (so every run proves the migrations apply), and refuses non-local URLs. Tests pin time with `setClock()` (fake `Date` + `MOCK_MARKET_TIME`) and use the mock provider. Friday 2026-10-23 16:35 ET deterministically yields Reversal setups for AXP and CB.
- **Frontend unit** (`frontend/src/**/*.test.tsx`, Vitest + Testing Library + jsdom): `src/test/setup.ts` stubs `matchMedia` as reduced-motion so GSAP animations are skipped. Fixtures are in `src/test/fixtures.ts`. Gotcha: write `beforeEach(() => { x.mockReset(); })` with braces. A function returned from `beforeEach` runs as teardown, and `mockReset()` returns the mock.
- **e2e** (`e2e/`, Playwright + `@clerk/testing`): an isolated stack of backend on :3101 (local Supabase, `DATA_PROVIDER=mock`, `MOCK_MARKET_TIME` pinned, `DISABLE_SCHEDULER=true`) and frontend on :5174 (`VITE_API_PROXY_TARGET`). It signs in a dedicated Clerk dev-instance user (`swingflow-e2e+clerk_test@example.com`, created on demand) and **fails on any browser console error**. Extend `tests/dashboard-flow.spec.ts` (or add a spec) for each new user-facing flow.
- Testing env flags: `MOCK_MARKET_TIME` (ISO; pins the mock market clock), `DISABLE_SCHEDULER=true` (no cron jobs), `VITE_PORT`, `VITE_API_PROXY_TARGET`.

## Other docs

- `README.md` — user-facing explanation of the strategies' exact trigger conditions, setup cards, sizing, and Polygon/VAPID setup.
- `BACKLOG.md` — planned work (theme toggle, motion, SEO, etc.).
- `HANDOFF.md` — older session-handoff notes; some details (e.g. per-user `data_provider`) are out of date relative to the code.

## Definition of done
- Tests written for new behavior (unit + one e2e for the user flow)
- `npm test`, typecheck, and lint all pass
- Dev server starts; the flow works in the browser with no console errors
- Commit with a descriptive message
Never mark a task done without running these.
