# Slice 41 — Category palette reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-derive the 6 category accent colors for stronger semantic fit, re-anchor card backgrounds to the slice-40 cool slate, collapse light/dark variants to single hex per category, and reorder the category enum + federal page card render order.

**Architecture:** Pure token-level changes in `@chiaro/ui-tokens` (category.ts + map-colors.ts). Per-category UI surfaces automatically pick up the new values through the slice 37 `useCategory*` hooks — no per-component changes. Federal officials detail pages (web + mobile) get card-order reorder to match new enum order. State-officials pages out of scope (different card composition per Gotcha #15).

**Tech Stack:** TypeScript strict + `exactOptionalPropertyTypes`, vitest, React Native + react-native-web. Token consumption via existing slice-37 brand hooks.

**Spec:** `docs/superpowers/specs/2026-05-29-category-palette-reskin-design.md`

---

## Task 1: Reorder CategoryId enum + CATEGORY_LABEL

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`

Reorder the type union members and the label object keys to the new narrative: Service Record → Community → Finance → Issue Positions → Ethics → Voting. CategoryId stays the same set of 6 strings; only order changes.

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/category.test.ts`. Replace the `ALL_IDS` const (lines 10-17) with:

```ts
const ALL_IDS: CategoryId[] = [
  'service-record',
  'community-presence',
  'finance',
  'issue-positions',
  'ethics-accountability',
  'voting-bills',
]
```

Add a new test block right after the existing `describe('CATEGORY_LABEL', ...)` block (before `describe('CATEGORY_ACCENT', ...)`):

```ts
describe('CategoryId enum + CATEGORY_LABEL ordering (slice 41)', () => {
  it('CATEGORY_LABEL keys follow the slice 41 narrative order', () => {
    const keys = Object.keys(CATEGORY_LABEL) as CategoryId[]
    expect(keys).toEqual([
      'service-record',
      'community-presence',
      'finance',
      'issue-positions',
      'ethics-accountability',
      'voting-bills',
    ])
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: FAIL — `Object.keys(CATEGORY_LABEL)` still in slice 33-37 order (`['service-record', 'issue-positions', 'community-presence', 'finance', 'ethics-accountability', 'voting-bills']`).

- [ ] **Step 3: Reorder CategoryId type + CATEGORY_LABEL**

Edit `packages/ui-tokens/src/category.ts`. Replace lines 1-16 (the type union + CATEGORY_LABEL):

```ts
export type CategoryId =
  | 'service-record'
  | 'community-presence'
  | 'finance'
  | 'issue-positions'
  | 'ethics-accountability'
  | 'voting-bills'

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  'service-record':        'Service Record',
  'community-presence':    'Community Presence',
  'finance':               'Finance',
  'issue-positions':       'Issue Positions',
  'ethics-accountability': 'Ethics & Accountability',
  'voting-bills':          'Voting & Bills',
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: PASS — new order test + all existing tests pass (existing tests use object indexing by id, so they're order-insensitive).

- [ ] **Step 5: Verify workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 projects. The CategoryId type union order change should not break any consumer (TypeScript treats union member order as irrelevant for type compatibility).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/test/category.test.ts
git commit -m "refactor(ui-tokens): reorder CategoryId enum + CATEGORY_LABEL

Slice 41 task 1. New narrative order: Service Record → Community
Presence → Finance → Issue Positions → Ethics → Voting & Bills.
\"who they are → where they show up → what they do with money → what
they believe → how they behave → what they vote on\".

CategoryId type union order changes; object literal order changes
in CATEGORY_LABEL. All existing tests use object-key indexing
(order-insensitive); a new test asserts the slice 41 order on
Object.keys(CATEGORY_LABEL).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Update CATEGORY_ACCENT (4 changed) + collapse CATEGORY_ACCENT_DARK

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`

Three accent values change (Community teal → terracotta; Finance medium-green → emerald; Ethics amber → burgundy). Service Record gold stays; Issue Positions blue stays; Voting Bills purple stays. `CATEGORY_ACCENT_DARK` collapses to identical values per category (was 6 different dark variants).

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/category.test.ts`. Replace the existing `describe('CATEGORY_ACCENT', ...)` block body (lines 33-42) with:

```ts
describe('CATEGORY_ACCENT (slice 41 semantic-aligned)', () => {
  it('matches the locked hex values from spec §4', () => {
    expect(CATEGORY_ACCENT['service-record']).toBe('#c89a4e')        // gold (unchanged)
    expect(CATEGORY_ACCENT['community-presence']).toBe('#b86340')    // terracotta (was '#1f9b88' teal)
    expect(CATEGORY_ACCENT['finance']).toBe('#1a8f5a')               // emerald (was '#3da75b' medium green)
    expect(CATEGORY_ACCENT['issue-positions']).toBe('#3b6ed1')       // blue (unchanged)
    expect(CATEGORY_ACCENT['ethics-accountability']).toBe('#8a3a4d') // burgundy (was '#d68a1f' amber)
    expect(CATEGORY_ACCENT['voting-bills']).toBe('#7d57c1')          // purple (unchanged)
  })
})
```

Add a new import at the top of the file — change line 2-8 to:

```ts
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  SUB_CASCADE_ACCENT,
  CATEGORY_CARD_GRADIENT,
} from '../src/category.ts'
```

Then add a new test block right after the new `describe('CATEGORY_ACCENT (slice 41 semantic-aligned)', ...)` block:

```ts
describe('CATEGORY_ACCENT_DARK (slice 41: single-hex collapse)', () => {
  it('contains values identical to CATEGORY_ACCENT per category', () => {
    for (const id of ALL_IDS) {
      expect(CATEGORY_ACCENT_DARK[id]).toBe(CATEGORY_ACCENT[id])
    }
  })

  it('exports the same 6 keys as CATEGORY_ACCENT', () => {
    expect(Object.keys(CATEGORY_ACCENT_DARK).sort()).toEqual(Object.keys(CATEGORY_ACCENT).sort())
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: FAIL — `CATEGORY_ACCENT['community-presence']` still `'#1f9b88'`; `CATEGORY_ACCENT_DARK['service-record']` still `'#e0b97a'` (current dark gold variant, doesn't match light gold `'#c89a4e'`).

- [ ] **Step 3: Update CATEGORY_ACCENT + CATEGORY_ACCENT_DARK**

Edit `packages/ui-tokens/src/category.ts`. Find the `CATEGORY_ACCENT` block (lines 18-26 in the slice 33-37 baseline) and replace with:

```ts
// Palette — slice 41 semantic-aligned. Locked 2026-05-29.
export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#c89a4e',  // gold (achievement medal, unchanged)
  'community-presence':    '#b86340',  // terracotta (town square clay) — was '#1f9b88'
  'finance':               '#1a8f5a',  // emerald (money) — was '#3da75b'
  'issue-positions':       '#3b6ed1',  // blue (considered stance, unchanged)
  'ethics-accountability': '#8a3a4d',  // burgundy (judicial gravitas) — was '#d68a1f'
  'voting-bills':          '#7d57c1',  // purple (legislative, unchanged)
}
```

Find the `CATEGORY_ACCENT_DARK` block (around lines 60-67 in the slice 33-37 baseline) and replace with:

```ts
// Slice 41: CATEGORY_ACCENT_DARK now mirrors CATEGORY_ACCENT (single-hex
// per category, both modes). Export name preserved for slice 37
// `useCategoryAccent` hook back-compat.
export const CATEGORY_ACCENT_DARK: Record<CategoryId, string> = CATEGORY_ACCENT
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: PASS — new accent assertions + collapse invariant + existing tests all pass.

- [ ] **Step 5: Verify workspace typecheck + officials-ui tests**

Run: `pnpm -r typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — no officials-ui tests hard-pin the old accent hex values (they consume via `useCategoryAccent`).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/test/category.test.ts
git commit -m "feat(ui-tokens): semantic-aligned accents + dark collapse (slice 41)

Task 2. Community Presence #1f9b88 teal → #b86340 terracotta (town
square clay). Finance #3da75b medium-green → #1a8f5a emerald (money,
deeper saturation). Ethics #d68a1f amber → #8a3a4d burgundy (judicial
gravitas). Service Record gold + Issue Positions blue + Voting Bills
purple unchanged.

CATEGORY_ACCENT_DARK collapses to mirror CATEGORY_ACCENT (single-hex
per category, both modes; was 6 different dark variants). Export
name preserved for slice 37 useCategoryAccent hook back-compat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Update CATEGORY_CARD_BG_SOLID (light + dark)

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`

Light card bgs go from near-invisible pales to Level B medium saturation (cards now identify as their category color). Dark card bgs go from warm-brown anchors (slice 33-37 stale) to cool-slate-with-hue-tints (slice 40 family).

- [ ] **Step 1: Write the failing test**

Edit `packages/ui-tokens/test/category.test.ts`. Add a new test block at the end of the file (before the final closing brace if any):

Update the imports first — line 2-8 should now also include the bg solids:

```ts
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG_SOLID,
  CATEGORY_CARD_BG_SOLID_DARK,
  SUB_CASCADE_ACCENT,
  CATEGORY_CARD_GRADIENT,
} from '../src/category.ts'
```

Add this test block at the end of the file:

```ts
describe('CATEGORY_CARD_BG_SOLID (slice 41 Level B saturation)', () => {
  it('matches the locked light card bg hexes', () => {
    expect(CATEGORY_CARD_BG_SOLID['service-record']).toBe('#f5e6cc')
    expect(CATEGORY_CARD_BG_SOLID['community-presence']).toBe('#f5dece')
    expect(CATEGORY_CARD_BG_SOLID['finance']).toBe('#d4e8d8')
    expect(CATEGORY_CARD_BG_SOLID['issue-positions']).toBe('#d8e0f5')
    expect(CATEGORY_CARD_BG_SOLID['ethics-accountability']).toBe('#ecc8cf')
    expect(CATEGORY_CARD_BG_SOLID['voting-bills']).toBe('#e0d5f0')
  })
})

describe('CATEGORY_CARD_BG_SOLID_DARK (slice 41 cool slate cascade)', () => {
  it('matches the locked dark card bg hexes', () => {
    expect(CATEGORY_CARD_BG_SOLID_DARK['service-record']).toBe('#23211a')        // gold-tinted cool slate
    expect(CATEGORY_CARD_BG_SOLID_DARK['community-presence']).toBe('#23201c')    // terracotta-tinted
    expect(CATEGORY_CARD_BG_SOLID_DARK['finance']).toBe('#1c2521')               // emerald-tinted
    expect(CATEGORY_CARD_BG_SOLID_DARK['issue-positions']).toBe('#1c2030')       // blue (unchanged)
    expect(CATEGORY_CARD_BG_SOLID_DARK['ethics-accountability']).toBe('#22191d') // burgundy-tinted
    expect(CATEGORY_CARD_BG_SOLID_DARK['voting-bills']).toBe('#241c2a')          // purple (unchanged)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: FAIL — current values are slice 33-37 / slice 40 holdovers (e.g. service-record light is `#fcfaf2`, not `#f5e6cc`; service-record dark is `#2a221c`, not `#23211a`).

- [ ] **Step 3: Update CATEGORY_CARD_BG_SOLID**

Edit `packages/ui-tokens/src/category.ts`. Find the `CATEGORY_CARD_BG_SOLID` block (around lines 49-56) and replace with:

```ts
// Slice 41: Level B medium saturation. Cards identify as their category
// color rather than near-invisible pale tints. Native uses these directly
// (RN lacks a built-in linear-gradient primitive); web prefers CATEGORY_CARD_GRADIENT.
export const CATEGORY_CARD_BG_SOLID: Record<CategoryId, string> = {
  'service-record':        '#f5e6cc',  // gold tint
  'community-presence':    '#f5dece',  // terracotta tint
  'finance':               '#d4e8d8',  // emerald tint
  'issue-positions':       '#d8e0f5',  // blue tint
  'ethics-accountability': '#ecc8cf',  // burgundy tint
  'voting-bills':          '#e0d5f0',  // purple tint
}
```

Find the `CATEGORY_CARD_BG_SOLID_DARK` block (around lines 93-100) and replace with:

```ts
// Slice 41: cool slate base + subtle hue tint per category. Replaces the
// slice 33-37 warm-brown anchors that visibly clashed with slice 40's new
// cool slate page bg (#16181c) and card bg (#1e2126).
export const CATEGORY_CARD_BG_SOLID_DARK: Record<CategoryId, string> = {
  'service-record':        '#23211a',  // gold-tinted cool slate — was '#2a221c'
  'community-presence':    '#23201c',  // terracotta-tinted — was '#1c2a28' teal-tinted
  'finance':               '#1c2521',  // emerald-tinted — was '#1c2820' medium-green-tinted
  'issue-positions':       '#1c2030',  // unchanged
  'ethics-accountability': '#22191d',  // burgundy-tinted — was '#2a2218' amber-tinted
  'voting-bills':          '#241c2a',  // unchanged
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: PASS.

- [ ] **Step 5: Verify workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/test/category.test.ts
git commit -m "feat(ui-tokens): per-category card bg refresh (slice 41)

Task 3. Light card bgs go to Level B medium saturation — each card
now identifies as its category color (gold/terracotta/emerald/blue/
burgundy/purple tints) rather than the slice 33-37 near-invisible
pales. Dark card bgs re-anchor to cool slate (#16181c family) with
hue tints, replacing the slice 33-37 warm-brown leftovers flagged
by slice 40 final review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Update CATEGORY_CARD_GRADIENT (light + dark)

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`

Light gradients use the new Level B start stops + keep `#fff` endpoint. Dark gradients use the new cool slate start stops + cascade the endpoint to new bg.app `#16181c` (was warm `#1a1714` — slice 40 stale fix).

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/category.test.ts`. Add `CATEGORY_CARD_GRADIENT_DARK` to the imports if not already:

```ts
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG_SOLID,
  CATEGORY_CARD_BG_SOLID_DARK,
  CATEGORY_CARD_GRADIENT,
  CATEGORY_CARD_GRADIENT_DARK,
  SUB_CASCADE_ACCENT,
} from '../src/category.ts'
```

Replace the existing `describe('CATEGORY_CARD_GRADIENT', ...)` block body (lines 55-61) with:

```ts
describe('CATEGORY_CARD_GRADIENT (slice 41 light, Level B start stops)', () => {
  it('matches the locked light gradients per category', () => {
    expect(CATEGORY_CARD_GRADIENT['service-record']).toBe('linear-gradient(180deg, #f5e6cc 0%, #fff 100%)')
    expect(CATEGORY_CARD_GRADIENT['community-presence']).toBe('linear-gradient(180deg, #f5dece 0%, #fff 100%)')
    expect(CATEGORY_CARD_GRADIENT['finance']).toBe('linear-gradient(180deg, #d4e8d8 0%, #fff 100%)')
    expect(CATEGORY_CARD_GRADIENT['issue-positions']).toBe('linear-gradient(180deg, #d8e0f5 0%, #fff 100%)')
    expect(CATEGORY_CARD_GRADIENT['ethics-accountability']).toBe('linear-gradient(180deg, #ecc8cf 0%, #fff 100%)')
    expect(CATEGORY_CARD_GRADIENT['voting-bills']).toBe('linear-gradient(180deg, #e0d5f0 0%, #fff 100%)')
  })
})

describe('CATEGORY_CARD_GRADIENT_DARK (slice 41 cool slate endpoint)', () => {
  it('matches the locked dark gradients per category', () => {
    expect(CATEGORY_CARD_GRADIENT_DARK['service-record']).toBe('linear-gradient(180deg, #23211a 0%, #16181c 100%)')
    expect(CATEGORY_CARD_GRADIENT_DARK['community-presence']).toBe('linear-gradient(180deg, #23201c 0%, #16181c 100%)')
    expect(CATEGORY_CARD_GRADIENT_DARK['finance']).toBe('linear-gradient(180deg, #1c2521 0%, #16181c 100%)')
    expect(CATEGORY_CARD_GRADIENT_DARK['issue-positions']).toBe('linear-gradient(180deg, #1c2030 0%, #16181c 100%)')
    expect(CATEGORY_CARD_GRADIENT_DARK['ethics-accountability']).toBe('linear-gradient(180deg, #22191d 0%, #16181c 100%)')
    expect(CATEGORY_CARD_GRADIENT_DARK['voting-bills']).toBe('linear-gradient(180deg, #241c2a 0%, #16181c 100%)')
  })

  it('all 6 endpoints fade to #16181c (slice 40 bg.app cool slate)', () => {
    const ALL_IDS_LIST: CategoryId[] = [
      'service-record', 'community-presence', 'finance',
      'issue-positions', 'ethics-accountability', 'voting-bills',
    ]
    for (const id of ALL_IDS_LIST) {
      expect(CATEGORY_CARD_GRADIENT_DARK[id]).toMatch(/#16181c 100%\)$/)
    }
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: FAIL — current dark gradients still end at `#1a1714` (warm anchor); light start stops still slice 33-37 pales.

- [ ] **Step 3: Update CATEGORY_CARD_GRADIENT**

Edit `packages/ui-tokens/src/category.ts`. Find the `CATEGORY_CARD_GRADIENT` block (around lines 37-44) and replace with:

```ts
// Slice 41: Level B medium saturation start stops; #fff endpoint preserved.
export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #f5e6cc 0%, #fff 100%)',
  'community-presence':    'linear-gradient(180deg, #f5dece 0%, #fff 100%)',
  'finance':               'linear-gradient(180deg, #d4e8d8 0%, #fff 100%)',
  'issue-positions':       'linear-gradient(180deg, #d8e0f5 0%, #fff 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #ecc8cf 0%, #fff 100%)',
  'voting-bills':          'linear-gradient(180deg, #e0d5f0 0%, #fff 100%)',
}
```

Find the `CATEGORY_CARD_GRADIENT_DARK` block (around lines 82-89) and replace with:

```ts
// Slice 41: cool slate start stops + cascade endpoint to slice 40 bg.app
// (#16181c, was warm '#1a1714' — slice 40 left this stale).
export const CATEGORY_CARD_GRADIENT_DARK: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #23211a 0%, #16181c 100%)',
  'community-presence':    'linear-gradient(180deg, #23201c 0%, #16181c 100%)',
  'finance':               'linear-gradient(180deg, #1c2521 0%, #16181c 100%)',
  'issue-positions':       'linear-gradient(180deg, #1c2030 0%, #16181c 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #22191d 0%, #16181c 100%)',
  'voting-bills':          'linear-gradient(180deg, #241c2a 0%, #16181c 100%)',
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/test/category.test.ts
git commit -m "feat(ui-tokens): per-category gradients refresh (slice 41)

Task 4. Light gradients adopt Level B medium-saturation start stops
matching the new CATEGORY_CARD_BG_SOLID. Dark gradients re-anchor
start stops to cool slate + cascade all 6 endpoints from old warm
'#1a1714' to slice 40 bg.app '#16181c'. Closes the slice 40
final-review stale endpoint observation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update SUB_CASCADE_ACCENT (light + dark)

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`

Lightened/desaturated variants per accent, used inside nested expand panels. Issue Positions + Voting Bills values stay unchanged; 4 changed categories get re-derived light + dark tints.

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/category.test.ts`. Add `SUB_CASCADE_ACCENT_DARK` to the imports:

```ts
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG_SOLID,
  CATEGORY_CARD_BG_SOLID_DARK,
  CATEGORY_CARD_GRADIENT,
  CATEGORY_CARD_GRADIENT_DARK,
  SUB_CASCADE_ACCENT,
  SUB_CASCADE_ACCENT_DARK,
} from '../src/category.ts'
```

Replace the existing `describe('SUB_CASCADE_ACCENT', ...)` block body (lines 44-53) with:

```ts
describe('SUB_CASCADE_ACCENT (slice 41 light)', () => {
  it('matches the locked light sub-cascade hexes', () => {
    expect(SUB_CASCADE_ACCENT['service-record']).toBe('#e1c896')        // unchanged (gold-derived)
    expect(SUB_CASCADE_ACCENT['community-presence']).toBe('#e0b8a0')    // NEW terracotta-derived (was '#7fc7bb' teal-derived)
    expect(SUB_CASCADE_ACCENT['finance']).toBe('#7eb898')               // NEW emerald-derived (was '#8fc89d')
    expect(SUB_CASCADE_ACCENT['issue-positions']).toBe('#87aae0')       // unchanged
    expect(SUB_CASCADE_ACCENT['ethics-accountability']).toBe('#c89aa8') // NEW burgundy-derived (was '#ecbc7d' amber-derived)
    expect(SUB_CASCADE_ACCENT['voting-bills']).toBe('#b39bd9')          // unchanged
  })
})

describe('SUB_CASCADE_ACCENT_DARK (slice 41 dark)', () => {
  it('matches the locked dark sub-cascade hexes', () => {
    expect(SUB_CASCADE_ACCENT_DARK['service-record']).toBe('#8a6a55')        // NEW gold-derived (was '#9a8866')
    expect(SUB_CASCADE_ACCENT_DARK['community-presence']).toBe('#a08858')    // NEW terracotta-derived (was '#4a9888' teal-derived)
    expect(SUB_CASCADE_ACCENT_DARK['finance']).toBe('#4e8060')               // NEW emerald-derived (was '#5e9a70')
    expect(SUB_CASCADE_ACCENT_DARK['issue-positions']).toBe('#6680b8')       // unchanged
    expect(SUB_CASCADE_ACCENT_DARK['ethics-accountability']).toBe('#704a55') // NEW burgundy-derived (was '#b08850' amber-derived)
    expect(SUB_CASCADE_ACCENT_DARK['voting-bills']).toBe('#8470a8')          // unchanged
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: FAIL — 5 sub-cascade value mismatches across light + dark.

- [ ] **Step 3: Update SUB_CASCADE_ACCENT**

Edit `packages/ui-tokens/src/category.ts`. Find the `SUB_CASCADE_ACCENT` block (around lines 28-35) and replace with:

```ts
// Slice 41: lightened/desaturated tints per category for nested expand
// panels. Issue Positions + Voting Bills unchanged; 4 changed categories
// re-derived from new accents (terracotta / emerald / burgundy + slice 41
// re-tone of gold).
export const SUB_CASCADE_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#e1c896',  // unchanged
  'community-presence':    '#e0b8a0',  // terracotta-derived — was '#7fc7bb'
  'finance':               '#7eb898',  // emerald-derived — was '#8fc89d'
  'issue-positions':       '#87aae0',  // unchanged
  'ethics-accountability': '#c89aa8',  // burgundy-derived — was '#ecbc7d'
  'voting-bills':          '#b39bd9',  // unchanged
}
```

Find the `SUB_CASCADE_ACCENT_DARK` block (around lines 71-78) and replace with:

```ts
// Slice 41: dark-mode SUB_CASCADE_ACCENT — re-derived from new accents.
export const SUB_CASCADE_ACCENT_DARK: Record<CategoryId, string> = {
  'service-record':        '#8a6a55',  // gold-derived — was '#9a8866'
  'community-presence':    '#a08858',  // terracotta-derived — was '#4a9888'
  'finance':               '#4e8060',  // emerald-derived — was '#5e9a70'
  'issue-positions':       '#6680b8',  // unchanged
  'ethics-accountability': '#704a55',  // burgundy-derived — was '#b08850'
  'voting-bills':          '#8470a8',  // unchanged
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: PASS.

- [ ] **Step 5: Run all officials-ui tests**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — no tests hard-pin the old sub-cascade hex values (consumed via `useSubCascadeAccent` hook).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/test/category.test.ts
git commit -m "feat(ui-tokens): sub-cascade accent refresh (slice 41)

Task 5. Re-derived light + dark sub-cascade tints for the 4 changed
categories (Community / Finance / Ethics / Service Record's dark
variant). Issue Positions + Voting Bills tints unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Update MAP_COLORS_DARK.districtFill + create map-colors.test.ts

**Files:**
- Modify: `packages/ui-tokens/src/map-colors.ts`
- Create: `packages/ui-tokens/test/map-colors.test.ts`

Single hex change on `MAP_COLORS_DARK.districtFill` (`#3a2e26` warm brown → `#3a3e45` cool slate border.strong). Creates a new test file (no map-colors test exists today).

- [ ] **Step 1: Write the failing test**

Create `packages/ui-tokens/test/map-colors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAP_COLORS, MAP_COLORS_DARK } from '../src/map-colors.ts'

describe('MAP_COLORS (light, unchanged)', () => {
  it('exports districtStroke + districtFill', () => {
    expect(MAP_COLORS.districtStroke).toBe('#1a1714')
    expect(MAP_COLORS.districtFill).toBe('#f5f0e8')
  })
})

describe('MAP_COLORS_DARK (slice 41 cool slate cascade)', () => {
  it('districtStroke unchanged (bright cream stroke)', () => {
    expect(MAP_COLORS_DARK.districtStroke).toBe('#fdf8f3')
  })

  it('districtFill cascades from warm brown to cool slate border.strong', () => {
    expect(MAP_COLORS_DARK.districtFill).toBe('#3a3e45')
  })
})

describe('MAP_COLORS / MAP_COLORS_DARK parity', () => {
  it('light and dark have identical top-level keys', () => {
    expect(Object.keys(MAP_COLORS).sort()).toEqual(Object.keys(MAP_COLORS_DARK).sort())
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- map-colors`
Expected: FAIL — `MAP_COLORS_DARK.districtFill` still `'#3a2e26'` (warm brown).

- [ ] **Step 3: Update map-colors.ts**

Edit `packages/ui-tokens/src/map-colors.ts`. Find the `MAP_COLORS_DARK` block (lines 14-17) and replace with:

```ts
// Slice 41: dark-mode districtFill cascades to cool slate (border.strong
// equivalent), replacing the slice 37 warm-brown anchor #3a2e26 that
// visibly clashed with slice 40's new cool slate page bg #16181c.
export const MAP_COLORS_DARK = {
  districtStroke: '#fdf8f3',   // bright paper-tone stroke (unchanged)
  districtFill:   '#3a3e45',   // cool slate (was warm '#3a2e26')
} as const
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- map-colors`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/map-colors.ts packages/ui-tokens/test/map-colors.test.ts
git commit -m "feat(ui-tokens): dark district fill cool slate cascade (slice 41)

Task 6. MAP_COLORS_DARK.districtFill #3a2e26 (warm brown) → #3a3e45
(cool slate border.strong equivalent). Closes the slice 40
final-review domain-palette warm-brown leftover observation.

New test file map-colors.test.ts (previously untested) — 4 cases
covering light values, dark values, and light/dark parity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Reorder federal officials web page cards

**Files:**
- Modify: `apps/web/app/officials/[id]/page.tsx`

Reorder the 6 card JSX elements + imports to match the new enum order (SR → Community → Finance → Issue Positions → Ethics → Voting).

- [ ] **Step 1: Update imports**

Edit `apps/web/app/officials/[id]/page.tsx`. Find the imports block (lines 3-10) and replace with:

```tsx
import {
  FederalServiceRecordCard,
  FederalCommunityPresenceCard,
  FederalFinanceCard,
  FederalIssuePositionsCard,
  FederalEthicsAccountabilityCard,
  FederalVotingBillsCard,
} from '@chiaro/officials-ui'
```

- [ ] **Step 2: Reorder card JSX**

Find the 6-card render block (lines 126-134) and replace with:

```tsx
        <FederalServiceRecordCard
          officialId={id}
          {...(official.chamber === 'federal_senate' ? { hideLivesInDistrict: true } : {})}
        />
        <FederalCommunityPresenceCard officialId={id} congress={CURRENT_CONGRESS} />
        <FederalFinanceCard officialId={id} cycle={CURRENT_CYCLE} />
        <FederalIssuePositionsCard officialId={id} />
        <FederalEthicsAccountabilityCard officialId={id} />
        <FederalVotingBillsCard officialId={id} congress={CURRENT_CONGRESS} />
```

- [ ] **Step 3: Verify typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Note the `/officials/[id]` bundle size for the closeout commit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/officials/[id]/page.tsx
git commit -m "feat(web): reorder federal officials cards (slice 41)

Task 7. Page card order changes from SR → Finance → IP → CP →
Ethics → Voting to the new slice 41 narrative: SR → CP → Finance →
IP → Ethics → Voting. \"who they are → where they show up → what
they do with money → what they believe → how they behave → what
they vote on\".

Imports reorder to match for readability.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Reorder federal officials mobile page cards

**Files:**
- Modify: `apps/mobile/app/(app)/officials/[id].tsx`

Mirror the same reorder on the mobile page.

- [ ] **Step 1: Update imports**

Edit `apps/mobile/app/(app)/officials/[id].tsx`. Find the imports block (lines 8-16) and replace with:

```tsx
import {
  BioHeader,
  FederalServiceRecordCard,
  FederalCommunityPresenceCard,
  FederalFinanceCard,
  FederalIssuePositionsCard,
  FederalEthicsAccountabilityCard,
  FederalVotingBillsCard,
} from '@chiaro/officials-ui'
```

- [ ] **Step 2: Reorder card JSX**

Find the 6-card render block (lines 80-88) and replace with:

```tsx
          <FederalServiceRecordCard
            officialId={officialId}
            {...(official.chamber === 'federal_senate' ? { hideLivesInDistrict: true } : {})}
          />
          <FederalCommunityPresenceCard officialId={officialId} congress={CURRENT_CONGRESS} />
          <FederalFinanceCard officialId={officialId} cycle={CURRENT_CYCLE} />
          <FederalIssuePositionsCard officialId={officialId} />
          <FederalEthicsAccountabilityCard officialId={officialId} />
          <FederalVotingBillsCard officialId={officialId} congress={CURRENT_CONGRESS} />
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/officials/[id].tsx"
git commit -m "feat(mobile): reorder federal officials cards (slice 41)

Task 8. Mirrors web Task 7 — same slice 41 narrative card order on
mobile.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Brand docs

**Files:**
- Modify: `docs/brand-book.md`
- Modify: `docs/brand-migration.md`

Refresh palette tables + add slice 41 vocabulary entry.

- [ ] **Step 1: Read `docs/brand-book.md` and find the category section**

The category palette may or may not have a dedicated section. Grep for `#1f9b88` (the old community teal) — that locates the table that needs updating. If found in a slice-37-era palette table (likely in §3 Palette or a separate category section), update the row in place.

- [ ] **Step 2: Update brand-book.md category accent rows**

If a category accent table exists with rows like `'Community Presence' | '#1f9b88'`, update the 4 changed accents:

| Old | New | Token |
|---|---|---|
| `#1f9b88` | `#b86340` | `CATEGORY_ACCENT['community-presence']` |
| `#3da75b` | `#1a8f5a` | `CATEGORY_ACCENT['finance']` |
| `#d68a1f` | `#8a3a4d` | `CATEGORY_ACCENT['ethics-accountability']` |

If a `CATEGORY_ACCENT_DARK` table exists, update it to note "same as `CATEGORY_ACCENT` per category (slice 41 single-hex collapse)".

If a category narrative/order section exists, update to: Service Record → Community Presence → Finance → Issue Positions → Ethics → Voting & Bills.

If `brand-book.md` has no category palette section (it's primarily about brand surface + ink + accent — not category palettes), append a new `## 11. Category palette (slice 41)` section at the end with the 6 accents + their semantic justifications.

- [ ] **Step 3: Update `docs/brand-migration.md`**

After the last existing entry, append:

```markdown
### Category palette (slice 41)

Re-derived 4 category accent colors for stronger semantic fit, collapsed light/dark variants to single-hex-per-category, and reordered the enum for a narrative card flow.

**Accent hex changes:**
- `CATEGORY_ACCENT['community-presence']`: `#1f9b88` teal → `#b86340` terracotta (town square clay, gathering)
- `CATEGORY_ACCENT['finance']`: `#3da75b` medium green → `#1a8f5a` emerald (money, deeper saturation)
- `CATEGORY_ACCENT['ethics-accountability']`: `#d68a1f` amber → `#8a3a4d` burgundy (judicial gravitas)

**Light/dark collapse:**
- `CATEGORY_ACCENT_DARK` now mirrors `CATEGORY_ACCENT` per category (single-hex across both modes). Export name preserved for slice 37 `useCategoryAccent` hook back-compat.

**Card bg + gradient refresh:**
- `CATEGORY_CARD_BG_SOLID` light → Level B medium saturation (cards now identify as their category color).
- `CATEGORY_CARD_BG_SOLID_DARK` → cool slate base with hue tints (replaces slice 33-37 warm-brown leftovers).
- `CATEGORY_CARD_GRADIENT_DARK` endpoints → `#16181c` (slice 40 bg.app cool slate; was warm `#1a1714`).

**Sub-cascade refresh:**
- `SUB_CASCADE_ACCENT` + `SUB_CASCADE_ACCENT_DARK` re-derived for the 4 changed categories.

**Map palette cascade:**
- `MAP_COLORS_DARK.districtFill` → `#3a3e45` cool slate (was warm `#3a2e26`).

**Enum reorder:**
- New `CategoryId` + `CATEGORY_LABEL` order: Service Record → Community Presence → Finance → Issue Positions → Ethics & Accountability → Voting & Bills.

Federal officials detail pages (web + mobile) reorder to match. State-officials pages out of scope (different card composition per Gotcha #15).
```

- [ ] **Step 4: Commit**

```bash
git add docs/brand-book.md docs/brand-migration.md
git commit -m "docs(slice-41): refresh palette tables + category vocabulary

Task 9. brand-book.md gets the new category accent values + dark
collapse note. brand-migration.md gains the slice 41 category palette
section covering the 4 accent hex changes, light/dark collapse, card
bg + gradient refresh, sub-cascade refresh, map palette cascade, and
enum reorder.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final verification + CLAUDE.md + mobile DoD

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Run full workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 workspace projects.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm test`
Expected: PASS for ui-tokens, officials-ui, and all other packages that don't require Supabase env vars. Integration tests requiring `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` may fail with the documented pre-existing skip — those are not slice 41 regressions.

- [ ] **Step 3: Run web build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture the `/officials/[id]` route size (token-only change, no significant bundle delta expected).

- [ ] **Step 4: Manual web smoke (SKIP — defer per pattern)**

Operator runs separately. Document deferred status in commit message.

- [ ] **Step 5: Update CLAUDE.md**

Open `CLAUDE.md`, find the "Slices delivered" section. After the slice 40 entry + RNW pattern findings entry, before "Specs live in...", append:

```markdown
- **Slice 41 — Category palette reskin (colors + bgs + order)** (2026-05-29): Compressed-to-Mega-Slice (~10 files). Re-derives 4 category accent colors for stronger semantic fit: Community Presence `#1f9b88` teal → `#b86340` terracotta (town square clay), Finance `#3da75b` medium green → `#1a8f5a` emerald (money, deeper saturation), Ethics `#d68a1f` amber → `#8a3a4d` burgundy (judicial gravitas). Service Record gold + Issue Positions blue + Voting Bills purple unchanged. **Single-hex collapse**: `CATEGORY_ACCENT_DARK` now mirrors `CATEGORY_ACCENT` per category (was 6 different dark variants); export name preserved for slice 37 `useCategoryAccent` hook back-compat. **Card bg refresh**: `CATEGORY_CARD_BG_SOLID` light → Level B medium saturation (cards identify as their category color rather than slice 33-37 near-invisible pales); `CATEGORY_CARD_BG_SOLID_DARK` → cool slate base with hue tints (closes slice 40 warm-brown leftovers); `CATEGORY_CARD_GRADIENT_DARK` endpoints all fade to `#16181c` (was warm `#1a1714` — slice 40 stale fix). **Sub-cascade refresh**: 4 changed categories' `SUB_CASCADE_ACCENT` + `_DARK` re-derived. **Map dark fill** `#3a3e45` cool slate (was warm `#3a2e26`). **Enum reorder**: new `CategoryId` + `CATEGORY_LABEL` order is Service Record → Community Presence → Finance → Issue Positions → Ethics → Voting & Bills; federal officials detail pages (web + mobile) reorder JSX to match. State-officials pages out of scope (different card composition per Gotcha #15). Closes slice 40 final-review domain-palette warm-brown leftover observation. Decided across 10+ visual companion iterations. **Accepted trade-off**: light gold accent `#c89a4e` on cream is ~3.2:1 (AA-large pass, AA-normal fail) — same risk profile as slice 40 portrait initials.
```

- [ ] **Step 6: Update mobile DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md` and append:

```markdown
## Slice 41 — Category palette reskin

- [ ] Federal officials detail page (mobile) shows 6 cards in new order: Service Record → Community Presence → Finance → Issue Positions → Ethics → Voting & Bills.
- [ ] Service Record card dot is gold `#c89a4e`.
- [ ] Community Presence card dot is terracotta `#b86340` (NEW; was teal).
- [ ] Finance card dot is emerald `#1a8f5a` (NEW; was medium green).
- [ ] Issue Positions card dot is blue `#3b6ed1` (unchanged).
- [ ] Ethics & Accountability card dot is burgundy `#8a3a4d` (NEW; was amber).
- [ ] Voting & Bills card dot is purple `#7d57c1` (unchanged).
- [ ] In dark mode, each card bg shows a subtle hue tint over cool slate (no warm-brown islands).
- [ ] In light mode, each card bg shows medium-saturation category tint (visibly different from app bg cream).
- [ ] Map district fill in dark mode is cool slate `#3a3e45`, not warm brown.
- [ ] Sub-cascade nested expand panels show desaturated category tints (light + dark).
```

- [ ] **Step 7: Final commit**

```bash
git add CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-41): record slice 41 closeout

Task 10. CLAUDE.md gets the slice 41 Slices delivered entry covering
the category palette reskin (accents + card bgs + gradients + sub-
cascades + map fill + enum reorder + page reorder). Mobile DoD
checklist gains the slice 41 smoke section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Final summary to user**

Report:
- Commits on branch `slice-41-category-palette-reskin`: 1 (spec) + 1 (plan) + 10 (task commits) = 12 total.
- Files changed: 9 modified + 1 new = 10.
- Test delta: +~10 new test assertions (category enum order, accent hex assertions, sub-cascade hex assertions, single-hex collapse invariant, map-colors file).
- Typecheck + test + web build: all green.
- Manual smoke status: deferred per slice 38-40 pattern.

---

## Self-review notes

**Spec coverage:**
- §5.1 token changes (CategoryId reorder + 4 accent changes + collapse + 4 sub-cascade + 6 card bg + 6 gradient): Tasks 1/2/3/4/5. ✅
- §5.2 map-colors.ts dark districtFill: Task 6. ✅
- §5.3 federal officials web page reorder: Task 7. ✅
- §5.3 mobile mirror reorder: Task 8. ✅
- §5.4 state-officials out of scope: explicitly NOT in any task (faithful to spec). ✅
- §7 risk #1 (gold contrast) documented in CLAUDE.md slice 41 entry (Task 10). ✅
- §8 testing: every changed token has a new test assertion across Tasks 1-6. ✅
- §9 file count: 10 files = 9 modified + 1 new map-colors.test.ts. ✅
- §10 closeout: Task 10 walks all criteria. ✅

**Placeholder scan:** none. Every step has runnable code or exact commands.

**Type consistency:**
- `CategoryId` shape unchanged across all tasks (only enum order reorders, type compatibility preserved).
- All hex values consistent across spec → plan → task code blocks.
- Test assertions match component-level expectations (gradient pattern regex from existing test preserved at Task 4).
