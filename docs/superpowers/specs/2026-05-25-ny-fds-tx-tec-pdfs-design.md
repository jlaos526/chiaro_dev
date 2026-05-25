# Slice 20 — NY FDS + TX TEC PDF parsing design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Slice 17 (NY FDS placeholder rows) + slice 19 (`seed/shared/pdf.ts` helper + MI PFD precedent).

## Goal

Land the next 2 of 3 remaining audit PDF-bound candidates by extending existing adapters with `extractPdfText` + `fetchPdf` consumption:

1. **NY FDS line-item fill** — `ny-jcope` disclosures adapter (slice 17) gains a PDF-parse pass that augments each filing's placeholder row with N line-item rows.
2. **TX TEC per-case enrichment** — `tx-tec` combined parser (slice 16) gains a PDF-parse pass that enriches each per-case complaint + event row with parsed violation summary + penalty + outcome text.

CA FPPC Form 700 (the 3rd audit candidate) defers to slice 21+ to keep this slice's scope manageable.

## Non-goals

- **No CA FPPC Form 700 parser** — separate slice.
- **No NY FDS backfill (pre-2024).** v1 stays year=2024 (slice 17 default).
- **No schema work.** `NormalizedFinancialDisclosure` (line-item shape, slice 17) + `NormalizedEthicsComplaint` + `NormalizedOfficialEvent` (slice 5I) accommodate both fill patterns.
- **No new workspace deps.** `pdf-parse` already installed (slice 19).
- **No real PDF binary fixtures.** Mock text strings only — same strategy as slice 19.
- **No row-count reduction** for NY FDS placeholders. Per design choice: placeholder rows STAY; line-item rows are ADDITIVE.

## Architecture

### Two distinct fill patterns

The user-approved design choice keeps NY FDS placeholder + line-item rows COEXISTING:

```
NY FDS — "expand rows" pattern:
  HTML index parse → for each filing emit:
    - Placeholder row (slice 17 unchanged)
        external_id = "filing-{NY_filing_id}"
        income_*  = undefined
    - + N line-item rows (slice 20 NEW)
        external_id = "filing-{NY_filing_id}-{lineNo}"
        income_source, income_kind, amount_range_low/high populated
  → 1 filing produces 1 placeholder + N line items (different external_ids; both rows in DB)

TX TEC — "enrich rows" pattern:
  HTML orders-table parse → for each row emit:
    - Complaint row (slice 16 unchanged; just summary text richer)
        external_id = "complaint-{order_number}"
        summary = parsed PDF violation text (or fallback to slice 16 stub text)
    - Event row (slice 16 unchanged; just summary/outcome richer)
        external_id = "event-{order_number}"
        summary = parsed PDF violation text
        outcome = parsed disposition text
  → 1 order still produces 1 complaint + 1 event; richer text content via UPSERT
```

### File structure

```
state-ethics/disclosures/
  ny-fds-helpers.ts                                      NEW (Task 1)
  ny-fds-helpers.test.ts                                 NEW (Task 1)
  ny-jcope.ts                                            EXTEND (Task 2)
  ny-jcope.test.ts                                       EXTEND (Task 2)
state-ethics/tx-tec/
  pdf-helpers.ts                                         NEW (Task 3)
  pdf-helpers.test.ts                                    NEW (Task 3)
  shared.ts                                              EXTEND (Task 4)
  shared.test.ts                                         EXTEND (Task 4)
CLAUDE.md                                                Task 5 entry
```

### Files in scope

- **Created (4):** 2 helpers + 2 helper tests
- **Modified (5):** 2 adapter files + 2 adapter test files + CLAUDE.md
- **Total touched: ~9 files** (smaller than slice 18 / similar to slice 19)

## Components

### Task 1: NY FDS PDF text parser

**File:** `state-ethics/disclosures/ny-fds-helpers.ts`

```ts
export interface ParsedNyFdsLineItem {
  income_source: string
  income_kind: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
}

export function parseNyFdsText(text: string): ParsedNyFdsLineItem[]
```

Mirrors slice 19 `parseMiPfdText` shape. NY-specific differences:
- Section header naming: likely "Schedule of Income" or "Part III - Income" (NY COELIG form convention; audit-derived)
- Amount ranges: NY uses categorical ranges with $-prefix (e.g. "$5,000–$25,000", "Less than $5,000", "Over $250,000")
- Income source text typically includes employer name + position
- Reuses slice 19's `classifyIncomeKind` regex pattern (export from mi-pfd-helpers OR re-implement locally to avoid cross-state coupling)

**Decision:** Re-export `classifyIncomeKind` from slice 19 mi-pfd-helpers.ts to ny-fds-helpers.ts since it's truly cross-state generic (regex matches keywords, not state-specific text). NY parser uses the imported version. If income_kind diverges later, slice 21+ extracts to its own shared module.

Tests: ~12 mocked-text cases (parse empty, parse single item, parse multiple items, less-than form, over-X form, en-dash, em-dash, garbage text, classify-fallback to 'other', etc.)

### Task 2: Extend NY FDS adapter (ny-jcope.ts)

**Existing behavior (slice 17):**
1. Paginate HTML index (`ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024`)
2. For each row: resolve legislator → emit placeholder row with `external_id = filing-{NY_filing_id}`

**New behavior (slice 20):**
After the placeholder emission loop, for each placeholder row, ALSO:
3. `fetchPdf(row.source_url)` → Buffer (silent skip on rejection)
4. `extractPdfText(buffer)` → text (silent skip on empty)
5. `parseNyFdsText(text)` → line items (silent skip if 0)
6. For each line item: emit augmented `NormalizedFinancialDisclosure` row with:
   ```ts
   {
     ...placeholder fields (same official_openstates_person_id, filing_year, state, source_url, source),
     income_source: lineItem.income_source,
     income_kind: lineItem.income_kind,
     amount_range_low: lineItem.amount_range_low,
     amount_range_high: lineItem.amount_range_high,
     external_id: `filing-${NY_filing_id}-${lineNo}`,
   }
   ```

**New opts:**
- `maxPdfsPerRun?: number` (default 200) — batch-size cap; operator can lift via CLI flag
- `pageFetcher?: (url: string) => Promise<string>` (slice 17/18 carryover) for parser tests
- Adapter-level `fetcher?: () => Promise<NormalizedFinancialDisclosure[]>` (slice 18 typed) for fixture-injection tests

**Throttle:**
- Existing 1-req/sec between page fetches (slice 17, kept)
- NEW 1-req/sec between PDF fetches with M5 guard (`i < totalFilingsToProcess - 1`)
- Test mode skips both throttles

**Test additions** (~6 cases):
- Mock-PDF flow with multi-item parse → asserts placeholder + N line-item rows emitted per filing
- PDF fetch rejection per filing → placeholder still emitted, no line items
- Empty PDF text → placeholder + 0 line items
- maxPdfsPerRun cap → only first N filings get PDF processing; remaining still get placeholders
- Line-item external_id format verified

### Task 3: TX TEC PDF text parser

**File:** `state-ethics/tx-tec/pdf-helpers.ts`

```ts
export interface ParsedTxTecOrder {
  violation_summary?: string       // e.g. "Failed to file annual personal financial statement"
  penalty_amount?: number          // dollar amount from "Civil Penalty: $1,500"
  outcome_text?: string            // e.g. "Resolved by Agreed Order" / "Order Imposed"
}

export function parseTxTecOrderText(text: string): ParsedTxTecOrder
```

TX TEC orders are pseudo-formal legal documents with sections like:
- "VIOLATION:" or "ALLEGATION:" or "FINDING:" — violation text
- "CIVIL PENALTY:" or "PENALTY ASSESSED:" — penalty dollar amount
- "DISPOSITION:" or "ORDER:" — outcome text

Parser uses section-header regex to extract each field. All fields optional — if a section is absent, the field stays undefined.

Tests: ~8 mocked-text cases (parse all 3 fields present, parse only some, parse with multi-paragraph text, parse $X penalty format, parse $X.YY decimal penalty, garbage text → empty result, etc.)

### Task 4: Extend TX TEC combined parser to enrich

**Existing behavior (slice 16):**
1. Fetch HTML orders table once via `fetchSwornComplaintOrders`
2. For each row: filter legislators, resolve officials, emit one complaint + one event per row with generic summary `"Sworn complaint order {order_number} ({agency})"`

**New behavior (slice 20):**
After emitting the initial complaint + event rows, for each row's `source_pdf_url`:
3. `fetchPdf(source_pdf_url)` → Buffer (silent skip)
4. `extractPdfText(buffer)` → text (silent skip on empty)
5. `parseTxTecOrderText(text)` → `{ violation_summary?, penalty_amount?, outcome_text? }`
6. UPDATE the in-flight complaint + event rows with parsed text:
   - `complaint.summary = violation_summary ?? complaint.summary` (only replace if parsed)
   - `complaint.disposition = outcome_text ?? complaint.disposition`
   - `event.summary = violation_summary ?? event.summary`
   - `event.outcome = outcome_text ?? event.outcome`

Same row count exits the function; UPSERT on `(source, external_id)` enriches existing DB rows.

**New opts:** same `maxPdfsPerRun?: number` (default 200) for batch-size control. `pageFetcher?` already present.

**Throttle:** existing 1-req/sec for the HTML index fetch stays; NEW 1-req/sec between PDF fetches with M5 guard.

**Test additions** (~6 cases):
- Mock-PDF flow per row → asserts complaint.summary + event.outcome enriched with parsed text
- PDF fetch rejection per row → row stays with slice 16 generic summary
- Empty PDF text → row stays with slice 16 generic summary
- maxPdfsPerRun cap → first N rows get PDF enrichment, rest get the slice 16 fallback summary
- Partial parse (only violation_summary present, no penalty) → only summary enriched

### Task 5: Closure docs + memory

Standard slice closure (slice 15-19 precedent):
- CLAUDE.md `## Slices delivered` slice 20 entry
- Memory file `project_chiaro_slice20_ny_fds_tx_tec_pdfs.md` + MEMORY.md index line
- Workspace verify gate

## Data flow

### NY FDS — expand rows
```
HTML index → paginate → ParsedNyFdsRow per filing
  → resolve openstates_person_id per row
  → emit placeholder NormalizedFinancialDisclosure (slice 17 path, kept)
  → THEN per filing (slice 20 NEW):
    fetchPdf(source_url) → Buffer
    extractPdfText(buffer) → text
    parseNyFdsText(text) → ParsedNyFdsLineItem[]
    for each line item:
      emit augmented NormalizedFinancialDisclosure with filing-{id}-{lineNo}
```

### TX TEC — enrich rows
```
HTML orders table → ParsedTxTecRow per row
  → filter legislators + resolve openstates_person_id
  → emit complaint + event (slice 16 path, kept)
  → THEN per row (slice 20 NEW):
    fetchPdf(source_pdf_url) → Buffer
    extractPdfText(buffer) → text
    parseTxTecOrderText(text) → { violation_summary?, penalty_amount?, outcome_text? }
    UPDATE complaint.summary, complaint.disposition, event.summary, event.outcome
```

## Error handling

- **PDF fetch failure** (404 / timeout / network): silent skip + continue (NY FDS keeps placeholder; TX TEC keeps slice 16 stub summary).
- **Empty PDF text:** silent skip + continue.
- **Parser yields 0 items / empty fields:** silent skip + continue.
- **maxPdfsPerRun cap reached:** remaining filings/orders fall back to placeholder (NY) or stub summary (TX). NOT logged to errors[] — acceptable degradation per design.

Same silent-skip pattern as slice 19 MI PFD per audit follow-up convention.

## Testing strategy

- Helper unit tests (`parseNyFdsText`, `parseTxTecOrderText`) — mocked text strings only.
- Adapter integration tests — `vi.mock('../../shared/pdf.ts', () => ({ fetchPdf: vi.fn(), extractPdfText: vi.fn() }))` at module level (same pattern as slice 19 mi-board tests).
- Production-path leak prevention via slice 18 `stubFetchBlocked()`.
- No real PDF binary fixtures.

Expected new tests: ~26 (12 NY helper + 6 NY adapter + 8 TX helper + 6 TX adapter). Total @chiaro/db: 683 → ~709.

## Verify gate

- `pnpm -r typecheck` → 11 packages green (composite from slice 18)
- `pnpm --filter @chiaro/db exec vitest run` → ~709 tests green
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans

## Risk + tradeoffs

1. **NY FDS + TX TEC PDF form structures both audit-speculative.** Mock-text-only tests can't simulate real PDF extraction quirks. Operator follow-up: validate parse rates against real PDFs during first production run.

2. **NY FDS PDF fetch volume.** ~300-500 PDFs per orchestrator run for current cycle (year=2024 filter from slice 17). At 1-req/sec + 15s timeout, worst case ~5-15 min. `maxPdfsPerRun` cap (default 200) limits ingest bursts.

3. **TX TEC per-case PDFs vary in format era.** Older orders (pre-2018ish) may have different section headers; parser may yield empty results. Acceptable v1 — operator can iterate regex.

4. **Cross-state `classifyIncomeKind` reuse:** Importing from slice 19 mi-pfd-helpers.ts creates a soft dependency between MI PFD and NY FDS parsers. If MI's classification regex evolves, NY's behavior changes too. Mitigation: keep `classifyIncomeKind` PURE regex + add new keywords additively. If states diverge, extract to a 3rd module at the 3rd consumer (rule-of-three).

5. **Placeholder + line-item coexistence design imposes UI complexity.** Frontend must group by `source_url` to render "1 filing, N line items". Acceptable per existing slice 17 design lesson; UI work is separate from this slice.

6. **TX TEC PDF enrichment is UPSERT-based.** Re-running slice 20 against the same orders ENRICHES the existing rows (UPSERT preserves dedup). Idempotent.

7. **`maxPdfsPerRun` cap is shared across BOTH adapters** — operator can set independently per orchestrator invocation via CLI flag passthrough. Default 200 per adapter is empirically safe for nightly runs.

8. **No new workspace deps** — slice 19 already installed `pdf-parse` + `@types/pdf-parse`.

## Schema verification needed during planning

- `NormalizedFinancialDisclosure` (slice 17 line-item-oriented) accommodates NY FDS line-items + placeholder coexistence: confirmed.
- `NormalizedEthicsComplaint`: `summary` field exists (string, required); `disposition` field exists (optional string). Enrichment touches both.
- `NormalizedOfficialEvent`: `summary` exists (string, required); `outcome` exists (optional string).

## Cross-references

- Slice 17 (NY FDS placeholder rows): `docs/superpowers/specs/2026-05-25-ny-fds-fl-offices-design.md`
- Slice 19 (PDF infra + MI PFD precedent): `docs/superpowers/specs/2026-05-25-pdf-parsing-mi-pfd-design.md`
- Slice 18 helpers: `packages/db/supabase/seed/test-utils/stub-fetch.ts` + generic `StateXxxAdapter<E>` interface
- Audit: `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md` (NY FDS + TX TEC + CA FPPC as 3 PDF-bound candidates; CA FPPC defers to slice 21+)
- Memory: [[project-chiaro-slice17-ny-fds-fl-offices]], [[project-chiaro-slice19-pdf-parsing-mi-pfd]]
