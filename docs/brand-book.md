# Chiaro Brand Book

> The visual system for Chiaro: civic engagement made clear.
> Source of truth for color, typography, spacing, logo, and voice.

## 1. Overview

Chiaro helps citizens know who represents them. The brand is editorial, civic-publication, quietly warm — built on the principle that informed citizens deserve clear, restrained design that respects their attention.

The system is codified in `@chiaro/ui-tokens` under the `BRAND` export. Consumers read semantic tokens (`text.primary`, `bg.card`, `accent.primary`) and never branch on color mode themselves.

## 2. Strategy

**Personality.** Editorial. Civic-publication. Quiet warm. Institutional but humane. Reference points: NYT explainer + Bloomberg newsletter + Common Cause + the restraint of Linear or Stripe marketing.

**Voice.** Trustworthy advocate. First-person warmth that encourages engagement without overselling. Use "your" liberally. Active verbs. Short sentences. Acknowledge before fixing in errors. Avoid campaign language, hype, exclamation points outside celebratory contexts.

**Tagline.** *Know who represents you.*

Six syllables. Opens with a verb. Used under the wordmark on landing, app-store listings, and marketing. Not deployed inside the app shell.

## 3. Palette

### Light mode (default)

**Ink.** `#1a1714` (primary) · `#3a322c` (body) · `#6b5e52` (muted) · `#8a7a6a` (disabled) · `#c8b9a8` (divider)

**Surface.** `#efece5` (app base) · `#fdf8f3` (card) · `#ffffff` (elevated) · `#f7efe2` (subtle)

**Border.** `#e8d8c2` (default) · `#d6c3a8` (strong)

**Accent — deep orange.** `#fdf2e8` · `#f7d9b8` · `#e8a060` · **#c46a2a (primary)** · `#a35621` · `#82441a` · `#4a2810`

**Alert — decisive red.** `#fdf2f0` · `#f5b8b0` · **#a83a3a (primary)** · `#6e2222`

### Dark mode (B1 deep warm)

**Ink.** `#fdf8f3` · `#e8d8c2` · `#8a7a6a` · `#6b5e52` · `#3a322c`

**Surface.** `#16181c` · `#1e2126` · `#262a30` · `#1c1e2270`

**Border.** `#2a2d33` · `#3a3e45`

**Accent — cool slate-blue.** `#1a1f28` · `#232a36` · `#2e405a` (hover) · **`#374f68`** (primary) · `#485e76` (pressed) · `#6a7d96` · `#ced8e4`

**Alert.** `#2a1414` · `#6e2222` · **`#d05050`** · `#f08080`

### Semantic mapping

Consumers read these mode-agnostic names; mode-appropriate values resolve automatically via `getSemantic(mode)`.

| Semantic | Light | Dark |
|---|---|---|
| `text.primary` | `#1a1714` | `#fdf8f3` |
| `text.body` | `#3a322c` | `#e8d8c2` |
| `text.muted` | `#6b5e52` | `#8a7a6a` |
| `bg.app` | `#efece5` | `#16181c` |
| `bg.card` | `#fdf8f3` | `#1e2126` |
| `bg.elevated` | `#ffffff` | `#262a30` |
| `border.default` | `#e8d8c2` | `#2a2d33` |
| `border.focus` | `#c46a2a` | `#374f68` |
| `accent.primary` | `#c46a2a` | `#374f68` |
| `accent.secondary` | `#e8a060` | `#485e76` |
| `alert.danger.fg` | `#a83a3a` | `#d05050` |
| `portrait.gradient.from` | `#c46a2a` | `#6b7a5d` |
| `portrait.gradient.to` | `#e8a060` | `#9caa8e` |
| `portrait.initials` | `#ffffff` | `#fff0dc` |

## 4. Typography

**Family.** Inter, self-hosted woff2. Weights 400 / 500 / 600 / 700.

| Token | Size | Line-height | Tracking | Weight | Usage |
|---|---|---|---|---|---|
| `display` | 40px | 1.15 | -0.02em | 700 | Hero |
| `h1` | 28px | 1.2 | -0.015em | 700 | Page title |
| `h2` | 22px | 1.25 | -0.01em | 700 | Card title |
| `h3` | 18px | 1.3 | -0.005em | 700 | Sub-card title |
| `h4` | 16px | 1.35 | 0 | 600 | Subsection |
| `body` | 15px | 1.55 | 0 | 400 | Default body |
| `bodySm` | 13px | 1.5 | 0 | 400 | Caption, meta |
| `label` | 12px | 1.45 | 0.04em | 600 | Form label |
| `micro` | 11px | 1.4 | 0.08em | 700 | Overline, badge |

**Wordmark.** Weight 700; letter-spacing `0.06em` at >24px, `0.07em` default, `0.08em` at <14px.

## 5. Spacing

4px base unit. `space.1` = 4 · `space.2` = 8 · `space.3` = 12 · `space.4` = 16 · `space.5` = 20 · `space.6` = 24 · `space.8` = 32 · `space.10` = 40 · `space.12` = 48 · `space.16` = 64.

## 6. Radii

Sharp / editorial. `none` = 0 · `xs` = 2 · `sm` = 4 · `md` = 6 · `lg` = 8 · `xl` = 12 · `full` = 9999.

## 7. Shadow

Warm-tinted in light mode (brown rgba); pure black in dark.

| Token | Light | Dark | Use |
|---|---|---|---|
| `sm` | `0 1px 2px rgba(58,40,24,0.06)` | `0 1px 2px rgba(0,0,0,0.4)` | input, button hover |
| `md` | `0 2px 4px rgba(58,40,24,0.08), 0 1px 2px rgba(58,40,24,0.06)` | `0 2px 4px rgba(0,0,0,0.5)` | card |
| `lg` | `0 8px 16px rgba(58,40,24,0.10), 0 2px 4px rgba(58,40,24,0.08)` | `0 8px 16px rgba(0,0,0,0.6)` | modal |

## 8. Logo

The Chiaro mark is two cascading squares with four L-shaped corner brackets framing the overlap. All dimensions scale with **S** (square side, px).

### Construction

- **Squares.** 2× S × S; corner radius `clamp(2, S × 0.09375, 6)`.
- **Border.** 1px stroke at S=32; `clamp(0.75, S × 0.03125, 2)` at other sizes; color `#c46a2a`.
- **Back fill.** `linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)`.
- **Front fill.** `linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)`.
- **Front offset.** `(S × 0.4375, S × 0.25)` SE from back square.
- **Overlap.** `(S × 0.5625) × (S × 0.75)`.
- **Brackets.** 4× L at overlap corners; arm `S × 0.20`, stroke `clamp(0.75, S × 0.046875, 2.5)`, color `#c46a2a`.
- **Bounding box.** `(S × 1.4375) × (S × 1.25)`.

### Size variants

| Variant | S | Bounding | Border | Bracket arm | Bracket stroke |
|---|---|---|---|---|---|
| Favicon | 12 | 17×15 | 0.75 | 2.4 | 0.75 |
| Tiny | 16 | 23×20 | 0.75 | 3.2 | 0.75 |
| Small | 24 | 35×30 | 0.75 | 4.8 | 1.125 |
| Medium | 32 | 46×40 | 1 | 6.4 | 1.5 |
| Large | 48 | 69×60 | 1.5 | 9.6 | 2.25 |
| Hero | 64 | 92×80 | 2 | 12.8 | 2.5 |

Below S=12: fall back to a single solid filled square (no overlap, no brackets) — the construction is unreadable.

### Wordmark lockup

Mark on left + wordmark on right, center-aligned on mark's vertical center.

| Variant | Mark S | Wordmark | Tracking | Gap |
|---|---|---|---|---|
| Hero | 64 | 42px | 0.06em | 26 |
| Large | 48 | 32px | 0.06em | 20 |
| Standard | 32 | 22px | 0.07em | 14 |
| Inline | 24 | 16px | 0.07em | 10 |
| Compact | 16 | 11px | 0.08em | 6 |

### Tagline (when shown)

Stacks below wordmark. Size = wordmark × 0.45. Weight 400. Color `text.muted`. Tracking 0.02em. Gap above = wordmark × 0.13.

### Clearspace

Minimum on all sides: `S × 0.5`.

### Backgrounds

- **Light:** `surface.card` or `surface.elevated` (preferred); `surface.base` (allowed).
- **Dark:** `surface.card` (#1e2126). Squares keep the orange family; alpha gradients self-correct.
- **Photos:** only with a solid scrim to a flat tone.

### Do / Don't

**Do.**
- Render on cream or white in light mode; on deep warm brown in dark mode.
- Keep brackets visible at sizes ≥16 — they're load-bearing identity.
- Maintain the SE cascade — do not flip.

**Don't.**
- Recolor either square outside the orange family.
- Make the squares solid (the alpha gradient is the transparency identity hook).
- Rotate, skew, or distort.
- Replace the wordmark font with anything other than Inter 700.
- Render below 12px without the solid-square fallback.

## 9. Voice & tone

| Surface | Pattern | Example |
|---|---|---|
| Hero | confident invitation | "Meet the people who represent you." |
| CTA primary | imperative + subject | "See my representatives" |
| CTA secondary | gentle deferral | "Maybe later" |
| Error | warm acknowledgment + fix | "Hmm, we couldn't find that address — try adding a city or ZIP." |
| Empty | factual + forward-looking | "No votes yet this session. Check back when the legislature reconvenes." |
| Loading | brief + concrete | "Looking up your district…" |

### Voice rules

- Use "your" liberally — your representatives, your district, your vote.
- Active verbs. Short sentences.
- No jargon unless explaining it.
- Acknowledge before fixing in errors.
- Avoid campaign language, hype, exclamation points outside celebratory contexts, stacked rhetorical questions.

## 10. Token reference

All exports live under `@chiaro/ui-tokens`. The root `BRAND` object collects everything; individual `BRAND_*` exports + `getSemantic` + `logoGeometry` are also re-exported at the package root for tree-shake friendliness.

```ts
import { BRAND, getSemantic, logoGeometry } from '@chiaro/ui-tokens'

// Palette
BRAND.palette.light.ink[1000]     // #1a1714
BRAND.palette.dark.surface.card   // #1e2126

// Semantic
BRAND.semantic.light.text.primary // #1a1714
getSemantic('dark').accent.primary // #374f68

// Scales
BRAND.type.h1.sizePx              // 28
BRAND.space[4]                    // 16
BRAND.radii.md                    // 6
BRAND.shadow.md.light             // CSS box-shadow string

// Logo
BRAND.logo.ratios.offsetXRatio    // 0.4375
BRAND.logo.fills.backSquare       // gradient CSS
logoGeometry(48).boundingWidth    // 69
```

### Legacy tokens

The old `COLORS` and `MAP_COLORS` exports remain unchanged for back-compat with slice-1-through-31 consumers. They are `@deprecated`; new work imports from `BRAND.*`.

---

*See `docs/superpowers/specs/2026-05-26-brand-design-design.md` for the original design spec.*
