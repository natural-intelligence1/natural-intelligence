# Natural Intelligence — Design System Decisions

This file records binding architectural decisions about the NI design system.
Each entry states the decision, the rationale, and the migration path if the
decision is ever reversed. Decisions are append-only — do not delete entries.

---

## DD-001 — Dark mode is explicitly out of scope (Phase 1)

**Date:** 27 April 2026
**Status:** Active

### Decision
Dark mode is not implemented and will not be implemented during Phase 1 of the
Natural Intelligence platform. No `dark:` Tailwind class variants should be
added to any component. No dark colour palette should be created.

### Rationale
- The token system currently uses static Tailwind colour names compiled at
  build time. There are no CSS custom properties.
- Adding dark mode correctly requires migrating every semantic token to a CSS
  custom property (`--color-surface-base: ...`) so that values can be overridden
  at the `:root [data-theme="dark"]` or `@media (prefers-color-scheme: dark)`
  level. This is a non-trivial, whole-system change.
- Phase 1 scope does not include dark mode. Investing in `dark:` variants before
  the CSS variable migration would create dead code that conflicts with the
  correct implementation later.

### Migration path (when dark mode is added)
1. Convert all semantic token values in `tokens.js` to CSS custom property names
   (e.g. `surface.base` becomes `var(--color-surface-base)` in the Tailwind
   config, with the actual value defined in `globals.css`).
2. Add a `[data-theme="dark"]` block (or `@media prefers-color-scheme: dark`)
   in each app's `globals.css` that overrides the custom properties.
3. Add a dark colour primitive palette to `tokens.js` alongside the existing
   warm/sage primitives.
4. Remove this decision entry once dark mode ships.

### What is allowed
The admin shell uses `surface.inverse` tokens (a dark surface built from the
warm primitive palette). This is **not** dark mode — it is a static design
decision about the admin shell chrome. `surface.inverse` values are fixed and
do not change based on user preference.

---

## DD-002 — Admin shell is permanently dark; web shell is permanently light

**Date:** 27 April 2026
**Status:** Active

### Decision
The admin portal (`apps/admin`) uses a dark sidebar shell (`surface.inverse`,
`surface.inverse-raised`) as a permanent brand decision. The public web app
(`apps/web`) uses the warm-white surface system. This contrast is architecturally
intentional: the visual separation reinforces that the admin portal is a
privileged internal environment.

### Token group
`surface.inverse` — `warm[900]` — primary dark shell background
`surface.inverse-raised` — `warm[800]` — elevated dark: active nav, hover
`border.inverse` — `warm[700]` — dividers on dark surfaces
`text.inverted` — `warm[0]` — primary text on dark (white)
`text.on-inverse` — `warm[400]` — secondary/muted text on dark

These tokens are semantically distinct from a dark-mode colour scheme.
They are fixed values that do not respond to `prefers-color-scheme`.

---

## DD-003 — Fonts loaded via next/font/google, not CDN

**Date:** 27 April 2026
**Status:** Active

### Decision
Inter (primary sans) is loaded exclusively via `next/font/google` in each
app's root layout. No Google Fonts `<link>` tags, no CDN, no reliance on
browser defaults. JetBrains Mono (mono) is referenced in tokens but not yet
loaded — add it when it is first needed in the UI.

### Implementation
Each layout imports `Inter` from `next/font/google` with:
- `subsets: ['latin']`
- `variable: '--font-inter'`
- `display: 'swap'`

The `inter.variable` class is applied to `<html>`. The shared Tailwind base
config (`tailwind.base.js`) prepends `var(--font-inter)` to `fontFamily.sans`
so that the Tailwind `font-sans` utility picks up the loaded font.

---

## DD-004 — error* and danger* status tokens are the same values with different semantic intent

**Date:** 27 April 2026
**Status:** Active

### Decision
`status.errorBg/errorText/errorBorder` — system error states (form validation
failures, API errors, network issues). Use on error messages and inline alerts.

`status.dangerBg/dangerText/dangerBorder` — destructive action UI (delete
buttons, irreversible operations). Use on destructive `Button` and destructive
confirmation states.

Both groups currently resolve to the same hex values. They are kept as separate
named tokens to preserve semantic intent and allow them to diverge in future
if the design requires (e.g. a deeper red for danger vs a softer red for error).

### Component mapping
- `Badge` variant `error` → uses `status.error*` tokens
- `Button` variant `danger` → uses `status.danger*` tokens
- Inline error alerts → use `status.error*` tokens directly

---

## DD-005 — Overlay scrim is warm-tinted, not pure black

**Date:** 27 April 2026
**Status:** Active

### Decision
Modal backdrops and drawer scrims use `overlay.scrim = rgba(17,17,17,0.5)`
rather than `bg-black/40` or pure `rgba(0,0,0,0.4)`. The value `#111111` is
a warm-leaning near-black consistent with the NI ink tones, avoiding the
clinical feel of pure black overlays.

### Usage
Always use `bg-overlay-scrim` on overlay backdrops. Do not use `bg-black/*`
opacity modifiers in components.
