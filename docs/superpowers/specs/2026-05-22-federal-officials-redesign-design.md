# Slice 6 — Federal Officials Redesign (state-card pattern parity)

**Date:** 2026-05-22
**Branch:** `slice-6-federal-redesign`
**Scope:** Refactor `/officials/[id]` on web + mobile to use the slice 5xx state-card collapsible-subsection pattern. Replaces 6 federal `CategoryId` components + `PerformanceSection.tsx` with 6 new `FederalXxxCard` components mirroring the state design.

## Why this slice

After slice 5I closed the state-officials detail-page redesign, the federal `/officials/[id]` page still uses an older `PerformanceSection` + 6 `CategoryId` (MetricCardShell + EvidenceExpand) component pattern from slice 4. The state-side pattern (collapsible subsections + em-dash NULL convention + signal-color chips + unified empty-state) has been validated across slices 5C-5I and is the convergent design system.

Goal: visual + structural parity between `/officials/[id]` (federal) and `/state-officials/[id]` (state). After this slice, the same design pattern + token vocabulary applies on both sides, making future shared-component extraction (e.g., a `@chiaro/officials-ui` package) tractable.

This is a **UI refactor with no schema work**. Federal hooks, tables, and ingest scripts are unchanged.

## Architecture summary

- **Zero schema changes.** Migrations stay at 0050. pgTAP plans stay at 393 across 29 files.
- **Zero new hooks.** Federal hooks in `@chiaro/officials` + `@chiaro/bills` are unchanged.
- **Workspace stays at 10 packages.**
- **New directories:** `apps/web/components/federal/` + `apps/mobile/components/federal/` for the new cards.
- **Deletions at slice end:** ~14 files across `apps/{web,mobile}/components/performance/` (replaced by new cards).

## 6 federal cards (replaces 6 CategoryId components)

| # | New card | Composes hooks | Replaces |
|---|---|---|---|
| 1 | `FederalServiceRecordCard` | `useOfficialMetrics`, `useOfficialLeadershipHistory` | `ServiceRecordCategory` |
| 2 | `FederalFinanceCard` | `useOfficialFinance` | `FinanceCategory` |
| 3 | `FederalIssuePositionsCard` | `useOfficialScorecardRatings` | `IssuePositionsCategory` |
| 4 | `FederalCommunityPresenceCard` | `useOfficialDistrictOffices`, `useOfficialTownHalls` | `CommunityPresenceCategory` |
| 5 | `FederalEthicsAccountabilityCard` | `useOfficialStockTransactions` + `useOfficialMetrics` (for STOCK Act compliance %) | `EthicsAccountabilityCategory` |
| 6 | `FederalVotingBillsCard` | `useOfficialSponsoredBills`, `useOfficialCosponsoredBills`, `useOfficialVotes` from `@chiaro/bills` | `VotingBillsCategory` |

**Asymmetries with state — by design:**
- **Federal Ethics is 1 card** (state has 2: Financial Activity + Conduct). Federal lacks ethics-complaint, recall, expulsion data. Single card focused on STOCK Act compliance + trades.
- **Federal Voting Bills is standalone** (state folds bills + votes into Service Record). Federal voting record is large enough to warrant its own card.
- **Federal Community Presence has 2 subsections** (state has 3). Federal lacks committee-hearings table (slice 5H added only `state_committee_hearings`). Federal town halls + district offices only.

Both asymmetries documented in CLAUDE.md Gotcha #15.

## Component file layout

```
apps/web/components/federal/                          # NEW directory
  FederalServiceRecordCard.tsx + .test.tsx
  FederalFinanceCard.tsx + .test.tsx
  FederalIssuePositionsCard.tsx + .test.tsx
  FederalCommunityPresenceCard.tsx + .test.tsx
  FederalEthicsAccountabilityCard.tsx + .test.tsx
  FederalVotingBillsCard.tsx + .test.tsx
  FederalKPIList.tsx                # always-visible metric tiles (subject_breadth, attendance_pct, etc.)
  FederalLeadershipList.tsx         # committee chair + ranking-member positions
  FederalDonorsList.tsx             # top 10 individual donors
  FederalPACsList.tsx               # top 10 PACs
  FederalScorecardRatingsList.tsx   # grouped by lean
  FederalTownHallsList.tsx          # federal town_halls schema (no source/external_id)
  FederalDistrictOfficesList.tsx    # federal district_offices
  FederalStockTransactionsList.tsx  # federal stock_transactions schema
  FederalSponsoredBillsList.tsx     # bill_type + number + title
  FederalCosponsoredBillsList.tsx
  FederalVotesList.tsx              # roll-call votes with position chips

apps/mobile/components/federal/                        # NEW directory (RN parity)
  (same 17 files, RN primitives)

apps/web/test/components/federal/                      # web tests
apps/mobile/test/components/federal/                   # mobile tests
```

**Deletions at slice end (web):**
- `apps/web/components/performance/PerformanceSection.tsx`
- `apps/web/components/performance/categories/CommunityPresenceCategory.tsx`
- `apps/web/components/performance/categories/EthicsAccountabilityCategory.tsx`
- `apps/web/components/performance/categories/FinanceCategory.tsx`
- `apps/web/components/performance/categories/IssuePositionsCategory.tsx`
- `apps/web/components/performance/categories/ServiceRecordCategory.tsx`
- `apps/web/components/performance/categories/VotingBillsCategory.tsx`

**Deletions at slice end (mobile):**
- `apps/mobile/components/performance/PerformanceSection.tsx`
- 6 mobile category files (same names)
- `apps/mobile/components/performance/CategoryBar.tsx`
- `apps/mobile/components/performance/SubCascadeBar.tsx`
- `apps/mobile/components/performance/useExpandedState.ts`
- `apps/mobile/components/performance/useExpoParamSync.ts`

Total: ~14 file deletions on web, ~11 on mobile = ~25 file removals at end.

## Card composition + UI patterns (per card)

Each card follows the slice 5xx pattern: title + header summary row (em-dash NULL convention) + collapsible subsections + unified empty-state. Loading state: when any composed hook is `isLoading`. Empty state: when ALL composed hooks return empty arrays / null.

### FederalServiceRecordCard

**Composes:** `useOfficialMetrics(client, officialId)`, `useOfficialLeadershipHistory(client, officialId)`

**Subsections:**
- **KPI metrics** (always-visible top row, no collapse): tiles for `bills_sponsored_count` · `bills_cosponsored_count` · `attendance_pct` · `subject_breadth` · `lives_in_district` (House-only — hidden for `chamber === 'federal_senate'`)
- **Leadership history** (collapsible): committee chair seats + ranking-member positions from `officials_leadership_history`

**Header summary:** `N bills sponsored · M cosponsored · K% attendance`

### FederalFinanceCard

**Composes:** `useOfficialFinance(client, officialId, cycle)` (existing hook taking a `cycle` arg)

**Subsections:**
- **Summary tiles** (always-visible top row): total raised · individual % · PAC % · in-state %
- **Top individual donors** (collapsible): top 10
- **Top PACs / industries** (collapsible): top 10

**Header summary:** `$X.XXM raised · N donors · K PACs (${cycle} cycle)`

### FederalIssuePositionsCard

**Composes:** `useOfficialScorecardRatings(client, officialId)`

**Subsections (mirror state):**
- Ratings grouped by `lean` (progressive / conservative / single-issue / libertarian / centrist) using `SCORECARD_LEAN_LABEL/COLOR` tokens
- Each group shows org name + issue area + score / scoring_max
- Expandable rows show methodology URL + notes

**Header summary:** `N orgs rated · K progressive / M conservative / J single-issue`

### FederalCommunityPresenceCard

**Composes:** `useOfficialDistrictOffices(client, officialId)`, `useOfficialTownHalls(client, officialId, congress)`

**Subsections:**
- **Town halls** (collapsible): clickable rows opening `source_url`; format chip (`in_person/virtual/phone/hybrid`); attendance estimate
- **District offices** (collapsible): grouped by kind (district / capitol); address + phone + hours

Note: no committee-hearings subsection (federal lacks `committee_hearings` table — only state has it from slice 5H).

**Header summary:** `N town halls · K offices`

### FederalEthicsAccountabilityCard

**Composes:** `useOfficialStockTransactions(client, officialId)`, `useOfficialMetrics(client, officialId)` (for `stock_act_compliance_pct`)

**Subsections:**
- **STOCK Act compliance tile** (always-visible top): `stock_act_compliance_pct` from metrics; "On-time / Late / N/A" status badge
- **Stock trades** (collapsible): clickable rows; `days_late` warning chip when `> 0` (federal 45-day deadline); transaction type chip (`purchase/sale/exchange`); amount range

**Header summary:** `N stock trades · M late filings · X% STOCK Act compliance`

### FederalVotingBillsCard

**Composes:** `useOfficialSponsoredBills(client, officialId)`, `useOfficialCosponsoredBills(client, officialId)`, `useOfficialVotes(client, officialId)` from `@chiaro/bills`

**Subsections:**
- **Sponsored bills** (collapsible): bill_type + number + title + status (with semantic color)
- **Cosponsored bills** (collapsible): same shape
- **Voting record** (collapsible, cap at 25 most-recent): vote date + bill + position chip (yes=success / no=error / present=textMuted / missed=warning)

**Header summary:** `N sponsored · M cosponsored · K votes (Y% participation)`

## Color semantics (`@chiaro/ui-tokens`) — unified with state

- `COLORS.signal.success` for: bills passed, vote `position='yes'`, compliance ≥ 90%
- `COLORS.signal.warning` for: stock filed late (`days_late > 0`), compliance 50-89%, vote `position='missed'`
- `COLORS.signal.error` for: compliance < 50%, vote `position='no'`
- `COLORS.signal.success`/`COLORS.signal.warning`/`COLORS.signal.error` for scorecard ratings: ≥ 80 / 40-79 / < 40 respectively (mirrors state)
- `COLORS.neutral.textMuted` for dates/metadata
- `COLORS.brand.text` for primary text
- `COLORS.neutral.surface` for sub-list row backgrounds
- `COLORS.neutral.border` for card borders
- `COLORS.neutral.background` for card surface

Per slice 5G token-vocabulary discovery — NOT `COLORS.semantic.*` or `slate*`.

## Detail-page swap

Locate the current federal `OfficialDetailPage` component (likely `apps/web/components/officials/OfficialDetailPage.tsx` + mobile mirror) that renders `<PerformanceSection ... />`. Replace with 6 stacked card mounts:

```tsx
<View style={{ gap: 12 }}> {/* or div on web with display: 'flex', flexDirection: 'column', gap: 12 */}
  <FederalServiceRecordCard officialId={official.id} />
  <FederalFinanceCard officialId={official.id} cycle={CURRENT_CYCLE} />
  <FederalIssuePositionsCard officialId={official.id} />
  <FederalCommunityPresenceCard officialId={official.id} chamber={official.chamber} />
  <FederalEthicsAccountabilityCard officialId={official.id} />
  <FederalVotingBillsCard officialId={official.id} congress={CURRENT_CONGRESS} />
</View>
```

`chamber` prop on `FederalCommunityPresenceCard` is used to hide the `lives_in_district` row for Senate officials.

`cycle` / `congress` constants imported from a shared config (likely `apps/web/lib/constants.ts` or similar; mobile mirrors).

## Mobile parity

Mobile mirrors web with RN primitives (`Pressable` for clickable rows, `View`/`Text`/`StyleSheet` for layout, `Linking.openURL` for external links).

Per [[feedback-jest-expo-dynamic-mock-pattern]]: each mobile card test uses mutable `let mockX = DEFAULT` reset in `beforeEach` + `jest.mock` factory closing over the variable. **DO NOT** use `jest.resetModules + jest.doMock + require` (crashes React module identity in jest-expo).

Mobile-specific deletions: `CategoryBar.tsx`, `SubCascadeBar.tsx`, `useExpandedState.ts`, `useExpoParamSync.ts` — the nav-state utilities for the old federal PerformanceSection. The new card pattern has per-card local `useState` for expand/collapse (matches state cards from 5xx).

## Testing matrix

**No new pgTAP** (no schema changes). Total stays at 393 plans across 29 files.

**Vitest web** (~36 cases): 6 cards × ~4 cases each + 11 sub-list components × ~2 cases each = 24 + 22 ≈ 46. Some sub-lists are very simple (1-2 cases). Conservative estimate: ~36.

**Jest-expo** (~30 cases): mirror of web; ~6 cards × 4 + ~11 sub-lists × 2.

**Officials integration tests**: NO changes — federal hooks already covered by existing slice 4 integration tests in `packages/officials/test/queries.integration.test.ts`.

**Test file deletions** along with component deletions:
- `apps/web/components/performance/*.test.tsx` files (if they exist for PerformanceSection + 6 categories)
- Mobile mirror

## Acceptance criteria (12)

1. 6 new federal cards mount on `/officials/[id]` web + mobile.
2. Each card uses the state-card collapsible-subsection pattern (title + header summary + ▸/▾ subsections + unified empty-state).
3. Em-dash NULL convention applied per [[feedback-null-vs-zero-metrics]]: header counts render `—` while loading or errored; `0 records` (numeric) when array is empty.
4. Signal-color chips applied per Section 4 matrix.
5. 11 new sub-list components per platform, all pure-props (no hook calls).
6. Old `PerformanceSection.tsx` + 6 `CategoryId` components deleted on both web + mobile.
7. Mobile-only nav state files removed: `CategoryBar.tsx`, `SubCascadeBar.tsx`, `useExpandedState.ts`, `useExpoParamSync.ts`.
8. Federal hooks + tables + ingest scripts unchanged — no schema work.
9. Federal Ethics card is single-card (matches federal data shape; documented asymmetry with state's 2-card split).
10. Federal Voting Bills card is standalone (documented asymmetry — state folds bills into Service Record).
11. `pnpm -r typecheck` clean across 10 packages; Next 15 build clean; pgTAP unchanged at 393 plans.
12. CLAUDE.md slice 6 entry + Gotcha #15 (federal/state intentional UI asymmetries: Ethics 1-vs-2 cards, Voting Bills standalone-vs-folded, Community Presence 2-vs-3 subsections).

## Known v1 limitations (8)

1. Federal Conduct equivalent absent — no recall/expulsion/ethics-complaint data ingest for federal. Federal Ethics card is STOCK-only. Operator follow-up if House/Senate Ethics Committee scrape is desired.
2. Federal Community Presence card lacks committee-hearings subsection — no federal `committee_hearings` table exists (slice 5H added only `state_committee_hearings`).
3. Federal Ethics card uses 45-day STOCK Act deadline (federal `stock_transactions` schema from migration 0022). State uses 30-day (`state_stock_transactions` from 0046). Intentional schema difference, not retroactively flipped.
4. `lives_in_district` boolean is federal-only (House-only metric) — Senate cards hide via `chamber === 'federal_senate'` guard, matching pre-existing `CommunityPresenceCategory` behavior.
5. Voting-record subsection caps at 25 most-recent votes (similar to slice 5H stock-transaction `.limit(50)` server-side cap). Pagination is future work.
6. 6 cards mount unconditionally even when entirely empty (rare for federal officials, but possible for newly-seated members). Empty-state copy is per-card.
7. `SCORECARD_LEAN_LABEL/COLOR` tokens are shared between state + federal Issue Positions; no federal-specific scorecard lean values added.
8. `FederalDistrictOfficesList` does NOT show capitol office (already shown in OfficialDetailPage bio header); only `kind='district'` and `kind='satellite'` rows.

## Out of scope

- New federal data ingest (Federal Conduct equivalent = future slice).
- Restructuring `officials_finance_*` schema (Federal Finance card uses existing OpenSecrets-derived data unchanged).
- Performance-section URL params / deep-linking carry-over (mobile expo-router param-sync utility is removed; expand-state becomes per-page only).
- Migration of any state-side cards (state UI unchanged this slice).
- Shared `@chiaro/officials-ui` package extraction (future consolidation possibility but not in v1 scope).
- Federal `stock_transactions` retroactive FK flip from CASCADE → RESTRICT (audit follow-up).

## Estimated scope

**~22 tasks across 6 phases:**

- **Phase A** (1 task): scaffold `apps/web/components/federal/` + `apps/mobile/components/federal/` directories
- **Phase B** (4 tasks): 11 web sub-list components × ~2 vitest cases each (bundled into 4 dispatches: KPI+Leadership, Donors+PACs+Scorecards, TownHalls+Offices+Stock, Bills+Votes)
- **Phase C** (3 tasks): 6 web cards × ~4 vitest cases each (bundled into 3 dispatches: cards 1-2, 3-4, 5-6)
- **Phase D** (1 task): swap `<PerformanceSection />` → 6 federal cards on web `OfficialDetailPage.tsx` + test
- **Phase E** (6 tasks): Mobile parity — sub-lists (~3 bundled) + cards (~2 bundled) + swap + test
- **Phase F** (5 tasks): cleanup deletions (~14 files web + ~11 files mobile) + CLAUDE.md + final verify + memory + branch handoff

Plan should anticipate ~2500-line plan doc — smaller than 5xx slices because no schema/adapter/ingest layer.

**Closes the visual-design asymmetry between federal and state officials detail pages.** After this slice: both `/officials/[id]` and `/state-officials/[id]` use identical card patterns (collapsible subsections + em-dash NULL + signal-color chips + unified empty-state). Future work can extract a shared `@chiaro/officials-ui` package if convergence continues.
