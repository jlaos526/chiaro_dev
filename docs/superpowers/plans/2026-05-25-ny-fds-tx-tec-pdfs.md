# Slice 20 — NY FDS + TX TEC PDF parsing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend slice 17 NY FDS adapter + slice 16 TX TEC combined parser with per-PDF text parsing built on slice 19's `shared/pdf.ts` helper. Two distinct fill patterns:
- NY FDS = "expand rows" (1 placeholder + N line items per filing)
- TX TEC = "enrich rows" (UPSERT updates summary + outcome on existing complaint + event rows)

**Architecture:** 5 tasks sequenced — helpers first (Tasks 1 + 3), then adapter integrations (Tasks 2 + 4), then closure (Task 5). NY and TX tasks are independent and could run in parallel as subagent dispatches; sequencing here is "helpers before consumers" for cleaner two-stage review.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler. `pdf-parse` already installed (slice 19). `vitest` with `vi.mock('../../shared/pdf.ts', () => ({ fetchPdf: vi.fn(), extractPdfText: vi.fn() }))` for adapter integration tests (slice 19 pattern).

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-ny-fds-tx-tec-pdfs-design.md` (slice 20 spec)
- Slice 19 plan (`docs/superpowers/plans/2026-05-25-pdf-parsing-mi-pfd.md`) — MI PFD precedent + `vi.mock` test pattern
- Slice 17 ny-jcope.ts (current state) — placeholder-row emission flow + `pageFetcher` injection
- Slice 16 tx-tec/shared.ts (current state) — combined parser HTML scrape + `fetcher` injection
- Slice 19 `seed/shared/pdf.ts` — `extractPdfText(buffer)` + `fetchPdf(url, opts?)` API

**Key findings from file exploration:**

- **ny-jcope.ts** uses `pageFetcher?` opts key (slice 18 cleanup) for the HTML page-level injection. Adapter-level `fetcher?` (slice 18 typed) is for fixture injection.
- **tx-tec/shared.ts** uses `fetcher?: (url: string) => Promise<string>` opts key for the HTML page-level injection (different naming from ny-jcope's `pageFetcher`). NOT a concern for slice 20 — both use the existing names; we don't unify them.
- For PDF parsing in both adapters, mocking via `vi.mock('../../shared/pdf.ts')` is cleaner than adding a new opts key — matches slice 19 mi-board test pattern verbatim.
- `classifyIncomeKind` from `mi-pfd-helpers.ts` IS purely keyword-based regex; safe to import + reuse in NY parser (audit lesson: rule-of-three triggers shared module, current count = 2 callers).
- NY FDS PDF section header is audit-derived ("Schedule of Income" or "Sources of Income"); regex matches both via `/^Sources of Income$|^Schedule of Income$/i`.
- TX TEC order PDFs use uppercase section labels ("VIOLATION:", "CIVIL PENALTY:", "DISPOSITION:") per audit reconnaissance.

---

## File Structure

### Created files (4)
```
packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.ts        Task 1
packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.test.ts   Task 1
packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.ts                Task 3
packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.test.ts           Task 3
```

### Modified files (5)
```
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts              Task 2 (extend)
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts         Task 2 (extend)
packages/db/supabase/seed/state-ethics/tx-tec/shared.ts                     Task 4 (extend)
packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts                Task 4 (extend)
CLAUDE.md                                                                   Task 5 (slice 20 entry)
```

**Total touched: ~9 files.**

---

## Task 1: NY FDS PDF text parser helper

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.ts`
- Create: `packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  parseNyFdsText,
  type ParsedNyFdsLineItem,
} from './ny-fds-helpers.ts'

describe('parseNyFdsText', () => {
  it('returns [] for empty text', () => {
    expect(parseNyFdsText('')).toEqual([])
  })

  it('returns [] for text missing Sources/Schedule of Income header', () => {
    expect(parseNyFdsText('Some random PDF text with no recognized section')).toEqual([])
  })

  it('parses single income line item with "Sources of Income" header', () => {
    const text = `
NYS Financial Disclosure Statement 2024
Filer: Jane Doe (NYS Senate)

Sources of Income
1. Salary, State of New York: $50,000 - $100,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      income_source: expect.stringMatching(/State of New York/),
      income_kind: 'salary',
      amount_range_low: 50000,
      amount_range_high: 100000,
    })
  })

  it('parses "Schedule of Income" header variant', () => {
    const text = `
Part III. Schedule of Income
1. Consulting fees, XYZ LLC: $10,000 - $25,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.income_kind).toBe('consulting')
  })

  it('parses multiple income line items', () => {
    const text = `
Sources of Income
1. Salary, State of New York: $50,000 - $100,000
2. Consulting fees, XYZ LLC: $10,000 - $25,000
3. Rental income, 123 Main: $5,000 - $25,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(3)
    expect(items.map(i => i.income_kind)).toEqual(['salary', 'consulting', 'rental'])
  })

  it('handles "Less than $X" amount form', () => {
    const text = `
Sources of Income
1. Minor consulting: Less than $5,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.amount_range_low).toBe(0)
    expect(items[0]?.amount_range_high).toBe(5000)
  })

  it('handles "Over $X" amount form (open-ended)', () => {
    const text = `
Sources of Income
1. Salary, State of New York: Over $250,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.amount_range_low).toBe(250000)
    expect(items[0]?.amount_range_high).toBeUndefined()
  })

  it('handles en-dash and em-dash amount separators', () => {
    const items1 = parseNyFdsText('Sources of Income\n1. Salary: $1,000–$10,000')
    const items2 = parseNyFdsText('Sources of Income\n1. Salary: $1,000—$10,000')
    expect(items1[0]?.amount_range_high).toBe(10000)
    expect(items2[0]?.amount_range_high).toBe(10000)
  })

  it('classifies dividend / interest as dividend (NY plural fix)', () => {
    const text = `
Sources of Income
1. Dividends from common stock: $5,000 - $25,000
2. Interest income, savings: $1,000 - $5,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(2)
    expect(items[0]?.income_kind).toBe('dividend')
    expect(items[1]?.income_kind).toBe('dividend')
  })

  it('classifies royalty income', () => {
    const items = parseNyFdsText('Sources of Income\n1. Royalties from book: $1,000 - $5,000')
    expect(items[0]?.income_kind).toBe('royalty')
  })

  it('falls back to "other" for unrecognized income kind', () => {
    const items = parseNyFdsText('Sources of Income\n1. Lottery winnings, Dec 2024: $5,000 - $10,000')
    expect(items[0]?.income_kind).toBe('other')
  })

  it('skips lines without recognizable amount range', () => {
    const text = `
Sources of Income
1. Salary, State of New York (no amount listed)
2. Consulting: $1,000 - $5,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)  // Only line 2 has a parseable range
    expect(items[0]?.income_kind).toBe('consulting')
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ny-fds-helpers
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ny-fds-helpers.ts`**

Create `packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.ts`:

```ts
import { classifyIncomeKind } from './mi-pfd-helpers.ts'

export interface ParsedNyFdsLineItem {
  income_source: string
  income_kind: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
}

// Amount range patterns: "$X - $Y" / "$X – $Y" / "$X — $Y"
const AMOUNT_RANGE_RE = /\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/
const LESS_THAN_RE = /less than \$?([\d,]+)/i
const OVER_RE = /over \$?([\d,]+)/i

const SECTION_HEADER_RE = /^(sources of income|schedule of income|part iii\.?\s*schedule of income)/i

function parseAmount(numStr: string): number {
  return Number.parseInt(numStr.replace(/,/g, ''), 10)
}

/**
 * Parse a NY FDS form's extracted text into income line items.
 *
 * Audit-derived strategy: section walker over "Sources of Income"
 * or "Schedule of Income" lines. Each numbered line "N. Source
 * description: <amount form>" emits one ParsedNyFdsLineItem.
 *
 * Amount forms supported: "$X - $Y", "Less than $X", "Over $X"
 * (open-ended upper bound), plus en-dash + em-dash separator
 * variants.
 *
 * Lines lacking a recognizable amount range are skipped (silent —
 * operator monitors production parse rate; regex iterates with drift).
 *
 * Reuses classifyIncomeKind from slice 19 mi-pfd-helpers.ts (same
 * pure-regex keyword classifier; rule-of-three trigger not yet hit).
 *
 * Slice 20 fill pattern: emits N rows per filing in addition to
 * the slice 17 placeholder row. Both coexist via distinct
 * external_id (filing-{id} vs filing-{id}-{lineNo}).
 */
export function parseNyFdsText(text: string): ParsedNyFdsLineItem[] {
  if (!text || text.trim().length === 0) return []

  // Section header detection: split into blocks, find the Sources/Schedule
  // of Income block, walk numbered lines within it.
  const lines = text.split('\n').map(l => l.trim())
  let inIncomeSection = false
  const out: ParsedNyFdsLineItem[] = []

  for (const line of lines) {
    if (SECTION_HEADER_RE.test(line)) {
      inIncomeSection = true
      continue
    }
    if (!inIncomeSection) continue
    if (!/^\d+\.\s/.test(line)) continue

    // Extract income source: text after "N. " up to amount marker
    const sourceMatch = line.match(/^\d+\.\s+(.+?)(?::|less than|over|\$|\s[-–—]\s)/i)
    if (!sourceMatch) continue
    const income_source = sourceMatch[1]!.trim()
    if (!income_source) continue

    const income_kind = classifyIncomeKind(income_source)

    // Try "Less than $X" form first
    const lessThanMatch = line.match(LESS_THAN_RE)
    if (lessThanMatch) {
      const high = parseAmount(lessThanMatch[1]!)
      if (Number.isFinite(high)) {
        out.push({ income_source, income_kind, amount_range_low: 0, amount_range_high: high })
        continue
      }
    }

    // Try "Over $X" open-ended form
    const overMatch = line.match(OVER_RE)
    if (overMatch) {
      const low = parseAmount(overMatch[1]!)
      if (Number.isFinite(low)) {
        out.push({ income_source, income_kind, amount_range_low: low })
        continue
      }
    }

    // Try standard range "$X - $Y"
    const rangeMatch = line.match(AMOUNT_RANGE_RE)
    if (rangeMatch) {
      const low = parseAmount(rangeMatch[1]!)
      const high = parseAmount(rangeMatch[2]!)
      if (Number.isFinite(low) && Number.isFinite(high)) {
        out.push({ income_source, income_kind, amount_range_low: low, amount_range_high: high })
        continue
      }
    }

    // No parseable amount → skip
  }

  return out
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ny-fds-helpers
```
Expected: 12 tests PASS.

- [ ] **Step 5: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS (both base + seed tsconfigs from slice 18).

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.ts \
        packages/db/supabase/seed/state-ethics/disclosures/ny-fds-helpers.test.ts
git commit -m "$(cat <<'EOF'
feat(state-ethics): NY FDS PDF text parser helper

Audit-derived line-item parser for NY FDS PDF text. Section-walker
over "Sources of Income" / "Schedule of Income" headers; each numbered
line emits one ParsedNyFdsLineItem.

Amount forms supported:
- "$X - $Y" (standard hyphen + en-dash + em-dash)
- "Less than $X" (low=0, high=X)
- "Over $X" (open-ended; low=X, high=undefined)

Reuses classifyIncomeKind from slice 19 mi-pfd-helpers.ts (cross-state
keyword classifier; rule-of-three not yet hit, no extraction needed).

Lines lacking a recognizable amount range are silently skipped
(audit lesson — operator iterates regex during production runs).

12 vitest cases against mocked text snippets.

Slice 20 fill pattern: produces N rows per filing in addition to
slice 17 placeholder row. Both coexist via distinct external_id
(filing-{id} vs filing-{id}-{lineNo}).

Per spec: docs/superpowers/specs/2026-05-25-ny-fds-tx-tec-pdfs-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend NY FDS adapter with PDF parse + line-item emission

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts`
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts`

- [ ] **Step 1: Read current ny-jcope.ts to confirm shape**

```bash
sed -n '115,172p' packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts
```

Confirm the existing `fetchEvents` flow: pagination → resolve openstates_person_id → push placeholder row. Slice 20 ADDS a PDF-fetch step inside the row loop after the placeholder push.

- [ ] **Step 2: Write the failing test extension**

Append to `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts` (preserve existing tests; ADD new ones). Insert near top of file (after existing imports):

```ts
// Mock the shared/pdf module so slice 20 PDF parse path is testable.
vi.mock('../../shared/pdf.ts', () => ({
  fetchPdf: vi.fn(),
  extractPdfText: vi.fn(),
}))

import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedExtractPdfText = vi.mocked(extractPdfText)
```

Note: `vi.mock` must be at module top BEFORE imports being mocked. vitest hoists `vi.mock` calls automatically, but they MUST be in the same file; the destructured `vi.mocked()` wrappers are how you control the mock per-test.

Then append a new `describe` block at the end:

```ts
describe('ny-jcope slice 20 PDF line-item fill', () => {
  beforeEach(() => {
    mockedFetchPdf.mockReset()
    mockedExtractPdfText.mockReset()
  })

  it('emits placeholder + N line-item rows per filing when PDF parses', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({
          rows: [{ openstates_person_id: `ocd-${Math.random().toString(36).slice(2, 6)}` }],
          rowCount: 1,
        })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary, State of New York: $50,000 - $100,000\n2. Consulting fees: $10,000 - $25,000',
    )

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string; income_kind?: string }>

    // Fixture: 4 resolvable filings. Each gets:
    //   - 1 placeholder row (filing-{id}, no income fields)
    //   - 2 line-item rows from mocked PDF text (filing-{id}-1 + filing-{id}-2)
    // Total: 4 placeholders + 8 line items = 12 rows
    expect(result).toHaveLength(12)

    const placeholders = result.filter(r => !r.external_id?.includes('-1') && !r.external_id?.includes('-2'))
    const lineItems = result.filter(r => r.external_id?.match(/-\d+$/) && r.external_id?.split('-').length > 2)
    expect(placeholders).toHaveLength(4)
    expect(lineItems).toHaveLength(8)
    expect(lineItems[0]?.income_kind).toBe('salary')
  })

  it('emits only placeholder when fetchPdf rejects (silent skip)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockRejectedValue(new Error('404'))
    mockedExtractPdfText.mockResolvedValue('')  // never reached

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string }>

    // 4 resolvable filings × 1 placeholder each, no line items
    expect(result).toHaveLength(4)
    expect(result.every(r => r.external_id?.match(/^filing-[A-Z]+-\d+$/))).toBe(true)
  })

  it('emits only placeholder when extractPdfText returns empty', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never)

    // 4 placeholders, no line items
    expect(result).toHaveLength(4)
  })

  it('respects maxPdfsPerRun cap (only first N filings get PDF parse)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      maxPdfsPerRun: 2,
    } as never)

    // 4 placeholders total + line items from only the FIRST 2 filings (1 line item each)
    // = 4 + 2 = 6 rows
    expect(result).toHaveLength(6)
    expect(mockedFetchPdf).toHaveBeenCalledTimes(2)
  })

  it('line-item external_id format is filing-{id}-{lineNo}', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string }>

    // First filing's line item has external_id = filing-AM-12345-1
    const lineItem = result.find(r => r.external_id?.includes('-1') && r.external_id !== 'filing-AM-12345')
    expect(lineItem?.external_id).toBe('filing-AM-12345-1')
  })

  it('production-path remains [] when network is blocked (slice 17 behavior preserved)', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const result = await nyJcopeDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

(`stubFetchBlocked` is already imported in slice 18 cleanup of this test file; verify the import is present.)

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ny-jcope
```
Expected: FAIL — `maxPdfsPerRun` opts key not honored; new `describe` block tests fail.

- [ ] **Step 4: Extend `ny-jcope.ts` with PDF parse loop**

Modify `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts`:

Add imports near top:
```diff
 import * as cheerio from 'cheerio'
 import type { Client } from 'pg'
 import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'
 import { resolveOpenstatesPersonId } from '../../shared/officials.ts'
+import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
+import { parseNyFdsText } from './ny-fds-helpers.ts'
```

Add constants near top (after `RATE_LIMIT_MS`):
```diff
 const RATE_LIMIT_MS = 1000
+const MAX_PDFS_PER_RUN_DEFAULT = 200
+const PDF_RATE_LIMIT_MS = 1000
 const ORIGIN = 'https://ethics.ny.gov'
```

Modify `nyJcopeDisclosures.fetchEvents` to support `maxPdfsPerRun?` opts key + PDF parse loop. Replace the existing row-emission loop (the `for (const row of parsedRows)` block) with this expanded version:

```ts
const out: NormalizedFinancialDisclosure[] = []
const client = (opts as { client: Client }).client
const maxPdfsPerRun = (opts as { maxPdfsPerRun?: number }).maxPdfsPerRun ?? MAX_PDFS_PER_RUN_DEFAULT

// First pass: resolve + emit placeholder rows (slice 17 behavior, unchanged).
// Collect rows that have a resolvable legislator for the slice 20 PDF pass.
interface ResolvedFiling {
  row: ParsedNyFdsRow
  openstates_person_id: string
}
const resolvedFilings: ResolvedFiling[] = []

for (const row of parsedRows) {
  const chamber = inferChamberFromOfficeText(row.office_text)
  if (!chamber) continue

  const openstates_person_id = await resolveOpenstatesPersonId(client, {
    full_name: row.full_name,
    state: 'NY',
    chamber,
  })
  if (!openstates_person_id) continue

  out.push({
    official_openstates_person_id: openstates_person_id,
    filing_year: row.filing_year,
    filing_date: row.filing_date,
    state: 'NY',
    source_url: row.source_url,
    source: 'ny-jcope',
    external_id: `filing-${row.filing_id}`,
  })

  resolvedFilings.push({ row, openstates_person_id })
}

// Second pass: PDF fetch + parse + line-item emission for the first
// maxPdfsPerRun filings (slice 20 — operator caps batch size).
const pdfBudget = Math.min(maxPdfsPerRun, resolvedFilings.length)
const testMode = Boolean(pageFetcher)

for (let i = 0; i < pdfBudget; i += 1) {
  const { row, openstates_person_id } = resolvedFilings[i]!

  let buffer: Buffer
  try {
    buffer = await fetchPdf(row.source_url)
  } catch {
    continue
  }

  const text = await extractPdfText(buffer)
  if (!text) continue

  const lineItems = parseNyFdsText(text)
  if (lineItems.length === 0) continue

  lineItems.forEach((item, idx) => {
    const lineNo = idx + 1
    const lineRow: NormalizedFinancialDisclosure = {
      official_openstates_person_id: openstates_person_id,
      filing_year: row.filing_year,
      filing_date: row.filing_date,
      income_source: item.income_source,
      income_kind: item.income_kind,
      state: 'NY',
      source_url: row.source_url,
      source: 'ny-jcope',
      external_id: `filing-${row.filing_id}-${lineNo}`,
    }
    if (item.amount_range_low !== undefined) lineRow.amount_range_low = item.amount_range_low
    if (item.amount_range_high !== undefined) lineRow.amount_range_high = item.amount_range_high
    out.push(lineRow)
  })

  // Audit M5 throttle guard — skip after last iteration. Skipped entirely in test mode.
  if (!testMode && i < pdfBudget - 1) {
    await new Promise(resolve => setTimeout(resolve, PDF_RATE_LIMIT_MS))
  }
}

return out
```

(The `testMode = Boolean(pageFetcher)` detection lets us skip the PDF-loop throttle when adapter tests inject `pageFetcher`. This matches slice 19's pattern but at PDF-level granularity.)

- [ ] **Step 5: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ny-jcope
```
Expected: ALL ny-jcope tests PASS (slice 17 baseline + 6 new slice 20 tests = ~24 total).

- [ ] **Step 6: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 7: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 683 baseline + 12 (Task 1) + 6 (Task 2) = ~701 tests PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts \
        packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts
git commit -m "$(cat <<'EOF'
feat(state-ethics): NY FDS line-item PDF parse — extend ny-jcope

Slice 17 NY FDS adapter emits placeholder rows per filing; slice 20
extends with a PDF-parse pass that adds N line-item rows per filing
with augmented external_id (filing-{id}-{lineNo}).

Both row types coexist in DB — placeholder retains slice 17
external_id (filing-{id}), line items differentiate by suffix. UI
groups by source_url to render "1 filing, N parsed items".

- Two-pass flow: first pass resolves + emits placeholders (slice 17
  unchanged), second pass iterates resolved filings + fetches PDF +
  extracts text + parses line items via parseNyFdsText.
- maxPdfsPerRun opts key (default 200) caps PDF batch per orchestrator
  run; remaining filings still get placeholders.
- Per-filing silent skip on fetchPdf rejection / empty extractPdfText
  / parseNyFdsText 0-item result.
- M5 throttle guard (1-req/sec between PDF fetches; skipped in
  test mode via pageFetcher injection detection).
- 6 new vitest cases mock the shared/pdf module via vi.mock pattern
  from slice 19 mi-board. Production-path leak prevention via
  stubFetchBlocked preserved from slice 18.

Production fetch volume now: ~30-50 HTML page fetches + up to
200 PDF fetches per orchestrator run, ~3-7 min total at 1-req/sec.

Per spec: docs/superpowers/specs/2026-05-25-ny-fds-tx-tec-pdfs-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TX TEC PDF text parser helper

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.ts`
- Create: `packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  parseTxTecOrderText,
  type ParsedTxTecOrder,
} from './pdf-helpers.ts'

describe('parseTxTecOrderText', () => {
  it('returns empty result for empty text', () => {
    expect(parseTxTecOrderText('')).toEqual({})
  })

  it('returns empty result for garbage text', () => {
    expect(parseTxTecOrderText('completely unrelated content')).toEqual({})
  })

  it('extracts violation_summary from VIOLATION: header', () => {
    const text = `
TEXAS ETHICS COMMISSION
SC-202401-001 — Final Order

VIOLATION:
Failed to file annual personal financial statement by April 30 deadline.

CIVIL PENALTY: $1,500.00

DISPOSITION:
Resolved by Agreed Order.
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/Failed to file annual/)
    expect(result.penalty_amount).toBe(1500)
    expect(result.outcome_text).toMatch(/Resolved by Agreed Order/)
  })

  it('extracts violation_summary from ALLEGATION: header variant', () => {
    const text = `
ALLEGATION:
Respondent accepted prohibited gifts during legislative session.

CIVIL PENALTY: $5,000
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/prohibited gifts/)
    expect(result.penalty_amount).toBe(5000)
  })

  it('extracts violation_summary from FINDING: header variant', () => {
    const text = `
FINDING:
Late filing of campaign finance report — 14 days past deadline.
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/Late filing/)
    expect(result.penalty_amount).toBeUndefined()
  })

  it('extracts penalty with comma + decimal formats', () => {
    const text1 = 'CIVIL PENALTY: $15,000.00'
    const text2 = 'CIVIL PENALTY: $250'
    const text3 = 'PENALTY ASSESSED: $1,200.50'
    expect(parseTxTecOrderText(text1).penalty_amount).toBe(15000)
    expect(parseTxTecOrderText(text2).penalty_amount).toBe(250)
    expect(parseTxTecOrderText(text3).penalty_amount).toBe(1200)
  })

  it('extracts outcome_text from ORDER: header variant', () => {
    const text = `
VIOLATION: Late filing.
ORDER:
The Commission imposes a civil penalty in the amount stated above.
`
    const result = parseTxTecOrderText(text)
    expect(result.outcome_text).toMatch(/imposes a civil penalty/i)
  })

  it('handles partial parse (only some fields present)', () => {
    const text = `
VIOLATION:
Failed to register as lobbyist.
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toBeTruthy()
    expect(result.penalty_amount).toBeUndefined()
    expect(result.outcome_text).toBeUndefined()
  })

  it('handles multi-paragraph violation text', () => {
    const text = `
VIOLATION:
Respondent violated Texas Election Code 254.031 by failing to disclose
contributions in excess of $200 from individual donors.

Specific violations include:
- 3 contributions from John Doe totaling $1,200
- 2 contributions from Jane Smith totaling $850

CIVIL PENALTY: $2,000
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/Texas Election Code/)
    // Multi-paragraph capture includes the bullet list
    expect(result.violation_summary?.length).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec/pdf-helpers
```
Expected: FAIL.

- [ ] **Step 3: Implement `pdf-helpers.ts`**

Create `packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.ts`:

```ts
export interface ParsedTxTecOrder {
  violation_summary?: string
  penalty_amount?: number
  outcome_text?: string
}

// Section-header regexes. TX TEC orders use uppercase labels followed by
// colon + newline + body text. Body extends until the next uppercase
// section header or end of document.
const VIOLATION_HEADER_RE = /^(VIOLATION|ALLEGATION|FINDING)S?:\s*$/m
const PENALTY_HEADER_RE = /^(CIVIL PENALTY|PENALTY ASSESSED|FINE):\s*\$?([\d,]+(?:\.\d{1,2})?)/im
const OUTCOME_HEADER_RE = /^(DISPOSITION|ORDER):\s*$/m

const SECTION_END_RE = /^(VIOLATION|ALLEGATION|FINDING|CIVIL PENALTY|PENALTY ASSESSED|FINE|DISPOSITION|ORDER|RESPONDENT|RECEIVED|RESPECTFULLY)S?:?\s*$/m

function extractSectionBody(text: string, headerRe: RegExp): string | undefined {
  const match = text.match(headerRe)
  if (!match) return undefined
  const startIdx = match.index! + match[0].length
  const rest = text.slice(startIdx)
  // Find the next section header that terminates this section
  const endMatch = rest.match(SECTION_END_RE)
  const endIdx = endMatch?.index ?? rest.length
  const body = rest.slice(0, endIdx).trim()
  return body.length > 0 ? body : undefined
}

function parsePenaltyAmount(text: string): number | undefined {
  const match = text.match(PENALTY_HEADER_RE)
  if (!match) return undefined
  const numStr = match[2]!.replace(/,/g, '')
  const parsed = Number.parseFloat(numStr)
  if (!Number.isFinite(parsed)) return undefined
  return Math.trunc(parsed)  // Integer dollar amount; cents truncated
}

/**
 * Parse a TX TEC sworn-complaint order PDF's extracted text.
 *
 * TX TEC orders are pseudo-formal legal documents with uppercase section
 * labels. v1 extracts 3 optional fields:
 *
 *   - violation_summary: text under VIOLATION/ALLEGATION/FINDING header.
 *     Multi-paragraph capture (everything until next section header).
 *   - penalty_amount: dollar value from CIVIL PENALTY/PENALTY ASSESSED/FINE
 *     header. Integer dollars; cents truncated. Commas stripped.
 *   - outcome_text: text under DISPOSITION/ORDER header.
 *
 * All fields optional — order PDFs vary in completeness. Returns empty
 * object if no recognized section headers found. Slice 20 fill pattern:
 * caller UPSERTs the existing complaint + event rows (slice 16) with
 * these enriched fields (no row count change).
 */
export function parseTxTecOrderText(text: string): ParsedTxTecOrder {
  if (!text || text.trim().length === 0) return {}

  const result: ParsedTxTecOrder = {}

  const violation_summary = extractSectionBody(text, VIOLATION_HEADER_RE)
  if (violation_summary) result.violation_summary = violation_summary

  const penalty_amount = parsePenaltyAmount(text)
  if (penalty_amount !== undefined) result.penalty_amount = penalty_amount

  const outcome_text = extractSectionBody(text, OUTCOME_HEADER_RE)
  if (outcome_text) result.outcome_text = outcome_text

  return result
}
```

- [ ] **Step 4: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec/pdf-helpers
```
Expected: 9 tests PASS.

- [ ] **Step 5: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.ts \
        packages/db/supabase/seed/state-ethics/tx-tec/pdf-helpers.test.ts
git commit -m "$(cat <<'EOF'
feat(state-ethics): TX TEC per-case order PDF text parser

Audit-derived parser for TX TEC sworn-complaint order PDFs.
3 optional fields extracted via uppercase section headers:

- violation_summary: text under VIOLATION/ALLEGATION/FINDING.
  Multi-paragraph capture until next section header.
- penalty_amount: dollar value from CIVIL PENALTY/PENALTY ASSESSED/
  FINE. Integer dollars; cents truncated; commas stripped.
- outcome_text: text under DISPOSITION/ORDER.

All fields optional — order PDFs vary widely (1-10+ pages, different
formatting eras). Returns empty object for unrecognized format.

9 vitest cases with mocked text snippets.

Slice 20 fill pattern: caller UPSERTs the existing complaint + event
rows from slice 16 with these enriched fields (no row count change;
external_id unchanged so UPSERT preserves dedup).

Per spec: docs/superpowers/specs/2026-05-25-ny-fds-tx-tec-pdfs-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extend TX TEC combined parser with PDF enrichment

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/tx-tec/shared.ts`
- Modify: `packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts`

- [ ] **Step 1: Write the failing test extension**

Append to `packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts`. Add module-level mocks near top (after existing imports):

```ts
vi.mock('../../shared/pdf.ts', () => ({
  fetchPdf: vi.fn(),
  extractPdfText: vi.fn(),
}))

import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedExtractPdfText = vi.mocked(extractPdfText)
```

Append a new `describe` block at end:

```ts
describe('tx-tec slice 20 PDF enrichment', () => {
  beforeEach(() => {
    mockedFetchPdf.mockReset()
    mockedExtractPdfText.mockReset()
  })

  it('enriches summary + outcome from parsed PDF text', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(`
VIOLATION:
Failed to file annual personal financial statement.

CIVIL PENALTY: $1,500

DISPOSITION:
Resolved by Agreed Order.
`)

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    // Pick the first legislator-row's complaint (Jane Doe per fixture)
    const jane = result.complaints.find(c => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Failed to file annual/)
    expect(jane.disposition).toMatch(/Resolved by Agreed Order/)

    const janeEvent = result.events.find(e => e.external_id === 'event-SC-202401-001')!
    expect(janeEvent.summary).toMatch(/Failed to file annual/)
    expect(janeEvent.outcome).toMatch(/Resolved by Agreed Order/)
  })

  it('falls back to slice 16 generic summary when fetchPdf rejects', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockRejectedValue(new Error('404'))

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    const jane = result.complaints.find(c => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Sworn complaint order SC-202401-001/)  // slice 16 stub format
  })

  it('falls back to slice 16 generic summary when extractPdfText returns empty', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    const jane = result.complaints.find(c => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Sworn complaint order/)
  })

  it('partial parse: only violation_summary present → summary enriched, disposition unchanged', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(`
VIOLATION:
Failed to register lobbyist.
`)

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    const jane = result.complaints.find(c => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Failed to register lobbyist/)
    expect(jane.disposition).toMatch(/Agreed Order/)  // slice 16 fallback (from row.status)
  })

  it('respects maxPdfsPerRun cap (only first N rows enriched)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(`
VIOLATION:
Test violation.
`)

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
      maxPdfsPerRun: 2,
    } as never)

    // Fixture has 6 legislator rows (3 Assembly + 3 Senate per slice 16 fixture).
    // First 2 get PDF-enriched; rest get slice 16 fallback summary.
    expect(mockedFetchPdf).toHaveBeenCalledTimes(2)

    // First 2 complaints have enriched summary
    expect(result.complaints[0]?.summary).toMatch(/Test violation/)
    expect(result.complaints[1]?.summary).toMatch(/Test violation/)
    // Rest have slice 16 stub format
    expect(result.complaints[2]?.summary).toMatch(/Sworn complaint order/)
  })

  it('production-path returns empty result when HTML fetch fails (slice 16 behavior preserved)', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const result = await fetchSwornComplaintOrders(client as never, {})
    expect(result.complaints).toEqual([])
    expect(result.events).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

(`stubFetchBlocked` already imported via slice 18 cleanup. Verify.)

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec/shared
```
Expected: FAIL.

- [ ] **Step 3: Extend `tx-tec/shared.ts` with PDF enrichment**

Modify `packages/db/supabase/seed/state-ethics/tx-tec/shared.ts`:

Add imports near top:
```diff
 import * as cheerio from 'cheerio'
 import type { Client } from 'pg'
 import type { NormalizedEthicsComplaint, NormalizedOfficialEvent } from '../shared.ts'
 import { resolveOpenstatesPersonId } from '../../shared/officials.ts'
+import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
+import { parseTxTecOrderText } from './pdf-helpers.ts'
```

Add constants near top:
```diff
 const FETCH_TIMEOUT_MS = 5000
+const MAX_PDFS_PER_RUN_DEFAULT = 200
+const PDF_RATE_LIMIT_MS = 1000
```

Update `fetchSwornComplaintOrders` signature to accept `maxPdfsPerRun`:
```diff
 export async function fetchSwornComplaintOrders(
   client: Pick<Client, 'query'>,
-  opts: { fetcher?: (url: string) => Promise<string> },
+  opts: {
+    fetcher?: (url: string) => Promise<string>
+    maxPdfsPerRun?: number
+  },
 ): Promise<TxTecOrdersResult> {
```

Restructure the row-emission loop into TWO passes:

```ts
// First pass: existing slice 16 HTML scrape + row emission (unchanged).
// Build a list of emitted rows alongside their source_pdf_url for the
// slice 20 PDF enrichment pass.
interface RowToEnrich {
  source_pdf_url: string
  complaintIdx: number
  eventIdx: number
}
const rowsToEnrich: RowToEnrich[] = []

for (const row of parsedRows) {
  if (!isTexasLegislatorRow(row)) continue

  const chamber: 'state_house' | 'state_senate' =
    /House/i.test(row.agency) ? 'state_house' : 'state_senate'

  const openstates_person_id = await resolveOpenstatesPersonId(client, {
    full_name: row.respondent,
    state: 'TX',
    chamber,
  })
  if (!openstates_person_id) {
    errors.push(`unresolved: ${row.respondent} (${chamber})`)
    continue
  }

  const status = mapStatus(row.status)

  const complaintIdx = complaints.length
  complaints.push({
    official_openstates_person_id: openstates_person_id,
    complaint_date: row.date_issued,
    status,
    disposition: row.status,
    summary: `Sworn complaint order ${row.order_number} (${row.agency})`,
    state: 'TX',
    source_url: row.source_pdf_url,
    source: 'tx-tec',
    external_id: `complaint-${row.order_number}`,
  })

  const eventIdx = events.length
  events.push({
    official_openstates_person_id: openstates_person_id,
    event_date: row.date_issued,
    event_type: 'campaign_finance_violation',
    outcome: row.status,
    summary: `TEC sworn complaint ${row.order_number}`,
    state: 'TX',
    source_url: row.source_pdf_url,
    source: 'tx-tec',
    external_id: `event-${row.order_number}`,
  })

  rowsToEnrich.push({ source_pdf_url: row.source_pdf_url, complaintIdx, eventIdx })
}

// Second pass: slice 20 PDF enrichment. For the first maxPdfsPerRun rows,
// fetch + parse the per-case order PDF and UPDATE the complaint + event
// summary/disposition/outcome fields in place.
const maxPdfsPerRun = opts.maxPdfsPerRun ?? MAX_PDFS_PER_RUN_DEFAULT
const pdfBudget = Math.min(maxPdfsPerRun, rowsToEnrich.length)
const testMode = Boolean(opts.fetcher)

for (let i = 0; i < pdfBudget; i += 1) {
  const enrich = rowsToEnrich[i]!

  let buffer: Buffer
  try {
    buffer = await fetchPdf(enrich.source_pdf_url)
  } catch {
    continue
  }

  const text = await extractPdfText(buffer)
  if (!text) continue

  const parsed = parseTxTecOrderText(text)
  if (parsed.violation_summary) {
    complaints[enrich.complaintIdx]!.summary = parsed.violation_summary
    events[enrich.eventIdx]!.summary = parsed.violation_summary
  }
  if (parsed.outcome_text) {
    complaints[enrich.complaintIdx]!.disposition = parsed.outcome_text
    events[enrich.eventIdx]!.outcome = parsed.outcome_text
  }
  // penalty_amount is parsed but not currently a column on
  // NormalizedEthicsComplaint or NormalizedOfficialEvent — store as
  // suffix to summary if present.
  if (parsed.penalty_amount !== undefined) {
    const penaltyNote = ` (Civil penalty: $${parsed.penalty_amount.toLocaleString()})`
    complaints[enrich.complaintIdx]!.summary += penaltyNote
    events[enrich.eventIdx]!.summary += penaltyNote
  }

  if (!testMode && i < pdfBudget - 1) {
    await new Promise(resolve => setTimeout(resolve, PDF_RATE_LIMIT_MS))
  }
}

return { complaints, events, errors }
```

Note: `penalty_amount` doesn't have a dedicated column on the existing `NormalizedEthicsComplaint` / `NormalizedOfficialEvent` types. v1 appends as suffix to summary (e.g. `"Failed to file ... (Civil penalty: $1,500)"`). Future slice could add a `penalty_amount` column via schema migration if surface needs it.

- [ ] **Step 4: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec
```
Expected: ALL tx-tec tests PASS (slice 16 baseline + 6 new slice 20 enrichment + 9 helper from Task 3).

- [ ] **Step 5: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 6: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 683 + 12 (Task 1) + 6 (Task 2) + 9 (Task 3) + 6 (Task 4) = ~716 tests PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-ethics/tx-tec/shared.ts \
        packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts
git commit -m "$(cat <<'EOF'
feat(state-ethics): TX TEC per-case PDF enrichment — extend tx-tec parser

Slice 16 emitted one complaint + one event per HTML row with a
generic summary; slice 20 extends with a PDF-parse pass that
enriches summary + disposition + outcome with parsed per-case
order text. Same row count exits the function; UPSERT preserves
dedup via existing (source, external_id) UNIQUE.

- Two-pass flow: first pass remains the slice 16 HTML scrape +
  row emission, second pass iterates the emitted rows + fetches
  each source_pdf_url + extracts + parses via parseTxTecOrderText.
- Enrichment is conditional per parsed field. If violation_summary
  is parsed → replace complaint.summary + event.summary. If
  outcome_text parsed → replace complaint.disposition + event.outcome.
  If penalty_amount parsed → append " (Civil penalty: $X)" suffix
  to summary (no dedicated schema column in v1).
- maxPdfsPerRun opts key (default 200) caps PDF batch per
  orchestrator run.
- Per-row silent skip on fetchPdf rejection / empty extractPdfText
  → row keeps slice 16 fallback summary.
- M5 throttle guard (1-req/sec between PDF fetches; skipped in
  test mode via fetcher injection detection).
- 6 new vitest cases. Module-level vi.mock for shared/pdf.

Per spec: docs/superpowers/specs/2026-05-25-ny-fds-tx-tec-pdfs-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Closure — CLAUDE.md slice 20 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 20 entry)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice20_ny_fds_tx_tec_pdfs.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Append slice 20 entry to CLAUDE.md**

After the slice 19 entry in `## Slices delivered`, append:

```markdown
- **Slice 20 — NY FDS + TX TEC PDF parsing** (2026-05-25): Two distinct PDF-fill patterns built on slice 19's shared/pdf.ts helper. (1) **NY FDS line-item fill** (`state-ethics/disclosures/ny-jcope.ts` extension): per-filing PDF parse adds N line-item rows alongside slice 17's placeholder row; `external_id = filing-{NY_filing_id}-{lineNo}` differentiates from placeholder `filing-{NY_filing_id}`. UI groups by `source_url` to render "1 filing, N items". `parseNyFdsText` section-walker over "Sources of Income" / "Schedule of Income" headers; supports "Less than $X" / "Over $X" / "$X - $Y" amount forms. Reuses slice 19 `classifyIncomeKind` (cross-state keyword classifier; 2 callers, rule-of-three not hit). (2) **TX TEC per-case enrichment** (`state-ethics/tx-tec/shared.ts` extension): per-row PDF parse enriches `complaint.summary` + `complaint.disposition` + `event.summary` + `event.outcome` with parsed VIOLATION/CIVIL PENALTY/DISPOSITION section text. Same row count; UPSERT preserves dedup via existing `(source, external_id)` UNIQUE. `parseTxTecOrderText` extracts 3 optional fields (violation_summary, penalty_amount, outcome_text). penalty_amount appended as " (Civil penalty: $X)" summary suffix v1 (no dedicated schema column). Both adapters add `maxPdfsPerRun?` opts key (default 200) for batch-size control. M5 throttle guard (1-req/sec between PDF fetches; skipped in test mode). Mock text strings only; no real PDF binaries committed. ~9 files; no schema work; pgTAP unchanged at 402 plans. Test count: 683 → ~716 (+~33). Audit deferred candidates: 4 → 1 closed (NY FDS + TX TEC line-item/enrichment); CA FPPC Form 700 remains for slice 21+.
```

No new Gotcha — slice 19 helper + slice 17 placeholder + slice 16 combined-parser patterns cover the new code.

- [ ] **Step 2: Write memory file**

Use Write tool to create `~/.claude/projects/.../memory/project_chiaro_slice20_ny_fds_tx_tec_pdfs.md`:

```markdown
---
name: project-chiaro-slice20-ny-fds-tx-tec-pdfs
description: Slice 20 — NY FDS line-item fill + TX TEC per-case PDF enrichment
metadata:
  type: project
---

Slice 20 shipped 2026-05-25 — merged locally to master as squash `<squash SHA>`. Feature branch `slice-20-ny-fds-tx-tec-pdfs` deleted post-merge.

**Scope:** Two distinct PDF-fill patterns built on slice 19's shared/pdf.ts helper. Closes 2 of 3 remaining audit PDF-bound candidates (NY FDS line-items + TX TEC per-case enrichment). CA FPPC Form 700 (3rd candidate) defers to slice 21+.

**What shipped:**
- `ny-fds-helpers.ts` with parseNyFdsText (NY-specific section walker over "Sources of Income" / "Schedule of Income" + amount-form variants). Reuses slice 19 classifyIncomeKind.
- ny-jcope.ts extended with two-pass flow: slice 17 placeholder emission unchanged; slice 20 adds per-filing PDF parse + line-item emission.
- `tx-tec/pdf-helpers.ts` with parseTxTecOrderText (uppercase section headers VIOLATION/CIVIL PENALTY/DISPOSITION).
- tx-tec/shared.ts extended with two-pass flow: slice 16 row emission unchanged; slice 20 adds per-row PDF parse + summary/disposition/outcome enrichment.
- 33 new vitest cases.

**Durable lessons:**

1. **"Expand rows" vs "enrich rows" PDF-fill patterns.** NY FDS produces N additional rows per filing (different external_id suffix); TX TEC UPSERTs existing rows with richer text fields (same external_id). Choice depends on whether the source PDF has 1:N data (line items) or 1:1 detail (case description). Both patterns coexist in the codebase; slice 21+ implementers pick per source.

2. **Cross-state helper reuse: `classifyIncomeKind` shared between MI PFD + NY FDS.** Pure regex keyword classifier; safe to share. Rule-of-three trigger (3rd caller) not yet hit → no shared-module extraction. If CA FPPC or another state needs the same classifier, slice 22+ extracts to `state-ethics/_shared.ts` or `seed/shared/income.ts`.

3. **Two-pass adapter flow for PDF integration.** First pass emits the baseline rows (HTML/index data); second pass iterates emitted rows + fetches/parses per-row PDF + augments. This pattern lets PDF failures degrade gracefully — baseline rows stay valid even when PDF parse fails. Slice 20 NY FDS = first pass emits placeholders; slice 20 TX TEC = first pass emits stub-summary rows.

4. **`maxPdfsPerRun` cap pattern.** Both NY + TX adapters default to 200 PDFs per orchestrator run. Caps total fetch time during nightly batches. Operator overrides via opts. Future slices follow this pattern when adding bulk PDF fetchers.

5. **Slice 19 `vi.mock('../../shared/pdf.ts')` pattern propagates.** Adapter tests mock fetchPdf + extractPdfText at module level (NOT injected opts keys). Cleaner than adding pdfFetcher opts keys per adapter.

6. **Penalty amount has no dedicated schema column in v1.** TX TEC parser extracts penalty_amount but appends to summary as " (Civil penalty: $X)" suffix. If UI/queries need numeric penalty, future slice adds a schema column + migration. For v1, the summary suffix is searchable text.

7. **NY FDS "Over $X" form has open-ended upper bound.** `amount_range_high` left undefined when parser hits "Over $250,000". UI must handle null amount_range_high distinctly from numeric upper bound.

8. **NY FDS section header variants: "Sources of Income" OR "Schedule of Income" OR "Part III. Schedule of Income".** Single regex `/^(sources of income|schedule of income|part iii\.?\s*schedule of income)/i` covers all 3. Production drift may surface new variants; regex iterates.

9. **TX TEC section headers are uppercase + colon.** "VIOLATION:", "ALLEGATION:", "FINDING:", "CIVIL PENALTY:", "PENALTY ASSESSED:", "FINE:", "DISPOSITION:", "ORDER:". Lower-case variants ignored (audit-derived); production drift triggers operator regex update.

10. **`testMode = Boolean(opts.fetcher OR opts.pageFetcher)` detection.** When any test-fetcher is injected, both HTML throttle AND PDF throttle skip for test speed. Production path uses real fetch + both throttles. Slice 19 introduced this; slice 20 reuses verbatim.

**Active follow-ups (operator):**

- **Slice 21+: CA FPPC Form 700** — last audit PDF-bound candidate. URL pattern `fppc.ca.gov/search-filings/form-700-search/search-filed-form-700s/` is HTML index + PDF filings (similar to NY FDS structure). v1 ships placeholder-then-line-item fill following NY pattern.
- **MI PFD URL pattern verification** (slice 19 carryover): scaffold-time fetch of 2-3 real URLs to confirm `MI_PFD_BASE` path segments.
- **NY FDS + TX TEC regex iteration** against real PDFs: monitor production parse rates; refine section header + amount-form regexes for drift.
- **`penalty_amount` schema column** consideration: if UI surfaces dollar values prominently, future schema migration adds dedicated column to NormalizedEthicsComplaint + NormalizedOfficialEvent. Currently in summary suffix only.
- **Cross-state `classifyIncomeKind` extraction** triggered by 3rd caller (CA FPPC or other). Defer until rule-of-three.
- **PDF backfill (year < 2024 for NY FDS, pre-current orders for TX TEC):** future slice handles enumeration; v1 hardcodes year=2024 (slice 17) and "current" orders (slice 16).
- **LCV-OR + PP × 5 browser-UA probe spike** (slice 11 carryover).
- **Mobile DoD on-device smoke**.

**Master state at slice 20 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans (unchanged). 16 production parsers (same as slice 19; this slice EXTENDED 2 existing parsers, didn't add new ones). @chiaro/db test count: ~716 (683 + ~33). Audit deferred candidates: 4 → 3 closed (NY FDS line-items + TX TEC enrichment); 1 PDF-bound remains (CA FPPC Form 700).

**Cross-links:** [[project-chiaro-slice16-ca-mi-tx-parsers]] (TX TEC combined-parser baseline), [[project-chiaro-slice17-ny-fds-fl-offices]] (NY FDS placeholder-row pattern), [[project-chiaro-slice18-bug-fix-tooling-refactors]] (stubFetchBlocked, generic StateXxxAdapter<E>, composite typecheck), [[project-chiaro-slice19-pdf-parsing-mi-pfd]] (shared/pdf.ts + classifyIncomeKind + vi.mock pattern). Audit: `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`.
```

- [ ] **Step 3: Update MEMORY.md index**

Read `MEMORY.md`. Find the slice 19 line. Add IMMEDIATELY AFTER:

```markdown
- [Chiaro slice 20 NY FDS + TX TEC PDFs](project_chiaro_slice20_ny_fds_tx_tec_pdfs.md) — two PDF-fill patterns extending slice 17/16 adapters: NY FDS "expand rows" (placeholder + N line items per filing) + TX TEC "enrich rows" (UPSERT summary/disposition/outcome on existing complaint+event rows); maxPdfsPerRun opts cap + module-level vi.mock pattern from slice 19; classifyIncomeKind cross-state reuse
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm --filter @chiaro/web build
```

Expected: All green.
- `pnpm -r typecheck` — 11 packages green (composite covers seed tree)
- `pnpm --filter @chiaro/db exec vitest run` — ~716 tests pass
- `pnpm --filter @chiaro/officials-ui exec vitest run` — 256 tests pass (unchanged)
- `pnpm --filter @chiaro/web build` — 12 routes green

- [ ] **Step 5: Commit Task 5**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 20 closure — CLAUDE.md entry

Slice 20 ships two PDF-fill patterns (NY FDS line-items expand;
TX TEC enrich) extending slices 16 + 17 with slice 19's pdf-parse
infrastructure.

No new Gotcha — slice 17 placeholder + slice 16 combined-parser +
slice 19 PDF-parse patterns all reused.

@chiaro/db test count: +~33 (683 → ~716).
Audit deferred candidates: 4 → 3 closed; CA FPPC Form 700 remains
for slice 21+.
pgTAP unchanged at 402 plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo working tree — written in Steps 2-3 but NOT git-added.)

---

## Workspace verify gate (recap)

After all 5 tasks complete:

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run                         # ~716 tests green
pnpm --filter @chiaro/officials-ui exec vitest run               # 256 tests green
pnpm --filter @chiaro/web build                                  # 12 routes
git log master..HEAD --oneline                                   # 7 commits (spec + plan + 5 implementation)
```

---

## Self-review notes

### Spec coverage

- ✅ NY FDS PDF text parser (parseNyFdsText + ParsedNyFdsLineItem) — Task 1
- ✅ NY FDS adapter extension (two-pass + line-item emission) — Task 2
- ✅ TX TEC PDF text parser (parseTxTecOrderText + ParsedTxTecOrder) — Task 3
- ✅ TX TEC combined parser enrichment (two-pass + UPSERT) — Task 4
- ✅ maxPdfsPerRun opts cap (both adapters) — Tasks 2 + 4
- ✅ M5 throttle guard between PDF fetches — Tasks 2 + 4
- ✅ vi.mock('../../shared/pdf.ts') test pattern — Tasks 2 + 4
- ✅ stubFetchBlocked production-path tests — Tasks 2 + 4
- ✅ Placeholder + line-item coexistence design — Task 2
- ✅ classifyIncomeKind cross-state reuse — Task 1
- ✅ Closure docs + memory — Task 5

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. Each task contains full file content or precise diff blocks. URL patterns + section header regexes flagged audit-derived with port-time iteration.

### Type consistency

- `ParsedNyFdsLineItem` (Task 1) maps cleanly to `NormalizedFinancialDisclosure` fields used in Task 2.
- `ParsedTxTecOrder` (Task 3) Optional<3 fields> maps cleanly to UPSERT enrichment in Task 4.
- `classifyIncomeKind` import path `./mi-pfd-helpers.ts` consistent.
- `fetchPdf` + `extractPdfText` import path `../../shared/pdf.ts` consistent across Tasks 2 + 4.
- `maxPdfsPerRun?: number` opts shape consistent across NY + TX adapters.
- `testMode = Boolean(pageFetcher || opts.fetcher)` detection consistent.

### Known incomplete details

- NY FDS "Schedule of Income" + "Sources of Income" header regex is audit-derived. Real NY FDS PDFs may use other variants; operator iterates regex during production runs.
- TX TEC uppercase section headers (VIOLATION/CIVIL PENALTY/DISPOSITION) audit-derived from sample order PDFs. Real orders may use lowercase or alternate labels; parser may yield empty for those.
- `penalty_amount` from TX TEC orders has no dedicated schema column — v1 appends as summary suffix. Future schema change is operator follow-up.
- NY FDS `Over $X` form sets `amount_range_high = undefined`. UI must handle null distinctly from numeric upper bound.
- Memory `<squash SHA>` placeholders filled post-merge per slice 14-19 precedent.
- Test counts ±2 per task due to vitest grouping; implementer reports actual.
