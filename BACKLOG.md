# Backlog

Items to pick up **after production deploy is verified** (unless noted otherwise).

---

## Theme: appearance toggle + light mode

**Trigger:** Once deploy checks out; if this is still open, **prioritize next** (easy to forget).

1. **Preference UI** — User setting for **light**, **dark**, or **system** (follow OS).
2. **Light mode styles** — Full pass so the app looks correct in light theme (today the UI is largely dark-oriented).

Implementation notes (when you start):

- Persist choice (e.g. localStorage + optional sync to `settings` if you want it cross-device).
- Apply class or data-attribute on `document.documentElement` / root layout; respect `prefers-color-scheme` when mode is `system`.
- Tailwind: `darkMode: 'class'` (or media + class hybrid) as needed; tokenize colors in `index.css` / Tailwind theme where possible.

---

## DevOps: GitHub Actions CI

**Trigger:** Add after deploy is stable so future changes are safer.

1. Add `.github/workflows/ci.yml` to run on PRs + pushes to `main`.
2. Run backend install/build checks and frontend install/build checks.
3. Add at least one fast smoke check (lint and/or typecheck) per app.

Implementation notes:

- Keep CI runtime fast; fail early on dependency or TypeScript errors.
- Start with read-only checks only (no deploy step yet).
- Optionally gate Railway deploys on CI passing.

---

## UX: motion and animations

**Trigger:** After deploy stability + theme work, polish interactions.

1. Add subtle enter/exit and state-change animations for key UI surfaces.
2. Add consistent timing/easing tokens so motion feels cohesive across views.
3. Respect reduced-motion preferences (`prefers-reduced-motion`) for accessibility.

Implementation notes:

- Prioritize high-impact areas: dashboard cards, modals, toasts, sidebar/nav transitions.
- Keep motion fast and unobtrusive; avoid blocking interactions.
- Validate on lower-powered devices to prevent jank.

---

## Growth: SEO review and optimization

**Trigger:** After core deploy/auth hardening, improve discoverability.

1. Review current SEO baseline (titles, meta descriptions, indexability, social previews).
2. Optimize page metadata and shared defaults for key routes.
3. Add technical SEO essentials (robots, sitemap, canonical tags as appropriate).

Implementation notes:

- Verify no auth-only/private routes are accidentally indexable.
- Validate with Lighthouse and Google Rich Results testing where relevant.
- Keep copy aligned with product positioning (swing-trading assistant, educational use).

---

## UX: branded loader for main app (and auth gate)

**Trigger:** Polish pass — replace ad-hoc loading UI with one cohesive, pulsating loader.

1. **Shared loader component** — Reusable full-screen or inline shell (brand mark + subtle pulse / shimmer) used wherever we block on async init.
2. **Main app** — Use it for route-level or data-heavy transitions if needed (e.g. first paint after sign-in, suspense boundaries).
3. **Clerk auth gate** — Today `App.tsx` uses a simple skeleton while `useAuth().isLoaded` is false; fold that into the same loader system for visual consistency.

Implementation notes:

- Prefer CSS-driven pulse/shimmer (Tailwind `animate-pulse` or custom keyframes) over heavy Lottie unless you want a specific illustration.
- Respect `prefers-reduced-motion` (static or minimal motion).
- Keep first paint fast; loader should not delay hydration.

---

*Add new sections below as needed.*

---

## Release checklist template (solo pilot)

Use this before every production change while validating proficiency yourself.

### 1) Release metadata

- **Release name:** `<short name>`
- **Date window:** `<start> -> <end>`
- **Primary objective:** `<what trust/decision problem this release solves>`
- **Feature flags involved:** `<flag list>`
- **Scope type:** `behavior` | `observability` | `ui-only`

### 2) Pre-release gate (must pass)

- [ ] Change is **explainable in one sentence**.
- [ ] There is at least one **observable KPI/log** proving impact.
- [ ] Behavior is **reversible** via flag or quick rollback.
- [ ] No change artificially increases signal volume.
- [ ] Build/typecheck passes for backend + frontend.

### 3) Rollout plan

- [ ] Deploy with flags **OFF** first.
- [ ] Verify app health + scan endpoint + scheduler logs.
- [ ] Enable flag(s) for self-pilot only.
- [ ] Observe across at least **3 market sessions** before expanding scope.

### Suggested test window by release type

Use this as a default unless a release is unusually risky:

- **High-risk (decision logic changes):** `~5 market days` (about 1 week)
  - Examples: strategy trigger logic, lifecycle transition logic, ranking behavior
- **Medium-risk (measurement/analytics changes):** `3-5 market sessions`
  - Examples: timeliness tracking, expectancy calculations, analytics aggregation
- **Low-risk (UI clarity only):** `1-2 market sessions`
  - Examples: labels, layout emphasis, non-behavioral dashboard presentation

Initial baseline recommendation:

- Collect one **1-2 week baseline** once, then use the windows above per release.

### 4) KPI scorecard (track before and after)

Capture baseline and post-release values:

- `setups_generated`
- `setups_triggered`
- `target_hit_count`
- `stopped_count`
- `expectancy_global`
- `notification_timely_pct`
- `ambiguous_candle_count`
- `scan_error_count`

### 5) Pass/fail rubric

- **PASS** if:
  - [ ] No critical regressions
  - [ ] KPI movement matches intended objective
  - [ ] Explanations still deterministic and understandable
- **FAIL** if any:
  - [ ] Increased noise without better outcomes
  - [ ] Late/unusable notifications increase materially
  - [ ] Lifecycle outcomes become less reliable
  - [ ] You cannot clearly explain why metrics moved

### 6) Rollback criteria

Immediate rollback (or flag OFF) if:

- [ ] Runtime errors exceed baseline
- [ ] Notification timeliness drops below acceptable range
- [ ] Ambiguous lifecycle outcomes spike unexpectedly
- [ ] User-facing decision clarity worsens

### 7) Post-release notes

- **What improved:** `<bullet summary>`
- **What did not improve:** `<bullet summary>`
- **Unexpected side effects:** `<bullet summary>`
- **Decision:** `keep` | `tune` | `rollback`
- **Next release candidate:** `<name>`

### Suggested upcoming sequence

1. **Release 1 - Truth and Timing**
   - Lifecycle ambiguity resolution
   - Notification timeliness tracking
   - Expectancy metric
2. **Release 2 - Ranking Clarity**
   - Tiering + top setup emphasis
3. **Release 3 - Early Signal Context**
   - Developing setups + deterministic thesis/strength-risk framing