# SwingFlow — session handoff

Use this file when starting a **new Cursor chat** so work continues without relying on prior transcript.

## Branch / state

Confirm with `git branch` before merging; recent feature work may be on **`feat/supabase-auth`** or `main`.

## Product intent (short)

SwingFlow is a **personal swing-trading assistant**: watchlist → strategy detectors → setups → position sizing → browser push. **Mock** works without paid APIs; **Finnhub** / **Polygon** are pluggable.

## Done (handoff checklist)

- P0: Manual scan notifies; per-user **`settings.data_provider`** via `resolveUserProvider.ts`.
- P1: **`checkEntryZones`** after each scheduled scan (`entryZoneCheck.ts`); 4h dedupe per setup; **`notifyEntryZone`** used.
- P2: **`frontend/public/sw.js`** uses `focus` + `navigate` with **`openWindow`** fallback.
- Market summary logs partial symbol failures; Reversal RSI **35** documented in code/README; ProductTour history copy matches neutral strategy chips; **README** updated (Finnhub + push types).

## What to do next

- **Finnhub:** Follow **[README.md — Upgrading to Real Data → Phase 2: Finnhub](README.md#phase-2-finnhub-free)** (API key in `backend/.env`, choose provider in **Settings**, restart backend).
- Optional: trim or delete this file if you prefer README-only onboarding.

## Key paths

| Area | Path |
|------|------|
| Entry zone job | `backend/src/scheduler/entryZoneCheck.ts` |
| Scheduler | `backend/src/scheduler/MarketScheduler.ts` |
| Per-user provider | `backend/src/providers/resolveUserProvider.ts` |
| Trade setup rows | `backend/src/db/tradeSetupMapper.ts` |
