# Slice 36 — State Cards Retrofit

> **Type:** Mechanical retrofit (`COLORS.*` → `BRAND.semantic.*` via `useBrandTokens()`)
> **Scope:** 18 state-side `@chiaro/officials-ui` files (6 cards + 10 sub-lists/evidence panels + 2 page-level components). 119 `COLORS.*` occurrences. Zero inline hex. No new design decisions.
> **Tier:** Mega Slice (~22 files including tests).

---

## 1. Goal

Apply the slices 33+34+35 retrofit pattern to the state officials detail-page surface. State becomes the third dark-mode-ready surface (after auth slice 33 and federal slice 35).

After this slice: only domain palettes + map components remain on legacy `COLORS.*`. Slice 37 closes them out.

## 2. In scope / out of scope

**In scope:**
- 18 files in `packages/officials-ui/src/state/`:
  - **6 cards:** `StateServiceRecordCard`, `StateIssuePositionsCard`, `StateFinanceCard`, `StateFinancialActivityCard`, `StateConductCard`, `StateCommunityPresenceCard`
  - **10 sub-lists/evidence panels:** `StateBillsEvidence`, `StateVotesEvidence`, `StateIssueVotesEvidence`, `StateDonorsEvidence`, `StateFinancialDisclosuresList`, `StateEthicsComplaintsList`, `StateOfficialEventsList`, `StateTownHallsList`, `StateDistrictOfficesList`, `StateCommitteeHearingsList`
  - **2 page-level:** `StateOfficialDetailPage` (parent), `StateOfficialsCardSection` (home-page wrapper)
- One new mode-awareness test per file with existing tests
- CLAUDE.md slice 36 entry

**Out of scope:**
- Domain palette migration (PARTY_COLOR, ALIGNMENT_CHIP_COLORS, INDUSTRY_COLOR, SCORECARD_LEAN_COLOR, SUB_CASCADE_ACCENT, CATEGORY_CARD_GRADIENT) — slice 37
- Map components (`DistrictMap`, `DistrictPanel` live in `apps/`) — slice 37
- AlignmentChip philosophy decision — slice 37
- `COLORS.signal.warning`/`success` references — slice 37 introduces `alert.warning`/`alert.success` (documented exception per slices 33-35)
- New tokens in `@chiaro/ui-tokens` (BRAND surface unchanged)
- New audit doc (no inline hex; slice 34 audit covers the deferred bucket)
- Apps (`apps/web`, `apps/mobile`)

## 3. Migration vocabulary

Pure `COLORS.*` → `BRAND.semantic.*` per `docs/brand-migration.md`. Same 11-row table as slices 33-35. Same documented exceptions for `signal.warning`/`success`.

### 119 occurrences distribution

| File | Count | Card group |
|---|---|---|
| `StateServiceRecordCard.tsx` | 8 | Service Record |
| `StateBillsEvidence.tsx` | 6 | Service Record |
| `StateVotesEvidence.tsx` | 9 | Service Record |
| `StateIssuePositionsCard.tsx` | 9 | Issue Positions |
| `StateIssueVotesEvidence.tsx` | 7 | Issue Positions |
| `StateFinanceCard.tsx` | 10 | Finance |
| `StateDonorsEvidence.tsx` | 7 | Finance |
| `StateFinancialActivityCard.tsx` | 5 | Financial Activity |
| `StateFinancialDisclosuresList.tsx` | 5 | Financial Activity |
| `StateConductCard.tsx` | 5 | Conduct |
| `StateEthicsComplaintsList.tsx` | 9 | Conduct |
| `StateOfficialEventsList.tsx` | 9 | Conduct |
| `StateCommunityPresenceCard.tsx` | 5 | Community Presence |
| `StateTownHallsList.tsx` | 4 | Community Presence |
| `StateDistrictOfficesList.tsx` | 3 | Community Presence |
| `StateCommitteeHearingsList.tsx` | 5 | Community Presence |
| `StateOfficialDetailPage.tsx` | 8 | Page-level |
| `StateOfficialsCardSection.tsx` | 5 | Page-level |

## 4. Architecture decisions

### 4.1 Per-card-group batching

Tasks batch by card + sub-lists/evidence panels. 6 implementer tasks (5 card groups + 1 page-level) + 1 final verify. Mirrors slice 35's structure.

### 4.2 No inline hex sweep, no new tokens

Pre-flight grep confirmed zero inline hex strings. No Part-B-style sweep needed. BRAND surface unchanged.

### 4.3 Page-level files

`StateOfficialDetailPage.tsx` (the parent) and `StateOfficialsCardSection.tsx` (shown on home page) both consume `COLORS.*` directly. They migrate to `useBrandTokens()` per the standard pattern.

### 4.4 Domain palettes stay untouched

The state side uses `PARTY_COLOR` more than the federal side (state legislators have minor parties like Working Families, Progressive, DFL, etc. — see Gotcha #8). These imports stay.

### 4.5 Asymmetry with federal (Gotcha #15)

The state side has **2 ethics cards** (`StateFinancialActivityCard` + `StateConductCard`) where federal has **1** (`FederalEthicsAccountabilityCard`). Slice 36 retrofits both state cards independently — Gotcha #15 stays load-bearing.

## 5. Testing

Same convention as slices 33-35. One new mode-awareness test per file with an existing test fixture. No new test files added; backfill out of scope.

**Workspace gates:**
- `pnpm --filter @chiaro/officials-ui test` all green
- `pnpm -r typecheck` 11 packages green
- `pnpm --filter @chiaro/web build` clean

## 6. Acceptance criteria

- 18 state files: only documented exceptions (`COLORS.signal.warning`/`success`) remain in `grep -nE "COLORS\\." packages/officials-ui/src/state/*.tsx`
- Each component reads `useBrandTokens()` exactly once at body top
- Mode-awareness tests added to every state test file with existing fixtures
- `pnpm -r typecheck` green
- `pnpm test` workspace green (except known Supabase-env integration failures)
- `pnpm --filter @chiaro/web build` clean
- CLAUDE.md slice 36 entry added
- No files outside `packages/officials-ui/src/state/`, `packages/officials-ui/test/state/`, `docs/`, and `CLAUDE.md` modified

## 7. Risks & open questions

**Risk:** `StateFinanceCard.tsx` has 10 occurrences (highest single-file count in slice 36). Likely includes finance summary + donor evidence + signal-state styling. Mechanical migration; `signal.warning`/`success` references preserved if present.

**Risk:** `StateVotesEvidence`, `StateEthicsComplaintsList`, `StateOfficialEventsList`, `StateIssuePositionsCard` all have 9 occurrences. Likely include filter/highlight states. Apply the migration table uniformly.

**Risk:** `StateOfficialDetailPage.tsx` is the parent page. If a `COLORS.*` reference is conditional on which subsection is active, mechanical replacement still works — each branch uses the same `semantic.*` target.

**Locked at design:**
- 6-task implementer batch per card group + 1 page-level + 1 final
- No inline hex sweep (pre-flight clean)
- No new tokens
- Hook placement convention from slices 33-35

## 8. After slice 36 — roadmap

- **Slice 37:** Domain palettes + map components + AlignmentChip philosophy + link blue brand-decision + `alert.warning`/`alert.success` tokens + finance signal green + finance mint bg + MetricCardShell category palette + portrait gradient. Closes all `// TODO slice 37` markers + the `COLORS.signal.warning`/`success` exceptions from slices 33-36.
- **Slices 38+:** Full visual re-skin.

---

*See `docs/brand-book.md` for the brand reference, `docs/brand-migration.md` for the canonical migration map, and `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md` for slice 34's deferred-site catalog.*
