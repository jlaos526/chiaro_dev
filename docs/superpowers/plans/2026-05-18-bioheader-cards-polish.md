# BioHeader + Cards Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the three follow-ups captured during the 2026-05-18 manual smoke test of the officials-detail redesign — add top-3 AlignmentChip row to BioHeader, swap the plain district pill for the map-pin DistrictBadge, and add an `unavailable` state to MetricCardShell with chamber-gated logic in CommunityPresenceCategory.

**Architecture:** Server-fetch the top-3 chips in `apps/web/app/officials/[id]/page.tsx` (alongside the existing officials + leadership queries), prop-drill `chamber` through `PerformanceSection` to `CommunityPresenceCategory`. BioHeader remains a pure prop-driven (no-client) component. One new file (`BioAlignmentChipRow.tsx`) plus six modifications.

**Tech Stack:** Next 15 App Router · React 19 · TypeScript strict · @supabase/ssr server client · vitest + @testing-library/react · existing @chiaro/ui-tokens primitives

**Spec:** `docs/superpowers/specs/2026-05-18-bioheader-cards-polish-design.md`

---

## File structure

```
apps/web/app/officials/[id]/page.tsx                            modify (+ scorecard fetch + chip derivation, + chamber prop)
apps/web/components/bio/
  BioHeader.tsx                                                 modify (+ chips, + officialId props; slot BioAlignmentChipRow)
  BioIdentityRow.tsx                                            modify (props swap; render DistrictBadge inside)
  BioAlignmentChipRow.tsx                                       NEW
apps/web/components/cards/MetricCardShell.tsx                   modify (+ unavailable prop, muted render branch)
apps/web/components/performance/
  PerformanceSection.tsx                                        modify (+ chamber prop; forward to CommunityPresenceCategory)
  useUrlHashSync.ts                                             modify (+ hashchange event listener)
  categories/CommunityPresenceCategory.tsx                      modify (+ chamber prop; gate Lives-in-District unavailable)

apps/web/test/components/bio/
  BioAlignmentChipRow.test.tsx                                  NEW
  BioHeader.test.tsx                                            modify (updated fixtures + DistrictBadge text assertions)
apps/web/test/components/cards/MetricCardShell.test.tsx         modify (unavailable cases)
apps/web/test/components/performance/useUrlHashSync.test.ts     modify (hashchange case)
```

---

## Phase A — Primitives (Tasks 1–3)

Three leaf-level changes with no inter-dependencies; can land in any order.

### Task 1: MetricCardShell `unavailable` prop

**Files:**
- Modify: `apps/web/components/cards/MetricCardShell.tsx`
- Modify: `apps/web/test/components/cards/MetricCardShell.test.tsx`

- [ ] **Step 1: Add failing tests**

Open `apps/web/test/components/cards/MetricCardShell.test.tsx`. Append these test cases inside the existing `describe('MetricCardShell', () => { ... })` block, just before the closing `})`:

```tsx
  describe('unavailable variant', () => {
    it('renders muted bg + italic grey value when unavailable', () => {
      const { container } = render(
        <MetricCardShell
          value="No Data"
          label="Lives in District"
          caption="no data available for this seat"
          categoryId="community-presence"
          unavailable={true}
        />
      )
      const article = container.querySelector('article') as HTMLElement
      expect(article.style.background).toContain('rgb(250, 250, 246)')  // #fafaf6
      const value = screen.getByText('No Data') as HTMLElement
      expect(value.style.fontStyle).toBe('italic')
      expect(value.style.color).toContain('rgb(128, 122, 114)')          // #807a72
    })

    it('forces label to "Unavailable" overriding consumer label', () => {
      render(
        <MetricCardShell
          value="No Data"
          label="Lives in District"
          categoryId="community-presence"
          unavailable={true}
        />
      )
      expect(screen.getByText('Unavailable')).toBeTruthy()
      expect(screen.queryByText('Lives in District')).toBeNull()
    })

    it('renders grey dot regardless of categoryId when unavailable', () => {
      const { container } = render(
        <MetricCardShell
          value="No Data"
          label="Lives in District"
          categoryId="finance"
          unavailable={true}
        />
      )
      const dot = container.querySelector('[data-testid="category-dot"]') as HTMLElement
      expect(dot.style.background).toContain('rgb(128, 122, 114)')       // #807a72
    })

    it('suppresses CTA even when onExpand provided', () => {
      const onExpand = vi.fn()
      render(
        <MetricCardShell
          value="No Data"
          label="Lives in District"
          categoryId="community-presence"
          unavailable={true}
          onExpand={onExpand}
        />
      )
      expect(screen.queryByText('view evidence →')).toBeNull()
    })

    it('suppresses CTA even when externalSourceUrl provided', () => {
      render(
        <MetricCardShell
          value="No Data"
          label="Lives in District"
          categoryId="community-presence"
          unavailable={true}
          externalSourceUrl="https://example.org/source"
        />
      )
      expect(screen.queryByText('view source →')).toBeNull()
    })

    it('renders italic grey caption when unavailable and caption provided', () => {
      render(
        <MetricCardShell
          value="No Data"
          label="Lives in District"
          caption="no data available for this seat"
          categoryId="community-presence"
          unavailable={true}
        />
      )
      const caption = screen.getByText('no data available for this seat') as HTMLElement
      expect(caption.style.fontStyle).toBe('italic')
      expect(caption.style.color).toContain('rgb(128, 122, 114)')
    })
  })
```

- [ ] **Step 2: Run failing**

Run: `pnpm --filter @chiaro/web test components/cards/MetricCardShell 2>&1 | tail -20`
Expected: 6 new test cases failing (the `unavailable` prop isn't yet implemented, so existing render path runs instead).

- [ ] **Step 3: Implement**

Replace the contents of `apps/web/components/cards/MetricCardShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { type CategoryId, CATEGORY_ACCENT, CATEGORY_CARD_GRADIENT } from '@chiaro/ui-tokens'

interface BaseProps {
  value: ReactNode
  label: string
  caption?: ReactNode
  categoryId: CategoryId
  placeholder?: boolean
  unavailable?: boolean
}

type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
  | { onExpand?: never; externalSourceUrl?: never }

export type MetricCardShellProps = BaseProps & DrillDown

const UNAVAILABLE_GREY = '#807a72'
const UNAVAILABLE_BG = '#fafaf6'

export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const { value, label, caption, categoryId, placeholder = false, unavailable = false } = props

  // unavailable takes precedence over normal styling; placeholder is a separate variant.
  const dotColor = unavailable ? UNAVAILABLE_GREY : CATEGORY_ACCENT[categoryId]
  const bg = unavailable
    ? UNAVAILABLE_BG
    : placeholder
      ? '#f6f4ed'
      : CATEGORY_CARD_GRADIENT[categoryId]

  const valueStyle: React.CSSProperties = unavailable
    ? { fontSize: '1.4rem', fontWeight: 700, color: UNAVAILABLE_GREY, fontStyle: 'italic', lineHeight: 1.1 }
    : placeholder
      ? { fontSize: '1.4rem', fontWeight: 700, color: '#807a72', fontStyle: 'italic', lineHeight: 1.1 }
      : { fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    color: unavailable ? '#5a5751' : placeholder ? '#5a5751' : '#1a1714',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
  }

  const captionStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: unavailable ? UNAVAILABLE_GREY : '#807a72',
    marginTop: 2,
    lineHeight: 1.4,
    fontStyle: unavailable ? 'italic' : placeholder ? 'italic' : 'normal',
  }

  const renderedLabel = unavailable ? 'Unavailable' : label

  let cta: ReactNode = null
  if (!placeholder && !unavailable) {
    if ('onExpand' in props && typeof props.onExpand === 'function') {
      const onExpand = props.onExpand
      cta = (
        <button
          onClick={onExpand}
          aria-label={`Expand evidence for ${label}`}
          style={{ background: 'none', border: 'none', padding: 0, marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', textDecoration: 'underline', cursor: 'pointer' }}
        >
          view evidence →
        </button>
      )
    } else if ('externalSourceUrl' in props && typeof props.externalSourceUrl === 'string') {
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
  }

  return (
    <article
      aria-label={`${renderedLabel}: ${typeof value === 'string' ? value : ''}`}
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
        {renderedLabel}
      </div>
      {caption && <div style={captionStyle}>{caption}</div>}
      {cta}
    </article>
  )
}
```

- [ ] **Step 4: Run green + typecheck**

```bash
pnpm --filter @chiaro/web test components/cards/MetricCardShell 2>&1 | tail -10
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: all tests pass (5 existing + 6 new = 11), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/cards/MetricCardShell.tsx apps/web/test/components/cards/MetricCardShell.test.tsx
git commit -m "feat(web): MetricCardShell — unavailable variant (grey dot + forced Unavailable label)"
```

---

### Task 2: useUrlHashSync `hashchange` listener

**Files:**
- Modify: `apps/web/components/performance/useUrlHashSync.ts`
- Modify: `apps/web/test/components/performance/useUrlHashSync.test.ts`

- [ ] **Step 1: Add failing test**

Open `apps/web/test/components/performance/useUrlHashSync.test.ts`. Append inside the existing `describe('useUrlHashSync', () => { ... })`:

```ts
  it('re-fires parse + open on hashchange events', () => {
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
    // Mount with empty hash so the mount effect is a no-op.
    window.location.hash = ''
    renderHook(() => useUrlHashSync(api))
    expect(openCategory).not.toHaveBeenCalled()

    // Programmatically update hash + dispatch hashchange.
    window.location.hash = '#finance:top-industries'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(openCategory).toHaveBeenCalledWith('finance')
    expect(openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/performance/useUrlHashSync 2>&1 | tail -10
```

Expected: the new `hashchange` test fails; existing 6 tests pass.

- [ ] **Step 3: Implement**

Replace `apps/web/components/performance/useUrlHashSync.ts`:

```ts
import { useEffect } from 'react'
import { type CategoryId, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import type { ExpandedStateApi } from './useExpandedState.ts'

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL))

export interface ParsedHash {
  categoryId: CategoryId
  subId: string | null
}

export function parseHash(hash: string): ParsedHash | null {
  const trimmed = hash.replace(/^#/, '')
  if (!trimmed) return null
  const [categoryId, subId = null] = trimmed.split(':')
  if (!categoryId || !VALID_CATEGORIES.has(categoryId)) return null
  return { categoryId: categoryId as CategoryId, subId }
}

export function useUrlHashSync(api: ExpandedStateApi, hashOverride?: string): void {
  useEffect(() => {
    function applyHash(rawHash: string) {
      const parsed = parseHash(rawHash)
      if (!parsed) return
      api.openCategory(parsed.categoryId)
      if (parsed.subId) {
        api.openSubCascade(parsed.categoryId, parsed.subId)
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
    }

    // Mount: apply the initial hash (or the override, for tests).
    const initialHash = hashOverride ?? (typeof window !== 'undefined' ? window.location.hash : '')
    applyHash(initialHash)

    // hashchange: BioHeader chips on the same page update the URL hash without
    // remounting; we still need to expand + scroll. Skip when an override was
    // supplied (tests inject a static hash).
    if (typeof window === 'undefined' || hashOverride !== undefined) return
    const handler = () => applyHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
```

- [ ] **Step 4: Run green + typecheck**

```bash
pnpm --filter @chiaro/web test components/performance/useUrlHashSync 2>&1 | tail -10
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: 7 tests pass (6 existing + 1 new), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/performance/useUrlHashSync.ts apps/web/test/components/performance/useUrlHashSync.test.ts
git commit -m "feat(web): useUrlHashSync — listen for hashchange events (in-page chip clicks)"
```

---

### Task 3: BioAlignmentChipRow

**Files:**
- Create: `apps/web/components/bio/BioAlignmentChipRow.tsx`
- Create: `apps/web/test/components/bio/BioAlignmentChipRow.test.tsx`

- [ ] **Step 1: Failing test**

`apps/web/test/components/bio/BioAlignmentChipRow.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioAlignmentChipRow } from '@/components/bio/BioAlignmentChipRow'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

const OFFICIAL_ID = '84eeab39-349d-4ae9-acd2-2229a3d38569'

const CHIPS: AlignmentChipRow[] = [
  { issueArea: 'environment',   displayLabel: 'Environment',   tier: 'strongly-aligned', subCascadeSlug: 'environment' },
  { issueArea: 'civil-rights',  displayLabel: 'Civil Rights',  tier: 'mostly-aligned',   subCascadeSlug: 'civil-rights' },
  { issueArea: 'business-policy', displayLabel: 'Business Policy', tier: 'strongly-differs', subCascadeSlug: 'business-policy' },
]

describe('BioAlignmentChipRow', () => {
  it('renders 3 AlignmentChips with correct labels', () => {
    render(<BioAlignmentChipRow chips={CHIPS} officialId={OFFICIAL_ID} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.getByText('Business Policy')).toBeTruthy()
  })

  it('each chip href is /officials/<id>#issue-positions:<slug>', () => {
    const { container } = render(<BioAlignmentChipRow chips={CHIPS} officialId={OFFICIAL_ID} />)
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(3)
    expect(links[0]?.getAttribute('href')).toBe(`/officials/${OFFICIAL_ID}#issue-positions:environment`)
    expect(links[1]?.getAttribute('href')).toBe(`/officials/${OFFICIAL_ID}#issue-positions:civil-rights`)
    expect(links[2]?.getAttribute('href')).toBe(`/officials/${OFFICIAL_ID}#issue-positions:business-policy`)
  })

  it('returns null (no DOM) when chips is empty', () => {
    const { container } = render(<BioAlignmentChipRow chips={[]} officialId={OFFICIAL_ID} />)
    expect(container.firstChild).toBeNull()
  })

  it('handles partial coverage (1 chip)', () => {
    render(<BioAlignmentChipRow chips={CHIPS.slice(0, 1)} officialId={OFFICIAL_ID} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.queryByText('Civil Rights')).toBeNull()
  })

  it('handles partial coverage (2 chips)', () => {
    render(<BioAlignmentChipRow chips={CHIPS.slice(0, 2)} officialId={OFFICIAL_ID} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.queryByText('Business Policy')).toBeNull()
  })

  it('row uses centered flex layout', () => {
    const { container } = render(<BioAlignmentChipRow chips={CHIPS} officialId={OFFICIAL_ID} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.display).toBe('flex')
    expect(wrapper.style.justifyContent).toBe('center')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/bio/BioAlignmentChipRow 2>&1 | tail -10
```

Expected: 6 tests fail with import error or "component not found".

- [ ] **Step 3: Implement**

`apps/web/components/bio/BioAlignmentChipRow.tsx`:

```tsx
import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

export interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  officialId: string
}

export function BioAlignmentChipRow({ chips, officialId }: BioAlignmentChipRowProps): React.JSX.Element | null {
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {chips.map(c => (
        <AlignmentChip
          key={c.issueArea}
          label={c.displayLabel}
          tier={c.tier}
          href={`/officials/${officialId}#issue-positions:${c.subCascadeSlug}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run green + typecheck**

```bash
pnpm --filter @chiaro/web test components/bio/BioAlignmentChipRow 2>&1 | tail -10
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: 6 tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/bio/BioAlignmentChipRow.tsx apps/web/test/components/bio/BioAlignmentChipRow.test.tsx
git commit -m "feat(web): BioAlignmentChipRow — top-3 chip strip with hash deep-links"
```

---

## Phase B — BioHeader integration (Tasks 4–5)

### Task 4: BioIdentityRow uses DistrictBadge

**Files:**
- Modify: `apps/web/components/bio/BioIdentityRow.tsx`

(No dedicated unit test for BioIdentityRow — covered by the BioHeader integration test in Task 5. Plain typecheck verification here.)

- [ ] **Step 1: Replace contents**

`apps/web/components/bio/BioIdentityRow.tsx`:

```tsx
import { PARTY_COLOR, PARTY_SHORT } from '@chiaro/ui-tokens'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

export interface BioIdentityRowProps {
  party: string
  chamber: 'house' | 'senate'
  stateName: string
  districtNumber: number | null
  atLarge: boolean
}

const chipBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: '0.72rem',
  fontWeight: 500,
  lineHeight: 1.4,
}

export function BioIdentityRow({ party, chamber, stateName, districtNumber, atLarge }: BioIdentityRowProps): React.JSX.Element {
  const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'
  const partyLabel = PARTY_SHORT[party as keyof typeof PARTY_SHORT] ?? party
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      <span style={{ ...chipBase, background: partyColor, color: '#fff', fontWeight: 600 }}>{partyLabel}</span>
      <span style={{ ...chipBase, background: '#f0eee5', color: '#3a352b' }}>{chamber === 'house' ? 'House' : 'Senate'}</span>
      <span style={{ ...chipBase, background: '#f0eee5' }}>
        <DistrictBadge chamber={chamber} stateName={stateName} districtNumber={districtNumber} atLarge={atLarge} />
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -10
```

Expected: at this point, the workspace will fail because `BioHeader.tsx` still passes `districtChipLabel` (old prop) to BioIdentityRow. That's fine — Task 5 fixes it. Note the failure and move on.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/bio/BioIdentityRow.tsx
git commit -m "refactor(web): BioIdentityRow — embed DistrictBadge in place of plain district pill"
```

---

### Task 5: BioHeader threads chips + officialId, slots BioAlignmentChipRow

**Files:**
- Modify: `apps/web/components/bio/BioHeader.tsx`
- Modify: `apps/web/test/components/bio/BioHeader.test.tsx`

- [ ] **Step 1: Update failing test**

Replace `apps/web/test/components/bio/BioHeader.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioHeader } from '@/components/bio/BioHeader'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

const OFFICIAL_ID = '84eeab39-349d-4ae9-acd2-2229a3d38569'

const PELOSI = {
  officialId: OFFICIAL_ID,
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
  chips: [] as AlignmentChipRow[],
}

const SAMPLE_CHIPS: AlignmentChipRow[] = [
  { issueArea: 'environment',   displayLabel: 'Environment',   tier: 'strongly-aligned', subCascadeSlug: 'environment' },
  { issueArea: 'civil-rights',  displayLabel: 'Civil Rights',  tier: 'mostly-aligned',   subCascadeSlug: 'civil-rights' },
  { issueArea: 'business-policy', displayLabel: 'Business Policy', tier: 'strongly-differs', subCascadeSlug: 'business-policy' },
]

describe('BioHeader', () => {
  it('renders name + identity row + service card + contact links for a house rep', () => {
    render(<BioHeader {...PELOSI} />)
    expect(screen.getByText('Nancy Pelosi')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    // DistrictBadge now renders descriptive text, not the plain "CA-11" pill.
    expect(screen.getByText("California's 11th District")).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText(/Since 2007/)).toBeTruthy()
    expect(screen.getByText('pelosi.house.gov')).toBeTruthy()
    expect(screen.getByText('@SpeakerPelosi')).toBeTruthy()
  })

  it('senate variant uses full state name (no district number)', () => {
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
    expect(screen.queryByText(/11th District/)).toBeNull()
  })

  it('at-large variant renders "<StateName>\'s At-Large District"', () => {
    render(
      <BioHeader
        {...PELOSI}
        state="WY" stateName="Wyoming" districtNumber={null} atLarge={true}
        role="Representative" firstElectedYear={2023}
      />
    )
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })

  it('renders top-3 alignment chips with hash deep-link hrefs when chips provided', () => {
    const { container } = render(<BioHeader {...PELOSI} chips={SAMPLE_CHIPS} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.getByText('Business Policy')).toBeTruthy()
    const hrefs = Array.from(container.querySelectorAll('a'))
      .map(a => a.getAttribute('href'))
      .filter((h): h is string => !!h && h.includes('#issue-positions:'))
    expect(hrefs).toContain(`/officials/${OFFICIAL_ID}#issue-positions:environment`)
    expect(hrefs).toContain(`/officials/${OFFICIAL_ID}#issue-positions:civil-rights`)
    expect(hrefs).toContain(`/officials/${OFFICIAL_ID}#issue-positions:business-policy`)
  })

  it('hides chip row when chips is empty', () => {
    render(<BioHeader {...PELOSI} chips={[]} />)
    expect(screen.queryByText('Environment')).toBeNull()
    expect(screen.queryByText('Civil Rights')).toBeNull()
  })

  it('gracefully hides contact links when both missing', () => {
    render(<BioHeader {...PELOSI} officialUrl={null} twitterHandle={null} />)
    expect(screen.queryByText('pelosi.house.gov')).toBeNull()
    expect(screen.queryByText('@SpeakerPelosi')).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/bio/BioHeader 2>&1 | tail -15
```

Expected: all 6 tests fail because `BioHeader` doesn't accept the new `chips` / `officialId` props yet, and still uses the old `districtChipLabel` plumbing.

- [ ] **Step 3: Replace BioHeader implementation**

`apps/web/components/bio/BioHeader.tsx`:

```tsx
import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { BioPortrait } from './BioPortrait'
import { BioIdentityRow } from './BioIdentityRow'
import { BioServiceCard } from './BioServiceCard'
import { BioContactLinks } from './BioContactLinks'
import { BioAlignmentChipRow } from './BioAlignmentChipRow'

export interface BioHeaderProps {
  officialId: string
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'house' | 'senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
  chips: AlignmentChipRow[]
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
      <BioIdentityRow
        party={p.party}
        chamber={p.chamber}
        stateName={p.stateName}
        districtNumber={p.districtNumber}
        atLarge={p.atLarge}
      />
      <BioAlignmentChipRow chips={p.chips} officialId={p.officialId} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </section>
  )
}
```

(Note: the `state` and `senateClass` props remain on `BioHeaderProps` for caller compatibility but are no longer used inside BioHeader. Kept to avoid forcing the page to change its prop shape twice in this slice; can be removed in a future cleanup pass.)

- [ ] **Step 4: Run green + workspace typecheck**

```bash
pnpm --filter @chiaro/web test components/bio/BioHeader 2>&1 | tail -10
pnpm --filter @chiaro/web typecheck 2>&1 | tail -10
```

Expected: 6 BioHeader tests pass. Workspace typecheck still has one remaining failure — the page (`apps/web/app/officials/[id]/page.tsx`) doesn't yet pass `chips` or `officialId` to `<BioHeader>`. Task 8 fixes that.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/bio/BioHeader.tsx apps/web/test/components/bio/BioHeader.test.tsx
git commit -m "feat(web): BioHeader — accepts chips + officialId, slots BioAlignmentChipRow"
```

---

## Phase C — Chamber threading (Tasks 6–7)

### Task 6: CommunityPresenceCategory gates Lives-in-District unavailable

**Files:**
- Modify: `apps/web/components/performance/categories/CommunityPresenceCategory.tsx`

- [ ] **Step 1: Replace component signature + Lives-in-District render**

Open `apps/web/components/performance/categories/CommunityPresenceCategory.tsx`. Make three changes:

1. Change the exported function signature from `{ officialId }: { officialId: string }` to `{ officialId, chamber }: { officialId: string; chamber: 'house' | 'senate' }`.

2. Replace the existing `<MetricCardShell ... />` Lives-in-District call with this block (immediately after `const m = metrics.data`):

```tsx
const livesInDistrictUnavailable = chamber === 'senate' || m?.lives_in_district == null
```

3. Replace the `<MetricCardShell ...>` JSX for Lives-in-District with:

```tsx
<MetricCardShell
  categoryId={CATEGORY}
  unavailable={livesInDistrictUnavailable}
  value={
    livesInDistrictUnavailable
      ? 'No Data'
      : m?.lives_in_district
        ? '✓ Yes'
        : '✗ No'
  }
  label="Lives in District"
  caption={
    livesInDistrictUnavailable
      ? 'no data available for this seat'
      : m?.home_district_id
        ? 'home maps to a district'
        : 'address outside represented district'
  }
  externalSourceUrl="https://www.fec.gov/data/"
/>
```

The rest of the function (offices + town halls cards, raw `<article>` blocks) stays unchanged.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -10
```

Expected: at this point, typecheck fails because `PerformanceSection` doesn't pass `chamber` to `<CommunityPresenceCategory>`. Task 7 fixes it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/performance/categories/CommunityPresenceCategory.tsx
git commit -m "feat(web): CommunityPresenceCategory — gate Lives-in-District on chamber, render unavailable for senate/no-metric"
```

---

### Task 7: PerformanceSection forwards chamber

**Files:**
- Modify: `apps/web/components/performance/PerformanceSection.tsx`

- [ ] **Step 1: Add chamber prop + forward**

Open `apps/web/components/performance/PerformanceSection.tsx`. Two changes:

1. Update the exported function signature:

```tsx
export function PerformanceSection({
  officialId,
  chamber,
}: {
  officialId: string
  chamber: 'house' | 'senate'
}): React.JSX.Element {
```

2. In the `bodyFor(id: CategoryId)` switch inside the function, change the `community-presence` case:

```tsx
case 'community-presence':     return <CommunityPresenceCategory officialId={officialId} chamber={chamber} />
```

(Other 5 categories stay unchanged.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -10
```

Expected: still failing — `page.tsx` doesn't yet pass `chamber` to `<PerformanceSection>`. Task 8 closes the loop.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/performance/PerformanceSection.tsx
git commit -m "feat(web): PerformanceSection — accept + forward chamber to CommunityPresenceCategory"
```

---

## Phase D — Page wiring + final verify (Tasks 8–9)

### Task 8: Page server-fetches scorecards, derives chips, threads props

**Files:**
- Modify: `apps/web/app/officials/[id]/page.tsx`

- [ ] **Step 1: Read current state**

```bash
cat apps/web/app/officials/[id]/page.tsx
```

Confirm the page is already a server component (`export default async function`) and currently fetches the `officials` + `officials_leadership_history` rows.

- [ ] **Step 2: Replace contents**

Replace `apps/web/app/officials/[id]/page.tsx` with:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BioHeader } from '@/components/bio/BioHeader'
import { PerformanceSection } from '@/components/performance/PerformanceSection'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { firstElectedYear as deriveFirstElectedYear } from '@/lib/derivations/service-record'
import type { Database } from '@chiaro/db'

interface Params { id: string }

type OfficialRow = Database['public']['Tables']['officials']['Row']
type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

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

// "CA-12" → { districtNumber: 12, atLarge: false }
// "WY-AL" → { districtNumber: null, atLarge: true }
// senate code (e.g. "CA-S1") → { districtNumber: null, atLarge: false }
function parseDistrictCode(code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (!code) return { districtNumber: null, atLarge: false }
  if (code.endsWith('-AL')) return { districtNumber: null, atLarge: true }
  const parts = code.split('-')
  const tail = parts[1]
  const n = tail ? parseInt(tail, 10) : NaN
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

export default async function OfficialPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Parallel fetch: official + district code + leadership history + scorecard ratings.
  const [officialRes, leadershipRes, scorecardsRes] = await Promise.all([
    supabase
      .from('officials')
      .select('*, district:districts(code)')
      .eq('id', id)
      .single<OfficialRow & { district: { code: string | null } | null }>(),
    supabase
      .from('officials_leadership_history')
      .select('*')
      .eq('official_id', id)
      .order('start_date', { ascending: false }),
    supabase
      .from('scorecard_ratings')
      .select('*, org:scorecard_orgs(*)')
      .eq('official_id', id),
  ])

  const official = officialRes.data
  if (!official) redirect('/')

  const leadership = (leadershipRes.data ?? []) as LeadershipRow[]
  const scorecards = scorecardsRes.data ?? []
  const chips = selectTopAlignmentChips(scorecards as Parameters<typeof selectTopAlignmentChips>[0])

  const currentRole = leadership.find(r => r.end_date == null)?.role
    ?? (official.chamber === 'house' ? 'Representative' : 'Senator')
  const firstElectedYearValue = deriveFirstElectedYear(leadership)
  const { districtNumber, atLarge } = parseDistrictCode(official.district?.code ?? null)

  return (
    <main>
      <BioHeader
        officialId={official.id}
        fullName={official.full_name}
        portraitUrl={official.portrait_url}
        party={official.party}
        chamber={official.chamber as 'house' | 'senate'}
        state={official.state}
        stateName={STATE_NAMES[official.state] ?? official.state}
        districtNumber={districtNumber}
        senateClass={(official.senate_class ?? null) as 1 | 2 | 3 | null}
        atLarge={atLarge}
        role={currentRole}
        firstElectedYear={firstElectedYearValue}
        officialUrl={official.official_url}
        twitterHandle={official.twitter_handle}
        chips={chips}
      />
      <PerformanceSection officialId={id} chamber={official.chamber as 'house' | 'senate'} />
    </main>
  )
}
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -10
pnpm --filter @chiaro/web build 2>&1 | tail -20
```

Expected: workspace typecheck clean; `pnpm build` succeeds; `/officials/[id]` route compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/officials/[id]/page.tsx
git commit -m "feat(web): page — server-fetch scorecards, derive chips, thread chamber"
```

---

### Task 9: Final verify + audit doc refresh

**Files:**
- Modify: `docs/superpowers/slice-4-drill-down-audit.md` (mark the three follow-ups resolved)

- [ ] **Step 1: Workspace checks**

```bash
pnpm -r typecheck                                        # all 9 packages clean
pnpm --filter @chiaro/web build 2>&1 | tail -15          # build green
pnpm --filter @chiaro/web test 2>&1 | tail -20           # apps/web vitest green (new + updated)
pnpm test 2>&1 | tail -20                                # full workspace test suite
```

Expected:
- `pnpm -r typecheck` exits 0 across all packages.
- `pnpm --filter @chiaro/web build` succeeds; `/officials/[id]` compiles to a ƒ (server) route.
- `pnpm --filter @chiaro/web test` reports all new + updated test files green.
- `pnpm test` — apps/web + all other packages green. (Note: `@chiaro/db` will pass 28/28 if local Supabase has districts seeded; otherwise some env-dependent tests skip with documented errors.)

- [ ] **Step 2: Manual smoke**

Ensure local services are running:

```bash
pnpm db:start                                            # if not already up
pnpm --filter @chiaro/db functions:serve                 # background; loads .env.local for GEOCODIO_KEY
pnpm --filter @chiaro/web dev                            # background
```

Visit each variant in a signed-in browser session:

- **House w/ full fixture** — `http://localhost:3000/officials/<carey-id>` (Mike Carey or whichever official `audit-fixture-attach.ts` was targeted at). Verify:
  - BioHeader order: portrait → name → `R | House | DistrictBadge` → 3 alignment chips → service card → contact links.
  - DistrictBadge text reads `Ohio's 15th District` (or whatever).
  - Click an alignment chip in BioHeader → page scrolls + Issue Positions sub-cascade auto-expands (hashchange listener).
- **Senate variant** — `http://localhost:3000/officials/<moreno-id>` (Bernie Moreno). Verify:
  - DistrictBadge text reads `Ohio` (no district number).
  - Lives-in-District card: `No Data` (italic grey) + grey dot + `Unavailable` + `no data available for this seat`.
- **At-large variant** — `http://localhost:3000/officials/<hageman-id>` (Harriet Hageman). Verify:
  - DistrictBadge text reads `Wyoming's At-Large District`.
  - Lives-in-District card: same N/A treatment as senate (no metric row).
- **House w/ metric ✓ Yes** — confirm the card still renders ✓/✗ correctly when `lives_in_district` is set.

- [ ] **Step 3: Update audit doc**

Open `docs/superpowers/slice-4-drill-down-audit.md`. In the `## Follow-ups for next slice` section, prefix each of the three bullets with `✅ RESOLVED 2026-05-18 (PR pending) —` so future audits show the chain of resolution. Example:

```
- ✅ **RESOLVED 2026-05-18 (PR pending)** — **Alignment-chip row in BioHeader (Row 0).** Today alignment chips ...
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/slice-4-drill-down-audit.md
git commit -m "docs(audit): mark BioHeader + cards polish follow-ups resolved"
```

---

## Acceptance — recapped from the spec

After Task 9 lands, all spec acceptance criteria must pass:

1. ✅ `/officials/[id]` bio header renders Portrait → Name → BioIdentityRow → AlignmentChipRow → ServiceCard → ContactLinks.
2. ✅ `BioIdentityRow` uses `DistrictBadge` for district (visual parity with home mini-strip).
3. ✅ Top-3 alignment chips appear when scorecards exist; chip row hidden when empty.
4. ✅ Clicking a chip in BioHeader (same page) opens the matching sub-cascade in IssuePositions and scrolls.
5. ✅ Senator's Lives-in-District card renders the locked N/A state.
6. ✅ House rep with no metrics row renders the same N/A state — no longer says "N/A (Senate)".
7. ✅ House rep with metrics row still renders ✓ Yes / ✗ No correctly.
8. ✅ `pnpm --filter @chiaro/web typecheck` clean.
9. ✅ `pnpm --filter @chiaro/web build` succeeds.
10. ✅ All new + updated unit tests green.

---

## Plan self-review notes

- **Spec coverage:** Every spec section maps to ≥1 task. MetricCardShell `unavailable` prop = Task 1. `useUrlHashSync` hashchange = Task 2. New `BioAlignmentChipRow` = Task 3. BioIdentityRow swap = Task 4. BioHeader integration = Task 5. CommunityPresenceCategory chamber gate = Task 6. PerformanceSection prop drill = Task 7. Page server-fetch = Task 8. Workspace verify = Task 9.
- **No placeholders:** Every code step shows the full code. No `TBD` / "implement similar to" references.
- **Type consistency:** `AlignmentChipRow` shape from Task 3 onward, `BioHeaderProps.chips: AlignmentChipRow[]` matches in Task 5. `chamber: 'house' | 'senate'` literal-union threads identically through Tasks 6, 7, 8. `unavailable?: boolean` prop name consistent in Tasks 1, 6.
- **Intermediate typecheck failures are expected.** Tasks 4, 6, 7 each leave the workspace temporarily uncompilable because the consumer (BioHeader / PerformanceSection / page) lags one task behind. The plan calls this out at each step. Final state at Task 8 is green.
