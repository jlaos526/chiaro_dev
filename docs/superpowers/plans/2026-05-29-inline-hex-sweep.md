# Slice 46 — Inline-hex sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 8 inline hex literals in `@chiaro/officials-ui/src/` to brand tokens. Add new `semantic.icon.location` token (`#e74c3c` light / `#f08074` dark) for the mode-aware DistrictBadge map-pin.

**Architecture:** Token-first ordering — palette retune (Task 1) + semantic wiring (Task 2) before the 4 consumer migrations (Tasks 3-6). Each consumer task is TDD-independent. Final docs + closeout (Task 7). Consumer tests are additive (1 new it-case per file) — existing 13 behavior-only tests stay green.

**Tech Stack:** TypeScript strict + `exactOptionalPropertyTypes`, vitest, React Native + react-native-web (RNW 0.19). Mode-aware token consumption via `useBrandTokens()` hook in `@chiaro/officials-ui/src/brand-hooks.ts`.

**Spec:** `docs/superpowers/specs/2026-05-29-inline-hex-sweep-design.md`

---

## Task 1: Add semantic.icon.location to BRAND_PALETTE

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts`

Add a new `icon` namespace with `location` key in both `BRAND_PALETTE.light` and `BRAND_PALETTE.dark`.

- [ ] **Step 1: Write the failing test**

Edit `packages/ui-tokens/test/brand-palette.test.ts`. Find the existing light describe block (which already has the slice 45 alert.danger/warning/success/info tests). Append a new it-case at the END of the `describe('BRAND_PALETTE.light', ...)` block:

```ts
  it('exports the icon.location signal red (slice 46 new namespace)', () => {
    expect(BRAND_PALETTE.light.icon.location).toBe('#e74c3c')
  })
```

In the existing `describe('BRAND_PALETTE.dark', ...)` block, append:

```ts
  it('exports the icon.location coral (dark, slice 46 new namespace)', () => {
    expect(BRAND_PALETTE.dark.icon.location).toBe('#f08074')
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: FAIL — `BRAND_PALETTE.light.icon` and `BRAND_PALETTE.dark.icon` are undefined; the test cannot reach `.location`.

- [ ] **Step 3: Update palette.ts**

Edit `packages/ui-tokens/src/brand/palette.ts`. Find the `BRAND_PALETTE.light` block. Locate the existing `link` block (which sits after the slice 45 alert block, around line 45):

```ts
    link: {
      fg: '#3b6ed1',         // inline link blue
    },
```

INSERT immediately AFTER the `link` block (before the `portrait` block):

```ts
    icon: {
      // Slice 46: small "icon" namespace for graphical asset colors that don't
      // fit alert/signal/accent semantics. First key is map-pin location red
      // used by DistrictBadge. New icons of similar location-flavored intent
      // (compass markers, etc.) can extend this namespace; non-location icons
      // should NOT colonize.
      location: '#e74c3c',   // signal red — map-pin
    },
```

Now find the `BRAND_PALETTE.dark` block. Locate its `link` block (around line 85):

```ts
    link: {
      fg: '#7a98e1',         // inline link blue (dark)
    },
```

INSERT immediately AFTER (before the `portrait` block):

```ts
    icon: {
      // Slice 46 dark-mode icon namespace. Coral red — brighter than light
      // signal red for legibility against cool slate page bg #16181c.
      location: '#f08074',
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: PASS — 2 new icon.location assertions pass. Existing palette tests + structural key-parity tests still pass.

- [ ] **Step 5: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS. `icon` is a new key; TypeScript type `typeof BRAND_PALETTE` automatically includes it.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts packages/ui-tokens/test/brand-palette.test.ts
git commit -m "feat(ui-tokens): add semantic.icon.location palette key (slice 46 task 1)

New icon namespace in BRAND_PALETTE for graphical-asset colors that
don't fit alert/signal/accent semantics. First key is location
(map-pin red): #e74c3c light / #f08074 dark. Mode-aware. Consumer
in slice 46 task 6 (DistrictBadge migration).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire semantic.icon.location through BRAND_SEMANTIC

**Files:**
- Modify: `packages/ui-tokens/src/brand/semantic.ts`
- Modify: `packages/ui-tokens/test/brand-semantic.test.ts`

Pipe the new `icon.location` palette value through `buildSemantic` so consumers can read it via `BRAND_SEMANTIC.{light,dark}.icon.location`.

- [ ] **Step 1: Write the failing test**

Edit `packages/ui-tokens/test/brand-semantic.test.ts`. Find the existing `describe('BRAND_SEMANTIC.light', ...)` block. Append:

```ts
  it('resolves icon.location to the slice 46 palette value (light)', () => {
    expect(BRAND_SEMANTIC.light.icon.location).toBe('#e74c3c')
    expect(BRAND_SEMANTIC.light.icon.location).toBe(BRAND_PALETTE.light.icon.location)
  })
```

In the existing `describe('BRAND_SEMANTIC.dark', ...)` block, append:

```ts
  it('resolves icon.location to the slice 46 palette value (dark)', () => {
    expect(BRAND_SEMANTIC.dark.icon.location).toBe('#f08074')
    expect(BRAND_SEMANTIC.dark.icon.location).toBe(BRAND_PALETTE.dark.icon.location)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-semantic`
Expected: FAIL — `BRAND_SEMANTIC.light.icon` and `.dark.icon` are undefined.

- [ ] **Step 3: Update semantic.ts**

Edit `packages/ui-tokens/src/brand/semantic.ts`. Find the `link:` block in `buildSemantic` (currently lines 53-55 or wherever it sits after the slice 45 alert.info wiring):

```ts
    link: {
      fg: p.link.fg,
    },
```

INSERT immediately AFTER the `link` block (before the `portrait` block):

```ts
    icon: {
      location: p.icon.location,
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-semantic`
Expected: PASS — 2 new icon.location it-cases pass; existing semantic tests unchanged.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/semantic.ts packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "feat(ui-tokens): semantic icon.location wiring (slice 46 task 2)

Pipe new BRAND_PALETTE.icon.location through buildSemantic so
consumers can read semantic.icon.location alongside text/bg/border/
accent/alert/signal/link/portrait namespaces. New 'icon' namespace
in BRAND_SEMANTIC matches BRAND_PALETTE shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate PillChevron to brand tokens

**Files:**
- Modify: `packages/officials-ui/src/cards/PillChevron.tsx`
- Modify: `packages/officials-ui/test/cards/PillChevron.test.tsx`

Replace 2 inline hex literals (`#f0eee5` bg, `#1a1714` text) with `useBrandTokens()` consumption. Component becomes mode-aware.

- [ ] **Step 1: Write the failing test**

Edit `packages/officials-ui/test/cards/PillChevron.test.tsx`. Append a new it-case after the existing 3:

```tsx
  it('bg uses semantic.bg.subtle in light mode (slice 46)', () => {
    const { container } = render(<PillChevron open={false} />)
    const view = container.firstElementChild as HTMLElement | null
    expect(view).not.toBeNull()
    const style = view?.getAttribute('style') ?? ''
    // RNW normalizes #f7efe2 (semantic.bg.subtle light) to rgb(247, 239, 226).
    expect(style).toMatch(/background-color:\s*rgb\(247,\s*239,\s*226\)/)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- PillChevron`
Expected: FAIL — outer view still has `#f0eee5` literal (renders as `rgb(240, 238, 229)`); new assertion doesn't match.

- [ ] **Step 3: Update PillChevron.tsx source**

Edit `packages/officials-ui/src/cards/PillChevron.tsx`. Replace the ENTIRE file content with:

```tsx
'use client'

import { Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface PillChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

/**
 * Small rounded pill rendering an expand chevron. Mode-aware via
 * useBrandTokens (slice 46): bg uses semantic.bg.subtle; text uses
 * semantic.text.primary.
 */
export function PillChevron({ open, size = 'md' }: PillChevronProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dim = size === 'sm' ? 18 : 20
  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: semantic.bg.subtle,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: semantic.text.primary, fontSize: 10, fontWeight: '700' }}>
        {open ? '▾' : '▸'}
      </Text>
    </View>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- PillChevron`
Expected: PASS — 4 it-cases pass (3 existing behavior tests + 1 new slice 46 bg assertion).

- [ ] **Step 5: Run full officials-ui suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — should stay at ~493 tests (492 baseline + 1 new). PillChevron is used inside EvidenceExpand + multiple other cards; suite-wide tests stay green because none pin the old `#f0eee5` literal (verified during spec drafting).

- [ ] **Step 6: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/cards/PillChevron.tsx packages/officials-ui/test/cards/PillChevron.test.tsx
git commit -m "refactor(officials-ui): PillChevron consumes brand tokens (slice 46 task 3)

Replace inline #f0eee5 bg + #1a1714 text with semantic.bg.subtle
+ semantic.text.primary via useBrandTokens. Component now mode-aware:
- Light: bg #f7efe2 / text #1a1714 (was #f0eee5 / #1a1714)
- Dark:  bg #1c1e2270 alpha / text #fdf8f3 (was light-invariant)

'use client' directive added (mandatory for useBrandTokens
consumers). Existing 3 behavior tests untouched; 1 new sanity
assertion verifies light-mode bg.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Migrate Logo native fallback to brand palette

**Files:**
- Modify: `packages/officials-ui/src/Logo.tsx`

Replace inline `'#e8a060'` native fallback fill with `BRAND_PALETTE.light.accent[400]` direct import. Mode-invariant (Logo is brand identity, never repaints by theme). No test changes needed.

- [ ] **Step 1: Read Logo.tsx imports**

Run: `head -20 packages/officials-ui/src/Logo.tsx`
Expected: existing import statement already pulls from `@chiaro/ui-tokens` (for `LOGO_FILLS` + `logoGeometry`).

- [ ] **Step 2: Update Logo.tsx imports**

Edit `packages/officials-ui/src/Logo.tsx`. Find the existing `@chiaro/ui-tokens` import statement (at the top of the file). Add `BRAND_PALETTE` to the named imports. For example, if the current import is:

```tsx
import { LOGO_FILLS, logoGeometry } from '@chiaro/ui-tokens'
```

Replace with:

```tsx
import { BRAND_PALETTE, LOGO_FILLS, logoGeometry } from '@chiaro/ui-tokens'
```

(Preserve any other names in the import — only `BRAND_PALETTE` is added.)

- [ ] **Step 3: Replace inline hex**

Find line 136 (the `frontFill` ternary):

```tsx
  const frontFill = isWeb ? LOGO_FILLS.frontSquare : '#e8a060'
```

Replace with:

```tsx
  const frontFill = isWeb ? LOGO_FILLS.frontSquare : BRAND_PALETTE.light.accent[400]
```

- [ ] **Step 4: Run Logo tests**

Run: `pnpm --filter @chiaro/officials-ui test -- Logo`
Expected: PASS — 9 existing tests stay green (all behavior-only, no hex pins).

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/Logo.tsx
git commit -m "refactor(officials-ui): Logo native fallback consumes BRAND_PALETTE (slice 46 task 4)

Replace inline #e8a060 native fallback fill with
BRAND_PALETTE.light.accent[400] direct import. Mode-invariant
(Logo is brand identity, never repaints by theme — same pattern as
existing LOGO_FILLS.borderColor light-mode hex). Hex value identical
to literal that was inlined.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrate EvidenceExpand to brand tokens

**Files:**
- Modify: `packages/officials-ui/src/cards/EvidenceExpand.tsx`
- Modify: `packages/officials-ui/test/cards/EvidenceExpand.test.tsx`

Replace 3 inline hex literals (`#d8d4c9` borderTopColor, `#1a1714` × 2 text colors) with `useBrandTokens()` consumption.

- [ ] **Step 1: Write the failing test**

Edit `packages/officials-ui/test/cards/EvidenceExpand.test.tsx`. Append a new it-case at the END of the describe block:

```tsx
  it('borderTopColor uses semantic.border.default in light mode (slice 46)', () => {
    const { container } = render(
      <EvidenceExpand title="Test" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>,
    )
    // The first child View has the dashed top border (when open=true).
    const inner = container.querySelector('[style*="border-top"]') as HTMLElement | null
    expect(inner).not.toBeNull()
    const style = inner?.getAttribute('style') ?? ''
    // RNW normalizes #e8d8c2 (semantic.border.default light) to rgb(232, 216, 194).
    expect(style).toMatch(/border-top-color:\s*rgb\(232,\s*216,\s*194\)/)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- EvidenceExpand`
Expected: FAIL — current borderTopColor is `#d8d4c9` (renders as `rgb(216, 212, 201)`); new assertion doesn't match.

- [ ] **Step 3: Update EvidenceExpand.tsx source**

Edit `packages/officials-ui/src/cards/EvidenceExpand.tsx`. Replace the ENTIRE file content with:

```tsx
'use client'

import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { PillChevron } from './PillChevron.tsx'

export interface EvidenceExpandProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * Expandable evidence panel with title + chevron toggle. Mode-aware via
 * useBrandTokens (slice 46): borderTopColor uses semantic.border.default;
 * title + toggle label use semantic.text.primary.
 */
export function EvidenceExpand({
  title,
  open,
  onToggle,
  children,
}: EvidenceExpandProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View>
      {open ? (
        <View
          style={{
            marginTop: 14,
            borderTopWidth: 1,
            borderTopColor: semantic.border.default,
            borderStyle: 'dashed',
            paddingTop: 12,
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: 13,
              color: semantic.text.primary,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          {children}
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <PillChevron open={open} />
          <Text style={{ color: semantic.text.primary, fontSize: 13, fontWeight: '600' }}>
            {open ? 'Hide evidence' : 'view evidence'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- EvidenceExpand`
Expected: PASS — 5 it-cases (4 existing + 1 new) pass.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/cards/EvidenceExpand.tsx packages/officials-ui/test/cards/EvidenceExpand.test.tsx
git commit -m "refactor(officials-ui): EvidenceExpand consumes brand tokens (slice 46 task 5)

Replace 3 inline hex literals (#d8d4c9 borderTopColor + 2× #1a1714
text) with semantic.border.default + semantic.text.primary via
useBrandTokens. Component now mode-aware:
- Light: border #e8d8c2 (was #d8d4c9), text #1a1714 (same)
- Dark:  border #2a2d33 cool slate, text #fdf8f3 cream (both
  were light-invariant before)

'use client' directive added. Existing 4 behavior tests untouched;
1 new sanity assertion verifies light-mode borderTopColor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Migrate DistrictBadge to brand tokens (uses new icon.location)

**Files:**
- Modify: `packages/officials-ui/src/cards/DistrictBadge.tsx`
- Modify: `packages/officials-ui/test/cards/DistrictBadge.test.tsx`

Replace 2 inline hex literals (`#d13b3b` SVG fill, `#3a352b` text) with `useBrandTokens()` consumption. The SVG fill consumes the NEW `semantic.icon.location` token from Tasks 1-2.

- [ ] **Step 1: Write the failing test**

Edit `packages/officials-ui/test/cards/DistrictBadge.test.tsx`. Append a new describe block at the END:

```tsx
describe('DistrictBadge — slice 46 token wiring', () => {
  it('pin fill uses semantic.icon.location in light mode', () => {
    const { container } = render(
      <DistrictBadge chamber="federal_house" stateName="California" stateAbbrev="CA" districtNumber={11} />,
    )
    const path = container.querySelector('svg path') as SVGPathElement | null
    expect(path).not.toBeNull()
    // SVG fill attribute is a direct hex literal (NOT RNW-normalized).
    expect(path?.getAttribute('fill')).toBe('#e74c3c')
  })

  it('text color uses semantic.text.body in light mode', () => {
    const { container, getByText } = render(
      <DistrictBadge chamber="federal_house" stateName="California" stateAbbrev="CA" districtNumber={11} />,
    )
    const text = getByText("California's 11th District") as HTMLElement
    const style = text.getAttribute('style') ?? ''
    // RNW normalizes #3a322c (semantic.text.body light) to rgb(58, 50, 44).
    expect(style).toMatch(/color:\s*rgb\(58,\s*50,\s*44\)/)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- DistrictBadge`
Expected: FAIL — current SVG fill is `#d13b3b` (not the new `#e74c3c`); text color is `#3a352b` (not `rgb(58, 50, 44)` = `#3a322c`).

- [ ] **Step 3: Update DistrictBadge.tsx source**

Edit `packages/officials-ui/src/cards/DistrictBadge.tsx`. Replace the ENTIRE file content with:

```tsx
'use client'

import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { type OfficialChamber } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

export interface DistrictBadgeProps {
  chamber: OfficialChamber
  stateName: string
  stateAbbrev: string
  districtNumber: number | null
  /** Raw district code for state chambers (e.g. "15", "1A", "At-Large"). */
  districtCode?: string
  atLarge?: boolean
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

function districtLabel(p: DistrictBadgeProps): string {
  const { chamber, stateName, stateAbbrev, districtCode, districtNumber, atLarge } = p

  if (chamber === 'federal_senate') return stateName
  if (chamber === 'federal_house') {
    if (atLarge) return `${stateName}'s At-Large District`
    if (districtNumber == null) return stateName
    return `${stateName}'s ${ordinal(districtNumber)} District`
  }

  // State chambers — compact label for list density
  const codeForState = districtCode ?? (districtNumber != null ? String(districtNumber) : '')
  if (chamber === 'state_house')       return `${stateAbbrev}-${codeForState}`
  if (chamber === 'state_senate')      return `${stateAbbrev}-SD ${codeForState}`
  if (chamber === 'state_legislature') return `${stateAbbrev}-LD ${codeForState}`
  return `${stateAbbrev}-${codeForState}`
}

export function DistrictBadge(props: DistrictBadgeProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Svg width={12} height={14} viewBox="0 0 12 14">
        <Path
          d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8.2C4.8 8.2 3.8 7.2 3.8 6S4.8 3.8 6 3.8 8.2 4.8 8.2 6 7.2 8.2 6 8.2z"
          fill={semantic.icon.location}
        />
      </Svg>
      <Text style={{ color: semantic.text.body, fontSize: 12.5 }}>{districtLabel(props)}</Text>
    </View>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- DistrictBadge`
Expected: PASS — 8 it-cases (6 existing + 2 new slice 46 sanity tests) all pass.

- [ ] **Step 5: Run full officials-ui suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — total around 496 tests (492 baseline + 1 PillChevron + 1 EvidenceExpand + 2 DistrictBadge = +4). DistrictBadge appears in OfficialAvatar / OfficialsCard / detail pages; none of those tests pin the hex values.

- [ ] **Step 6: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/cards/DistrictBadge.tsx packages/officials-ui/test/cards/DistrictBadge.test.tsx
git commit -m "refactor(officials-ui): DistrictBadge consumes brand tokens (slice 46 task 6)

Replace inline #d13b3b SVG fill + #3a352b text with
semantic.icon.location (NEW token from slice 46 tasks 1-2) +
semantic.text.body via useBrandTokens. Component now mode-aware:
- Light: pin #e74c3c (saturated signal red, was #d13b3b), text #3a322c
- Dark:  pin #f08074 (coral, was light-invariant), text #e8d8c2 cream

'use client' directive added. Existing 6 behavior tests untouched;
2 new sanity assertions verify SVG fill + text color in light mode.

Closes the final 1 of 9 audit F4 inline-hex literals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Docs + closeout

**Files:**
- Modify: `docs/brand-migration.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

Final verification + documentation.

- [ ] **Step 1: Final verification**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 projects.

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: PASS — ~167 tests (163 baseline + 4 new icon.location tests across palette + semantic).

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — ~496 tests (492 baseline + 4 new mode-aware sanity tests).

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture `/officials/[id]` First Load size (should be ~322 kB unchanged or +0.5 kB max from added token consumption).

- [ ] **Step 2: Inline-hex sweep verification grep**

Run: `grep -rn "'#[0-9a-fA-F]\{6\}'" packages/officials-ui/src/`
Expected: ONLY 1 match — `packages/officials-ui/src/bio/BioPortrait.tsx` for the portrait gradient string (intentional per slice 40, not in scope for slice 46).

If grep finds OTHER hex literals in officials-ui/src/, STOP — slice 46 missed a site. Slice 46's goal was zero non-BioPortrait inline hex.

- [ ] **Step 3: Append slice 46 entry to brand-migration.md**

Open `docs/brand-migration.md`. Append at the END:

```markdown

### Inline-hex sweep + new icon namespace (slice 46)

Closes audit F4 (8 remaining inline hex literals after slice 45's AuthForm migration). 4 consumer source files migrate to `useBrandTokens()`; 1 stays mode-invariant (Logo native fallback).

**New token:**
- `BRAND_SEMANTIC.icon.location`: `#e74c3c` light / `#f08074` dark — saturated signal red for DistrictBadge map-pin. NEW `icon` namespace; first key. Future location-related icons can extend; non-location icons should NOT colonize.

**Consumer migrations:**
- `PillChevron.tsx`: bg `#f0eee5` → `semantic.bg.subtle`; text `#1a1714` → `semantic.text.primary`
- `Logo.tsx`: native fallback `#e8a060` → `BRAND_PALETTE.light.accent[400]` direct import (mode-invariant — Logo IS brand identity)
- `EvidenceExpand.tsx`: borderTopColor `#d8d4c9` → `semantic.border.default`; 2× text `#1a1714` → `semantic.text.primary`
- `DistrictBadge.tsx`: pin fill `#d13b3b` → `semantic.icon.location` (NEW); text `#3a352b` → `semantic.text.body`

**Mode-aware impact:** 5 of 8 sites had NO dark variant before slice 46. After: PillChevron, EvidenceExpand (3 sites), DistrictBadge (2 sites) all repaint with mode toggle.

**Verification grep:** post-slice-46 `grep -rn "'#[0-9a-fA-F]{6}'" packages/officials-ui/src/` returns ONLY `bio/BioPortrait.tsx` (intentional gradient string per slice 40).
```

- [ ] **Step 4: Append slice 46 entry to CLAUDE.md**

Open `CLAUDE.md`. Find the "Slices delivered" section. Find the slice 45 entry. After the LAST slice 45 entry, BEFORE the line that starts `Specs live in...`, APPEND this new entry as a single bullet line:

```markdown
- **Slice 46 — Inline-hex sweep (audit F4)** (2026-05-29): Compressed-to-Mega Slice (~13 files). 8 inline hex literals migrated to brand tokens across 4 consumer files: `PillChevron.tsx` (bg + text), `Logo.tsx` (native fallback fill), `EvidenceExpand.tsx` (borderTop + 2 text), `DistrictBadge.tsx` (pin fill + text). New `semantic.icon.location` token (`#e74c3c` light / `#f08074` dark) in NEW `icon` namespace under BRAND_PALETTE + BRAND_SEMANTIC — first key, scope-narrow for location-related icons only. **5 of 8 sites become mode-aware** (PillChevron, EvidenceExpand×3, DistrictBadge×2 had NO dark variant before). Logo native fallback stays mode-invariant (Logo IS brand identity, `BRAND_PALETTE.light.accent[400]` direct import). DistrictBadge pin shifts visible deltas: `#d13b3b` → `#e74c3c` saturated signal red light, `#f08074` coral dark. Closes the final 1 of 9 audit F4 inline-hex literals (AuthForm closed slice 45). After slice 46: `grep -rn "'#[0-9a-fA-F]{6}'" packages/officials-ui/src/` returns ONLY `bio/BioPortrait.tsx` (intentional gradient string per slice 40). Decided across 1 visual companion screen (12 pin-fill options; user picked P9 saturated signal red). Unblocks **slice 47** (F1 web page rewrites) + **slice 48** (F2 mobile rewrites + F3 BrandStack nav theming). Test delta: ui-tokens ~163→167, officials-ui ~492→496. No schema work; pgTAP unchanged at 428.
```

- [ ] **Step 5: Append slice 46 section to mobile DoD**

Open `docs/superpowers/mobile-dod-checklist.md`. Append after the slice 45 section, BEFORE the "After the run" footer (or at end if no footer):

```markdown

## Slice 46 — Inline-hex sweep

- [ ] PillChevron pill bg repaints between modes (warm cream in light, cool slate in dark).
- [ ] EvidenceExpand dashed-border separator visible in both light + dark modes.
- [ ] DistrictBadge map-pin reads as saturated red in light, brighter coral in dark.
- [ ] DistrictBadge text label uses body-text color (charcoal in light, cream in dark).
- [ ] Logo mark on mobile splash/header shows brand orange (not slate-blue) — Logo is mode-invariant by design.
```

- [ ] **Step 6: Commit**

```bash
git add docs/brand-migration.md CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-46): record slice 46 closeout

Task 7. brand-migration entry covers new icon.location token +
4 consumer migrations + dark-mode coverage delta. CLAUDE.md slice
46 entry. Mobile DoD slice 46 section with 5 verification checkboxes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Final summary to user**

Report:
- 7 task commits + 1 spec commit = 8 total on `slice-46-inline-hex-sweep`.
- 13 files modified (2 token src + 2 token tests + 4 consumer src + 3 consumer tests + 3 docs — closeout files are not counted in spec headline).
- 1 new exported palette key (`semantic.icon.location`) under new `icon` namespace.
- 8 inline hex literals migrated (0 remaining outside BioPortrait gradient).
- ui-tokens ~167 + officials-ui ~496 tests green.
- Workspace typecheck + web build green.
- Mobile smoke deferred per slice 38-45 pattern.
- Closes slice 44 audit F4. After this + slice 45 + slice 47 + slice 48: full slice 33-43 design system cascade complete across the UI surface.
- Ready to merge.

---

## Self-review notes

**Spec coverage:**
- §1 goal (8 hex migrations + new icon.location token): Tasks 1-6 ✅
- §2 non-goals (no F1/F2 rewrites, no F3, no BrandPrimaryButton retrofit, no BioPortrait change, no new primitives): preserved by scope ✅
- §4.1 new icon.location token: Tasks 1-2 ✅
- §4.2 8 hex migrations: Tasks 3-6 ✅
- §4.3 Logo native fallback policy: Task 4 ✅
- §5.1 new token wiring (4 files): Tasks 1-2 ✅
- §5.2 consumer migrations (4 files): Tasks 3-6 ✅
- §5.3 consumer tests (3 additive): Tasks 3, 5, 6 (Task 4 Logo test stays untouched per spec) ✅
- §5.4 docs (2): Task 7 ✅
- §5.5 closeout: Task 7 ✅
- §7 risks: subtle color shifts documented per task commit messages ✅
- §8 testing: each task includes test step ✅
- §9 surface: 13 files matches ✅
- §10 closeout: Task 7 walks all criteria ✅
- §11 unblocks: documented in CLAUDE.md slice 46 entry (Task 7 Step 4) ✅

**Placeholder scan:** None. All steps have exact code or commands.

**Type consistency:**
- `useBrandTokens()` return shape consistent across Tasks 3, 5, 6
- `semantic.icon.location` referenced consistently across Tasks 1, 2, 6
- `BRAND_PALETTE.light.accent[400]` used in Task 4 (Logo) is the canonical accent[400] value (`#e8a060`)
- All hex values cross-checked between spec §4 and plan tasks byte-identical
- RNW rgb normalizations: `#f7efe2 → rgb(247, 239, 226)`, `#e8d8c2 → rgb(232, 216, 194)`, `#3a322c → rgb(58, 50, 44)` — verified

No issues found.
