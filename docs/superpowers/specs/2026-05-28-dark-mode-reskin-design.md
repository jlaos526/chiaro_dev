# Slice 40 — Dark mode reskin (palette + portrait)

**Status:** Draft for review
**Date:** 2026-05-28
**Tier:** Compressed-to-Mega-Slice (~9–11 files)
**Prerequisite slices:** 33 (BRAND tokens), 37 (domain dark palettes), 38 (mode toggle UI)
**Closes roadmap decisions:** #1 link blue (kept blue), #3 BioPortrait gradient (rebased), plus de-novo dark-mode-bg/accent reskin

## 1. Goal

Replace the heuristic dark mode palette (slice 33–37 cream-on-warm-brown family) with a coherent cool-slate-and-slate-blue dark theme, while preserving light mode unchanged. BioPortrait gains a dedicated `semantic.portrait` token surface that is genuinely mode-aware (orange in light, sage in dark) rather than derived from `link.fg`.

## 2. Non-goals

- **Light mode changes.** Light palette + light portrait stay exactly as slice 33–37 shipped them. Verified by ui-tokens light-palette tests staying green without modification.
- **Other roadmap items.** AlignmentChip tier rebase (#2), industry rainbow (#4), finance "money in" green (#5), MetricCardShell retune (#6) all remain queued. They were considered out of scope by user-driven brainstorm.
- **Link color rebase.** Decision locked to **keep** the slice 33–37 blue: `#3b6ed1` light / `#7a98e1` dark. Original roadmap framing of "rebase to accent" was rejected during visual brainstorm.
- **Dark mode `ink.*` text colors.** Cream ink family stays (cream reads well on both warm and cool dark surfaces). Touching ink risks regressions across every text-bearing component.
- **Alert / signal palette changes.** Dark `alert.danger.fg`, `alert.warning.fg`, `alert.success.fg`, `signal.success` stay unchanged. Cool-slate cascade is bounded to surface + accent ramp only.

## 3. User stories

- A user toggling to dark mode sees a coherent cool palette — bg, cards, elevated surfaces all share the same temperature family, with the accent ramp staying in the slate-blue family across hover/pressed states.
- BioPortrait reads as the brand's "warm orange" in light and "earthy sage" in dark — same component, mode-aware gradient and initials text.
- Developers adding a new card-based surface in dark mode read `semantic.bg.card` and get the cool-slate value automatically. No per-component slate overrides needed.
- Developers using `semantic.accent.*` for buttons/badges/borders see the slate-blue values in dark mode; button hover/pressed states stay in the same hue family.

## 4. Visual brainstorm decisions

Decisions captured across the 10+ visual companion iterations:

| Decision | Pick | Notes |
|---|---|---|
| BioPortrait gradient direction | **Mode-aware** | Light = brand orange, Dark = sage. Required new `semantic.portrait` token. |
| Light portrait gradient | `#c46a2a → #e8a060` | Locked, unchanged from slice-33 derivation. |
| Light portrait initials | `#ffffff` white | Unchanged. |
| Dark portrait gradient | `#6b7a5d → #9caa8e` mid-sage | User explored orange family first, then shifted to gray-green; mid sage was the pick. |
| Dark portrait initials | `#fff0dc` warm cream | Earlier dark-text attempt (`#1a1410`) had better WCAG contrast; user accepted cream's lower contrast for aesthetic cohesion with CTA text. **Acknowledged AA-borderline tradeoff.** |
| Link `fg` | `#3b6ed1` / `#7a98e1` | Both stay as slice-33 anchor. |
| Dark `bg.app` | `#16181c` cool slate | Was `#1a1410` warm brown. |
| Dark `bg.card` | `#1e2126` | Cool slate +luminance. Cascade locked per user pick. |
| Dark `bg.elevated` | `#262a30` | Cool slate ++luminance. |
| Dark `bg.subtle` | `#1c1e2270` (cool slate + ~44% alpha, 4-byte hex) | Hover / table-stripe surface. Matches the rgba-hex format current dark `subtle` uses (`#22191344`). |
| Dark `border.default` | `#2a2d33` | Cool slate equivalent of current `#3a2e26`. |
| Dark `border.strong` | `#3a3e45` | Cool slate equivalent of current `#4a3e35`. |
| Dark `accent.500` (primary, CTA bg) | `#374f68` slate-blue (C1 hybrid) | Locked. |
| Dark accent ramp cascade | **Full slate-blue rebuild** | All 7 stops (100/200/400/500/600/700/900). |
| Dark CTA text on `accent.primary` | `#fff0dc` warm cream | Replaces previous `#1a1410` dark text. |

## 5. Architecture

### 5.1 New token surface

```ts
// packages/ui-tokens/src/brand/semantic.ts — NEW block

semantic.portrait: {
  gradient: { from: string, to: string }   // CSS gradient stops; mode-aware
  initials: string                          // initials text color; mode-aware
}
```

Light value: `{ gradient: { from: '#c46a2a', to: '#e8a060' }, initials: '#ffffff' }`
Dark value:  `{ gradient: { from: '#6b7a5d', to: '#9caa8e' }, initials: '#fff0dc' }`

Both values derived from a new `BRAND_PALETTE.{light,dark}.portrait` block so palette tests can assert raw hex values, and semantic resolution stays simple `p.portrait.gradient.from` etc.

### 5.2 Palette changes — dark mode only

```ts
BRAND_PALETTE.dark = {
  ink: { ... },                  // unchanged
  surface: {
    base:     '#16181c',         // ← was '#1a1410'
    card:     '#1e2126',         // ← was '#2a221c'
    elevated: '#262a30',         // ← was '#3a2e26'
    subtle:   '#1c1e2270',       // ← was '#22191344' (rgba equivalent over new app bg)
  },
  border: {
    default: '#2a2d33',          // ← was '#3a2e26'
    strong:  '#3a3e45',          // ← was '#4a3e35'
  },
  accent: {
    100: '#1a1f28',              // ← was '#2a1808'
    200: '#232a36',              // ← was '#5a3814'
    400: '#2e405a',              // ← was '#c46a2a' (was "light-mode primary moves here")
    500: '#374f68',              // ← was '#e8a060' (PRIMARY)
    600: '#485e76',              // ← was '#f0b380'
    700: '#6a7d96',              // ← was '#fbe1c8'
    900: '#ced8e4',              // ← was '#fff0dc'
  },
  alert: { ... },                // unchanged
  signal: { ... },               // unchanged
  link: { ... },                 // unchanged
  portrait: {                    // NEW BLOCK
    gradient: { from: '#6b7a5d', to: '#9caa8e' },
    initials: '#fff0dc',
  },
}
```

### 5.3 Palette changes — light mode (NEW portrait block only)

```ts
BRAND_PALETTE.light = {
  // ... all existing values unchanged ...
  portrait: {                    // NEW BLOCK
    gradient: { from: '#c46a2a', to: '#e8a060' },
    initials: '#ffffff',
  },
}
```

### 5.4 Semantic changes

```ts
BRAND_SEMANTIC.{light,dark}.portrait = {
  gradient: { from: p.portrait.gradient.from, to: p.portrait.gradient.to },
  initials: p.portrait.initials,
}
```

### 5.5 Component changes

**`packages/officials-ui/src/bio/BioPortrait.tsx`** — read `semantic.portrait.*` instead of `semantic.link.fg` + hardcoded `#5b8de1`.

Before:
```tsx
const portraitSolid = semantic.link.fg
const portraitGradient = `linear-gradient(135deg, ${semantic.link.fg} 0%, #5b8de1 100%)`
const initials_text_color = semantic.text.onAccent  // also drops
```

After:
```tsx
const { from, to } = semantic.portrait.gradient
const portraitSolid = from
const portraitGradient = `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
const initials_text_color = semantic.portrait.initials
```

That's the only component file modified. Every other consumer of `semantic.bg.*` / `semantic.accent.*` automatically picks up the new dark values through Context — no per-component changes.

## 6. Cross-platform considerations

Unchanged from slice 33's BioPortrait setup. The CSS `linear-gradient(...)` works on web through the `createElement('div', { style: { background: ... } })` pattern. Native gets the `portrait.gradient.from` solid color fallback. No `expo-linear-gradient` dep added.

## 7. Risks + accepted trade-offs

1. **Portrait initials contrast in dark mode.** `#fff0dc` cream on the sage gradient end (`#9caa8e`) gives ~2.5:1 luminance contrast — under WCAG AA's 4.5:1 for normal text. The initials are 2 characters at large size (~32px font, bold), which is closer to "large text" (3:1 minimum), so it passes AA-large but fails AA-normal. User reviewed darker alternatives and chose cream for aesthetic cohesion with CTA text. **Documented; future a11y audit may revisit.**
2. **Card temperature shift.** Existing dark mode screenshots (slices 33–37) become outdated. No automated visual regression in the workspace today, so this only matters for marketing/docs assets. No internal screenshots referenced from CLAUDE.md or specs.
3. **Accent ramp dark.700/dark.900.** Old warm values were used as "very pale orange-tan" surfaces — typically only inside accent.bg or as hover backgrounds. New cool-slate values are similarly pale but cool. Components that compose multiple accent stops (e.g. badge bg + accent.500 fg) need a quick visual check. Spot-checked: nothing currently uses `accent.700`/`accent.900` directly in dark — only via `semantic.accent.bg` which derives from `accent.100`, also rebuilt.
4. **`semantic.portrait` consumer count = 1.** Only BioPortrait reads the new token. Justified by the gradient being a single-component concern; making it semantic is still right because the values are brand-defined, not implementation-incidental.

## 8. Testing

### 8.1 Palette tests (`packages/ui-tokens/test/brand-palette.test.ts`)
- Add: assert each new dark surface value (`bg.app/card/elevated/subtle`, `border.default/strong`, all 7 `accent.*` stops, `portrait.gradient.from/to`, `portrait.initials`).
- Add: assert light `portrait.gradient.from/to` + `portrait.initials`.
- Modify: update the existing dark assertions that hard-pin the old warm values.

### 8.2 Semantic tests (`packages/ui-tokens/test/brand-semantic.test.ts`)
- Add: `BRAND_SEMANTIC.light.portrait` + `BRAND_SEMANTIC.dark.portrait` resolve to the palette values.
- Add: `BRAND_SEMANTIC.dark.accent.primary === '#374f68'`.
- Add: `BRAND_SEMANTIC.dark.bg.app === '#16181c'`.

### 8.3 BioPortrait tests (`packages/officials-ui/test/bio/BioPortrait.test.tsx`)
- Modify: existing assertions checking for `#3b6ed1` / `#5b8de1` gradient stops. Now assert mode-aware values from `semantic.portrait.gradient`.
- Add: dark mode test verifying sage gradient + cream initials text.
- Verify: native (Platform.OS === 'ios'/'android') solid color uses `gradient.from`.

### 8.4 Out of scope
- Visual regression / dark mode screenshots — none in workspace today.
- Mobile DoD smoke — deferred per slice-5+ pattern; checklist updated.
- AA contrast assertion test for portrait initials — known sub-AA on the bright gradient corner; documented.

## 9. Implementation surface

**New token blocks (2):**
- `BRAND_PALETTE.light.portrait`
- `BRAND_PALETTE.dark.portrait`

**Modified token values (dark mode only):**
- `BRAND_PALETTE.dark.surface.{base,card,elevated,subtle}` — 4 values
- `BRAND_PALETTE.dark.border.{default,strong}` — 2 values
- `BRAND_PALETTE.dark.accent.{100,200,400,500,600,700,900}` — 7 values
- `BRAND_SEMANTIC.{light,dark}.portrait` — derived

**New files (0):** all token changes happen in existing files.

**Edited files (10):**
- `packages/ui-tokens/src/brand/palette.ts`
- `packages/ui-tokens/src/brand/semantic.ts`
- `packages/ui-tokens/test/brand-palette.test.ts`
- `packages/ui-tokens/test/brand-semantic.test.ts`
- `packages/officials-ui/src/bio/BioPortrait.tsx`
- `packages/officials-ui/test/bio/BioPortrait.test.tsx`
- `docs/brand-book.md` (palette/semantic surface tables refresh)
- `docs/brand-migration.md` (new `semantic.portrait` vocabulary)
- `CLAUDE.md` (slice 40 entry)
- `docs/superpowers/mobile-dod-checklist.md` (slice 40 smoke section)

**Total: 10 files. Compressed-to-Mega-Slice tier per `feedback_workflow_tiers.md`.**

## 10. Closeout criteria

- All updated ui-tokens tests pass.
- All BioPortrait tests pass.
- `pnpm -r typecheck` green.
- `pnpm --filter @chiaro/web build` green.
- Manual web smoke: toggle dark mode on `/sign-in` (auth surface), `/settings` (slice 39 surface). Verify cool slate page bg, sage portrait, slate-blue CTA, cream CTA text. Light mode unchanged.
- Mobile DoD: deferred (existing pattern).
- CLAUDE.md slice 40 entry written.
- Memory: slice 40 entry written + slice 38+ reskin roadmap updated to mark #1 + #3 closed.

## 11. What this slice unblocks

- Roadmap decisions #1 (link blue — locked as anchor) and #3 (BioPortrait gradient — rebased to mode-aware) formally closed.
- Future reskin work has a precedent for **mode-aware semantic tokens** (`semantic.portrait` is the template).
- Cool slate dark palette becomes the baseline for slice 41+ visual decisions (AlignmentChip tiers, industry rainbow, finance green, MetricCardShell retune) — those will get evaluated against the new cool theme, not the legacy warm brown.
