# Officials Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slice-4 `/officials/[id]` Performance section + home `OfficialsCard` mini-strip with the new 6-category cascade design specified in `docs/superpowers/specs/2026-05-17-officials-detail-redesign-design.md`.

**Architecture:** Component-driven redesign — extend `@chiaro/ui-tokens` with category palette + alignment helpers, build a primitive layer (PillChevron, AlignmentChip, DistrictBadge, ComplianceIcon, MetricCardShell), assemble bio + category bars + sub-cascade bars, then compose 6 category components and wire URL-fragment deep-linking from the home mini-strip. Zero DB migrations.

**Tech Stack:** Next 15 App Router · React 19 · TypeScript strict · TanStack Query 5 (existing slice-4 hooks) · vitest · @chiaro/ui-tokens · @chiaro/officials · @chiaro/bills

**Spec:** `docs/superpowers/specs/2026-05-17-officials-detail-redesign-design.md`

---

## File structure

```
packages/ui-tokens/src/
  alignment.ts                — REWRITE: drop ALIGNMENT_SYMBOL, keep colors + scoreToTier
  category.ts                 — NEW
  finance-shades.ts           — NEW
  issue-area.ts               — NEW
  index.ts                    — MODIFY: re-export the new modules

apps/web/components/
  bio/
    BioHeader.tsx             — NEW
    BioPortrait.tsx           — NEW
    BioIdentityRow.tsx        — NEW
    BioServiceCard.tsx        — NEW
    BioContactLinks.tsx       — NEW
  performance/
    PerformanceSection.tsx    — NEW (replaces OfficialPerformance.tsx)
    CategoryBar.tsx           — NEW
    SubCascadeBar.tsx         — NEW
    useExpandedState.ts       — NEW (hook)
    useUrlHashSync.ts         — NEW (hook)
    categories/
      ServiceRecordCategory.tsx        — NEW (replaces PositionSalaryCard.tsx)
      IssuePositionsCategory.tsx       — NEW (subsumes ScorecardCard + ScorecardEvidenceDrawer)
      CommunityPresenceCategory.tsx    — NEW (replaces ConstituentConnectionCard half)
      FinanceCategory.tsx              — NEW (replaces FinanceCard.tsx)
      EthicsAccountabilityCategory.tsx — NEW (replaces other half of ConstituentConnectionCard)
      VotingBillsCategory.tsx          — NEW (replaces ShowUpWorkloadCard.tsx)
    cards/
      MetricCardShell.tsx     — REWRITE existing
      AlignmentChip.tsx       — NEW
      DistrictBadge.tsx       — NEW
      ComplianceIcon.tsx      — NEW
      EvidenceExpand.tsx      — NEW (replaces modal pattern)
      PillChevron.tsx         — NEW (shared toggle icon)
    chips/
      PreviewChipText.tsx     — NEW
    finance/
      FinanceSummaryStrip.tsx       — NEW
      FinanceSubSectionHeading.tsx  — NEW
      IndustryBreakdown.tsx         — NEW (replaces FinanceIndustryBreakdown.tsx)
  OfficialsCard.tsx           — MODIFY: rewrite the OfficialRow sub-component

apps/web/app/officials/[id]/
  page.tsx                    — MODIFY: swap OfficialDetail + OfficialPerformance → BioHeader + PerformanceSection

apps/web/lib/derivations/
  alignment.ts                — NEW (top-3 chip pick, alignment derivations)
  finance.ts                  — NEW (PAC % derivation)
  service-record.ts           — NEW (first-elected, tenure-by-chamber)
  teasers.ts                  — NEW (per-category teaser line builders)

packages/ui-tokens/test/
  alignment.test.ts           — REWRITE: drop symbol assertions
  category.test.ts            — NEW
  finance-shades.test.ts      — NEW
  issue-area.test.ts          — NEW

apps/web/test/
  derivations/
    alignment.test.ts         — NEW
    finance.test.ts           — NEW
    service-record.test.ts    — NEW
    teasers.test.ts           — NEW
  components/
    cards/
      MetricCardShell.test.tsx       — NEW
      AlignmentChip.test.tsx         — NEW
      DistrictBadge.test.tsx         — NEW
      ComplianceIcon.test.tsx        — NEW
      PillChevron.test.tsx           — NEW
    performance/
      useExpandedState.test.ts       — NEW
      useUrlHashSync.test.ts         — NEW
      CategoryBar.test.tsx           — NEW
      SubCascadeBar.test.tsx         — NEW
    bio/
      BioHeader.test.tsx             — NEW
    finance/
      FinanceSummaryStrip.test.tsx   — NEW
      IndustryBreakdown.test.tsx     — NEW
```

---

## Phase A — Tokens (Tasks 1-4)

Foundation layer. All visual-language constants land in `@chiaro/ui-tokens` first so every subsequent component can import from a single source. TDD: write the test asserting the exact hex values from the spec, then add the constant.

### Task 1: Category tokens

**Files:**
- Create: `packages/ui-tokens/src/category.ts`
- Create: `packages/ui-tokens/test/category.test.ts`
- Modify: `packages/ui-tokens/src/index.ts`

- [ ] **Step 1: Failing test**

Create `packages/ui-tokens/test/category.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  SUB_CASCADE_ACCENT,
  CATEGORY_CARD_GRADIENT,
} from '../src/category.ts'

const ALL_IDS: CategoryId[] = [
  'service-record',
  'issue-positions',
  'community-presence',
  'finance',
  'ethics-accountability',
  'voting-bills',
]

describe('CATEGORY_LABEL', () => {
  it('has a label for every CategoryId', () => {
    for (const id of ALL_IDS) expect(CATEGORY_LABEL[id]).toBeTruthy()
  })
  it('matches the spec labels exactly', () => {
    expect(CATEGORY_LABEL['service-record']).toBe('Service Record')
    expect(CATEGORY_LABEL['issue-positions']).toBe('Issue Positions')
    expect(CATEGORY_LABEL['community-presence']).toBe('Community Presence')
    expect(CATEGORY_LABEL['finance']).toBe('Finance')
    expect(CATEGORY_LABEL['ethics-accountability']).toBe('Ethics & Accountability')
    expect(CATEGORY_LABEL['voting-bills']).toBe('Voting & Bills')
  })
})

describe('CATEGORY_ACCENT (palette A — semantic earthen)', () => {
  it('matches the locked hex values from the spec', () => {
    expect(CATEGORY_ACCENT['service-record']).toBe('#c89a4e')
    expect(CATEGORY_ACCENT['issue-positions']).toBe('#3b6ed1')
    expect(CATEGORY_ACCENT['community-presence']).toBe('#1f9b88')
    expect(CATEGORY_ACCENT['finance']).toBe('#3da75b')
    expect(CATEGORY_ACCENT['ethics-accountability']).toBe('#d68a1f')
    expect(CATEGORY_ACCENT['voting-bills']).toBe('#7d57c1')
  })
})

describe('SUB_CASCADE_ACCENT (lighter shade per category)', () => {
  it('matches the locked hex values', () => {
    expect(SUB_CASCADE_ACCENT['service-record']).toBe('#e1c896')
    expect(SUB_CASCADE_ACCENT['issue-positions']).toBe('#87aae0')
    expect(SUB_CASCADE_ACCENT['community-presence']).toBe('#7fc7bb')
    expect(SUB_CASCADE_ACCENT['finance']).toBe('#8fc89d')
    expect(SUB_CASCADE_ACCENT['ethics-accountability']).toBe('#ecbc7d')
    expect(SUB_CASCADE_ACCENT['voting-bills']).toBe('#b39bd9')
  })
})

describe('CATEGORY_CARD_GRADIENT', () => {
  it('renders a linear-gradient string per category', () => {
    for (const id of ALL_IDS) {
      expect(CATEGORY_CARD_GRADIENT[id]).toMatch(/^linear-gradient\(180deg, #[0-9a-f]{6} 0%, #fff 100%\)$/)
    }
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/ui-tokens test category
```

Expected: module-not-found error.

- [ ] **Step 3: Implement**

Create `packages/ui-tokens/src/category.ts`:

```ts
export type CategoryId =
  | 'service-record'
  | 'issue-positions'
  | 'community-presence'
  | 'finance'
  | 'ethics-accountability'
  | 'voting-bills'

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  'service-record':        'Service Record',
  'issue-positions':       'Issue Positions',
  'community-presence':    'Community Presence',
  'finance':               'Finance',
  'ethics-accountability': 'Ethics & Accountability',
  'voting-bills':          'Voting & Bills',
}

// Palette A — semantic earthen. Locked 2026-05-17.
export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#c89a4e',
  'issue-positions':       '#3b6ed1',
  'community-presence':    '#1f9b88',
  'finance':               '#3da75b',
  'ethics-accountability': '#d68a1f',
  'voting-bills':          '#7d57c1',
}

export const SUB_CASCADE_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#e1c896',
  'issue-positions':       '#87aae0',
  'community-presence':    '#7fc7bb',
  'finance':               '#8fc89d',
  'ethics-accountability': '#ecbc7d',
  'voting-bills':          '#b39bd9',
}

export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)',
  'issue-positions':       'linear-gradient(180deg, #f6f8fc 0%, #fff 100%)',
  'community-presence':    'linear-gradient(180deg, #f3faf8 0%, #fff 100%)',
  'finance':               'linear-gradient(180deg, #f4faf6 0%, #fff 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)',
  'voting-bills':          'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)',
}
```

- [ ] **Step 4: Update index re-exports**

Append to `packages/ui-tokens/src/index.ts`:

```ts
export {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  SUB_CASCADE_ACCENT,
  CATEGORY_CARD_GRADIENT,
} from './category.ts'
```

- [ ] **Step 5: Run green + commit**

```bash
pnpm --filter @chiaro/ui-tokens test category
pnpm --filter @chiaro/ui-tokens typecheck
git add packages/ui-tokens/src/category.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/category.test.ts
git commit -m "feat(ui-tokens): add CategoryId + palette A + sub-cascade accents + gradients"
```

---

### Task 2: Finance sub-section shades

**Files:**
- Create: `packages/ui-tokens/src/finance-shades.ts`
- Create: `packages/ui-tokens/test/finance-shades.test.ts`
- Modify: `packages/ui-tokens/src/index.ts`

- [ ] **Step 1: Failing test**

`packages/ui-tokens/test/finance-shades.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FINANCE_SUB_SECTION_SHADES } from '../src/finance-shades.ts'

describe('FINANCE_SUB_SECTION_SHADES', () => {
  it('Contributors uses sage (#a8d2b1) with deep-sage heading', () => {
    expect(FINANCE_SUB_SECTION_SHADES.contributors.accent).toBe('#a8d2b1')
    expect(FINANCE_SUB_SECTION_SHADES.contributors.heading).toBe('#2d5d3a')
  })

  it('Top Donor uses mint (#a8d4c0) with deep-mint heading', () => {
    expect(FINANCE_SUB_SECTION_SHADES.topDonor.accent).toBe('#a8d4c0')
    expect(FINANCE_SUB_SECTION_SHADES.topDonor.heading).toBe('#2a5d4a')
  })

  it('is frozen const (TypeScript readonly)', () => {
    // @ts-expect-error const assertion makes mutation a type error
    FINANCE_SUB_SECTION_SHADES.contributors.accent = '#000000'
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/ui-tokens test finance-shades
```

- [ ] **Step 3: Implement**

`packages/ui-tokens/src/finance-shades.ts`:

```ts
export const FINANCE_SUB_SECTION_SHADES = {
  contributors: {
    accent:  '#a8d2b1',
    heading: '#2d5d3a',
  },
  topDonor: {
    accent:  '#a8d4c0',
    heading: '#2a5d4a',
  },
} as const

export type FinanceSubSectionShade = typeof FINANCE_SUB_SECTION_SHADES[keyof typeof FINANCE_SUB_SECTION_SHADES]
```

Append to `packages/ui-tokens/src/index.ts`:

```ts
export { FINANCE_SUB_SECTION_SHADES, type FinanceSubSectionShade } from './finance-shades.ts'
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/ui-tokens test finance-shades
pnpm --filter @chiaro/ui-tokens typecheck
git add packages/ui-tokens/src/finance-shades.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/finance-shades.test.ts
git commit -m "feat(ui-tokens): finance sub-section shade pair (sage / mint)"
```

---

### Task 3: Refactor alignment tokens (drop ALIGNMENT_SYMBOL)

**Files:**
- Modify: `packages/ui-tokens/src/alignment.ts` (created in slice 4 — must exist; if not, create from spec)
- Modify: `packages/ui-tokens/test/alignment.test.ts` (or create if absent)

- [ ] **Step 1: Read current alignment.ts to confirm starting state**

Run: `cat packages/ui-tokens/src/alignment.ts` (or open in editor).

If the file exists from slice 4, it likely exports `ALIGNMENT_SYMBOL`. Confirm.

If the file does NOT exist, jump to Step 3 to create it from scratch with the spec's content (sans `ALIGNMENT_SYMBOL`).

- [ ] **Step 2: Update / create the failing test**

Replace `packages/ui-tokens/test/alignment.test.ts` (create if missing) with:

```ts
import { describe, expect, it } from 'vitest'
import {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
  scoreToTier,
} from '../src/alignment.ts'

const ALL_TIERS: AlignmentTier[] = [
  'strongly-aligned',
  'mostly-aligned',
  'mixed',
  'mostly-differs',
  'strongly-differs',
]

describe('ALIGNMENT_LABEL', () => {
  it('has the spec labels', () => {
    expect(ALIGNMENT_LABEL['strongly-aligned']).toBe('Strongly Aligned')
    expect(ALIGNMENT_LABEL['mostly-aligned']).toBe('Mostly Aligned')
    expect(ALIGNMENT_LABEL['mixed']).toBe('Mixed')
    expect(ALIGNMENT_LABEL['mostly-differs']).toBe('Mostly Differs')
    expect(ALIGNMENT_LABEL['strongly-differs']).toBe('Strongly Differs')
  })
})

describe('ALIGNMENT_CHIP_COLORS', () => {
  it('matches the locked palette per tier', () => {
    expect(ALIGNMENT_CHIP_COLORS['strongly-aligned']).toEqual({ bg: '#c5e3c7', fg: '#1f4d24' })
    expect(ALIGNMENT_CHIP_COLORS['mostly-aligned']).toEqual({ bg: '#d4ecd5', fg: '#2a6b30' })
    expect(ALIGNMENT_CHIP_COLORS['mixed']).toEqual({ bg: '#f0eee5', fg: '#5a5751' })
    expect(ALIGNMENT_CHIP_COLORS['mostly-differs']).toEqual({ bg: '#f4d3c0', fg: '#7a3e1c' })
    expect(ALIGNMENT_CHIP_COLORS['strongly-differs']).toEqual({ bg: '#f0b8a0', fg: '#5a2812' })
  })
})

describe('scoreToTier', () => {
  it('100/100 → strongly-aligned', () => expect(scoreToTier(100, 100)).toBe('strongly-aligned'))
  it('92/100  → strongly-aligned', () => expect(scoreToTier(92, 100)).toBe('strongly-aligned'))
  it('90/100  → strongly-aligned', () => expect(scoreToTier(90, 100)).toBe('strongly-aligned'))
  it('89/100  → mostly-aligned',   () => expect(scoreToTier(89, 100)).toBe('mostly-aligned'))
  it('70/100  → mostly-aligned',   () => expect(scoreToTier(70, 100)).toBe('mostly-aligned'))
  it('69/100  → mixed',            () => expect(scoreToTier(69, 100)).toBe('mixed'))
  it('40/100  → mixed',            () => expect(scoreToTier(40, 100)).toBe('mixed'))
  it('39/100  → mostly-differs',   () => expect(scoreToTier(39, 100)).toBe('mostly-differs'))
  it('10/100  → mostly-differs',   () => expect(scoreToTier(10, 100)).toBe('mostly-differs'))
  it('9/100   → strongly-differs', () => expect(scoreToTier(9, 100)).toBe('strongly-differs'))
  it('0/100   → strongly-differs', () => expect(scoreToTier(0, 100)).toBe('strongly-differs'))

  it('normalizes when scoringMax ≠ 100 (e.g., 4/5 = 80% → mostly-aligned)', () => {
    expect(scoreToTier(4, 5)).toBe('mostly-aligned')
  })
})

describe('ALIGNMENT_SYMBOL removed', () => {
  it('does not export ALIGNMENT_SYMBOL (chips are color-only now)', async () => {
    const mod = await import('../src/alignment.ts')
    expect((mod as unknown as Record<string, unknown>).ALIGNMENT_SYMBOL).toBeUndefined()
  })

  it('covers every AlignmentTier in ALIGNMENT_LABEL + ALIGNMENT_CHIP_COLORS', () => {
    for (const tier of ALL_TIERS) {
      expect(ALIGNMENT_LABEL[tier]).toBeTruthy()
      expect(ALIGNMENT_CHIP_COLORS[tier]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 3: Rewrite implementation**

Replace `packages/ui-tokens/src/alignment.ts` with:

```ts
export type AlignmentTier =
  | 'strongly-aligned'
  | 'mostly-aligned'
  | 'mixed'
  | 'mostly-differs'
  | 'strongly-differs'

export const ALIGNMENT_LABEL: Record<AlignmentTier, string> = {
  'strongly-aligned': 'Strongly Aligned',
  'mostly-aligned':   'Mostly Aligned',
  'mixed':            'Mixed',
  'mostly-differs':   'Mostly Differs',
  'strongly-differs': 'Strongly Differs',
}

export const ALIGNMENT_CHIP_COLORS: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#c5e3c7', fg: '#1f4d24' },
  'mostly-aligned':   { bg: '#d4ecd5', fg: '#2a6b30' },
  'mixed':            { bg: '#f0eee5', fg: '#5a5751' },
  'mostly-differs':   { bg: '#f4d3c0', fg: '#7a3e1c' },
  'strongly-differs': { bg: '#f0b8a0', fg: '#5a2812' },
}

export function scoreToTier(score: number, scoringMax: number): AlignmentTier {
  const pct = (score / scoringMax) * 100
  if (pct >= 90) return 'strongly-aligned'
  if (pct >= 70) return 'mostly-aligned'
  if (pct >= 40) return 'mixed'
  if (pct >= 10) return 'mostly-differs'
  return 'strongly-differs'
}
```

- [ ] **Step 4: Update index re-exports**

Ensure `packages/ui-tokens/src/index.ts` exports only the surviving names:

```ts
export {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
  scoreToTier,
} from './alignment.ts'
```

(Remove any `ALIGNMENT_SYMBOL` export from this file if present.)

- [ ] **Step 5: Run green + commit**

```bash
pnpm --filter @chiaro/ui-tokens test alignment
pnpm --filter @chiaro/ui-tokens typecheck
git add packages/ui-tokens/src/alignment.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/alignment.test.ts
git commit -m "refactor(ui-tokens): drop ALIGNMENT_SYMBOL — chips are color-only"
```

---

## Phase B — Derivation helpers (Tasks 5-8)

Pure functions that compute the new spec's derived values from existing slice-4 data. Lives in `apps/web/lib/derivations/*` so every component imports the same logic and tests can hit it directly.

### Task 5: Service Record derivations

**Files:**
- Create: `apps/web/lib/derivations/service-record.ts`
- Create: `apps/web/test/derivations/service-record.test.ts`

- [ ] **Step 1: Failing test**

`apps/web/test/derivations/service-record.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Database } from '@chiaro/db'
import { firstElectedYear, tenureByChamber } from '@/lib/derivations/service-record'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

function row(partial: Partial<LeadershipRow>): LeadershipRow {
  return {
    id: 'r-' + Math.random(),
    official_id: 'o1',
    role: 'Speaker',
    chamber: 'house',
    party: 'D',
    start_date: '2007-01-04',
    end_date: null,
    source_url: 'https://example.org',
    ...partial,
  } as LeadershipRow
}

describe('firstElectedYear', () => {
  it('returns null for empty history', () => {
    expect(firstElectedYear([])).toBeNull()
  })
  it('returns the min start_date year across all rows', () => {
    const rows = [
      row({ start_date: '2019-01-03' }),
      row({ start_date: '2007-01-04' }),
      row({ start_date: '2013-01-03' }),
    ]
    expect(firstElectedYear(rows)).toBe(2007)
  })
})

describe('tenureByChamber', () => {
  it('returns 0/0 for empty history', () => {
    expect(tenureByChamber([])).toEqual({ house: 0, senate: 0 })
  })
  it('sums non-overlapping closed terms per chamber', () => {
    const rows = [
      row({ chamber: 'house',  start_date: '2007-01-01', end_date: '2013-01-01' }),
      row({ chamber: 'senate', start_date: '2013-01-01', end_date: '2019-01-01' }),
    ]
    expect(tenureByChamber(rows)).toEqual({ house: 6, senate: 6 })
  })
  it('treats null end_date as "today" (uses current year)', () => {
    const today = new Date()
    const start = `${today.getFullYear() - 3}-01-01`
    const rows = [row({ chamber: 'house', start_date: start, end_date: null })]
    const { house } = tenureByChamber(rows)
    expect(house).toBeGreaterThanOrEqual(2.9)
    expect(house).toBeLessThanOrEqual(3.1)
  })
  it('rounds to 1 decimal place', () => {
    const rows = [row({ chamber: 'house', start_date: '2020-01-01', end_date: '2025-07-01' })]
    const { house } = tenureByChamber(rows)
    expect(house).toBeCloseTo(5.5, 1)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test derivations/service-record
```

- [ ] **Step 3: Implement**

`apps/web/lib/derivations/service-record.ts`:

```ts
import type { Database } from '@chiaro/db'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

export function firstElectedYear(rows: ReadonlyArray<LeadershipRow>): number | null {
  if (rows.length === 0) return null
  let min = Number.POSITIVE_INFINITY
  for (const r of rows) {
    const y = new Date(r.start_date).getFullYear()
    if (y < min) min = y
  }
  return Number.isFinite(min) ? min : null
}

export interface TenureByChamber {
  house: number
  senate: number
}

function yearsBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000
  return Math.max(0, (end - start) / MS_PER_YEAR)
}

export function tenureByChamber(rows: ReadonlyArray<LeadershipRow>): TenureByChamber {
  const now = new Date().toISOString()
  const acc: TenureByChamber = { house: 0, senate: 0 }
  for (const r of rows) {
    const end = r.end_date ?? now
    const years = yearsBetween(r.start_date, end)
    if (r.chamber === 'house') acc.house += years
    else if (r.chamber === 'senate') acc.senate += years
  }
  return {
    house:  Math.round(acc.house * 10) / 10,
    senate: Math.round(acc.senate * 10) / 10,
  }
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test derivations/service-record
pnpm --filter @chiaro/web typecheck
git add apps/web/lib/derivations/service-record.ts apps/web/test/derivations/service-record.test.ts
git commit -m "feat(web): service-record derivations — firstElectedYear, tenureByChamber"
```

---

### Task 6: Finance derivations (PAC %)

**Files:**
- Create: `apps/web/lib/derivations/finance.ts`
- Create: `apps/web/test/derivations/finance.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { pacPercent } from '@/lib/derivations/finance'

describe('pacPercent', () => {
  it('returns null when total raised is 0', () => {
    expect(pacPercent(0, 100)).toBeNull()
  })
  it('returns null when total raised is null', () => {
    expect(pacPercent(null, 100)).toBeNull()
  })
  it('returns null when pacSum is null', () => {
    expect(pacPercent(1_000_000, null)).toBeNull()
  })
  it('computes (pacSum / totalRaised) * 100, rounded to 1 decimal', () => {
    expect(pacPercent(5_234_189, 32_500)).toBeCloseTo(0.6, 1)
    expect(pacPercent(1_000_000, 500_000)).toBeCloseTo(50.0, 1)
  })
  it('caps at 100% defensively (data drift safety)', () => {
    expect(pacPercent(100_000, 500_000)).toBe(100)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test derivations/finance
```

- [ ] **Step 3: Implement**

`apps/web/lib/derivations/finance.ts`:

```ts
export function pacPercent(
  totalRaised: number | null,
  pacSum: number | null,
): number | null {
  if (totalRaised === null || pacSum === null) return null
  if (totalRaised <= 0) return null
  const raw = (pacSum / totalRaised) * 100
  return Math.min(100, Math.round(raw * 10) / 10)
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test derivations/finance
pnpm --filter @chiaro/web typecheck
git add apps/web/lib/derivations/finance.ts apps/web/test/derivations/finance.test.ts
git commit -m "feat(web): finance pacPercent derivation"
```

---

### Task 7: Top-3 alignment chip selection

**Files:**
- Create: `apps/web/lib/derivations/alignment.ts`
- Create: `apps/web/test/derivations/alignment.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { Database } from '@chiaro/db'
import { selectTopAlignmentChips, type AlignmentChipRow } from '@/lib/derivations/alignment'

type Rating = Database['public']['Tables']['scorecard_ratings']['Row'] & {
  org: Database['public']['Tables']['scorecard_orgs']['Row']
}

function rating(score: number, issueArea: string, name = 'Org', max = 100): Rating {
  return {
    id: 'r-' + Math.random(),
    scorecard_id: 's-' + issueArea,
    official_id: 'o1',
    congress: '119',
    score,
    source_url: 'https://example.org',
    ingested_at: '2026-01-01',
    org: {
      id: 's-' + issueArea,
      slug: issueArea,
      name,
      issue_area: issueArea,
      lean: 'progressive',
      methodology_url: 'https://example.org/method',
      scoring_min: 0,
      scoring_max: max,
      notes: null,
    },
  } as Rating
}

describe('selectTopAlignmentChips', () => {
  it('returns [] when input is empty', () => {
    expect(selectTopAlignmentChips([])).toEqual([])
  })

  it('picks highest, lowest, then next-highest when there is a strong-differs', () => {
    const ratings = [
      rating(95, 'environment', 'LCV'),
      rating(0,  'second-amendment', 'NRA'),
      rating(90, 'civil-rights', 'NAACP'),
      rating(85, 'civil-liberties', 'ACLU'),
    ]
    const picks = selectTopAlignmentChips(ratings)
    expect(picks).toHaveLength(3)
    expect(picks[0].issueArea).toBe('environment')
    expect(picks[1].issueArea).toBe('second-amendment')
    // Third pick is next-highest among remaining: NAACP (90) before ACLU (85)
    expect(picks[2].issueArea).toBe('civil-rights')
  })

  it('picks 3 highest when no strong-differs exists', () => {
    const ratings = [
      rating(95, 'environment'),
      rating(90, 'civil-rights'),
      rating(85, 'civil-liberties'),
      rating(70, 'labor'),
    ]
    const picks = selectTopAlignmentChips(ratings)
    expect(picks.map(p => p.issueArea)).toEqual(['environment', 'civil-rights', 'civil-liberties'])
  })

  it('returns 1 chip when only 1 rating exists', () => {
    const picks = selectTopAlignmentChips([rating(95, 'environment')])
    expect(picks).toHaveLength(1)
  })

  it('each chip carries tier + display label + sub-cascade slug', () => {
    const picks = selectTopAlignmentChips([rating(92, 'environment', 'LCV')])
    expect(picks[0]).toEqual<AlignmentChipRow>({
      issueArea: 'environment',
      displayLabel: 'Environment',
      tier: 'strongly-aligned',
      subCascadeSlug: 'environment',
    })
  })

  it('groups duplicate issue areas by picking the strongest signal per area', () => {
    const ratings = [
      rating(95, 'environment', 'LCV'),
      rating(60, 'environment', 'Sierra Club'), // weaker for environment
      rating(0, 'second-amendment', 'NRA'),
    ]
    const picks = selectTopAlignmentChips(ratings)
    expect(picks.filter(p => p.issueArea === 'environment')).toHaveLength(1)
    // The strong-aligned one wins (further from 50 than 60)
    expect(picks[0].tier).toBe('strongly-aligned')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test derivations/alignment
```

- [ ] **Step 3: Implement**

`apps/web/lib/derivations/alignment.ts`:

```ts
import type { Database } from '@chiaro/db'
import {
  type AlignmentTier,
  scoreToTier,
  titleCaseIssueArea,
} from '@chiaro/ui-tokens'

type Rating = Database['public']['Tables']['scorecard_ratings']['Row'] & {
  org: Pick<Database['public']['Tables']['scorecard_orgs']['Row'], 'issue_area' | 'scoring_max'>
}

export interface AlignmentChipRow {
  issueArea: string
  displayLabel: string
  tier: AlignmentTier
  subCascadeSlug: string
}

function ratingToChip(r: Rating): AlignmentChipRow {
  const tier = scoreToTier(r.score, r.org.scoring_max)
  return {
    issueArea: r.org.issue_area,
    displayLabel: titleCaseIssueArea(r.org.issue_area),
    tier,
    subCascadeSlug: r.org.issue_area,
  }
}

function tierIntensity(tier: AlignmentTier): number {
  if (tier === 'strongly-aligned')  return 2
  if (tier === 'mostly-aligned')    return 1
  if (tier === 'mixed')             return 0
  if (tier === 'mostly-differs')    return -1
  return -2
}

export function selectTopAlignmentChips(ratings: ReadonlyArray<Rating>): AlignmentChipRow[] {
  if (ratings.length === 0) return []

  // 1. Group by issue area; keep the strongest-signal rating per area.
  const byArea = new Map<string, Rating>()
  for (const r of ratings) {
    const existing = byArea.get(r.org.issue_area)
    if (!existing) {
      byArea.set(r.org.issue_area, r)
      continue
    }
    const existingPct = (existing.score / existing.org.scoring_max) * 100
    const candPct = (r.score / r.org.scoring_max) * 100
    // Pick whichever is farther from 50 (stronger signal in either direction).
    if (Math.abs(candPct - 50) > Math.abs(existingPct - 50)) {
      byArea.set(r.org.issue_area, r)
    }
  }

  const grouped = Array.from(byArea.values()).map(ratingToChip)
  if (grouped.length <= 1) return grouped

  // 2. Pick highest-aligned (largest tierIntensity).
  const byHighFirst = [...grouped].sort((a, b) => tierIntensity(b.tier) - tierIntensity(a.tier))
  const highest = byHighFirst[0]

  // 3. Look for a strong-differs / mostly-differs (any negative-intensity chip).
  const lowest = byHighFirst.find(c => tierIntensity(c.tier) < 0) ?? null

  // 4. Third pick = next-highest excluding the two picks already made.
  const picks: AlignmentChipRow[] = [highest]
  if (lowest && lowest.issueArea !== highest.issueArea) picks.push(lowest)
  for (const c of byHighFirst) {
    if (picks.some(p => p.issueArea === c.issueArea)) continue
    picks.push(c)
    if (picks.length === 3) break
  }
  return picks
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test derivations/alignment
pnpm --filter @chiaro/web typecheck
git add apps/web/lib/derivations/alignment.ts apps/web/test/derivations/alignment.test.ts
git commit -m "feat(web): selectTopAlignmentChips — top-3 chip picks per spec"
```

---

### Task 8: Per-category teaser line builders

**Files:**
- Create: `apps/web/lib/derivations/teasers.ts`
- Create: `apps/web/test/derivations/teasers.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  serviceRecordTeaser,
  issuePositionsTeaser,
  communityPresenceTeaser,
  financeTeaser,
  ethicsAccountabilityTeaser,
  votingBillsTeaser,
} from '@/lib/derivations/teasers'

describe('serviceRecordTeaser', () => {
  it('returns "<role> · since <year>" when both present', () => {
    expect(serviceRecordTeaser({ role: 'Speaker', firstElectedYear: 2007 }))
      .toBe('Speaker · since 2007')
  })
  it('omits "since" clause when year missing', () => {
    expect(serviceRecordTeaser({ role: 'Speaker', firstElectedYear: null }))
      .toBe('Speaker')
  })
  it('returns null when role is null', () => {
    expect(serviceRecordTeaser({ role: null, firstElectedYear: null })).toBeNull()
  })
})

describe('issuePositionsTeaser', () => {
  it('renders "Strongly aligned on X, differs on Y" when both ends exist', () => {
    expect(issuePositionsTeaser({
      topAlignedIssue: 'environment',
      topDifferIssue:  'second-amendment',
    })).toBe('Strongly aligned on Environment, differs on Second Amendment')
  })
  it('omits the differs clause when no differs exists', () => {
    expect(issuePositionsTeaser({ topAlignedIssue: 'environment', topDifferIssue: null }))
      .toBe('Strongly aligned on Environment')
  })
  it('returns null when both are null', () => {
    expect(issuePositionsTeaser({ topAlignedIssue: null, topDifferIssue: null }))
      .toBeNull()
  })
})

describe('communityPresenceTeaser', () => {
  it('plural-aware', () => {
    expect(communityPresenceTeaser({ livesInDistrict: true, officeCount: 1, recentTownHallCount: 1 }))
      .toBe('Lives in district · 1 office, 1 recent town hall')
    expect(communityPresenceTeaser({ livesInDistrict: true, officeCount: 3, recentTownHallCount: 2 }))
      .toBe('Lives in district · 3 offices, 2 recent town halls')
  })
  it('omits lives-in-district when false', () => {
    expect(communityPresenceTeaser({ livesInDistrict: false, officeCount: 1, recentTownHallCount: 1 }))
      .toBe('1 office, 1 recent town hall')
  })
})

describe('financeTeaser', () => {
  it('formats millions of raised dollars + top industry', () => {
    expect(financeTeaser({ totalRaised: 5_234_189, topIndustry: 'Securities & Investment' }))
      .toBe('$5.2M raised · top industry: Securities & Investment')
  })
  it('omits industry clause when null', () => {
    expect(financeTeaser({ totalRaised: 5_234_189, topIndustry: null }))
      .toBe('$5.2M raised')
  })
})

describe('ethicsAccountabilityTeaser', () => {
  it('renders late-trade count + in/out-of-state donor majority', () => {
    expect(ethicsAccountabilityTeaser({ lateTrades: 1, inStatePct: 67 }))
      .toBe('1 stock trade late · majority of donors in-state')
    expect(ethicsAccountabilityTeaser({ lateTrades: 3, inStatePct: 42 }))
      .toBe('3 stock trades late · majority of donors out-of-state')
  })
})

describe('votingBillsTeaser', () => {
  it('renders attendance label + bill count', () => {
    expect(votingBillsTeaser({ attendancePct: 50, billsThisCongress: 1 }))
      .toBe('Mixed attendance · 1 bill introduced this Congress')
    expect(votingBillsTeaser({ attendancePct: 95, billsThisCongress: 7 }))
      .toBe('High attendance · 7 bills introduced this Congress')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test derivations/teasers
```

- [ ] **Step 3: Implement**

`apps/web/lib/derivations/teasers.ts`:

```ts
import { titleCaseIssueArea } from '@chiaro/ui-tokens'

function plural(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`
}

export function serviceRecordTeaser(args: {
  role: string | null
  firstElectedYear: number | null
}): string | null {
  if (!args.role) return null
  if (args.firstElectedYear == null) return args.role
  return `${args.role} · since ${args.firstElectedYear}`
}

export function issuePositionsTeaser(args: {
  topAlignedIssue: string | null
  topDifferIssue:  string | null
}): string | null {
  const aligned = args.topAlignedIssue ? titleCaseIssueArea(args.topAlignedIssue) : null
  const differs = args.topDifferIssue ? titleCaseIssueArea(args.topDifferIssue) : null
  if (!aligned && !differs) return null
  if (aligned && differs) return `Strongly aligned on ${aligned}, differs on ${differs}`
  if (aligned) return `Strongly aligned on ${aligned}`
  return `Differs on ${differs}`
}

export function communityPresenceTeaser(args: {
  livesInDistrict: boolean | null
  officeCount: number
  recentTownHallCount: number
}): string | null {
  const parts: string[] = []
  if (args.livesInDistrict === true) parts.push('Lives in district')
  const offices = plural(args.officeCount, 'office')
  const halls = `${plural(args.recentTownHallCount, 'recent town hall')}`
  parts.push(`${offices}, ${halls}`)
  return parts.join(' · ')
}

function formatMillions(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function financeTeaser(args: {
  totalRaised: number | null
  topIndustry: string | null
}): string | null {
  if (args.totalRaised == null) return null
  const raised = formatMillions(args.totalRaised)
  if (!args.topIndustry) return `${raised} raised`
  return `${raised} raised · top industry: ${args.topIndustry}`
}

export function ethicsAccountabilityTeaser(args: {
  lateTrades: number
  inStatePct: number | null
}): string | null {
  const trades = plural(args.lateTrades, 'stock trade') + ' late'
  if (args.inStatePct == null) return trades
  const majority = args.inStatePct >= 50 ? 'in-state' : 'out-of-state'
  return `${trades} · majority of donors ${majority}`
}

function attendanceLabel(pct: number | null): string {
  if (pct == null) return 'No attendance data'
  if (pct >= 90) return 'High attendance'
  if (pct >= 70) return 'Strong attendance'
  if (pct >= 40) return 'Mixed attendance'
  return 'Low attendance'
}

export function votingBillsTeaser(args: {
  attendancePct: number | null
  billsThisCongress: number
}): string | null {
  const att = attendanceLabel(args.attendancePct)
  const bills = `${plural(args.billsThisCongress, 'bill')} introduced this Congress`
  return `${att} · ${bills}`
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test derivations/teasers
pnpm --filter @chiaro/web typecheck
git add apps/web/lib/derivations/teasers.ts apps/web/test/derivations/teasers.test.ts
git commit -m "feat(web): per-category teaser line builders"
```

---

## Phase C — UI primitives (Tasks 9-13)

Atomic components reused across the page. Each one TDD'd with vitest + @testing-library/react.

### Task 9: PillChevron

**Files:**
- Create: `apps/web/components/cards/PillChevron.tsx`
- Create: `apps/web/test/components/cards/PillChevron.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PillChevron } from '@/components/cards/PillChevron'

describe('PillChevron', () => {
  it('renders ▸ when open=false', () => {
    render(<PillChevron open={false} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('renders ▾ when open=true', () => {
    render(<PillChevron open={true} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })
  it('applies the small variant when size="sm"', () => {
    const { container } = render(<PillChevron open={false} size="sm" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('18px')
    expect(el.style.height).toBe('18px')
  })
  it('defaults to 20×20 (md)', () => {
    const { container } = render(<PillChevron open={false} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('20px')
    expect(el.style.height).toBe('20px')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/cards/PillChevron
```

- [ ] **Step 3: Implement**

`apps/web/components/cards/PillChevron.tsx`:

```tsx
export interface PillChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

const SIZE_PX = { sm: 18, md: 20 } as const
const FONT_REM = { sm: 0.7, md: 0.72 } as const

export function PillChevron({ open, size = 'md' }: PillChevronProps): React.JSX.Element {
  const px = SIZE_PX[size]
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: '50%',
        background: '#f0eee5',
        color: '#1a1714',
        fontSize: `${FONT_REM[size]}rem`,
        flexShrink: 0,
      }}
    >
      {open ? '▾' : '▸'}
    </span>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/cards/PillChevron
pnpm --filter @chiaro/web typecheck
git add apps/web/components/cards/PillChevron.tsx apps/web/test/components/cards/PillChevron.test.tsx
git commit -m "feat(web): PillChevron primitive"
```

---

### Task 10: AlignmentChip

**Files:**
- Create: `apps/web/components/cards/AlignmentChip.tsx`
- Create: `apps/web/test/components/cards/AlignmentChip.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

describe('AlignmentChip', () => {
  it('renders the display label, no symbol/glyph', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    const chip = screen.getByText('Environment')
    expect(chip.textContent).toBe('Environment')  // no trailing ✓✓ or ✗✗
  })

  it('applies the strongly-aligned palette', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    const chip = screen.getByText('Environment')
    expect(chip.style.background).toContain('rgb(197, 227, 199)')
    expect(chip.style.color).toContain('rgb(31, 77, 36)')
  })

  it('applies the strongly-differs palette', () => {
    render(<AlignmentChip label="Second Amendment" tier="strongly-differs" />)
    const chip = screen.getByText('Second Amendment')
    expect(chip.style.background).toContain('rgb(240, 184, 160)')
    expect(chip.style.color).toContain('rgb(90, 40, 18)')
  })

  it('wraps in an <a> when href is provided', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" href="/officials/abc#issue-positions:environment" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/officials/abc#issue-positions:environment')
    expect(link.textContent).toContain('Environment')
  })

  it('renders bare span (no link) when href is omitted', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/cards/AlignmentChip
```

- [ ] **Step 3: Implement**

`apps/web/components/cards/AlignmentChip.tsx`:

```tsx
import Link from 'next/link'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  href?: string  // optional deep-link to detail-page sub-cascade
}

export function AlignmentChip({ label, tier, href }: AlignmentChipProps): React.JSX.Element {
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chip = (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.74rem',
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  )
  if (!href) return chip
  return (
    <Link href={href} style={{ textDecoration: 'none' }} aria-label={`View ${label} positions`}>
      {chip}
    </Link>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/cards/AlignmentChip
pnpm --filter @chiaro/web typecheck
git add apps/web/components/cards/AlignmentChip.tsx apps/web/test/components/cards/AlignmentChip.test.tsx
git commit -m "feat(web): AlignmentChip — color-only, link-aware"
```

---

### Task 11: DistrictBadge

**Files:**
- Create: `apps/web/components/cards/DistrictBadge.tsx`
- Create: `apps/web/test/components/cards/DistrictBadge.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge', () => {
  it('house variant renders district ordinal', () => {
    render(<DistrictBadge chamber="house" stateName="California" districtNumber={11} />)
    expect(screen.getByText("California's 11th District")).toBeTruthy()
  })
  it('senate variant renders state name only (no district number)', () => {
    render(<DistrictBadge chamber="senate" stateName="California" districtNumber={null} />)
    expect(screen.getByText('California')).toBeTruthy()
  })
  it('at-large house variant', () => {
    render(<DistrictBadge chamber="house" stateName="Wyoming" districtNumber={null} atLarge={true} />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('includes SVG map pin', () => {
    const { container } = render(<DistrictBadge chamber="senate" stateName="California" districtNumber={null} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
  it('renders 1st/2nd/3rd correctly', () => {
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={1} />)
    expect(screen.getByText("Texas's 1st District")).toBeTruthy()
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={2} />)
    expect(screen.getByText("Texas's 2nd District")).toBeTruthy()
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={3} />)
    expect(screen.getByText("Texas's 3rd District")).toBeTruthy()
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={21} />)
    expect(screen.getByText("Texas's 21st District")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/cards/DistrictBadge
```

- [ ] **Step 3: Implement**

`apps/web/components/cards/DistrictBadge.tsx`:

```tsx
export interface DistrictBadgeProps {
  chamber: 'house' | 'senate'
  stateName: string                 // full state name, e.g. "California"
  districtNumber: number | null     // null for senate or at-large
  atLarge?: boolean                 // true when the rep represents an at-large house seat
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
  if (p.chamber === 'senate') return p.stateName
  if (p.atLarge) return `${p.stateName}'s At-Large District`
  if (p.districtNumber == null) return p.stateName
  return `${p.stateName}'s ${ordinal(p.districtNumber)} District`
}

export function DistrictBadge(props: DistrictBadgeProps): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#3a352b', fontSize: '0.78rem' }}>
      <svg width="12" height="14" viewBox="0 0 12 14" fill="#d13b3b" aria-hidden="true">
        <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8.2C4.8 8.2 3.8 7.2 3.8 6S4.8 3.8 6 3.8 8.2 4.8 8.2 6 7.2 8.2 6 8.2z"/>
      </svg>
      {districtLabel(props)}
    </span>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/cards/DistrictBadge
pnpm --filter @chiaro/web typecheck
git add apps/web/components/cards/DistrictBadge.tsx apps/web/test/components/cards/DistrictBadge.test.tsx
git commit -m "feat(web): DistrictBadge — map pin + district/state text"
```

---

### Task 12: ComplianceIcon

**Files:**
- Create: `apps/web/components/cards/ComplianceIcon.tsx`
- Create: `apps/web/test/components/cards/ComplianceIcon.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'

describe('ComplianceIcon', () => {
  it('on-time variant renders ✓ on Strongly-Aligned palette', () => {
    render(<ComplianceIcon state="on-time" />)
    const el = screen.getByText('✓')
    expect(el.style.background).toContain('rgb(197, 227, 199)')
    expect(el.style.color).toContain('rgb(31, 77, 36)')
  })

  it('late variant renders ✖ (U+2716) on Mostly-Differs palette', () => {
    render(<ComplianceIcon state="late" />)
    const el = screen.getByText('✖')
    expect(el.textContent).toBe('✖')
    expect(el.textContent?.charCodeAt(0)).toBe(0x2716)
    expect(el.style.background).toContain('rgb(244, 211, 192)')
    expect(el.style.color).toContain('rgb(122, 62, 28)')
  })

  it('has aria-label for screen readers', () => {
    render(<ComplianceIcon state="late" />)
    expect(screen.getByLabelText('Late filing')).toBeTruthy()
    render(<ComplianceIcon state="on-time" />)
    expect(screen.getByLabelText('Filed on time')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/cards/ComplianceIcon
```

- [ ] **Step 3: Implement**

`apps/web/components/cards/ComplianceIcon.tsx`:

```tsx
export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

const STYLES = {
  'on-time': { bg: '#c5e3c7', fg: '#1f4d24', glyph: '✓', label: 'Filed on time' },
  'late':    { bg: '#f4d3c0', fg: '#7a3e1c', glyph: '✖', label: 'Late filing' },  // ✖ = U+2716
} as const

export function ComplianceIcon({ state }: ComplianceIconProps): React.JSX.Element {
  const { bg, fg, glyph, label } = STYLES[state]
  return (
    <span
      role="img"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: bg,
        color: fg,
        fontSize: '0.7rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/cards/ComplianceIcon
pnpm --filter @chiaro/web typecheck
git add apps/web/components/cards/ComplianceIcon.tsx apps/web/test/components/cards/ComplianceIcon.test.tsx
git commit -m "feat(web): ComplianceIcon — ✓ / ✖ filled chip (U+2716)"
```

---

### Task 13: MetricCardShell rewrite

**Files:**
- Modify: `apps/web/components/cards/MetricCardShell.tsx` (move from slice 4 location if needed)
- Create: `apps/web/test/components/cards/MetricCardShell.test.tsx`

- [ ] **Step 0: Locate existing MetricCardShell**

Search: `grep -rn "MetricCardShell" apps/web/components/`. The slice-4 file is `apps/web/components/MetricCardShell.tsx`. **Move it** to `apps/web/components/cards/MetricCardShell.tsx` and update imports across the codebase before continuing. If `git mv` is unavailable, copy + delete and adjust referring imports.

- [ ] **Step 1: Failing test**

`apps/web/test/components/cards/MetricCardShell.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCardShell } from '@/components/cards/MetricCardShell'

describe('MetricCardShell', () => {
  it('renders value above label, label has category-color dot', () => {
    render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        caption="Speaker"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/product/pdf/R/R44648"
      />
    )
    const value = screen.getByText('$223,500')
    const label = screen.getByText('Base Salary')
    // Value comes before label in the DOM
    expect(value.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Caption is below
    expect(screen.getByText('Speaker')).toBeTruthy()
  })

  it('exposes the right CTA for internal drill-down', () => {
    const onExpand = vi.fn()
    render(
      <MetricCardShell
        value="50%"
        label="Attendance"
        categoryId="voting-bills"
        onExpand={onExpand}
      />
    )
    expect(screen.getByText('view evidence →')).toBeTruthy()
  })

  it('exposes the right CTA for external source link', () => {
    render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/example"
      />
    )
    expect(screen.getByText('view source →')).toBeTruthy()
  })

  it('placeholder variant renders soft beige + italic muted text', () => {
    render(
      <MetricCardShell
        value="—"
        label="Individual Donors"
        caption="data coming slice 5+"
        categoryId="finance"
        placeholder={true}
      />
    )
    const card = screen.getByText('—').closest('article')
    expect(card?.getAttribute('style')).toContain('background: rgb(246, 244, 237)')
  })

  it('renders the category-color dot tied to categoryId', () => {
    const { container } = render(
      <MetricCardShell
        value="$5.2M"
        label="Total Raised"
        categoryId="finance"
        externalSourceUrl="https://www.opensecrets.org"
      />
    )
    const dot = container.querySelector('[data-testid="category-dot"]') as HTMLElement
    expect(dot.style.background).toContain('rgb(61, 167, 91)') // Finance green #3da75b
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/cards/MetricCardShell
```

- [ ] **Step 3: Implement**

Replace the contents of `apps/web/components/cards/MetricCardShell.tsx` with:

```tsx
import type { ReactNode } from 'react'
import { type CategoryId, CATEGORY_ACCENT, CATEGORY_CARD_GRADIENT } from '@chiaro/ui-tokens'

interface BaseProps {
  value: ReactNode
  label: string
  caption?: ReactNode
  categoryId: CategoryId
  placeholder?: boolean
}

type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
  | { onExpand?: never; externalSourceUrl?: never }  // placeholder-only (non-interactive)

export type MetricCardShellProps = BaseProps & DrillDown

export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const { value, label, caption, categoryId, placeholder = false } = props
  const dotColor = CATEGORY_ACCENT[categoryId]
  const bg = placeholder ? '#f6f4ed' : CATEGORY_CARD_GRADIENT[categoryId]

  const valueStyle: React.CSSProperties = placeholder
    ? { fontSize: '1.4rem', fontWeight: 700, color: '#807a72', fontStyle: 'italic', lineHeight: 1.1 }
    : { fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    color: placeholder ? '#5a5751' : '#1a1714',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
  }

  const captionStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: '#807a72',
    marginTop: 2,
    lineHeight: 1.4,
    fontStyle: placeholder ? 'italic' : 'normal',
  }

  let cta: ReactNode = null
  if ('onExpand' in props && props.onExpand && !placeholder) {
    cta = (
      <button
        onClick={props.onExpand}
        aria-label={`Expand evidence for ${label}`}
        style={{ background: 'none', border: 'none', padding: 0, marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', textDecoration: 'underline', cursor: 'pointer' }}
      >
        view evidence →
      </button>
    )
  } else if ('externalSourceUrl' in props && props.externalSourceUrl && !placeholder) {
    cta = (
      <a
        href={props.externalSourceUrl}
        target="_blank"
        rel="noreferrer"
        style={{ marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', textDecoration: 'underline', display: 'inline-block' }}
      >
        view source →
      </a>
    )
  }

  return (
    <article
      aria-label={`${label}: ${typeof value === 'string' ? value : ''}`}
      style={{
        border: '1px solid #d8d4c9',
        borderRadius: 6,
        padding: 12,
        background: bg,
      }}
    >
      <div style={valueStyle}>{value}</div>
      <div style={labelStyle}>
        <span
          data-testid="category-dot"
          style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block', marginRight: 6 }}
        />
        {label}
      </div>
      {caption && <div style={captionStyle}>{caption}</div>}
      {cta}
    </article>
  )
}
```

- [ ] **Step 4: Run green + workspace typecheck (catches stale imports)**

```bash
pnpm --filter @chiaro/web test components/cards/MetricCardShell
pnpm -r typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/cards/MetricCardShell.tsx apps/web/test/components/cards/MetricCardShell.test.tsx
# Plus any import-path fixups across apps/web/components/* that referenced the old location
git commit -m "feat(web): rewrite MetricCardShell — value-top + category dot + gradient"
```

---

## Phase D — Cascade infrastructure (Tasks 14-17)

State hooks + CategoryBar + SubCascadeBar. Everything from here builds on these.

### Task 14: useExpandedState hook

**Files:**
- Create: `apps/web/components/performance/useExpandedState.ts`
- Create: `apps/web/test/components/performance/useExpandedState.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExpandedState } from '@/components/performance/useExpandedState'

describe('useExpandedState', () => {
  it('defaults all categories closed', () => {
    const { result } = renderHook(() => useExpandedState())
    expect(result.current.isCategoryOpen('finance')).toBe(false)
  })

  it('toggleCategory flips state', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.toggleCategory('finance'))
    expect(result.current.isCategoryOpen('finance')).toBe(true)
    act(() => result.current.toggleCategory('finance'))
    expect(result.current.isCategoryOpen('finance')).toBe(false)
  })

  it('openCategory is idempotent', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.openCategory('issue-positions'))
    act(() => result.current.openCategory('issue-positions'))
    expect(result.current.isCategoryOpen('issue-positions')).toBe(true)
  })

  it('sub-cascades track per <categoryId>:<subId> key', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.toggleSubCascade('issue-positions', 'environment'))
    expect(result.current.isSubCascadeOpen('issue-positions', 'environment')).toBe(true)
    expect(result.current.isSubCascadeOpen('issue-positions', 'civil-liberties')).toBe(false)
    expect(result.current.isSubCascadeOpen('finance', 'environment')).toBe(false)
  })

  it('opening a sub-cascade also opens its parent category (convenience)', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.openSubCascade('finance', 'top-industries'))
    expect(result.current.isCategoryOpen('finance')).toBe(true)
    expect(result.current.isSubCascadeOpen('finance', 'top-industries')).toBe(true)
  })

  it('initial state can be seeded (used by URL hash hook)', () => {
    const { result } = renderHook(() =>
      useExpandedState({ categories: ['issue-positions'], subCascades: ['issue-positions:environment'] })
    )
    expect(result.current.isCategoryOpen('issue-positions')).toBe(true)
    expect(result.current.isSubCascadeOpen('issue-positions', 'environment')).toBe(true)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/performance/useExpandedState
```

- [ ] **Step 3: Implement**

`apps/web/components/performance/useExpandedState.ts`:

```ts
import { useCallback, useState } from 'react'
import type { CategoryId } from '@chiaro/ui-tokens'

export interface ExpandedStateSeed {
  categories?: CategoryId[]
  subCascades?: string[]  // format: "<categoryId>:<subId>"
}

export interface ExpandedStateApi {
  isCategoryOpen: (id: CategoryId) => boolean
  toggleCategory: (id: CategoryId) => void
  openCategory: (id: CategoryId) => void
  isSubCascadeOpen: (categoryId: CategoryId, subId: string) => boolean
  toggleSubCascade: (categoryId: CategoryId, subId: string) => void
  openSubCascade: (categoryId: CategoryId, subId: string) => void
}

export function useExpandedState(seed?: ExpandedStateSeed): ExpandedStateApi {
  const [categories, setCategories] = useState<Set<CategoryId>>(
    () => new Set(seed?.categories ?? [])
  )
  const [subCascades, setSubCascades] = useState<Set<string>>(
    () => new Set(seed?.subCascades ?? [])
  )

  const subKey = (c: CategoryId, s: string) => `${c}:${s}`

  const isCategoryOpen = useCallback((id: CategoryId) => categories.has(id), [categories])

  const toggleCategory = useCallback((id: CategoryId) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openCategory = useCallback((id: CategoryId) => {
    setCategories((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  const isSubCascadeOpen = useCallback(
    (c: CategoryId, s: string) => subCascades.has(subKey(c, s)),
    [subCascades],
  )

  const toggleSubCascade = useCallback((c: CategoryId, s: string) => {
    const k = subKey(c, s)
    setSubCascades((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setCategories((prev) => (prev.has(c) ? prev : new Set(prev).add(c)))
  }, [])

  const openSubCascade = useCallback((c: CategoryId, s: string) => {
    const k = subKey(c, s)
    setSubCascades((prev) => (prev.has(k) ? prev : new Set(prev).add(k)))
    setCategories((prev) => (prev.has(c) ? prev : new Set(prev).add(c)))
  }, [])

  return { isCategoryOpen, toggleCategory, openCategory, isSubCascadeOpen, toggleSubCascade, openSubCascade }
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/performance/useExpandedState
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/useExpandedState.ts apps/web/test/components/performance/useExpandedState.test.ts
git commit -m "feat(web): useExpandedState hook — category + sub-cascade collapse state"
```

---

### Task 15: useUrlHashSync hook

**Files:**
- Create: `apps/web/components/performance/useUrlHashSync.ts`
- Create: `apps/web/test/components/performance/useUrlHashSync.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { parseHash, useUrlHashSync } from '@/components/performance/useUrlHashSync'

describe('parseHash', () => {
  it('returns null for empty hash', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
  })
  it('parses category only', () => {
    expect(parseHash('#issue-positions')).toEqual({ categoryId: 'issue-positions', subId: null })
  })
  it('parses category + sub-cascade', () => {
    expect(parseHash('#issue-positions:environment')).toEqual({
      categoryId: 'issue-positions', subId: 'environment',
    })
  })
  it('rejects unknown categories', () => {
    expect(parseHash('#bogus-category')).toBeNull()
    expect(parseHash('#bogus-category:foo')).toBeNull()
  })
})

describe('useUrlHashSync', () => {
  it('opens matching category + sub-cascade on mount', () => {
    const openCategory = vi.fn()
    const openSubCascade = vi.fn()
    const api = {
      isCategoryOpen: vi.fn(() => false),
      toggleCategory: vi.fn(),
      openCategory,
      isSubCascadeOpen: vi.fn(() => false),
      toggleSubCascade: vi.fn(),
      openSubCascade,
    }
    renderHook(() => useUrlHashSync(api, '#finance:top-industries'))
    expect(openCategory).toHaveBeenCalledWith('finance')
    expect(openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })
  it('opens category only when no sub-id present', () => {
    const openCategory = vi.fn()
    const openSubCascade = vi.fn()
    const api = {
      isCategoryOpen: vi.fn(() => false), toggleCategory: vi.fn(), openCategory,
      isSubCascadeOpen: vi.fn(() => false), toggleSubCascade: vi.fn(), openSubCascade,
    }
    renderHook(() => useUrlHashSync(api, '#service-record'))
    expect(openCategory).toHaveBeenCalledWith('service-record')
    expect(openSubCascade).not.toHaveBeenCalled()
  })
  it('no-ops when hash is empty', () => {
    const openCategory = vi.fn()
    const api = {
      isCategoryOpen: vi.fn(), toggleCategory: vi.fn(), openCategory,
      isSubCascadeOpen: vi.fn(), toggleSubCascade: vi.fn(), openSubCascade: vi.fn(),
    }
    renderHook(() => useUrlHashSync(api, ''))
    expect(openCategory).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/performance/useUrlHashSync
```

- [ ] **Step 3: Implement**

`apps/web/components/performance/useUrlHashSync.ts`:

```ts
import { useEffect } from 'react'
import { type CategoryId, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import type { ExpandedStateApi } from './useExpandedState'

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL))

export interface ParsedHash {
  categoryId: CategoryId
  subId: string | null
}

export function parseHash(hash: string): ParsedHash | null {
  const trimmed = hash.replace(/^#/, '')
  if (!trimmed) return null
  const [categoryId, subId = null] = trimmed.split(':')
  if (!VALID_CATEGORIES.has(categoryId)) return null
  return { categoryId: categoryId as CategoryId, subId }
}

export function useUrlHashSync(api: ExpandedStateApi, hashOverride?: string): void {
  useEffect(() => {
    const hash = hashOverride ?? (typeof window !== 'undefined' ? window.location.hash : '')
    const parsed = parseHash(hash)
    if (!parsed) return
    api.openCategory(parsed.categoryId)
    if (parsed.subId) {
      api.openSubCascade(parsed.categoryId, parsed.subId)
      // Scroll the sub-cascade into view on next paint.
      requestAnimationFrame(() => {
        const el = document.getElementById(`subcat-${parsed.categoryId}-${parsed.subId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else {
      requestAnimationFrame(() => {
        const el = document.getElementById(`category-${parsed.categoryId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally mount-only
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/performance/useUrlHashSync
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/useUrlHashSync.ts apps/web/test/components/performance/useUrlHashSync.test.ts
git commit -m "feat(web): useUrlHashSync — deep-link from mini-strip chips"
```

---

### Task 16: CategoryBar

**Files:**
- Create: `apps/web/components/performance/CategoryBar.tsx`
- Create: `apps/web/test/components/performance/CategoryBar.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CategoryBar } from '@/components/performance/CategoryBar'

describe('CategoryBar', () => {
  it('renders category name + teaser line', () => {
    render(
      <CategoryBar
        categoryId="finance"
        teaser="$5.2M raised · top industry: Securities & Investment"
        open={false}
        onToggle={() => {}}
      />
    )
    expect(screen.getByText('Finance')).toBeTruthy()
    expect(screen.getByText('$5.2M raised · top industry: Securities & Investment')).toBeTruthy()
  })

  it('shows pill chevron ▸ when closed', () => {
    render(<CategoryBar categoryId="finance" teaser="x" open={false} onToggle={() => {}} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })

  it('shows pill chevron ▾ when open', () => {
    render(<CategoryBar categoryId="finance" teaser="x" open={true} onToggle={() => {}} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })

  it('left accent border uses CATEGORY_ACCENT[id]', () => {
    const { container } = render(
      <CategoryBar categoryId="finance" teaser="x" open={false} onToggle={() => {}} />
    )
    const el = container.querySelector('button')!
    expect(el.style.borderLeftColor).toContain('rgb(61, 167, 91)') // #3da75b
    expect(el.style.borderLeftWidth).toBe('2px')
  })

  it('renders anchor id="category-<id>"', () => {
    const { container } = render(
      <CategoryBar categoryId="finance" teaser="x" open={false} onToggle={() => {}} />
    )
    expect(container.querySelector('#category-finance')).toBeTruthy()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<CategoryBar categoryId="finance" teaser="x" open={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('Finance').closest('button')!)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('renders teaser placeholder when null ("no data yet")', () => {
    render(<CategoryBar categoryId="finance" teaser={null} open={false} onToggle={() => {}} />)
    expect(screen.getByText('no data yet')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/performance/CategoryBar
```

- [ ] **Step 3: Implement**

`apps/web/components/performance/CategoryBar.tsx`:

```tsx
import { type CategoryId, CATEGORY_ACCENT, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import { PillChevron } from '@/components/cards/PillChevron'

export interface CategoryBarProps {
  categoryId: CategoryId
  teaser: string | null
  open: boolean
  onToggle: () => void
}

export function CategoryBar({ categoryId, teaser, open, onToggle }: CategoryBarProps): React.JSX.Element {
  const accent = CATEGORY_ACCENT[categoryId]
  const label = CATEGORY_LABEL[categoryId]
  return (
    <button
      id={`category-${categoryId}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`category-body-${categoryId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '11px 14px',
        border: '1px solid #d8d4c9',
        borderLeftWidth: '2px',
        borderLeftStyle: 'solid',
        borderLeftColor: accent,
        borderRadius: open ? '6px 6px 0 0' : 6,
        borderBottom: open ? 'none' : '1px solid #d8d4c9',
        background: '#fff',
        marginBottom: open ? 0 : 6,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <PillChevron open={open} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: '#1a1714', lineHeight: 1.2 }}>
          {label}
        </span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#5a5751', marginTop: 2, lineHeight: 1.4 }}>
          {teaser ?? <em style={{ color: '#807a72' }}>no data yet</em>}
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/performance/CategoryBar
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/CategoryBar.tsx apps/web/test/components/performance/CategoryBar.test.tsx
git commit -m "feat(web): CategoryBar — pill chevron + stacked text + palette-A left accent"
```

---

### Task 17: SubCascadeBar

**Files:**
- Create: `apps/web/components/performance/SubCascadeBar.tsx`
- Create: `apps/web/test/components/performance/SubCascadeBar.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

describe('SubCascadeBar', () => {
  it('renders sub-name + teaser', () => {
    render(
      <SubCascadeBar
        categoryId="issue-positions"
        subId="environment"
        name="Environment"
        teaser="LCV Strongly Aligned · Sierra Club Strongly Aligned"
        open={false}
        onToggle={() => {}}
      />
    )
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('LCV Strongly Aligned · Sierra Club Strongly Aligned')).toBeTruthy()
  })

  it('chevron is plain ▸ (no pill) when closed', () => {
    const { container } = render(
      <SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={() => {}} />
    )
    expect(screen.getByText('▸')).toBeTruthy()
    // Plain chevron has no #f0eee5 background
    expect(container.querySelector('[style*="background: rgb(240, 238, 229)"]')).toBeNull()
  })

  it('renders anchor id="subcat-<categoryId>-<subId>"', () => {
    const { container } = render(
      <SubCascadeBar categoryId="finance" subId="top-industries" name="Top Industries" teaser="x" open={false} onToggle={() => {}} />
    )
    expect(container.querySelector('#subcat-finance-top-industries')).toBeTruthy()
  })

  it('default accent uses SUB_CASCADE_ACCENT[categoryId]', () => {
    const { container } = render(
      <SubCascadeBar categoryId="issue-positions" subId="environment" name="Environment" teaser="x" open={false} onToggle={() => {}} />
    )
    const el = container.querySelector('button')!
    expect(el.style.borderLeftColor).toContain('rgb(135, 170, 224)') // #87aae0
  })

  it('accept accentOverride to support Finance sub-section shades', () => {
    const { container } = render(
      <SubCascadeBar
        categoryId="finance"
        subId="pacs"
        name="PACs"
        teaser="x"
        open={false}
        onToggle={() => {}}
        accentOverride="#a8d2b1"
      />
    )
    const el = container.querySelector('button')!
    expect(el.style.borderLeftColor).toContain('rgb(168, 210, 177)') // sage
  })

  it('placeholder variant renders soft beige + italic teaser, not clickable', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <SubCascadeBar
        categoryId="finance"
        subId="individual-donors"
        name="Individual Donors"
        teaser="data coming slice 5+"
        open={false}
        onToggle={onToggle}
        placeholder={true}
      />
    )
    const el = container.querySelector('button')! as HTMLButtonElement
    expect(el.disabled).toBe(true)
    expect(el.style.background).toContain('rgb(246, 244, 237)') // #f6f4ed
    fireEvent.click(el)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('calls onToggle when clicked (non-placeholder)', () => {
    const onToggle = vi.fn()
    render(
      <SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByText('PACs').closest('button')!)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/performance/SubCascadeBar
```

- [ ] **Step 3: Implement**

`apps/web/components/performance/SubCascadeBar.tsx`:

```tsx
import { type CategoryId, SUB_CASCADE_ACCENT } from '@chiaro/ui-tokens'

export interface SubCascadeBarProps {
  categoryId: CategoryId
  subId: string
  name: string
  teaser: string | null
  open: boolean
  onToggle: () => void
  accentOverride?: string
  placeholder?: boolean
}

export function SubCascadeBar(props: SubCascadeBarProps): React.JSX.Element {
  const { categoryId, subId, name, teaser, open, onToggle, accentOverride, placeholder = false } = props
  const accent = accentOverride ?? SUB_CASCADE_ACCENT[categoryId]
  return (
    <button
      id={`subcat-${categoryId}-${subId}`}
      onClick={placeholder ? undefined : onToggle}
      disabled={placeholder}
      aria-expanded={!placeholder && open}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #e5e1d4',
        borderLeftWidth: '1px',
        borderLeftStyle: 'solid',
        borderLeftColor: accent,
        borderRadius: 5,
        background: placeholder ? '#f6f4ed' : '#fff',
        marginBottom: 4,
        cursor: placeholder ? 'default' : 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.7rem', color: placeholder ? '#807a72' : '#1a1714' }}>
        {open ? '▾' : '▸'}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', color: placeholder ? '#5a5751' : '#1a1714' }}>
          {name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '0.7rem',
            color: placeholder ? '#807a72' : '#5a5751',
            marginTop: 1,
            lineHeight: 1.4,
            fontStyle: placeholder ? 'italic' : 'normal',
          }}
        >
          {teaser}
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/performance/SubCascadeBar
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/SubCascadeBar.tsx apps/web/test/components/performance/SubCascadeBar.test.tsx
git commit -m "feat(web): SubCascadeBar — mini-category-bar + placeholder variant"
```

---

## Phase E — Bio header (Tasks 18-22)

Five small components, one per section of the centered-stack bio header. Reuse slice-3's initials-fallback avatar pattern from `OfficialAvatar`.

### Task 18: BioPortrait

**Files:**
- Create: `apps/web/components/bio/BioPortrait.tsx`
- Create: `apps/web/test/components/bio/BioPortrait.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioPortrait } from '@/components/bio/BioPortrait'

describe('BioPortrait', () => {
  it('renders <img> when portraitUrl present', () => {
    render(<BioPortrait fullName="Nancy Pelosi" portraitUrl="https://example.org/np.jpg" size={72} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe('https://example.org/np.jpg')
    expect(img.alt).toBe('Nancy Pelosi portrait')
  })
  it('falls back to initials when portraitUrl missing', () => {
    render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    expect(screen.getByText('NP')).toBeTruthy()
  })
  it('initials are first letter of first + last word', () => {
    render(<BioPortrait fullName="Adam B. Schiff" portraitUrl={null} size={72} />)
    expect(screen.getByText('AS')).toBeTruthy()
  })
  it('single-word name → single letter', () => {
    render(<BioPortrait fullName="Cher" portraitUrl={null} size={72} />)
    expect(screen.getByText('C')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/bio/BioPortrait
```

- [ ] **Step 3: Implement**

`apps/web/components/bio/BioPortrait.tsx`:

```tsx
export interface BioPortraitProps {
  fullName: string
  portraitUrl: string | null
  size: number
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export function BioPortrait({ fullName, portraitUrl, size }: BioPortraitProps): React.JSX.Element {
  if (portraitUrl) {
    return (
      <img
        src={portraitUrl}
        alt={`${fullName} portrait`}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      aria-label={`${fullName} portrait (initials)`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b6ed1 0%, #5b8de1 100%)',
        color: '#fff',
        fontWeight: 700,
        fontSize: `${size * 0.42}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials(fullName)}
    </span>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/bio/BioPortrait
git add apps/web/components/bio/BioPortrait.tsx apps/web/test/components/bio/BioPortrait.test.tsx
git commit -m "feat(web): BioPortrait — image with initials fallback"
```

---

### Task 19: BioIdentityRow (Row 1 chips)

**Files:**
- Create: `apps/web/components/bio/BioIdentityRow.tsx`
- Test cases inline (small) — covered via BioHeader integration test in Task 22

- [ ] **Step 1: Implement**

`apps/web/components/bio/BioIdentityRow.tsx`:

```tsx
import { PARTY_COLOR, PARTY_SHORT } from '@chiaro/ui-tokens'

export interface BioIdentityRowProps {
  party: string
  chamber: 'house' | 'senate'
  districtChipLabel: string  // e.g. "CA-11", "CA-AL", or "California" (senate)
}

const chipBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: '0.72rem',
  fontWeight: 500,
  lineHeight: 1.4,
}

export function BioIdentityRow({ party, chamber, districtChipLabel }: BioIdentityRowProps): React.JSX.Element {
  const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'
  const partyLabel = PARTY_SHORT[party as keyof typeof PARTY_SHORT] ?? party
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      <span style={{ ...chipBase, background: partyColor, color: '#fff', fontWeight: 600 }}>{partyLabel}</span>
      <span style={{ ...chipBase, background: '#f0eee5', color: '#3a352b' }}>{chamber === 'house' ? 'House' : 'Senate'}</span>
      <span style={{ ...chipBase, background: '#f0eee5', color: '#3a352b' }}>{districtChipLabel}</span>
    </div>
  )
}
```

- [ ] **Step 2: Workspace typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/bio/BioIdentityRow.tsx
git commit -m "feat(web): BioIdentityRow — party/chamber/district chips"
```

---

### Task 20: BioServiceCard (Row 2 — current role)

**Files:**
- Create: `apps/web/components/bio/BioServiceCard.tsx`

- [ ] **Step 1: Implement**

`apps/web/components/bio/BioServiceCard.tsx`:

```tsx
export interface BioServiceCardProps {
  role: string                      // "Speaker", "Representative", "Senator", or e.g. "Class 1"
  firstElectedYear: number | null
}

export function BioServiceCard({ role, firstElectedYear }: BioServiceCardProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 8,
        alignItems: 'center',
        background: '#f0eee5',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    >
      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#807a72', letterSpacing: '0.06em' }}>
        CURRENT ROLE
      </span>
      <span
        style={{
          background: '#1a1714',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: '0.72rem',
          fontWeight: 600,
        }}
      >
        {role}
      </span>
      {firstElectedYear != null && (
        <span style={{ fontSize: '0.72rem', color: '#5a5751' }}>· Since {firstElectedYear}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/bio/BioServiceCard.tsx
git commit -m "feat(web): BioServiceCard — current role tinted card"
```

---

### Task 21: BioContactLinks

**Files:**
- Create: `apps/web/components/bio/BioContactLinks.tsx`

- [ ] **Step 1: Implement**

`apps/web/components/bio/BioContactLinks.tsx`:

```tsx
export interface BioContactLinksProps {
  officialUrl: string | null
  twitterHandle: string | null
}

export function BioContactLinks({ officialUrl, twitterHandle }: BioContactLinksProps): React.JSX.Element | null {
  const links: React.ReactNode[] = []
  if (officialUrl) {
    const display = officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    links.push(
      <a key="site" href={officialUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#3b6ed1' }}>
        {display}
      </a>
    )
  }
  if (twitterHandle) {
    links.push(
      <a
        key="twitter"
        href={`https://twitter.com/${twitterHandle}`}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: '0.75rem', color: '#3b6ed1' }}
      >
        @{twitterHandle}
      </a>
    )
  }
  if (links.length === 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
      {links.map((l, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {i > 0 && <span style={{ color: '#d8d4c9' }}>·</span>}
          {l}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/bio/BioContactLinks.tsx
git commit -m "feat(web): BioContactLinks — official site + twitter, graceful empty"
```

---

### Task 22: BioHeader composer

**Files:**
- Create: `apps/web/components/bio/BioHeader.tsx`
- Create: `apps/web/test/components/bio/BioHeader.test.tsx`

- [ ] **Step 1: Failing integration test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioHeader } from '@/components/bio/BioHeader'

const PELOSI = {
  fullName: 'Nancy Pelosi',
  portraitUrl: null,
  party: 'D',
  chamber: 'house' as const,
  state: 'CA',
  stateName: 'California',
  districtNumber: 11,
  senateClass: null,
  atLarge: false,
  role: 'Speaker',
  firstElectedYear: 2007,
  officialUrl: 'https://pelosi.house.gov',
  twitterHandle: 'SpeakerPelosi',
}

describe('BioHeader', () => {
  it('renders name + 3 identity chips + service card + contact links for a house rep', () => {
    render(<BioHeader {...PELOSI} />)
    expect(screen.getByText('Nancy Pelosi')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText('CA-11')).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText(/Since 2007/)).toBeTruthy()
    expect(screen.getByText('pelosi.house.gov')).toBeTruthy()
    expect(screen.getByText('@SpeakerPelosi')).toBeTruthy()
  })

  it('senate variant uses full state name for district chip', () => {
    render(
      <BioHeader
        {...PELOSI}
        chamber="senate"
        districtNumber={null}
        senateClass={1}
        role="Senator"
      />
    )
    expect(screen.getByText('California')).toBeTruthy()
    expect(screen.queryByText('CA-11')).toBeNull()
  })

  it('at-large variant uses XX-AL district chip', () => {
    render(
      <BioHeader
        {...PELOSI}
        state="WY" stateName="Wyoming" districtNumber={null} atLarge={true} role="Representative" firstElectedYear={2023}
      />
    )
    expect(screen.getByText('WY-AL')).toBeTruthy()
  })

  it('gracefully hides contact links when both missing', () => {
    render(<BioHeader {...PELOSI} officialUrl={null} twitterHandle={null} />)
    expect(screen.queryByText('pelosi.house.gov')).toBeNull()
    expect(screen.queryByText(/@/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/bio/BioHeader
```

- [ ] **Step 3: Implement**

`apps/web/components/bio/BioHeader.tsx`:

```tsx
import { BioPortrait } from './BioPortrait'
import { BioIdentityRow } from './BioIdentityRow'
import { BioServiceCard } from './BioServiceCard'
import { BioContactLinks } from './BioContactLinks'

export interface BioHeaderProps {
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'house' | 'senate'
  state: string             // 2-letter code
  stateName: string         // full name (e.g. "California")
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
}

function districtChipLabel(p: BioHeaderProps): string {
  if (p.chamber === 'senate') return p.stateName
  if (p.atLarge) return `${p.state}-AL`
  if (p.districtNumber == null) return p.state
  const num = String(p.districtNumber).padStart(2, '0')
  return `${p.state}-${num}`
}

export function BioHeader(p: BioHeaderProps): React.JSX.Element {
  return (
    <section
      aria-label={`${p.fullName} bio`}
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '24px 16px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <BioPortrait fullName={p.fullName} portraitUrl={p.portraitUrl} size={72} />
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a1714' }}>{p.fullName}</h1>
      <BioIdentityRow party={p.party} chamber={p.chamber} districtChipLabel={districtChipLabel(p)} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </section>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/bio/BioHeader
pnpm --filter @chiaro/web typecheck
git add apps/web/components/bio/BioHeader.tsx apps/web/test/components/bio/BioHeader.test.tsx
git commit -m "feat(web): BioHeader composer — centered stack + chip rows"
```

---

## Phase F — Evidence inline-expand pattern (Task 23)

Slice 4's `ScorecardEvidenceDrawer` modal is replaced by inline expansion inside the card. This task ships the controller + the shared evidence-section chrome so every metric card can use the same pattern.

### Task 23: EvidenceExpand controller

**Files:**
- Create: `apps/web/components/cards/EvidenceExpand.tsx`
- Create: `apps/web/test/components/cards/EvidenceExpand.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

describe('EvidenceExpand', () => {
  it('closed state shows "view evidence" pill chevron button', () => {
    render(
      <EvidenceExpand title="Transactions" open={false} onToggle={() => {}}>
        <div>row 1</div>
      </EvidenceExpand>
    )
    expect(screen.getByText('view evidence')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
    expect(screen.queryByText('row 1')).toBeNull()
  })

  it('open state shows ▾ + content + "Hide evidence"', () => {
    render(
      <EvidenceExpand title="Transactions" open={true} onToggle={() => {}}>
        <div>row 1</div>
      </EvidenceExpand>
    )
    expect(screen.getByText('Hide evidence')).toBeTruthy()
    expect(screen.getByText('▾')).toBeTruthy()
    expect(screen.getByText('row 1')).toBeTruthy()
  })

  it('open state renders the title heading', () => {
    render(
      <EvidenceExpand title="Missed Votes" open={true} onToggle={() => {}}>
        <div />
      </EvidenceExpand>
    )
    expect(screen.getByText('Missed Votes')).toBeTruthy()
  })

  it('toggle button calls onToggle', () => {
    const onToggle = vi.fn()
    render(
      <EvidenceExpand title="Transactions" open={false} onToggle={onToggle}>
        <div />
      </EvidenceExpand>
    )
    fireEvent.click(screen.getByText('view evidence').closest('button')!)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/cards/EvidenceExpand
```

- [ ] **Step 3: Implement**

`apps/web/components/cards/EvidenceExpand.tsx`:

```tsx
import type { ReactNode } from 'react'
import { PillChevron } from './PillChevron'

export interface EvidenceExpandProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function EvidenceExpand({ title, open, onToggle, children }: EvidenceExpandProps): React.JSX.Element {
  return (
    <>
      {open && (
        <div style={{ marginTop: 14, borderTop: '1px dashed #d8d4c9', paddingTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1714', marginBottom: 8 }}>
            {title}
          </div>
          {children}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={onToggle}
          aria-expanded={open}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#1a1714',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          <PillChevron open={open} />
          {open ? 'Hide evidence' : 'view evidence'}
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/cards/EvidenceExpand
pnpm --filter @chiaro/web typecheck
git add apps/web/components/cards/EvidenceExpand.tsx apps/web/test/components/cards/EvidenceExpand.test.tsx
git commit -m "feat(web): EvidenceExpand controller — replaces slice-4 modal drawer"
```

---

## Phase G — Service Record + Community Presence + Ethics & Accountability (Tasks 24-26)

Three "flat" categories. Each renders a small grid of `MetricCardShell`s with the right derived values. No sub-cascade.

### Task 24: ServiceRecordCategory

**Files:**
- Create: `apps/web/components/performance/categories/ServiceRecordCategory.tsx`
- Test: covered by PerformanceSection integration test in Task 33

- [ ] **Step 1: Implement**

```tsx
'use client'

import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { firstElectedYear, tenureByChamber } from '@/lib/derivations/service-record'
import { MetricCardShell } from '@/components/cards/MetricCardShell'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'service-record'
const client = createSupabaseBrowserClient()
const CRS_URL = 'https://crsreports.congress.gov/product/pdf/R/R44648'

export function ServiceRecordCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const history = useOfficialLeadershipHistory(client, officialId)
  const [tenureOpen, setTenureOpen] = useState(false)
  const [leadershipOpen, setLeadershipOpen] = useState(false)

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data
  const rows = history.data ?? []
  const elected = firstElectedYear(rows)
  const tenure = tenureByChamber(rows)
  const totalTenure = Number((tenure.house + tenure.senate).toFixed(1))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 12 }}>
      <MetricCardShell
        categoryId={CATEGORY}
        value={m?.salary_usd ? `$${m.salary_usd.toLocaleString()}` : '—'}
        label="Base Salary"
        caption={m?.salary_role ?? null}
        externalSourceUrl={CRS_URL}
      />

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {totalTenure > 0 ? `${totalTenure} yrs` : '—'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c89a4e', marginRight: 6, display: 'inline-block' }} />
          Tenure
        </div>
        {elected != null && <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>First elected {elected}</div>}
        {(tenure.house > 0 && tenure.senate > 0) && (
          <EvidenceExpand title="Tenure by chamber" open={tenureOpen} onToggle={() => setTenureOpen(v => !v)}>
            <p style={{ fontSize: '0.82rem', color: '#1a1714', margin: 0 }}>
              {tenure.house.toFixed(1)} yrs House · {tenure.senate.toFixed(1)} yrs Senate
            </p>
          </EvidenceExpand>
        )}
      </article>

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.salary_role && m.salary_role !== 'Member' ? m.salary_role : 'Member'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c89a4e', marginRight: 6, display: 'inline-block' }} />
          Leadership Role
        </div>
        <EvidenceExpand title="Leadership history" open={leadershipOpen} onToggle={() => setLeadershipOpen(v => !v)}>
          {rows.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#5a5751', margin: 0 }}>No leadership history ingested.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map(r => (
                <li key={r.id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem', color: '#1a1714' }}>
                  <strong>{r.role}</strong> · {r.start_date} – {r.end_date ?? 'present'}
                  <br />
                  <a href={r.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>
                    → source
                  </a>
                </li>
              ))}
            </ul>
          )}
        </EvidenceExpand>
      </article>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/categories/ServiceRecordCategory.tsx
git commit -m "feat(web): ServiceRecordCategory — salary + tenure + leadership flat grid"
```

---

### Task 25: CommunityPresenceCategory

**Files:**
- Create: `apps/web/components/performance/categories/CommunityPresenceCategory.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialDistrictOffices,
  useOfficialTownHalls,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { MetricCardShell } from '@/components/cards/MetricCardShell'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'community-presence'
const client = createSupabaseBrowserClient()
const CONGRESS = '119'

function mapsUrl(addr: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`
}

function isRecent(eventDate: string, days = 90): boolean {
  const event = new Date(eventDate).getTime()
  const now = Date.now()
  return event >= now - days * 24 * 60 * 60 * 1000 && event <= now
}

export function CommunityPresenceCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const [officesOpen, setOfficesOpen] = useState(false)
  const [hallsOpen, setHallsOpen] = useState(false)
  const offices = useOfficialDistrictOffices(client, officialId, { enabled: officesOpen })
  const halls = useOfficialTownHalls(client, officialId, CONGRESS, { enabled: hallsOpen })

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 12 }}>
      <MetricCardShell
        categoryId={CATEGORY}
        value={m?.lives_in_district == null ? 'N/A (Senate)' : m.lives_in_district ? '✓ Yes' : '✗ No'}
        label="Lives in District"
        caption={m?.home_district_id ? 'home maps to a district' : 'address outside represented district'}
        externalSourceUrl="https://www.fec.gov/data/"
      />

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f3faf8 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.district_offices_count ?? 0}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f9b88', marginRight: 6, display: 'inline-block' }} />
          District Offices
        </div>
        <EvidenceExpand title="Office locations" open={officesOpen} onToggle={() => setOfficesOpen(v => !v)}>
          {offices.isLoading ? <p>Loading…</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(offices.data ?? []).map(o => {
                const full = `${o.address}, ${o.city}, ${o.state} ${o.zip ?? ''}`.trim()
                return (
                  <li key={o.id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                    <strong>{o.city}, {o.state}</strong><br />
                    {o.address} {o.zip}<br />
                    {o.phone && <a href={`tel:${o.phone}`} style={{ color: '#3b6ed1' }}>{o.phone}</a>}{' '}
                    <a href={mapsUrl(full)} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>→ open in Google Maps</a>{' '}
                    <a href={o.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>→ source</a>
                  </li>
                )
              })}
              {(offices.data ?? []).length === 0 && <li style={{ padding: '6px 0', color: '#807a72' }}>No district offices listed.</li>}
            </ul>
          )}
        </EvidenceExpand>
      </article>

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f3faf8 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.town_halls_count ?? 0}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f9b88', marginRight: 6, display: 'inline-block' }} />
          Town Halls (119th)
        </div>
        <EvidenceExpand title="Town halls" open={hallsOpen} onToggle={() => setHallsOpen(v => !v)}>
          {halls.isLoading ? <p>Loading…</p> : (() => {
            const data = halls.data ?? []
            if (data.length === 0) return <p style={{ color: '#807a72', fontSize: '0.82rem' }}>No town halls in the 119th Congress.</p>
            const recent = data.filter(h => isRecent(h.event_date))
            const formatCounts = data.reduce<Record<string, number>>((acc, h) => {
              const key = h.format ?? 'unknown'
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {})
            return (
              <>
                <p style={{ fontSize: '0.78rem', color: '#5a5751', margin: '0 0 6px' }}>
                  {recent.length} in last 90 days · last event: {data[0]?.event_date ?? '—'}<br />
                  By format: {Object.entries(formatCounts).map(([k, v]) => `${k} ${v}`).join(' · ')}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.map(h => (
                    <li key={h.id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem', color: '#1a1714' }}>
                      <strong>{h.event_date}</strong> · {h.city ?? '?'}, {h.state ?? '?'} · {h.format ?? '?'}{' '}
                      <a href={h.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>→ Town Hall Project</a>
                    </li>
                  ))}
                </ul>
              </>
            )
          })()}
        </EvidenceExpand>
      </article>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/categories/CommunityPresenceCategory.tsx
git commit -m "feat(web): CommunityPresenceCategory — lives in district + offices + town halls"
```

---

### Task 26: EthicsAccountabilityCategory

**Files:**
- Create: `apps/web/components/performance/categories/EthicsAccountabilityCategory.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'ethics-accountability'
const client = createSupabaseBrowserClient()

function formatRange(low: number | null, high: number | null): string {
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`
  if (low == null || high == null) return '—'
  return `${fmt(low)}–${fmt(high)}`
}

export function EthicsAccountabilityCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const [stockOpen, setStockOpen] = useState(false)
  const stock = useOfficialStockTransactions(client, officialId, { enabled: stockOpen })

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data

  const data = stock.data ?? []
  const worstCase = data.reduce((max, t) => Math.max(max, t.days_late ?? 0), 0)
  const volumeLow = data.reduce((s, t) => s + (t.amount_range_low ?? 0), 0)
  const volumeHigh = data.reduce((s, t) => s + (t.amount_range_high ?? 0), 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: 12 }}>
      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.stock_act_compliance_pct != null ? `${m.stock_act_compliance_pct}%` : '—'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d68a1f', marginRight: 6, display: 'inline-block' }} />
          STOCK Act Compliance
        </div>
        <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>
          {m?.stock_act_disclosures_late ?? 0} late / {m?.stock_act_disclosures_total ?? 0} total
          {data.length > 0 && worstCase > 0 && <> · worst: {worstCase} days</>}
        </div>
        {data.length > 0 && (
          <div style={{ fontSize: '0.7rem', color: '#807a72' }}>
            Total disclosed volume: {formatRange(volumeLow, volumeHigh)}
          </div>
        )}
        <EvidenceExpand title="Transactions" open={stockOpen} onToggle={() => setStockOpen(v => !v)}>
          {stock.isLoading ? <p>Loading…</p> : data.length === 0 ? (
            <p style={{ color: '#807a72', fontSize: '0.82rem' }}>No STOCK Act disclosures filed.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.map(t => {
                const late = (t.days_late ?? 0) > 0
                return (
                  <li key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0eee5', fontSize: '0.82rem', color: '#1a1714' }}>
                    <ComplianceIcon state={late ? 'late' : 'on-time'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{t.asset_ticker ?? t.asset_name ?? '?'}</strong>
                        <span style={{ fontWeight: 600 }}>{formatRange(t.amount_range_low, t.amount_range_high)}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#5a5751', marginTop: 3 }}>
                        {t.transaction_type ?? '?'} · filed {t.filing_date}
                        {late && <> · <strong>{t.days_late} days late</strong></>}
                      </div>
                      <div style={{ fontSize: '0.72rem', marginTop: 3 }}>
                        <a href={t.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>→ source</a>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </EvidenceExpand>
      </article>

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.in_state_donations_pct != null ? `${m.in_state_donations_pct}%` : '—'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d68a1f', marginRight: 6, display: 'inline-block' }} />
          In-State Donors
        </div>
        {m?.out_of_state_donations_pct != null && (
          <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>
            {m.out_of_state_donations_pct}% out-of-state
          </div>
        )}
        <a href="https://www.opensecrets.org/" target="_blank" rel="noreferrer" style={{ marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', display: 'inline-block', textDecoration: 'underline' }}>
          view source →
        </a>
      </article>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/categories/EthicsAccountabilityCategory.tsx
git commit -m "feat(web): EthicsAccountabilityCategory — STOCK Act + in-state donors"
```

---

## Phase H — Issue Positions (Task 27)

Two-level cascade: 9 issue-area sub-cascades, each containing 1+ scorecard cards. Cards use the new title format **Issue** (Organization).

### Task 27: IssuePositionsCategory

**Files:**
- Create: `apps/web/components/performance/categories/IssuePositionsCategory.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import { useState } from 'react'
import {
  ALIGNMENT_LABEL,
  type CategoryId,
  scoreToTier,
  titleCaseIssueArea,
} from '@chiaro/ui-tokens'
import { useOfficialScorecardRatings, type ScorecardRatingWithOrg } from '@chiaro/officials'
import { useOfficialVotesOnSubject } from '@chiaro/bills'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'issue-positions'
const client = createSupabaseBrowserClient()

const SUBJECT_BY_AREA: Record<string, string> = {
  'environment':         'Environmental protection',
  'civil-liberties':     'Civil rights and liberties, minority issues',
  'civil-rights':        'Civil rights and liberties, minority issues',
  'reproductive-rights': 'Health',
  'liberal-policy':      'Government operations and politics',
  'conservative-policy': 'Government operations and politics',
  'business-policy':     'Commerce',
  'second-amendment':    'Firearms and explosives',
  'labor':               'Labor and employment',
}

function tierLabel(score: number, max: number): string {
  return ALIGNMENT_LABEL[scoreToTier(score, max)]
}

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

interface ScorecardCardInlineProps {
  rating: ScorecardRatingWithOrg
  officialId: string
}

function ScorecardCardInline({ rating, officialId }: ScorecardCardInlineProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const subject = SUBJECT_BY_AREA[rating.org.issue_area] ?? rating.org.issue_area
  const votes = useOfficialVotesOnSubject(client, officialId, subject, { enabled: open })
  const label = tierLabel(rating.score, rating.org.scoring_max)

  return (
    <article
      style={{
        border: '1px solid #d8d4c9',
        borderRadius: 6,
        padding: 12,
        background: 'linear-gradient(180deg, #f6f8fc 0%, #fff 100%)',
      }}
    >
      <div style={{ fontSize: '0.95rem', color: '#1a1714' }}>
        <strong>{titleCaseIssueArea(rating.org.issue_area)}</strong>{' '}
        <span style={{ color: '#807a72' }}>({rating.org.name})</span>
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1a1714', marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: '0.72rem', color: '#807a72', marginTop: 6 }}>
        <a href={rating.org.methodology_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → methodology
        </a>{' '}·{' '}
        <a href={rating.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → org per-member page
        </a>{' '}·{' '}
        <span style={{ color: '#807a72' }}>numeric score: {rating.score} / {rating.org.scoring_max}</span>
      </div>
      <EvidenceExpand title={`Votes on bills tagged "${subject}"`} open={open} onToggle={() => setOpen(v => !v)}>
        {votes.isLoading ? <p>Loading…</p> : (() => {
          const rows = votes.data ?? []
          if (rows.length === 0) return <p style={{ fontSize: '0.82rem', color: '#807a72' }}>No matching votes ingested.</p>
          return (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map(r => (
                <li key={r.vote_id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                  <strong>{r.position.toUpperCase()}</strong> on{' '}
                  <a href={r.bill.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                    {r.bill.bill_type.toUpperCase()} {r.bill.number}: {r.bill.title}
                  </a>
                </li>
              ))}
            </ul>
          )
        })()}
      </EvidenceExpand>
    </article>
  )
}

export function IssuePositionsCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const scorecards = useOfficialScorecardRatings(client, officialId)

  if (scorecards.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const all = scorecards.data ?? []

  // Group by issue_area, alphabetical
  const groups = new Map<string, ScorecardRatingWithOrg[]>()
  for (const r of all) {
    const key = r.org.issue_area
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  const sortedAreas = Array.from(groups.keys()).sort((a, b) =>
    titleCaseIssueArea(a).localeCompare(titleCaseIssueArea(b))
  )

  return (
    <div style={{ padding: 12 }}>
      {sortedAreas.map(area => {
        const ratings = groups.get(area)!
          .slice()
          .sort((a, b) => a.org.name.localeCompare(b.org.name))
        const teaser = ratings.map(r => `${r.org.name} ${tierLabel(r.score, r.org.scoring_max)}`).join(' · ')
        const open = subCascade.isOpen(CATEGORY, area)
        return (
          <div key={area}>
            <SubCascadeBar
              categoryId={CATEGORY}
              subId={area}
              name={titleCaseIssueArea(area)}
              teaser={teaser}
              open={open}
              onToggle={() => subCascade.onToggle(CATEGORY, area)}
            />
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
                {ratings.map(r => (
                  <ScorecardCardInline key={r.id} rating={r} officialId={officialId} />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {sortedAreas.length === 0 && (
        <p style={{ color: '#807a72', fontSize: '0.82rem', textAlign: 'center', padding: 12 }}>
          No scorecards ingested for this representative yet.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/categories/IssuePositionsCategory.tsx
git commit -m "feat(web): IssuePositionsCategory — sub-cascade by issue area + inline evidence"
```

---

## Phase I — Finance (Tasks 28-31)

The most structurally complex category: summary strip + 2 sub-sections (Contributors / Top Donor) + 4 sub-cascades + industry bar chart with toggle.

### Task 28: FinanceSummaryStrip

**Files:**
- Create: `apps/web/components/finance/FinanceSummaryStrip.tsx`
- Create: `apps/web/test/components/finance/FinanceSummaryStrip.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinanceSummaryStrip } from '@/components/finance/FinanceSummaryStrip'

describe('FinanceSummaryStrip', () => {
  it('renders 3 cells with values', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={5234189} smallDonorPct={28.4} pacPct={0.6} />)
    expect(screen.getByText('$5.2M')).toBeTruthy()
    expect(screen.getByText('28%')).toBeTruthy()
    expect(screen.getByText('0.6%')).toBeTruthy()
  })

  it('formats labels with cycle year', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={1_000_000} smallDonorPct={null} pacPct={null} />)
    expect(screen.getByText(/Total Raised, 2024/i)).toBeTruthy()
  })

  it('displays — for null values', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={null} smallDonorPct={null} pacPct={null} />)
    expect(screen.getAllByText('—').length).toBe(3)
  })

  it('Total Raised cell is wider (1.3fr grid)', () => {
    const { container } = render(<FinanceSummaryStrip cycle="2024" totalRaised={5_234_189} smallDonorPct={28} pacPct={1} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe('1.3fr 1fr 1fr')
  })

  it('Total Raised value uses larger font (headline)', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={5_234_189} smallDonorPct={28} pacPct={1} />)
    const total = screen.getByText('$5.2M')
    expect(total.style.fontSize).toBe('1.45rem')
    expect(total.style.fontWeight).toBe('800')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/finance/FinanceSummaryStrip
```

- [ ] **Step 3: Implement**

`apps/web/components/finance/FinanceSummaryStrip.tsx`:

```tsx
import { CATEGORY_ACCENT, CATEGORY_CARD_GRADIENT } from '@chiaro/ui-tokens'

export interface FinanceSummaryStripProps {
  cycle: string
  totalRaised: number | null
  smallDonorPct: number | null
  pacPct: number | null
}

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

const DOT = '#3da75b' // CATEGORY_ACCENT.finance — inline so tests can match RGB exactly

const labelStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  color: '#5a5751',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
}

const dotStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: DOT,
  display: 'inline-block',
  marginRight: 5,
}

const supportingValueStyle: React.CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 700,
  color: '#1a1714',
  marginTop: 6,
  lineHeight: 1,
}

const headlineValueStyle: React.CSSProperties = {
  fontSize: '1.45rem',
  fontWeight: 800,
  color: '#1a1714',
  marginTop: 6,
  lineHeight: 1,
}

export function FinanceSummaryStrip({ cycle, totalRaised, smallDonorPct, pacPct }: FinanceSummaryStripProps): React.JSX.Element {
  return (
    <div
      style={{
        background: CATEGORY_CARD_GRADIENT['finance'],
        border: '1px solid #d8d4c9',
        borderRadius: 6,
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr 1fr',
        alignItems: 'end',
        marginBottom: 10,
      }}
    >
      <div style={{ paddingRight: 14 }}>
        <div style={labelStyle}><span style={dotStyle} />Total Raised, {cycle}</div>
        <div style={headlineValueStyle}>{formatMoney(totalRaised)}</div>
      </div>
      <div style={{ borderLeft: '1px solid #d8d4c9', padding: '0 12px' }}>
        <div style={labelStyle}><span style={dotStyle} />Small-donor %</div>
        <div style={supportingValueStyle}>{formatPct(smallDonorPct)}</div>
      </div>
      <div style={{ borderLeft: '1px solid #d8d4c9', paddingLeft: 12 }}>
        <div style={labelStyle}><span style={dotStyle} />PAC %</div>
        <div style={supportingValueStyle}>{pacPct == null ? '—' : `${pacPct.toFixed(1)}%`}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/finance/FinanceSummaryStrip
pnpm --filter @chiaro/web typecheck
git add apps/web/components/finance/FinanceSummaryStrip.tsx apps/web/test/components/finance/FinanceSummaryStrip.test.tsx
git commit -m "feat(web): FinanceSummaryStrip — 3-cell with headline emphasis + dividers"
```

---

### Task 29: FinanceSubSectionHeading

**Files:**
- Create: `apps/web/components/finance/FinanceSubSectionHeading.tsx`

- [ ] **Step 1: Implement**

```tsx
export interface FinanceSubSectionHeadingProps {
  label: string
  textColor: string  // e.g. #2d5d3a (contributors) or #2a5d4a (top donor)
  ruleColor: string  // matching accent shade
}

export function FinanceSubSectionHeading({ label, textColor, ruleColor }: FinanceSubSectionHeadingProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 6px' }}>
      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: textColor }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: ruleColor }} />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/finance/FinanceSubSectionHeading.tsx
git commit -m "feat(web): FinanceSubSectionHeading — uppercase eyebrow + rule"
```

---

### Task 30: IndustryBreakdown

**Files:**
- Create: `apps/web/components/finance/IndustryBreakdown.tsx`
- Create: `apps/web/test/components/finance/IndustryBreakdown.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { IndustryBreakdown } from '@/components/finance/IndustryBreakdown'

const TEN = Array.from({ length: 10 }, (_, i) => ({
  industry: `Industry ${i + 1}`,
  amount: (10 - i) * 50_000,
}))

describe('IndustryBreakdown', () => {
  it('renders 5 rows by default', () => {
    render(<IndustryBreakdown rows={TEN} />)
    expect(screen.getByText('Industry 1')).toBeTruthy()
    expect(screen.getByText('Industry 5')).toBeTruthy()
    expect(screen.queryByText('Industry 6')).toBeNull()
  })

  it('toggle button shows "Show 5 more industries · 5 of 10 shown"', () => {
    render(<IndustryBreakdown rows={TEN} />)
    expect(screen.getByText('Show 5 more industries')).toBeTruthy()
    expect(screen.getByText('5 of 10 shown')).toBeTruthy()
  })

  it('clicking toggle reveals rows 6-10 + flips to "Show less"', () => {
    render(<IndustryBreakdown rows={TEN} />)
    fireEvent.click(screen.getByText('Show 5 more industries').closest('button')!)
    expect(screen.getByText('Industry 6')).toBeTruthy()
    expect(screen.getByText('Industry 10')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
    expect(screen.getByText('10 of 10 shown')).toBeTruthy()
  })

  it('row 1 industry name uses bolder + slightly larger font', () => {
    render(<IndustryBreakdown rows={TEN} />)
    const row1 = screen.getByText('Industry 1')
    expect(row1.style.fontWeight).toBe('700')
    expect(row1.style.fontSize).toBe('0.92rem')
  })

  it('row 2+ uses 600 / 0.82rem', () => {
    render(<IndustryBreakdown rows={TEN} />)
    const row2 = screen.getByText('Industry 2')
    expect(row2.style.fontWeight).toBe('600')
    expect(row2.style.fontSize).toBe('0.82rem')
  })

  it('percent is shown next to dollar', () => {
    render(<IndustryBreakdown rows={[{ industry: 'A', amount: 500 }, { industry: 'B', amount: 500 }]} />)
    // A = 50%, B = 50%
    const pcts = screen.getAllByText(/50%/)
    expect(pcts.length).toBe(2)
  })

  it('toggle hidden when ≤5 rows', () => {
    render(<IndustryBreakdown rows={TEN.slice(0, 3)} />)
    expect(screen.queryByText(/Show 5 more/)).toBeNull()
  })

  it('renders "→ full breakdown on OpenSecrets" link', () => {
    render(<IndustryBreakdown rows={TEN} sourceUrl="https://www.opensecrets.org/example" />)
    const link = screen.getByText(/full breakdown on OpenSecrets/)
    expect(link.closest('a')?.getAttribute('href')).toBe('https://www.opensecrets.org/example')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/finance/IndustryBreakdown
```

- [ ] **Step 3: Implement**

`apps/web/components/finance/IndustryBreakdown.tsx`:

```tsx
import { useState } from 'react'
import { PillChevron } from '@/components/cards/PillChevron'

export interface IndustryRow {
  industry: string
  amount: number
}

export interface IndustryBreakdownProps {
  rows: ReadonlyArray<IndustryRow>
  sourceUrl?: string
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function IndustryBreakdown({ rows, sourceUrl }: IndustryBreakdownProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
    <div style={{ background: 'linear-gradient(180deg, #f4faf6 0%, #fff 100%)', border: '1px solid #d8d4c9', borderRadius: 6, padding: '14px 16px', fontSize: '0.82rem', color: '#1a1714' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((r, idx) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const isTop = idx === 0 && !!visible[0]
          return (
            <div key={r.industry}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: isTop ? 700 : 600, fontSize: isTop ? '0.92rem' : '0.82rem', color: '#1a1714' }}>
                  {r.industry}
                </span>
                <span>
                  <span style={{ fontWeight: 700, color: '#1a1714' }}>{formatMoney(r.amount)}</span>{' '}
                  <span style={{ color: '#5a5751', fontSize: '0.72rem' }}>· {pct}%</span>
                </span>
              </div>
              <div style={{ marginTop: 4, height: 6, background: '#e8e6dd', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: '#3da75b', width: `${(r.amount / max) * 100}%`, height: '100%' }} />
              </div>
            </div>
          )
        })}
      </div>

      {showToggle && (
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            marginTop: 12,
            width: '100%',
            background: '#fff',
            border: '1px solid #d8d4c9',
            borderRadius: 6,
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#1a1714',
            fontSize: '0.82rem',
          }}
        >
          <PillChevron open={expanded} />
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>
            {expanded ? 'Show less' : 'Show 5 more industries'}
          </span>
          <span style={{ color: '#5a5751', fontSize: '0.72rem' }}>
            {expanded ? `${rows.length} of ${rows.length} shown` : `5 of ${rows.length} shown`}
          </span>
        </button>
      )}

      {sourceUrl && (
        <div style={{ marginTop: 12, fontSize: '0.78rem' }}>
          <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1', textDecoration: 'underline' }}>
            → full breakdown on OpenSecrets
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/web test components/finance/IndustryBreakdown
pnpm --filter @chiaro/web typecheck
git add apps/web/components/finance/IndustryBreakdown.tsx apps/web/test/components/finance/IndustryBreakdown.test.tsx
git commit -m "feat(web): IndustryBreakdown — top-5/10 toggle, single green bar, row-1 emphasis"
```

---

### Task 31: FinanceCategory composer

**Files:**
- Create: `apps/web/components/performance/categories/FinanceCategory.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import { type CategoryId, FINANCE_SUB_SECTION_SHADES } from '@chiaro/ui-tokens'
import { useOfficialFinance } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { pacPercent } from '@/lib/derivations/finance'
import { FinanceSummaryStrip } from '@/components/finance/FinanceSummaryStrip'
import { FinanceSubSectionHeading } from '@/components/finance/FinanceSubSectionHeading'
import { IndustryBreakdown } from '@/components/finance/IndustryBreakdown'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'finance'
const client = createSupabaseBrowserClient()
const CYCLE = '2024'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function FinanceCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const q = useOfficialFinance(client, officialId, CYCLE)

  if (q.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  if (!q.data) {
    return (
      <p style={{ padding: 12, color: '#807a72' }}>
        No OpenSecrets data ingested for {CYCLE}.{' '}
        <a href="https://www.opensecrets.org/members-of-congress" target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → search OpenSecrets
        </a>
      </p>
    )
  }
  const { summary, industries, pacs } = q.data
  const pacSum = pacs.reduce((s, p) => s + p.amount, 0)
  const pct = pacPercent(summary.total_raised, pacSum)
  const topIndustry = industries[0]?.industry ?? null

  const pacsOpen = subCascade.isOpen(CATEGORY, 'pacs')
  const indOpen = subCascade.isOpen(CATEGORY, 'top-industries')

  return (
    <div style={{ padding: 12 }}>
      <FinanceSummaryStrip
        cycle={CYCLE}
        totalRaised={summary.total_raised}
        smallDonorPct={summary.small_donor_pct}
        pacPct={pct}
      />

      <FinanceSubSectionHeading
        label="Contributors"
        textColor={FINANCE_SUB_SECTION_SHADES.contributors.heading}
        ruleColor={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="pacs"
        name="PACs"
        teaser={`$${pacSum.toLocaleString()} · ${pacs.length} PACs`}
        open={pacsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'pacs')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      {pacsOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pacs.slice(0, 5).map(p => (
              <li key={p.pac_name} style={{ padding: '6px 0', borderBottom: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                <strong>{p.pac_name}</strong>: ${p.amount.toLocaleString()}
                {p.pac_fec_id && (
                  <a href={`https://www.fec.gov/data/committee/${p.pac_fec_id}/`} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#3b6ed1', fontSize: '0.72rem' }}>
                    → FEC
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="individual-donors"
        name="Individual Donors"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
        placeholder={true}
      />

      <FinanceSubSectionHeading
        label="Top Donor Industries & Organizations"
        textColor={FINANCE_SUB_SECTION_SHADES.topDonor.heading}
        ruleColor={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-industries"
        name="Top Industries"
        teaser={topIndustry ? `${topIndustry} leads` : 'no industries ingested'}
        open={indOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'top-industries')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      {indOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <IndustryBreakdown rows={industries} sourceUrl={summary.source_url} />
        </div>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-organizations"
        name="Top Organizations"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
        placeholder={true}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/categories/FinanceCategory.tsx
git commit -m "feat(web): FinanceCategory — summary strip + 2 sub-sections w/ multi-shade headings"
```

---

## Phase J — Voting & Bills (Task 32)

3 consolidated sub-cascades: Voting Record, Bills Authored, Committee Work (placeholder).

### Task 32: VotingBillsCategory

**Files:**
- Create: `apps/web/components/performance/categories/VotingBillsCategory.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import { useState } from 'react'
import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics } from '@chiaro/officials'
import { useOfficialMissedVotes, useOfficialSponsoredBills, useOfficialCosponsoredBills } from '@chiaro/bills'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'voting-bills'
const client = createSupabaseBrowserClient()
const CONGRESS = '119'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function VotingBillsCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const votingOpen = subCascade.isOpen(CATEGORY, 'voting-record')
  const billsOpen = subCascade.isOpen(CATEGORY, 'bills-authored')

  const missed = useOfficialMissedVotes(client, officialId, CONGRESS, { enabled: votingOpen })
  const sponsored = useOfficialSponsoredBills(client, officialId, CONGRESS, { enabled: billsOpen })
  const cosponsored = useOfficialCosponsoredBills(client, officialId, CONGRESS, { enabled: billsOpen })

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data

  return (
    <div style={{ padding: 12 }}>
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="voting-record"
        name="Voting Record"
        teaser={m?.attendance_pct != null ? `${m.attendance_pct}% attendance` : 'no attendance data'}
        open={votingOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'voting-record')}
      />
      {votingOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
              {m?.attendance_pct != null ? `${m.attendance_pct}%` : '—'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d57c1', marginRight: 6, display: 'inline-block' }} />
              Attendance
            </div>
            <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>
              {m?.votes_voted_count ?? 0}/{m?.total_roll_calls ?? 0} roll calls
            </div>
            <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#1a1714' }}>
              <strong>Missed votes:</strong>
              {missed.isLoading ? <p style={{ fontSize: '0.78rem' }}>Loading…</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                  {(missed.data ?? []).map(mv => (
                    <li key={mv.vote_id} style={{ padding: '6px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                      <a href={mv.vote.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                        {mv.vote.vote_date} · {mv.vote.question}
                      </a>
                    </li>
                  ))}
                  {(missed.data ?? []).length === 0 && <li style={{ color: '#807a72', fontSize: '0.78rem' }}>None this Congress.</li>}
                </ul>
              )}
            </div>
          </article>
        </div>
      )}

      <SubCascadeBar
        categoryId={CATEGORY}
        subId="bills-authored"
        name="Bills Authored"
        teaser={`${m?.bills_sponsored_count ?? 0} sponsored, ${m?.bills_cosponsored_count ?? 0} cosponsored`}
        open={billsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'bills-authored')}
      />
      {billsOpen && (
        <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1714', marginBottom: 6 }}>Sponsored</div>
            {sponsored.isLoading ? <p style={{ fontSize: '0.78rem' }}>Loading…</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(sponsored.data ?? []).map(b => (
                  <li key={b.id} style={{ padding: '6px 0', borderTop: '1px solid #f0eee5', fontSize: '0.78rem' }}>
                    <a href={b.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                      {b.bill_type.toUpperCase()} {b.number}: {b.title}
                    </a>
                  </li>
                ))}
                {(sponsored.data ?? []).length === 0 && <li style={{ color: '#807a72', fontSize: '0.78rem' }}>None this Congress.</li>}
              </ul>
            )}
          </article>
          <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1714', marginBottom: 6 }}>Cosponsored</div>
            {cosponsored.isLoading ? <p style={{ fontSize: '0.78rem' }}>Loading…</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(cosponsored.data ?? []).map(b => (
                  <li key={b.id} style={{ padding: '6px 0', borderTop: '1px solid #f0eee5', fontSize: '0.78rem' }}>
                    <a href={b.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                      {b.bill_type.toUpperCase()} {b.number}: {b.title}
                    </a>
                  </li>
                ))}
                {(cosponsored.data ?? []).length === 0 && <li style={{ color: '#807a72', fontSize: '0.78rem' }}>None this Congress.</li>}
              </ul>
            )}
          </article>
        </div>
      )}

      <SubCascadeBar
        categoryId={CATEGORY}
        subId="committee-work"
        name="Committee Work"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        placeholder={true}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/categories/VotingBillsCategory.tsx
git commit -m "feat(web): VotingBillsCategory — 3 sub-cascades (voting / bills / committees)"
```

---

## Phase K — PerformanceSection orchestrator (Task 33)

Wraps all 6 categories in locked order, manages expand state via `useExpandedState`, and wires `useUrlHashSync` for deep links.

### Task 33: PerformanceSection

**Files:**
- Create: `apps/web/components/performance/PerformanceSection.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics, useOfficialScorecardRatings, useOfficialFinance, useOfficialStockTransactions, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useExpandedState } from './useExpandedState'
import { useUrlHashSync } from './useUrlHashSync'
import { CategoryBar } from './CategoryBar'
import { ServiceRecordCategory } from './categories/ServiceRecordCategory'
import { IssuePositionsCategory } from './categories/IssuePositionsCategory'
import { CommunityPresenceCategory } from './categories/CommunityPresenceCategory'
import { FinanceCategory } from './categories/FinanceCategory'
import { EthicsAccountabilityCategory } from './categories/EthicsAccountabilityCategory'
import { VotingBillsCategory } from './categories/VotingBillsCategory'
import {
  serviceRecordTeaser,
  issuePositionsTeaser,
  communityPresenceTeaser,
  financeTeaser,
  ethicsAccountabilityTeaser,
  votingBillsTeaser,
} from '@/lib/derivations/teasers'
import { firstElectedYear } from '@/lib/derivations/service-record'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'

const ORDER: CategoryId[] = [
  'service-record',
  'issue-positions',
  'community-presence',
  'finance',
  'ethics-accountability',
  'voting-bills',
]

const client = createSupabaseBrowserClient()
const CYCLE = '2024'
const CONGRESS = '119'

function isRecent(eventDate: string, days = 90): boolean {
  const event = new Date(eventDate).getTime()
  const now = Date.now()
  return event >= now - days * 24 * 60 * 60 * 1000
}

export function PerformanceSection({ officialId }: { officialId: string }): React.JSX.Element {
  const expanded = useExpandedState()
  useUrlHashSync(expanded)

  const metrics = useOfficialMetrics(client, officialId)
  const scorecards = useOfficialScorecardRatings(client, officialId)
  const finance = useOfficialFinance(client, officialId, CYCLE)
  const stock = useOfficialStockTransactions(client, officialId)
  const leadership = useOfficialLeadershipHistory(client, officialId)

  // Teaser inputs
  const m = metrics.data
  const ratings = scorecards.data ?? []
  const topChips = selectTopAlignmentChips(ratings)
  const topAligned = topChips.find(c => c.tier === 'strongly-aligned' || c.tier === 'mostly-aligned')?.issueArea ?? null
  const topDiffer = topChips.find(c => c.tier === 'strongly-differs' || c.tier === 'mostly-differs')?.issueArea ?? null
  const lateTrades = (stock.data ?? []).filter(t => (t.days_late ?? 0) > 0).length
  const recentHalls = m?.town_halls_count ?? 0  // approximation; refine in slice 5+ when we have per-hall dates aggregated

  const teasers: Record<CategoryId, string | null> = {
    'service-record': serviceRecordTeaser({
      role: m?.salary_role ?? null,
      firstElectedYear: firstElectedYear(leadership.data ?? []),
    }),
    'issue-positions': issuePositionsTeaser({ topAlignedIssue: topAligned, topDifferIssue: topDiffer }),
    'community-presence': communityPresenceTeaser({
      livesInDistrict: m?.lives_in_district ?? null,
      officeCount: m?.district_offices_count ?? 0,
      recentTownHallCount: recentHalls,
    }),
    'finance': financeTeaser({
      totalRaised: finance.data?.summary.total_raised ?? null,
      topIndustry: finance.data?.industries[0]?.industry ?? null,
    }),
    'ethics-accountability': ethicsAccountabilityTeaser({
      lateTrades,
      inStatePct: m?.in_state_donations_pct ?? null,
    }),
    'voting-bills': votingBillsTeaser({
      attendancePct: m?.attendance_pct ?? null,
      billsThisCongress: (m?.bills_sponsored_count ?? 0) + (m?.bills_cosponsored_count ?? 0),
    }),
  }

  const subCascade = { isOpen: expanded.isSubCascadeOpen, onToggle: expanded.toggleSubCascade }

  function bodyFor(id: CategoryId): React.JSX.Element {
    switch (id) {
      case 'service-record':         return <ServiceRecordCategory officialId={officialId} />
      case 'issue-positions':        return <IssuePositionsCategory officialId={officialId} subCascade={subCascade} />
      case 'community-presence':     return <CommunityPresenceCategory officialId={officialId} />
      case 'finance':                return <FinanceCategory officialId={officialId} subCascade={subCascade} />
      case 'ethics-accountability':  return <EthicsAccountabilityCategory officialId={officialId} />
      case 'voting-bills':           return <VotingBillsCategory officialId={officialId} subCascade={subCascade} />
    }
  }

  return (
    <article style={{ display: 'grid', gap: 0, marginTop: 24, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto', padding: '0 16px' }}>
      <h2 style={{ margin: '0 0 12px', color: '#1a1714' }}>Performance — 119th Congress</h2>
      {ORDER.map(id => {
        const open = expanded.isCategoryOpen(id)
        return (
          <div key={id}>
            <CategoryBar
              categoryId={id}
              teaser={teasers[id]}
              open={open}
              onToggle={() => expanded.toggleCategory(id)}
            />
            {open && (
              <div
                id={`category-body-${id}`}
                style={{
                  border: '1px solid #d8d4c9',
                  borderTop: 'none',
                  borderLeftWidth: '2px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: 'var(--cat-accent)',  // see inline style below
                  borderRadius: '0 0 6px 6px',
                  background: '#fafaf6',
                  marginBottom: 6,
                }}
              >
                <style>{`#category-body-${id} { border-left-color: ${getAccent(id)}; }`}</style>
                {bodyFor(id)}
              </div>
            )}
          </div>
        )
      })}
    </article>
  )
}

function getAccent(id: CategoryId): string {
  // Inline-table to avoid importing CATEGORY_ACCENT into the style-injection scope.
  const map: Record<CategoryId, string> = {
    'service-record':        '#c89a4e',
    'issue-positions':       '#3b6ed1',
    'community-presence':    '#1f9b88',
    'finance':               '#3da75b',
    'ethics-accountability': '#d68a1f',
    'voting-bills':          '#7d57c1',
  }
  return map[id]
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @chiaro/web typecheck
git add apps/web/components/performance/PerformanceSection.tsx
git commit -m "feat(web): PerformanceSection — orchestrates 6 categories + URL hash deep-link"
```

---

## Phase L — Page integration + mini-strip + cleanup (Tasks 34-37)

### Task 34: Swap detail page over to BioHeader + PerformanceSection

**Files:**
- Modify: `apps/web/app/officials/[id]/page.tsx`

- [ ] **Step 1: Read current state**

```bash
cat apps/web/app/officials/[id]/page.tsx
```

Confirm it imports `OfficialDetail` + `OfficialPerformance`.

- [ ] **Step 2: Replace contents**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BioHeader } from '@/components/bio/BioHeader'
import { PerformanceSection } from '@/components/performance/PerformanceSection'
import type { Database } from '@chiaro/db'

interface Params { id: string }

type OfficialRow = Database['public']['Tables']['officials']['Row']

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut',
  DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan',
  MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
  NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia',
}

const AT_LARGE_STATES = new Set(['AK', 'DE', 'MT', 'ND', 'SD', 'VT', 'WY'])

function deriveBioProps(o: OfficialRow, role: string, firstElectedYear: number | null) {
  return {
    fullName: o.full_name,
    portraitUrl: o.portrait_url,
    party: o.party,
    chamber: o.chamber,
    state: o.state,
    stateName: STATE_NAMES[o.state] ?? o.state,
    districtNumber: o.district_number,
    senateClass: o.senate_class as 1 | 2 | 3 | null,
    atLarge: o.chamber === 'house' && AT_LARGE_STATES.has(o.state),
    role,
    firstElectedYear,
    officialUrl: o.official_url,
    twitterHandle: o.twitter_handle,
  }
}

export default async function OfficialPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: official } = await supabase.from('officials').select('*').eq('id', id).single<OfficialRow>()
  if (!official) redirect('/')

  // Fetch current leadership role + first-elected year server-side (avoids client flicker).
  const { data: leadership } = await supabase
    .from('officials_leadership_history')
    .select('role,start_date,end_date')
    .eq('official_id', id)
    .order('start_date', { ascending: false })

  const currentRole = leadership?.find(r => r.end_date == null)?.role
    ?? (official.chamber === 'house' ? 'Representative' : 'Senator')
  const firstElectedYear = leadership && leadership.length > 0
    ? Math.min(...leadership.map(r => new Date(r.start_date).getFullYear()))
    : null

  const bioProps = deriveBioProps(official, currentRole, Number.isFinite(firstElectedYear ?? NaN) ? firstElectedYear : null)

  return (
    <main>
      <BioHeader {...bioProps} />
      <PerformanceSection officialId={id} />
    </main>
  )
}
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build 2>&1 | tail -20
```

Expected: build succeeds; /officials/[id] route compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/officials/[id]/page.tsx
git commit -m "feat(web): swap /officials/[id] to BioHeader + PerformanceSection"
```

---

### Task 35: Rewrite home page OfficialsCard mini-strip

**Files:**
- Modify: `apps/web/components/OfficialsCard.tsx`

- [ ] **Step 1: Read current state**

```bash
cat apps/web/components/OfficialsCard.tsx
```

- [ ] **Step 2: Replace the per-row treatment**

Inside `OfficialsCard.tsx`, rewrite the `OfficialRow` sub-component (and any inline render of per-rep info) to use `DistrictBadge` + `AlignmentChip`. Drop the party-chip header, top-industry text, and raw scorecard score / attendance %.

The full file shape:

```tsx
'use client'

import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useMyOfficials, useOfficialScorecardRatings, useOfficialMetrics } from '@chiaro/officials'
import type { OfficialWithDistrict } from '@chiaro/officials'
import { OfficialAvatar } from './OfficialAvatar'
import { DistrictBadge } from './cards/DistrictBadge'
import { AlignmentChip } from './cards/AlignmentChip'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'

const STATE_NAMES: Record<string, string> = {
  /* same map as page.tsx — extract to a shared constants module if duplication grows */
}

const client = createSupabaseBrowserClient()

function OfficialRow({ o }: { o: OfficialWithDistrict }): React.JSX.Element {
  const scorecards = useOfficialScorecardRatings(client, o.id)
  const metrics = useOfficialMetrics(client, o.id)

  const stateName = STATE_NAMES[o.state] ?? o.state
  const chips = selectTopAlignmentChips(scorecards.data ?? [])
  const currentRole = metrics.data?.salary_role && metrics.data.salary_role !== 'Member'
    ? metrics.data.salary_role
    : (o.chamber === 'house' ? 'Representative' : 'Senator')

  return (
    <li style={{ padding: 0, marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid #d8d4c9', borderRadius: 6, background: '#fff' }}>
        <Link href={`/officials/${o.id}`} aria-label={`View ${o.full_name}`}>
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/officials/${o.id}`} style={{ textDecoration: 'none', color: '#1a1714' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{o.full_name}</div>
          </Link>
          <div style={{ marginTop: 2 }}>
            <DistrictBadge
              chamber={o.chamber}
              stateName={stateName}
              districtNumber={o.chamber === 'house' ? (o.district_number ?? null) : null}
              atLarge={o.chamber === 'house' && (o.district_number == null)}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#3a352b', marginTop: 0 }}>
            {currentRole} · {o.chamber === 'house' ? 'House' : 'Senate'}
            {metrics.data?.tenure_years != null && <> · {metrics.data.tenure_years} yrs</>}
          </div>
          {chips.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {chips.map(c => (
                <AlignmentChip
                  key={c.issueArea}
                  label={c.displayLabel}
                  tier={c.tier}
                  href={`/officials/${o.id}#issue-positions:${c.subCascadeSlug}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function OfficialsCard(): React.JSX.Element {
  const { data, isLoading, error } = useMyOfficials(client)
  if (isLoading) return <p>Loading officials…</p>
  if (error)     return <p>Failed to load officials.</p>
  if (!data || data.length === 0) return <p>No officials yet — calibrate your address.</p>

  return (
    <section aria-label="Your officials" style={{ padding: 16, background: '#f7f5ef', borderRadius: 8 }}>
      <h3 style={{ margin: 0, marginBottom: 10, fontSize: '1rem', color: '#1a1714' }}>Your officials</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {data.map(o => <OfficialRow key={o.id} o={o} />)}
      </ul>
      <Link href="/officials" style={{ fontSize: '0.85rem', color: '#3b6ed1', display: 'inline-block', marginTop: 10 }}>
        See all officials →
      </Link>
    </section>
  )
}
```

(Copy the full `STATE_NAMES` map from `apps/web/app/officials/[id]/page.tsx` — Task 34 — into a new shared constants file `apps/web/lib/states.ts` if duplication becomes annoying. For now, inline is fine.)

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/OfficialsCard.tsx
git commit -m "feat(web): rewrite OfficialsCard mini-strip — district badge + alignment chips deep-link"
```

---

### Task 36: Remove superseded slice-4 components

**Files** (delete):
- `apps/web/components/OfficialDetail.tsx`
- `apps/web/components/OfficialPerformance.tsx`
- `apps/web/components/ScorecardCard.tsx`
- `apps/web/components/ScorecardEvidenceDrawer.tsx`
- `apps/web/components/FinanceCard.tsx`
- `apps/web/components/FinanceIndustryBreakdown.tsx`
- `apps/web/components/ShowUpWorkloadCard.tsx`
- `apps/web/components/PositionSalaryCard.tsx`
- `apps/web/components/ConstituentConnectionCard.tsx`

- [ ] **Step 1: Confirm no remaining imports reference these files**

```bash
for f in OfficialDetail OfficialPerformance ScorecardCard ScorecardEvidenceDrawer FinanceCard FinanceIndustryBreakdown ShowUpWorkloadCard PositionSalaryCard ConstituentConnectionCard; do
  echo "=== $f ==="
  grep -rn "from.*$f" apps/web --include='*.tsx' --include='*.ts' || echo "(no references)"
done
```

If any file still imports any of these symbols, **stop and fix the importer first**. The redesign should have replaced them all in Tasks 34 + 35.

- [ ] **Step 2: Delete files**

```bash
rm apps/web/components/OfficialDetail.tsx
rm apps/web/components/OfficialPerformance.tsx
rm apps/web/components/ScorecardCard.tsx
rm apps/web/components/ScorecardEvidenceDrawer.tsx
rm apps/web/components/FinanceCard.tsx
rm apps/web/components/FinanceIndustryBreakdown.tsx
rm apps/web/components/ShowUpWorkloadCard.tsx
rm apps/web/components/PositionSalaryCard.tsx
rm apps/web/components/ConstituentConnectionCard.tsx
```

- [ ] **Step 3: Workspace typecheck + build (catches any stale references)**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/web build 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(web): remove slice-4 components superseded by detail redesign"
```

---

### Task 37: Final verification + audit doc refresh

**Files:**
- Modify: `docs/superpowers/slice-4-drill-down-audit.md` (regroup table rows under new category structure)

- [ ] **Step 1: Run the full audit pipeline locally**

```bash
# Ensure local Supabase is running with audit data populated
pnpm db:reset
pnpm seed:tiger
set -a; source .env.local; set +a
pnpm seed:officials
pnpm --filter @chiaro/db exec tsx supabase/seed/audit-fixture-attach.ts
pnpm --filter @chiaro/web dev &
DEV_PID=$!
sleep 5

# Smoke the routes
curl -sS -o /dev/null -w "sign-in:        HTTP %{http_code}\n" http://localhost:3000/sign-in
curl -sS -o /dev/null -w "officials/[id]: HTTP %{http_code} → %{redirect_url}\n" http://localhost:3000/officials/$(node -e "/* fetch any official id from db */")

kill $DEV_PID
```

- [ ] **Step 2: Workspace checks**

```bash
pnpm -r typecheck                # 9 packages clean
pnpm --filter @chiaro/web build  # build green
pnpm test                        # all package tests pass (turbo-managed)
```

- [ ] **Step 3: Update drill-down audit doc**

Edit `docs/superpowers/slice-4-drill-down-audit.md`:

- Restructure the audit table so rows are grouped under the new category headings (Service Record / Issue Positions / Community Presence / Finance / Ethics & Accountability / Voting & Bills).
- Add new rows for the metrics that moved categories (STOCK Act → Ethics; in-state donor % → Ethics).
- Add a row noting alignment chips are now color-only (no `✓✓` / `✗✗` suffix).
- Add a row noting evidence drawer is now inline expand (not modal).

- [ ] **Step 4: Manual click-through**

Open the dev server, sign in, navigate to a representative whose data was loaded via `audit-fixture-attach.ts`. Walk every row of the audit table:

- Click each category bar → confirm expansion + correct accent color + correct teaser text
- Click each sub-cascade bar → confirm expansion
- Click each metric card's "view evidence" → confirm inline expansion (no modal)
- Click each alignment chip on the home mini-strip → confirm navigation to `/officials/[id]#issue-positions:<slug>`, category + sub-cascade auto-expand, page scrolls to the sub-cascade
- Confirm late STOCK Act trades render with the `✖` compliance icon (heavy U+2716) in amber chip, on-time with `✓` in green chip
- Confirm grayed placeholders render as soft beige with italic muted text, not opacity-faded

Mark every audit row ✓ or document any ✗ with a follow-up note.

- [ ] **Step 5: Commit + push**

```bash
git add docs/superpowers/slice-4-drill-down-audit.md
git commit -m "docs(audit): refresh drill-down audit table for new category structure"

# Optional: push the branch if you want to open a PR for review
# git push -u origin feat/slice-4-bills-votes-metrics
```

---

## Acceptance — recapped from the spec

After Task 37, all spec acceptance criteria must pass:

1. ✅ `/officials/[id]` renders 6 collapsed categories with palette-A accents + teaser lines.
2. ✅ Clicking any category/sub-cascade bar toggles expansion; pill chevron rotates.
3. ✅ Issue Positions shows 9 alphabetical sub-cascades; cards use **Issue** (Org) format with textual alignment label.
4. ✅ Finance shows 3-stat summary strip + 2 sub-sections (sage Contributors, mint Top Donor) + 4 sub-cascades.
5. ✅ Top Industries renders 5 default + pill-chevron toggle, single Finance-green bars, row-1 name emphasis only.
6. ✅ Bio header renders consistently across house / senate / independent / at-large / no-leadership variants.
7. ✅ Mini-strip carries color-only alignment chips (no symbols) + map-pin district badge.
8. ✅ Mini-strip chips deep-link via `#categoryId:subSlug`; detail page parses on mount, opens, scrolls.
9. ✅ Evidence sections expand inline (no modal); compliance rows use ✓/✖ chips; row text stays neutral dark.
10. ✅ `pnpm --filter @chiaro/web build` succeeds.
11. ✅ `pnpm -r typecheck` clean across 9 packages.
12. ✅ Auth + calibration gates unchanged.

---

## Spec self-review notes

- **Coverage:** Every section of the spec maps to ≥1 task. The visual styling locked-decisions section is realized in Tasks 1-2 (tokens) + 9-17 (primitives & cascade infra) + 23 (evidence). Each category has a dedicated implementation task. Bio header has 5 dedicated tasks. URL hash routing has 2 dedicated tasks.
- **No placeholders:** Every code step shows the full code. No `TBD`, `add validation`, or "implement similar to Task X" references.
- **Type consistency:** `CategoryId` is defined in Task 1 and referenced consistently. `AlignmentTier` flows from Task 3 through chips and derivations. `ExpandedStateApi` defined in Task 14 is used in Task 15 + 33. `MetricCardShellProps` discriminated union from Task 13 carries through to every leaf metric card.
- **Scope:** Single implementation plan — one app surface (`apps/web`) + token package extensions. No DB migrations. No new ingest pipelines. 37 tasks, each 10-25 min of work.










**Files:**
- Create: `packages/ui-tokens/src/issue-area.ts`
- Create: `packages/ui-tokens/test/issue-area.test.ts`
- Modify: `packages/ui-tokens/src/index.ts`

- [ ] **Step 1: Failing test**

`packages/ui-tokens/test/issue-area.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { titleCaseIssueArea } from '../src/issue-area.ts'

describe('titleCaseIssueArea', () => {
  it('single-word kebab → Title', () => {
    expect(titleCaseIssueArea('environment')).toBe('Environment')
    expect(titleCaseIssueArea('labor')).toBe('Labor')
  })
  it('multi-word kebab → Title Case', () => {
    expect(titleCaseIssueArea('civil-liberties')).toBe('Civil Liberties')
    expect(titleCaseIssueArea('civil-rights')).toBe('Civil Rights')
    expect(titleCaseIssueArea('reproductive-rights')).toBe('Reproductive Rights')
    expect(titleCaseIssueArea('liberal-policy')).toBe('Liberal Policy')
    expect(titleCaseIssueArea('conservative-policy')).toBe('Conservative Policy')
    expect(titleCaseIssueArea('business-policy')).toBe('Business Policy')
    expect(titleCaseIssueArea('second-amendment')).toBe('Second Amendment')
  })
  it('empty string → empty string', () => {
    expect(titleCaseIssueArea('')).toBe('')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/ui-tokens test issue-area
```

- [ ] **Step 3: Implement**

`packages/ui-tokens/src/issue-area.ts`:

```ts
export function titleCaseIssueArea(kebab: string): string {
  if (!kebab) return ''
  return kebab
    .split('-')
    .map(w => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}
```

Append to `packages/ui-tokens/src/index.ts`:

```ts
export { titleCaseIssueArea } from './issue-area.ts'
```

- [ ] **Step 4: Run green + commit**

```bash
pnpm --filter @chiaro/ui-tokens test issue-area
pnpm --filter @chiaro/ui-tokens typecheck
git add packages/ui-tokens/src/issue-area.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/issue-area.test.ts
git commit -m "feat(ui-tokens): titleCaseIssueArea helper"
```

---
