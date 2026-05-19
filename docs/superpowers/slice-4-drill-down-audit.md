# Slice 4 — Drill-down transparency audit

**Verified by Task 37 on 2026-05-17** against the redesign plan at
`docs/superpowers/plans/2026-05-17-officials-detail-redesign.md`.

The slice-4 design contract: every metric on `/officials/[id]` MUST drill down to evidence — either an internal evidence panel (`EvidenceExpand`) listing source rows, or an external link (`externalSourceUrl`) to an authoritative source. The `MetricCardShell` discriminated-union in `apps/web/components/MetricCardShell.tsx` enforces this at compile time. The May-17 redesign reorganized the page into **6 categories** with cascade-driven drill-down, replaced the modal evidence drawer with an inline `EvidenceExpand`, and switched alignment chips from glyph-suffixed to color-only.

## Status legend

- `OK` Drill-down works as specified
- `BROKEN` Drill-down broken or missing
- `MANUAL` Pending manual click-through verification by user

## Cross-cutting presentation notes

| Concern | Old behavior (pre-Task 37) | New behavior | Where | Status |
|---|---|---|---|---|
| Alignment chip presentation | 5 tiers distinguished by background color + glyph suffix (`✓✓`, `✓`, `~`, `✗`, `✗✗`) | COLOR-ONLY: the 5 tiers (strongly-aligned, mostly-aligned, mixed, mostly-differs, strongly-differs) are distinguished by background color only | palette: `packages/ui-tokens/src/alignment.ts`; chip: `apps/web/components/AlignmentChip.tsx` | MANUAL — confirm contrast on home mini-strip + per-card detail |
| Evidence presentation | Modal drawer (`ScorecardEvidenceDrawer`) opened on tap | Inline-expanded `EvidenceExpand` toggled by a pill-chevron button reading **"view evidence"** ↔ **"Hide evidence"** | `apps/web/components/cards/EvidenceExpand.tsx`, `apps/web/components/cards/PillChevron.tsx` | MANUAL — confirm toggle, smooth expand, no scroll-jump |
| Drill-down container | Flat list of `MetricCard`s | 6-category cascade structure with sub-cascades + bar rows | `apps/web/app/officials/[id]/page.tsx` orchestrator | MANUAL — confirm category bar tap expands cascade |

## Category 1 — Service Record

| Metric | Card / row | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| Base salary | `PositionSalaryCard` (Service Record bar row) | external | CRS PDF (R44648) | MANUAL | |
| Tenure | `PositionSalaryCard` | inline evidence | Leadership history rows with sources | MANUAL | now uses `EvidenceExpand` |
| Leadership role | `PositionSalaryCard` | inline evidence | Leadership history rows with sources | MANUAL | now uses `EvidenceExpand` |

## Category 2 — Issue Positions

Nine sub-cascades, one per issue area. Each card displays **Issue (Org)** with a textual alignment label (e.g. "Mostly aligned") and a color-coded `AlignmentChip` (no glyph suffix).

| Metric | Card | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| Per-scorecard score (all 10 orgs grouped by issue) | `ScorecardCard` inside per-issue sub-cascade | inline evidence | `EvidenceExpand` listing votes on bills tagged with the org's issue area | MANUAL | replaced `ScorecardEvidenceDrawer` modal |
| Issue-area alignment chip (home mini-strip) | `OfficialsCard` (home page) | deep-link | `/officials/[id]#issue-positions:<sub-cascade-slug>` — `useUrlHashSync` parses on mount, auto-opens category + sub-cascade, scrolls into view | MANUAL | confirm hash-fragment deep-link scroll + expand |

## Category 3 — Community Presence

| Metric | Card / row | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| Lives in district | `ConstituentConnectionCard` | external | FEC data | MANUAL | senate case shows "N/A (Senate)" — no drill |
| District offices | `ConstituentConnectionCard` | inline evidence | `renderOffices` with each office's address + phone + source URL | MANUAL | now uses `EvidenceExpand` |
| Town halls (119th) | `ConstituentConnectionCard` | inline evidence | `renderHalls` with Town Hall Project links per event | MANUAL | now uses `EvidenceExpand` |

## Category 4 — Finance

Sub-section layout: **Summary strip** (Total Raised / Small-donor % / PAC %) → **Contributors** sub-section (PACs sub-cascade, Individual Donors placeholder) → **Top Donor** sub-section (Top Industries sub-cascade with row-1 emphasis + 5/10 toggle, Top Organizations placeholder).

> ✅ RESOLVED 2026-05-18 (PR #4 `1f73a46` — slice 5A finance placeholders) — Individual Donors and Top Organizations sub-cascades now ship as real UI + DB + OpenSecrets ingest backed by a generalized `TopAmountBreakdown` component. The placeholder rows below are retained for historical context.

| Metric | Card / row | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| Total raised | Summary strip | external | OpenSecrets per-member summary URL | MANUAL | |
| Small-donor % | Summary strip | external | OpenSecrets per-member summary URL | MANUAL | |
| PAC % | Summary strip | external | OpenSecrets per-member summary URL | MANUAL | |
| Top donor industries (bar chart) | `FinanceIndustryBreakdown` sub-cascade | inline evidence + external | Row-1 emphasized; 5/10 toggle expands list; external link to OpenSecrets full breakdown | MANUAL | |
| Notable PACs | PACs sub-cascade | per-row external | FEC committee detail page | MANUAL | |
| Top Organizations | ✅ RESOLVED 2026-05-18 (PR #4 `1f73a46` — slice 5A finance placeholders) — `TopAmountBreakdown` sub-cascade | inline evidence + external | Row-1 emphasized; 5/10 toggle expands list; external link to OpenSecrets top-orgs page | MANUAL | replaces soft-beige placeholder card |
| Individual Donors | ✅ RESOLVED 2026-05-18 (PR #4 `1f73a46` — slice 5A finance placeholders) — `TopAmountBreakdown` sub-cascade | inline evidence + external | Row-1 emphasized; 5/10 toggle expands list; external link to OpenSecrets top-contributors page | MANUAL | replaces soft-beige placeholder card |

## Category 5 — Ethics & Accountability

Two metrics moved into this category by the May-17 redesign — they previously lived elsewhere.

| Metric | Card / row | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| STOCK Act compliance | Ethics & Accountability bar row | inline evidence | `renderStock` with house/senate-stock-watcher links per trade | MANUAL | **MOVED** from `ShowUpWorkloadCard` / `ConstituentConnectionCard` → now in Ethics & Accountability category. Late rows display in `COLORS.signal.error`. |
| In-state donor % | Ethics & Accountability bar row | external | OpenSecrets | MANUAL | **MOVED** from `FinanceCard` → now in Ethics & Accountability category |

## Category 6 — Voting & Bills

| Metric | Sub-cascade / row | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| Attendance % | Voting Record sub-cascade | inline evidence | attendance summary + missed-votes evidence rows with source URLs | MANUAL | replaced `DrillOverlay 'Missed votes'` modal |
| Missed votes | Voting Record sub-cascade | inline evidence | each missed vote with source URL | MANUAL | nested inside attendance evidence |
| Bills sponsored | Bills Authored sub-cascade (sponsored grid) | inline evidence | each bill with source URL | MANUAL | replaced `DrillOverlay 'Sponsored bills'` modal |
| Bills cosponsored | Bills Authored sub-cascade (cosponsored grid) | external | congress.gov/member/ | MANUAL | |
| Committee Work | placeholder | n/a | "data coming slice 5" | MANUAL | shows committees coming in slice 5 |

## Manual verification procedure (user follow-up)

The deterministic workspace checks ran in Task 37; the live click-through is the user's responsibility. Steps:

1. `pnpm seed:slice-4-full` to populate all data (or run individual seed scripts).
2. `pnpm --filter @chiaro/web dev` and open http://localhost:3000.
3. Sign in and navigate to a representative loaded via `apps/web/scripts/audit-fixture-attach.ts` (e.g., Pelosi if seeded).
4. Confirm the 6 category bars render in order; tap each and confirm cascade expand.
5. For each row above:
   - Click the metric card / sub-cascade bar
   - Confirm inline `EvidenceExpand` opens (pill-chevron rotates, label flips to "Hide evidence") OR new tab opens for external links
   - For evidence rows: confirm each links to an authoritative source URL
   - Mark the row `OK` or `BROKEN` with notes in this doc
6. From the home page mini-strip, tap an alignment chip and confirm it deep-links to `/officials/[id]#issue-positions:<sub-cascade-slug>` with the correct sub-cascade auto-expanded (hash format, parsed by `useUrlHashSync`).
7. Repeat for a senator (e.g., Feinstein) to confirm the "Lives in district = N/A (Senate)" path.
8. Confirm alignment-chip color contrast is acceptable across the 5 tiers without the old `✓✓`/`✗✗` glyph affordance.

## Findings

Smoke walked 2026-05-18 across three variants on the redesigned `/officials/[id]`:

- **Mike Carey (OH-15, House, full audit fixture attached)** — all 6 categories render with palette-A accents and teasers; sub-cascade expansion works; inline `EvidenceExpand` (no modal); finance summary strip + sage Contributors / mint Top Donor sub-sections; placeholder sub-cascades render soft beige italic; STOCK Act late trade displays the U+2716 (✖) compliance icon.
- **Bernie Moreno + Jon Husted (Ohio Senate, no fixture attached)** — bio renders correctly with district chip "Ohio" (full state name) and chamber chip "Senate"; fixture-free categories show empty-state copy cleanly without crashes.
- **Harriet M. Hageman (WY-AL, House at-large, no fixture attached)** — bio district chip correctly reads `WY-AL`; at-large path is wired end-to-end (no `-01` / `-undefined` leak).

Two N/A-state bugs surfaced and were captured as next-slice follow-ups (see below). No crashes, no SSR errors, no hydration warnings observed during the walkthrough. Workspace prereqs (auth signup/signin, calibrate-location Edge Function with GeocodIO key, hash-fragment deep-link parsing via `useUrlHashSync`) all verified along the way.

## Follow-ups for next slice

- ✅ **RESOLVED 2026-05-18 (PR #3 `d6da6d5`) — Alignment-chip row in BioHeader (Row 0).** Today alignment chips only appear on the home `OfficialsCard` mini-strip. The detail page shows scorecard alignment as text inside each card (`AlignmentLabel` per tier). Future slice should render the same top-3 `AlignmentChip` strip — color-only, deep-linking into `#issue-positions:<sub-cascade-slug>` — immediately under the name/identity row in `BioHeader`, giving the detail page a single-glance summary that mirrors the mini-strip. Reuse `selectTopAlignmentChips(scorecards.data ?? [])` from `apps/web/lib/derivations/alignment.ts`; thread `useOfficialScorecardRatings` into `BioHeader` (or lift to the page and pass the chip list as a prop). Observed during 2026-05-18 smoke test of the officials-detail redesign.

- ✅ **RESOLVED 2026-05-18 (PR #3 `d6da6d5`) — N/A metric cards: grey dot + "Unavailable" label + correct chamber gating.** Observed on Bernie Moreno's detail page (senate variant) — the "Lives in District" card correctly renders value `N/A (Senate)` but the row below shows the teal category-accent dot next to the unchanged label "Lives in District", which scans as a contradictory affirmation ("N/A" + green-ish dot reads as a yes-indicator). Next slice should treat N/A state distinctly across all `MetricCardShell` instances: when the value is N/A, render a grey/neutral dot (e.g. `#807a72` from neutrals) and override the label to "Unavailable" — preserving card layout (3-card grid stays a 3-card grid) but removing the false-positive signal. Touches `apps/web/components/cards/MetricCardShell.tsx`; gate behavior on a new `unavailable: boolean` prop or detect the literal `N/A (...)` value pattern. **Separately but related**: observed on Harriet Hageman's detail page (House at-large with no fixture data) — the card incorrectly renders `N/A (Senate)` for a House rep because `CommunityPresenceCategory` gates the N/A branch on `m?.lives_in_district == null` which collapses two distinct cases (null = senator-style not applicable, null = metric not yet computed for a House rep). Fix: pass `chamber` from the official into `CommunityPresenceCategory` and only show `N/A (Senate)` when `chamber === 'senate'`; House reps with null metrics should render `—` or "Not yet computed". Both observed during 2026-05-18 smoke test.

- ✅ **RESOLVED 2026-05-18 (PR #3 `d6da6d5`) — DistrictBadge (map-pin) in BioHeader, below the name.** Today `BioIdentityRow` renders party + chamber + district as three plain pill chips in a single row. The user wants the district chip replaced by the map-pin–styled `DistrictBadge` (the same component used on the home `OfficialsCard` mini-strip) and positioned below the official's name in the bio header. Two natural placements: (a) swap the plain chip inside `BioIdentityRow` for `DistrictBadge` so the same row still carries party | chamber | district (with district visually distinguished); or (b) lift `DistrictBadge` to its own dedicated row immediately below the name, with party + chamber remaining as the row below. Either way it preserves visual continuity from home → detail. Component already exists at `apps/web/components/cards/DistrictBadge.tsx`; reuse with the same props (`chamber`, `stateName`, `districtNumber`, `atLarge`) wired from the existing `districtChipLabel` derivation logic. Observed during 2026-05-18 smoke test.

## Sign-off

Audit complete: 2026-05-18 by Jon Laos
