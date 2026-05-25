# Slice 19 — PDF-parsing infrastructure + MI PFD design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Post-slice-17 audit (`docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`); slice 18 helpers (`fetchPerMemberOffices`, `stubFetchBlocked`, generic `StateXxxAdapter<E>`, `tsconfig.seed.json` typecheck coverage).

## Goal

Add PDF text-extraction infrastructure + first concrete consumer (MI PFD financial_disclosures). Establishes the helper API that slice 20+ uses to fill NY FDS line-items + CA FPPC Form 700 + TX TEC per-case sworn-complaint orders.

This was the audit's strongest cross-cutting recommendation (3 slice memory mentions: slices 15, 16, 17). Slice 18 deliberately landed first so this slice's parsers can use the new tooling.

## Non-goals

- **No NY FDS line-item filling.** Slice 17 placeholder rows stay placeholder until slice 20 runs the PDF parser against each `source_url`.
- **No TX TEC or CA FPPC PDF parsers.** Slice 21+ scope.
- **No schema work.** `NormalizedFinancialDisclosure` (slice 17 line-item-oriented shape) already accommodates per-line-item rows with augmented `external_id`s.
- **No real-PDF test fixtures.** Per "Mock text strings only" decision: parser tests inject mocked text directly; end-to-end pdf-parse integration verified by a single manual scaffold run during implementation.
- **No backfill of pre-2024 MI PFDs.** v1 hardcodes year = 2024 (current cycle). Future slice handles backfill.
- **No MI PFD form-text-format reverse engineering beyond what the audit cited.** Implementer fetches 2-3 real PDFs during scaffold to characterize the line-item text shape; if drift surfaces, regex evolves in subsequent slices.

## Architecture

```
Task 1: Infrastructure ──────────────────────────────────────────────────────
  packages/db/package.json                                  + pdf-parse dep
  packages/db/supabase/seed/shared/pdf.ts                   NEW
    - extractPdfText(buffer: Buffer): Promise<string>
    - fetchPdf(url: string, opts?: { timeoutMs? }): Promise<Buffer>
  packages/db/supabase/seed/shared/pdf.test.ts              NEW

Task 2: MI PFD URL derivation + line-item text parser ──────────────────────
  packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.ts   NEW
    - deriveMiPfdUrl(legislator: { full_name }, year: number): string
    - parseMiPfdText(text: string): ParsedMiPfdLineItem[]
    - ParsedMiPfdLineItem interface
  packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.test.ts  NEW

Task 3: MI PFD adapter (replace mi-board stub) ─────────────────────────────
  packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts        REPLACE
  packages/db/supabase/seed/state-ethics/disclosures/mi-board.test.ts   REPLACE

Task 4: Closure ────────────────────────────────────────────────────────────
  CLAUDE.md                                                 slice 19 entry
  memory + MEMORY.md                                        (outside repo)
```

### Files in scope

- **Created (5):**
  - `seed/shared/pdf.ts` + `pdf.test.ts`
  - `seed/state-ethics/disclosures/mi-pfd-helpers.ts` + `mi-pfd-helpers.test.ts`
  - Memory file (outside repo)
- **Modified (4):**
  - `packages/db/package.json` (dep)
  - `seed/state-ethics/disclosures/mi-board.ts` (replace stub with production parser)
  - `seed/state-ethics/disclosures/mi-board.test.ts` (replace stub tests with production tests)
  - `CLAUDE.md` (slice 19 entry)
- **Deleted (0)**
- **Total touched: ~9 files** — smaller than slice 18 (~50); focused on one new helper + one parser.

## Components

### Task 1: Infrastructure — `shared/pdf.ts`

**Why `seed/shared/pdf.ts` location?** Matches the slice 15 `seed/shared/officials.ts` precedent for cross-domain helpers. PDF parsing will be reused by NY FDS (slice 20), TX TEC (slice 21+), and CA FPPC (slice 22+), so canonical shared module > per-state placement.

**`extractPdfText` shape:**
```ts
import pdfParse from 'pdf-parse'

/**
 * Extract text from a PDF buffer. Wraps pdf-parse's bare API.
 *
 * Returns empty string on parse failure (caller handles via empty
 * line-item array). Errors are swallowed because pdf-parse is known
 * to write warnings to stderr for edge cases (embedded fonts,
 * old PDF versions) without throwing — empty result is the
 * canonical "couldn't extract" signal.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer)
    return result.text ?? ''
  } catch {
    return ''
  }
}
```

**`fetchPdf` shape:**
```ts
const DEFAULT_TIMEOUT_MS = 15000  // PDFs can be larger than HTML; longer timeout

/**
 * Fetch a PDF URL and return its contents as a Buffer.
 *
 * 15s default timeout (PDFs may be MB-scale; HTML adapters use 5s).
 * Throws on network failure or non-2xx response; callers wrap in
 * try/catch + silently skip.
 */
export async function fetchPdf(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

**Tests:**
- `extractPdfText`: mock `pdf-parse` via `vi.mock('pdf-parse')`; test 3 cases (happy text return, empty text fallback, parse exception → empty string).
- `fetchPdf`: mock `globalThis.fetch` via slice 18 `stubFetchBlocked()` for error path; mock with a successful arrayBuffer-returning Response for happy path; test 4 cases (happy buffer return, non-2xx error, timeout error, network rejection).
- Total: ~7 unit tests.

### Task 2: MI PFD URL derivation + text parser

**URL pattern** (audit-derived; verify at scaffold):
```
https://www.michigan.gov/sos/0,4670,7-127-1633_8722_56081-PFDDR-reports/<year>/one/<Lastname>-<Firstname>-PFDDR-<year>.pdf
```

The exact path may differ — Michigan's SOS portal occasionally reorganizes. v1 builder uses the audit-derived path; production drift surfaces as 404s (silently skipped).

```ts
const MI_PFD_BASE = 'https://www.michigan.gov/sos/0,4670,7-127-1633_8722_56081-PFDDR-reports'

export function deriveMiPfdUrl(
  legislator: { full_name: string },
  year: number,
): string {
  // "Jane Doe" → "Doe-Jane"
  const parts = legislator.full_name.trim().split(/\s+/)
  if (parts.length < 2) return ''
  const lastName = parts[parts.length - 1]!
  const firstName = parts[0]!
  return `${MI_PFD_BASE}/${year}/one/${lastName}-${firstName}-PFDDR-${year}.pdf`
}
```

Note: empty-string fallback for single-name legislators (rare) leads to fetch failure → silent skip downstream. Acceptable.

**Line-item parser:**

MI PFD forms have a standard layout (audit-derived expectation):
- Income source (e.g. "Salary from State of Michigan / Senate Office")
- Amount range expressed as "Less than $1,000", "$1,000–$10,000", "$10,000–$50,000", etc.
- Role/title (sometimes embedded)

```ts
export interface ParsedMiPfdLineItem {
  income_source: string
  income_kind: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
}

const AMOUNT_RANGE_RE = /\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/g
const LESS_THAN_RE = /Less than \$?([\d,]+)/i

const INCOME_KIND_KEYWORDS: Array<[string, ParsedMiPfdLineItem['income_kind']]> = [
  [/\b(salary|wages|compensation)\b/i.source, 'salary'],
  [/\b(consulting|consultant|advisory)\b/i.source, 'consulting'],
  [/\b(royalt(y|ies))\b/i.source, 'royalty'],
  [/\b(rental|rent income)\b/i.source, 'rental'],
  [/\b(dividend|interest)\b/i.source, 'dividend'],
]

export function parseMiPfdText(text: string): ParsedMiPfdLineItem[] {
  // ... regex-driven section walker; emits one ParsedMiPfdLineItem per
  // identified income line.
}
```

**Tests:** ~8-10 cases against representative mocked-text snippets:
- Single income line with salary + amount range
- Multiple income lines (each emits one item)
- "Less than $X" amount form
- Income kind classification (salary, consulting, royalty, rental, dividend, other-fallback)
- Empty input → []
- Garbage input → []

### Task 3: MI PFD adapter (replace mi-board stub)

**File:** `state-ethics/disclosures/mi-board.ts`
**Slug stays `mi-board`** (slice 5I stub naming, back-compat with `state_ethics_orgs`).
**Component:** `disclosures`
**Generic narrow:** `StateEthicsAdapter<NormalizedFinancialDisclosure>` (slice 18 M3 pattern).

**Adapter flow:**
1. Query officials for MI state_house + state_senate (~148 legislators).
2. For each: derive PDF URL via `deriveMiPfdUrl(legislator, 2024)`.
3. `fetchPdf(url)` → `extractPdfText(buffer)` → `parseMiPfdText(text)`.
4. Emit one `NormalizedFinancialDisclosure` per line item with:
   - `official_openstates_person_id` (from officials query)
   - `filing_year: 2024`
   - `income_source`, `income_kind`, `amount_range_low`, `amount_range_high`
   - `state: 'MI'`
   - `source_url: <PDF URL>`
   - `source: 'mi-board'`
   - `external_id: mi-pfd-${lastname-firstname}-${year}-${lineNo}` (deterministic dedup)
5. Per-legislator fetch failure: silent skip + continue.
6. 1-req/sec throttle between legislators (skipped in test mode).

**Production fetch volume:** ~148 MI legislators × 1 PDF each = 148 PDF fetches per run, ~148s at 1-req/sec. Each PDF is ~50-500KB (typical PFD form), so total transfer ~30-100MB.

**Tests** (~10-12 cases):
- Adapter shape (slug/component/covered_states)
- Injected fetcher short-circuit
- Production-path stub via `stubFetchBlocked()` (slice 18 helper) — returns []
- Mock-PDF flow: inject a fetcher that returns canned Buffer + mock `extractPdfText` to return canned text + assert emitted rows
- Per-legislator fetch failure: skip + continue
- Empty PDF text (parse failed): 0 rows for that legislator
- External_id format: assert `mi-pfd-{lastname-firstname}-{year}-{lineNo}` exact pattern
- Multiple line items per legislator: each gets distinct external_id

### Task 4: Closure

Standard slice closure (slice 15-18 precedent):
- CLAUDE.md `## Slices delivered` slice 19 entry
- Memory file `project_chiaro_slice19_pdf_parsing_mi_pfd.md` with squash SHA placeholder + durable lessons
- MEMORY.md index line
- Workspace verify gate (typecheck composite + vitest + web build)

## Data flow

```
officials table → query MI state_house + state_senate
  ↓ for each legislator:
deriveMiPfdUrl(legislator, 2024) → URL
  ↓
fetchPdf(url) → Buffer (15s timeout; silent skip on failure)
  ↓
extractPdfText(buffer) → string (empty on parse failure)
  ↓
parseMiPfdText(text) → ParsedMiPfdLineItem[]
  ↓ for each line item:
emit NormalizedFinancialDisclosure (slice 17 line-item-oriented shape)
```

## Error handling

- **`pdf-parse` exception:** swallowed; `extractPdfText` returns empty string.
- **Empty text:** `parseMiPfdText` returns []; 0 rows for that legislator.
- **PDF fetch failure** (404, timeout, network error): caught by adapter; legislator silently skipped.
- **Single-name legislator:** `deriveMiPfdUrl` returns empty string; downstream fetch fails; silent skip.
- **Per-legislator throttle exception (test mode injection):** caught + continue.

Same silent-skip pattern as slice 15-18 per-member loops.

## Testing strategy

- **Helper unit tests** (`pdf.test.ts`): ~7 cases. `vi.mock('pdf-parse')` + slice 18 `stubFetchBlocked()`.
- **Parser unit tests** (`mi-pfd-helpers.test.ts`): ~10 cases against mocked-text snippets. Validates URL derivation + line-item extraction regex shapes.
- **Adapter integration tests** (`mi-board.test.ts`): ~10-12 cases injecting both fetcher (Buffer) AND `extractPdfText` mock at module level. Production-path test uses `stubFetchBlocked()`.
- **No real PDF fixtures committed.** Per fixture decision.

Expected total new tests: ~27-29. Total @chiaro/db: 653 → ~680.

## Verify gate

- `pnpm -r typecheck` → 11 packages green (composite `tsc --noEmit && tsc -p tsconfig.seed.json` from slice 18)
- `pnpm --filter @chiaro/db exec vitest run` → ~680 tests green
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans

## Risk + tradeoffs

1. **MI PFD URL pattern is speculative.** Audit cited `michigan.gov/sos/.../<Lastname>-<Firstname>-PFDDR-<year>.pdf`. The leading `0,4670,7-127-1633_8722_56081-` path segments are Michigan SOS's portal-style ID and may differ for 2024 filings. Mitigation: implementer fetches 2-3 real URLs during scaffold + adjusts `MI_PFD_BASE` constant. Production drift surfaces as silent 404s; operator monitors `stats.errors[]`.

2. **Line-item regex without real PDF samples.** Mock-text tests can't simulate real PDF extraction quirks (column ordering, page breaks, header/footer noise). Mitigation: parser ships with conservative regex (matches obvious income lines + amount ranges); operator validates first production run + iterates regex in slice 20+.

3. **`pdf-parse` library quirks.** Known to write warnings to stderr during normal operation (encrypted PDFs, embedded fonts, non-standard layouts). `extractPdfText` swallows errors but stderr noise will appear in CI logs. Acceptable; documented.

4. **Per-legislator silent-skip rate may be high initially.** With audit-derived URL pattern + unverified regex, expect 30-70% of MI legislators to silently skip on first production run (404s or empty parses). Operator follow-up: instrument + iterate.

5. **No NY FDS line-item filling in this slice.** Slice 17 placeholder rows stay. NY FDS PDF URL is per-record (from the slice 17 source_url field); slice 20 reads existing rows and fills line-items.

6. **`pdf-parse` is a CommonJS package** — needs default-import syntax (`import pdfParse from 'pdf-parse'`) under ESM Node + tsconfig `esModuleInterop: true`. Verify the base tsconfig has the flag.

7. **15s PDF fetch timeout × ~148 legislators = 22 min worst case.** Acceptable for nightly batch jobs but slow for interactive testing. Test mode injects fetchers; production-mode default-fetch is the only path that hits the timeout.

8. **`mi-board` slug is misleading post-rename.** Michigan Department of State (SOS) handles PFD filings, not the Michigan Bureau of Elections "board". Slug stays for slice 5I back-compat per the slug-vs-source-URL drift pattern documented in slice 15-17 memories.

## Schema verification needed during planning

`NormalizedFinancialDisclosure` (slice 17 line-item-oriented shape) confirmed via `state-ethics/shared.ts:5-17`:
```ts
{
  official_openstates_person_id: string
  filing_year: number
  filing_date?: string
  income_source?: string
  income_kind?: 'salary' | 'consulting' | ...
  amount_range_low?: number
  amount_range_high?: number
  state: string
  source_url: string
  source: string
  external_id?: string
}
```

MI PFD emits one row per line item with `income_source` + `income_kind` + `amount_range_*` populated (unlike slice 17 NY FDS placeholder rows). external_id uniquely keyed per-line-item ensures dedup works across re-ingests.

## Cross-references

- Slice 17 (NY FDS placeholder rows): `docs/superpowers/specs/2026-05-25-ny-fds-fl-offices-design.md` — placeholder-row pattern for deferred PDF parsing
- Slice 18 (helpers): `docs/superpowers/plans/2026-05-25-bug-fix-tooling-refactors.md` — `stubFetchBlocked()`, generic `StateXxxAdapter<E>`, composite typecheck
- Audit: `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md` — MI PFD listed as bucket-C "predictable PDF URLs", PDF-parsing slice recommended as substantive slice candidate
- Memory: [[project-chiaro-slice17-ny-fds-fl-offices]] (placeholder-row precedent), [[project-chiaro-slice18-bug-fix-tooling-refactors]] (helpers used here)
- Slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) recommendation #8: "MI financial_disclosures — predictable PDF URLs but each must be enumerated from `officials` and parsed. PDF-parser cost."
