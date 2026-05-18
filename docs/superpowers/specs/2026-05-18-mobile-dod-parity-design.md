# Mobile DoD Parity — Design Spec

**Date:** 2026-05-18
**Status:** Design — pending plan
**Scope:** Port the entire officials-detail redesign (PR #2) + BioHeader polish (PR #3) + Finance placeholders (PR #4) to `apps/mobile/` (Expo Router, React Native), targeting Android + iOS. Delete superseded slice-4 mobile components.
**Predecessor:** [Finance Placeholders](2026-05-18-finance-placeholders-design.md) (merged 2026-05-18 as PR #4)

---

## Goal

Bring mobile to UI + behavior parity with web. As of PR #4 (merged 2026-05-18), `apps/web/` has three layers of redesign work that never reached `apps/mobile/`:

| Slice | Web | Mobile |
|---|---|---|
| 4 — slice-4 metric cards (FinanceCard, ScorecardCard, ShowUpWorkloadCard, PositionSalaryCard, ConstituentConnectionCard) | DELETED in redesign | **Still present** — never updated |
| 4.5 — officials-detail redesign (BioHeader + 6-category cascade + palette-A + inline evidence) | ✓ | **Missing** |
| 4.5 — BioHeader polish (AlignmentChips Row 0, DistrictBadge swap, MetricCardShell N/A treatment) | ✓ | **Missing** |
| 5A — Finance placeholders (TopAmountBreakdown, Individual Donors + Top Organizations sub-cascades) | ✓ | **Missing** |

After this slice, `apps/mobile/app/(app)/officials/[id].tsx` renders the same bio header + 6-category cascade UI as `apps/web/app/officials/[id]/page.tsx`. Home `OfficialsCard` mini-strip renders the same `DistrictBadge` + `AlignmentChip` deep-link pattern. The old slice-4 mobile cards are deleted.

This is the slice 2.5 mobile DoD deferred since slice 2, now expanded to cover all interim web work.

---

## Out of scope

- **Mobile-native UI redesign.** This slice mirrors web's design language exactly (palette-A accents, inline evidence expansion, cascade bars). Not the time for iOS-native segmented controls or Android Material elevations. A future *mobile-native UX* slice can adapt if desired.
- **Cross-platform component package.** Approach 2 from the brainstorm ("lift common UI into `@chiaro/ui`") is rejected as out-of-slice scope. Both web and mobile keep their own component implementations.
- **DB / ingest / query layer changes.** PR #4 already ships the data layer mobile UI consumes (`finance_individual_donors`, `finance_top_organizations`, extended `OfficialFinance` type). Mobile is purely a UI surface for existing data.
- **Animation polish.** No reanimated, no LayoutAnimation transitions on cascade expand. Plain conditional render — matches web's instant toggle.
- **iOS Developer credentials.** This slice ships iOS-compatible code but defers iOS on-device verification until paid Apple credentials are available (mobile DoD checklist already flags this). Android-on-device verification is required for this slice.

---

## Locked decisions

| Decision | Choice | Source |
|---|---|---|
| Target platforms | Android + iOS | Brainstorm clarifier |
| Deep-link mechanism | Expo Router search params (`?cat=...&sub=...`) | Brainstorm clarifier |
| Testing framework | `@testing-library/react-native` + `jest-expo` | Brainstorm clarifier |
| Decomposition | One big slice mirroring web's 37-task slice | Brainstorm clarifier |
| Implementation approach | File-for-file mirror under `apps/mobile/` (Approach 1) | Brainstorm clarifier |

---

## Architecture

Build RN equivalents of every web component under `apps/mobile/`. Each `apps/web/components/<x>.tsx` gets a sibling `apps/mobile/components/<x>.tsx` with the same name and (where possible) the same prop signature. RN primitives (`View`, `Text`, `Pressable`, `ScrollView`, `Image`) replace HTML elements; `StyleSheet.create` or inline `style={...}` objects replace CSS.

```
apps/mobile/components/
  cards/
    PillChevron.tsx                  NEW
    AlignmentChip.tsx                NEW
    DistrictBadge.tsx                NEW
    ComplianceIcon.tsx               NEW
    MetricCardShell.tsx              NEW (also replaces the legacy apps/mobile/components/MetricCardShell.tsx)
    EvidenceExpand.tsx               NEW
  bio/
    BioPortrait.tsx                  NEW
    BioIdentityRow.tsx               NEW
    BioServiceCard.tsx               NEW
    BioContactLinks.tsx              NEW
    BioAlignmentChipRow.tsx          NEW
    BioHeader.tsx                    NEW
  finance/
    FinanceSummaryStrip.tsx          NEW
    FinanceSubSectionHeading.tsx     NEW
    TopAmountBreakdown.tsx           NEW
  performance/
    CategoryBar.tsx                  NEW
    SubCascadeBar.tsx                NEW
    PerformanceSection.tsx           NEW
    useExpandedState.ts              NEW (copy-paste from web; pure React)
    useExpoParamSync.ts              NEW (replaces useUrlHashSync; reads useLocalSearchParams)
    categories/
      ServiceRecordCategory.tsx      NEW
      IssuePositionsCategory.tsx     NEW
      CommunityPresenceCategory.tsx  NEW
      FinanceCategory.tsx            NEW
      EthicsAccountabilityCategory.tsx NEW
      VotingBillsCategory.tsx        NEW

apps/mobile/lib/derivations/
  service-record.ts                  NEW (copy-paste from web; pure functions)
  finance.ts                         NEW
  alignment.ts                       NEW
  teasers.ts                         NEW

apps/mobile/app/(app)/officials/[id].tsx   REWRITE — replaces OfficialDetail + OfficialPerformance with BioHeader + PerformanceSection
apps/mobile/components/OfficialsCard.tsx   REWRITE — home mini-strip uses new DistrictBadge + AlignmentChip with `?cat=...&sub=...` deep-link

apps/mobile/components/                    DELETE (old slice-4 mobile cards superseded by redesign)
  ConstituentConnectionCard.tsx
  FinanceCard.tsx
  MetricCardShell.tsx                      (replaced by cards/MetricCardShell.tsx — different shape)
  OfficialDetail.tsx
  OfficialPerformance.tsx
  PositionSalaryCard.tsx
  ScorecardCard.tsx
  ShowUpWorkloadCard.tsx

apps/mobile/jest.config.js                 NEW
apps/mobile/jest-setup.ts                  NEW
apps/mobile/test/                          NEW (mirrors apps/web/test/ structure)
  components/cards/PillChevron.test.tsx
  components/cards/AlignmentChip.test.tsx
  components/cards/DistrictBadge.test.tsx
  components/cards/ComplianceIcon.test.tsx
  components/cards/MetricCardShell.test.tsx
  components/cards/EvidenceExpand.test.tsx
  components/bio/BioPortrait.test.tsx
  components/bio/BioAlignmentChipRow.test.tsx
  components/bio/BioHeader.test.tsx
  components/finance/TopAmountBreakdown.test.tsx
  components/performance/useExpandedState.test.ts
  components/performance/useExpoParamSync.test.ts
  components/performance/CategoryBar.test.tsx
  components/performance/SubCascadeBar.test.tsx

apps/mobile/package.json                   modify (+ jest-expo, @testing-library/react-native, @testing-library/jest-native, jest, @types/jest as devDeps; + `test` script)
```

Cross-platform — no changes:
- `@chiaro/ui-tokens` (pure constants — palette, alignment colors, finance shades, category labels)
- `@chiaro/officials` (TanStack hooks: `useOfficialMetrics`, `useOfficialFinance`, `useOfficialScorecardRatings`, etc.)
- `@chiaro/bills`
- `@chiaro/location`

---

## Component changes (highlights)

### Primitives — RN renderings

- **`PillChevron`** — `View` with circular border (`width: 18, height: 18, borderRadius: 9, borderWidth: 1`) wrapping `Text` showing ▸ or ▾. Same `open: boolean` prop. No `<svg>`.

- **`AlignmentChip`** — `Pressable` (when `href`) or `View` wrapping `Text`. Uses `useRouter()` from `expo-router`; on press `router.push(href)`. Same `label`, `tier`, `href?` props. Background color from `ALIGNMENT_CHIP_COLORS[tier]`.

- **`DistrictBadge`** — `View` row containing `react-native-svg` `<Svg><Path d="..." /></Svg>` (12×14 map-pin) + `Text` (descriptive label like "Ohio's 15th District"). `react-native-svg` is already a transitive Expo dep; if not direct, add to mobile package. Same 4 props.

- **`ComplianceIcon`** — `View` 18×18 with `Text` showing ✓ (green bg) or ✖ (amber bg). Same `state: 'on-time' | 'late'` prop.

- **`MetricCardShell`** — `View` with border + 3 vertical `Text` blocks (value, label with dot, optional caption) + optional CTA `Pressable`. Discriminated union `DrillDown` carries identically; `onPress` instead of `onClick`. `externalSourceUrl` triggers `Linking.openURL(url)`. `unavailable` prop forces label override to "Unavailable" with grey dot — same precedence rules as web.

- **`EvidenceExpand`** — `View` wrapper + `Pressable` toggle + conditional `children` block. Same `title`, `open`, `onToggle`, `children` props.

### Bio — RN renderings

- **`BioPortrait`** — `Image` source `{ uri: portraitUrl }` (when present) or `View` with `LinearGradient` (from `expo-linear-gradient`; add to mobile deps if missing) + `Text` initials. Same 3 props.
- **`BioIdentityRow`** — `View` flex-row + 2 `Text` chips + `DistrictBadge`. Same 5 props.
- **`BioServiceCard`** — `View` tint + 2 `Text` (label + role-pill + since-year). Same 2 props.
- **`BioContactLinks`** — `View` row + `Pressable` items wrapping `Text`. `onPress={() => Linking.openURL(url)}`. Same 2 props.
- **`BioAlignmentChipRow`** — `View` flex-row wrapping `AlignmentChip` map. Returns `null` when `chips.length === 0`. Same 2 props.
- **`BioHeader`** — `View` centered column. Replaces `<h1>` with `Text style={{ fontSize: 24, fontWeight: '700' }}`. Same 16-prop interface (`officialId`, `fullName`, `portraitUrl`, `party`, `chamber`, `state`, `stateName`, `districtNumber`, `senateClass`, `atLarge`, `role`, `firstElectedYear`, `officialUrl`, `twitterHandle`, `chips`).

### Finance — RN renderings

- **`FinanceSummaryStrip`** — `View` 3-cell row (`flexDirection: 'row'` + dividers via right-border on first two cells). Same 4 props.
- **`FinanceSubSectionHeading`** — `View` row with `Text` eyebrow + flex-1 `View` rule. Same 3 props.
- **`TopAmountBreakdown`** — `View` column of rows. Each row: `View` row with `Text` (label + amount + pct) above a `View` bar (width: percentage of max). Same `rows`, `noun`, `sourceUrl?` props. Toggle is a `Pressable` with `PillChevron` + `Text`.

### Performance infra — RN renderings

- **`CategoryBar`** — `Pressable` row with `PillChevron` + 2 `Text` (label + teaser). Same 4-prop interface.
- **`SubCascadeBar`** — Similar pattern with smaller fonts + placeholder variant. Same 7-prop interface.
- **`PerformanceSection`** — `View` column + `View` cascade containers. Uses `useExpandedState` + `useExpoParamSync` (new) + maps over the 6-category `ORDER` array. Same props as web's `PerformanceSection`.
- **`useExpandedState`** — Copy-paste from web. Pure React.
- **`useExpoParamSync`** — Replaces `useUrlHashSync`. Reads `useLocalSearchParams<{ cat?: string; sub?: string }>` from `expo-router`. Effect runs on mount + on params change; calls `api.openCategory(cat)` + `api.openSubCascade(cat, sub)` when valid. Validates `cat` against `CATEGORY_LABEL` keys.

### Categories — RN renderings

All six category components mirror web 1:1 with `View`/`Text` in place of `div`/`span`. Same hooks (`useOfficialMetrics`, `useOfficialLeadershipHistory`, `useOfficialDistrictOffices`, `useOfficialTownHalls`, `useOfficialScorecardRatings`, `useOfficialVotesOnSubject`, `useOfficialFinance`, `useOfficialStockTransactions`, `useOfficialMissedVotes`, `useOfficialSponsoredBills`, `useOfficialCosponsoredBills`). Same prop interfaces. Layout adapts CSS grid to `flexDirection: 'row' + flexWrap: 'wrap'` with computed widths (`width: '32%'` for 3-card rows, `width: '49%'` for 2-card rows).

### Page integration

```tsx
// apps/mobile/app/(app)/officials/[id].tsx (rewritten)
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useOfficial, useOfficialScorecardRatings, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { firstElectedYear as deriveFirstElectedYear } from '@/lib/derivations/service-record'
import { BioHeader } from '@/components/bio/BioHeader'
import { PerformanceSection } from '@/components/performance/PerformanceSection'

const client = createSupabaseBrowserClient()

const STATE_NAMES: Record<string, string> = { /* same map as web page.tsx */ }

function parseDistrictCode(chamber: string, code: string | null | undefined) { /* same as web */ }

export default function OfficialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const officialId = id ?? ''
  const officialQ = useOfficial(client, officialId)
  const leadershipQ = useOfficialLeadershipHistory(client, officialId)
  const scorecardsQ = useOfficialScorecardRatings(client, officialId)

  if (officialQ.isLoading) return <Text>Loading…</Text>
  if (!officialQ.data) return <Text>Not found</Text>
  const official = officialQ.data
  const leadership = leadershipQ.data ?? []
  const chips = selectTopAlignmentChips(scorecardsQ.data ?? [])

  const currentRole = leadership.find(r => r.end_date == null)?.role
    ?? (official.chamber === 'house' ? 'Representative' : 'Senator')
  const firstElectedYearValue = deriveFirstElectedYear(leadership)
  const { districtNumber, atLarge } = parseDistrictCode(official.chamber, official.district?.code)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <ScrollView>
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
        <PerformanceSection officialId={officialId} chamber={official.chamber as 'house' | 'senate'} />
      </ScrollView>
    </SafeAreaView>
  )
}
```

The home `OfficialsCard.tsx` mini-strip is rewritten to use the new `DistrictBadge` + `AlignmentChip` with `href={`/officials/${o.id}?cat=issue-positions&sub=${chip.subCascadeSlug}`}`.

### Deletions

After all consumers migrate, these old slice-4 mobile components are deleted:
- `apps/mobile/components/OfficialDetail.tsx`
- `apps/mobile/components/OfficialPerformance.tsx`
- `apps/mobile/components/ConstituentConnectionCard.tsx`
- `apps/mobile/components/FinanceCard.tsx`
- `apps/mobile/components/MetricCardShell.tsx` (replaced by `cards/MetricCardShell.tsx`)
- `apps/mobile/components/PositionSalaryCard.tsx`
- `apps/mobile/components/ScorecardCard.tsx`
- `apps/mobile/components/ShowUpWorkloadCard.tsx`

`OfficialAvatar.tsx`, `OfficialMeta.tsx`, `PartyBadge.tsx` stay (still consumed by `OfficialsList.tsx`).

---

## Data flow

```
[Mobile client]
  useLocalSearchParams() → { id, cat?, sub? }
  ↓
  useOfficial(client, id)
  useOfficialScorecardRatings(client, id)
  useOfficialLeadershipHistory(client, id)
  ↓
  const chips = selectTopAlignmentChips(scorecards.data ?? [])
  ↓
  <SafeAreaView>
    <ScrollView>
      <BioHeader {...derivedProps} chips={chips} />
      <PerformanceSection officialId={id} chamber={official.chamber} />
         ↓ (useExpandedState + useExpoParamSync({ cat, sub }) → auto-opens matching category + sub-cascade)
         6 categories — each uses its own TanStack hooks via @chiaro/officials / @chiaro/bills
```

Key differences from web:

- **Chips fetched client-side** via `useOfficialScorecardRatings` (not server-rendered). Brief loading flicker on first mount is acceptable.
- **Deep-link via search params** — `useExpoParamSync` reads `useLocalSearchParams<{ cat?, sub? }>` and calls `openCategory` / `openSubCascade` when params present + valid. Equivalent UX to web's hash-fragment behavior.
- **External URLs via `Linking.openURL`** — applies to MetricCardShell external sources, BioContactLinks, OpenSecrets / FEC links inside evidence rows, town-hall sources, stock transaction sources.

---

## Error handling + edge cases

**Mobile-specific**

- **Notch / status bar** — page wraps in `SafeAreaView` from `react-native-safe-area-context` with `edges={['top']}`. Bottom indicator inset handled by `ScrollView` content.
- **Android hardware back button** — handled by Expo Router by default; no special wiring.
- **External URL failure** — `Linking.openURL(url)` rejects when no app can handle the URL. Wrap in `.catch(() => { /* swallow */ })` since failure is non-critical. No user-visible error UI needed.
- **`useLocalSearchParams` returning arrays** — Expo Router can return `string | string[]` for repeated query keys. We expect single strings only; coerce: `const catParam = Array.isArray(cat) ? cat[0] : cat`.
- **`react-native-svg` not yet a direct dep** — add to `apps/mobile/package.json` if Expo SDK doesn't ship it transitively (verify before relying).
- **`expo-linear-gradient` for `BioPortrait` initials fallback** — add to mobile deps if not present.

**Carry-over from web**

- **Empty chip list** — `BioAlignmentChipRow` returns `null` (same as web).
- **No metrics row** — Category empty-states fire (FinanceCategory's "No OpenSecrets data…", etc.).
- **Senator's Lives-in-District** — `unavailable={chamber === 'senate' || lives_in_district == null}` gate same as web. Renders muted "No Data" / "Unavailable" via `MetricCardShell`.
- **Unknown deep-link `cat`** — `useExpoParamSync` validates against `CATEGORY_LABEL` keys; unknown values ignored.

**Test framework setup**

- **`jest-expo` preset** transforms RN modules (gesture-handler, reanimated, etc.) without needing custom `transformIgnorePatterns`.
- **`@testing-library/react-native`** provides `render`, `screen`, `fireEvent` (with `press` instead of `click`). Newer versions auto-cleanup; explicit `afterEach(cleanup)` in `jest-setup.ts` as a safety net (mirrors web's `test/setup.ts` pattern).
- **`@testing-library/jest-native`** adds RN-specific matchers (`toBeVisible`, `toHaveTextContent`).
- **Expo Router mocks** — `useLocalSearchParams` mocked in `useExpoParamSync.test.ts` by `vi.mock('expo-router', ...)` — equivalent pattern to web's `useUrlHashSync.test.ts`.
- **`react-native-svg` mock** — `jest-expo` provides a default mock; tests for `DistrictBadge` assert on rendered `Text` content, not SVG path.

**Deletion safety**

After page rewrite, old slice-4 components have zero consumers in `apps/mobile/`. Pattern mirrors web Task 36: grep for imports, batch-delete, run `pnpm --filter @chiaro/mobile typecheck`.

**No DB / ingest changes**

PR #4 already ships the data layer mobile consumes (`finance_individual_donors`, `finance_top_organizations`, extended `OfficialFinance` type). Mobile is purely a UI surface.

---

## Testing

### New mobile test infrastructure

- **`apps/mobile/package.json` devDeps**:
  - `jest-expo` (^54.x to match Expo SDK)
  - `@testing-library/react-native` (^12.x or current)
  - `@testing-library/jest-native` (matchers)
  - `jest` (peer)
  - `@types/jest`
- **`apps/mobile/jest.config.js`** — preset `jest-expo`; testMatch on `test/**/*.test.{ts,tsx}`; setupFilesAfterEach pointing at `jest-setup.ts`.
- **`apps/mobile/jest-setup.ts`** — imports `@testing-library/jest-native/extend-expect`; `afterEach(cleanup)` from `@testing-library/react-native`.
- **`apps/mobile/package.json` scripts**: add `"test": "jest"`.

### New unit tests (mirror web's test set)

- `test/components/cards/PillChevron.test.tsx`
- `test/components/cards/AlignmentChip.test.tsx`
- `test/components/cards/DistrictBadge.test.tsx`
- `test/components/cards/ComplianceIcon.test.tsx`
- `test/components/cards/MetricCardShell.test.tsx`
- `test/components/cards/EvidenceExpand.test.tsx`
- `test/components/bio/BioPortrait.test.tsx`
- `test/components/bio/BioAlignmentChipRow.test.tsx`
- `test/components/bio/BioHeader.test.tsx`
- `test/components/finance/TopAmountBreakdown.test.tsx`
- `test/components/performance/useExpandedState.test.ts`
- `test/components/performance/useExpoParamSync.test.ts`
- `test/components/performance/CategoryBar.test.tsx`
- `test/components/performance/SubCascadeBar.test.tsx`

Each mirrors the corresponding web test case-for-case (e.g., `BioHeader.test.tsx` has 6 cases covering identity row text, senate variant, at-large variant, chip row, empty-chip hiding, contact-link fallback). Total ~75-90 cases across 14 files.

### Manual smoke (DoD checklist refresh)

`docs/superpowers/mobile-dod-checklist.md` extended with sections for:
- **Slice 4.5 — officials-detail redesign**: bio header arrangement, 6 categories collapse/expand, sub-cascade behavior, inline evidence (no modal), placeholder soft-beige rendering, hash-deep-link from home mini-strip (via search params on mobile).
- **Slice 4.5 — BioHeader polish**: top-3 chip row, DistrictBadge text, MetricCardShell N/A state on senator's Lives-in-District card.
- **Slice 5A — Finance placeholders**: Individual Donors + Top Organizations sub-cascades render bars (not placeholders); Top Industries still works.
- **Three variants**: House w/ fixture (Mike Carey), Senate (Bernie Moreno), At-Large (Harriet Hageman) — same audit targets as web.

### Tooling

No new bundler config — `jest-expo` slots in via preset. Existing `pnpm --filter @chiaro/mobile typecheck` keeps working unchanged.

---

## Acceptance criteria

1. ✅ `apps/mobile/app/(app)/officials/[id].tsx` renders the new `<BioHeader />` + `<PerformanceSection />` in place of the old `OfficialDetail` + `OfficialPerformance`.
2. ✅ All 6 category components render with palette-A accents matching web.
3. ✅ Top-3 alignment chips appear on `BioHeader` when scorecards exist; row hidden when empty.
4. ✅ `BioIdentityRow` uses `DistrictBadge` (map-pin) for district chip.
5. ✅ Senate variant Lives-in-District card shows "No Data" + grey dot + "Unavailable" + "no data available for this seat".
6. ✅ Finance category shows Individual Donors + Top Organizations as real cascades (not placeholders).
7. ✅ Home `OfficialsCard` chip deep-links to `/officials/<id>?cat=issue-positions&sub=<slug>` and `useExpoParamSync` auto-expands the matching sub-cascade on mount.
8. ✅ External links (MetricCardShell sources, BioContactLinks, evidence-row sources) open via `Linking.openURL`.
9. ✅ Page wraps in `SafeAreaView` with top edge inset.
10. ✅ Old slice-4 mobile components deleted (8 files).
11. ✅ `pnpm --filter @chiaro/mobile typecheck` clean.
12. ✅ `pnpm --filter @chiaro/mobile test` green across ~14 new test files / ~75-90 cases.
13. ✅ Updated DoD checklist in `docs/superpowers/mobile-dod-checklist.md` covers slices 4 + 4.5 + 5A.
14. ✅ Android on-device DoD run passes for the three variants (Mike Carey, Bernie Moreno, Harriet Hageman). iOS deferred until paid Apple credentials available.
