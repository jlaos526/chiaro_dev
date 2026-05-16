# Slice 4 — Drill-down transparency audit

Run on: <date>
Official tested: <name + bioguide_id>

The slice-4 design contract: every metric on `/officials/[id]` MUST drill down to evidence — either an internal drawer (`onExpand`) listing source rows, or an external link (`externalSourceUrl`) to an authoritative source. The `MetricCardShell` discriminated-union in `apps/web/components/MetricCardShell.tsx` enforces this at compile time. This audit documents observed behavior at runtime.

## Status legend
- ✓ Drill-down works as specified
- ✗ Drill-down broken or missing
- ⏳ Pending manual verification

## Audit table

| Metric | Card component | Drill-down type | Expected target | Status | Notes |
|---|---|---|---|---|---|
| Per-scorecard score (10 orgs) | `ScorecardCard` | drawer | `ScorecardEvidenceDrawer` showing votes on bills tagged with the org's issue area | ⏳ pending manual verification | one row per ingested scorecard |
| Total raised | `FinanceCard` (via MetricCardShell) | external | OpenSecrets per-member summary URL | ⏳ pending manual verification | |
| Small-donor % | `FinanceCard` (via MetricCardShell) | external | OpenSecrets per-member summary URL | ⏳ pending manual verification | |
| In-state donor % | `FinanceCard` (via MetricCardShell) | external | OpenSecrets per-member summary URL | ⏳ pending manual verification | |
| Top donor industries (bar chart) | `FinanceIndustryBreakdown` | external link | OpenSecrets full breakdown | ⏳ pending manual verification | |
| Notable PACs | `FinanceCard` | per-row external | FEC committee detail page | ⏳ pending manual verification | |
| Attendance % | `ShowUpWorkloadCard` | drawer | `DrillOverlay 'Missed votes'` listing each missed vote with source URL | ⏳ pending manual verification | |
| Bills sponsored | `ShowUpWorkloadCard` | drawer | `DrillOverlay 'Sponsored bills'` listing each bill with source URL | ⏳ pending manual verification | |
| Bills cosponsored | `ShowUpWorkloadCard` | external | congress.gov/member/ | ⏳ pending manual verification | |
| Committees | `ShowUpWorkloadCard` | external | congress.gov/committees | ⏳ pending manual verification | slice-4 placeholder; shows "data coming slice 5" |
| Base salary | `PositionSalaryCard` | external | CRS PDF (R44648) | ⏳ pending manual verification | |
| Tenure | `PositionSalaryCard` | drawer | Leadership history drawer with sources | ⏳ pending manual verification | |
| Leadership role | `PositionSalaryCard` | drawer | Leadership history drawer with sources | ⏳ pending manual verification | |
| Lives in district | `ConstituentConnectionCard` | external | FEC data | ⏳ pending manual verification | senate case shows "N/A (Senate)" — no drill |
| District offices | `ConstituentConnectionCard` | drawer | `renderOffices` with each office's address + phone + source URL | ⏳ pending manual verification | |
| Town halls (119th) | `ConstituentConnectionCard` | drawer | `renderHalls` with Town Hall Project links per event | ⏳ pending manual verification | |
| STOCK Act compliance | `ConstituentConnectionCard` | drawer | `renderStock` with house/senate-stock-watcher links per trade | ⏳ pending manual verification | late rows display in `COLORS.signal.error` |
| In-state donors | `ConstituentConnectionCard` | external | OpenSecrets | ⏳ pending manual verification | |

## Manual verification procedure

1. `pnpm seed:slice-4-full` to populate all data (or run individual seed scripts)
2. `pnpm --filter @chiaro/web dev` and open http://localhost:3000
3. Navigate to a representative-with-data, e.g., Pelosi if she's seeded
4. For each row in the audit table:
   - Click the metric card
   - Confirm drawer opens (internal drill) OR new tab opens (external link)
   - For drawer rows: confirm evidence rows each link to an authoritative source URL
   - Mark the row ✓ or ✗ with notes
5. Repeat for a senator (e.g., Feinstein) to confirm the "Lives in district = N/A (Senate)" path

## Findings

(Fill in after manual run.)

## Sign-off

Audit complete: <date> by <name>
