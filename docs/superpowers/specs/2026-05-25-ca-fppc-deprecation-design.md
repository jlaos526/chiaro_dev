# Slice 21 — CA FPPC Form 700 deprecation design

**Status:** approved 2026-05-25 (verbal — brainstorming flow + pre-audit research)
**Builds on:** Slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) recommendation #10 ("CA financial_disclosures — FPPC Form 700 index URL flapped during audit; revalidate before scoping").

## Goal

Close out the slice 12 audit's last PDF-bound candidate by **deprecating the CA FPPC Form 700 stub** rather than building an HTML-scrape parser. Pre-audit research (2026-05-25 — Task 0 of this slice's planning) confirmed the source migrated to **Granicus DisclosureDocs SPA** (vendor-managed JS-rendered application); cheerio scraping is no longer tractable.

This validates Gotcha #20 (stub-shipping requires per-pair URL verification) — the audit-first task caught a wrong-premise adapter before code was written. A 1-hour discovery cost saved a likely-abandoned parser build.

## Non-goals

- **No CA FPPC parser implementation.** Source is bucket B; we don't build Playwright/Puppeteer adapters per slice 9 + 11 pattern.
- **No reverse-engineering of the Granicus DisclosureDocs backend API.** Closed-source SaaS, undocumented, unstable, likely ToS-restricted.
- **No alternate CA disclosure source.** Slice 12 audit didn't identify one; future audit may surface a different source (e.g. legislator-self-reported pages).
- **No new workspace deps.** Pure documentation + 1-file deprecation.
- **No schema work.** pgTAP unchanged at 402 plans.
- **No production parser remains for CA financial_disclosures** after this slice. UI gracefully handles empty state (already does for slice 5I stub-shipping pattern).

## Architecture

```
state-ethics/disclosures/
  ca-fppc.ts                                              MODIFY — add @deprecated JSDoc
  ca-fppc.test.ts                                         MODIFY — assert deprecation behavior
docs/superpowers/audits/
  2026-05-25-ca-fppc-revalidation.md                      NEW — focused audit doc
CLAUDE.md                                                 MODIFY — Gotcha #24 + slice 21 entry
```

### Files in scope

- **Created (1):** focused audit doc capturing the revalidation findings
- **Modified (3):** ca-fppc.ts stub + test + CLAUDE.md (Gotcha #24 + slice 21 entry)
- **Deleted (0)**
- **Total touched: ~4 files** — Patch tier per workflow-tier feedback.

## Components

### Task 1: Deprecate `ca-fppc.ts` stub + audit doc + Gotcha #24

**`state-ethics/disclosures/ca-fppc.ts`:**

Current state (slice 18 narrowed):
```ts
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const caFppcDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'ca-fppc',
  component: 'disclosures',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
```

Post-slice-21 state (add `@deprecated` JSDoc following slice 11 ACLU/AFP pattern):
```ts
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

/**
 * @deprecated CA Form 700 source migrated to Granicus DisclosureDocs
 * SPA (vendor-managed JavaScript application at
 * `form700search.fppc.ca.gov`). Pre-slice-21 audit (2026-05-25)
 * confirmed bucket-B classification — cheerio HTML scrape is no
 * longer tractable. See `docs/superpowers/audits/
 * 2026-05-25-ca-fppc-revalidation.md` + Gotcha #24.
 *
 * Adapter stays in `state_ethics_orgs` registry for back-compat
 * (slice 5I row continuity); fetchEvents returns []. Operator should
 * NOT attempt a Playwright/Puppeteer pivot — slices 9 + 11 established
 * the no-headless-browser convention. If FPPC publishes a stable
 * REST/JSON API in the future, revisit this adapter.
 */
export const caFppcDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'ca-fppc',
  component: 'disclosures',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
```

**Test:** existing 4 stub tests stay passing. Add 1 new test asserting the adapter is `@deprecated`-flagged (optional — JSDoc-level metadata, hard to assert at runtime). Realistically: leave tests unchanged; deprecation is documentation-only.

### Task 2: Audit doc — `2026-05-25-ca-fppc-revalidation.md`

Captures the pre-audit research findings as a durable artifact (paralleling slice 12 audit doc + slice 11 scorecard discovery audit). ~80-line document covering:
- Re-audit motivation (slice 12 flagged URL as flapping)
- Probed URLs + responses + status codes
- Bucket-B confirmation rationale (Granicus DisclosureDocs SPA)
- Recommendation: deprecate; no future parser scope unless API surfaces

### Task 3: Gotcha #24 + slice 21 entry in CLAUDE.md

**Gotcha #24:**
```markdown
24. **Granicus DisclosureDocs SPA migration is bucket-B.** CA FPPC Form 700 financial disclosures migrated to `form700search.fppc.ca.gov` (Granicus DisclosureDocs eRetrieval, vendor SaaS) sometime between 2024-2025. Initial markup is a SPA shell; filings load via client-rendered JavaScript with no leaked JSON or stable backend endpoints. Cheerio-based HTML scraping (our slice 9+ production-parser convention) is not tractable; Playwright/Puppeteer is explicitly avoided per slice 9 + 11 deprecation pattern. Pre-slice-21 re-audit (2026-05-25) confirmed bucket-B classification. Other state agencies migrating to Granicus DisclosureDocs are likely to follow the same pattern — if you encounter `*.disclosureDocs.com` or `DisclosureDocs eRetrieval` in markup/footer, classify bucket-B immediately and deprecate without further scoping. Validates Gotcha #20 (stub-shipping requires per-pair URL verification): audit-first surfaces wrong-premise adapters before code is written.
```

**Slice 21 entry** appended after slice 20:
```markdown
- **Slice 21 — CA FPPC Form 700 deprecation** (2026-05-25): Closes out the slice 12 audit's last PDF-bound candidate by deprecating rather than implementing. Pre-audit research confirmed the FPPC source migrated to **Granicus DisclosureDocs SPA** (vendor-managed JS application) sometime since 2024 — cheerio HTML scrape is no longer tractable. `state-ethics/disclosures/ca-fppc.ts` gains `@deprecated` JSDoc following slice 11 ACLU/AFP pattern; adapter stays in `state_ethics_orgs` registry returning `[]` for back-compat. Gotcha #24 documents the Granicus DisclosureDocs migration pattern (vendor SaaS, no stable backend API, no headless-browser pivot per slice 9 + 11 convention). Focused audit doc at `docs/superpowers/audits/2026-05-25-ca-fppc-revalidation.md`. Validates Gotcha #20: audit-first surfaced the wrong-premise adapter before code was written; 1-hour discovery cost saved a likely-abandoned parser build. **All 4 slice 12 audit PDF-bound candidates now resolved:** 3 shipped (MI PFD slice 19, NY FDS line-items slice 20, TX TEC enrichment slice 20) + 1 deprecated (CA FPPC slice 21). Audit list complete. ~4 files; no schema work; pgTAP unchanged at 402 plans.
```

## Data flow

No runtime change. Adapter still returns `[]` from fetchEvents; orchestrator iterates it harmlessly.

## Error handling

N/A — no new code paths.

## Testing strategy

Existing 4 ca-fppc stub tests stay passing unchanged. No new tests needed (deprecation is documentation-only).

## Verify gate

- `pnpm -r typecheck` → 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` → 716 tests pass (no change; deprecation is metadata-only)
- `pnpm --filter @chiaro/web build` → 12 routes green

## Risk + tradeoffs

1. **No CA financial disclosure data going forward.** Slice 5I stub-shipping pattern (returns `[]`) means the UI sees an empty result. Acceptable — slice 12 audit deprecation precedent for ACLU/AFP scorecards.

2. **Future Granicus DisclosureDocs migrations.** If TX TEC or NY FDS migrate to the same SaaS in the future, those adapters become bucket-B too. Gotcha #24 documents the detection pattern for fast classification.

3. **No alternate CA source pursued in this slice.** Future audit may surface an alternate CA legislator self-disclosure source (e.g. each senator/AM's personal Form 700 PDF posted on their own .ca.gov page). Defer to a separate slice if motivated by user demand.

4. **Audit doc location.** New audit doc at `docs/superpowers/audits/2026-05-25-ca-fppc-revalidation.md` is a sibling of slice 11 + slice 12 audit docs. Pattern is: dated focused audits live as separate files (not edits to prior audits) per slice 12 audit's "Re-audit cadence" recommendation.

5. **Patch-tier slice scope.** ~4 files; no spec→plan→subagent overhead beyond the spec itself. The plan + execution can fold into a single task or 2 tasks at most.

## Cross-references

- Slice 11 (`docs/superpowers/plans/2026-05-24-lcv-scorecards.md`) — ACLU/AFP @deprecated stub precedent + Gotcha #20 stub-shipping URL verification origin
- Slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) — original recommendation #10 + bucket taxonomy
- Slice 9 + 11 production-parser convention — no Playwright/Puppeteer; cheerio HTML scrape only
- Memory: [[project-chiaro-slice11-lcv-scorecards]] (audit-before-adapter pattern), [[project-chiaro-slice12-stub-audit]] (bucket taxonomy)
