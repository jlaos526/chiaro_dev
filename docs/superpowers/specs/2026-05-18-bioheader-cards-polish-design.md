# BioHeader + Cards Polish — Design Spec

**Date:** 2026-05-18
**Status:** Shipped 2026-05-18 via PR #3 (`d6da6d5`)
**Scope:** `/officials/[id]` page bio header + `MetricCardShell` N/A treatment + `CommunityPresenceCategory` chamber-gating fix
**Predecessor:** [Officials Detail Redesign](2026-05-17-officials-detail-redesign-design.md) (slice 4.x, merged 2026-05-18 as PR #2)

---

## Goal

Three follow-ups surfaced during the 2026-05-18 manual smoke test of the officials-detail redesign:

1. **Alignment chips on the detail page.** Home `OfficialsCard` mini-strip carries a top-3 `AlignmentChip` row that gives a single-glance summary of an official's stance. The detail page renders the same alignment data only as text inside each scorecard card (`AlignmentLabel` per tier), so there's no equivalent summary at the top — clicking from home → detail loses the visual continuity.
2. **District chip visual parity.** Today `BioIdentityRow` renders district as a plain pill chip; the home mini-strip uses the map-pin–styled `DistrictBadge` component. Same data, two presentations.
3. **N/A metric card UX + correctness.** On senate variants the "Lives in District" card renders `N/A (Senate)` (correct) but the row below shows the teal category-accent dot next to the unchanged label, scanning as a contradictory affirmation. On house-rep variants with no metrics row, the card incorrectly renders `N/A (Senate)` (wrong chamber) because the gate is on `m?.lives_in_district == null` instead of `chamber === 'senate'`.

This slice resolves all three in a single coordinated polish pass on `BioHeader` + `MetricCardShell`. Zero migrations, zero new domain logic, zero new packages.

---

## Out of scope

- Mobile parity (`apps/mobile/app/officials/[id].tsx`) — separate slice
- New scorecard ingest or backfill for officials without ratings — separate slice
- Auto-detecting N/A from value string in `MetricCardShell` (we use an explicit `unavailable` prop)
- Refactoring `CommunityPresenceCategory`'s `District Offices` / `Town Halls` raw `<article>` blocks to use `MetricCardShell` — keep cosmetic-only changes scoped

---

## Visual language — locked decisions

### BioHeader vertical arrangement

Locked during 2026-05-18 visual brainstorm (option C variant). The order top-to-bottom:

```
BioPortrait                                     (unchanged)
<h1>Full Name</h1>                              (unchanged)
BioIdentityRow:  R | House | 📍 OH-15           ← DistrictBadge replaces plain pill
BioAlignmentChipRow:  Environment · Civil Rights · Business     ← NEW (top-3 chips)
BioServiceCard:  CURRENT ROLE [Representative] · Since 2021      (unchanged)
BioContactLinks                                 (unchanged)
```

- Identity row keeps three chips in one row: `party | chamber | DistrictBadge`. DistrictBadge replaces the third plain `<span>`.
- Alignment chip row sits between identity row and service card. Color-only chips (no `✓✓` / `✗✗` glyphs — slice-4 decision preserved).
- Each chip deep-links to `/officials/<this-id>#issue-positions:<sub-cascade-slug>`. Clicking expands the matching sub-cascade on the same page via `useUrlHashSync`.
- Row collapses (returns `null`) when chips list is empty — no empty-state copy in bio.

### MetricCardShell N/A treatment

Locked during 2026-05-18 visual brainstorm (option A variant).

| Property | Normal | `unavailable={true}` |
|---|---|---|
| Card bg | `CATEGORY_CARD_GRADIENT[categoryId]` | `#fafaf6` (flat) |
| Value text | `#1a1714` regular weight 700 | `#807a72` regular weight 700 **italic** |
| Dot color | `CATEGORY_ACCENT[categoryId]` | `#807a72` |
| Label | consumer-provided | force `"Unavailable"` |
| Caption | consumer-provided | consumer-provided, rendered italic grey |
| CTA (view evidence / view source) | rendered per drilldown prop | suppressed |

Consumer still controls value text (e.g., `"No Data"`) and caption text (e.g., `"no data available for this seat"`).

### Universal N/A copy

| Position | Copy |
|---|---|
| Value | `"No Data"` |
| Label | `"Unavailable"` (forced by shell) |
| Caption | `"no data available for this seat"` |

Same copy applies to both senator variants and house-variants-with-no-metric. Chamber-gating logic determines *when* to switch to this state; the visual rendering is identical.

---

## Architecture

Purely additive cosmetic + correctness work. No client/server boundary changes. The `/officials/[id]` page is the orchestrator: it server-fetches the official, leadership rows, AND scorecards in parallel, runs the existing pure `selectTopAlignmentChips()` helper on the result, then passes computed props to `BioHeader` and `PerformanceSection`.

```
apps/web/app/officials/[id]/page.tsx          modify (+ scorecard fetch + chip derivation)
└─ BioHeader                                   modify (+ chips prop)
   ├─ BioPortrait                              unchanged
   ├─ <h1>Name</h1>                            unchanged
   ├─ BioIdentityRow                           modify (4-field props, DistrictBadge inside)
   ├─ BioAlignmentChipRow                      NEW (top-3 chips slot)
   ├─ BioServiceCard                           unchanged
   └─ BioContactLinks                          unchanged
└─ PerformanceSection                          modify (+ chamber prop, forward)
   └─ CommunityPresenceCategory                modify (+ chamber prop, gate unavailable)
      └─ MetricCardShell                       modify (+ unavailable prop)
```

`BioHeader` remains a pure prop-driven component (no `'use client'`). No new TanStack Query hooks introduced.

---

## Component changes

### Modified: `apps/web/app/officials/[id]/page.tsx`

Add a third Supabase query alongside existing officials + leadership fetches:

```ts
supabase.from('scorecard_ratings')
  .select('*, org:scorecard_orgs(*)')
  .eq('official_id', id)
```

Returns `ScorecardRatingWithOrg[]` (same shape `useOfficialScorecardRatings` returns). Run all three in `Promise.all` so the page's first-byte time doesn't regress.

Derive chips server-side using the existing pure helper:

```ts
const chips = selectTopAlignmentChips(scorecardRatings ?? [])
// → AlignmentChipRow[] (max 3, may be fewer for partial coverage)
```

Pass `chips` to `<BioHeader />` and `chamber={official.chamber}` to `<PerformanceSection />`.

### Modified: `apps/web/components/bio/BioHeader.tsx`

Add to `BioHeaderProps`:

```ts
chips: AlignmentChipRow[]
```

Render order between `BioIdentityRow` and `BioServiceCard`:

```tsx
<BioIdentityRow {...identityProps} />
<BioAlignmentChipRow chips={p.chips} officialId={p.officialId} />
<BioServiceCard ... />
```

Delete the now-unused `districtChipLabel()` helper — `DistrictBadge` consumes the raw fields directly.

**Open detail:** `BioHeader` currently doesn't receive `officialId`. Add it as a new required prop on `BioHeaderProps` so `BioAlignmentChipRow` can construct hash deep-links.

### Modified: `apps/web/components/bio/BioIdentityRow.tsx`

Props change shape:

```diff
 interface BioIdentityRowProps {
   party: string
   chamber: 'house' | 'senate'
-  districtChipLabel: string
+  stateName: string
+  districtNumber: number | null
+  atLarge: boolean
 }
```

Inside the row, replace the third district `<span>` with `<DistrictBadge chamber stateName districtNumber atLarge />`. Other two chips (party, chamber) stay as `<span>` chips.

### NEW: `apps/web/components/bio/BioAlignmentChipRow.tsx`

```ts
interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  officialId: string
}
```

- Returns `null` when `chips.length === 0`.
- Otherwise renders a centered flex row of `<AlignmentChip label tier href>` elements.
- Each chip's `href` is `/officials/${officialId}#issue-positions:${chip.subCascadeSlug}`.
- Layout matches `BioIdentityRow` (gap 5px, flex-wrap, justify-center) for visual rhythm consistency.

### Modified: `apps/web/components/cards/MetricCardShell.tsx`

Add to `BaseProps`:

```ts
unavailable?: boolean
```

When true:
- Background: flat `#fafaf6` (overrides `CATEGORY_CARD_GRADIENT[categoryId]`)
- Value text: italic `#807a72`, weight stays 700
- Dot: `#807a72` (overrides `CATEGORY_ACCENT[categoryId]`)
- Label: force `"Unavailable"` (overrides consumer `label`)
- Caption: italic `#807a72` (consumer-provided text preserved)
- CTA: suppressed (`onExpand` / `externalSourceUrl` ignored, no button or link rendered)

When false / undefined: identical to today's render.

`placeholder` and `unavailable` remain independent — placeholder is for soft-beige "data coming slice 5+" cells; unavailable is for "real data fetched, none exists for this seat."

### Modified: `apps/web/components/performance/PerformanceSection.tsx`

Add to props:

```ts
chamber: 'house' | 'senate'
```

Forward to `<CommunityPresenceCategory officialId={...} chamber={...} />`. Other 5 categories don't need the prop.

### Modified: `apps/web/components/performance/categories/CommunityPresenceCategory.tsx`

Accept `chamber` prop. For the Lives-in-District `MetricCardShell` call:

```ts
const unavailable = chamber === 'senate' || metrics.data?.lives_in_district == null
const livesInDistrict = metrics.data?.lives_in_district
```

(The condition fires on chamber === 'senate' for all senators regardless of metric state, OR on a null `lives_in_district` field for any official — which covers both "no metrics row yet" and "metrics row exists but field is null".)

Pass:

```tsx
<MetricCardShell
  categoryId={CATEGORY}
  unavailable={unavailable}
  value={unavailable ? 'No Data' : livesInDistrict ? '✓ Yes' : '✗ No'}
  label="Lives in District"
  caption={unavailable
    ? 'no data available for this seat'
    : (metrics.data?.home_district_id ? 'home maps to a district' : 'address outside represented district')}
  externalSourceUrl="https://www.fec.gov/data/"
/>
```

The shell's `unavailable` branch will force the label to "Unavailable" — passing the original label keeps the call site self-documenting but the shell overrides at render time.

### Modified: `apps/web/components/performance/useUrlHashSync.ts`

Add a `hashchange` event listener so re-navigating to a different hash on the same page also fires the parse + open + scroll. Today the effect is mount-only — clicking a `BioAlignmentChipRow` chip on the same detail page updates the URL hash but doesn't expand the matching sub-cascade.

One-line change: subscribe to `window.addEventListener('hashchange', parseAndApply)` in addition to running it on mount. Cleanup on unmount.

---

## Data flow

```
[Server: page.tsx]
  await Promise.all([
    supabase.from('officials').select('*').eq('id', id).single(),
    supabase.from('officials_leadership_history').select('...').eq('official_id', id),
    supabase.from('scorecard_ratings').select('*, org:scorecard_orgs(*)').eq('official_id', id),
  ])
  ↓
  const chips = selectTopAlignmentChips(scorecardRatings ?? [])
  ↓
  return (
    <BioHeader {...bioProps} chips={chips} />
    <PerformanceSection officialId={id} chamber={official.chamber} />
  )

[Client: BioHeader (pure props, no hooks)]
  <BioIdentityRow chamber stateName districtNumber atLarge />
     ↓
     <DistrictBadge chamber stateName districtNumber atLarge />
  <BioAlignmentChipRow chips officialId />
     ↓
     chips.map(c => <AlignmentChip label tier href={`/officials/${officialId}#issue-positions:${c.subCascadeSlug}`} />)

[Client: PerformanceSection]
  <CommunityPresenceCategory officialId chamber />
     ↓
     <MetricCardShell unavailable={chamber === 'senate' || !metric} value="No Data" ... />
```

All other PerformanceSection categories continue to use their existing TanStack hooks (officials metrics, finance, stock, leadership). This slice introduces zero new client-side queries.

---

## Error handling + edge cases

- **Scorecards fetch fails server-side.** Catch and pass `chips: []`. Page still renders; bio shows portrait → name → identity → service → contacts with no chip row. Log error to server console.
- **Empty chip list (`chips.length === 0`).** `BioAlignmentChipRow` returns `null`. No empty-state copy in bio (that lives in `IssuePositionsCategory`).
- **Fewer than 3 scorecards.** `selectTopAlignmentChips` already handles partial coverage — returns whatever it has, up to 3.
- **`unavailable` + `onExpand` / `externalSourceUrl` collision.** When `unavailable === true`, CTA is suppressed regardless. Documented inline as: "unavailable cards have no drill affordance — there's nothing to drill into."
- **Hash deep-link from BioHeader to same-page sub-cascade.** Adding the `hashchange` listener to `useUrlHashSync` lets BioHeader chips trigger expansion on the same detail page. Also benefits any future in-page hash navigation.
- **`chamber` prop drill.** Type-safe: `chamber` is a non-null enum on the `officials` row. TypeScript flags missing prop at the call site.
- **House rep with `lives_in_district` set but no `home_district_id`.** Existing branch (✗ No + "address outside represented district") preserved — `unavailable` doesn't fire because `lives_in_district` is non-null.

---

## Testing

### New unit tests

- **`test/components/bio/BioAlignmentChipRow.test.tsx`** — covers:
  - 3 chips render with correct labels + tiers
  - Each chip's `href` matches `/officials/<id>#issue-positions:<slug>`
  - Returns `null` when `chips === []`
  - Handles partial coverage (1 or 2 chips)

### Updated unit tests

- **`test/components/cards/MetricCardShell.test.tsx`** — extend with:
  - `unavailable: true` renders muted `#fafaf6` bg + italic grey value
  - `unavailable: true` forces label to `"Unavailable"`
  - `unavailable: true` renders grey dot regardless of `categoryId`
  - `unavailable: true` suppresses CTA even when `onExpand` provided
  - Caption renders when both `caption` and `unavailable` provided (italic grey)
- **`test/components/performance/useUrlHashSync.test.tsx`** — extend with:
  - `hashchange` event re-fires parse + open + scroll
  - Mount + hashchange both reach `openCategory` + `openSubCascade`
- **`test/components/bio/BioHeader.test.tsx`** — update fixtures:
  - Pass `chips: AlignmentChipRow[]`; assert chip row with correct `href`s
  - Senate variant with `chips: []`; assert no chip row in DOM
  - At-large variant; assert `DistrictBadge` content (`WY-AL`) instead of plain pill

### Manual smoke (no automated coverage)

- `CommunityPresenceCategory` chamber gating — verify on Moreno (senate → unavailable) + Hageman (house, no metric → unavailable) + Carey (house, with metric → ✓/✗)
- `page.tsx` server-fetch — verify chip row renders without hydration flicker on detail page load
- Hash deep-link from BioHeader to same-page sub-cascade — manual click test confirms scroll + expand

### Tooling

No new test infrastructure needed. JSX automatic + shared `test/setup.ts` already in place from slice-4 redesign work.

---

## Acceptance criteria

1. ✅ `/officials/[id]` detail page bio header renders Portrait → Name → BioIdentityRow → AlignmentChipRow → ServiceCard → ContactLinks.
2. ✅ `BioIdentityRow` uses `DistrictBadge` for the district chip (visual parity with home mini-strip).
3. ✅ Top-3 alignment chips appear when scorecards exist; chip row hidden when empty.
4. ✅ Clicking a chip in BioHeader (same page) opens the matching sub-cascade in IssuePositions and scrolls to it.
5. ✅ Senator's "Lives in District" card renders the locked N/A state (No Data + grey dot + Unavailable + "no data available for this seat").
6. ✅ House rep with no metrics row renders the same N/A state — no longer says "N/A (Senate)".
7. ✅ House rep with metrics row still renders ✓ Yes / ✗ No correctly.
8. ✅ `pnpm --filter @chiaro/web typecheck` clean.
9. ✅ `pnpm --filter @chiaro/web build` succeeds.
10. ✅ All new + updated unit tests green.
