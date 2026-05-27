# Chiaro Brand Design System

> **Type:** Design system (brand book + design tokens)
> **Scope:** Define visual identity. Codify into `@chiaro/ui-tokens`. No retrofit of existing components.
> **Goal:** Lock the brand surface so future component design and marketing surfaces have a single source of truth.

---

## 1. Goal

Establish a coherent visual brand for Chiaro and codify it into design tokens that future components, marketing surfaces, and brand assets consume. The existing slice-1-through-31 surfaces stay on their current token surface; this slice ships new tokens additively without modifying live UI.

The deliverable is:

1. An expanded `@chiaro/ui-tokens` package exporting the new brand surface (palette, type, spacing, radii, shadow, logo)
2. A `docs/brand-book.md` reference document
3. A locked logo specification reproducible at any size

## 2. In scope / out of scope

**In scope:**
- Brand strategy: personality, voice, tagline
- Color palette: light mode + dark mode
- Typography scale (Inter)
- Spacing scale (4px base)
- Radii scale (sharp/editorial)
- Shadow scale (3-step warm-tinted)
- Logo system: geometry, sizing variants, lockups, do/don't
- Token implementation in `@chiaro/ui-tokens`
- `docs/brand-book.md` markdown reference

**Out of scope:**
- Retrofitting existing components (auth, home, officials, state-officials, etc.) — they keep reading `COLORS.brand.*` legacy tokens
- Migrating slice-31 auth from `#5b6cff` blue-purple to the new deep orange (future slice)
- Storybook / Ladle / live brand book site
- SVG export pipeline for the logo (CSS-only is sufficient for v1; SVG is a follow-up polish)
- ICO/PNG favicon asset generation pipeline (manual export OK for v1)
- Component-level guidelines (button variants, input variants, etc.) — that's component-design, not brand-design

## 3. Brand strategy

### 3.1 Personality

**Editorial. Civic-publication. Quiet warm. Institutional but humane.**

Reference points: NYT explainer + Bloomberg newsletter + Common Cause + the visual restraint of a Linear or Stripe marketing page. Built for citizens who want to know their representatives without being shouted at.

### 3.2 Voice

**Trustworthy advocate** (the "D" voice from brainstorming). First-person warmth that encourages engagement without overselling.

Voice rules:
- Use "your" liberally — your representatives, your district, your vote.
- Active verbs. Short sentences. No jargon unless explaining it.
- Acknowledge before fixing in errors ("Hmm, we couldn't find that address — try…").
- Avoid: campaign language, hype, exclamation points outside celebratory contexts, stacked rhetorical questions.

Surface patterns:

| Surface | Pattern | Example |
|---|---|---|
| Hero | confident invitation | "Meet the people who represent you." |
| CTA primary | imperative + subject | "See my representatives" |
| CTA secondary | gentle deferral | "Maybe later" |
| Error | warm acknowledgment + fix | "Hmm, we couldn't find that address — try adding a city or ZIP." |
| Empty | factual + forward-looking | "No votes yet this session. Check back when the legislature reconvenes." |
| Loading | brief + concrete | "Looking up your district…" |

### 3.3 Tagline

**"Know who represents you."**

Six syllables. Opens with a verb. Used under the wordmark on landing, app-store listings, marketing. Not deployed inside the app shell.

## 4. Color system

### 4.1 Light mode palette (default)

**Ink (text & dominant UI):**

| Token | Hex | Usage |
|---|---|---|
| `ink.1000` | `#1a1714` | Primary text, wordmark, headings |
| `ink.700` | `#3a322c` | Body text |
| `ink.500` | `#6b5e52` | Muted text, captions |
| `ink.300` | `#8a7a6a` | Disabled text, helper text |
| `ink.100` | `#c8b9a8` | Divider, subtle border |

**Surface (cream family):**

| Token | Hex | Usage |
|---|---|---|
| `surface.base` | `#efece5` | App background (slightly cooler than card) |
| `surface.card` | `#fdf8f3` | Card / panel background |
| `surface.elevated` | `#ffffff` | Modal, popover, elevated surface |
| `surface.subtle` | `#f7efe2` | Sub-card, hover, table-stripe |
| `border.default` | `#e8d8c2` | Card border, divider |
| `border.strong` | `#d6c3a8` | Emphasized border, table header |

**Accent (deep orange — the new brand color):**

| Token | Hex | Usage |
|---|---|---|
| `accent.100` | `#fdf2e8` | Tonal bg (badge, hover) |
| `accent.200` | `#f7d9b8` | Subtle bg |
| `accent.400` | `#e8a060` | Logo front-square gradient stop, hover state |
| `accent.500` | `#c46a2a` | **PRIMARY ACCENT** — logo border, focus ring, primary CTA |
| `accent.600` | `#a35621` | Pressed CTA |
| `accent.700` | `#82441a` | Pressed CTA dark |
| `accent.900` | `#4a2810` | Text on accent.200 backgrounds |

**Alert (decisive red — used sparingly for errors and destructive actions):**

| Token | Hex | Usage |
|---|---|---|
| `alert.100` | `#fdf2f0` | Error bg |
| `alert.300` | `#f5b8b0` | Error border |
| `alert.500` | `#a83a3a` | Error text, destructive CTA |
| `alert.700` | `#6e2222` | Pressed destructive |

### 4.2 Dark mode palette (B1 deep warm)

Same semantic structure; only hex values change. Surface inverts to deep warm browns; ink inverts to cream. Accent saturates up so the deep orange still reads on dark backgrounds.

**Ink:**

| Token | Hex | Usage |
|---|---|---|
| `ink.1000` | `#fdf8f3` | Primary text |
| `ink.700` | `#e8d8c2` | Body text |
| `ink.500` | `#8a7a6a` | Muted text |
| `ink.300` | `#6b5e52` | Disabled text |
| `ink.100` | `#3a322c` | Divider |

**Surface:**

| Token | Hex | Usage |
|---|---|---|
| `surface.base` | `#1a1410` | App background |
| `surface.card` | `#2a221c` | Card / panel |
| `surface.elevated` | `#3a2e26` | Modal, popover |
| `surface.subtle` | `#22191344` | Sub-card / hover (rgba over base) |
| `border.default` | `#3a2e26` | Card border |
| `border.strong` | `#4a3e35` | Emphasized border |

**Accent (saturated up):**

| Token | Hex | Usage |
|---|---|---|
| `accent.400` | `#c46a2a` | Hover (light-mode primary becomes hover in dark) |
| `accent.500` | `#e8a060` | **PRIMARY ACCENT** in dark mode |
| `accent.600` | `#f0b380` | Pressed |

**Alert:**

| Token | Hex | Usage |
|---|---|---|
| `alert.100` | `#2a1414` | Error bg |
| `alert.300` | `#6e2222` | Error border |
| `alert.500` | `#d05050` | Error text |

### 4.3 Semantic mapping (mode-agnostic)

Consumers read semantic tokens — never raw palette values. Same name, mode-appropriate value.

| Semantic | → Light | → Dark |
|---|---|---|
| `text.primary` | `ink.1000` | `ink.1000` (cream) |
| `text.body` | `ink.700` | `ink.700` |
| `text.muted` | `ink.500` | `ink.500` |
| `text.disabled` | `ink.300` | `ink.300` |
| `bg.app` | `surface.base` | `surface.base` |
| `bg.card` | `surface.card` | `surface.card` |
| `bg.elevated` | `surface.elevated` | `surface.elevated` |
| `bg.subtle` | `surface.subtle` | `surface.subtle` |
| `border.default` | `border.default` | `border.default` |
| `border.strong` | `border.strong` | `border.strong` |
| `border.focus` | `accent.500` | `accent.500` |
| `accent.primary` | `accent.500` | `accent.500` |
| `accent.secondary` | `accent.400` | `accent.400` |
| `alert.danger.fg` | `alert.500` | `alert.500` |
| `alert.danger.bg` | `alert.100` | `alert.100` |
| `alert.danger.border` | `alert.300` | `alert.300` |

### 4.4 Mode switching

- Web: CSS variables set under `:root` (light) and `:root[data-theme="dark"]` (dark). System preference detection via `prefers-color-scheme` media query in a small bootstrap script.
- RN: token consumers read `useColorScheme()` to pick the mode-appropriate token table.
- App ships **light-only** at the app level for v1. Tokens are dark-ready but no user-facing dark toggle exists yet. Adding the toggle is a future slice (cheap once tokens ship).

## 5. Typography

**Family:** Inter, self-hosted woff2. Files already vendored under `apps/web/public/fonts/Inter/`. RN uses `expo-font` with the same files.

**Weights used:**
- 400 Regular — body
- 500 Medium — emphasis
- 600 SemiBold — labels, small headings, button text
- 700 Bold — primary headings, wordmark

**Scale (rem-based, root 16px):**

| Token | Size | Line-height | Tracking | Weight | Usage |
|---|---|---|---|---|---|
| `display` | 2.5rem (40px) | 1.15 | -0.02em | 700 | Hero |
| `h1` | 1.75rem (28px) | 1.2 | -0.015em | 700 | Page title |
| `h2` | 1.375rem (22px) | 1.25 | -0.01em | 700 | Card title |
| `h3` | 1.125rem (18px) | 1.3 | -0.005em | 700 | Sub-card title |
| `h4` | 1rem (16px) | 1.35 | 0 | 600 | Subsection title |
| `body` | 0.9375rem (15px) | 1.55 | 0 | 400 | Default body |
| `body.sm` | 0.8125rem (13px) | 1.5 | 0 | 400 | Caption, meta |
| `label` | 0.75rem (12px) | 1.45 | 0.04em | 600 | Form label |
| `micro` | 0.6875rem (11px) | 1.4 | 0.08em | 700 | All-caps overline, badge |

**Wordmark specifics:**
- Weight 700
- Letter-spacing: `0.06em` at >24px, `0.07em` default, `0.08em` at <14px
- Color: `text.primary` (ink-1000)

## 6. Spacing

**Base unit: 4px.** Tailwind-compatible scale (only the sizes we actually use are exported).

| Token | px | Usage |
|---|---|---|
| `space.0` | 0 | reset |
| `space.1` | 4 | hairline gap |
| `space.2` | 8 | tight inline gap |
| `space.3` | 12 | default chip gap |
| `space.4` | 16 | card inner gap, list item gap |
| `space.5` | 20 | card padding |
| `space.6` | 24 | section gap |
| `space.8` | 32 | major section gap |
| `space.10` | 40 | page-top |
| `space.12` | 48 | hero padding |
| `space.16` | 64 | hero v-padding |

## 7. Radii (sharp / editorial)

| Token | px | Usage |
|---|---|---|
| `radii.none` | 0 | dividers, table edges |
| `radii.xs` | 2 | inline chip, small tag, logo squares (favicon scale) |
| `radii.sm` | 4 | input, button, table row |
| `radii.md` | 6 | card |
| `radii.lg` | 8 | modal, large card |
| `radii.xl` | 12 | hero card, splash |
| `radii.full` | 9999 | avatar, dot |

## 8. Shadow (subtle 3-step, warm-tinted)

Warm brown rgba matches the cream background tonally; pure black shadows on cream read cold and clinical.

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| `shadow.sm` | `0 1px 2px rgba(58,40,24,0.06)` | `0 1px 2px rgba(0,0,0,0.4)` | input, button hover |
| `shadow.md` | `0 2px 4px rgba(58,40,24,0.08), 0 1px 2px rgba(58,40,24,0.06)` | `0 2px 4px rgba(0,0,0,0.5)` | card |
| `shadow.lg` | `0 8px 16px rgba(58,40,24,0.10), 0 2px 4px rgba(58,40,24,0.08)` | `0 8px 16px rgba(0,0,0,0.6)` | modal, popover |

## 9. Logo system

### 9.1 Construction

The mark is two cascading squares with L-shaped corner brackets framing the overlap region. All dimensions scale with a single parameter **S** (square side length).

| Element | Spec |
|---|---|
| **Squares** | 2× S × S; corner radius `clamp(2px, S × 0.094, 6px)` |
| **Square borders** | 1px stroke at S=32; `clamp(0.75px, S × 0.031, 2px)` for other sizes; color `accent.500` |
| **Back square fill** | `linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)` |
| **Front square fill** | `linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)` |
| **Front offset** | `(S × 0.4375, S × 0.25)` SE from back square |
| **Overlap rect** | `(S × 0.5625) wide × (S × 0.75) tall` |
| **Corner brackets** | 4× L-shape, one per overlap-rect corner, arm length `S × 0.20`, stroke `clamp(0.75px, S × 0.047, 2.5px)`, color `accent.500` |
| **Bounding box** | `S × 1.4375 wide × S × 1.25 tall` |

### 9.2 Size variants (concrete values)

| Variant | S | Bounding | Border | Bracket arm | Bracket stroke | Use |
|---|---|---|---|---|---|---|
| Favicon | 12 | 17×15 | 0.75px | 2.5px | 0.75px | favicon.ico, PWA 16px |
| Tiny | 16 | 23×20 | 0.75px | 3px | 1px | navbar mark, inline mark |
| Small | 24 | 35×30 | 1px | 5px | 1px | secondary header lockup |
| Medium | 32 | 46×40 | 1px | 6px | 1.5px | card lockup, footer |
| Large | 48 | 69×60 | 1.5px | 10px | 2px | landing nav lockup |
| Hero | 64 | 92×80 | 2px | 13px | 2.5px | splash, marketing hero |

Below S=12: fall back to a **single solid filled square** (no overlap, no brackets) — the overlap construction is unreadable.

### 9.3 Wordmark lockup

Lockup = mark on left + wordmark on right, vertically center-aligned on mark's vertical center.

| Variant | Mark S | Wordmark size | Wordmark tracking | Mark↔wordmark gap |
|---|---|---|---|---|
| Hero | 64 | 42px | 0.06em | 26px |
| Large | 48 | 32px | 0.06em | 20px |
| Standard | 32 | 22px | 0.07em | 14px |
| Inline | 24 | 16px | 0.07em | 10px |
| Compact | 16 | 11px | 0.08em | 6px |

### 9.4 Lockup with tagline

Tagline stacks below wordmark.

- Tagline size: `wordmark × 0.45` (e.g., wordmark 30px → tagline 13px)
- Tagline weight: 400
- Tagline color: `text.muted` (ink-500)
- Tagline tracking: 0.02em
- Gap above tagline: `wordmark × 0.13`

### 9.5 Clearspace

Minimum clearspace around the lockup on all sides: `S × 0.5`. No interactive elements, text, or images inside this zone.

### 9.6 Backgrounds

- **Preferred:** `surface.card` (#fdf8f3 cream) or `surface.elevated` (#ffffff)
- **Allowed:** `surface.base` (#efece5)
- **Dark mode:** `surface.card` (#2a221c) — squares keep the orange family; fills lighten slightly to compensate for the dark surface (handled automatically since fills are alpha-based)
- **Photographs:** only with a solid scrim that takes the surface to a flat tone

### 9.7 Do / Don't

**Do:**
- Render on cream or white in light mode; on deep warm brown in dark mode
- Keep brackets visible at sizes ≥16; they're load-bearing identity elements
- Maintain the SE cascade — do not flip horizontally or vertically

**Don't:**
- Recolor either square outside the documented orange family
- Make the squares solid (no gradient) — the alpha gradient is the "transparency" identity hook
- Rotate, skew, or distort the mark
- Replace the wordmark font with anything other than Inter 700
- Render below 12px without falling back to the solid-square variant

## 10. Token implementation

### 10.1 Package structure

Expand `packages/ui-tokens/src/` from the current single `colors.ts` into:

```
packages/ui-tokens/src/
├── index.ts          # barrel — exports BRAND + back-compat COLORS, MAP_COLORS, etc.
├── colors.ts         # legacy COLORS export, unchanged
├── brand/
│   ├── index.ts      # exports BRAND object
│   ├── palette.ts    # ink, surface, accent, alert (light + dark dicts)
│   ├── semantic.ts   # semantic token map (text.*, bg.*, border.*, etc.)
│   ├── typography.ts # scale + weights + Inter family reference
│   ├── spacing.ts    # space.* scale
│   ├── radii.ts      # radii.* scale
│   ├── shadow.ts     # shadow.* scale
│   └── logo.ts       # logo geometry ratios + gradient strings
└── map-colors.ts     # MAP_COLORS, unchanged (moved out of colors.ts for clarity)
```

### 10.2 Public API

The new exports are namespaced under a single `BRAND` object so consumers know they're reading the new system:

```ts
import { BRAND } from '@chiaro/ui-tokens'

BRAND.palette.light.ink[1000]     // #1a1714
BRAND.palette.dark.surface.card   // #2a221c
BRAND.semantic.light.text.primary // ref to ink-1000
BRAND.type.h1                     // { size, lineHeight, tracking, weight }
BRAND.space[4]                    // 16
BRAND.radii.md                    // 6
BRAND.shadow.md.light             // CSS string
BRAND.logo.geometry.offsetXRatio  // 0.4375
BRAND.logo.fills.backSquare       // CSS gradient string
```

### 10.3 Back-compat (legacy `COLORS`)

The existing `COLORS` export stays unchanged. Slice-1-through-31 components keep reading `COLORS.brand.primary` (#5b6cff blue) and `COLORS.neutral.surface` etc. — no breakage. A `@deprecated` JSDoc on `COLORS` directs new code to `BRAND`.

This means the auth screens shipped in slice 31 remain blue-purple. Visually inconsistent with the new brand, but **explicitly out of scope** for this slice. The auth-retrofit follow-up slice will migrate auth from `COLORS.brand.primary` to `BRAND.semantic.accent.primary`.

### 10.4 Helpers

Two helper functions in `brand/index.ts`:

```ts
// Mode-aware semantic resolver
export function getSemantic(mode: 'light' | 'dark'): SemanticTokens

// Logo geometry resolver — returns concrete pixels for a given S
export function logoGeometry(S: number): {
  squareSize: number
  squareRadius: number
  offsetX: number
  offsetY: number
  overlapWidth: number
  overlapHeight: number
  bracketArm: number
  bracketStroke: number
  borderStroke: number
  boundingWidth: number
  boundingHeight: number
}
```

These let consumers (a future `<Logo size={48} />` component, the brand book demo page, future Storybook stories) render the mark without reimplementing the math.

### 10.5 No CSS variable emission in this slice

This slice ships TypeScript exports only. Wiring `BRAND.semantic` into actual CSS variables on `:root` is a downstream task that lands when the first component consumes the new system. For now, components opt in by importing `BRAND` and reading values directly.

## 11. Brand book deliverable

A single scrollable markdown reference at **`docs/brand-book.md`** (deliberately not under `docs/superpowers/` — this is permanent reference, not a slice artifact).

Sections:

1. **Overview** — one paragraph: what Chiaro is, who the brand serves
2. **Strategy** — personality, voice, tagline
3. **Palette** — swatch tables (light + dark), semantic mapping
4. **Typography** — scale table + Inter family
5. **Spacing** — scale table
6. **Radii** — scale table
7. **Shadow** — scale table
8. **Logo** — geometry, sizing matrix, lockups, clearspace, do/don't, examples
9. **Voice & tone** — copy patterns per surface (hero, CTA, error, empty, loading)
10. **Token reference** — TS export → semantic name → hex/value table

Inline SVG snippets and small HTML+CSS demos can be embedded as needed, but the doc must remain readable as plain markdown on GitHub (no required JS or external assets).

## 12. Testing

This is a tokens + docs slice — no UI behavior to test. The work is verified by:

- `pnpm -r typecheck` passes (proves new `BRAND` types compile and back-compat `COLORS` is unchanged)
- `pnpm test` passes (no UI consumers yet; only @chiaro/ui-tokens has tests — palette table sanity)
- Manual check that `docs/brand-book.md` renders cleanly on GitHub

Add one new test file `packages/ui-tokens/test/brand.test.ts`:

- Asserts BRAND.palette.light and BRAND.palette.dark have identical key shapes (mode parity)
- Asserts `logoGeometry(32)` returns the canonical 46×40 bounding box
- Asserts BRAND.type scale tokens are strictly ascending by size
- Asserts no hex value is accidentally duplicated *within a single mode's role group* (e.g., two different `ink.*` tokens with the same hex). Cross-role reuse (e.g., light `accent.500` = dark `accent.400` = `#c46a2a`) is intentional and allowed.

## 13. Acceptance criteria

- `packages/ui-tokens/src/brand/` exports `BRAND` with palette + semantic + type + spacing + radii + shadow + logo + helpers
- `packages/ui-tokens/src/colors.ts` unchanged; `COLORS` and `MAP_COLORS` continue exporting
- `docs/brand-book.md` exists, renders on GitHub, covers all 10 sections
- New `packages/ui-tokens/test/brand.test.ts` passes (~4-6 cases)
- `pnpm -r typecheck` green
- `pnpm test` green
- No existing component file is modified

## 14. Risks & open questions

**Risk:** The token namespace split (`BRAND` for new, `COLORS` for legacy) means new code and old code use different APIs. Mitigation: JSDoc `@deprecated` on `COLORS`, brand book clearly states the migration path, the future auth-retrofit slice migrates the first real consumer and proves the pattern.

**Risk:** Dark mode ships without an actual toggle, so the dark tokens are unverified in practice. Mitigation: visual brand book preview page (out of scope here but planned) will render side-by-side light/dark; first real dark consumer is the toggle slice.

**Open question (deferred to spec review):** Should the logo expose a TS-rendered `<Logo />` component in this slice, or wait until the first consumer (probably auth-retrofit or the brand book preview page)? The spec assumes **defer** — geometry helpers ship, but no React component. Asking at review.

---

**Next step after this spec is approved:** Invoke `writing-plans` to break the implementation into bite-sized tasks.
