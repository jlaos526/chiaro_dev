# Slice 42 — AlignmentChip palette reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-derive the 5-tier `ALIGNMENT_CHIP_COLORS` palette as a cool-to-warm thermal (emerald-aligned → gold-Mixed → terracotta-differs) with V2 deeper-saturation emphasis on the 2 Strongly tiers, and refactor `ComplianceIcon` to consume the palette via the slice 37 `useAlignmentChipColors` hook.

**Architecture:** Pure token-value updates in `@chiaro/ui-tokens/src/alignment.ts` (20 hex changes across light + dark) + 1 consumer refactor in `@chiaro/officials-ui/src/cards/ComplianceIcon.tsx` (hex literals → hook consumption). All other consumers (`AlignmentChip`, `BioAlignmentChipRow`, `BioHeader`, `OfficialsCard`) automatically pick up the new values via the existing slice 37 `useAlignmentChipColors` hook — no UI changes needed.

**Tech Stack:** TypeScript strict + `exactOptionalPropertyTypes`, vitest, React Native + react-native-web (RNW 0.19). Token consumption via existing `useAlignmentChipColors` hook in `@chiaro/officials-ui/src/brand-hooks.ts`.

**Spec:** `docs/superpowers/specs/2026-05-29-alignment-chip-reskin-design.md`

---

## Task 1: Update ALIGNMENT_CHIP_COLORS (light) + ALIGNMENT_CHIP_COLORS_DARK (TDD)

**Files:**
- Modify: `packages/ui-tokens/src/alignment.ts`
- Modify: `packages/ui-tokens/test/alignment.test.ts`

Replace all 20 hex values per spec §4. `AlignmentTier`, `ALIGNMENT_LABEL`, and `scoreToTier()` stay byte-identical.

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/alignment.test.ts`. Update the import block to add `ALIGNMENT_CHIP_COLORS_DARK`. Current import (lines 1-7):

```ts
import { describe, expect, it } from 'vitest'
import {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
  scoreToTier,
} from '../src/alignment.ts'
```

Replace with:

```ts
import { describe, expect, it } from 'vitest'
import {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
  ALIGNMENT_CHIP_COLORS_DARK,
  scoreToTier,
} from '../src/alignment.ts'
```

Find the existing `describe('ALIGNMENT_CHIP_COLORS', ...)` block (currently lines 27-35) and replace its entire body with:

```ts
describe('ALIGNMENT_CHIP_COLORS (slice 42 thermal palette)', () => {
  it('matches the locked light hex values per tier', () => {
    expect(ALIGNMENT_CHIP_COLORS['strongly-aligned']).toEqual({ bg: '#a8d4b0', fg: '#0f3a1c' })  // V2 saturation
    expect(ALIGNMENT_CHIP_COLORS['mostly-aligned']).toEqual({ bg: '#d8ecda', fg: '#2a6b30' })
    expect(ALIGNMENT_CHIP_COLORS['mixed']).toEqual({ bg: '#eedbb5', fg: '#7c5a1e' })             // gold pivot
    expect(ALIGNMENT_CHIP_COLORS['mostly-differs']).toEqual({ bg: '#f0d3c0', fg: '#6a3e1c' })
    expect(ALIGNMENT_CHIP_COLORS['strongly-differs']).toEqual({ bg: '#dca088', fg: '#4a1e0c' })  // V2 saturation
  })
})
```

Add a NEW describe block immediately after:

```ts
describe('ALIGNMENT_CHIP_COLORS_DARK (slice 42)', () => {
  it('matches the locked dark hex values per tier', () => {
    expect(ALIGNMENT_CHIP_COLORS_DARK['strongly-aligned']).toEqual({ bg: '#143020', fg: '#a8e0b0' })
    expect(ALIGNMENT_CHIP_COLORS_DARK['mostly-aligned']).toEqual({ bg: '#24462d', fg: '#a8c9af' })
    expect(ALIGNMENT_CHIP_COLORS_DARK['mixed']).toEqual({ bg: '#23211a', fg: '#e1c896' })          // matches CATEGORY_CARD_BG_SOLID_DARK['service-record']
    expect(ALIGNMENT_CHIP_COLORS_DARK['mostly-differs']).toEqual({ bg: '#3e2820', fg: '#e0a890' })
    expect(ALIGNMENT_CHIP_COLORS_DARK['strongly-differs']).toEqual({ bg: '#5e2418', fg: '#f5a888' })
  })

  it('shares the same 5 tier keys with light variant', () => {
    expect(Object.keys(ALIGNMENT_CHIP_COLORS_DARK).sort()).toEqual(Object.keys(ALIGNMENT_CHIP_COLORS).sort())
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- alignment`
Expected: FAIL — current values are slice 37 holdovers (e.g. `strongly-aligned.bg` is `#c5e3c7`, not `#a8d4b0`; `_DARK` test fails because the test file doesn't reference `_DARK` yet, so the import line is the actual fail point first — after import is added, all 5 dark assertions will fail against the slice 37 dark values).

- [ ] **Step 3: Update ALIGNMENT_CHIP_COLORS source values**

Edit `packages/ui-tokens/src/alignment.ts`. Find the `ALIGNMENT_CHIP_COLORS` block (currently lines 16-22) and replace it (and any preceding comment) with:

```ts
// Slice 42 thermal palette: cool emerald (aligned) → gold (Mixed pivot) →
// warm terracotta (differs). V2 deeper saturation on the 2 Strongly tiers
// as polar emphasis — color does the work, no font-weight differentiation.
// Mixed bg #eedbb5 borrows the slice 41 Service Record gold family,
// solving the slice 37 "Mixed blends into cream page bg" problem.
export const ALIGNMENT_CHIP_COLORS: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#a8d4b0', fg: '#0f3a1c' },  // V2 deeper emerald
  'mostly-aligned':   { bg: '#d8ecda', fg: '#2a6b30' },
  'mixed':            { bg: '#eedbb5', fg: '#7c5a1e' },  // gold pivot (Service Record family)
  'mostly-differs':   { bg: '#f0d3c0', fg: '#6a3e1c' },
  'strongly-differs': { bg: '#dca088', fg: '#4a1e0c' },  // V2 deeper terracotta
}
```

Find the `ALIGNMENT_CHIP_COLORS_DARK` block (currently lines 24-33) and replace it (and any preceding comment) with:

```ts
// Slice 42: dark-mode chip palette. Same cool-to-warm thermal structure as
// light, re-toned for cool-slate page bg (#16181c, slice 40). Mixed bg
// #23211a matches CATEGORY_CARD_BG_SOLID_DARK['service-record'] byte-for-byte —
// shared gold-tinted-slate identity with the slice 41 Service Record card.
export const ALIGNMENT_CHIP_COLORS_DARK: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#143020', fg: '#a8e0b0' },  // V2 deeper emerald slate
  'mostly-aligned':   { bg: '#24462d', fg: '#a8c9af' },
  'mixed':            { bg: '#23211a', fg: '#e1c896' },  // gold-tinted cool slate
  'mostly-differs':   { bg: '#3e2820', fg: '#e0a890' },
  'strongly-differs': { bg: '#5e2418', fg: '#f5a888' },  // V2 deeper terracotta slate
}
```

`scoreToTier` (currently lines 35-42) stays byte-identical.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- alignment`
Expected: PASS — both new describe blocks pass; existing `ALIGNMENT_LABEL`, `scoreToTier`, `ALIGNMENT_SYMBOL removed` blocks unchanged and continue passing.

- [ ] **Step 5: Run full ui-tokens test suite**

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: PASS — should grow from 164 to 166 tests (+2: locked light + key parity; the previous `ALIGNMENT_CHIP_COLORS` test was 1 it-case → still 1 it-case but renamed, dark is 2 new it-cases, net delta is +2). Specifically watch `domain-palette-dark.test.ts` `ALIGNMENT_CHIP_COLORS key parity` test — it should still pass because it asserts key set equality (`.sort()`) not specific values.

- [ ] **Step 6: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 projects. The `ALIGNMENT_CHIP_COLORS` type signature `Record<AlignmentTier, { bg: string; fg: string }>` is unchanged so no consumer breaks.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-tokens/src/alignment.ts packages/ui-tokens/test/alignment.test.ts
git commit -m "feat(ui-tokens): AlignmentChip palette thermal reskin (slice 42)

Task 1. 20 hex values updated across ALIGNMENT_CHIP_COLORS (light) +
ALIGNMENT_CHIP_COLORS_DARK. Cool emerald (aligned) -> gold Mixed
pivot -> warm terracotta (differs). V2 deeper saturation on Strongly
tiers as polar emphasis. Dark Mixed bg #23211a matches slice 41
CATEGORY_CARD_BG_SOLID_DARK['service-record'].

AlignmentTier, ALIGNMENT_LABEL, scoreToTier stay byte-identical.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Cross-package consumer-test sanity check (Gotcha #29)

**Files:**
- (no edits expected; verification only)

Per CLAUDE.md Gotcha #29, after a hex change in `@chiaro/ui-tokens`, grep consumer-package test/ folders for any of the 20 OLD hex values that may have leaked into test assertions.

- [ ] **Step 1: Grep officials-ui test/ for old hex residues**

Run from `C:\Users\jlaos\Downloads\Chiaro`:

```bash
grep -rn "#c5e3c7\|#d4ecd5\|#f0eee5\|#f4d3c0\|#f0b8a0\|#1f4d24\|#2a6b30\|#5a5751\|#7a3e1c\|#5a2812\|#1f3a25\|#26482e\|#3a3830\|#4a2e1c\|#5a2a18\|#a8d8ad\|#b8e0bd\|#d4d0c5\|#f0c2a5\|#f5b095" packages/officials-ui/test
```

Expected: zero matches (verified during spec drafting; this is a safety re-run after source values change).

- [ ] **Step 2: Run officials-ui test suite as backup verification**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — 457 tests still green. `useAlignmentChipColors` tests in `brand-hooks.test.tsx:107-125` use `expect(result.current).toEqual(ALIGNMENT_CHIP_COLORS['strongly-aligned'])` — reference the export, NOT hard-pinned hex, so they auto-track the new values.

- [ ] **Step 3: No commit (verification only)**

If grep returns zero matches AND officials-ui test passes, proceed to Task 3 without a commit. If grep returns matches, STOP and report — the spec assumed zero matches; non-zero matches indicate either hidden tests or a spec-drafting miss. Treat as a BLOCKED case to escalate.

---

## Task 3: Refactor ComplianceIcon to consume useAlignmentChipColors

**Files:**
- Modify: `packages/officials-ui/src/cards/ComplianceIcon.tsx`
- Modify: `packages/officials-ui/test/cards/ComplianceIcon.test.tsx`

Replace inline hex literals (`STYLES` const) with a `useAlignmentChipColors(tier)` call. Tier mapping: `on-time` → `strongly-aligned`, `late` → `mostly-differs` (preserves the slice 37 intent — slice 37 picked the mostly-differs hex, not strongly-differs, for "late").

- [ ] **Step 1: Write the failing test**

Edit `packages/officials-ui/test/cards/ComplianceIcon.test.tsx`. Replace the existing file content (currently 26 lines) with:

```tsx
import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComplianceIcon } from '../../src/cards/ComplianceIcon.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('ComplianceIcon', () => {
  it('on-time variant renders ✓', () => {
    const { getByText } = render(<ComplianceIcon state="on-time" />)
    expect(getByText('✓')).toBeTruthy()
  })

  it('late variant renders ✖ (U+2716)', () => {
    const { getByText } = render(<ComplianceIcon state="late" />)
    const el = getByText('✖')
    expect(el.textContent?.charCodeAt(0)).toBe(0x2716)
  })

  it('exposes accessibility label per state', () => {
    const onTime = render(<ComplianceIcon state="on-time" />)
    expect(onTime.container.querySelector('[aria-label="Filed on time"]')).not.toBeNull()
    onTime.unmount()

    const late = render(<ComplianceIcon state="late" />)
    expect(late.container.querySelector('[aria-label="Late filing"]')).not.toBeNull()
  })

  it('on-time bg uses light strongly-aligned chip bg in light mode', () => {
    const { container } = render(<ComplianceIcon state="on-time" />, { wrapper: lightWrapper })
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #a8d4b0 to rgb(168, 212, 176) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(168,\s*212,\s*176\)/)
  })

  it('on-time bg uses dark strongly-aligned chip bg in dark mode', () => {
    const { container } = render(<ComplianceIcon state="on-time" />, { wrapper: darkWrapper })
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #143020 to rgb(20, 48, 32) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(20,\s*48,\s*32\)/)
  })

  it('late bg uses light mostly-differs chip bg in light mode', () => {
    const { container } = render(<ComplianceIcon state="late" />, { wrapper: lightWrapper })
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #f0d3c0 to rgb(240, 211, 192) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(240,\s*211,\s*192\)/)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- ComplianceIcon`
Expected: FAIL — the 3 new mode-aware tests fail because the current `ComplianceIcon.tsx` uses inline hex literals (`#c5e3c7` not `#a8d4b0` for on-time light bg) and ignores the brand mode entirely. The existing 3 glyph/a11y tests pass.

- [ ] **Step 3: Update ComplianceIcon.tsx source**

Edit `packages/officials-ui/src/cards/ComplianceIcon.tsx`. Replace the entire file content (currently 29 lines) with:

```tsx
import { Text, View } from 'react-native'
import { type AlignmentTier } from '@chiaro/ui-tokens'
import { useAlignmentChipColors } from '../brand-hooks.ts'

export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

// Glyph + label stay as inline constants — they're not palette concerns.
// Color values come from useAlignmentChipColors via the slice 42 refactor,
// so dark mode + future palette tweaks track automatically.
const GLYPH: Record<ComplianceIconProps['state'], { glyph: string; label: string; tier: AlignmentTier }> = {
  'on-time': { glyph: '✓', label: 'Filed on time', tier: 'strongly-aligned' },
  'late':    { glyph: '✖', label: 'Late filing',   tier: 'mostly-differs' }, // ✖ = U+2716
}

export function ComplianceIcon({ state }: ComplianceIconProps): React.JSX.Element {
  const { glyph, label, tier } = GLYPH[state]
  const { bg, fg } = useAlignmentChipColors(tier)
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{glyph}</Text>
    </View>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- ComplianceIcon`
Expected: PASS — all 6 tests pass (3 existing + 3 new mode-aware).

- [ ] **Step 5: Run full officials-ui test suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — should grow from 457 to 460 (+3 new ComplianceIcon tests).

- [ ] **Step 6: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/cards/ComplianceIcon.tsx packages/officials-ui/test/cards/ComplianceIcon.test.tsx
git commit -m "refactor(officials-ui): ComplianceIcon reads useAlignmentChipColors (slice 42)

Task 3. Inline hex literals (#c5e3c7/#1f4d24 on-time; #f4d3c0/#7a3e1c
late) replaced with useAlignmentChipColors(tier) consumption.
Mapping: on-time -> strongly-aligned (slice 37 hex match);
late -> mostly-differs (slice 37 picked the mostly-differs hex, not
strongly-differs). Closes a CLAUDE.md inline-hex-forbidden violation.
After slice 42, ComplianceIcon tracks chip palette retones
automatically.

Closes CLAUDE.md 'Inline hex colors are forbidden' deviation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Brand docs

**Files:**
- Modify: `docs/brand-book.md`
- Modify: `docs/brand-migration.md`

Refresh palette tables in brand-book.md + append slice 42 vocabulary entry to brand-migration.md.

- [ ] **Step 1: Read both files to confirm structure**

Read `docs/brand-book.md` end-to-end. Slice 41 added section §11 "Category palette (slice 41)". Slice 42 appends a new section §12 "AlignmentChip palette (slice 42)" — if the file already has a §12, increment to §13, etc.

Read `docs/brand-migration.md` to confirm the section convention (slice 41 used `### Category palette (slice 41)`).

- [ ] **Step 2: Append §12 to brand-book.md**

Add this section to `docs/brand-book.md`. Insert at the end of the file, after section §11. If the file has additional sections beyond §11, increment numbering as needed.

```markdown

## 12. AlignmentChip palette (slice 42)

5-tier chip palette identifying voting/issue-position alignment with the user's profile. Cool-to-warm thermal: emerald-aligned → gold-Mixed-pivot → terracotta-differs. V2 deeper saturation on the 2 Strongly tiers as polar emphasis (color does the work; no font-weight differentiation).

### Light mode (`ALIGNMENT_CHIP_COLORS`)

| Tier | bg | fg | Note |
|---|---|---|---|
| Strongly Aligned | `#a8d4b0` | `#0f3a1c` | V2 deeper emerald |
| Mostly Aligned | `#d8ecda` | `#2a6b30` | Pale emerald |
| Mixed | `#eedbb5` | `#7c5a1e` | Gold pivot (slice 41 Service Record family) |
| Mostly Differs | `#f0d3c0` | `#6a3e1c` | Pale peach |
| Strongly Differs | `#dca088` | `#4a1e0c` | V2 deeper terracotta |

### Dark mode (`ALIGNMENT_CHIP_COLORS_DARK`)

| Tier | bg | fg | Note |
|---|---|---|---|
| Strongly Aligned | `#143020` | `#a8e0b0` | V2 deeper emerald slate |
| Mostly Aligned | `#24462d` | `#a8c9af` | Mid emerald slate |
| Mixed | `#23211a` | `#e1c896` | Gold-tinted cool slate (matches `CATEGORY_CARD_BG_SOLID_DARK['service-record']`) |
| Mostly Differs | `#3e2820` | `#e0a890` | Mid terracotta slate |
| Strongly Differs | `#5e2418` | `#f5a888` | V2 deeper terracotta slate |

### Cross-component consumption

`ComplianceIcon` (filing on-time / late indicator) consumes the alignment palette via `useAlignmentChipColors(tier)` so that future palette retones cascade automatically. Mapping: `on-time → strongly-aligned`, `late → mostly-differs`.
```

- [ ] **Step 3: Append slice 42 entry to brand-migration.md**

Append this at the end of `docs/brand-migration.md`:

```markdown

### AlignmentChip palette reskin (slice 42)

Re-derived all 20 hex values across `ALIGNMENT_CHIP_COLORS` + `ALIGNMENT_CHIP_COLORS_DARK` as a cool-to-warm thermal gradient with V2 deeper-saturation Strongly emphasis. Mixed tier borrows slice 41 Service Record gold family as the on-the-fence pivot.

**Light mode changes:**
- `strongly-aligned`: `{ bg: '#c5e3c7', fg: '#1f4d24' }` → `{ bg: '#a8d4b0', fg: '#0f3a1c' }` (V2 deeper emerald)
- `mostly-aligned`: `{ bg: '#d4ecd5', fg: '#2a6b30' }` → `{ bg: '#d8ecda', fg: '#2a6b30' }` (bg tweak only)
- `mixed`: `{ bg: '#f0eee5', fg: '#5a5751' }` → `{ bg: '#eedbb5', fg: '#7c5a1e' }` (gold pivot — closes slice 37 "blends into cream page bg" problem)
- `mostly-differs`: `{ bg: '#f4d3c0', fg: '#7a3e1c' }` → `{ bg: '#f0d3c0', fg: '#6a3e1c' }` (slight bg tweak + fg clean)
- `strongly-differs`: `{ bg: '#f0b8a0', fg: '#5a2812' }` → `{ bg: '#dca088', fg: '#4a1e0c' }` (V2 deeper terracotta)

**Dark mode changes:**
- `strongly-aligned`: `{ bg: '#1f3a25', fg: '#a8d8ad' }` → `{ bg: '#143020', fg: '#a8e0b0' }`
- `mostly-aligned`: `{ bg: '#26482e', fg: '#b8e0bd' }` → `{ bg: '#24462d', fg: '#a8c9af' }`
- `mixed`: `{ bg: '#3a3830', fg: '#d4d0c5' }` → `{ bg: '#23211a', fg: '#e1c896' }` (matches `CATEGORY_CARD_BG_SOLID_DARK['service-record']` byte-for-byte)
- `mostly-differs`: `{ bg: '#4a2e1c', fg: '#f0c2a5' }` → `{ bg: '#3e2820', fg: '#e0a890' }`
- `strongly-differs`: `{ bg: '#5a2a18', fg: '#f5b095' }` → `{ bg: '#5e2418', fg: '#f5a888' }`

**Consumer cleanup:**
- `packages/officials-ui/src/cards/ComplianceIcon.tsx` refactored from inline hex literals to `useAlignmentChipColors(tier)` consumption (`on-time → strongly-aligned`, `late → mostly-differs`). Closes a CLAUDE.md "inline hex forbidden" deviation.

**Not touched (coincidental hex collision):**
- `packages/officials-ui/src/cards/PillChevron.tsx` uses literal `#f0eee5` (was the slice 37 Mixed bg) as a generic expand-affordance pill. Not semantically alignment-related; hex collision is coincidental. Migrating PillChevron to a brand token is a separate inline-hex cleanup unrelated to slice 42's reskin scope.
```

- [ ] **Step 4: Commit**

```bash
git add docs/brand-book.md docs/brand-migration.md
git commit -m "docs(slice-42): AlignmentChip palette tables + migration vocabulary

Task 4. brand-book.md gets section 12 covering the slice 42 light +
dark palette tables + ComplianceIcon consumer note. brand-migration.md
gains a slice 42 entry with old->new per-tier diff for both modes,
ComplianceIcon refactor mention, and PillChevron coincidental-collision
documentation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Final verification + CLAUDE.md + mobile DoD closeout

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Run full workspace typecheck + test**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 projects.

Run: `pnpm --filter @chiaro/ui-tokens test && pnpm --filter @chiaro/officials-ui test`
Expected: ui-tokens 166/166 + officials-ui 460/460 PASS.

- [ ] **Step 2: Run web build to confirm no bundle delta**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture `/officials/[id]` First Load JS size from the route table. Expected to be ~321 kB (unchanged from slice 41) since this slice is token-value-only.

- [ ] **Step 3: Append slice 42 entry to CLAUDE.md**

Open `C:\Users\jlaos\Downloads\Chiaro\CLAUDE.md`. Find the "Slices delivered" section. Find the slice 41 entry (it starts with `- **Slice 41 — Category palette reskin`). After the LAST slice 41 entry, BEFORE the line that starts `Specs live in...`, APPEND this new entry as a single bullet line:

```markdown
- **Slice 42 — AlignmentChip palette reskin** (2026-05-29): Compressed Slice (~7 files). Re-derives all 20 hex values across `ALIGNMENT_CHIP_COLORS` + `ALIGNMENT_CHIP_COLORS_DARK` as a cool-to-warm thermal gradient: emerald-aligned → gold-Mixed-pivot → terracotta-differs. **V2 deeper saturation** on the 2 Strongly tiers as polar emphasis (color does the work; no font-weight differentiation). Mixed bg borrows slice 41 Service Record gold family (`#eedbb5` light, `#23211a` dark — matches `CATEGORY_CARD_BG_SOLID_DARK['service-record']` byte-for-byte). Closes slice 37 "Mixed bg blends into cream page bg" problem. **Consumer refactor**: `ComplianceIcon` (filing on-time/late indicator) migrates from inline hex literals to `useAlignmentChipColors(tier)` consumption — `on-time → strongly-aligned`, `late → mostly-differs`. Closes a CLAUDE.md "inline hex forbidden" deviation. **Coincidental collision noted, not touched**: `PillChevron.tsx` uses literal `#f0eee5` (was slice 37 Mixed bg) as a generic expand-affordance pill — semantically unrelated to alignment, hex collision coincidental. `AlignmentTier`, `ALIGNMENT_LABEL`, `scoreToTier()` thresholds (90/70/40/10) byte-identical. Closes slice 38+ reskin roadmap decision **#2 AlignmentChip tiers**. Decided across 4 visual companion screens (Option A direction lock, Mixed-tier variants, A+B Mixed hybrid, V2 Strongly emphasis). Test delta: ui-tokens 164→166, officials-ui 457→460. No schema work; pgTAP unchanged at 428. Bundle: `/officials/[id]` unchanged at ~321 kB First Load.
```

- [ ] **Step 4: Append slice 42 section to mobile DoD checklist**

Open `C:\Users\jlaos\Downloads\Chiaro\docs\superpowers\mobile-dod-checklist.md`. Find the slice 41 section (added at the end during slice 41 closeout). Append the following section AFTER the slice 41 section and BEFORE any "After the run" footer:

```markdown

## Slice 42 — AlignmentChip palette reskin

- [ ] AlignmentChip in BioHeader (federal + state officials) shows the new 5-tier thermal palette in light mode: pale emerald aligned → gold Mixed → peach/terracotta differs.
- [ ] AlignmentChip Strongly Aligned chip is visibly deeper saturation than Mostly Aligned (V2 emphasis).
- [ ] AlignmentChip Strongly Differs chip is visibly deeper saturation than Mostly Differs (V2 emphasis).
- [ ] AlignmentChip Mixed chip is gold/cream `#eedbb5` — visibly distinct from the page bg cream `#efece5`.
- [ ] In dark mode, AlignmentChip Mixed bg is gold-tinted cool slate `#23211a` (matches Service Record card bg).
- [ ] ComplianceIcon on-time variant (✓ green) bg matches Strongly Aligned chip bg in both light and dark mode.
- [ ] ComplianceIcon late variant (✖ peach) bg matches Mostly Differs chip bg in both light and dark mode.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-42): record slice 42 closeout

Task 5. CLAUDE.md gets the slice 42 Slices delivered entry covering
the thermal palette, V2 Strongly emphasis, gold Mixed pivot, slice
40/41 family consistency, ComplianceIcon consumer refactor, and the
PillChevron coincidental-collision note. Mobile DoD checklist gains
slice 42 smoke section with 7 verification checkboxes covering both
chip tiers and ComplianceIcon mode-aware behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Final summary to user**

Report:
- 5 task commits + 1 spec commit = 6 total on `slice-42-alignment-chip-reskin`.
- 7 files modified + 1 (spec already committed) = 8 spec-tracked + 0 follow-up.
- ui-tokens 166/166 + officials-ui 460/460 tests green.
- Workspace typecheck + web build green.
- Bundle: `/officials/[id]` unchanged at ~321 kB.
- Mobile smoke deferred per slice 38-41 pattern.
- Ready to merge.

---

## Self-review notes

**Spec coverage:**
- §1 goal (thermal palette + V2 emphasis + ComplianceIcon refactor): Tasks 1, 3. ✅
- §2 non-goals (no scoreToTier change, no ALIGNMENT_LABEL change, no PillChevron change): preserved by Tasks 1, 3, 4. ✅
- §4 locked hex values: Task 1 (all 20 values). ✅
- §5.1 alignment.ts source: Task 1. ✅
- §5.2 alignment.test.ts update: Task 1. ✅
- §5.3 ComplianceIcon refactor: Task 3. ✅
- §5.4 brand-book.md + brand-migration.md: Task 4. ✅
- §5.5 CLAUDE.md + mobile DoD: Task 5. ✅
- §7 risks: Risk #6 Gotcha #29 grep covered by Task 2. Other risks (#1-5 contrast) are visual/documentary, not code-checkable. ✅
- §8 testing: each task includes the relevant test step. ✅
- §9 surface: 8 files total = 1 alignment.ts + 1 alignment.test.ts + 1 ComplianceIcon.tsx + 1 ComplianceIcon.test.tsx + 1 brand-book.md + 1 brand-migration.md + 1 CLAUDE.md + 1 mobile-dod-checklist.md ✅. Test delta matches spec (+2 ui-tokens, +3 officials-ui — slight overshoot vs spec's "+1 officials-ui case" because I added 3 mode-aware assertions instead of 1; acceptable polish).

**Placeholder scan:** None found. All steps have exact code or commands.

**Type consistency:**
- `AlignmentTier` type used consistently in Tasks 1 + 3.
- `useAlignmentChipColors(tier: AlignmentTier): { bg: string; fg: string }` signature unchanged from slice 37 — Task 3 passes the right type.
- `ComplianceIconProps['state']` literal type `'on-time' | 'late'` preserved.
- `Record<AlignmentTier, { bg: string; fg: string }>` shape on ALIGNMENT_CHIP_COLORS exports preserved.

**Hex value consistency:**
- All 20 hex values appear in Task 1 (source + test) + Task 4 (brand-book + brand-migration) — cross-checked manually.
- ComplianceIcon RNW-normalized rgb assertions in Task 3 derived from the new hex values: `#a8d4b0` → `rgb(168, 212, 176)`, `#143020` → `rgb(20, 48, 32)`, `#f0d3c0` → `rgb(240, 211, 192)`. Verified.

No issues found.
