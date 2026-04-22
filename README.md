# SwingFlow — Trading Assistant

A personal swing trading assistant that scans your watchlist, detects high-probability setups, and sends you a push notification when it's time to act. Designed for people who want to trade well but can't watch charts all day.

---

## Table of Contents

1. [What Is Swing Trading?](#what-is-swing-trading)
2. [How SwingFlow Works](#how-swingflow-works)
3. [Quick Start](#quick-start)
4. [The Dashboard](#the-dashboard)
5. [Understanding a Setup Card](#understanding-a-setup-card)
6. [The Three Strategies](#the-three-strategies)
7. [How to Act on a Setup](#how-to-act-on-a-setup)
8. [Understanding the Options Suggestion](#understanding-the-options-suggestion)
9. [Position Sizing & the $100/Day Goal](#position-sizing--the-100day-goal)
10. [Push Notifications](#push-notifications)
11. [The Watchlist](#the-watchlist)
12. [Settings & Configuration](#settings--configuration)
13. [Upgrading to Real Data](#upgrading-to-real-data)
14. [Trading Principles](#trading-principles)
15. [Frequently Asked Questions](#frequently-asked-questions)

---

## What Is Swing Trading?

Swing trading sits between day trading and long-term investing. You hold a position for **2–10 days**, capturing one "swing" in price — typically a move from a dip back to a high, or a breakout to new levels.

**Why swing trading works for busy people:**
- You don't need to watch charts in real time
- You set your entry, stop, and target orders in advance
- The trade manages itself while you work

**The realistic goal:** $100/day is achievable on a $5,000 account through disciplined execution. That's 2% per day — demanding, but realistic across 3–5 good setups per week, not necessarily every day.

---

## How SwingFlow Works

```
Every 10 minutes (market hours):
  ↓
  Fetch price history for all watchlist symbols
  ↓
  Calculate EMA 20, EMA 50, RSI 14, ATR 14, Volume SMA
  ↓
  Run 3 strategy detectors on each symbol
  ↓
  If a setup is found → save it + send push notification
  ↓
  You review the setup, place your orders, walk away
```

SwingFlow does the screening. You make the final decision. It never places trades automatically.

---

## Quick Start

**Requirements:** Node.js 18+ (tested on v24), a terminal, a browser.

```bash
# 1. Navigate to the project
cd swingflow

# 2. Run the start script (installs dependencies on first run)
./start.sh

# 3. Open the app
open http://localhost:5173

# 4. Trigger your first scan
# Click "⚡ Scan Now" in the top-right corner of the app
```

The backend runs on port 3001, the frontend on port 5173.

---

## The Dashboard

The dashboard has three main areas:

### Market Overview (top bar)
Nine tiles showing each watchlist symbol with:
- **Price change %** — green = up today, red = down today
- **RSI** — a momentum number (explained below)
- **Trend dot** — green triangle = uptrend, red triangle = downtrend

Click any tile to go to its detail view.

### Goal Tracker (left panel)
Shows your daily goal, account size, number of active setups, and the best risk/reward ratio currently available. This gives you a quick sense of your opportunity pipeline.

### Setup Cards (main area)
Each card is an actionable trade idea. The app only shows setups that pass all strategy conditions — it prioritizes quality over quantity. Some days you'll see zero cards. That's correct behavior. **No setup is better than a forced setup.**

---

## Understanding a Setup Card

```
┌──────────────────────────────────────────────┐
│  AAPL          Trend Pullback          [×]   │
│                                              │
│  Entry         Stop          Target          │
│  $187.50       $183.20       $198.40         │
│                                              │
│  Confidence ████████████░░░░  78%            │
│                                              │
│  R/R 2.5:1                    3 shares       │
│  AAPL pulled back 2.8% to 20 EMA in uptrend │
└──────────────────────────────────────────────┘
```

| Field | What it means |
|---|---|
| **Entry** | The price at which you buy. Place a limit order at this level or slightly above. |
| **Stop** | Where you exit if wrong. This is your maximum loss point. Set a stop-loss order here immediately when you enter. |
| **Target** | Where you take profit. You can set a limit sell order at this level. |
| **Confidence** | How strongly the setup meets all strategy conditions. 80%+ is high conviction. |
| **R/R** | Risk/Reward ratio. 2.5:1 means for every $1 you risk, you stand to make $2.50. |
| **Shares** | Suggested share count based on your account size and risk settings. |

**The note at the bottom** explains in plain English why the signal was triggered.

---

## The Three Strategies

SwingFlow runs three detectors on every symbol. Each targets a different market condition.

---

### 1. Trend Pullback 📈

**Best for:** Stocks in a clear uptrend that have temporarily pulled back.

**What it looks for:**
- The stock's 20-day moving average is above its 50-day moving average (confirmed uptrend)
- The price has dipped 2–5% below the 20-day average (a "healthy pullback")
- The price is recovering — today's candle is green and closing near its high
- RSI is between 35–65 (not overbought, not in a crash)

**Mental picture:** A stock is climbing stairs. It takes one step down, then continues up. You're buying during that one step down.

**Why it works:** In a genuine uptrend, dips to the 20-day average are consistently bought by larger players. You're joining that existing momentum rather than fighting it.

**Typical hold time:** 3–7 days.

---

### 2. Breakout 🚀

**Best for:** Stocks that have been consolidating (trading sideways in a tight range) and are just starting to move.

**What it looks for:**
- The last 7 days have traded within a tight range (less than 5% wide)
- Today's close is above the top of that range — the stock is "breaking out"
- Volume on the breakout day is at least 1.25× the 20-day average (big money is participating)
- RSI is not yet overbought (below 75)

**Mental picture:** A spring being compressed, then released. The tighter and longer the consolidation, the more powerful the breakout tends to be.

**Why it works:** Consolidations represent a balance between buyers and sellers. A high-volume break above resistance means buyers overwhelmed sellers decisively.

**Typical hold time:** 3–10 days.

**Caution:** Breakouts can fail and "fade back" into the range. The stop is placed at the bottom of the consolidation zone. If price falls back below it, exit immediately.

---

### 3. Reversal 🔄

**Best for:** Beaten-down stocks that are showing their first signs of recovery.

**What it looks for:**
- RSI is below 35 — the stock is in "oversold" territory after a significant decline
- Today's candle is green (close > open) and closes in the top half of its range
- The stock is not in a structural death spiral (not more than 30% below its 50-day average)
- Price is recovering slightly compared to yesterday

**Mental picture:** A rubber band stretched too far in one direction. When the selling pressure exhausts itself, even a small amount of buying can snap it back sharply.

**Why it works:** Markets overshoot in both directions. An RSI below 30 historically precedes bounces in quality stocks.

**Caution:** This is the highest-risk of the three strategies. A stock can be oversold and keep falling ("catching a falling knife"). Always respect the stop loss.

**Typical hold time:** 2–5 days.

---

## How to Act on a Setup

1. **Click the setup card** to open the Trade Detail view.

2. **Read the full trade plan:**
   - Verify the chart looks like what the strategy describes
   - Check that the broader market (SPY/QQQ) is not in a strong downtrend — avoid going long against the market
   - Look at the checklist and complete each item mentally

3. **Place your orders (before the market opens or during low-volatility hours):**
   ```
   Buy limit order:   at the Entry price
   Stop-loss order:   at the Stop price (set this the moment you enter)
   Sell limit order:  at the Target price
   ```

4. **Walk away.** The orders are live and will execute automatically. Check the position once at midday to make sure your stop hasn't been hit.

5. **When the trade completes:** Update the setup status in the History tab.

### Order types to use at your broker

| Order type | When to use |
|---|---|
| **Buy limit** | Enter the trade at or below the Entry price |
| **Stop-loss (stop market)** | Exit automatically if price hits the Stop — set this immediately |
| **Sell limit** | Take profit automatically at the Target |
| **OCO (One-Cancels-Other)** | Most brokers let you set stop + target together; use this to automate the exit |

---

## Understanding the Options Suggestion

The Trade Detail view shows an optional options trade alongside the stock trade. Options are not required — the stock trade alone works fine.

**When options make sense:**
- You want defined maximum risk (you can only lose the premium paid)
- You want leverage without borrowing money on margin
- You have less capital but want meaningful upside

### Reading the options panel

```
AAPL $185 CALL  ·  Expires May 9, 2025
Premium:    $3.20   (cost per share)
Delta:      0.52    (sensitivity to stock movement)
Contracts:  2       (based on your risk budget)
Total Cost: $640    (2 contracts × 100 shares × $3.20)
Max Gain:   $1,850  (estimated)
```

| Field | What it means |
|---|---|
| **Strike** | The price at which you have the right to buy (call) or sell (put) the stock |
| **Expiration** | The last date the option has value. SwingFlow selects 10–25 days out. |
| **Premium** | What you pay per share. Multiply × 100 for cost per contract. |
| **Delta** | How much the option gains for every $1 the stock moves. 0.52 = option gains $0.52 when stock gains $1. |
| **Contracts** | How many to buy, calculated from your risk budget |
| **Total Cost** | Your maximum possible loss (premium paid) |
| **Max Gain** | Estimated profit if the stock reaches the Target |

**Key rule for beginners:** Only buy options that expire at least 10 days after your target. Options lose time value ("theta") every day — give yourself room.

**How to exit an options trade:** Sell the option when the stock reaches 80% of your target. Don't hold to expiration unless you're very confident.

---

## Position Sizing & the $100/Day Goal

SwingFlow automatically calculates how many shares to buy based on three settings:

```
Risk per trade = Account Size × Risk % 
              = $5,000 × 1.5% = $75 per trade

Shares = Risk per trade ÷ (Entry − Stop)
       = $75 ÷ ($187.50 − $183.20) = $75 ÷ $4.30 ≈ 17 shares
```

This means if the trade goes wrong and hits your stop, you lose $75 — not your entire account.

### The path to $100/day

With a 2.5:1 risk/reward ratio and $75 risk:
- One winning trade = $75 × 2.5 = **$187.50 profit**
- Goal of $100/day = roughly 1 good trade every 2 days

**Realistic expectations:**
- Good swing traders win 45–55% of trades
- With a 2.5:1 R/R, you're profitable even winning only 40% of trades
- Some weeks will be flat or slightly negative — this is normal
- Consistency over 30+ trades matters more than any single week

### Scaling up

Once you've tracked 20+ trades and see consistent results, you can increase account size or risk percent in Settings. Never increase risk during a losing streak.

---

## Push Notifications

SwingFlow notifies you the moment a new setup is detected, so you don't need to keep the app open.

**To enable:**

1. Click the 🔕 icon in the top-right header
2. Allow notifications when the browser prompts you
3. The icon turns to 🔔 — you're subscribed

**What you'll receive:**
- **New Setup detected** — symbol, strategy, entry/stop/target
- Tapping the notification opens the trade detail directly

**For notifications to work while the browser is closed,** the backend must still be running (`./start.sh`). The service worker handles delivery even if the browser tab is closed.

> **Note:** VAPID keys must be configured in `backend/.env` for production push notifications. See the Setup section. For development, notifications work as in-browser alerts.

---

## The Watchlist

The default watchlist covers the most liquid, widely-traded symbols:

| Symbol | What it is | Best for |
|---|---|---|
| AAPL | Apple — mega-cap tech | Trend pullback |
| NVDA | Nvidia — AI/GPU leader, volatile | Breakouts |
| TSLA | Tesla — high volatility | Reversals |
| MSFT | Microsoft — steady blue chip | Trend pullback |
| AMD | AMD — semiconductor, volatile | Breakouts |
| META | Meta — social media, high volume | Trend pullback |
| AMZN | Amazon — e-commerce + cloud | Mixed |
| SPY | S&P 500 ETF — the whole market | Trend pullback |
| QQQ | Nasdaq 100 ETF — tech-heavy | Trend pullback |

**Adding a symbol:** Go to Watchlist → type a ticker → click Add. Any US equity symbol works once you switch to a real data provider.

**Tip:** Keep the watchlist under 15 symbols. More symbols = more noise. Master a handful of names and learn their personality.

---

## Settings & Configuration

Open the Settings view from the sidebar.

| Setting | Default | Guidance |
|---|---|---|
| Account Size | $5,000 | Your actual available trading capital |
| Daily Goal | $100 | Target profit — realistic on $5,000 with discipline |
| Risk Per Trade | 1.5% | Never go above 2% per trade when starting out |
| Data Provider | Mock | Switch to Finnhub/Polygon once ready for real trading |

### Changing the scan schedule

The backend scans every 10 minutes during market hours by default. To change it, edit `backend/.env`:

```bash
# Every 5 minutes during market hours (more frequent)
SCAN_SCHEDULE=*/5 9-16 * * 1-5

# Every 15 minutes (less frequent, fewer false positives)
SCAN_SCHEDULE=*/15 9-16 * * 1-5
```

Restart the backend after changing.

---

## Upgrading to Real Data

SwingFlow ships with a mock data provider so you can learn the interface and strategies without any API key. When you're ready to trade with real data:

### Phase 2: Finnhub (Free)

1. Sign up at [finnhub.io](https://finnhub.io) (free account, no credit card)
2. Copy your API key from the dashboard
3. Edit `backend/.env`:
   ```
   DATA_PROVIDER=finnhub
   FINNHUB_API_KEY=your_key_here
   ```
4. Restart the backend

**Limitations of free Finnhub:** ~60 API calls/minute, no options chain data. Stock setups work fully; options suggestions will be unavailable.

### Phase 3: Polygon.io (Paid)

1. Sign up at [polygon.io](https://polygon.io) (paid plans start at $29/month)
2. Edit `backend/.env`:
   ```
   DATA_PROVIDER=polygon
   POLYGON_API_KEY=your_key_here
   ```
3. Restart the backend

**Polygon advantages:** Full options chain data, higher rate limits, tick-level data for future features.

### Enable Push Notifications (Production)

Generate VAPID keys once and add them to your `.env`:

```bash
cd backend
npx web-push generate-vapid-keys
```

Copy the output into `backend/.env`:
```
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_EMAIL=mailto:your@email.com
```

---

## Trading Principles

SwingFlow is a tool. These principles make the difference between consistent profit and giving money back to the market:

### 1. Never skip the stop loss
The stop loss is not optional. Every single trade must have one placed the moment you enter. A 5% loss kept small stays manageable. A 5% loss you "hoped would recover" can become 20%.

### 2. Take only setups that meet all conditions
If the app shows zero setups today, trade nothing. Cash is a position. The market will give you another opportunity tomorrow.

### 3. Cut losses quickly, let winners run
Consider exiting at 50% of the target if the stock stalls. Consider holding past the target if momentum is strong and the broader market is cooperating. But always exit when your stop is hit — no exceptions.

### 4. Don't trade against the market
Check SPY and QQQ first. If both are in a strong downtrend, skip all LONG setups regardless of confidence score. Swim with the current, not against it.

### 5. Track every trade
Keep a simple spreadsheet: date, symbol, strategy, entry, exit, P&L, notes on why you took it. After 20 trades you'll see patterns — which strategies work best for you, which you misread, what time of day your entries are cleanest.

### 6. Size stays constant until you have an edge proven
Never increase position size to "recover" a loss. Keep risk at 1–2% per trade until you have at least 30 tracked trades showing a positive expectancy.

---

## Frequently Asked Questions

**Q: The app found no setups. Is something broken?**
A: Probably not. High-quality setups are uncommon — that's what makes them valuable. Click "Scan Now" manually. If you've just started with mock data, some symbols may not be in a setup-triggering condition in that simulation. Try again tomorrow (the mock data is date-aware and changes).

**Q: The strategy fired but the chart doesn't look like what I expected.**
A: This can happen with mock data — the generation is probabilistic. When using real data (Finnhub/Polygon), the chart will precisely match the signal. Mock data is for learning the workflow, not for making real trades.

**Q: Can I trade against the signal (go short)?**
A: Not in the current version. All three strategies only generate LONG signals. Shorting adds complexity and margin requirements — planned for a future phase.

**Q: The confidence score is 65%. Should I skip it?**
A: 65% means fewer strategy conditions were met than a 90% signal. It's still valid but warrants more scrutiny. Check the note, look at the chart, verify the broader market trend. If everything looks right, the R/R ratio justifies the trade.

**Q: What if I can't enter at the exact entry price?**
A: Use a limit order up to 0.3% above the entry. If the stock gaps significantly above entry at open, skip it — you'd be chasing, and the risk/reward calculation is now off.

**Q: Options look complex. Can I just trade the stock?**
A: Yes. The stock trade is fully self-contained. Options are shown as a higher-leverage alternative, not a requirement.

**Q: How do I know when to sell early?**
A: If the stock closes below the 20-day EMA on a trend pullback trade, consider exiting even if the stop hasn't been hit — the setup thesis is broken. For breakouts, if the stock falls back inside the consolidation range, exit. For reversals, if the stock makes a new low below the stop, always exit.

**Q: The potential gain is $180 but my goal is $100. Should I take profit at $100?**
A: No. Let the full trade plan work. Cutting winners short is the most common mistake. If the target is $198.40, let it get there. Over many trades, cutting winners early destroys your R/R advantage.

**Q: What happens if the market is closed?**
A: The scheduler only runs Monday–Friday 9 AM–4 PM ET. No scans happen on weekends. You can manually trigger a scan any time with "Scan Now" but you'll be working with the previous close's data.

---

## Project Structure

```
swingflow/
├── start.sh                    ← Run this to start everything
├── backend/
│   ├── .env                    ← Your configuration (API keys, settings)
│   ├── src/
│   │   ├── providers/          ← Mock / Finnhub / Polygon data sources
│   │   ├── indicators/         ← EMA, RSI, ATR calculations
│   │   ├── strategies/         ← TrendPullback, Breakout, Reversal
│   │   ├── services/           ← Position sizing, push notifications
│   │   ├── routes/             ← REST API endpoints
│   │   ├── scheduler/          ← Cron-based market scanner
│   │   └── db/                 ← SQLite schema and connection
│   └── data/
│       └── swingflow.db        ← Auto-created SQLite database
└── frontend/
    ├── public/sw.js            ← Service worker for push notifications
    └── src/
        ├── components/         ← Dashboard, TradeDetail, Watchlist, etc.
        ├── hooks/              ← React data-fetching hooks
        └── services/           ← API client, notification manager
```

---

*SwingFlow is educational software. It does not provide financial advice. All trading involves risk of loss. Past signal performance on mock data does not predict future results with real market data.*
