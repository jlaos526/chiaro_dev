# Slice 33 — Auth Brand Retrofit + Logo Component + Dark Mode Wiring

> **Type:** Foundation + first retrofit
> **Scope:** Apply the slice-32 brand system to slice-31's auth surface. Ship the `<Logo />` component, the `useBrandTokens()` hook, and the brand-migration reference doc. Auth becomes the first dark-mode-ready surface. Rest of the app stays light, unchanged.
> **Tier:** Mega Slice (~20-23 files).

---

## 1. Goal

Two intertwined goals:

1. **Apply the slice-32 brand to a real surface.** Slice 31 just shipped the auth screens but adopted the legacy `COLORS.brand.primary` (#5b6cff blue-purple). Slice 32 then locked the new brand (deep orange #c46a2a + cream + Inter + 2-square logo). Slice 33 reconciles them: auth becomes the first consumer of `BRAND.*` tokens, with the actual brand mark replacing the placeholder dot.

2. **Lay the retrofit foundation.** Slices 34-37 will migrate the rest of `@chiaro/officials-ui` (federal cards, state cards, shared components, domain palettes) to `BRAND.*`. Slice 33 ships the `useBrandTokens()` hook + `docs/brand-migration.md` mapping doc that those sub-slices reuse. Auth is the de-risk surface: if the migration pattern survives `AuthInput.tsx`'s CSS-in-JS templates, it survives anything else.

## 2. In scope / out of scope

**In scope:**
- `<Logo />` React component in `@chiaro/officials-ui` (mark-only + lockup variants)
- `useBrandTokens()` hook with Context-backed override plumbing (Provider deferred)
- `docs/brand-migration.md` reference doc
- Migration of 6 `auth/*.tsx` components from `COLORS.*` to `BRAND.semantic.*`
- `AuthWordmark` refactor to use `<Logo />`
- Dark mode wiring on the auth route only (`useColorScheme()` per component)
- Optional first-paint flash mitigation script (web)
- Test updates for components that asserted on old hex values

**Out of scope:**
- Sub-slices 34-37 (foundation/federal/state/domain-palette retrofit) — separate slices
- Full visual re-skin (slice 38+): aggressive accent use, AlignmentChip color rebase, gradient retuning — deferred to a later track once the mode-flip retrofit is complete
- Dark mode toggle UI (settings control to override system preference)
- `BrandThemeProvider` runtime component — Context plumbing ships, but no Provider component lands until slice 38 or the toggle slice
- CSS variable emission — slice 32 §10.5 still applies; per-component hook reads stay the canonical pattern
- Favicon ICO / PWA icon asset pipeline
- Marketing surfaces (landing page etc.)
- Component visual changes beyond colors/mode (no layout, copy, IA)

## 3. The retrofit longer plan (for context only — not built in slice 33)

Slice 33 is one of an explicit sequence. The downstream slices are not designed in detail here; they get their own specs.

| Slice | Scope | Approx files | Tier |
|---|---|---|---|
| **33 (this)** | Auth retrofit + Logo + `useBrandTokens()` + migration doc | ~20-23 | Mega |
| **34** | Shared foundation retrofit: `BioHeader`, `OfficialsCard`, `OfficialsList`, `AlignmentChip`, `ComingSoonCard`, `CardSubsection`, `BioContactLinks`, `BioAlignmentChipRow`, `TopAmountBreakdown`, `MetricCardShell` | ~10 + tests | Mega |
| **35** | Federal cards (5 cards + 11 sub-lists) | ~16 + tests | Mega |
| **36** | State cards (6 cards + ~15 sub-lists) | ~21 + tests | Mega |
| **37** | Domain palettes (`PARTY_COLOR`, `CATEGORY_ACCENT`, `ALIGNMENT_CHIP_COLORS`, `INDUSTRY_COLOR`, `SCORECARD_LEAN_COLOR`) gain dark variants; `MAP_COLORS` dark variant; AlignmentChip philosophy decision | ~15 + tests | Mega |
| **38+** | **Full visual re-skin** — aggressive deep-orange accent use replacing teal across the app, gradient retuning, AlignmentChip color rebase if 37 decided to, MetricCardShell refresh, marketing surfaces, settings toggle UI for forced light/dark. Multi-slice. | TBD | Mega ×N |

Slice 33 sets the vocabulary every following slice inherits. Lock the `useBrandTokens()` API + the migration map now; slices 34-37 should be near-mechanical follow-throughs.

## 4. Architecture decisions

### 4.1 `useBrandTokens()` hook — Context-backed, Provider deferred

The hook is the canonical entry point. Every retrofit slice uses it; consumers never call `getSemantic()` directly.

```ts
// packages/officials-ui/src/brand-hooks.ts

import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import {
  BRAND_PALETTE,
  getSemantic,
  type BrandMode,
  type BrandPalette,
  type BrandSemantic,
} from '@chiaro/ui-tokens'

/**
 * Override Context. Slice 33 does NOT ship a Provider — the value is always
 * null. The plumbing exists so slice 38 (or any future override slice) can
 * add a Provider component without changing the hook signature or any
 * consumer.
 */
export const BrandModeOverrideContext = createContext<BrandMode | null>(null)

export interface BrandTokens {
  mode: BrandMode
  semantic: BrandSemantic
  palette: BrandPalette['light']  // same shape as light; values vary per mode
}

export function useBrandTokens(): BrandTokens {
  const override = useContext(BrandModeOverrideContext)
  const system = useColorScheme()
  const mode: BrandMode = override ?? (system === 'dark' ? 'dark' : 'light')
  return {
    mode,
    semantic: getSemantic(mode),
    palette: BRAND_PALETTE[mode],
  }
}
```

**Locked decisions:**
- **Return shape:** exactly `{ mode, semantic, palette }`. Three fields. Adding fields later is additive; renaming would touch every consumer.
- **Mode source:** override Context first (null in slice 33), then `useColorScheme()`, then default `'light'`.
- **Re-render granularity:** per consuming component on mode change. Acceptable for the auth route (5-10 components). Perf is theoretical until measured; if slice 34+ shows flicker, add CSS variables underneath the hook without changing the consumer API.

**Test ergonomics:** the Context override is the testing hook too. Tests wrap with a small ad-hoc Provider:
```tsx
<BrandModeOverrideContext.Provider value="dark">
  <ComponentUnderTest />
</BrandModeOverrideContext.Provider>
```
No need to mock `useColorScheme()`.

### 4.2 `<Logo />` component — first consumer of slice 32 geometry helpers

```ts
// packages/officials-ui/src/Logo.tsx

import { logoGeometry, LOGO_FILLS } from '@chiaro/ui-tokens'

export interface LogoProps {
  /** Square side S, in px. Defaults to 32 (Medium variant). */
  size?: number
  /** 'mark' (default): just the 2-square cascade + brackets.
   *  'lockup': mark + wordmark text. */
  variant?: 'mark' | 'lockup'
  /** Optional tagline below wordmark (lockup variant only). */
  tagline?: string
  /** Accessibility label. Defaults to "Chiaro" for mark, "Chiaro logo" for lockup. */
  accessibilityLabel?: string
}
```

**Cross-platform rendering:**
- **Web (RNW):** uses `createElement` escape hatch (Gotcha #19f) to render the gradient-filled squares via raw `<div>` wrappers around the View. Brackets render as 4 `<div>` borders.
- **Native (RN):** alpha gradients aren't supported in core RN. Render the squares as solid `accent.500` (back) + `accent.400` (front) at the same opacity that the gradient midpoint produces. Documented as a deliberate degradation — the brand book §9.6 already says "alpha gradients self-correct on dark mode" but on native they just look like solid orange. Future polish slice can adopt `expo-linear-gradient` if needed.
- **Below S=12:** fall back to a single solid-fill square (no overlap, no brackets) per brand book §9.2.

**Wordmark in lockup variant:**
- Renders `CHIARO` text via `<Text>` with weight 700, color `text.primary`, tracking per brand-book §9.3.
- Tagline (if provided) renders below wordmark at `wordmark × 0.45`, weight 400, color `text.muted`, tracking 0.02em.

**Mode awareness:** `<Logo />` reads `useBrandTokens()`. In dark mode, the wordmark text and tagline switch automatically. The mark colors stay orange-family (the alpha gradients self-correct against the darker surface).

### 4.3 `AuthWordmark` refactor

`<AuthWordmark size="sm" />` becomes `<Logo size={20} variant="lockup" />`. `<AuthWordmark size="md" />` becomes `<Logo size={32} variant="lockup" />`. The component is kept as a thin wrapper for back-compat with slice 31's existing imports, but its implementation is one line of JSX.

### 4.4 Dark mode wiring — per-component `useBrandTokens()`, no app-wide toggle

Each of the 6 auth components reads `useBrandTokens()` and uses `semantic.*` for colors. Mode changes when:
- System preference changes (auto, via RNW polyfill of `prefers-color-scheme`)
- The override Context value changes (slice 33 ships null; future-proof only)

The app's non-auth routes are untouched — they still consume legacy `COLORS.*` and render light-only. There's no global dark mode in this slice.

### 4.5 First-paint flash mitigation (web, optional)

Web SSR can't read `prefers-color-scheme` server-side. Without mitigation, the first paint is always light, then flips to dark on hydration if the user's system preference is dark. Mitigation: a tiny inline script in the web auth route's layout that runs before hydration, reading `window.matchMedia('(prefers-color-scheme: dark)').matches` and setting `document.documentElement.dataset.theme = 'dark'` if true. The hook then reads from `document.documentElement.dataset.theme` first on web (if present), then falls back to `useColorScheme()`.

**Risk:** introducing a render-blocking script for one route. Mitigation: keep it ~10 lines, inline, no external fetch. **Defer-out:** if the script feels risky during implementation, ship without it — flash on first paint for dark users is acceptable in v1.

### 4.6 Migration map — `docs/brand-migration.md`

A canonical mapping table for the entire `COLORS.*` surface → `BRAND.semantic.*` equivalents. Pinned vocabulary so slices 34-37 don't re-decide. Format:

```markdown
# Brand Migration Reference

> Canonical `COLORS.* → BRAND.semantic.*` migration map.
> Source of truth for slices 33-37.

## Brand colors

| Legacy | New | Notes |
|---|---|---|
| `COLORS.brand.primary` | `BRAND.semantic[mode].accent.primary` | Mode-aware. Light: #c46a2a; Dark: #e8a060. |
| `COLORS.brand.accent` | `BRAND.semantic[mode].accent.secondary` | Was teal (#1f9b88); now light orange (#e8a060 / #c46a2a). |
| `COLORS.brand.text` | `BRAND.semantic[mode].text.primary` | Hex unchanged in light (#1a1714); dark inverts to cream. |

## Neutral / surface

| Legacy | New | Notes |
|---|---|---|
| `COLORS.neutral.background` | `BRAND.semantic[mode].bg.elevated` | Unchanged in light (#ffffff); dark = #3a2e26. |
| `COLORS.neutral.surface` | `BRAND.semantic[mode].bg.app` | Slight warmth shift: #f7f6f4 → #efece5 (cream). |
| `COLORS.neutral.surfaceAlt` | `BRAND.semantic[mode].bg.subtle` | Was #f3f4f6 cool; now #f7efe2 warm. |
| `COLORS.neutral.border` | `BRAND.semantic[mode].border.default` | Was #e6e3df cool; now #e8d8c2 warm. |
| `COLORS.neutral.mute` | `BRAND.semantic[mode].text.muted` | Was #807a72; now #6b5e52. |
| `COLORS.neutral.textMuted` | `BRAND.semantic[mode].text.muted` | Same target as `.mute`. |
| `COLORS.neutral.outline` | `BRAND.semantic[mode].border.strong` | Was #888 mid-gray; now #d6c3a8 warm. |

## Signal

| Legacy | New | Notes |
|---|---|---|
| `COLORS.signal.error` | `BRAND.semantic[mode].alert.danger.fg` | Was #c5364a; now #a83a3a (light) / #d05050 (dark). |
| `COLORS.signal.warning` | _no direct equivalent yet_ | Slice 37 may introduce `alert.warning`. For slice 33, keep `COLORS.signal.warning` references unchanged. |
| `COLORS.signal.success` | _no direct equivalent yet_ | Same as warning — defer. |

## Maps

| Legacy | New | Notes |
|---|---|---|
| `MAP_COLORS.districtStroke` | _kept as `MAP_COLORS`_ | Map components are deferred to slice 37; for slices 33-36, `MAP_COLORS` is unchanged. |
| `MAP_COLORS.districtFill` | _kept as `MAP_COLORS`_ | Same. |

## Domain palettes (PARTY_COLOR, CATEGORY_ACCENT, etc.)

These remain as separate exports in slices 33-36. Dark variants land in slice 37. Slices 33-36 use the existing light-only domain palettes.
```

This file is the migration vocabulary. Every retrofit slice imports it for grep.

## 5. Token migration map (applied in slice 33)

The 6 auth files use these specific `COLORS` references (from the audit grep). Each gets one canonical mapping:

| File | `COLORS` reference | `BRAND.semantic[mode]` target |
|---|---|---|
| `AuthWordmark.tsx` | `brand.primary` (dot bg) | `accent.primary` (replaced by `<Logo />` — dot deleted) |
| `AuthWordmark.tsx` | `brand.text` (wordmark color) | `text.primary` (now inside `<Logo />`) |
| `AuthScreen.tsx` | `neutral.surface` (page bg) | `bg.app` |
| `AuthScreen.tsx` | `neutral.background` (card bg) | `bg.elevated` |
| `AuthCrossLink.tsx` | `neutral.textMuted` (label) | `text.muted` |
| `AuthCrossLink.tsx` | `brand.primary` (action link) | `accent.primary` |
| `AuthInput.tsx` | `neutral.border` (default border) | `border.default` |
| `AuthInput.tsx` | `brand.text` (input text) | `text.primary` |
| `AuthInput.tsx` | `brand.primary` (focus border, focused label) | `accent.primary` |
| `AuthInput.tsx` | `signal.error` (error states) | `alert.danger.fg` |
| `AuthInput.tsx` | `neutral.textMuted` (placeholder, label resting) | `text.muted` |
| `AuthInput.tsx` | `neutral.background` (label backdrop) | `bg.elevated` |
| `AuthForm.tsx` | `brand.text` (heading) | `text.primary` |
| `AuthForm.tsx` | `neutral.textMuted` (subhead) | `text.muted` |
| `AuthForm.tsx` | `signal.error` (form error) | `alert.danger.fg` |
| `AuthForm.tsx` | `brand.primary` (submit button bg) | `accent.primary` |
| `AuthPageChrome.tsx` | _to be verified during impl_ | per the migration map above |

## 6. Files

```
packages/officials-ui/src/
├── Logo.tsx                          NEW
├── brand-hooks.ts                    NEW (useBrandTokens + Context)
├── index.ts                          MODIFY (export Logo, useBrandTokens, BrandModeOverrideContext, type BrandTokens)
├── auth/
│   ├── AuthWordmark.tsx              MODIFY (wraps <Logo />)
│   ├── AuthScreen.tsx                MODIFY (semantic tokens + mode)
│   ├── AuthCrossLink.tsx             MODIFY (semantic tokens + mode)
│   ├── AuthInput.tsx                 MODIFY (CSS template rebuilds per mode)
│   ├── AuthForm.tsx                  MODIFY (semantic tokens + mode)
│   └── AuthPageChrome.tsx            MODIFY (semantic tokens + mode)
└── test/
    ├── Logo.test.tsx                 NEW
    ├── brand-hooks.test.tsx          NEW
    └── auth/*.test.tsx               UPDATE (assertions referencing old hex values; ~5-6 files)

apps/web/app/
├── sign-in/page.tsx                  MAYBE (only if AuthScreen API changes)
├── sign-up/page.tsx                  MAYBE
└── (auth)/layout.tsx                 NEW IF mitigation script is shipped

apps/mobile/app/(auth)/
├── sign-in.tsx                       MAYBE
├── sign-up.tsx                       MAYBE
└── _layout.tsx                       MAYBE

docs/brand-migration.md               NEW
CLAUDE.md                             MODIFY (slice 33 entry)
```

Approximate total: **~20-23 files**.

## 7. Testing

### 7.1 `useBrandTokens()` hook

- Returns `{ mode: 'light', semantic, palette }` when no override + system is light
- Returns `{ mode: 'dark', ... }` when no override + system is dark
- Returns override value when `BrandModeOverrideContext` is set
- `semantic.text.primary` equals `BRAND.palette[mode].ink[1000]` for both modes
- `palette` is referentially equal to `BRAND_PALETTE[mode]`

### 7.2 `<Logo />` component

- Renders at S=32 (default) with documented `boundingWidth`/`boundingHeight` via the test renderer's measure
- `variant="mark"` renders no wordmark text
- `variant="lockup"` renders the `CHIARO` text via `<Text>` with weight 700
- `tagline` prop renders below wordmark when lockup variant
- Below `size={12}` renders only a single solid square (no overlap, no brackets)
- Mode flip via override Context swaps wordmark color from #1a1714 to #fdf8f3
- `accessibilityLabel` defaults are correct ("Chiaro" for mark, "Chiaro logo" for lockup)

### 7.3 Auth components

- Each existing auth test (`AuthScreen.test.tsx`, `AuthInput.test.tsx`, etc.) updated to assert against `BRAND.semantic.light.*` instead of `COLORS.*` hex literals
- Add one new test per component asserting dark mode renders different surface/text colors when wrapped with `BrandModeOverrideContext.Provider value="dark"`

### 7.4 Workspace gates

- `pnpm --filter @chiaro/officials-ui test` — all green
- `pnpm -r typecheck` — 11 packages green (back-compat invariant preserved)
- `pnpm --filter @chiaro/web build` — Next 15 build clean
- Manual smoke: sign-in + sign-up pages on web in both system modes (set OS to dark, refresh); same on mobile via simulator

## 8. Acceptance criteria

- `<Logo />` component shipped, tested, exported from `@chiaro/officials-ui`
- `useBrandTokens()` hook shipped with Context-backed override plumbing (no Provider component yet)
- `docs/brand-migration.md` exists and covers every `COLORS.*` key
- 6 auth components migrated; AuthWordmark uses `<Logo />`
- Auth screens render correctly in both light and dark system modes (manual smoke verified)
- `pnpm -r typecheck` green; `pnpm test` green
- No live UI files outside `packages/officials-ui/src/auth/`, `packages/officials-ui/src/Logo.tsx`, `packages/officials-ui/src/brand-hooks.ts`, the web/mobile auth route shells, and `docs/`/`CLAUDE.md` are modified
- `apps/web/build` passes — Next 15 build clean
- CLAUDE.md slice 33 entry added

## 9. Risks & open questions

**Risk:** RN doesn't support alpha gradients in core; the logo on native renders with solid orange instead of the cream-to-orange fade. Mitigation: documented degradation in spec §4.2; future polish slice can adopt `expo-linear-gradient`. Decision locked: ship with solid fallback in slice 33 (no new native deps).

**Risk:** `useColorScheme()` returns null on SSR. First-paint flash on web for dark-mode users. Mitigation: §4.5 optional script. If the script is risky during implementation, defer; flash on first paint is acceptable in v1.

**Risk:** CSS-in-JS template rebuild in `AuthInput.tsx` happens every render. With mode changes, this is fine; with input-focus-driven re-renders, the template string is recomputed needlessly. Mitigation: `useMemo` over `(mode, focused, error)` triple. Standard React perf hygiene.

**Risk:** AuthWordmark `size="sm"` mapped to `<Logo size={20} />` — at S=20 the bracket arms are 4px and stroke clamps to 0.94px. Visual verification needed during impl that brackets stay readable. Fallback: bump sm to size=24 if brackets get muddy.

**Risk:** Slice 31's `apps/web/app/sign-in/page.tsx` (etc.) imports `AuthScreen` + `AuthPageChrome` and probably doesn't need changes. But it uses Next 15 RSC by default; the new hook is client-only (`'use client'`). All auth components are already `'use client'` (slice 31 set this), so this is a non-issue. Verify during implementation.

**Locked at design:** Logo component API (`size` + `variant` + `tagline` + `accessibilityLabel`). useBrandTokens return shape (`mode` + `semantic` + `palette`). Override Context name (`BrandModeOverrideContext`). Migration vocabulary in `docs/brand-migration.md`.

## 10. After slice 33 — explicit roadmap

The user has committed to the longer plan in conversation:

1. **Slices 34-37:** mode-flip + dark mode retrofit across shared/federal/state/domain-palette components. Each is a Mega Slice that uses `useBrandTokens()` + the migration map.
2. **Slices 38+:** full visual re-skin. Aggressive deep-orange accent use across the app, gradient retuning, AlignmentChip color rebase (if slice 37 decided to), MetricCardShell refresh, marketing surfaces, dark mode toggle UI. Multi-slice. Tangles brand work with IA decisions intentionally.

This roadmap is recorded for future-spec authors so slices 34-37 stay tight (mechanical retrofit) and visual decisions get deferred to the dedicated reskin slices.

---

*See `docs/brand-book.md` (slice 32) for the brand reference. See `docs/superpowers/specs/2026-05-26-brand-design-design.md` for the brand-system spec.*
