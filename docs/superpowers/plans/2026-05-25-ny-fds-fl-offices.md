# NY FDS + FL district_offices — slice 17 plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 2 production parsers replacing slice 5H/5I stubs — NY FDS index (HTML scrape; PDF parsing deferred) + FL district_offices (per-member fetch loop, mirroring slice 16 CA/MI). Continues slice 15/16 HTML-scrape pattern; no new workspace dep.

**Architecture:** NY FDS is a direct single-file stub replacement (single-source HTML index, paginated). FL district_offices follows slice 16 ca-leginfo + mi-legislature subfolder pattern: 2 sub-parsers (Senate + House) + Promise.all dispatch + atomic flat-stub deletion + orchestrator update.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler resolution. `cheerio` for HTML parsing (workspace dep since slice 9). `pg.Client` for DB queries. `vitest` + jsdom for tests with HTML fixtures committed to repo.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-ny-fds-fl-offices-design.md` (slice 17 spec)
- `docs/superpowers/plans/2026-05-24-ca-mi-tx-parsers.md` (slice 16 plan — patterns reused for FL subfolder)
- Slice 15+16 memory lessons (`project_chiaro_slice15_ny_parsers.md` + `project_chiaro_slice16_ca_mi_tx_parsers.md`)

**Key spec corrections (discovered during file exploration):**

- **`NormalizedFinancialDisclosure` shape is LINE-ITEM-oriented**, not filing-array-oriented as the spec assumed. Actual:
  ```ts
  export interface NormalizedFinancialDisclosure {
    official_openstates_person_id: string
    filing_year: number
    filing_date?: string
    income_source?: string
    income_kind?: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
    amount_range_low?: number
    amount_range_high?: number
    state: string
    source_url: string
    source: string
    external_id?: string
  }
  ```

- **Index-only v1 emits 1 placeholder row per filing** with `income_source`/`income_kind`/`amount_range_*` left undefined. external_id = `filing-{NY_filing_id}`. UI treats null income fields as "data not yet parsed". Future PDF parser emits additional rows with `external_id = filing-{NY_filing_id}-{line_no}` per line item; the placeholder row stays (different external_id, no UPSERT conflict).

- **The schema's UPSERT key is `(source, external_id) WHERE external_id IS NOT NULL`** — so deterministic external_id matters. Use the filing ID NY exposes in the Download link URL or page metadata.

**Mid-slice broken-state avoidance** (slice 15+16 lesson 9): FL Senate (Task 2) creates the subfolder skeleton WITHOUT touching the flat stub. FL House (Task 3) adds the index.ts AND deletes the flat stub AND updates the orchestrator in a SINGLE commit — never leaving the orchestrator broken.

---

## File Structure

### Created files (9)
```
packages/db/supabase/seed/state-community/district-offices/fl-doe/
  index.ts
  senate.ts
  senate.test.ts
  house.ts
  house.test.ts
  index.test.ts
packages/db/supabase/seed/fixtures/state-ethics/
  ny-fds-index.html
packages/db/supabase/seed/fixtures/state-community/
  fl-senator-detail.html
  fl-rep-detail.html
```

### Modified files (3)
```
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts          # replace stub with production parser
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts     # replace stub tests
packages/db/supabase/seed/state-community-ingest.ts                     # line 21 import path
CLAUDE.md                                                                # slice 17 entry
```

### Deleted files (2)
```
packages/db/supabase/seed/state-community/district-offices/fl-doe.ts
packages/db/supabase/seed/state-community/district-offices/fl-doe.test.ts
```

**Total touched: ~15 files** (slightly smaller than slice 16 due to no helper hoist).

---

## Task 1: NY FDS index parser

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-ethics/ny-fds-index.html`
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts` (replace stub)
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts` (replace stub tests)

NY FDS is a direct single-file stub replacement (no subfolder needed — single-source HTML index).

- [ ] **Step 1: Write the HTML fixture**

Create `packages/db/supabase/seed/fixtures/state-ethics/ny-fds-index.html`:

```html
<!--
  Fixture: NY ethics.ny.gov financial-disclosure-statements-elected-officials index page.
  Source: https://ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024
  Audit (2026-05-24): 2,804 results with year filter, office-type filter, pagination,
  per-record PDF Download links. Pruned to 6 rows covering:
    - 2 NYS Assembly Members → state_house
    - 2 NYS Senators → state_senate
    - 1 row with unknown office (skipped)
    - 1 row with unresolved legislator (logged to errors)
  Last row has class "next-page" link to simulate pagination.
-->
<div class="fds-index">
  <table class="filings-table">
    <thead>
      <tr><th>Name</th><th>Office</th><th>Year</th><th>Filed</th><th>PDF</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Jane Doe</td>
        <td>NYS Assembly Member</td>
        <td>2024</td>
        <td>2024-05-15</td>
        <td><a href="/files/fds/2024/AM-12345.pdf" data-filing-id="AM-12345">Download</a></td>
      </tr>
      <tr>
        <td>Alex Smith</td>
        <td>NYS Senator</td>
        <td>2024</td>
        <td>2024-05-20</td>
        <td><a href="/files/fds/2024/SEN-67890.pdf" data-filing-id="SEN-67890">Download</a></td>
      </tr>
      <tr>
        <td>Maria Chen</td>
        <td>NYS Assembly Member</td>
        <td>2024</td>
        <td>2024-06-01</td>
        <td><a href="/files/fds/2024/AM-23456.pdf" data-filing-id="AM-23456">Download</a></td>
      </tr>
      <tr>
        <td>Bob Jones</td>
        <td>NYS Senator</td>
        <td>2024</td>
        <td>2024-06-10</td>
        <td><a href="/files/fds/2024/SEN-78901.pdf" data-filing-id="SEN-78901">Download</a></td>
      </tr>
      <tr>
        <td>Pat Mystery</td>
        <td>NYS Lieutenant Governor</td>
        <td>2024</td>
        <td>2024-07-01</td>
        <td><a href="/files/fds/2024/LG-99999.pdf" data-filing-id="LG-99999">Download</a></td>
      </tr>
      <tr>
        <td>Unknown Stranger</td>
        <td>NYS Assembly Member</td>
        <td>2024</td>
        <td>2024-07-15</td>
        <td><a href="/files/fds/2024/AM-88888.pdf" data-filing-id="AM-88888">Download</a></td>
      </tr>
    </tbody>
  </table>
  <nav class="pagination">
    <a class="next-page" href="/financial-disclosure-statements-elected-officials?year=2024&page=2">Next page</a>
  </nav>
</div>
```

- [ ] **Step 2: Write the failing test**

Replace `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts` entire contents with:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseNyFdsIndexHtml,
  inferChamberFromOfficeText,
  nyJcopeDisclosures,
  fetchAllPages,
} from './ny-jcope.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ny-fds-index.html')

describe('parseNyFdsIndexHtml', () => {
  it('extracts 6 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows, nextPageHref } = parseNyFdsIndexHtml(html)
    expect(rows).toHaveLength(6)
  })

  it('captures filing_id from data-filing-id attribute', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows } = parseNyFdsIndexHtml(html)
    expect(rows[0]!.filing_id).toBe('AM-12345')
  })

  it('captures absolute PDF source URL', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows } = parseNyFdsIndexHtml(html)
    expect(rows[0]!.source_url).toBe('https://ethics.ny.gov/files/fds/2024/AM-12345.pdf')
  })

  it('extracts next-page href when present', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { nextPageHref } = parseNyFdsIndexHtml(html)
    expect(nextPageHref).toBe('https://ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024&page=2')
  })

  it('returns null nextPageHref when missing', () => {
    const { nextPageHref } = parseNyFdsIndexHtml('<div><table class="filings-table"><tbody></tbody></table></div>')
    expect(nextPageHref).toBeNull()
  })
})

describe('inferChamberFromOfficeText', () => {
  it('matches "NYS Assembly Member" → state_house', () => {
    expect(inferChamberFromOfficeText('NYS Assembly Member')).toBe('state_house')
  })
  it('matches "NYS Senator" → state_senate', () => {
    expect(inferChamberFromOfficeText('NYS Senator')).toBe('state_senate')
  })
  it('matches "Member of Assembly" → state_house', () => {
    expect(inferChamberFromOfficeText('Member of Assembly')).toBe('state_house')
  })
  it('returns null for non-legislator office text', () => {
    expect(inferChamberFromOfficeText('NYS Lieutenant Governor')).toBeNull()
  })
})

describe('fetchAllPages', () => {
  it('walks pagination until next-page link absent', async () => {
    const html1 = `<div class="fds-index">
      <table class="filings-table"><tbody>
        <tr><td>Jane Doe</td><td>NYS Assembly Member</td><td>2024</td><td>2024-05-15</td>
        <td><a href="/files/fds/2024/A-1.pdf" data-filing-id="A-1">Download</a></td></tr>
      </tbody></table>
      <nav class="pagination"><a class="next-page" href="/page2">Next</a></nav>
    </div>`
    const html2 = `<div class="fds-index">
      <table class="filings-table"><tbody>
        <tr><td>Alex Smith</td><td>NYS Senator</td><td>2024</td><td>2024-05-20</td>
        <td><a href="/files/fds/2024/B-2.pdf" data-filing-id="B-2">Download</a></td></tr>
      </tbody></table>
    </div>`
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return calls === 1 ? html1 : html2
    }
    const allRows = await fetchAllPages('https://ethics.ny.gov/start', fetcher)
    expect(allRows).toHaveLength(2)
    expect(calls).toBe(2)
  })

  it('respects page cap', async () => {
    // Every page yields a next-page link → infinite loop without cap.
    const html = `<div class="fds-index">
      <table class="filings-table"><tbody>
        <tr><td>Jane Doe</td><td>NYS Assembly Member</td><td>2024</td><td>2024-05-15</td>
        <td><a href="/files/fds/2024/A-1.pdf" data-filing-id="A-1">Download</a></td></tr>
      </tbody></table>
      <nav class="pagination"><a class="next-page" href="/next">Next</a></nav>
    </div>`
    const allRows = await fetchAllPages('https://ethics.ny.gov/start', async () => html, { maxPages: 3 })
    expect(allRows).toHaveLength(3)  // 3 pages × 1 row each = capped at 3
  })
})

describe('nyJcopeDisclosures adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nyJcopeDisclosures.slug).toBe('ny-jcope')
    expect(nyJcopeDisclosures.component).toBe('disclosures')
    expect(nyJcopeDisclosures.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{
      official_openstates_person_id: 'x',
      filing_year: 2024,
      state: 'NY',
      source_url: 'u',
      source: 'ny-jcope',
    }]
    const result = await nyJcopeDisclosures.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('emits NormalizedFinancialDisclosure[] per resolvable filing; skips non-legislator + unresolved', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({
          rows: [{ openstates_person_id: `ocd-person/ny-${Math.random().toString(36).slice(2, 6)}` }],
          rowCount: 1,
        })
      }),
    }
    // Stub second fetch (page 2) to return empty body to terminate pagination.
    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      fetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never)
    // 6 fixture rows: 2 Assembly + 2 Senate resolve = 4; Pat Mystery (Lt Gov) chamber null → skip; Unknown Stranger unresolved → skip.
    // Expect 4 rows emitted.
    expect(result).toHaveLength(4)
  })

  it('production-path fetch leak protected via vi.spyOn', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await nyJcopeDisclosures.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })

  it('external_id derived from filing_id with filing- prefix', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      fetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string }>
    expect(result[0]!.external_id).toBe('filing-AM-12345')
  })

  it('placeholder rows leave income fields undefined (PDF parser fills later)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      fetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ income_source?: string; income_kind?: string; amount_range_low?: number }>
    expect(result[0]!.income_source).toBeUndefined()
    expect(result[0]!.income_kind).toBeUndefined()
    expect(result[0]!.amount_range_low).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ny-jcope
```
Expected: FAIL — `parseNyFdsIndexHtml is not a function` (or similar).

- [ ] **Step 4: Implement ny-jcope.ts**

Replace `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts` entire contents:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'

const SOURCE_URL = 'https://ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024'
const FETCH_TIMEOUT_MS = 5000
const MAX_PAGES_DEFAULT = 50
const RATE_LIMIT_MS = 1000
const ORIGIN = 'https://ethics.ny.gov'

export interface ParsedNyFdsRow {
  full_name: string
  office_text: string
  filing_year: number
  filing_date: string
  filing_id: string
  source_url: string
}

export interface ParsedNyFdsPage {
  rows: ParsedNyFdsRow[]
  nextPageHref: string | null
}

/**
 * Parse one page of the ny ethics.ny.gov FDS index.
 *
 * Audit-derived structure (2026-05-24): <table class="filings-table"> with
 * thead/tbody; each row has Name, Office, Year, Filed, PDF (anchor with
 * data-filing-id + Download text). Pagination via <nav class="pagination">
 * containing <a class="next-page" href="...">.
 *
 * Implementer should fetch a real URL during scaffold to verify selectors.
 */
export function parseNyFdsIndexHtml(html: string): ParsedNyFdsPage {
  const $ = cheerio.load(html)
  const rows: ParsedNyFdsRow[] = []

  $('table.filings-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 5) return

    const full_name = $(cells[0]).text().trim()
    const office_text = $(cells[1]).text().trim()
    const yearText = $(cells[2]).text().trim()
    const filing_year = Number.parseInt(yearText, 10)
    const filing_date = $(cells[3]).text().trim()

    const anchor = $(cells[4]).find('a').first()
    const filing_id = anchor.attr('data-filing-id') ?? ''
    const href = anchor.attr('href') ?? ''
    const source_url = href.startsWith('http') ? href : `${ORIGIN}${href}`

    if (!full_name || !office_text || !filing_id || !Number.isFinite(filing_year)) return

    rows.push({ full_name, office_text, filing_year, filing_date, filing_id, source_url })
  })

  const nextHref = $('nav.pagination a.next-page').attr('href') ?? null
  const nextPageHref = nextHref
    ? (nextHref.startsWith('http') ? nextHref : `${ORIGIN}${nextHref}`)
    : null

  return { rows, nextPageHref }
}

/**
 * Infer chamber from NY office-type text.
 *
 * Audit variants:
 *   - "NYS Assembly Member" → state_house
 *   - "Member of Assembly" → state_house
 *   - "NYS Senator" → state_senate
 *   - other (LG, Comptroller, AG) → null (skip)
 */
export function inferChamberFromOfficeText(text: string): 'state_house' | 'state_senate' | null {
  if (/\bAssembly\b/i.test(text)) return 'state_house'
  if (/\bSenator\b|\bSenate\b/i.test(text)) return 'state_senate'
  return null
}

/**
 * Walk pagination starting from `startUrl`, fetching each page until either
 * the next-page link is absent OR the page cap is reached.
 *
 * Default cap = 50 pages (audit-derived sensible bound for 2,804 records
 * at ~25/page). Operator can override via opts.maxPages.
 */
export async function fetchAllPages(
  startUrl: string,
  fetcher: (url: string) => Promise<string>,
  opts: { maxPages?: number } = {},
): Promise<ParsedNyFdsRow[]> {
  const maxPages = opts.maxPages ?? MAX_PAGES_DEFAULT
  const allRows: ParsedNyFdsRow[] = []
  let url: string | null = startUrl

  for (let i = 0; i < maxPages && url; i += 1) {
    let html: string
    try {
      html = await fetcher(url)
    } catch {
      break  // network failure → stop pagination, return what we have
    }
    const { rows, nextPageHref } = parseNyFdsIndexHtml(html)
    allRows.push(...rows)
    url = nextPageHref
  }

  return allRows
}

export const nyJcopeDisclosures: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'disclosures',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedFinancialDisclosure[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (injected) return injected()

    const pageFetcher = (opts as never as { fetcher?: (url: string) => Promise<string> }).fetcher
    const fetcher: (url: string) => Promise<string> = pageFetcher
      ?? (async (url: string) => {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
        return res.text()
      })

    let parsedRows: ParsedNyFdsRow[]
    try {
      parsedRows = await fetchAllPages(SOURCE_URL, fetcher)
    } catch {
      return []
    }

    const out: NormalizedFinancialDisclosure[] = []
    const client = (opts as { client: Client }).client

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
        // income_source / income_kind / amount_range_* left undefined.
        // v1 ships index-metadata-only; PDF parser slice fills line items
        // with separate external_ids (filing-{id}-{lineNo}).
        state: 'NY',
        source_url: row.source_url,
        source: 'ny-jcope',
        external_id: `filing-${row.filing_id}`,
      })
    }

    return out
  },
}
```

Note: the injected `fetcher` is overloaded between two distinct signatures across slice 15/16/17:
- `() => Promise<NormalizedXxx[]>` — fixture-injection for adapter-level tests (short-circuits production logic)
- `(url: string) => Promise<string>` — page-level injection for parser-level tests

Both are checked at runtime via the cast. The first check wins (top-of-function); the second flows through to `fetchAllPages`.

- [ ] **Step 5: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ny-jcope
```
Expected: ~18 tests PASS (5 parser + 4 chamber + 2 fetchAllPages + 6 adapter = 17; if test count differs by 1-2 due to vitest grouping, that's expected — verify `it()` block count matches).

- [ ] **Step 6: Run full @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~623 tests PASS (605 + ~18).

- [ ] **Step 7: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts \
        packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts \
        packages/db/supabase/seed/fixtures/state-ethics/ny-fds-index.html
git commit -m "$(cat <<'EOF'
feat(state-ethics): NY FDS index parser (index-metadata-only v1)

Replace slice 5I stub with production HTML-scrape against
ethics.ny.gov/financial-disclosure-statements-elected-officials
filtered to current cycle (?year=2024). Paginates via next-page
link with 50-page safety cap.

- parseNyFdsIndexHtml: extracts {full_name, office_text, filing_year,
  filing_date, filing_id, source_url} from filings-table rows.
  Filing ID from data-filing-id attribute; source_url is absolute
  PDF Download link.
- inferChamberFromOfficeText: maps "NYS Assembly Member"/
  "Member of Assembly" → state_house; "NYS Senator"/"NYS Senate"
  → state_senate; other (LG, Comptroller, AG) → null (skip).
- fetchAllPages: walks pagination until next-page link absent or
  cap reached. Network failures terminate pagination gracefully.
- nyJcopeDisclosures adapter: resolves each filing to
  openstates_person_id, emits 1 placeholder NormalizedFinancialDisclosure
  per filing with income fields left undefined. PDF parser slice
  later adds line-item rows with filing-{id}-{lineNo} external_ids.
- 17 vitest cases.

Slug stays `ny-jcope` (back-compat with slice 5I stub; COELIG
renamed in 2022 but row continuity matters). Distinct from slice
15 ny-coelig/ directory which handles enforcement-actions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: FL Senate per-senator parser (subfolder skeleton)

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/fl-senator-detail.html`
- Create: `packages/db/supabase/seed/state-community/district-offices/fl-doe/senate.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/fl-doe/senate.test.ts`

Task 2 creates the subfolder skeleton WITHOUT deleting the flat stub. Task 3 wires the subfolder + deletes the flat stub + updates the orchestrator in one atomic commit (slice 16 mid-slice-broken-state avoidance).

- [ ] **Step 1: Write the FL senator detail-page fixture**

Create `packages/db/supabase/seed/fixtures/state-community/fl-senator-detail.html`:

```html
<!--
  Fixture: FL Senate senator detail page.
  Source: https://flsenate.gov/Senators/s{district} (e.g. /Senators/s14)
  Audit (2026-05-24): index page links to per-senator detail; detail
  page has address(es). Pruned to 1 senator with both Capitol + district.
-->
<div class="senator-detail">
  <h1>Senator Jane Doe</h1>
  <span class="district">District 14</span>
  <section class="capitol-office">
    <h2>Tallahassee Office</h2>
    <p>404 South Monroe Street, Tallahassee, FL 32399 · Phone: (850) 487-5014</p>
  </section>
  <section class="district-office">
    <h2>District Office</h2>
    <p>500 Bayshore Drive, Miami, FL 33133 · Phone: (305) 555-1234</p>
  </section>
</div>
```

- [ ] **Step 2: Write the failing test**

Create `packages/db/supabase/seed/state-community/district-offices/fl-doe/senate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlSenatorDetailHtml, fetchFlSenateOffices, deriveFlSenatorUrl } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'fl-senator-detail.html')

describe('parseFlSenatorDetailHtml', () => {
  it('extracts both Tallahassee + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseFlSenatorDetailHtml(html)
    expect(parsed.capitol_office).toContain('404 South Monroe')
    expect(parsed.capitol_office).toContain('Tallahassee')
    expect(parsed.district_office).toContain('Bayshore Drive')
    expect(parsed.district_office).toContain('Miami')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseFlSenatorDetailHtml('<div>no sections</div>')
    expect(parsed.capitol_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveFlSenatorUrl', () => {
  it('builds URL with s{district} pattern', () => {
    expect(deriveFlSenatorUrl(14)).toBe('https://www.flsenate.gov/Senators/s14')
  })

  it('handles single-digit districts', () => {
    expect(deriveFlSenatorUrl(3)).toBe('https://www.flsenate.gov/Senators/s3')
  })
})

describe('fetchFlSenateOffices', () => {
  it('iterates FL senators from officials table + parses each detail page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-s1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-s2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchFlSenateOffices(client as never, { fetcher: async () => html })
    // 2 senators × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no FL senators in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchFlSenateOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips senator when district_id is missing or unparseable', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-s1', full_name: 'Jane Doe', district_id: null },
              { openstates_person_id: 'ocd-person/fl-s2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchFlSenateOffices(client as never, { fetcher: async () => html })
    expect(rows).toHaveLength(2)  // Only Alex resolves
  })

  it('skips senator on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-s1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-s2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchFlSenateOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // First errors, second succeeds → 2 rows
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/fl-doe/senate
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement senate.ts**

Create `packages/db/supabase/seed/state-community/district-offices/fl-doe/senate.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedFlSenatorDetail {
  capitol_office?: string
  district_office?: string
}

/**
 * Derive FL Senator detail-page URL from district number.
 *
 * Per slice 12 audit: flsenate.gov/Senators/s{district}.
 * Implementer should verify against 2-3 real URLs during scaffold.
 */
export function deriveFlSenatorUrl(district_number: number): string {
  return `https://www.flsenate.gov/Senators/s${district_number}`
}

/**
 * Parse a single FL Senator detail page.
 *
 * Audit-derived structure: <section class="capitol-office"> and
 * <section class="district-office"> with <p>-wrapped address text.
 * Mirrors slice 16 ca-leginfo + mi-legislature parser shape.
 */
export function parseFlSenatorDetailHtml(html: string): ParsedFlSenatorDetail {
  const $ = cheerio.load(html)
  const out: ParsedFlSenatorDetail = {}

  const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
  if (capitolText) out.capitol_office = capitolText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchFlSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string; district_id: string | null }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = 'state_senate' and state = 'FL' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const senator of res.rows) {
    if (!senator.district_id) continue
    const districtMatch = senator.district_id.match(/^FL-(\d+)$/)
    if (!districtMatch) continue
    const district_number = Number.parseInt(districtMatch[1]!, 10)
    if (!Number.isFinite(district_number)) continue

    const url = deriveFlSenatorUrl(district_number)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseFlSenatorDetailHtml(html)

    if (parsed.capitol_office) {
      const parts = parseAddressText(parsed.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: senator.openstates_person_id,
          kind: 'capitol',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }
    if (parsed.district_office) {
      const parts = parseAddressText(parsed.district_office)
      if (parts) {
        out.push({
          official_openstates_person_id: senator.openstates_person_id,
          kind: 'district',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }

    if (!opts.fetcher) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
```

- [ ] **Step 5: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/fl-doe/senate
```
Expected: 8 tests PASS (2 parser + 2 deriveUrl + 4 fetcher).

- [ ] **Step 6: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS. Flat `fl-doe.ts` stub still exists; orchestrator still works.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-community/district-offices/fl-doe/senate.ts \
        packages/db/supabase/seed/state-community/district-offices/fl-doe/senate.test.ts \
        packages/db/supabase/seed/fixtures/state-community/fl-senator-detail.html
git commit -m "$(cat <<'EOF'
feat(state-community): FL district_offices Senate per-senator parser (subfolder skeleton)

First sub-parser of the new fl-doe/ subfolder replacing the slice
5H stub. Per-senator fetch loop against flsenate.gov/Senators/s{n}
(40 senators at 1-req/sec courtesy throttle).

- parseFlSenatorDetailHtml: extracts Tallahassee + District address
  blocks from section-based HTML (mirroring slice 16 ca-leginfo +
  mi-legislature parsers).
- deriveFlSenatorUrl: builds URL via flsenate.gov/Senators/s{district}.
- fetchFlSenateOffices: queries officials for FL state-senate, parses
  district_id matching ^FL-(\d+)$, iterates with 1-req/sec throttle,
  parses each profile, emits 1-2 NormalizedDistrictOffice rows per
  resolved senator. Per-senator fetch failures silently skip.
- 8 vitest cases.

Flat fl-doe.ts stub kept untouched; Task 3 wires the subfolder +
deletes the flat stub + updates the orchestrator in a single commit
(avoids slice 15 broken-state trap).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: FL House per-rep loop + index dispatch + flat-stub deletion + orchestrator update

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/fl-rep-detail.html`
- Create: `packages/db/supabase/seed/state-community/district-offices/fl-doe/house.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/fl-doe/house.test.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/fl-doe/index.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/fl-doe/index.test.ts`
- Modify: `packages/db/supabase/seed/state-community-ingest.ts` (line 21 import path)
- Delete: `packages/db/supabase/seed/state-community/district-offices/fl-doe.ts`
- Delete: `packages/db/supabase/seed/state-community/district-offices/fl-doe.test.ts`

All in one commit per slice 16 mid-slice-broken-state avoidance.

- [ ] **Step 1: Write the FL rep detail-page fixture**

Create `packages/db/supabase/seed/fixtures/state-community/fl-rep-detail.html`:

```html
<!--
  Fixture: FL House representative detail page.
  Source: https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}
  Audit (2026-05-24): index page maps district to MemberId; detail page
  has address(es). MemberId may NOT equal district number — verify at
  scaffold time. Pruned to 1 rep with both Capitol + district.
-->
<div class="rep-detail">
  <h1>Representative Jane Doe</h1>
  <span class="district">District 14</span>
  <section class="capitol-office">
    <h2>Tallahassee Office</h2>
    <p>1102 The Capitol, 402 South Monroe Street, Tallahassee, FL 32399 · Phone: (850) 717-5014</p>
  </section>
  <section class="district-office">
    <h2>District Office</h2>
    <p>100 Beach Drive NE, Suite 200, St. Petersburg, FL 33701 · Phone: (727) 555-1234</p>
  </section>
</div>
```

- [ ] **Step 2: Write the failing tests (house.test.ts + index.test.ts)**

Create `packages/db/supabase/seed/state-community/district-offices/fl-doe/house.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlRepDetailHtml, fetchFlHouseOffices, deriveFlRepUrl } from './house.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'fl-rep-detail.html')

describe('parseFlRepDetailHtml', () => {
  it('extracts both Tallahassee + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseFlRepDetailHtml(html)
    expect(parsed.capitol_office).toContain('1102 The Capitol')
    expect(parsed.capitol_office).toContain('Tallahassee')
    expect(parsed.district_office).toContain('Beach Drive')
    expect(parsed.district_office).toContain('St. Petersburg')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseFlRepDetailHtml('<div>no sections</div>')
    expect(parsed.capitol_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveFlRepUrl', () => {
  it('builds URL with MemberId query param', () => {
    expect(deriveFlRepUrl(4814)).toBe('https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId=4814')
  })

  it('handles single-digit MemberIds', () => {
    expect(deriveFlRepUrl(3)).toBe('https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId=3')
  })
})

describe('fetchFlHouseOffices', () => {
  it('iterates FL reps + parses each detail page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-h1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-h2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchFlHouseOffices(client as never, { fetcher: async () => html })
    expect(rows).toHaveLength(4)
  })

  it('silently skips rep on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-h1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-h2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchFlHouseOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // First errors, second succeeds → 2 rows
  })
})
```

Create `packages/db/supabase/seed/state-community/district-offices/fl-doe/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { flDoeOffices } from './index.ts'

describe('flDoeOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(flDoeOffices.slug).toBe('fl-doe')
    expect(flDoeOffices.component).toBe('offices')
    expect(flDoeOffices.covered_states).toEqual(['FL'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', kind: 'capitol', street_1: 's', city: 'c', state: 'FL', source_url: 'u' }]
    const result = await flDoeOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Senate + House fetch results in production path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await flDoeOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run tests to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/fl-doe
```
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement house.ts**

Create `packages/db/supabase/seed/state-community/district-offices/fl-doe/house.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedFlRepDetail {
  capitol_office?: string
  district_office?: string
}

/**
 * Derive FL House Rep detail-page URL from MemberId.
 *
 * Per slice 12 audit: flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}.
 * MemberId may NOT equal district number — implementer verifies at scaffold time.
 * If MemberId is opaque per district, fetch the index page first to extract
 * district → MemberId mapping (deferred to slice 18 if needed).
 *
 * v1: assume MemberId == district number. Production drift surfaces via
 * 0 parsed rows per rep (silent skip on 404 / unmatched selector).
 */
export function deriveFlRepUrl(member_id: number): string {
  return `https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId=${member_id}`
}

export function parseFlRepDetailHtml(html: string): ParsedFlRepDetail {
  const $ = cheerio.load(html)
  const out: ParsedFlRepDetail = {}

  const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
  if (capitolText) out.capitol_office = capitolText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchFlHouseOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string; district_id: string | null }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = 'state_house' and state = 'FL' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const rep of res.rows) {
    if (!rep.district_id) continue
    const districtMatch = rep.district_id.match(/^FL-(\d+)$/)
    if (!districtMatch) continue
    const member_id = Number.parseInt(districtMatch[1]!, 10)
    if (!Number.isFinite(member_id)) continue

    const url = deriveFlRepUrl(member_id)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseFlRepDetailHtml(html)

    if (parsed.capitol_office) {
      const parts = parseAddressText(parsed.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: rep.openstates_person_id,
          kind: 'capitol',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }
    if (parsed.district_office) {
      const parts = parseAddressText(parsed.district_office)
      if (parts) {
        out.push({
          official_openstates_person_id: rep.openstates_person_id,
          kind: 'district',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }

    if (!opts.fetcher) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
```

- [ ] **Step 5: Implement index.ts**

Create `packages/db/supabase/seed/state-community/district-offices/fl-doe/index.ts`:

```ts
import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchFlSenateOffices } from './senate.ts'
import { fetchFlHouseOffices } from './house.ts'

/**
 * FL state-legislator district offices, combining Senate
 * (flsenate.gov/Senators/s{n} per-senator) and House
 * (flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}
 * per-rep).
 *
 * Slug `fl-doe` is the slice 5H stub legacy name (despite the actual
 * source URLs being flsenate.gov + flhouse.gov, not floridadoe.gov).
 * Kept for back-compat with state_community_orgs row continuity.
 */
export const flDoeOffices: StateCommunityAdapter = {
  slug: 'fl-doe',
  component: 'offices',
  covered_states: ['FL'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (injected) return injected()

    const [senate, house] = await Promise.all([
      fetchFlSenateOffices(opts.client, {}),
      fetchFlHouseOffices(opts.client, {}),
    ])
    return [...senate, ...house]
  },
}
```

- [ ] **Step 6: Run tests scoped to fl-doe to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/fl-doe
```
Expected: ~14 tests PASS (8 senate + 5 house + 3 index — total may be 14 if test groupings collapse, recount based on actual `it()` blocks).

- [ ] **Step 7: Update orchestrator + delete flat stub**

Use Edit tool to update `packages/db/supabase/seed/state-community-ingest.ts` line 21:
```diff
-import { flDoeOffices }           from './state-community/district-offices/fl-doe.ts'
+import { flDoeOffices }           from './state-community/district-offices/fl-doe/index.ts'
```

Delete flat stub via Bash:
```bash
rm packages/db/supabase/seed/state-community/district-offices/fl-doe.ts \
   packages/db/supabase/seed/state-community/district-offices/fl-doe.test.ts
```

- [ ] **Step 8: Run FULL @chiaro/db test suite (catches orchestrator regression)**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~640 tests PASS. Catches the orchestrator import regression per slice 15 Lesson 11.

- [ ] **Step 9: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-community/district-offices/fl-doe \
        packages/db/supabase/seed/fixtures/state-community/fl-rep-detail.html \
        packages/db/supabase/seed/state-community-ingest.ts
git rm packages/db/supabase/seed/state-community/district-offices/fl-doe.ts \
       packages/db/supabase/seed/state-community/district-offices/fl-doe.test.ts
git commit -m "$(cat <<'EOF'
feat(state-community): FL district_offices House per-rep loop + dispatch

Complete the FL district_offices subfolder with House per-rep fetch
loop + adapter dispatch. Replaces flat fl-doe.ts slice 5H stub and
wires the subfolder into the orchestrator.

- house.ts: parseFlRepDetailHtml + deriveFlRepUrl + fetchFlHouseOffices.
  Queries officials for FL state-house legislators (120 reps),
  iterates with 1-req/sec courtesy throttle. v1 assumes MemberId
  equals district number; if production drift surfaces (0 parsed
  rows), slice 18 adds the index-page → MemberId mapping step.
- index.ts: adapter export concatenating Senate + House via
  Promise.all. Slug stays `fl-doe` (back-compat with slice 5H stub
  even though FL House + Senate aren't the Dept of Elections).
- state-community-ingest.ts: import path updated to subfolder index.
  Flat fl-doe.ts + test deleted in same commit (slice 16 atomic
  pattern).
- 5 vitest cases (3 house + 3 index dispatch + the 8 senate from
  Task 2 = ~16 total in fl-doe/).
- Production fetch volume: 40 (Senate) + 120 (House) = 160 GETs
  per orchestrator run; ~160s runtime at 1-req/sec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Closure — CLAUDE.md slice 17 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 17 entry; no new Gotcha)
- Create (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice17_ny_fds_fl_offices.md`
- Modify (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`

- [ ] **Step 1: Append slice 17 entry to CLAUDE.md**

Read `CLAUDE.md`. Find `## Slices delivered` + the slice 16 entry. Append IMMEDIATELY AFTER:

```markdown
- **Slice 17 — NY FDS + FL district_offices** (2026-05-25): Two production parsers continuing slice 15/16 HTML-scrape patterns, closing 2 of 4 deferred audit candidates. (1) **NY FDS index parser** (`state-ethics/disclosures/ny-jcope.ts` direct stub replacement): scrapes `ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024` with pagination (50-page safety cap) and chamber inference from office-text ("NYS Assembly Member" → state_house, "NYS Senator" → state_senate). Emits 1 placeholder `NormalizedFinancialDisclosure` per filing (income fields left undefined; PDF parser slice fills line items later). external_id = `filing-{NY_filing_id}`. ~30-50 page fetches over ~30-50s at 1-req/sec. (2) **FL district_offices** (`fl-doe/` subfolder): Senate (40) + House (120) per-member fetch loops mirroring slice 16 ca-leginfo + mi-legislature. URL patterns audit-derived (`flsenate.gov/Senators/s{n}` + `flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}`); v1 assumes MemberId = district number, falls back to index-driven 2-step crawl if production drift surfaces. Slugs stay legacy (`ny-jcope`, `fl-doe`) for back-compat. Slice 16 mid-slice-broken-state avoidance pattern reused: Task 3 bundles flat-stub deletion + orchestrator update + subfolder index.ts in one commit. ~15 files; no schema work; pgTAP unchanged at 402 plans. State stub count: 3 more adapters → production.
```

No new Gotcha. Slice 15/16 patterns covered by existing Gotchas + slice 15/16 memory lessons.

- [ ] **Step 2: Write memory file**

Use Write tool to create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice17_ny_fds_fl_offices.md`:

```markdown
---
name: project-chiaro-slice17-ny-fds-fl-offices
description: Slice 17 — NY FDS index + FL district_offices; extends slice 15/16 HTML-scrape patterns to financial_disclosures + FL state
metadata:
  type: project
---

Slice 17 shipped 2026-05-25 — merged locally to master as squash `<squash SHA>`. Feature branch `slice-17-ny-fds-fl-offices` deleted post-merge.

**Scope:** Two production parsers continuing the slice 15/16 HTML-scrape patterns. Closes 2 of 4 deferred audit candidates (NY FDS #7 + FL district_offices #9). PDF-bound candidates (MI PFD + CA FPPC Form 700) deferred to a dedicated PDF-parsing slice.

**What shipped:**
- NY FDS index parser: HTML-scrape of ethics.ny.gov FDS index with pagination + chamber inference + placeholder-row emission.
- FL district_offices subfolder (`fl-doe/`): Senate + House per-member fetch loops + Promise.all dispatch.
- 3 HTML fixtures committed.
- Orchestrator `state-community-ingest.ts` updated to point at new subfolder index.

**Durable lessons:**

1. **Spec exploration MUST verify Normalized* shapes (lesson reaffirmed from slice 15).** Slice 17 spec assumed `NormalizedFinancialDisclosure` had `extracted_assets[]`/`extracted_income[]` arrays. Actual shape is LINE-ITEM-oriented (one row per income source). Plan adapted: v1 emits 1 placeholder row per filing with income fields undefined; PDF parser later adds line-item rows with different external_ids. Failure mode if missed: parser would emit invalid rows that fail DB UPSERT. Caught at file-exploration step. Future plan-writers: always read the actual Normalized* interface BEFORE drafting parser code.

2. **Placeholder-row pattern for deferred-data ingest.** When a parser ingests metadata-only (e.g. "this filing exists, here's the PDF link") and downstream parsing fills detail fields later, emit a single "placeholder" row with detail fields undefined + a stable external_id (e.g. `filing-{id}`). The downstream parser emits additional rows with augmented external_ids (e.g. `filing-{id}-{lineNo}`). The placeholder coexists with line items — UI surfaces both. Avoid UPSERT conflict by ensuring distinct external_ids per row.

3. **Pagination cap as safety bound for unbounded HTML walks.** When scraping a paginated HTML index, never trust the "next page" link to terminate. Always cap at a sensible maximum (50 pages for NY FDS at 25/page = 1,250 records, covers current cycle). If cap is hit, log to `errors[]` so operator can investigate. Pattern: `fetchAllPages(url, fetcher, { maxPages: 50 })`.

4. **Network failures terminate pagination gracefully.** `fetchAllPages` uses try/catch around each fetch; on rejection, breaks loop and returns rows accumulated so far. Partial ingest > no ingest.

5. **Dual-fetcher-signature pattern across slice 15/16/17.** Adapters accept TWO injection points for tests:
   - Adapter-level: `fetcher?: () => Promise<NormalizedXxx[]>` — short-circuits production logic
   - Page-level: `fetcher?: (url: string) => Promise<string>` — exercises parser logic
   Both checked at runtime via cast. First check wins (adapter-level top-of-function); second flows through to internal helpers. Pattern emerged in slice 15 ny-coelig + slice 16 ca-leginfo; slice 17 reuses verbatim for ny-jcope + fl-doe.

6. **Office-text chamber inference replaces full_name-only matching.** When the source HTML has structured office text (e.g. "NYS Assembly Member" / "NYS Senator"), use that for chamber inference instead of trying to infer from full_name + state alone. Per-row reliability is higher. Pattern: `inferChamberFromOfficeText(text) → 'state_house' | 'state_senate' | null`.

7. **Slug-vs-source-URL drift continues (slice 15/16 pattern).** `fl-doe` slug (Department of Elections) doesn't match `flsenate.gov` + `flhouse.gov` actual source URLs. `ny-jcope` slug (legacy agency) doesn't match `ethics.ny.gov` (COELIG since 2022). JSDoc explains; back-compat preserved.

8. **MemberId-as-district fallback strategy.** When the source URL uses an opaque ID (e.g. FL House `MemberId`), v1 assumes it equals the district number. If production drift surfaces (0 parsed rows per rep across the board), slice 18 adds an "index-page-first" 2-step crawl to map district → MemberId. Defer until measurable.

9. **`resolveOpenstatesPersonId` chamber-required signature.** The shared helper requires `state` + `chamber` + `full_name`. Per-row chamber inference is mandatory before calling — slipping a wrong chamber silently matches the wrong legislator OR returns null. Slice 17 uses office-text inference (lesson 6).

10. **No new Gotcha needed for slice 17.** All patterns covered by slice 15+16 + Gotchas #15, #18, #20. CLAUDE.md slice entry alone is sufficient.

**Active follow-ups (operator):**

- Slice 18: PDF-parsing infrastructure (add `pdf-parse` workspace dep + shared text-extraction helper + MI PFD as first user). Unlocks NY FDS line-item parsing + CA FPPC Form 700 + TX TEC per-case orders.
- LCV-OR + PP × 5 browser-UA probe spike (slice 11 carryover).
- Mobile DoD on-device smoke.
- FL House MemberId-as-district verification: monitor `stats.errors[]` rate when parser runs against real FL House URLs. If >5% silent skips, add index-page mapping step.
- NY FDS pagination selector verification at production-fetch time. If 1-page-only ingest persists across runs, revisit `nav.pagination a.next-page` selector.
- NY FDS year-filter coupling: if NY changes URL param name (e.g. to `?filing_year=`), parser fails silently. Audit-derived URL flagged in JSDoc.

**Master state at slice 17 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans across 31 files (unchanged). 15 production parsers total (was 13 post-slice-16; +2 slice 17: NY FDS, FL district_offices). @chiaro/db test count: ~640 passing (605 + ~35 new). Audit deferred candidates: 4 → 2 (NY FDS + FL district_offices closed; MI PFD + CA FPPC remain — both PDF-bound).

**Cross-links:** [[project-chiaro-slice5h-community-presence]] [[project-chiaro-slice5i-ethics-accountability]] [[project-chiaro-slice12-stub-audit]] [[project-chiaro-slice15-ny-parsers]] [[project-chiaro-slice16-ca-mi-tx-parsers]]
```

- [ ] **Step 3: Update MEMORY.md index**

Read `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`. Find the slice 16 entry line. Add the slice 17 line IMMEDIATELY AFTER:

```markdown
- [Chiaro slice 17 NY FDS + FL parsers](project_chiaro_slice17_ny_fds_fl_offices.md) — 2 HTML-scrape parsers continuing slice 15/16 patterns (NY FDS index with pagination + FL district_offices subfolder); placeholder-row pattern for deferred PDF-parsing; NormalizedFinancialDisclosure is line-item-oriented (caught via spec exploration); pagination safety cap pattern
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/web build
```

Expected: all green.
- `pnpm -r typecheck` — 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` — ~640 tests pass (605 + ~35 new)
- `pnpm --filter @chiaro/web build` — 12 routes green

- [ ] **Step 5: Commit Task 4**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 17 closure — CLAUDE.md entry

Slice 17 ships 2 production parsers continuing slice 15/16 HTML-scrape
patterns: NY FDS index (placeholder-row v1; PDF parsing deferred) +
FL district_offices subfolder.

No new Gotcha -- slice 15/16 patterns covered by existing Gotchas.

@chiaro/db test count: +~35 cases.
Audit deferred candidates: 4 -> 2 closed.
pgTAP unchanged at 402 plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo working tree — written in Steps 2-3 but NOT git-added.)

---

## Workspace verify gate (recap)

After all 4 tasks complete:

```bash
pnpm -r typecheck                                                    # 11 packages green
pnpm --filter @chiaro/db exec vitest run                             # ~640 tests green
pnpm --filter @chiaro/web build                                      # 12 routes
git log master..HEAD --oneline                                       # 6 commits (spec + plan + 4 implementation)
```

Expected:
- 11 packages typecheck green
- NY FDS: ~17 tests PASS
- FL district_offices: ~16 tests PASS
- Slice 17 total: ~33-35 new vitest cases
- @chiaro/db full suite: 605 + ~35 = ~640 tests
- Web build: 12 routes green
- Branch: 6 commits (1 spec + 1 plan + 4 implementation)

---

## Self-review notes

### Spec coverage

- ✅ NY FDS index parser — Task 1
- ✅ NY FDS pagination with safety cap — Task 1 (fetchAllPages with maxPages)
- ✅ NY FDS office-text chamber inference — Task 1 (inferChamberFromOfficeText)
- ✅ NY FDS placeholder rows (income fields undefined) — Task 1 implementation comment
- ✅ FL Senate per-senator parser — Task 2
- ✅ FL House per-rep parser — Task 3
- ✅ FL index.ts dispatch — Task 3 (Promise.all)
- ✅ Orchestrator import update + flat-stub deletion (atomic) — Task 3 Steps 7-10
- ✅ CLAUDE.md slice entry — Task 4
- ✅ Memory + MEMORY.md — Task 4 Steps 2-3
- ✅ Workspace verify gate — Task 4 Step 4

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. Each task contains full file content or precise diff blocks. URL patterns flagged as audit-derived with port-time verification (JSDoc comments + risk section in spec).

### Type consistency

- `NormalizedFinancialDisclosure` shape used per actual interface (line-item-oriented, NOT array-oriented).
- `NormalizedDistrictOffice` shape consistent across FL Senate + House parsers, matches slice 16 sibling format exactly.
- `parseAddressText` signature unchanged from slice 16 (`(raw: string) => {street_1, city, state, postal_code?, phone?} | null`).
- `resolveOpenstatesPersonId` signature unchanged from slice 15 hoist.
- Adapter dispatch shape (StateEthicsAdapter / StateCommunityAdapter) unchanged.

### Known incomplete details

- NY FDS pagination selector + URL param name are audit-derived. Implementer should fetch a real ethics.ny.gov page during scaffold to verify `nav.pagination a.next-page` selector + `?year=2024` query parameter.
- FL House MemberId-as-district assumption: if production drift surfaces, slice 18 adds the index-page-driven district → MemberId mapping. v1 ships with the simpler assumption per "documented v1 trade-off".
- FL Senate URL pattern `flsenate.gov/Senators/s{n}` is audit-derived. Verify at scaffold.
- Memory `<squash SHA>` placeholders filled post-merge during finishing-a-development-branch per slice 14/15/16 precedent.
- Task 1 test counts may differ ±1-2 from plan estimate of 17 due to vitest grouping; implementer reports actual count in commit message.
- `inferChamberFromOfficeText` regex matches `\bAssembly\b` + `\bSenator\b|\bSenate\b`. Unknown office variants (e.g. "Member" without qualifier, or new variants COELIG introduces) → null (silent skip). Operator monitors `errors[]` for new variants.
