---
name: natural-intelligence-design
description: Use this skill to generate well-branded interfaces and assets for Natural Intelligence (NI) — a premium AI-powered health platform for naturopathic and functional medicine in the UK. Use either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Brand:** calm, intelligent, trustworthy. Private members' health club, not a wellness influencer.
- **Tokens:** `colors_and_type.css` (in this directory) or `packages/design-tokens/tokens.js` for Tailwind.
- **Logo:** Wordmark only — "Natural" in `#0E0D0B` (obsidian) + "Intelligence" in italic gold `#B8935A`.
- **Fonts:** DM Sans (UI), **Cormorant Garamond** (hero/display only — v5), JetBrains Mono (data).
- **Gold:** `#B8935A` — the primary brand accent (v5: darker, more amber than previous `#C9A96E`).
- **Sage:** `#4E7A5C` — success / vetted states only. Never as primary brand colour.
- **Token system:** `packages/design-tokens/tokens.js` — Tailwind semantic classes (`text-text-brand`, `bg-surface-base`, etc). CSS variables in `docs/design/colors_and_type.css`.
- **UI kits:** `apps/web/`, `apps/admin/`, `apps/care/`
- **Never use:** pure white `#FFFFFF`, pure black `#000000`, red for warnings, bright green, cold blue, emoji, gradients, AI-slop tropes.
- **Use sparingly:** gold (one accent per section), the dark obsidian shell (only for intelligence layer banners).

## v5 changes (current)
- **Cormorant Garamond** replaces Playfair Display as the display/editorial serif
- Gold shifted from `#C9A96E` → `#B8935A` (darker, more amber-brown)
- Palette is warmer and slightly darker throughout — page bg `#F8F6F2`, text `#0E0D0B`
- Gold ultra `#F8F1E4` added for eyebrow pill backgrounds
- Sage updated to `#4E7A5C` (slightly more muted)
