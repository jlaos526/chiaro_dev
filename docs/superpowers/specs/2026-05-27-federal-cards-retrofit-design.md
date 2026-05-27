# Slice 35 — Federal Cards Retrofit

> **Type:** Mechanical retrofit (pure `COLORS.*` → `BRAND.semantic.*` via `useBrandTokens()`)
> **Scope:** 19 federal-side `@chiaro/officials-ui` files (6 cards + 13 sub-lists). 103 `COLORS.*` occurrences. Zero inline hex (pre-verified). No new design decisions.
> **Tier:** Mega Slice (~22-25 files including tests).

---

## 1. Goal

Apply the slice 33+34 retrofit pattern to the federal officials detail-page surface. Every federal card and sub-list reads `BRAND.semantic.*` via `useBrandTokens()`. Federal becomes the second dark-mode-ready surface (after auth).

After this slice: only state cards (slice 36) + domain palettes/map components (slice 37) remain on the legacy `COLORS.*` surface.

## 2. In scope / out of scope

**In scope:**
- 19 files in `packages/officials-ui/src/federal/`:
  - **6 cards:** `FederalServiceRecordCard`, `FederalVotingBillsCard`, `FederalIssuePositionsCard`, `FederalFinanceCard`, `FederalEthicsAccountabilityCard`, `FederalCommunityPresenceCard`
  - **13 sub-lists:** `FederalKPIList`, `FederalLeadershipList`, `FederalMissedVotesList`, `FederalSponsoredBillsList`, `FederalCosponsoredBillsList`, `FederalScorecardRatingsList`, `FederalDonorsList`, `FederalPACsList`, `FederalHoldingsList`, `FederalStockTransactionsList`, `FederalDisclosureOtherList`, `FederalTownHallsList`, `FederalDistrictOfficesList`
- One new mode-awareness test per file that has an existing test
- CLAUDE.md slice 35 entry

**Out of scope:**
- State cards (slice 36)
- Domain palette migration (PARTY_COLOR, ALIGNMENT_CHIP_COLORS, INDUSTRY_COLOR, SCORECARD_LEAN_COLOR, SUB_CASCADE_ACCENT, CATEGORY_CARD_GRADIENT) — slice 37
- MetricCardShell deferred hex (slice 34 catalogued; slice 37 closes)
- Apps (`apps/web`, `apps/mobile`)
- New tokens in `@chiaro/ui-tokens` (BRAND surface unchanged)
- New audit doc — slice 34's audit already covers any inline-hex risk; federal files have none

## 3. Migration vocabulary

Pure `COLORS.*` → `BRAND.semantic.*` per `docs/brand-migration.md`. The 11 documented mappings (brand.primary → accent.primary; brand.text → text.primary; neutral.* → bg.*/border.*/text.muted; signal.error → alert.danger.fg) apply uniformly.

The 103 `COLORS.*` occurrences distribute as:

| File | Count | Card group |
|---|---|---|
| `FederalServiceRecordCard.tsx` | 5 | Service Record |
| `FederalKPIList.tsx` | 4 | Service Record |
| `FederalLeadershipList.tsx` | 4 | Service Record |
| `FederalMissedVotesList.tsx` | 5 | Service Record |
| `FederalVotingBillsCard.tsx` | 5 | Voting Bills |
| `FederalSponsoredBillsList.tsx` | 9 | Voting Bills |
| `FederalCosponsoredBillsList.tsx` | 9 | Voting Bills |
| `FederalIssuePositionsCard.tsx` | 5 | Issue Positions |
| `FederalScorecardRatingsList.tsx` | 6 | Issue Positions |
| `FederalFinanceCard.tsx` | 5 | Finance |
| `FederalDonorsList.tsx` | 4 | Finance |
| `FederalPACsList.tsx` | 4 | Finance |
| `FederalEthicsAccountabilityCard.tsx` | 11 | Ethics & Accountability |
| `FederalHoldingsList.tsx` | 5 | Ethics & Accountability |
| `FederalStockTransactionsList.tsx` | 5 | Ethics & Accountability |
| `FederalDisclosureOtherList.tsx` | 5 | Ethics & Accountability |
| `FederalCommunityPresenceCard.tsx` | 5 | Community Presence |
| `FederalTownHallsList.tsx` | 4 | Community Presence |
| `FederalDistrictOfficesList.tsx` | 3 | Community Presence |

## 4. Architecture decisions

### 4.1 Per-card-group batching

Tasks batch by card + its sub-lists. 6 implementer tasks, one per card group. Rationale: each card-group is conceptually atomic; commits land per detail-page subsection.

### 4.2 Inline hex sweep — none required

Pre-flight grep confirmed zero inline hex strings in `packages/officials-ui/src/federal/*.tsx`. No Part-B-style sweep needed. If the implementer finds any during execution (drift since pre-flight), they go in the slice 34 audit doc's "Deferred sites" section with a TODO marker.

### 4.3 No new tokens

The BRAND surface from slice 32 stays unchanged. If a card consumes a `semantic.*` path that doesn't exist (unlikely given slices 33+34 already exercised the surface), the implementer escalates rather than introducing new tokens — that's slice 37's call.

### 4.4 Hook placement

Same as slices 33+34: `const { semantic } = useBrandTokens()` at top of each component body (after existing hooks like `useId`, `useState`, `useMemo`). RN StyleSheet split layout-static / color-inline; inline styles get spread color overrides via `style` arrays.

The hook import path from `packages/officials-ui/src/federal/` is `'../brand-hooks.ts'`.

## 5. Testing

Each modified component file with an existing test gets ONE new mode-awareness test asserting render-without-throw under both `BrandModeOverrideContext.Provider value="light"` and `value="dark"`. The wrapper pattern is identical to slices 33+34.

Some sub-list components may not have individual test files (verify per-file during impl). Do not add new test files; slice 35 is mechanical retrofit, not test backfill.

**Workspace gates:**
- `pnpm --filter @chiaro/officials-ui test` all green
- `pnpm -r typecheck` 11 packages green
- `pnpm --filter @chiaro/web build` clean, First Load JS per route within ±2 kB of slice 34 baseline (337 kB `/sign-in`, `/sign-up`)

## 6. Acceptance criteria

- 19 federal files: zero `COLORS.*` references (`grep -n "COLORS\\." packages/officials-ui/src/federal/*.tsx` returns empty)
- Each component reads `useBrandTokens()` exactly once at body top
- Mode-awareness tests added to every federal test file that already existed
- `pnpm -r typecheck` green
- `pnpm test` workspace green (except known Supabase-env integration failures)
- `pnpm --filter @chiaro/web build` clean
- CLAUDE.md slice 35 entry added
- No files outside `packages/officials-ui/src/federal/`, `packages/officials-ui/test/federal/`, `docs/`, and `CLAUDE.md` modified

## 7. Risks & open questions

**Risk:** `FederalEthicsAccountabilityCard.tsx` has 11 `COLORS.*` occurrences — the highest per-file count. Likely uses multiple color roles (text + bg + border + accent + alert) for its 4 subsections (Stock Transactions, Holdings, Disclosures Other, financial activity). Migration is mechanical but verify the implementer reads the file carefully — some refs may be conditional on subsection state.

**Risk:** `FederalSponsoredBillsList.tsx` + `FederalCosponsoredBillsList.tsx` both have 9 occurrences (highest sub-list counts). Likely include voted/unvoted state styling, party-color party badges (PARTY_COLOR — stays untouched), and chip variants. Mechanical migration; PARTY_COLOR references are NOT in scope (they're domain palette, slice 37).

**Risk:** Some federal cards may import `MetricCardShell` and pass a `categoryId` prop. That's fine — MetricCardShell's deferred hex stays deferred (slice 34 catalogued). Federal cards don't touch MetricCardShell's internals.

**Locked at design:**
- 6-task implementer batch per card group
- No inline hex sweep this slice (pre-flight confirmed clean)
- No new tokens
- Hook placement convention from slices 33+34

## 8. After slice 35 — roadmap

- **Slice 36:** State cards retrofit (~21 files). Same mechanical pattern.
- **Slice 37:** Domain palettes + map components + AlignmentChip + link blue + finance signals + MetricCardShell category palette + portrait gradient brand-decision. Closes all `// TODO slice 37` markers from slices 34-36.
- **Slices 38+:** Full visual re-skin.

---

*See `docs/brand-book.md` for the brand reference, `docs/brand-migration.md` for the canonical migration map, and `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md` for slice 34's deferred-site catalog (slice 37's inheritance manifest).*
