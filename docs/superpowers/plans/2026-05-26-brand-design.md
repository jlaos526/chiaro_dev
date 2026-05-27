# Brand Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the new Chiaro brand design system as a `BRAND` token export in `@chiaro/ui-tokens` plus a `docs/brand-book.md` reference, all additive — no existing components touched.

**Architecture:** Additive split inside `packages/ui-tokens/src/`. New work lives under `src/brand/` and exports one root `BRAND` object. Legacy `COLORS` / `MAP_COLORS` exports stay byte-identical for back-compat (all 50+ slice-1-through-31 consumers continue to compile). Tests use vitest in the existing `test/` directory following the patterns in `test/alignment.test.ts`.

**Tech Stack:** TypeScript 5.4 strict mode, vitest 2, `.ts`-extension relative imports, vanilla `as const` data tables, no runtime deps.

**Spec:** `docs/superpowers/specs/2026-05-26-brand-design-design.md`

**Branch:** `brand-design` (already created)

---

## File structure

```
packages/ui-tokens/src/
├── index.ts                       # MODIFY — add BRAND re-export
├── colors.ts                      # MODIFY — extract MAP_COLORS out, add @deprecated JSDoc
├── map-colors.ts                  # NEW — MAP_COLORS moves here
├── brand/
│   ├── index.ts                   # NEW — assembles BRAND, exports getSemantic + logoGeometry
│   ├── palette.ts                 # NEW — light + dark palette tables
│   ├── semantic.ts                # NEW — semantic token tables (light + dark)
│   ├── typography.ts              # NEW — type scale + weights
│   ├── spacing.ts                 # NEW — 4px scale
│   ├── radii.ts                   # NEW — sharp scale
│   ├── shadow.ts                  # NEW — 3-step warm-tinted
│   └── logo.ts                    # NEW — geometry helpers + gradient fills

packages/ui-tokens/test/
└── brand.test.ts                  # NEW — palette parity, scale ordering, logoGeometry math, gradient string exact

docs/
└── brand-book.md                  # NEW — brand book reference
```

**No other files are touched.** Slice-1-through-31 components are not modified.

---

## Task 1: Extract MAP_COLORS + mark COLORS deprecated (back-compat split)

**Files:**
- Create: `packages/ui-tokens/src/map-colors.ts`
- Modify: `packages/ui-tokens/src/colors.ts`
- Modify: `packages/ui-tokens/src/index.ts`

This task is preparatory — it makes room for the new `brand/` namespace without changing the public surface for legacy consumers.

- [ ] **Step 1: Read current state**

```bash
cat packages/ui-tokens/src/colors.ts
cat packages/ui-tokens/src/index.ts
```

Expected: colors.ts contains both COLORS and MAP_COLORS exports.

- [ ] **Step 2: Create the new `map-colors.ts` file**

Create `packages/ui-tokens/src/map-colors.ts`:

```ts
// Domain-specific palette for the map components (web Leaflet + RN react-native-maps).
// Extracted from colors.ts (brand-design slice). Legacy export — kept stable for back-compat.

export const MAP_COLORS = {
  districtStroke: '#1a1714',   // matches brand.text
  districtFill:   '#f5f0e8',   // warm paper-tone fill
} as const

export type MapColor = typeof MAP_COLORS
```

- [ ] **Step 3: Update `colors.ts` — remove MAP_COLORS, add `@deprecated`**

Replace `packages/ui-tokens/src/colors.ts` with:

```ts
// Brand colors lifted from existing inline hex values in slice 1/2 components.
// Migrating call sites is slice 3.5 cleanup; the constants live here.
//
// @deprecated These tokens are the slice-1-through-31 legacy surface. New work
// should import from `@chiaro/ui-tokens` BRAND.* (see docs/brand-book.md and
// docs/superpowers/specs/2026-05-26-brand-design-design.md). Legacy COLORS are
// kept byte-identical for back-compat; do not modify values here without
// migrating every consumer first.

export const COLORS = {
  brand: {
    primary: '#5b6cff',
    accent: '#1f9b88',
    text: '#1a1714',
  },
  neutral: {
    background: '#ffffff',
    surface: '#f7f6f4',
    surfaceAlt: '#f3f4f6',
    border: '#e6e3df',
    mute: '#807a72',
    textMuted: '#666',
    outline: '#888',
  },
  signal: {
    error: '#c5364a',
    warning: '#d68a1f',
    success: '#1f9b88',
  },
} as const

export type BrandColor = typeof COLORS
```

- [ ] **Step 4: Update `src/index.ts` — re-export MAP_COLORS from new location**

Edit `packages/ui-tokens/src/index.ts` line 1:

Old:
```ts
export { COLORS, MAP_COLORS, type BrandColor, type MapColor } from './colors.ts'
```

New:
```ts
export { COLORS, type BrandColor } from './colors.ts'
export { MAP_COLORS, type MapColor } from './map-colors.ts'
```

All other lines in `src/index.ts` stay unchanged.

- [ ] **Step 5: Write the back-compat assertion test**

Create `packages/ui-tokens/test/back-compat.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { COLORS, MAP_COLORS, type BrandColor, type MapColor } from '../src/index.ts'

describe('legacy COLORS surface (back-compat)', () => {
  it('exports COLORS.brand with unchanged hex values', () => {
    expect(COLORS.brand.primary).toBe('#5b6cff')
    expect(COLORS.brand.accent).toBe('#1f9b88')
    expect(COLORS.brand.text).toBe('#1a1714')
  })

  it('exports COLORS.neutral with unchanged hex values', () => {
    expect(COLORS.neutral.background).toBe('#ffffff')
    expect(COLORS.neutral.surface).toBe('#f7f6f4')
    expect(COLORS.neutral.surfaceAlt).toBe('#f3f4f6')
    expect(COLORS.neutral.border).toBe('#e6e3df')
    expect(COLORS.neutral.mute).toBe('#807a72')
    expect(COLORS.neutral.textMuted).toBe('#666')
    expect(COLORS.neutral.outline).toBe('#888')
  })

  it('exports COLORS.signal with unchanged hex values', () => {
    expect(COLORS.signal.error).toBe('#c5364a')
    expect(COLORS.signal.warning).toBe('#d68a1f')
    expect(COLORS.signal.success).toBe('#1f9b88')
  })
})

describe('MAP_COLORS surface (back-compat)', () => {
  it('exports MAP_COLORS from the package root', () => {
    expect(MAP_COLORS.districtStroke).toBe('#1a1714')
    expect(MAP_COLORS.districtFill).toBe('#f5f0e8')
  })
})

describe('legacy types still resolve', () => {
  it('BrandColor + MapColor type aliases compile', () => {
    const _b: BrandColor = COLORS
    const _m: MapColor = MAP_COLORS
    expect(_b).toBe(COLORS)
    expect(_m).toBe(MAP_COLORS)
  })
})
```

- [ ] **Step 6: Run tests and typecheck**

```bash
pnpm --filter @chiaro/ui-tokens test
pnpm --filter @chiaro/ui-tokens typecheck
```

Expected: all tests pass; typecheck clean.

- [ ] **Step 7: Run full workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: all 10 packages green. This proves the back-compat split did not break any consumer.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-tokens/src/map-colors.ts \
        packages/ui-tokens/src/colors.ts \
        packages/ui-tokens/src/index.ts \
        packages/ui-tokens/test/back-compat.test.ts
git commit -m "$(cat <<'EOF'
refactor(ui-tokens): extract MAP_COLORS + mark COLORS @deprecated

Preparatory split for the brand-design slice. Public surface unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Brand palette — light + dark color tables

**Files:**
- Create: `packages/ui-tokens/src/brand/palette.ts`
- Create: `packages/ui-tokens/test/brand-palette.test.ts`

- [ ] **Step 1: Write the failing palette test**

Create `packages/ui-tokens/test/brand-palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BRAND_PALETTE } from '../src/brand/palette.ts'

describe('BRAND_PALETTE.light', () => {
  it('exports the ink scale', () => {
    expect(BRAND_PALETTE.light.ink[1000]).toBe('#1a1714')
    expect(BRAND_PALETTE.light.ink[700]).toBe('#3a322c')
    expect(BRAND_PALETTE.light.ink[500]).toBe('#6b5e52')
    expect(BRAND_PALETTE.light.ink[300]).toBe('#8a7a6a')
    expect(BRAND_PALETTE.light.ink[100]).toBe('#c8b9a8')
  })

  it('exports the surface scale', () => {
    expect(BRAND_PALETTE.light.surface.base).toBe('#efece5')
    expect(BRAND_PALETTE.light.surface.card).toBe('#fdf8f3')
    expect(BRAND_PALETTE.light.surface.elevated).toBe('#ffffff')
    expect(BRAND_PALETTE.light.surface.subtle).toBe('#f7efe2')
  })

  it('exports border tokens', () => {
    expect(BRAND_PALETTE.light.border.default).toBe('#e8d8c2')
    expect(BRAND_PALETTE.light.border.strong).toBe('#d6c3a8')
  })

  it('exports the deep-orange accent scale with primary at 500', () => {
    expect(BRAND_PALETTE.light.accent[500]).toBe('#c46a2a')
    expect(BRAND_PALETTE.light.accent[400]).toBe('#e8a060')
    expect(BRAND_PALETTE.light.accent[100]).toBe('#fdf2e8')
  })

  it('exports the decisive-red alert scale with alert at 500', () => {
    expect(BRAND_PALETTE.light.alert[500]).toBe('#a83a3a')
    expect(BRAND_PALETTE.light.alert[100]).toBe('#fdf2f0')
  })
})

describe('BRAND_PALETTE.dark', () => {
  it('inverts ink (cream becomes primary text)', () => {
    expect(BRAND_PALETTE.dark.ink[1000]).toBe('#fdf8f3')
    expect(BRAND_PALETTE.dark.ink[100]).toBe('#3a322c')
  })

  it('uses deep-warm surface (no neutral grays)', () => {
    expect(BRAND_PALETTE.dark.surface.base).toBe('#1a1410')
    expect(BRAND_PALETTE.dark.surface.card).toBe('#2a221c')
    expect(BRAND_PALETTE.dark.surface.elevated).toBe('#3a2e26')
  })

  it('saturates accent up (light orange becomes primary on dark)', () => {
    expect(BRAND_PALETTE.dark.accent[500]).toBe('#e8a060')
    expect(BRAND_PALETTE.dark.accent[400]).toBe('#c46a2a')
  })
})

describe('palette mode parity', () => {
  it('light and dark have identical top-level key shapes', () => {
    expect(Object.keys(BRAND_PALETTE.light).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark).sort())
  })

  it('light and dark have identical ink scale keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.ink).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.ink).sort())
  })

  it('light and dark have identical accent scale keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.accent).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.accent).sort())
  })

  it('light and dark have identical alert scale keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.alert).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.alert).sort())
  })

  it('light and dark have identical surface keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.surface).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.surface).sort())
  })

  it('light and dark have identical border keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.border).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.border).sort())
  })
})

describe('no accidental duplicate hex within a single role group', () => {
  it('light ink stops are all distinct', () => {
    const values = Object.values(BRAND_PALETTE.light.ink)
    expect(new Set(values).size).toBe(values.length)
  })

  it('light accent stops are all distinct', () => {
    const values = Object.values(BRAND_PALETTE.light.accent)
    expect(new Set(values).size).toBe(values.length)
  })

  it('dark accent stops are all distinct', () => {
    const values = Object.values(BRAND_PALETTE.dark.accent)
    expect(new Set(values).size).toBe(values.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/ui-tokens test brand-palette
```

Expected: FAIL — module `../src/brand/palette.ts` does not exist.

- [ ] **Step 3: Create the palette implementation**

Create `packages/ui-tokens/src/brand/palette.ts`:

```ts
// Brand palette — light + dark color tables.
// Source of truth: docs/brand-book.md §3 and docs/superpowers/specs/2026-05-26-brand-design-design.md §4.

export const BRAND_PALETTE = {
  light: {
    ink: {
      1000: '#1a1714',   // primary text, wordmark, headings
       700: '#3a322c',   // body text
       500: '#6b5e52',   // muted text, captions
       300: '#8a7a6a',   // disabled text, helper text
       100: '#c8b9a8',   // divider, subtle border
    },
    surface: {
      base:     '#efece5',   // app background (cooler than card)
      card:     '#fdf8f3',   // card / panel background
      elevated: '#ffffff',   // modal, popover
      subtle:   '#f7efe2',   // sub-card, hover, table stripe
    },
    border: {
      default: '#e8d8c2',
      strong:  '#d6c3a8',
    },
    accent: {
      100: '#fdf2e8',
      200: '#f7d9b8',
      400: '#e8a060',
      500: '#c46a2a',   // PRIMARY ACCENT — logo border, focus ring, primary CTA
      600: '#a35621',
      700: '#82441a',
      900: '#4a2810',
    },
    alert: {
      100: '#fdf2f0',
      300: '#f5b8b0',
      500: '#a83a3a',   // ALERT — error text, destructive CTA
      700: '#6e2222',
    },
  },
  dark: {
    ink: {
      1000: '#fdf8f3',   // primary text (cream)
       700: '#e8d8c2',   // body text
       500: '#8a7a6a',   // muted text
       300: '#6b5e52',   // disabled text
       100: '#3a322c',   // divider
    },
    surface: {
      base:     '#1a1410',   // app background
      card:     '#2a221c',   // card / panel
      elevated: '#3a2e26',   // modal, popover
      subtle:   '#22191344', // sub-card / hover (rgba over base)
    },
    border: {
      default: '#3a2e26',
      strong:  '#4a3e35',
    },
    accent: {
      100: '#2a1808',
      200: '#5a3814',
      400: '#c46a2a',   // hover (light-mode primary moves here)
      500: '#e8a060',   // PRIMARY ACCENT in dark
      600: '#f0b380',
      700: '#fbe1c8',
      900: '#fff0dc',
    },
    alert: {
      100: '#2a1414',
      300: '#6e2222',
      500: '#d05050',   // ALERT in dark
      700: '#f08080',
    },
  },
} as const

export type BrandMode = keyof typeof BRAND_PALETTE
export type BrandPalette = typeof BRAND_PALETTE
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/ui-tokens test brand-palette
```

Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts \
        packages/ui-tokens/test/brand-palette.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): BRAND_PALETTE light + dark tables

Locked from brand-design spec §4. Light + dark have identical key shape;
hex values change per mode. No semantic mapping yet — that's Task 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Semantic tokens + getSemantic helper

**Files:**
- Create: `packages/ui-tokens/src/brand/semantic.ts`
- Create: `packages/ui-tokens/test/brand-semantic.test.ts`

Semantic tokens give consumers mode-agnostic names. `getSemantic('light').text.primary` returns the appropriate hex; consumers never branch on mode themselves.

- [ ] **Step 1: Write the failing semantic test**

Create `packages/ui-tokens/test/brand-semantic.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BRAND_PALETTE } from '../src/brand/palette.ts'
import { BRAND_SEMANTIC, getSemantic } from '../src/brand/semantic.ts'

describe('BRAND_SEMANTIC.light → palette references', () => {
  it('resolves text.primary to ink.1000', () => {
    expect(BRAND_SEMANTIC.light.text.primary).toBe(BRAND_PALETTE.light.ink[1000])
  })

  it('resolves text.body to ink.700', () => {
    expect(BRAND_SEMANTIC.light.text.body).toBe(BRAND_PALETTE.light.ink[700])
  })

  it('resolves text.muted to ink.500', () => {
    expect(BRAND_SEMANTIC.light.text.muted).toBe(BRAND_PALETTE.light.ink[500])
  })

  it('resolves bg.card to surface.card', () => {
    expect(BRAND_SEMANTIC.light.bg.card).toBe(BRAND_PALETTE.light.surface.card)
  })

  it('resolves accent.primary to accent.500', () => {
    expect(BRAND_SEMANTIC.light.accent.primary).toBe(BRAND_PALETTE.light.accent[500])
  })

  it('resolves border.focus to accent.500', () => {
    expect(BRAND_SEMANTIC.light.border.focus).toBe(BRAND_PALETTE.light.accent[500])
  })

  it('resolves alert.danger.fg to alert.500', () => {
    expect(BRAND_SEMANTIC.light.alert.danger.fg).toBe(BRAND_PALETTE.light.alert[500])
  })
})

describe('BRAND_SEMANTIC.dark → palette references', () => {
  it('resolves text.primary to dark ink.1000 (cream)', () => {
    expect(BRAND_SEMANTIC.dark.text.primary).toBe('#fdf8f3')
  })

  it('resolves accent.primary to dark accent.500 (saturated up)', () => {
    expect(BRAND_SEMANTIC.dark.accent.primary).toBe('#e8a060')
  })

  it('resolves bg.app to dark surface.base', () => {
    expect(BRAND_SEMANTIC.dark.bg.app).toBe('#1a1410')
  })
})

describe('semantic parity between modes', () => {
  it('light and dark expose identical top-level keys', () => {
    expect(Object.keys(BRAND_SEMANTIC.light).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark).sort())
  })

  it('text.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.text).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.text).sort())
  })

  it('bg.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.bg).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.bg).sort())
  })

  it('accent.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.accent).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.accent).sort())
  })
})

describe('getSemantic helper', () => {
  it('returns the light table when called with "light"', () => {
    expect(getSemantic('light')).toBe(BRAND_SEMANTIC.light)
  })

  it('returns the dark table when called with "dark"', () => {
    expect(getSemantic('dark')).toBe(BRAND_SEMANTIC.dark)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/ui-tokens test brand-semantic
```

Expected: FAIL — module `../src/brand/semantic.ts` does not exist.

- [ ] **Step 3: Create the semantic implementation**

Create `packages/ui-tokens/src/brand/semantic.ts`:

```ts
// Semantic brand tokens. Mode-agnostic names; mode-appropriate values.
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §4.3.

import { BRAND_PALETTE, type BrandMode } from './palette.ts'

const buildSemantic = (mode: BrandMode) => {
  const p = BRAND_PALETTE[mode]
  return {
    text: {
      primary:  p.ink[1000],
      body:     p.ink[700],
      muted:    p.ink[500],
      disabled: p.ink[300],
      onAccent: mode === 'light' ? '#ffffff' : p.ink[1000],
    },
    bg: {
      app:      p.surface.base,
      card:     p.surface.card,
      elevated: p.surface.elevated,
      subtle:   p.surface.subtle,
    },
    border: {
      default: p.border.default,
      strong:  p.border.strong,
      focus:   p.accent[500],
    },
    accent: {
      primary:   p.accent[500],
      secondary: p.accent[400],
      pressed:   p.accent[600],
      bg:        p.accent[100],
    },
    alert: {
      danger: {
        fg:     p.alert[500],
        bg:     p.alert[100],
        border: p.alert[300],
      },
    },
  } as const
}

export const BRAND_SEMANTIC = {
  light: buildSemantic('light'),
  dark:  buildSemantic('dark'),
} as const

export type BrandSemantic = (typeof BRAND_SEMANTIC)['light']

export function getSemantic(mode: BrandMode): BrandSemantic {
  return BRAND_SEMANTIC[mode]
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/ui-tokens test brand-semantic
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-tokens/src/brand/semantic.ts \
        packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): BRAND_SEMANTIC tokens + getSemantic(mode) helper

Mode-agnostic semantic names; consumers never branch on mode. Light
+ dark tables share identical key shape; values are mode-appropriate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Typography + spacing + radii + shadow (data files)

**Files:**
- Create: `packages/ui-tokens/src/brand/typography.ts`
- Create: `packages/ui-tokens/src/brand/spacing.ts`
- Create: `packages/ui-tokens/src/brand/radii.ts`
- Create: `packages/ui-tokens/src/brand/shadow.ts`
- Create: `packages/ui-tokens/test/brand-scales.test.ts`

These are all small data files. Grouping them keeps task count tight; each is exercised by the same scale-test file.

- [ ] **Step 1: Write the failing scales test**

Create `packages/ui-tokens/test/brand-scales.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BRAND_TYPE } from '../src/brand/typography.ts'
import { BRAND_SPACE } from '../src/brand/spacing.ts'
import { BRAND_RADII } from '../src/brand/radii.ts'
import { BRAND_SHADOW } from '../src/brand/shadow.ts'

describe('BRAND_TYPE scale', () => {
  it('contains all 9 type tokens', () => {
    expect(Object.keys(BRAND_TYPE).sort()).toEqual(
      ['body', 'bodySm', 'display', 'h1', 'h2', 'h3', 'h4', 'label', 'micro']
    )
  })

  it('display is 40px / 1.15 / -0.02em / 700', () => {
    expect(BRAND_TYPE.display).toEqual({
      sizePx: 40,
      sizeRem: 2.5,
      lineHeight: 1.15,
      tracking: '-0.02em',
      weight: 700,
    })
  })

  it('body is 15px / 1.55 / 0 / 400', () => {
    expect(BRAND_TYPE.body).toEqual({
      sizePx: 15,
      sizeRem: 0.9375,
      lineHeight: 1.55,
      tracking: '0',
      weight: 400,
    })
  })

  it('scale is strictly descending by sizePx from display to micro', () => {
    const order = ['display', 'h1', 'h2', 'h3', 'h4', 'body', 'bodySm', 'label', 'micro'] as const
    const sizes = order.map((k) => BRAND_TYPE[k].sizePx)
    const sorted = [...sizes].sort((a, b) => b - a)
    expect(sizes).toEqual(sorted)
  })
})

describe('BRAND_SPACE scale', () => {
  it('uses 4px base unit', () => {
    expect(BRAND_SPACE[1]).toBe(4)
    expect(BRAND_SPACE[2]).toBe(8)
    expect(BRAND_SPACE[3]).toBe(12)
    expect(BRAND_SPACE[4]).toBe(16)
  })

  it('exposes the documented stops', () => {
    expect(Object.keys(BRAND_SPACE).map(Number).sort((a, b) => a - b))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16])
  })

  it('reset is 0', () => {
    expect(BRAND_SPACE[0]).toBe(0)
  })
})

describe('BRAND_RADII scale', () => {
  it('exposes the sharp-editorial stops', () => {
    expect(BRAND_RADII.none).toBe(0)
    expect(BRAND_RADII.xs).toBe(2)
    expect(BRAND_RADII.sm).toBe(4)
    expect(BRAND_RADII.md).toBe(6)
    expect(BRAND_RADII.lg).toBe(8)
    expect(BRAND_RADII.xl).toBe(12)
    expect(BRAND_RADII.full).toBe(9999)
  })
})

describe('BRAND_SHADOW scale', () => {
  it('sm shadow uses warm-brown rgba in light mode', () => {
    expect(BRAND_SHADOW.sm.light).toBe('0 1px 2px rgba(58,40,24,0.06)')
  })

  it('md shadow uses 2-layer warm-brown in light mode', () => {
    expect(BRAND_SHADOW.md.light).toBe(
      '0 2px 4px rgba(58,40,24,0.08), 0 1px 2px rgba(58,40,24,0.06)'
    )
  })

  it('lg shadow uses 2-layer warm-brown with larger first layer in light mode', () => {
    expect(BRAND_SHADOW.lg.light).toBe(
      '0 8px 16px rgba(58,40,24,0.10), 0 2px 4px rgba(58,40,24,0.08)'
    )
  })

  it('dark mode shadows use pure black rgba', () => {
    expect(BRAND_SHADOW.sm.dark).toBe('0 1px 2px rgba(0,0,0,0.4)')
    expect(BRAND_SHADOW.md.dark).toBe('0 2px 4px rgba(0,0,0,0.5)')
    expect(BRAND_SHADOW.lg.dark).toBe('0 8px 16px rgba(0,0,0,0.6)')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/ui-tokens test brand-scales
```

Expected: FAIL — 4 missing modules.

- [ ] **Step 3: Create `typography.ts`**

Create `packages/ui-tokens/src/brand/typography.ts`:

```ts
// Brand typography scale. Family is Inter (weights 400/500/600/700).
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §5.

export const BRAND_TYPE_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export const BRAND_TYPE = {
  display: { sizePx: 40,   sizeRem: 2.5,    lineHeight: 1.15, tracking: '-0.02em',  weight: 700 },
  h1:      { sizePx: 28,   sizeRem: 1.75,   lineHeight: 1.2,  tracking: '-0.015em', weight: 700 },
  h2:      { sizePx: 22,   sizeRem: 1.375,  lineHeight: 1.25, tracking: '-0.01em',  weight: 700 },
  h3:      { sizePx: 18,   sizeRem: 1.125,  lineHeight: 1.3,  tracking: '-0.005em', weight: 700 },
  h4:      { sizePx: 16,   sizeRem: 1.0,    lineHeight: 1.35, tracking: '0',        weight: 600 },
  body:    { sizePx: 15,   sizeRem: 0.9375, lineHeight: 1.55, tracking: '0',        weight: 400 },
  bodySm:  { sizePx: 13,   sizeRem: 0.8125, lineHeight: 1.5,  tracking: '0',        weight: 400 },
  label:   { sizePx: 12,   sizeRem: 0.75,   lineHeight: 1.45, tracking: '0.04em',   weight: 600 },
  micro:   { sizePx: 11,   sizeRem: 0.6875, lineHeight: 1.4,  tracking: '0.08em',   weight: 700 },
} as const

export const BRAND_TYPE_WEIGHT = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const

export type BrandType = typeof BRAND_TYPE
export type BrandTypeKey = keyof typeof BRAND_TYPE
```

- [ ] **Step 4: Create `spacing.ts`**

Create `packages/ui-tokens/src/brand/spacing.ts`:

```ts
// Brand spacing scale. 4px base unit (Tailwind-compatible stops only — we export
// the ones we actually use, not every Tailwind index).
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §6.

export const BRAND_SPACE = {
   0: 0,
   1: 4,
   2: 8,
   3: 12,
   4: 16,
   5: 20,
   6: 24,
   8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

export type BrandSpace = typeof BRAND_SPACE
export type BrandSpaceKey = keyof typeof BRAND_SPACE
```

- [ ] **Step 5: Create `radii.ts`**

Create `packages/ui-tokens/src/brand/radii.ts`:

```ts
// Brand radius scale. Sharp / editorial.
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §7.

export const BRAND_RADII = {
  none: 0,
  xs:   2,
  sm:   4,
  md:   6,
  lg:   8,
  xl:   12,
  full: 9999,
} as const

export type BrandRadii = typeof BRAND_RADII
export type BrandRadiiKey = keyof typeof BRAND_RADII
```

- [ ] **Step 6: Create `shadow.ts`**

Create `packages/ui-tokens/src/brand/shadow.ts`:

```ts
// Brand shadow scale. 3-step warm-tinted in light mode; black-tinted in dark.
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §8.

export const BRAND_SHADOW = {
  sm: {
    light: '0 1px 2px rgba(58,40,24,0.06)',
    dark:  '0 1px 2px rgba(0,0,0,0.4)',
  },
  md: {
    light: '0 2px 4px rgba(58,40,24,0.08), 0 1px 2px rgba(58,40,24,0.06)',
    dark:  '0 2px 4px rgba(0,0,0,0.5)',
  },
  lg: {
    light: '0 8px 16px rgba(58,40,24,0.10), 0 2px 4px rgba(58,40,24,0.08)',
    dark:  '0 8px 16px rgba(0,0,0,0.6)',
  },
} as const

export type BrandShadow = typeof BRAND_SHADOW
export type BrandShadowKey = keyof typeof BRAND_SHADOW
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/ui-tokens test brand-scales
```

Expected: PASS — all 4 scales assert correctly.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-tokens/src/brand/typography.ts \
        packages/ui-tokens/src/brand/spacing.ts \
        packages/ui-tokens/src/brand/radii.ts \
        packages/ui-tokens/src/brand/shadow.ts \
        packages/ui-tokens/test/brand-scales.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): BRAND_TYPE + SPACE + RADII + SHADOW scales

Locked from brand-design spec §5–§8. Inter family, 4px base, sharp
radii, warm-tinted shadows. All data-only — no runtime logic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Logo geometry + gradient fills

**Files:**
- Create: `packages/ui-tokens/src/brand/logo.ts`
- Create: `packages/ui-tokens/test/brand-logo.test.ts`

The logo is the only piece with real math. Two-square cascade parameterized by `S` (square side); helper returns concrete pixel values for any `S`.

- [ ] **Step 1: Write the failing logo test**

Create `packages/ui-tokens/test/brand-logo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LOGO_RATIOS, LOGO_FILLS, logoGeometry } from '../src/brand/logo.ts'

describe('LOGO_RATIOS constants', () => {
  it('matches the spec ratios', () => {
    expect(LOGO_RATIOS.offsetXRatio).toBeCloseTo(0.4375, 5)
    expect(LOGO_RATIOS.offsetYRatio).toBeCloseTo(0.25, 5)
    expect(LOGO_RATIOS.overlapWidthRatio).toBeCloseTo(0.5625, 5)
    expect(LOGO_RATIOS.overlapHeightRatio).toBeCloseTo(0.75, 5)
    expect(LOGO_RATIOS.bracketArmRatio).toBeCloseTo(0.20, 5)
    expect(LOGO_RATIOS.boundingWidthRatio).toBeCloseTo(1.4375, 5)
    expect(LOGO_RATIOS.boundingHeightRatio).toBeCloseTo(1.25, 5)
  })
})

describe('LOGO_FILLS gradient strings', () => {
  it('back square uses deep-orange (rgba 196,106,42) 135deg gradient', () => {
    expect(LOGO_FILLS.backSquare).toBe(
      'linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)'
    )
  })

  it('front square uses light-orange (rgba 232,160,96) 135deg gradient', () => {
    expect(LOGO_FILLS.frontSquare).toBe(
      'linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)'
    )
  })

  it('border + bracket color is the deep-orange accent.500', () => {
    expect(LOGO_FILLS.borderColor).toBe('#c46a2a')
    expect(LOGO_FILLS.bracketColor).toBe('#c46a2a')
  })
})

describe('logoGeometry(S=32) canonical values', () => {
  it('produces the documented medium-variant geometry', () => {
    const g = logoGeometry(32)
    expect(g.squareSize).toBe(32)
    expect(g.offsetX).toBe(14)
    expect(g.offsetY).toBe(8)
    expect(g.overlapWidth).toBe(18)
    expect(g.overlapHeight).toBe(24)
    expect(g.boundingWidth).toBe(46)
    expect(g.boundingHeight).toBe(40)
  })

  it('square radius clamps to 3 at S=32', () => {
    expect(logoGeometry(32).squareRadius).toBe(3)
  })

  it('border stroke is 1 at S=32', () => {
    expect(logoGeometry(32).borderStroke).toBe(1)
  })

  it('bracket arm is 6.4 at S=32, stroke clamps to 1.5', () => {
    const g = logoGeometry(32)
    expect(g.bracketArm).toBeCloseTo(6.4, 5)
    expect(g.bracketStroke).toBeCloseTo(1.5, 5)
  })
})

describe('logoGeometry — scales linearly with S', () => {
  it('S=64 doubles all linear dimensions', () => {
    const g = logoGeometry(64)
    expect(g.offsetX).toBe(28)
    expect(g.offsetY).toBe(16)
    expect(g.overlapWidth).toBe(36)
    expect(g.overlapHeight).toBe(48)
    expect(g.boundingWidth).toBe(92)
    expect(g.boundingHeight).toBe(80)
  })

  it('S=16 halves linear dimensions', () => {
    const g = logoGeometry(16)
    expect(g.offsetX).toBe(7)
    expect(g.offsetY).toBe(4)
    expect(g.overlapWidth).toBe(9)
    expect(g.overlapHeight).toBe(12)
  })
})

describe('logoGeometry — clamp behavior at extremes', () => {
  it('border stroke clamps to a minimum of 0.75 at S=12 (favicon)', () => {
    expect(logoGeometry(12).borderStroke).toBe(0.75)
  })

  it('border stroke clamps to a maximum of 2 at S=96', () => {
    expect(logoGeometry(96).borderStroke).toBe(2)
  })

  it('square radius clamps to a minimum of 2 at S=12', () => {
    expect(logoGeometry(12).squareRadius).toBe(2)
  })

  it('square radius clamps to a maximum of 6 at very large S', () => {
    expect(logoGeometry(128).squareRadius).toBe(6)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/ui-tokens test brand-logo
```

Expected: FAIL — `../src/brand/logo.ts` does not exist.

- [ ] **Step 3: Create the logo implementation**

Create `packages/ui-tokens/src/brand/logo.ts`:

```ts
// Logo geometry + fills. The Chiaro mark is two cascading squares with four
// L-shaped corner brackets framing the overlap region. All dimensions scale
// with a single parameter S (square side length, px).
//
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §9.

export const LOGO_RATIOS = {
  // Front square SE offset from back square's top-left
  offsetXRatio: 0.4375,    // 14/32 — horizontal offset
  offsetYRatio: 0.25,      // 8/32  — vertical offset

  // Overlap rectangle dimensions (in terms of S)
  overlapWidthRatio: 0.5625,   // 18/32
  overlapHeightRatio: 0.75,    // 24/32

  // Corner bracket geometry
  bracketArmRatio: 0.20,       // arm length is 20% of S

  // Bounding box (S + offsetX, S + offsetY)
  boundingWidthRatio: 1.4375,
  boundingHeightRatio: 1.25,
} as const

export const LOGO_FILLS = {
  backSquare:  'linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)',
  frontSquare: 'linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)',
  borderColor:  '#c46a2a',   // matches BRAND_PALETTE.light.accent[500]
  bracketColor: '#c46a2a',
} as const

export interface LogoGeometry {
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

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)

/**
 * Resolve concrete logo geometry for a given square side length S (in px).
 *
 * @example
 * const g = logoGeometry(32)
 * // g.boundingWidth === 46, g.boundingHeight === 40, g.squareRadius === 3
 */
export function logoGeometry(S: number): LogoGeometry {
  return {
    squareSize:     S,
    squareRadius:   clamp(S * 0.094, 2, 6),
    offsetX:        S * LOGO_RATIOS.offsetXRatio,
    offsetY:        S * LOGO_RATIOS.offsetYRatio,
    overlapWidth:   S * LOGO_RATIOS.overlapWidthRatio,
    overlapHeight:  S * LOGO_RATIOS.overlapHeightRatio,
    bracketArm:     S * LOGO_RATIOS.bracketArmRatio,
    bracketStroke:  clamp(S * 0.047, 0.75, 2.5),
    borderStroke:   clamp(S * 0.031, 0.75, 2),
    boundingWidth:  S * LOGO_RATIOS.boundingWidthRatio,
    boundingHeight: S * LOGO_RATIOS.boundingHeightRatio,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/ui-tokens test brand-logo
```

Expected: PASS — all geometry + fill assertions green.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-tokens/src/brand/logo.ts \
        packages/ui-tokens/test/brand-logo.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): LOGO_RATIOS + LOGO_FILLS + logoGeometry(S) helper

Two-square cascade parameterized on square side S. Helper returns
concrete pixel geometry at any size; gradient + color constants are
the canonical fills. Scales linearly with clamps on stroke + radius.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: BRAND barrel + package re-export

**Files:**
- Create: `packages/ui-tokens/src/brand/index.ts`
- Modify: `packages/ui-tokens/src/index.ts`
- Create: `packages/ui-tokens/test/brand-barrel.test.ts`

Assemble the single `BRAND` object that downstream consumers import. Re-export from the package root.

- [ ] **Step 1: Write the failing barrel test**

Create `packages/ui-tokens/test/brand-barrel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BRAND, getSemantic, logoGeometry } from '../src/index.ts'

describe('BRAND root object', () => {
  it('exposes all 7 sub-namespaces', () => {
    expect(Object.keys(BRAND).sort()).toEqual(
      ['logo', 'palette', 'radii', 'semantic', 'shadow', 'space', 'type']
    )
  })

  it('BRAND.palette has light + dark', () => {
    expect(BRAND.palette).toHaveProperty('light')
    expect(BRAND.palette).toHaveProperty('dark')
  })

  it('BRAND.semantic has light + dark', () => {
    expect(BRAND.semantic).toHaveProperty('light')
    expect(BRAND.semantic).toHaveProperty('dark')
  })

  it('BRAND.type contains the documented keys', () => {
    expect(BRAND.type).toHaveProperty('display')
    expect(BRAND.type).toHaveProperty('body')
    expect(BRAND.type).toHaveProperty('micro')
  })

  it('BRAND.logo exposes RATIOS + FILLS', () => {
    expect(BRAND.logo).toHaveProperty('ratios')
    expect(BRAND.logo).toHaveProperty('fills')
    expect(BRAND.logo.ratios.offsetXRatio).toBeCloseTo(0.4375, 5)
    expect(BRAND.logo.fills.borderColor).toBe('#c46a2a')
  })
})

describe('helpers re-exported from package root', () => {
  it('getSemantic("light") returns the light semantic table', () => {
    const s = getSemantic('light')
    expect(s.text.primary).toBe('#1a1714')
  })

  it('logoGeometry(32) returns canonical medium-variant geometry', () => {
    const g = logoGeometry(32)
    expect(g.boundingWidth).toBe(46)
    expect(g.boundingHeight).toBe(40)
  })
})

describe('legacy COLORS surface still exported', () => {
  // Belt-and-suspenders — already covered by back-compat.test.ts in Task 1.
  it('COLORS import path still resolves', async () => {
    const mod = await import('../src/index.ts')
    expect(mod.COLORS).toBeDefined()
    expect(mod.MAP_COLORS).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/ui-tokens test brand-barrel
```

Expected: FAIL — `BRAND` is not exported.

- [ ] **Step 3: Create the brand barrel**

Create `packages/ui-tokens/src/brand/index.ts`:

```ts
// Brand design system root export. Assembles palette + semantic + type +
// space + radii + shadow + logo into a single BRAND object.
//
// Source of truth: docs/brand-book.md and docs/superpowers/specs/2026-05-26-brand-design-design.md.

import { BRAND_PALETTE, type BrandMode, type BrandPalette } from './palette.ts'
import { BRAND_SEMANTIC, getSemantic, type BrandSemantic } from './semantic.ts'
import { BRAND_TYPE, BRAND_TYPE_FAMILY, BRAND_TYPE_WEIGHT, type BrandType, type BrandTypeKey } from './typography.ts'
import { BRAND_SPACE, type BrandSpace, type BrandSpaceKey } from './spacing.ts'
import { BRAND_RADII, type BrandRadii, type BrandRadiiKey } from './radii.ts'
import { BRAND_SHADOW, type BrandShadow, type BrandShadowKey } from './shadow.ts'
import { LOGO_RATIOS, LOGO_FILLS, logoGeometry, type LogoGeometry } from './logo.ts'

export const BRAND = {
  palette:  BRAND_PALETTE,
  semantic: BRAND_SEMANTIC,
  type:     BRAND_TYPE,
  space:    BRAND_SPACE,
  radii:    BRAND_RADII,
  shadow:   BRAND_SHADOW,
  logo: {
    ratios: LOGO_RATIOS,
    fills:  LOGO_FILLS,
  },
} as const

export {
  BRAND_PALETTE,
  BRAND_SEMANTIC,
  BRAND_TYPE,
  BRAND_TYPE_FAMILY,
  BRAND_TYPE_WEIGHT,
  BRAND_SPACE,
  BRAND_RADII,
  BRAND_SHADOW,
  LOGO_RATIOS,
  LOGO_FILLS,
  getSemantic,
  logoGeometry,
}

export type {
  BrandMode,
  BrandPalette,
  BrandSemantic,
  BrandType,
  BrandTypeKey,
  BrandSpace,
  BrandSpaceKey,
  BrandRadii,
  BrandRadiiKey,
  BrandShadow,
  BrandShadowKey,
  LogoGeometry,
}
```

- [ ] **Step 4: Re-export BRAND from package root**

Edit `packages/ui-tokens/src/index.ts`. Append after the existing `export` lines:

```ts
// Brand design system (slice brand-design 2026-05-26). New surface — see
// docs/brand-book.md. Legacy COLORS above is @deprecated for new code.
export {
  BRAND,
  BRAND_PALETTE,
  BRAND_SEMANTIC,
  BRAND_TYPE,
  BRAND_TYPE_FAMILY,
  BRAND_TYPE_WEIGHT,
  BRAND_SPACE,
  BRAND_RADII,
  BRAND_SHADOW,
  LOGO_RATIOS,
  LOGO_FILLS,
  getSemantic,
  logoGeometry,
  type BrandMode,
  type BrandPalette,
  type BrandSemantic,
  type BrandType,
  type BrandTypeKey,
  type BrandSpace,
  type BrandSpaceKey,
  type BrandRadii,
  type BrandRadiiKey,
  type BrandShadow,
  type BrandShadowKey,
  type LogoGeometry,
} from './brand/index.ts'
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/ui-tokens test brand-barrel
```

Expected: PASS — BRAND assembled and re-exported.

- [ ] **Step 6: Run the full ui-tokens test suite**

```bash
pnpm --filter @chiaro/ui-tokens test
```

Expected: every test file in `packages/ui-tokens/test/` passes (back-compat + palette + semantic + scales + logo + barrel + existing alignment/category/finance-shades/issue-area).

- [ ] **Step 7: Run the full workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: all 10 packages green. Final proof that the additive `BRAND` export does not break any consumer.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-tokens/src/brand/index.ts \
        packages/ui-tokens/src/index.ts \
        packages/ui-tokens/test/brand-barrel.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): assemble BRAND object + re-export from package root

Single BRAND root for downstream consumers. getSemantic + logoGeometry
helpers re-exported alongside. Legacy COLORS surface untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Brand book markdown reference

**Files:**
- Create: `docs/brand-book.md`

A single scrollable markdown doc covering the 10 sections from spec §11. Lives at the repo root `docs/` (not under `docs/superpowers/`) — it's permanent reference, not a slice artifact.

- [ ] **Step 1: Create `docs/brand-book.md`**

Create `docs/brand-book.md`:

```markdown
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

**Surface.** `#1a1410` · `#2a221c` · `#3a2e26` · `#22191344`

**Border.** `#3a2e26` · `#4a3e35`

**Accent.** `#c46a2a` (hover) · **`#e8a060`** (primary) · `#f0b380` (pressed)

**Alert.** `#2a1414` · `#6e2222` · **`#d05050`** · `#f08080`

### Semantic mapping

Consumers read these mode-agnostic names; mode-appropriate values resolve automatically via `getSemantic(mode)`.

| Semantic | Light | Dark |
|---|---|---|
| `text.primary` | `#1a1714` | `#fdf8f3` |
| `text.body` | `#3a322c` | `#e8d8c2` |
| `text.muted` | `#6b5e52` | `#8a7a6a` |
| `bg.app` | `#efece5` | `#1a1410` |
| `bg.card` | `#fdf8f3` | `#2a221c` |
| `bg.elevated` | `#ffffff` | `#3a2e26` |
| `border.default` | `#e8d8c2` | `#3a2e26` |
| `border.focus` | `#c46a2a` | `#e8a060` |
| `accent.primary` | `#c46a2a` | `#e8a060` |
| `accent.secondary` | `#e8a060` | `#c46a2a` |
| `alert.danger.fg` | `#a83a3a` | `#d05050` |

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

- **Squares.** 2× S × S; corner radius `clamp(2, S × 0.094, 6)`.
- **Border.** 1px stroke at S=32; `clamp(0.75, S × 0.031, 2)` at other sizes; color `#c46a2a`.
- **Back fill.** `linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)`.
- **Front fill.** `linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)`.
- **Front offset.** `(S × 0.4375, S × 0.25)` SE from back square.
- **Overlap.** `(S × 0.5625) × (S × 0.75)`.
- **Brackets.** 4× L at overlap corners; arm `S × 0.20`, stroke `clamp(0.75, S × 0.047, 2.5)`, color `#c46a2a`.
- **Bounding box.** `(S × 1.4375) × (S × 1.25)`.

### Size variants

| Variant | S | Bounding | Border | Bracket arm | Bracket stroke |
|---|---|---|---|---|---|
| Favicon | 12 | 17×15 | 0.75 | 2.5 | 0.75 |
| Tiny | 16 | 23×20 | 0.75 | 3 | 1 |
| Small | 24 | 35×30 | 1 | 5 | 1 |
| Medium | 32 | 46×40 | 1 | 6 | 1.5 |
| Large | 48 | 69×60 | 1.5 | 10 | 2 |
| Hero | 64 | 92×80 | 2 | 13 | 2.5 |

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
- **Dark:** `surface.card` (#2a221c). Squares keep the orange family; alpha gradients self-correct.
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
BRAND.palette.dark.surface.card   // #2a221c

// Semantic
BRAND.semantic.light.text.primary // #1a1714
getSemantic('dark').accent.primary // #e8a060

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
```

- [ ] **Step 2: Manually verify the markdown renders on GitHub-flavored markdown**

Run a quick local render sanity check (no specific command — just open the file in a markdown previewer or push and view on GitHub). Expected: no broken tables, no missing code fences, no stray `[ ]` or `TODO`.

- [ ] **Step 3: Commit**

```bash
git add docs/brand-book.md
git commit -m "$(cat <<'EOF'
docs(brand): brand book reference (palette, type, logo, voice)

Single scrollable markdown reference at docs/brand-book.md. Covers
the 10 sections from spec §11. Permanent reference; not under
docs/superpowers/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification + workspace sanity

**Files:** none (verification only)

Final gate before the work is ready to merge or push.

- [ ] **Step 1: Full workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: all 10 packages green.

- [ ] **Step 2: Full workspace test**

```bash
pnpm test
```

Expected: every package's test script passes. The `@chiaro/ui-tokens` package now has 6 test files (4 pre-existing + back-compat + brand-palette + brand-semantic + brand-scales + brand-logo + brand-barrel = ~9 files total).

- [ ] **Step 3: Confirm no live UI files were modified**

```bash
git diff master --name-only -- 'apps/' 'packages/officials-ui/' 'packages/officials/' 'packages/state-bills/' 'packages/bills/' 'packages/location/' 'packages/profile/' 'packages/supabase-client/' 'packages/db/'
```

Expected: empty output. The brand-design slice is purely additive; nothing in `apps/` or any non-`ui-tokens` package should appear.

- [ ] **Step 4: Confirm the deliverables exist**

```bash
ls packages/ui-tokens/src/brand/
ls docs/brand-book.md
ls docs/superpowers/specs/2026-05-26-brand-design-design.md
ls docs/superpowers/plans/2026-05-26-brand-design.md
```

Expected: 8 files under `src/brand/` (index, palette, semantic, typography, spacing, radii, shadow, logo) + `docs/brand-book.md` + spec + plan all present.

- [ ] **Step 5: Update CLAUDE.md "Slices delivered" section**

Add a new bullet to `CLAUDE.md` immediately after the slice 31 bullet:

```markdown
- **Slice 32 — Brand design system** (2026-05-26): New `BRAND` export in `@chiaro/ui-tokens` covering palette (light + dark), semantic mapping, typography scale (Inter), spacing (4px base), radii (sharp), shadow (warm-tinted 3-step), and logo geometry helpers + gradient fills. Single scrollable `docs/brand-book.md` reference at repo root. Legacy `COLORS` + `MAP_COLORS` exports kept byte-identical for back-compat (50+ slice-1-through-31 consumers untouched). No `<Logo />` React component in this slice — geometry helpers ship; first downstream consumer builds the component when it needs one. ~10 new files; no schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 6: Commit the CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): record slice 32 — brand design system

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Final state check**

```bash
git log --oneline master..brand-design
git status --short
```

Expected: 9-10 commits on `brand-design` branch since `master` (spec + spec-lock + 7 task commits + CLAUDE.md update + maybe an interim plan-commit); clean working tree.

---

## Notes for the implementer

1. **No live UI is touched.** If your changes affect any file outside `packages/ui-tokens/`, `docs/brand-book.md`, or the spec/plan/CLAUDE.md, you're out of scope — pause and re-read the spec §2.

2. **Legacy `COLORS` must stay byte-identical.** Don't be tempted to migrate it to the new system here. That's a separate follow-up slice.

3. **The dark palette stops missing from spec §4.2** (accent 100/200/700/900, alert 700) are filled in this plan in Task 2 as canonical extrapolations. They're best-guess values; the first dark-mode consumer should sanity-check them against actual surfaces.

4. **Logo math is the only non-trivial logic.** Test it thoroughly. The clamp ranges on `borderStroke`, `bracketStroke`, and `squareRadius` are the easiest place to get the geometry wrong.

5. **No `<Logo />` component in this slice.** If a reviewer asks for one, redirect to the spec — it's intentionally deferred. Geometry helpers + gradient strings are sufficient for a future consumer to build the component when needed.

6. **The brand book is plain markdown.** No HTML embeds, no JS, no required external assets. It must render on GitHub.

7. **Test naming.** Existing tests use file names like `alignment.test.ts`. New tests follow `brand-<scope>.test.ts` (e.g., `brand-palette.test.ts`) to keep them visually grouped.
