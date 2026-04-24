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

*Add new sections below as needed.*
