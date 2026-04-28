# Natural Intelligence — Design System (v5)

A premium AI-powered health platform for naturopathic and functional medicine in the UK. Three things in one: **a vetted practitioner directory**, **an education & community platform** (workshops, resources), and **a coming clinical intelligence layer** (DailyPath, BioHub, RootFinder, LifeTracker, AutoAdjust).

The platform serves three audiences: **Members** (people seeking natural healthcare), **Practitioners** (independent professionals — naturopathic doctors, functional medicine specialists, nutritionists, health coaches), and **Visitors** (curious newcomers).

---

## Sources

- **Codebase:** `natural-intelligence1/natural-intelligence` (GitHub) — Next.js monorepo (`apps/web`, `apps/admin`, `apps/care`) with shared `packages/design-tokens` and `packages/ui`.
- **Design tokens:** `packages/design-tokens/tokens.js` — Tailwind theme extension.
- **CSS variables:** `docs/design/colors_and_type.css` — for static HTML prototypes.
- **Version:** v5 (adopted 2026-04-28). Previous version used Playfair Display and `#C9A96E` gold.

---

## The feeling

In three words: **calm, intelligent, trustworthy**.

- A private members' health club — not an NHS waiting room
- A precision watchmaker — not a wellness influencer
- A warm library — not a cold hospital
- Apple clarity — not SaaS dashboard clutter

When someone lands on the platform, they should feel: *"This is serious. This is for me. I can trust this."*

---

## Visual foundations

### Colour (v5)

The palette is intentionally warm and quiet. **There is no pure white and no pure black.** All page surfaces are warm parchment (`#F8F6F2`); ink is obsidian (`#0E0D0B`).

| Role | Hex | Notes |
| --- | --- | --- |
| Page bg | `#F8F6F2` | warm parchment — never pure white |
| Card bg | `#F2EFE9` | cream |
| Card inner | `#FDFCFA` | near-white — used rarely as inner card only |
| Border | `#DDD9D1` | warm neutral |
| Border strong | `#C4BFB6` | hover / strong dividers |
| Primary text | `#0E0D0B` | obsidian ink |
| Secondary text | `#4A4945` | prose |
| Muted / metadata | `#8A8880` | |
| Gold accent | `#B8935A` | **one element per section maximum** |
| Gold mid | `#D4B07A` | |
| Gold light | `#EDD8B4` | |
| Gold ultra | `#F8F1E4` | eyebrow pill backgrounds |
| Sage (positive) | `#4E7A5C` | success states, vetted badge |
| Sage mid | `#6B9878` | hover states |
| Sage bg | `#E8F2EB` | |
| Amber (caution) | `#B87840` | **never red for warnings** |
| Amber bg | `#FDF3EA` | |
| Dark shell | `#0E0D0B` | intelligence layer banner only |
| Dark card | `#1A1917` | |
| Dark border | `#2A2825` | |

**Forbidden:** pure white `#FFFFFF`, pure black `#000000`, any red (errors or warnings), bright green for success, cold blue.

### Type

Three families. **DM Sans** for UI, **Cormorant Garamond** for hero headlines only (italic style for gold word), **JetBrains Mono** for data values (lab numbers, dosages, timestamps).

| Token | Size / Weight / Family |
| --- | --- |
| display-light | clamp(40px–62px) / 300–400 / Cormorant Garamond |
| display-medium | clamp(40px–62px) / 500 / Cormorant Garamond (italic for gold emphasis) |
| h2 | 28–32px / 500 / DM Sans |
| h3 | 22px / 500 / DM Sans |
| h4 | 18px / 500 / DM Sans |
| body-lg | 15px / 400 / DM Sans |
| body | 14px / 400 / DM Sans |
| body-sm | 13px / 400 / DM Sans |
| caption | 12px / 400 / DM Sans |
| eyebrow | 11px / 500 / DM Sans / uppercase, letter-spacing 0.08em |

### Spacing

Base unit: **4px**. Multiples only: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80`. No arbitrary values.

### Border radius

| | |
| --- | --- |
| Tags & pills | `6px` |
| Buttons & inputs | `8px` |
| Standard cards | `12px` |
| Featured cards | `16px` |
| Avatars & badges | full round |

### Borders

Always **`1px solid #DDD9D1`** (v5). Never 0px on cards. Never 2px.

### Shadows (v5 — warm obsidian tint)

```
card:     0 1px 4px rgba(14,13,11,.07), 0 1px 2px rgba(14,13,11,.05)
elevated: 0 8px 32px rgba(14,13,11,.12), 0 2px 8px rgba(14,13,11,.07)
```

### Animation

- All transitions: `200ms ease-out` standard. Hover-state colour changes use `150ms`.
- Motion is restrained: micro-animations only — fades, soft scales. No bounces, no springs.

### Hover & press states

- **Hover (cards):** shadow `card → elevated`, border darkens.
- **Primary button hover:** `#0E0D0B → #2a2928`.
- **Gold button hover:** opacity `100% → 90%`.
- **Press:** opacity `→ 80%`.

### Cards

- **Standard:** `#F2EFE9` bg, `1px #DDD9D1` border, `12px` radius, card shadow, `20–24px` padding.
- **Featured:** same but `16px` radius and elevated shadow.
- **Dark (intelligence banner):** `#0E0D0B` bg, `1px #2A2825` border, `16px` radius, no shadow.

### Layout

- Desktop max width: `1200px` (centred).
- Sticky nav height: `64px`.
- Vertical rhythm: section padding `80px / 56px` desktop; `40px / 32px` mobile.

---

## Content fundamentals

**Tone.** Warm authority. A trusted advisor, not a salesperson. UK English.

**Voice rules.**

- Address the reader as *you*. Refer to the platform as *we* / *Natural Intelligence*.
- Short sentences. Max 2 sentences per UI paragraph.
- No emoji. No exclamation marks. No SaaS-isms ("supercharge", "unlock", "level up").
- Title case for headings, sentence case for buttons.

**Approved hero copy (v5):**
> "The space between" (light)
> "normal and thriving." (medium)

**Intelligence-layer language.** Never say *AI* prominently. Use *personalised*, *adaptive*, *intelligent*, *pattern recognition*. Module names: **DailyPath**, **BioHub**, **RootFinder**, **LifeTracker**, **AutoAdjust**.

---

## Iconography

- **System:** [Lucide](https://lucide.dev) — `1.5px` stroke, `currentColor`.
- **Sizing:** `16px` inline, `20px` nav/cards, `24px` hero accents.
- **Logo:** Wordmark — `Natural` in `#0E0D0B` + `Intelligence` in italic `#B8935A`.
- **No emoji. No unicode symbols as decoration.**

---

## Caveats

- Fonts loaded from Google Fonts CDN — replace with licensed copies for production.
- The `packages/design-tokens/tokens.js` Tailwind system maps `brand.default → gold.default (#B8935A)`. Previous iteration used sage as primary brand colour — this has been corrected in v5.
