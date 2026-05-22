# Federal Officials Redesign Implementation Plan (slice 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/officials/[id]` web + mobile to use the slice 5xx state-card collapsible-subsection pattern. 6 new `FederalXxxCard` components replace 6 `CategoryId` components + `PerformanceSection.tsx`.

**Architecture:** Zero schema changes; zero new hooks; workspace stays at 10 packages. Pure UI refactor with template literals from slice 5I (state-card pattern). 22 new components (11 sub-lists × 2 platforms) + 12 cards (6 × 2 platforms) + detail-page swaps. ~25 file deletions at slice end.

**Tech Stack:** Next.js 15 + React 19 (web), Expo + react-native (mobile), TanStack Query v5, `@chiaro/officials` + `@chiaro/bills` hooks (unchanged), `@chiaro/ui-tokens` color vocabulary.

**Spec:** `docs/superpowers/specs/2026-05-22-federal-officials-redesign-design.md`

---

## File structure

**Created (~46):**
```
apps/web/components/federal/                          # NEW dir
  FederalServiceRecordCard.tsx + .test.tsx
  FederalFinanceCard.tsx + .test.tsx
  FederalIssuePositionsCard.tsx + .test.tsx
  FederalCommunityPresenceCard.tsx + .test.tsx
  FederalEthicsAccountabilityCard.tsx + .test.tsx
  FederalVotingBillsCard.tsx + .test.tsx
  FederalKPIList.tsx + .test.tsx
  FederalLeadershipList.tsx + .test.tsx
  FederalDonorsList.tsx + .test.tsx
  FederalPACsList.tsx + .test.tsx
  FederalScorecardRatingsList.tsx + .test.tsx
  FederalTownHallsList.tsx + .test.tsx
  FederalDistrictOfficesList.tsx + .test.tsx
  FederalStockTransactionsList.tsx + .test.tsx
  FederalSponsoredBillsList.tsx + .test.tsx
  FederalCosponsoredBillsList.tsx + .test.tsx
  FederalMissedVotesList.tsx + .test.tsx

apps/mobile/components/federal/                       # NEW dir (mirror)
  (same 17 components, RN primitives + jest-expo tests)
```

**Modified:**
```
apps/web/app/officials/[id]/page.tsx                  # mount 6 federal cards instead of PerformanceSection
apps/web/app/officials/[id]/page.test.tsx             # update mocks + assertions (if exists)
apps/mobile/app/(app)/officials/[id].tsx              # mount 6 federal cards instead of PerformanceSection
apps/mobile/app/(app)/officials/[id].test.tsx         # mirror
CLAUDE.md                                             # slice 6 entry + Gotcha #15 (federal/state asymmetries)
```

**Deleted at slice end (~25 files):**
```
apps/web/components/performance/PerformanceSection.tsx
apps/web/components/performance/categories/{CommunityPresenceCategory,EthicsAccountabilityCategory,FinanceCategory,IssuePositionsCategory,ServiceRecordCategory,VotingBillsCategory}.tsx
apps/web/test/components/performance/*.test.tsx       # if exists
apps/mobile/components/performance/PerformanceSection.tsx
apps/mobile/components/performance/CategoryBar.tsx
apps/mobile/components/performance/SubCascadeBar.tsx
apps/mobile/components/performance/useExpandedState.ts
apps/mobile/components/performance/useExpoParamSync.ts
apps/mobile/components/performance/categories/{6 files}.tsx
apps/mobile/test/components/performance/*.test.tsx   # if exists
```

---

## Task 1: Scaffold federal directories + verify existing baseline

**Files:**
- Create: `apps/web/components/federal/.gitkeep`
- Create: `apps/mobile/components/federal/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p apps/web/components/federal apps/web/test/components/federal apps/mobile/components/federal apps/mobile/test/components/federal
```

Write empty `.gitkeep` files into each via the Write tool.

- [ ] **Step 2: Verify existing federal hooks are exported**

```bash
grep -E "useOfficial(Metrics|LeadershipHistory|Finance|ScorecardRatings|DistrictOffices|TownHalls|StockTransactions)" packages/officials/src/index.ts
grep -E "useOfficial(SponsoredBills|CosponsoredBills|MissedVotes)" packages/bills/src/index.ts
```

Expected: all 10 federal hook exports visible. (If any missing, surface in this task — fix is a 1-line addition to the barrel.)

- [ ] **Step 3: Verify mount points**

```bash
grep -n "PerformanceSection" apps/web/app/officials/[id]/page.tsx
grep -n "PerformanceSection" apps/mobile/app/\(app\)/officials/[id].tsx
```

Expected: each file mounts `<PerformanceSection officialId=... chamber=... />` once.

- [ ] **Step 4: Workspace baseline check**

```bash
pnpm -r typecheck 2>&1 | tail -5
```

Expected: all 10 packages clean before slice work begins.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/federal/.gitkeep apps/web/test/components/federal/.gitkeep apps/mobile/components/federal/.gitkeep apps/mobile/test/components/federal/.gitkeep
git commit -m "chore: scaffold apps/{web,mobile}/components/federal/ dirs

Slice 6 — federal officials redesign. New directories receive 17 component
files per platform (6 cards + 11 sub-lists) over the slice. Mount points
verified at apps/web/app/officials/[id]/page.tsx:125 + apps/mobile/app/
(app)/officials/[id].tsx:75."
```

---

## Task 2: Web sub-lists — Service Record (KPI + Leadership)

**Files:**
- Create: `apps/web/components/federal/FederalKPIList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalLeadershipList.tsx` + `.test.tsx`

Both are pure-props components (no hooks).

- [ ] **Step 1: Implement FederalKPIList**

```tsx
'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type MetricsRow = Database['public']['Tables']['official_metrics']['Row']

interface Props {
  metrics: MetricsRow | null | undefined
  hideLivesInDistrict?: boolean   // Senate guard
}

interface Tile {
  label: string
  value: string
}

function fmtPct(n: number | null | undefined): string {
  return n == null ? '—' : `${n}%`
}

function fmtCount(n: number | null | undefined): string {
  return n == null ? '—' : String(n)
}

function fmtLivesInDistrict(b: boolean | null | undefined): string {
  if (b == null) return '—'
  return b ? '✓ Yes' : '✗ No'
}

export function FederalKPIList({ metrics, hideLivesInDistrict }: Props) {
  if (!metrics) {
    return <div style={mutedStyle}>No KPI data available.</div>
  }

  const tiles: Tile[] = [
    { label: 'Bills sponsored',   value: fmtCount(metrics.bills_sponsored_count) },
    { label: 'Bills cosponsored', value: fmtCount(metrics.bills_cosponsored_count) },
    { label: 'Attendance',        value: fmtPct(metrics.attendance_pct) },
    { label: 'Subject breadth',   value: fmtCount(metrics.subject_breadth) },
  ]
  if (!hideLivesInDistrict) {
    tiles.push({
      label: 'Lives in district',
      value: fmtLivesInDistrict(metrics.lives_in_district),
    })
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 8, padding: '8px 12px',
    }}>
      {tiles.map(t => (
        <div key={t.label} style={tileStyle}>
          <div style={tileValueStyle}>{t.value}</div>
          <div style={tileLabelStyle}>{t.label}</div>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
const tileStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.surface,
  borderRadius: 6, padding: 8, textAlign: 'center',
}
const tileValueStyle: React.CSSProperties = {
  fontWeight: 600, color: COLORS.brand.text, fontSize: 15,
}
const tileLabelStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 11, marginTop: 4,
}
```

- [ ] **Step 2: Test FederalKPIList**

Create `apps/web/test/components/federal/FederalKPIList.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalKPIList } from '@/components/federal/FederalKPIList'

describe('FederalKPIList', () => {
  it('renders empty state when metrics is null', () => {
    const { getByText } = render(<FederalKPIList metrics={null} />)
    expect(getByText(/No KPI data available/i)).toBeTruthy()
  })

  it('renders 5 tiles for House member', () => {
    const metrics = {
      bills_sponsored_count: 12, bills_cosponsored_count: 45,
      attendance_pct: 96, subject_breadth: 8,
      lives_in_district: true,
    } as never
    const { getByText } = render(<FederalKPIList metrics={metrics} />)
    expect(getByText(/12/)).toBeTruthy()
    expect(getByText(/96%/)).toBeTruthy()
    expect(getByText(/✓ Yes/)).toBeTruthy()
    expect(getByText(/Lives in district/)).toBeTruthy()
  })

  it('hides lives_in_district tile when hideLivesInDistrict=true (Senate)', () => {
    const metrics = {
      bills_sponsored_count: 1, bills_cosponsored_count: 1,
      attendance_pct: 95, subject_breadth: 1, lives_in_district: null,
    } as never
    const { queryByText } = render(<FederalKPIList metrics={metrics} hideLivesInDistrict />)
    expect(queryByText(/Lives in district/)).toBeNull()
  })

  it('em-dash NULL convention for unset metrics', () => {
    const metrics = {
      bills_sponsored_count: null, bills_cosponsored_count: null,
      attendance_pct: null, subject_breadth: null, lives_in_district: null,
    } as never
    const { getAllByText } = render(<FederalKPIList metrics={metrics} />)
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 3: Implement FederalLeadershipList**

```tsx
'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

interface Props { rows: LeadershipRow[] }

export function FederalLeadershipList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No leadership positions on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <div key={r.id} style={{
          padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, color: COLORS.brand.text }}>
            {r.title} {r.committee ? `· ${r.committee}` : ''}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.start_date}{r.end_date ? ` – ${r.end_date}` : ' – present'}
          </div>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 4: Test FederalLeadershipList**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalLeadershipList } from '@/components/federal/FederalLeadershipList'

describe('FederalLeadershipList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalLeadershipList rows={[]} />)
    expect(getByText(/No leadership positions on file/i)).toBeTruthy()
  })

  it('renders title + committee + dates', () => {
    const rows = [{
      id: 'l1', official_id: 'oid', title: 'Chair',
      committee: 'Committee on Ways and Means',
      start_date: '2023-01-03', end_date: null,
      created_at: '2023-01-01',
    }] as never[]
    const { getByText } = render(<FederalLeadershipList rows={rows} />)
    expect(getByText(/Chair · Committee on Ways and Means/)).toBeTruthy()
    expect(getByText(/2023-01-03 – present/)).toBeTruthy()
  })

  it('renders end_date when present', () => {
    const rows = [{
      id: 'l1', official_id: 'oid', title: 'Ranking Member',
      committee: 'Energy and Commerce',
      start_date: '2021-01-03', end_date: '2023-01-03',
      created_at: '2021-01-01',
    }] as never[]
    const { getByText } = render(<FederalLeadershipList rows={rows} />)
    expect(getByText(/2021-01-03 – 2023-01-03/)).toBeTruthy()
  })
})
```

If the actual `officials_leadership_history` schema has different column names (e.g., `name` not `title`), adjust the implementation + test to match. Run a quick `cat packages/db/src/types.ts | grep -A 12 officials_leadership_history` to verify column names before implementing.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(KPI|Leadership)List'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{KPI,Leadership}List.tsx apps/web/test/components/federal/Federal{KPI,Leadership}List.test.tsx
git commit -m "feat(web): FederalKPIList + FederalLeadershipList sub-list components

Pure-props components for FederalServiceRecordCard.

FederalKPIList: grid of 5 metric tiles (bills_sponsored / cosponsored /
attendance % / subject_breadth / lives_in_district). hideLivesInDistrict
prop guards the Senate case. Em-dash NULL convention per
[[feedback-null-vs-zero-metrics]].

FederalLeadershipList: title + committee + date-range rows from
officials_leadership_history. Empty state when no positions on file.

~7 vitest cases."
```

---

## Task 3: Web sub-lists — Finance + Issue Positions (Donors + PACs + Scorecards)

**Files:**
- Create: `apps/web/components/federal/FederalDonorsList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalPACsList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalScorecardRatingsList.tsx` + `.test.tsx`

All 3 are pure-props.

- [ ] **Step 1: Implement FederalDonorsList**

Federal finance shape differs from state. Verify the `OfficialFinance` type shape in `@chiaro/officials`:

```bash
grep -A 10 "export interface OfficialFinance" packages/officials/src/queries.ts
```

If `OfficialFinance.top_individual_donors` is `Array<{ name: string; amount: number; cycle?: string }>`, use it. Adjust field names to match the actual shape.

Create the component:

```tsx
'use client'

import type { OfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { finance: OfficialFinance | null | undefined }

function fmtAmount(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalDonorsList({ finance }: Props) {
  const donors = finance?.top_individual_donors ?? []
  if (donors.length === 0) {
    return <div style={mutedStyle}>No individual donor data available.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {donors.slice(0, 10).map((d, i) => (
        <div key={`${d.name}-${i}`} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13,
        }}>
          <span style={{ fontWeight: 500, color: COLORS.brand.text }}>{d.name}</span>
          <span style={{ color: COLORS.brand.text, fontWeight: 600 }}>{fmtAmount(d.amount)}</span>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 2: Test FederalDonorsList**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalDonorsList } from '@/components/federal/FederalDonorsList'

describe('FederalDonorsList', () => {
  it('renders empty when finance is null', () => {
    const { getByText } = render(<FederalDonorsList finance={null} />)
    expect(getByText(/No individual donor data available/i)).toBeTruthy()
  })

  it('renders donors with formatted amounts', () => {
    const finance = {
      top_individual_donors: [
        { name: 'Doe, John', amount: 5800 },
        { name: 'Smith, Jane', amount: 3000 },
      ],
      top_pacs: [],
    } as never
    const { getByText } = render(<FederalDonorsList finance={finance} />)
    expect(getByText(/Doe, John/)).toBeTruthy()
    expect(getByText(/\$6K/)).toBeTruthy()  // 5800 rounds to $6K
  })

  it('caps at 10 donors', () => {
    const donors = Array.from({ length: 15 }, (_, i) => ({ name: `Donor ${i}`, amount: 1000 }))
    const finance = { top_individual_donors: donors, top_pacs: [] } as never
    const { getByText, queryByText } = render(<FederalDonorsList finance={finance} />)
    expect(getByText(/Donor 9/)).toBeTruthy()
    expect(queryByText(/Donor 10/)).toBeNull()
  })
})
```

- [ ] **Step 3: Implement FederalPACsList**

Same shape as FederalDonorsList but pulls `finance?.top_pacs`:

```tsx
'use client'

import type { OfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { finance: OfficialFinance | null | undefined }

function fmtAmount(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalPACsList({ finance }: Props) {
  const pacs = finance?.top_pacs ?? []
  if (pacs.length === 0) {
    return <div style={mutedStyle}>No PAC contribution data available.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {pacs.slice(0, 10).map((p, i) => (
        <div key={`${p.name}-${i}`} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13,
        }}>
          <span style={{ fontWeight: 500, color: COLORS.brand.text }}>{p.name}</span>
          <span style={{ color: COLORS.brand.text, fontWeight: 600 }}>{fmtAmount(p.amount)}</span>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

Test scaffold mirrors FederalDonorsList (3 cases: empty / renders / caps at 10).

- [ ] **Step 4: Implement FederalScorecardRatingsList**

Verify the `ScorecardRatingWithOrg` type shape:

```bash
grep -A 10 "export interface ScorecardRatingWithOrg" packages/officials/src/queries.ts
```

Mirror state's `StateIssuePositionsCard` lean-grouping pattern:

```tsx
'use client'

import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { COLORS, SCORECARD_LEAN_LABEL, SCORECARD_LEAN_COLOR } from '@chiaro/ui-tokens'

interface Props { rows: ScorecardRatingWithOrg[] }

const LEAN_GROUP_ORDER = ['progressive', 'conservative', 'single-issue', 'libertarian', 'centrist'] as const

export function FederalScorecardRatingsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No scorecard ratings on file.</div>
  }

  const byLean = new Map<string, ScorecardRatingWithOrg[]>()
  for (const r of rows) {
    const lean = r.org?.lean ?? 'centrist'
    if (!byLean.has(lean)) byLean.set(lean, [])
    byLean.get(lean)!.push(r)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      {LEAN_GROUP_ORDER.filter(l => byLean.has(l)).map(lean => (
        <div key={lean}>
          <h4 style={{
            fontSize: 13, fontWeight: 600,
            color: SCORECARD_LEAN_COLOR[lean as keyof typeof SCORECARD_LEAN_COLOR] ?? COLORS.neutral.textMuted,
            margin: '0 0 6px 0',
          }}>
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </h4>
          {byLean.get(lean)!.map(r => (
            <div key={r.id} style={{
              padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
              borderRadius: 6, fontSize: 13, marginBottom: 4,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ color: COLORS.brand.text }}>
                {r.org?.name ?? '(unknown org)'}
                {r.org?.issue_area && (
                  <span style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginLeft: 6 }}>
                    · {r.org.issue_area}
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 600, color: COLORS.brand.text }}>
                {Number(r.score).toFixed(0)} / {r.org?.scoring_max ?? 100}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

Test (~2 cases: empty / lean-grouping):

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalScorecardRatingsList } from '@/components/federal/FederalScorecardRatingsList'

describe('FederalScorecardRatingsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalScorecardRatingsList rows={[]} />)
    expect(getByText(/No scorecard ratings on file/i)).toBeTruthy()
  })

  it('groups ratings by lean', () => {
    const rows = [
      { id: 'r1', score: '95', org: { name: 'ACLU', issue_area: 'civil-liberties', lean: 'progressive', scoring_max: 100 } },
      { id: 'r2', score: '20', org: { name: 'NRA',  issue_area: 'second-amendment', lean: 'conservative', scoring_max: 100 } },
    ] as never[]
    const { getByText } = render(<FederalScorecardRatingsList rows={rows} />)
    expect(getByText(/Progressive/)).toBeTruthy()
    expect(getByText(/Conservative/)).toBeTruthy()
    expect(getByText(/ACLU/)).toBeTruthy()
    expect(getByText(/NRA/)).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(Donors|PACs|ScorecardRatings)List'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{Donors,PACs,ScorecardRatings}List.tsx apps/web/test/components/federal/Federal{Donors,PACs,ScorecardRatings}List.test.tsx
git commit -m "feat(web): FederalDonorsList + FederalPACsList + FederalScorecardRatingsList

Pure-props sub-list components for FederalFinanceCard (donors + PACs)
and FederalIssuePositionsCard (scorecard ratings grouped by lean).

Donors + PACs cap at top 10 with shared fmtAmount helper.
Scorecards mirror state lean-grouping pattern (5G).

~8 vitest cases."
```

---

## Task 4: Web sub-lists — Community Presence + Ethics (TownHalls + Offices + Stock)

**Files:**
- Create: `apps/web/components/federal/FederalTownHallsList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalDistrictOfficesList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalStockTransactionsList.tsx` + `.test.tsx`

- [ ] **Step 1: Implement FederalTownHallsList**

Federal `town_halls` schema (from migration 0022) has columns: `id`, `official_id`, `event_date`, `city`, `state`, `format` enum, `attendance_estimate`, `source_url`, `ingested_at`. **No `source` or `external_id` columns** (those are state-only). Verify via:

```bash
grep -A 12 "town_halls.*Row" packages/db/src/types.ts | head -20
```

```tsx
'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type TownHallRow = Database['public']['Tables']['town_halls']['Row']

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person', virtual: 'Virtual', phone: 'Phone', hybrid: 'Hybrid',
}

interface Props { rows: TownHallRow[] }

export function FederalTownHallsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No town halls in the past 12 months.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <a key={r.id} href={r.source_url} target="_blank" rel="noopener noreferrer"
           style={{
             padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
             borderRadius: 6, fontSize: 13, textDecoration: 'none', color: COLORS.brand.text,
             display: 'block',
           }}>
          <div style={{ fontWeight: 500 }}>
            {r.event_date}{r.city ? ` · ${r.city}, ${r.state ?? ''}` : ''}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
            {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
          </div>
        </a>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

Test (~2 cases): empty / renders.

- [ ] **Step 2: Implement FederalDistrictOfficesList**

Per spec: hide `kind='capitol'` rows since the capitol office is shown in the bio header already.

```tsx
'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type OfficeRow = Database['public']['Tables']['district_offices']['Row']

const KIND_LABEL: Record<string, string> = {
  district: 'District Office', satellite: 'Satellite Office',
}

interface Props { rows: OfficeRow[] }

export function FederalDistrictOfficesList({ rows }: Props) {
  // Hide capitol-office rows (already in bio header)
  const filtered = rows.filter(r => r.kind !== 'capitol')
  if (filtered.length === 0) {
    return <div style={mutedStyle}>No district offices on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      {filtered.map(r => (
        <div key={r.id} style={{ fontSize: 13, color: COLORS.brand.text }}>
          <div style={{ fontWeight: 600 }}>
            {KIND_LABEL[r.kind ?? 'district'] ?? r.kind ?? 'Office'} · {r.city ?? ''}, {r.state ?? ''}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.address ?? '(no address)'}
            {r.phone && (
              <>
                <br />
                {r.phone}
              </>
            )}
            {r.hours_text && (
              <>
                <br />
                Hours: {r.hours_text}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

Verify `district_offices` schema columns via `grep -A 12 "district_offices.*Row" packages/db/src/types.ts`. If `kind` doesn't exist on federal (state-only column), strip the filter and use all rows. If `address` is split into `street_1`/`city`/`state`/`zip`, concatenate.

Test (~3 cases): empty / renders / capitol hidden.

- [ ] **Step 3: Implement FederalStockTransactionsList**

Federal `stock_transactions` schema (0022) has `days_late` generated column with 45-day deadline (vs state 30). Verify via `grep -A 15 "stock_transactions.*Row" packages/db/src/types.ts`.

```tsx
'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type TxnRow = Database['public']['Tables']['stock_transactions']['Row']

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', sale: 'Sale', exchange: 'Exchange',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

interface Props { rows: TxnRow[] }

export function FederalStockTransactionsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No stock transactions on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => {
        const low = r.amount_range_low == null ? null : Number(r.amount_range_low)
        const high = r.amount_range_high == null ? null : Number(r.amount_range_high)
        return (
          <a key={r.id} href={r.source_url} target="_blank" rel="noopener noreferrer"
             style={{
               display: 'flex', justifyContent: 'space-between', gap: 12,
               padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
               borderRadius: 6, fontSize: 13, textDecoration: 'none', color: COLORS.brand.text,
             }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>
                {r.transaction_date} · {r.asset_ticker ?? r.asset_name ?? 'Unknown asset'}
              </div>
              <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
                {r.transaction_type ? TYPE_LABEL[r.transaction_type] ?? r.transaction_type : 'Type n/a'}
                {' · '}{formatAmountRange(low, high)}
              </div>
            </div>
            {(r.days_late ?? 0) > 0 && (
              <span style={{
                alignSelf: 'center', fontSize: 11, fontWeight: 600,
                color: COLORS.signal.warning,
                padding: '2px 6px', borderRadius: 4,
                backgroundColor: `${COLORS.signal.warning}22`,
              }}>
                {r.days_late}d late
              </span>
            )}
          </a>
        )
      })}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

Test (~3 cases): empty / renders / late-chip warning.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(TownHalls|DistrictOffices|StockTransactions)List'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{TownHalls,DistrictOffices,StockTransactions}List.tsx apps/web/test/components/federal/Federal{TownHalls,DistrictOffices,StockTransactions}List.test.tsx
git commit -m "feat(web): FederalTownHallsList + FederalDistrictOfficesList + FederalStockTransactionsList

Pure-props sub-list components for FederalCommunityPresenceCard
(town halls + offices) and FederalEthicsAccountabilityCard (stock
transactions).

FederalDistrictOfficesList hides kind='capitol' (already in bio header).
FederalStockTransactionsList shows 'Nd late' warning chip when days_late
> 0 (federal 45-day deadline).

~8 vitest cases."
```

---

## Task 5: Web sub-lists — Voting Bills (Sponsored + Cosponsored + Missed Votes)

**Files:**
- Create: `apps/web/components/federal/FederalSponsoredBillsList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalCosponsoredBillsList.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalMissedVotesList.tsx` + `.test.tsx`

- [ ] **Step 1: Verify @chiaro/bills row shapes**

```bash
grep -A 8 "export type.*BillRow\|MissedVoteRow" packages/bills/src/types.ts
```

Bill row likely has: `id`, `bill_type` (HR/S/HJRES/etc.), `number`, `title`, `status`, `introduced_date`. Missed vote: `roll_call_number`, `vote_date`, `question`, `position` ('missed'), `bill_id`.

- [ ] **Step 2: Implement FederalSponsoredBillsList**

```tsx
'use client'

import type { BillSummaryRow } from '@chiaro/bills'  // or wherever the type lives
import { COLORS } from '@chiaro/ui-tokens'

function statusColor(status: string | null | undefined): string {
  if (!status) return COLORS.neutral.textMuted
  const s = status.toLowerCase()
  if (s.includes('passed') || s.includes('signed') || s.includes('became law')) return COLORS.signal.success
  if (s.includes('committee') || s.includes('introduced')) return COLORS.neutral.textMuted
  if (s.includes('failed') || s.includes('vetoed')) return COLORS.signal.error
  return COLORS.neutral.textMuted
}

interface Props { rows: BillSummaryRow[] }

export function FederalSponsoredBillsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No sponsored bills.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.slice(0, 25).map(r => {
        const color = statusColor(r.status)
        return (
          <div key={r.id} style={{
            padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
            borderRadius: 6, fontSize: 13,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 500, color: COLORS.brand.text }}>
                {r.bill_type} {r.number}
              </span>
              {r.status && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color, padding: '2px 6px', borderRadius: 4,
                  backgroundColor: `${color}22`,
                }}>
                  {r.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: COLORS.brand.text }}>{r.title}</div>
          </div>
        )
      })}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

Adapt `BillSummaryRow` to the actual exported type name from `@chiaro/bills`. If types aren't barrel-exported, import via `Database['public']['Tables']['bills']['Row']` instead.

- [ ] **Step 3: Implement FederalCosponsoredBillsList**

**Identical implementation to FederalSponsoredBillsList** but empty-state copy is `"No cosponsored bills."`. Cap at 25 rows.

- [ ] **Step 4: Implement FederalMissedVotesList**

```tsx
'use client'

import type { MissedVoteRow } from '@chiaro/bills'  // verify actual type name
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: MissedVoteRow[] }

export function FederalMissedVotesList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No missed votes in current Congress.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.slice(0, 25).map(r => (
        <div key={`${r.roll_call_number}-${r.vote_date}`} style={{
          padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 500, color: COLORS.brand.text }}>
              {r.vote_date} · Roll Call #{r.roll_call_number}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: COLORS.signal.warning,
              padding: '2px 6px', borderRadius: 4,
              backgroundColor: `${COLORS.signal.warning}22`,
            }}>
              MISSED
            </span>
          </div>
          {r.question && (
            <div style={{ fontSize: 12, color: COLORS.brand.text }}>{r.question}</div>
          )}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 5: Tests**

`~7 vitest cases total` across the 3 files. Each test file: empty state + renders + (where applicable) cap-at-25 or status-color logic.

- [ ] **Step 6: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(SponsoredBills|CosponsoredBills|MissedVotes)List'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{SponsoredBills,CosponsoredBills,MissedVotes}List.tsx apps/web/test/components/federal/Federal{SponsoredBills,CosponsoredBills,MissedVotes}List.test.tsx
git commit -m "feat(web): FederalSponsoredBillsList + Cosponsored + MissedVotes

Pure-props sub-list components for FederalVotingBillsCard.

FederalSponsoredBillsList: bill_type + number + title + status chip
with semantic color (success for passed/signed, error for failed/vetoed,
muted for in-committee/introduced).
FederalCosponsoredBillsList: same shape; different empty-state copy.
FederalMissedVotesList: roll call number + date + question + 'MISSED'
warning chip. Caps at 25 most-recent.

~7 vitest cases."
```

---

## Task 6: Web cards — Service Record + Finance

**Files:**
- Create: `apps/web/components/federal/FederalServiceRecordCard.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalFinanceCard.tsx` + `.test.tsx`

- [ ] **Step 1: Implement FederalServiceRecordCard**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialMetrics,
  useOfficialLeadershipHistory,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { FederalKPIList } from './FederalKPIList'
import { FederalLeadershipList } from './FederalLeadershipList'

interface Props {
  officialId: string
  hideLivesInDistrict?: boolean   // Senate guard
}

export function FederalServiceRecordCard({ officialId, hideLivesInDistrict }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const metrics = useOfficialMetrics(client, officialId)
  const leadership = useOfficialLeadershipHistory(client, officialId)

  const [openLeadership, setOpenLeadership] = useState(false)

  if (metrics.isLoading || leadership.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Service Record</h2>
        <div style={mutedStyle}>Loading service record…</div>
      </section>
    )
  }

  const m = metrics.data ?? null
  const leadCount = leadership.data?.length ?? null
  const allEmpty = !m && (leadCount === 0 || leadCount === null)

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Service Record</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No service record data on file for this legislator.
        </div>
      </section>
    )
  }

  const sponsored = m?.bills_sponsored_count ?? null
  const cosponsored = m?.bills_cosponsored_count ?? null
  const attendance = m?.attendance_pct ?? null

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Service Record</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {sponsored != null ? `${sponsored} bill${sponsored === 1 ? '' : 's'} sponsored` : '—'} ·{' '}
        {cosponsored != null ? `${cosponsored} cosponsored` : '—'} ·{' '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </div>

      {/* Always-visible KPI tiles */}
      <FederalKPIList metrics={m} hideLivesInDistrict={hideLivesInDistrict} />

      {/* Collapsible Leadership subsection */}
      <Subsection
        label={`Leadership history (${leadCount ?? '—'})`}
        open={openLeadership}
        onToggle={() => setOpenLeadership(v => !v)}
      >
        <FederalLeadershipList rows={leadership.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8, marginTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

- [ ] **Step 2: Test FederalServiceRecordCard**

```tsx
import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: vi.fn(),
    useOfficialLeadershipHistory: vi.fn(),
  }
})

import * as officials from '@chiaro/officials'

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('FederalServiceRecordCard', () => {
  it('renders empty state when no metrics + no leadership', () => {
    vi.mocked(officials.useOfficialMetrics).mockReturnValue({ data: null, isLoading: false } as never)
    vi.mocked(officials.useOfficialLeadershipHistory).mockReturnValue({ data: [], isLoading: false } as never)
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/No service record data on file/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    vi.mocked(officials.useOfficialMetrics).mockReturnValue({
      data: { bills_sponsored_count: 12, bills_cosponsored_count: 45, attendance_pct: 96, subject_breadth: 8, lives_in_district: true },
      isLoading: false,
    } as never)
    vi.mocked(officials.useOfficialLeadershipHistory).mockReturnValue({ data: [], isLoading: false } as never)
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/12 bills sponsored/i)).toBeTruthy()
    expect(getByText(/96% attendance/i)).toBeTruthy()
  })

  it('Leadership subsection expands on click', () => {
    vi.mocked(officials.useOfficialMetrics).mockReturnValue({
      data: { bills_sponsored_count: 1, bills_cosponsored_count: 1, attendance_pct: 95, subject_breadth: 1, lives_in_district: null },
      isLoading: false,
    } as never)
    vi.mocked(officials.useOfficialLeadershipHistory).mockReturnValue({
      data: [{ id: 'l1', title: 'Chair', committee: 'Energy and Commerce', start_date: '2023-01-03', end_date: null }],
      isLoading: false,
    } as never)
    const { getByText, queryByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(queryByText(/Energy and Commerce/)).toBeNull()
    fireEvent.click(getByText(/Leadership history/i))
    expect(getByText(/Energy and Commerce/)).toBeTruthy()
  })

  it('renders loading state', () => {
    vi.mocked(officials.useOfficialMetrics).mockReturnValue({ data: undefined, isLoading: true } as never)
    vi.mocked(officials.useOfficialLeadershipHistory).mockReturnValue({ data: [], isLoading: false } as never)
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/Loading service record/i)).toBeTruthy()
  })
})
```

- [ ] **Step 3: Implement FederalFinanceCard**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useOfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { FederalDonorsList } from './FederalDonorsList'
import { FederalPACsList } from './FederalPACsList'

interface Props {
  officialId: string
  cycle: string   // e.g. '2024'
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalFinanceCard({ officialId, cycle }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const finance = useOfficialFinance(client, officialId, cycle)

  const [openDonors, setOpenDonors] = useState(false)
  const [openPACs, setOpenPACs] = useState(false)

  if (finance.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Finance ({cycle})</h2>
        <div style={mutedStyle}>Loading finance…</div>
      </section>
    )
  }

  const f = finance.data ?? null
  if (!f) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Finance ({cycle})</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No finance data available for this legislator and cycle.
        </div>
      </section>
    )
  }

  const totalRaised = f.total_raised ?? null
  const donorCount = f.top_individual_donors?.length ?? null
  const pacCount = f.top_pacs?.length ?? null

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Finance ({cycle})</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {fmtAmount(totalRaised)} raised ·{' '}
        {donorCount != null ? `${donorCount} donor${donorCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {pacCount != null ? `${pacCount} PAC${pacCount === 1 ? '' : 's'}` : '—'}
      </div>

      <Subsection label={`Top individual donors (${donorCount ?? '—'})`}
                  open={openDonors} onToggle={() => setOpenDonors(v => !v)}>
        <FederalDonorsList finance={f} />
      </Subsection>

      <Subsection label={`Top PACs (${pacCount ?? '—'})`}
                  open={openPACs} onToggle={() => setOpenPACs(v => !v)}>
        <FederalPACsList finance={f} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

Adjust `OfficialFinance` field access if the actual shape differs (e.g., `total_raised` vs `totals.individual_contributions`).

- [ ] **Step 4: Test FederalFinanceCard**

~4 cases: empty / summary counts / Donors subsection expand / loading. Mirror Task 6 Step 2 pattern.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(ServiceRecord|Finance)Card'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{ServiceRecord,Finance}Card.tsx apps/web/test/components/federal/Federal{ServiceRecord,Finance}Card.test.tsx
git commit -m "feat(web): FederalServiceRecordCard + FederalFinanceCard

Composes useOfficialMetrics + useOfficialLeadershipHistory (service)
and useOfficialFinance (finance). Header summary uses em-dash NULL
convention. Service Record renders KPI tiles always-visible +
Leadership subsection collapsible. Finance renders donor + PAC
subsections.

~8 vitest cases."
```

---

## Task 7: Web cards — Issue Positions + Community Presence

**Files:**
- Create: `apps/web/components/federal/FederalIssuePositionsCard.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalCommunityPresenceCard.tsx` + `.test.tsx`

Both follow the Task 6 card scaffold (card style + Subsection helper + header summary + empty/loading states).

- [ ] **Step 1: Implement FederalIssuePositionsCard**

```tsx
'use client'

import { useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { FederalScorecardRatingsList } from './FederalScorecardRatingsList'

interface Props { officialId: string }

export function FederalIssuePositionsCard({ officialId }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const ratings = useOfficialScorecardRatings(client, officialId)

  if (ratings.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={mutedStyle}>Loading issue positions…</div>
      </section>
    )
  }

  const rows = ratings.data ?? []
  if (rows.length === 0) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No issue-position ratings available for this legislator yet.
        </div>
      </section>
    )
  }

  const leans = new Set(rows.map(r => r.org?.lean ?? 'centrist'))
  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Issue Positions</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {rows.length} org{rows.length === 1 ? '' : 's'} rated · {leans.size} lean group{leans.size === 1 ? '' : 's'}
      </div>
      <FederalScorecardRatingsList rows={rows} />
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

(No collapsible subsections — ratings are the only content, rendered inline directly.)

- [ ] **Step 2: Implement FederalCommunityPresenceCard**

Mirror Task 6 Step 3 card scaffold. 2 hooks (`useOfficialDistrictOffices`, `useOfficialTownHalls`). 2 collapsible Subsections (Town halls + District offices). `chamber` prop for Senate guard (hides `lives_in_district` row — but the lives_in_district row is in KPI list inside ServiceRecord card, not here; the chamber prop here is forwarded only to children that need it, which is currently none — keep the prop for future extension or remove if unused).

Actually re-check the spec — `chamber` was specified for `FederalCommunityPresenceCard` in the spec but on inspection the only `lives_in_district` consumer is inside FederalKPIList, which is mounted inside FederalServiceRecordCard. So `chamber` doesn't need to be on FederalCommunityPresenceCard — the spec was wrong. Drop the prop.

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialDistrictOffices,
  useOfficialTownHalls,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { FederalTownHallsList } from './FederalTownHallsList'
import { FederalDistrictOfficesList } from './FederalDistrictOfficesList'

interface Props {
  officialId: string
  congress: string   // e.g. '119'
}

export function FederalCommunityPresenceCard({ officialId, congress }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const offices = useOfficialDistrictOffices(client, officialId)
  const halls = useOfficialTownHalls(client, officialId, congress)

  const [openHalls, setOpenHalls] = useState(false)
  const [openOffices, setOpenOffices] = useState(false)

  if (offices.isLoading || halls.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={mutedStyle}>Loading community presence…</div>
      </section>
    )
  }

  const hallsCount = halls.data?.length ?? null
  // Filter out capitol offices for the count (matches list filter)
  const officesCount = offices.data?.filter(o => o.kind !== 'capitol').length ?? null
  const allEmpty = hallsCount === 0 && officesCount === 0

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No community-presence data available for this legislator yet.
        </div>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Community Presence</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {hallsCount != null ? `${hallsCount} town hall${hallsCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {officesCount != null ? `${officesCount} office${officesCount === 1 ? '' : 's'}` : '—'}
      </div>

      <Subsection label={`Town halls (${hallsCount ?? '—'})`}
                  open={openHalls} onToggle={() => setOpenHalls(v => !v)}>
        <FederalTownHallsList rows={halls.data ?? []} />
      </Subsection>

      <Subsection label={`District offices (${officesCount ?? '—'})`}
                  open={openOffices} onToggle={() => setOpenOffices(v => !v)}>
        <FederalDistrictOfficesList rows={offices.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

- [ ] **Step 3: Tests**

Each card gets ~4 cases (empty / summary / expand interaction / loading). Mirror Task 6 Step 2 scaffold.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(IssuePositions|CommunityPresence)Card'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{IssuePositions,CommunityPresence}Card.tsx apps/web/test/components/federal/Federal{IssuePositions,CommunityPresence}Card.test.tsx
git commit -m "feat(web): FederalIssuePositionsCard + FederalCommunityPresenceCard

Composes useOfficialScorecardRatings (issue positions) and
useOfficialDistrictOffices + useOfficialTownHalls (community presence).

Issue Positions renders ratings inline (no collapsible subsections).
Community Presence renders 2 collapsible subsections (town halls +
district offices); capitol office filtered from count + list (already
in bio header).

~8 vitest cases."
```

---

## Task 8: Web cards — Ethics + Voting Bills

**Files:**
- Create: `apps/web/components/federal/FederalEthicsAccountabilityCard.tsx` + `.test.tsx`
- Create: `apps/web/components/federal/FederalVotingBillsCard.tsx` + `.test.tsx`

- [ ] **Step 1: Implement FederalEthicsAccountabilityCard**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { FederalStockTransactionsList } from './FederalStockTransactionsList'

interface Props { officialId: string }

function complianceColor(pct: number | null | undefined): string {
  if (pct == null) return COLORS.neutral.textMuted
  if (pct >= 90) return COLORS.signal.success
  if (pct >= 50) return COLORS.signal.warning
  return COLORS.signal.error
}

export function FederalEthicsAccountabilityCard({ officialId }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const metrics = useOfficialMetrics(client, officialId)
  const stock = useOfficialStockTransactions(client, officialId)

  const [openStock, setOpenStock] = useState(false)

  if (metrics.isLoading || stock.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Ethics & Accountability</h2>
        <div style={mutedStyle}>Loading ethics & accountability…</div>
      </section>
    )
  }

  const m = metrics.data
  const compliancePct = m?.stock_act_compliance_pct ?? null
  const stockCount = stock.data?.length ?? null
  const lateCount = stock.data?.filter(t => (t.days_late ?? 0) > 0).length ?? 0
  const allEmpty = stockCount === 0 && compliancePct == null

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Ethics & Accountability</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No stock-trade or STOCK-Act-compliance records on file.
        </div>
      </section>
    )
  }

  const compColor = complianceColor(compliancePct)

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Ethics & Accountability</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {stockCount != null ? `${stockCount} stock trade${stockCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {lateCount} late filing{lateCount === 1 ? '' : 's'} ·{' '}
        {compliancePct != null ? `${compliancePct}% STOCK Act compliance` : '—'}
      </div>

      {/* Compliance tile (always visible) */}
      {compliancePct != null && (
        <div style={{
          padding: '12px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, marginBottom: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: compColor }}>
            {compliancePct}%
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4 }}>
            STOCK Act on-time filing compliance (federal 45-day deadline)
          </div>
        </div>
      )}

      <Subsection label={`Stock trades (${stockCount ?? '—'})`}
                  open={openStock} onToggle={() => setOpenStock(v => !v)}>
        <FederalStockTransactionsList rows={stock.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

- [ ] **Step 2: Implement FederalVotingBillsCard**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialSponsoredBills,
  useOfficialCosponsoredBills,
  useOfficialMissedVotes,
} from '@chiaro/bills'
import { useOfficialMetrics } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { FederalSponsoredBillsList } from './FederalSponsoredBillsList'
import { FederalCosponsoredBillsList } from './FederalCosponsoredBillsList'
import { FederalMissedVotesList } from './FederalMissedVotesList'

interface Props {
  officialId: string
  congress: string  // e.g. '119'
}

export function FederalVotingBillsCard({ officialId, congress }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const metrics = useOfficialMetrics(client, officialId)
  const sponsored = useOfficialSponsoredBills(client, officialId, congress)
  const cosponsored = useOfficialCosponsoredBills(client, officialId, congress)
  const missed = useOfficialMissedVotes(client, officialId, congress)

  const [openSponsored, setOpenSponsored] = useState(false)
  const [openCosponsored, setOpenCosponsored] = useState(false)
  const [openMissed, setOpenMissed] = useState(false)

  if (sponsored.isLoading || cosponsored.isLoading || missed.isLoading || metrics.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Voting & Bills ({congress}th Congress)</h2>
        <div style={mutedStyle}>Loading voting & bills…</div>
      </section>
    )
  }

  const sponsoredCount = sponsored.data?.length ?? null
  const cosponsoredCount = cosponsored.data?.length ?? null
  const missedCount = missed.data?.length ?? null
  const attendance = metrics.data?.attendance_pct ?? null

  const allEmpty = sponsoredCount === 0 && cosponsoredCount === 0 && missedCount === 0
  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Voting & Bills ({congress}th Congress)</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No bill or voting-record data on file for this Congress.
        </div>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Voting & Bills ({congress}th Congress)</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {sponsoredCount != null ? `${sponsoredCount} sponsored` : '—'} ·{' '}
        {cosponsoredCount != null ? `${cosponsoredCount} cosponsored` : '—'} ·{' '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </div>

      <Subsection label={`Sponsored bills (${sponsoredCount ?? '—'})`}
                  open={openSponsored} onToggle={() => setOpenSponsored(v => !v)}>
        <FederalSponsoredBillsList rows={sponsored.data ?? []} />
      </Subsection>

      <Subsection label={`Cosponsored bills (${cosponsoredCount ?? '—'})`}
                  open={openCosponsored} onToggle={() => setOpenCosponsored(v => !v)}>
        <FederalCosponsoredBillsList rows={cosponsored.data ?? []} />
      </Subsection>

      <Subsection label={`Missed votes (${missedCount ?? '—'})`}
                  open={openMissed} onToggle={() => setOpenMissed(v => !v)}>
        <FederalMissedVotesList rows={missed.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

- [ ] **Step 3: Tests**

Each card gets ~4 cases. Mirror Task 6 Step 2 scaffold.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/web test 'federal/Federal(EthicsAccountability|VotingBills)Card'
pnpm --filter @chiaro/web typecheck
git add apps/web/components/federal/Federal{EthicsAccountability,VotingBills}Card.tsx apps/web/test/components/federal/Federal{EthicsAccountability,VotingBills}Card.test.tsx
git commit -m "feat(web): FederalEthicsAccountabilityCard + FederalVotingBillsCard

Ethics: composes useOfficialMetrics + useOfficialStockTransactions.
Always-visible STOCK Act compliance tile with semantic color (success
≥90%, warning 50-89%, error <50%). Stock trades subsection.

Voting Bills: composes 3 hooks from @chiaro/bills (sponsored,
cosponsored, missed votes) + metrics for attendance. 3 collapsible
subsections.

~8 vitest cases."
```

---

## Task 9: Web detail-page swap — mount 6 federal cards

**Files:**
- Modify: `apps/web/app/officials/[id]/page.tsx`
- Modify: `apps/web/app/officials/[id]/page.test.tsx` (if exists; if not, skip the test update)

- [ ] **Step 1: Update the page**

Open `apps/web/app/officials/[id]/page.tsx`. Find the line near 125 mounting `<PerformanceSection officialId={id} chamber={official.chamber as 'federal_house' | 'federal_senate'} />`.

Replace with:

```tsx
{/* Federal officials redesign (slice 6) — 6 cards in vertical cascade */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <FederalServiceRecordCard
    officialId={id}
    hideLivesInDistrict={official.chamber === 'federal_senate'}
  />
  <FederalFinanceCard officialId={id} cycle={CURRENT_CYCLE} />
  <FederalIssuePositionsCard officialId={id} />
  <FederalCommunityPresenceCard officialId={id} congress={CURRENT_CONGRESS} />
  <FederalEthicsAccountabilityCard officialId={id} />
  <FederalVotingBillsCard officialId={id} congress={CURRENT_CONGRESS} />
</div>
```

Add imports at top:

```tsx
import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'
import { FederalFinanceCard } from '@/components/federal/FederalFinanceCard'
import { FederalIssuePositionsCard } from '@/components/federal/FederalIssuePositionsCard'
import { FederalCommunityPresenceCard } from '@/components/federal/FederalCommunityPresenceCard'
import { FederalEthicsAccountabilityCard } from '@/components/federal/FederalEthicsAccountabilityCard'
import { FederalVotingBillsCard } from '@/components/federal/FederalVotingBillsCard'
```

Remove the now-unused `PerformanceSection` import.

Define `CURRENT_CYCLE = '2024'` and `CURRENT_CONGRESS = '119'` as module-level constants near the top of the file (or pull from a shared `apps/web/lib/constants.ts` if it exists).

- [ ] **Step 2: Verify build + dev**

```bash
pnpm --filter @chiaro/web build 2>&1 | tail -10
```

Expected: Next 15 build clean. The `/officials/[id]` route should now render 6 federal cards instead of the PerformanceSection.

If a `page.test.tsx` exists alongside, update its mocks + assertions to match 6-card render. If no test file, that's fine — federal page tests aren't a tradition; the card-level tests cover the logic.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/officials/[id]/page.tsx
[ -f apps/web/app/officials/[id]/page.test.tsx ] && git add apps/web/app/officials/[id]/page.test.tsx
git commit -m "feat(web): swap PerformanceSection for 6 federal cards on /officials/[id]

Slice 6 federal redesign. Federal /officials/[id] now mounts 6 cards
in vertical cascade matching the state-officials/[id] design pattern.

Cards: FederalServiceRecord + Finance + IssuePositions + CommunityPresence
+ EthicsAccountability + VotingBills.

PerformanceSection import removed; CURRENT_CYCLE + CURRENT_CONGRESS
constants defined at module scope.

Senate guard: hideLivesInDistrict prop on ServiceRecord card omits
the lives_in_district KPI tile for federal_senate chamber."
```

---

## Task 10: Mobile sub-lists — KPI + Leadership + Donors + PACs + Scorecards (5 components bundled)

**Files:**
- Create: 5 RN components + 5 test files in `apps/mobile/components/federal/` + `apps/mobile/test/components/federal/`

Mirror Tasks 2+3 web components with RN primitives.

- [ ] **Step 1: Implement 5 components**

Each follows the same pattern as the web equivalent but uses `<View>`/`<Text>`/`<Pressable>`/`StyleSheet`. Example for `FederalKPIList.tsx` (mobile):

```tsx
import { View, Text, StyleSheet } from 'react-native'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type MetricsRow = Database['public']['Tables']['official_metrics']['Row']

interface Props {
  metrics: MetricsRow | null | undefined
  hideLivesInDistrict?: boolean
}

interface Tile { label: string; value: string }

function fmtPct(n: number | null | undefined): string { return n == null ? '—' : `${n}%` }
function fmtCount(n: number | null | undefined): string { return n == null ? '—' : String(n) }
function fmtLivesInDistrict(b: boolean | null | undefined): string {
  if (b == null) return '—'
  return b ? '✓ Yes' : '✗ No'
}

export function FederalKPIList({ metrics, hideLivesInDistrict }: Props) {
  if (!metrics) {
    return <Text style={styles.muted}>No KPI data available.</Text>
  }
  const tiles: Tile[] = [
    { label: 'Bills sponsored',   value: fmtCount(metrics.bills_sponsored_count) },
    { label: 'Bills cosponsored', value: fmtCount(metrics.bills_cosponsored_count) },
    { label: 'Attendance',        value: fmtPct(metrics.attendance_pct) },
    { label: 'Subject breadth',   value: fmtCount(metrics.subject_breadth) },
  ]
  if (!hideLivesInDistrict) {
    tiles.push({ label: 'Lives in district', value: fmtLivesInDistrict(metrics.lives_in_district) })
  }

  return (
    <View style={styles.grid}>
      {tiles.map(t => (
        <View key={t.label} style={styles.tile}>
          <Text style={styles.tileValue}>{t.value}</Text>
          <Text style={styles.tileLabel}>{t.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  tile: { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8, minWidth: 120, alignItems: 'center' },
  tileValue: { fontWeight: '600', color: COLORS.brand.text, fontSize: 15 },
  tileLabel: { color: COLORS.neutral.textMuted, fontSize: 11, marginTop: 4 },
})
```

Repeat the same RN-port treatment for the other 4 components (`FederalLeadershipList`, `FederalDonorsList`, `FederalPACsList`, `FederalScorecardRatingsList`). Each is structurally identical to its web sibling — `<View>`/`<Text>` instead of `<div>`/`<span>`, `StyleSheet.create({...})` instead of inline `style` props.

- [ ] **Step 2: Tests**

Each component gets ~2 jest-expo cases (empty / renders). Use `@testing-library/react-native` `render` + `getByText`. No `@/lib/supabase` mock needed for these pure-props components.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test 'federal/Federal(KPI|Leadership|Donors|PACs|ScorecardRatings)List'
pnpm --filter @chiaro/mobile typecheck
git add apps/mobile/components/federal/Federal{KPI,Leadership,Donors,PACs,ScorecardRatings}List.tsx apps/mobile/test/components/federal/Federal{KPI,Leadership,Donors,PACs,ScorecardRatings}List.test.tsx
git commit -m "feat(mobile): 5 sub-list components (KPI/Leadership/Donors/PACs/Scorecards)

Mobile parity with web Tasks 2-3. RN primitives: View, Text,
StyleSheet, Pressable. Same logic + colors as web siblings.

~10 vitest cases."
```

---

## Task 11: Mobile sub-lists — TownHalls + Offices + Stock + 3 Bills/Votes (6 components bundled)

**Files:**
- Create: 6 RN components + 6 test files in `apps/mobile/components/federal/`

Mirror Tasks 4+5 web components.

- [ ] **Step 1: Implement 6 components**

Same RN-port treatment as Task 10. Key differences from web:

- **FederalTownHallsList**: Use `<Pressable onPress={() => Linking.openURL(r.source_url)}>` for clickable rows
- **FederalDistrictOfficesList**: Use multi-line `<Text>` with `\n` newlines for phone + hours blocks (vs `<br/>` on web)
- **FederalStockTransactionsList**: Use `<Pressable>` for source_url; chip uses RN style array `[styles.chip, { color, backgroundColor }]`
- **FederalSponsoredBillsList / Cosponsored**: render `bill_type + number + title` + status chip inline (no `<a>`)
- **FederalMissedVotesList**: roll_call_number + vote_date + question + MISSED chip

Mirror the structural patterns from `apps/mobile/components/state/StateXxxList.tsx` for slice 5xx references.

- [ ] **Step 2: Tests**

~2 cases each = 12 cases total. Empty + renders for most; add 1 cap-at-25 case for SponsoredBills/Cosponsored/MissedVotes.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test 'federal/Federal(TownHalls|DistrictOffices|StockTransactions|SponsoredBills|CosponsoredBills|MissedVotes)List'
pnpm --filter @chiaro/mobile typecheck
git add apps/mobile/components/federal/Federal{TownHalls,DistrictOffices,StockTransactions,SponsoredBills,CosponsoredBills,MissedVotes}List.tsx apps/mobile/test/components/federal/Federal{TownHalls,DistrictOffices,StockTransactions,SponsoredBills,CosponsoredBills,MissedVotes}List.test.tsx
git commit -m "feat(mobile): 6 sub-list components (TownHalls/Offices/Stock/Bills/Votes)

Mobile parity with web Tasks 4-5. Pressable rows for source_url links
via Linking.openURL. Multi-line metadata uses \\n in Text content.

~12 vitest cases."
```

---

## Task 12: Mobile cards — Service + Finance + IssuePositions (3 bundled)

**Files:**
- Create: 3 RN card components + 3 test files

- [ ] **Step 1: Implement 3 cards**

Mirror Tasks 6+7 web cards. Key RN-specific patterns:

```tsx
// Mobile card pattern (use in all 3):
import { useState } from 'react'
import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'  // singleton mobile client
import { /* hooks */ } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
// ...sub-list imports...

interface Props { /* ... */ }

export function FederalServiceRecordCard({ officialId, hideLivesInDistrict }: Props) {
  const metrics = useOfficialMetrics(supabase, officialId)
  const leadership = useOfficialLeadershipHistory(supabase, officialId)
  const [openLeadership, setOpenLeadership] = useState(false)

  if (metrics.isLoading || leadership.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Service Record</Text>
        <Text style={styles.muted}>Loading service record…</Text>
      </View>
    )
  }
  // ... rest mirrors web logic ...
}

function Subsection({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}>
        <Text style={styles.subsectionLabel}>{open ? '▾' : '▸'} {label}</Text>
      </Pressable>
      {open && <View>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.neutral.background, borderColor: COLORS.neutral.border, borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: COLORS.brand.text },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
  subsection: { borderTopWidth: 1, borderTopColor: COLORS.neutral.border, paddingTop: 8 },
  subsectionLabel: { color: COLORS.brand.text, fontSize: 14, fontWeight: '500', paddingVertical: 6 },
})
```

- [ ] **Step 2: Tests (jest-expo mutable-mock pattern)**

Per [[feedback-jest-expo-dynamic-mock-pattern]]: each card test uses mutable `let mockX = DEFAULT` reset in `beforeEach` + `jest.mock` factory closing over the variable.

```tsx
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockMetrics: unknown = null
let mockLeadership: unknown[] = []
let mockLoadingMetrics = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({ data: mockMetrics, isLoading: mockLoadingMetrics, isSuccess: !mockLoadingMetrics }),
    useOfficialLeadershipHistory: () => ({ data: mockLeadership, isLoading: false, isSuccess: true }),
  }
})

import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockMetrics = null
  mockLeadership = []
  mockLoadingMetrics = false
})

describe('mobile FederalServiceRecordCard', () => {
  it('renders empty state when no metrics and no leadership', () => {
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/No service record data on file/i)).toBeTruthy()
  })

  it('renders summary row when metrics present', () => {
    mockMetrics = { bills_sponsored_count: 12, bills_cosponsored_count: 45, attendance_pct: 96, subject_breadth: 8, lives_in_district: true }
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/12 bills sponsored/i)).toBeTruthy()
  })

  it('Leadership subsection expands on press', () => {
    mockMetrics = { bills_sponsored_count: 1, bills_cosponsored_count: 1, attendance_pct: 95, subject_breadth: 1, lives_in_district: null }
    mockLeadership = [{ id: 'l1', title: 'Chair', committee: 'Energy and Commerce', start_date: '2023-01-03', end_date: null }]
    const { getByText, queryByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(queryByText(/Energy and Commerce/)).toBeNull()
    fireEvent.press(getByText(/Leadership history/i))
    expect(getByText(/Energy and Commerce/)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingMetrics = true
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/Loading service record/i)).toBeTruthy()
  })
})
```

Similar test scaffolds for `FederalFinanceCard` (mock `useOfficialFinance`) and `FederalIssuePositionsCard` (mock `useOfficialScorecardRatings`). 4 cases each = 12 cases total.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test 'federal/Federal(ServiceRecord|Finance|IssuePositions)Card'
pnpm --filter @chiaro/mobile typecheck
git add apps/mobile/components/federal/Federal{ServiceRecord,Finance,IssuePositions}Card.tsx apps/mobile/test/components/federal/Federal{ServiceRecord,Finance,IssuePositions}Card.test.tsx
git commit -m "feat(mobile): FederalServiceRecord + Finance + IssuePositions cards

Mobile parity with web Tasks 6-7. RN primitives + jest-expo
mutable-mock pattern per [[feedback-jest-expo-dynamic-mock-pattern]].

~12 vitest cases."
```

---

## Task 13: Mobile cards — CommunityPresence + Ethics + VotingBills (3 bundled)

**Files:**
- Create: 3 RN card components + 3 test files

Mirror Tasks 7+8 web cards in RN form. Same patterns as Task 12.

- [ ] **Step 1: Implement 3 cards** — `FederalCommunityPresenceCard`, `FederalEthicsAccountabilityCard`, `FederalVotingBillsCard`

- [ ] **Step 2: Tests** — 4 cases each = 12 cases

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test 'federal/Federal(CommunityPresence|EthicsAccountability|VotingBills)Card'
pnpm --filter @chiaro/mobile typecheck
git add apps/mobile/components/federal/Federal{CommunityPresence,EthicsAccountability,VotingBills}Card.tsx apps/mobile/test/components/federal/Federal{CommunityPresence,EthicsAccountability,VotingBills}Card.test.tsx
git commit -m "feat(mobile): FederalCommunityPresence + Ethics + VotingBills cards

Mobile parity with web Task 7-8. EthicsAccountability includes
STOCK Act compliance % tile with semantic-color theming.

~12 vitest cases."
```

---

## Task 14: Mobile detail-page swap — mount 6 federal cards

**Files:**
- Modify: `apps/mobile/app/(app)/officials/[id].tsx`
- Modify: `apps/mobile/test/app/(app)/officials/[id].test.tsx` (if exists)

- [ ] **Step 1: Update the page**

Open `apps/mobile/app/(app)/officials/[id].tsx`. Find the line near 75 mounting `<PerformanceSection officialId={officialId} chamber={official.chamber as 'federal_house' | 'federal_senate'} />`.

Replace with:

```tsx
{/* Federal officials redesign (slice 6) — 6 cards in vertical cascade */}
<View style={{ gap: 12 }}>
  <FederalServiceRecordCard
    officialId={officialId}
    hideLivesInDistrict={official.chamber === 'federal_senate'}
  />
  <FederalFinanceCard officialId={officialId} cycle={CURRENT_CYCLE} />
  <FederalIssuePositionsCard officialId={officialId} />
  <FederalCommunityPresenceCard officialId={officialId} congress={CURRENT_CONGRESS} />
  <FederalEthicsAccountabilityCard officialId={officialId} />
  <FederalVotingBillsCard officialId={officialId} congress={CURRENT_CONGRESS} />
</View>
```

Add 6 imports + define `CURRENT_CYCLE = '2024'` + `CURRENT_CONGRESS = '119'`. Remove the `PerformanceSection` import.

- [ ] **Step 2: Test if exists**

If `apps/mobile/test/app/(app)/officials/[id].test.tsx` exists, update it to mock the 4 new federal hooks composed by the new cards.

- [ ] **Step 3: Verify + commit**

```bash
pnpm --filter @chiaro/mobile test 'officials/\[id\]'  # if test file exists
pnpm --filter @chiaro/mobile typecheck
git add apps/mobile/app/\(app\)/officials/[id].tsx
[ -f apps/mobile/test/app/\(app\)/officials/[id].test.tsx ] && git add apps/mobile/test/app/\(app\)/officials/[id].test.tsx
git commit -m "feat(mobile): swap PerformanceSection for 6 federal cards on /officials/[id]

Slice 6 federal redesign mobile parity. Mounts 6 FederalXxxCard
components in a vertical View. CURRENT_CYCLE + CURRENT_CONGRESS
defined at module scope.

Senate guard via hideLivesInDistrict prop on ServiceRecord card."
```

---

## Task 15: Cleanup — delete PerformanceSection + 6 CategoryId components + mobile nav-state files

**Files:**
- Delete: `apps/web/components/performance/PerformanceSection.tsx`
- Delete: `apps/web/components/performance/categories/{6 files}.tsx`
- Delete: `apps/mobile/components/performance/PerformanceSection.tsx`
- Delete: `apps/mobile/components/performance/CategoryBar.tsx`
- Delete: `apps/mobile/components/performance/SubCascadeBar.tsx`
- Delete: `apps/mobile/components/performance/useExpandedState.ts`
- Delete: `apps/mobile/components/performance/useExpoParamSync.ts`
- Delete: `apps/mobile/components/performance/categories/{6 files}.tsx`
- Delete: any matching `*.test.tsx` files alongside

- [ ] **Step 1: Verify no other consumers**

```bash
grep -rn "PerformanceSection\|CategoryBar\|SubCascadeBar\|useExpandedState\|useExpoParamSync" apps/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | head -20
```

Expected: zero results (all consumers were removed in Tasks 9 + 14). If any results remain, surface them — those must be addressed before deletion.

- [ ] **Step 2: Delete files**

```bash
rm -rf apps/web/components/performance/ apps/web/test/components/performance/ 2>/dev/null || true
rm -rf apps/mobile/components/performance/ apps/mobile/test/components/performance/ 2>/dev/null || true
```

- [ ] **Step 3: Workspace verify**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/web build 2>&1 | tail -5
```

Expected: all 10 packages typecheck clean; web build clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/performance/ apps/mobile/components/performance/ apps/web/test/components/performance/ apps/mobile/test/components/performance/ 2>/dev/null || true
git commit -am "chore: delete PerformanceSection + 6 CategoryId components + mobile nav-state

Slice 6 cleanup. Federal officials redesign is fully migrated to the
6 FederalXxxCard pattern; the old PerformanceSection + 6 CategoryId
components (web + mobile) + 4 mobile nav-state utilities (CategoryBar,
SubCascadeBar, useExpandedState, useExpoParamSync) are no longer
consumed and are removed.

~25 file deletions across web + mobile."
```

---

## Task 16: CLAUDE.md + final verify + memory + handoff

**Files:**
- Modify: `CLAUDE.md`
- Memory: `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice6_federal_redesign.md`
- Memory: `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md` (index update)

- [ ] **Step 1: CLAUDE.md slice entry + Gotcha #15**

In `## Slices delivered`, after slice 5I entry, append:

```markdown
- **Slice 6 — federal officials redesign** (2026-05-22): refactored `/officials/[id]` web + mobile to use the slice 5xx state-card collapsible-subsection pattern. 6 new `FederalXxxCard` components replace `PerformanceSection.tsx` + 6 `CategoryId` components. Zero schema work (pgTAP stays at 393 plans across 29 files); workspace stays at 10 packages. 11 new sub-list components per platform (22 total). Federal/state intentional UI asymmetries documented in Gotcha #15.
```

In `## Gotchas`, after current #14, append:

```markdown
15. **Federal and state officials detail pages are intentionally asymmetric** in 3 ways: (a) federal Ethics is 1 card (`FederalEthicsAccountabilityCard`) showing STOCK Act compliance + trades; state has 2 cards (`StateFinancialActivityCard` + `StateConductCard`) because state has ethics complaints + recall/expulsion data that federal lacks; (b) federal `FederalVotingBillsCard` is standalone; state folds bills + votes into `StateServiceRecordCard` because state's voting record is smaller per legislator; (c) federal `FederalCommunityPresenceCard` has 2 subsections (town halls + offices); state has 3 (adds committee_hearings, which exists only in `state_committee_hearings` from slice 5H). These asymmetries are data-justified — don't unilaterally close them without verifying the federal/state data parity actually warrants the change.
```

- [ ] **Step 2: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 6 entry + Gotcha #15 (federal/state UI asymmetries)

Slice 6 federal redesign. Gotcha #15 documents 3 intentional asymmetries
between federal and state officials detail pages (Ethics 1-vs-2 cards,
Voting Bills standalone-vs-folded, Community Presence 2-vs-3 subsections).
All data-justified — federal lacks ethics complaints + committee_hearings
tables; state's voting record is smaller per legislator."
```

- [ ] **Step 3: Final workspace verify**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @chiaro/web build
pnpm db:reset
pnpm db:test 2>&1 | tail -15
```

Expected:
- All 10 packages typecheck clean
- All package tests pass (officials-ingest threshold-guard flake may re-run green; TIGER 4-failures expected per gotcha #6)
- Next 15 build clean
- pgTAP unchanged at 393 plans across 29 files
- All migrations 0001-0050 apply cleanly

- [ ] **Step 4: Branch state**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: ~17-18 commits on `slice-6-federal-redesign` ahead of master. Working tree clean.

- [ ] **Step 5: Write slice 6 durable-lessons memory**

Write `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice6_federal_redesign.md` capturing:

- Final squash SHA (filled in after merge)
- 6-card composition with hook mapping
- 3 federal/state intentional asymmetries documented
- ~25 file deletion sweep (PerformanceSection + 6 categories + 4 nav-state files × 2 platforms + their tests)
- No schema work; visual unification only
- 11 sub-list components per platform pattern carries over from 5xx
- Federal `town_halls` lacks `source`/`external_id` (state-only columns from migration 0042; federal 0022 predates that pattern)
- Federal `stock_transactions.days_late` uses 45-day deadline (vs state 30); intentional federal/state schema asymmetry
- jest-expo mutable-mock pattern reused for mobile card tests

Update `MEMORY.md` index with one-line entry pointing at the new file.

- [ ] **Step 6: Hand off via finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch`. Recommended: option 1 (squash merge to master locally), matching prior 9 sub-slices.

---

## Verification Checklist (post-Task 16)

- [ ] 6 new federal cards mount on `/officials/[id]` web + mobile (replacing PerformanceSection)
- [ ] 11 new sub-list components per platform (22 total)
- [ ] Each card uses collapsible-subsection pattern + em-dash NULL convention + signal-color chips + unified empty-state
- [ ] Federal Ethics card is single-card (no split into Financial Activity + Conduct)
- [ ] Federal Voting Bills card is standalone
- [ ] Federal Community Presence has 2 subsections (no committee_hearings on federal)
- [ ] Senate guard via `hideLivesInDistrict` on ServiceRecord card
- [ ] STOCK Act compliance tile uses semantic colors (success ≥90 / warning 50-89 / error <50)
- [ ] PerformanceSection + 6 CategoryId components + 4 mobile nav-state files deleted (~25 file removals)
- [ ] Workspace typecheck clean across all 10 packages
- [ ] Next 15 build clean
- [ ] pgTAP unchanged at 393 plans
- [ ] No new env vars required
- [ ] CLAUDE.md slice 6 entry + Gotcha #15 added

## Known v1 limitations carried over from spec

1. Federal Conduct equivalent absent (no recall/expulsion/ethics-complaint data for federal — federal Ethics card is STOCK-only).
2. Federal Community Presence lacks committee-hearings subsection (no federal `committee_hearings` table).
3. Federal Ethics uses 45-day STOCK Act deadline (federal `stock_transactions` from 0022); state uses 30-day (`state_stock_transactions` from 0046). Not retroactively flipped.
4. `lives_in_district` is House-only — Senate cards hide via `hideLivesInDistrict` prop guard.
5. Voting-record subsection caps at 25 most-recent missed votes; pagination is future work.
6. 6 cards mount unconditionally even when entirely empty for a legislator.
7. `SCORECARD_LEAN_LABEL/COLOR` tokens shared between federal + state issue positions; no federal-specific values added.
8. `FederalDistrictOfficesList` filters out `kind='capitol'` rows (already in bio header).
