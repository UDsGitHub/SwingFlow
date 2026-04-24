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