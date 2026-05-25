# Slice 19 — PDF-parsing infrastructure + MI PFD implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `pdf-parse` workspace dep + shared text-extraction helper + MI PFD parser replacing the slice 5I stub. Validates the helper API against a real PDF source; unlocks NY FDS line-item fill (slice 20) + CA FPPC + TX TEC per-case PDFs (slice 21+).

**Architecture:** 4 tasks sequenced — Task 1 builds the helper in isolation; Tasks 2-3 build the MI PFD parser on top; Task 4 closes. Each task verified independently.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler. `pdf-parse` 1.x (CommonJS, ships its own .d.ts). `vitest` + `vi.mock` for PDF parser stubbing. Slice 18's `stubFetchBlocked()` for network leak prevention.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-pdf-parsing-mi-pfd-design.md` (slice 19 spec)
- Slice 17 plan (`docs/superpowers/plans/2026-05-25-ny-fds-fl-offices.md`) — `NormalizedFinancialDisclosure` line-item-oriented shape + placeholder-row pattern
- Slice 18 helpers (`packages/db/supabase/seed/test-utils/stub-fetch.ts`) — `stubFetchBlocked()`
- Existing slice 5I stub: `packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts` (already narrows to `StateEthicsAdapter<NormalizedFinancialDisclosure>` per slice 18 Task 4)

**Key findings from file exploration:**

- `tsconfig.base.json:11` has `esModuleInterop: true` → `import pdfParse from 'pdf-parse'` works for the CJS default export.
- `verbatimModuleSyntax: true` is compatible (it only constrains type-vs-value imports; default-import of a value module is fine).
- `exactOptionalPropertyTypes: true` requires conditional spread (`...(x !== undefined ? { x } : {})`) for optional fields (slice 18 Task 2 lesson).
- `noUncheckedIndexedAccess: true` requires `!` non-null assertion after guard checks on array indexing.
- `pdf-parse` ships its own bundled TypeScript declarations; no separate `@types/pdf-parse` needed in v1 of the library. Verify at install.
- mi-board.ts adapter wrapper currently has 3 lines of body; Task 3 replaces it with production logic.
- mi-board.test.ts uses an existing slice 5I fixture at `state-ethics/fixtures/disclosures-mi.json` (envelope of pre-parsed Normalized rows). Production tests REPLACE this — fixture stays for back-compat injection tests, but new tests mock the PDF path directly.

---

## File Structure

### Created files (4)
```
packages/db/supabase/seed/shared/pdf.ts                                NEW (Task 1)
packages/db/supabase/seed/shared/pdf.test.ts                           NEW (Task 1)
packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.ts   NEW (Task 2)
packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.test.ts  NEW (Task 2)
```

### Modified files (4)
```
packages/db/package.json                                               + pdf-parse dep
packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts         REPLACE stub
packages/db/supabase/seed/state-ethics/disclosures/mi-board.test.ts    extend tests
CLAUDE.md                                                              slice 19 entry
```

### Deleted files (0)

**Total touched: ~9 files** (smaller than slice 17/18; focused on one helper + one parser).

---

## Task 1: Infrastructure — `pdf-parse` dep + `shared/pdf.ts` helper

**Files:**
- Modify: `packages/db/package.json` (add `pdf-parse` dep)
- Create: `packages/db/supabase/seed/shared/pdf.ts`
- Create: `packages/db/supabase/seed/shared/pdf.test.ts`

- [ ] **Step 1: Add `pdf-parse` workspace dep**

In `packages/db/package.json` `dependencies` (after `cheerio`):

```diff
   "dependencies": {
     "cheerio": "^1.2.0",
+    "pdf-parse": "^1.1.1",
     "pg": "^8.13.0",
     "shapefile": "^0.6.6",
     "undici": "^6.19.0",
     "unzipper": "^0.12.3",
     "yaml": "^2.9.0",
     "zod": "^3.23.0"
   },
```

Run install:
```bash
pnpm install
```

Verify `node_modules/pdf-parse/lib/pdf-parse.js` exists and `node_modules/pdf-parse/index.d.ts` (or bundled `.d.ts`) is present. If no bundled types, also add `@types/pdf-parse` to devDependencies:

```bash
pnpm --filter @chiaro/db add -D @types/pdf-parse
```

Note: `pdf-parse@1.1.1` previously shipped types via bundle. If install reports missing types, fall back to `@types/pdf-parse`. Either way, the import shape stays the same.

- [ ] **Step 2: Write the failing helper test**

Create `packages/db/supabase/seed/shared/pdf.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock pdf-parse at the module level — pdf-parse runs a side-effect
// at import time (reads its own test PDF), which fails in tests
// without a properly-loaded module. The mock returns a callable that
// we control per test.
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

import pdfParse from 'pdf-parse'
import { extractPdfText, fetchPdf } from './pdf.ts'
import { stubFetchBlocked } from '../test-utils/stub-fetch.ts'

const mockedPdfParse = vi.mocked(pdfParse)

describe('extractPdfText', () => {
  beforeEach(() => {
    mockedPdfParse.mockReset()
  })

  it('returns text from pdf-parse result', async () => {
    mockedPdfParse.mockResolvedValue({ text: 'Hello PDF', numpages: 1 } as never)
    const result = await extractPdfText(Buffer.from('fake-pdf-bytes'))
    expect(result).toBe('Hello PDF')
  })

  it('returns empty string when pdf-parse returns empty text', async () => {
    mockedPdfParse.mockResolvedValue({ text: '', numpages: 0 } as never)
    expect(await extractPdfText(Buffer.from('empty'))).toBe('')
  })

  it('returns empty string when pdf-parse rejects (swallows errors)', async () => {
    mockedPdfParse.mockRejectedValue(new Error('parse failed'))
    expect(await extractPdfText(Buffer.from('garbage'))).toBe('')
  })

  it('returns empty string when pdf-parse returns null/undefined text', async () => {
    mockedPdfParse.mockResolvedValue({ text: null, numpages: 0 } as never)
    expect(await extractPdfText(Buffer.from('weird'))).toBe('')
  })
})

describe('fetchPdf', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  afterEach(() => {
    fetchSpy?.mockRestore()
  })

  it('returns Buffer when fetch is 2xx', async () => {
    const fakeBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])  // "%PDF"
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => fakeBytes.buffer,
    } as never)
    const result = await fetchPdf('https://example.com/test.pdf')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(4)
  })

  it('throws on non-2xx response', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as never)
    await expect(fetchPdf('https://example.com/missing.pdf')).rejects.toThrow('404')
  })

  it('throws when fetch rejects (network / timeout)', async () => {
    const blocked = stubFetchBlocked()
    await expect(fetchPdf('https://example.com/timeout.pdf')).rejects.toThrow('blocked in test')
    blocked.mockRestore()
  })

  it('uses custom timeoutMs when provided', async () => {
    const fakeBytes = new Uint8Array([])
    let observedSignal: AbortSignal | undefined
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      observedSignal = init?.signal ?? undefined
      return { ok: true, status: 200, arrayBuffer: async () => fakeBytes.buffer } as never
    })
    await fetchPdf('https://example.com/ok.pdf', { timeoutMs: 5000 })
    expect(observedSignal).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run shared/pdf
```
Expected: FAIL — `extractPdfText is not a function` / module not found.

- [ ] **Step 4: Implement `shared/pdf.ts`**

Create `packages/db/supabase/seed/shared/pdf.ts`:

```ts
import pdfParse from 'pdf-parse'

const DEFAULT_TIMEOUT_MS = 15000

/**
 * Extract text from a PDF buffer. Wraps pdf-parse's bare API.
 *
 * Returns empty string on parse failure (caller handles via empty
 * line-item array). Errors are swallowed because pdf-parse is known
 * to write warnings to stderr for edge cases (encrypted PDFs,
 * embedded fonts, non-standard layouts) without throwing — empty
 * result is the canonical "couldn't extract" signal.
 *
 * Slice 19 helper. Consumers: MI PFD (slice 19), NY FDS line-items
 * (slice 20), TX TEC sworn-complaint orders (slice 21+), CA FPPC
 * Form 700 (slice 22+).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer)
    return result.text ?? ''
  } catch {
    return ''
  }
}

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

- [ ] **Step 5: Run helper test to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run shared/pdf
```
Expected: 8 tests PASS.

- [ ] **Step 6: Composite typecheck (base + seed tsconfig)**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: BOTH `tsc --noEmit` and `tsc -p tsconfig.seed.json` PASS. This is where any pdf-parse type-import issues surface.

If `pdf-parse` ships no .d.ts AND no `@types/pdf-parse` is installed, typecheck will report `Could not find a declaration file for module 'pdf-parse'`. Mitigation: install `@types/pdf-parse` (Step 1 fallback) OR add a minimal ambient declaration at `packages/db/supabase/seed/shared/pdf-parse.d.ts`:

```ts
declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string
    numpages: number
    info?: Record<string, unknown>
  }
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>
  export default pdfParse
}
```

Prefer `@types/pdf-parse` if installable; ambient .d.ts is the fallback.

- [ ] **Step 7: Run FULL @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~661 tests PASS (653 + 8 new helper tests).

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/db/package.json \
        packages/db/supabase/seed/shared/pdf.ts \
        packages/db/supabase/seed/shared/pdf.test.ts \
        pnpm-lock.yaml
# If ambient .d.ts was needed:
# git add packages/db/supabase/seed/shared/pdf-parse.d.ts
git commit -m "$(cat <<'EOF'
feat(seed): pdf-parse + shared/pdf.ts helper (extractPdfText + fetchPdf)

Add the pdf-parse workspace dep + canonical shared PDF helper.
First consumer is MI PFD (Task 3); slice 20+ will use this helper
to fill NY FDS line-items + parse TX TEC orders + CA FPPC Form 700.

- extractPdfText(buffer): wraps pdf-parse with try/catch returning
  empty string on parse failure. pdf-parse writes warnings to
  stderr for edge cases (encrypted PDFs, embedded fonts) without
  always throwing — empty result is the canonical "couldn't
  extract" signal.
- fetchPdf(url, opts?): wraps native fetch with 15s default timeout
  (vs 5s for HTML adapters; PDFs may be MB-scale). Throws on non-2xx
  or network failure; callers wrap in try/catch + silent skip.
- 8 vitest cases. Tests mock pdf-parse via vi.mock at module level
  (pdf-parse's import-time side effect reads its own test PDF).

Per spec: docs/superpowers/specs/2026-05-25-pdf-parsing-mi-pfd-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: MI PFD URL derivation + line-item text parser

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.ts`
- Create: `packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.test.ts`

- [ ] **Step 1: Write the failing parser test**

Create `packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  deriveMiPfdUrl,
  parseMiPfdText,
  classifyIncomeKind,
} from './mi-pfd-helpers.ts'

describe('deriveMiPfdUrl', () => {
  it('builds the audit-derived URL pattern from full_name + year', () => {
    const url = deriveMiPfdUrl({ full_name: 'Jane Doe' }, 2024)
    expect(url).toMatch(/michigan\.gov.*Doe-Jane.*PFDDR.*2024\.pdf$/)
  })

  it('handles multi-word first names ("Mary Jo Smith" → "Smith-Mary")', () => {
    // Audit pattern is Lastname-Firstname; first word treated as firstname,
    // last word as lastname (collapses middle names).
    const url = deriveMiPfdUrl({ full_name: 'Mary Jo Smith' }, 2024)
    expect(url).toContain('Smith-Mary')
  })

  it('returns empty string for single-name legislators (silent skip downstream)', () => {
    expect(deriveMiPfdUrl({ full_name: 'Singleton' }, 2024)).toBe('')
  })

  it('handles accented characters via normalize-NFD (audit lesson)', () => {
    const url = deriveMiPfdUrl({ full_name: 'José Smith' }, 2024)
    expect(url).toContain('Smith-Jose')
  })
})

describe('classifyIncomeKind', () => {
  it('matches salary keywords', () => {
    expect(classifyIncomeKind('Salary from State of Michigan')).toBe('salary')
    expect(classifyIncomeKind('Wages, hourly')).toBe('salary')
    expect(classifyIncomeKind('Compensation for services')).toBe('salary')
  })

  it('matches consulting', () => {
    expect(classifyIncomeKind('Consulting fees from XYZ LLC')).toBe('consulting')
    expect(classifyIncomeKind('Advisory board honorarium')).toBe('consulting')
  })

  it('matches royalty', () => {
    expect(classifyIncomeKind('Royalties from book publication')).toBe('royalty')
  })

  it('matches rental', () => {
    expect(classifyIncomeKind('Rental income from 123 Main')).toBe('rental')
    expect(classifyIncomeKind('Rent income, residential property')).toBe('rental')
  })

  it('matches dividend / interest', () => {
    expect(classifyIncomeKind('Dividends from common stock')).toBe('dividend')
    expect(classifyIncomeKind('Interest income, savings account')).toBe('dividend')
  })

  it('falls back to "other" for unknown', () => {
    expect(classifyIncomeKind('Lottery winnings, December 2024')).toBe('other')
  })
})

describe('parseMiPfdText', () => {
  it('returns empty array for empty text', () => {
    expect(parseMiPfdText('')).toEqual([])
  })

  it('returns empty array for garbage text', () => {
    expect(parseMiPfdText('completely unrelated nonsense')).toEqual([])
  })

  it('extracts one line item with salary + dollar range', () => {
    const text = `
Personal Financial Disclosure 2024
Filer: Jane Doe

Sources of Income
1. Salary from State of Michigan: $50,000 - $100,000
`
    const items = parseMiPfdText(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      income_source: expect.stringContaining('State of Michigan'),
      income_kind: 'salary',
      amount_range_low: 50000,
      amount_range_high: 100000,
    })
  })

  it('extracts multiple line items (one per income source)', () => {
    const text = `
Sources of Income
1. Salary from State of Michigan: $50,000 - $100,000
2. Consulting fees from XYZ LLC: $10,000 - $50,000
3. Rental income from 123 Main Street: $1,000 - $10,000
`
    const items = parseMiPfdText(text)
    expect(items).toHaveLength(3)
    expect(items.map(i => i.income_kind)).toEqual(['salary', 'consulting', 'rental'])
  })

  it('handles "Less than $X" amount form', () => {
    const text = `
Sources of Income
1. Salary from minor consulting: Less than $1,000
`
    const items = parseMiPfdText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.amount_range_low).toBe(0)
    expect(items[0]?.amount_range_high).toBe(1000)
  })

  it('handles en-dash and em-dash amount separators', () => {
    const items1 = parseMiPfdText('Sources of Income\n1. Salary: $1,000–$10,000')
    const items2 = parseMiPfdText('Sources of Income\n1. Salary: $1,000—$10,000')
    expect(items1[0]?.amount_range_high).toBe(10000)
    expect(items2[0]?.amount_range_high).toBe(10000)
  })

  it('skips lines without recognizable amount range', () => {
    const text = `
Sources of Income
1. Salary from State of Michigan (no amount listed)
2. Consulting fees: $5,000 - $15,000
`
    const items = parseMiPfdText(text)
    // Only line 2 has parseable amount range
    expect(items).toHaveLength(1)
    expect(items[0]?.income_kind).toBe('consulting')
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/mi-pfd-helpers
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `mi-pfd-helpers.ts`**

Create `packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.ts`:

```ts
const MI_PFD_BASE = 'https://www.michigan.gov/sos/0,4670,7-127-1633_8722_56081-PFDDR-reports'

export interface ParsedMiPfdLineItem {
  income_source: string
  income_kind: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
}

/**
 * Build the MI PFD PDF URL for a legislator + filing year.
 *
 * Per slice 12 audit + slice 19 design: pattern is
 * michigan.gov/sos/.../<Lastname>-<Firstname>-PFDDR-<year>.pdf.
 * Audit-derived; implementer should verify against 2-3 real URLs
 * during scaffold and adjust MI_PFD_BASE constant if SOS portal
 * IDs change.
 *
 * Multi-word names: first word = firstname, last word = lastname
 * (collapses middle names — typical SOS convention).
 *
 * Single-word names: returns empty string. Downstream fetch will
 * fail; legislator silently skipped.
 *
 * Accented characters folded via NFD normalization (slice 18 audit
 * Bug 1 lesson — "José" → "Jose").
 */
export function deriveMiPfdUrl(
  legislator: { full_name: string },
  year: number,
): string {
  const normalized = legislator.full_name
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return ''

  const firstName = parts[0]!
  const lastName = parts[parts.length - 1]!
  return `${MI_PFD_BASE}/${year}/one/${lastName}-${firstName}-PFDDR-${year}.pdf`
}

const INCOME_KIND_PATTERNS: Array<[RegExp, ParsedMiPfdLineItem['income_kind']]> = [
  [/\b(salary|wages|compensation)\b/i, 'salary'],
  [/\b(consulting|consultant|advisory|honorarium)\b/i, 'consulting'],
  [/\b(royalt(y|ies))\b/i, 'royalty'],
  [/\b(rental|rent income)\b/i, 'rental'],
  [/\b(dividend|interest)\b/i, 'dividend'],
]

/**
 * Classify a free-text income source into one of the canonical
 * income_kind enum values. Falls back to 'other' for unrecognized
 * patterns.
 */
export function classifyIncomeKind(text: string): ParsedMiPfdLineItem['income_kind'] {
  for (const [pattern, kind] of INCOME_KIND_PATTERNS) {
    if (pattern.test(text)) return kind
  }
  return 'other'
}

// Amount range: "$X - $Y" or "$X – $Y" or "$X — $Y" (hyphen, en-dash, em-dash)
const AMOUNT_RANGE_RE = /\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/
const LESS_THAN_RE = /less than \$?([\d,]+)/i

function parseAmount(numStr: string): number {
  return Number.parseInt(numStr.replace(/,/g, ''), 10)
}

/**
 * Parse a MI PFD form's extracted text into income line items.
 *
 * Audit-derived strategy: section walker over "Sources of Income"
 * lines. Each numbered line "N. Source description: $X - $Y" emits
 * one ParsedMiPfdLineItem. Lines lacking a recognizable amount range
 * are skipped (silent — operator monitors production parse rate).
 *
 * v1 regex is conservative; iterates per production-run drift.
 */
export function parseMiPfdText(text: string): ParsedMiPfdLineItem[] {
  if (!text || text.trim().length === 0) return []
  if (!/sources of income/i.test(text)) return []

  const out: ParsedMiPfdLineItem[] = []
  // Split into "1. ..." numbered entries within the Sources of Income block.
  const lines = text.split('\n').map(l => l.trim())
  for (const line of lines) {
    if (!/^\d+\.\s/.test(line)) continue

    // Extract income source (before first colon or amount-range marker)
    const sourceMatch = line.match(/^\d+\.\s+(.+?)(?::|less than|\$|\s[-–—]\s)/i)
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

    // Try standard range form "$X - $Y"
    const rangeMatch = line.match(AMOUNT_RANGE_RE)
    if (rangeMatch) {
      const low = parseAmount(rangeMatch[1]!)
      const high = parseAmount(rangeMatch[2]!)
      if (Number.isFinite(low) && Number.isFinite(high)) {
        out.push({ income_source, income_kind, amount_range_low: low, amount_range_high: high })
        continue
      }
    }

    // No parseable amount → skip this line (audit lesson: silent skip)
  }

  return out
}
```

- [ ] **Step 4: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/mi-pfd-helpers
```
Expected: ~18 tests PASS (4 URL + 6 classify + 8 parse).

- [ ] **Step 5: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.ts \
        packages/db/supabase/seed/state-ethics/disclosures/mi-pfd-helpers.test.ts
git commit -m "$(cat <<'EOF'
feat(state-ethics): MI PFD URL derivation + line-item text parser

Two helpers for the MI PFD parser (Task 3 wires them into the
adapter):

- deriveMiPfdUrl(legislator, year): builds audit-derived URL pattern
  michigan.gov/sos/.../<Lastname>-<Firstname>-PFDDR-<year>.pdf.
  Multi-word names collapse to first/last (middle name discarded).
  NFD-normalizes accented characters (slice 18 audit Bug 1 lesson).
  Returns empty string for single-name legislators (silent skip
  downstream).
- classifyIncomeKind(text): regex-based income source → canonical
  enum (salary | consulting | royalty | rental | dividend | other).
  Falls back to 'other' for unrecognized patterns.
- parseMiPfdText(text): section-walker over "Sources of Income"
  numbered lines. Extracts {income_source, income_kind,
  amount_range_low, amount_range_high}. Handles "Less than $X" +
  "$X - $Y" + en-dash + em-dash amount forms. Lines lacking a
  parseable amount range are silently skipped (operator monitors
  production parse rate; regex iterates with drift).
- 18 vitest cases.

Per spec: docs/superpowers/specs/2026-05-25-pdf-parsing-mi-pfd-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: MI PFD adapter (replace stub)

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts` (replace stub)
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/mi-board.test.ts` (extend with production-path tests)

- [ ] **Step 1: Write the failing production-path tests**

Replace `packages/db/supabase/seed/state-ethics/disclosures/mi-board.test.ts` entire contents with:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mock the shared/pdf module so tests inject text directly.
vi.mock('../../shared/pdf.ts', () => ({
  fetchPdf: vi.fn(),
  extractPdfText: vi.fn(),
}))

import { miBoardDisclosures } from './mi-board.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'

const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedExtractPdfText = vi.mocked(extractPdfText)

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'disclosures-mi.json')

describe('mi-board adapter shape', () => {
  it('reports correct slug + component', () => {
    expect(miBoardDisclosures.slug).toBe('mi-board')
    expect(miBoardDisclosures.component).toBe('disclosures')
  })

  it('covered_states valid', () => {
    expect(miBoardDisclosures.covered_states).toEqual(['MI'])
  })
})

describe('mi-board fetcher injection (back-compat from slice 5I stub fixture)', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await miBoardDisclosures.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })
})

describe('mi-board production-path PDF flow', () => {
  it('production-path returns [] when network is blocked', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })

  it('emits one NormalizedFinancialDisclosure per parsed line item, per legislator', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith' },
        ],
        rowCount: 2,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText
      .mockResolvedValueOnce(
        'Sources of Income\n1. Salary from State of Michigan: $50,000 - $100,000',
      )
      .mockResolvedValueOnce(
        'Sources of Income\n1. Consulting fees: $10,000 - $50,000\n2. Rental income: $1,000 - $10,000',
      )

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    // Jane: 1 line; Alex: 2 lines = 3 rows total
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      official_openstates_person_id: 'ocd-1',
      filing_year: 2024,
      income_kind: 'salary',
      amount_range_low: 50000,
      amount_range_high: 100000,
      state: 'MI',
      source: 'mi-board',
    })
    expect(result[0]?.external_id).toMatch(/^mi-pfd-Doe-Jane-2024-1$/)
    expect(result[1]?.external_id).toMatch(/^mi-pfd-Smith-Alex-2024-1$/)
    expect(result[2]?.external_id).toMatch(/^mi-pfd-Smith-Alex-2024-2$/)
  })

  it('skips legislator on fetchPdf rejection (silent skip)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith' },
        ],
        rowCount: 2,
      }),
    }
    let n = 0
    mockedFetchPdf.mockImplementation(async () => {
      n += 1
      if (n === 1) throw new Error('404')
      return Buffer.from('fake-pdf')
    })
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    // Jane skipped on fetch failure; Alex parses → 1 row
    expect(result).toHaveLength(1)
    expect(result[0]?.official_openstates_person_id).toBe('ocd-2')
  })

  it('emits 0 rows for legislator with empty PDF text', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toEqual([])
  })

  it('skips legislators with single-name full_name (deriveMiPfdUrl returns empty)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Singleton' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith' },
        ],
        rowCount: 2,
      }),
    }
    // Only one fetchPdf call expected (Alex); Singleton URL is empty → no fetch
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toHaveLength(1)
    expect(result[0]?.official_openstates_person_id).toBe('ocd-2')
    expect(mockedFetchPdf).toHaveBeenCalledTimes(1)
  })

  it('queries officials for MI state_house AND state_senate', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/chamber\s+in\s+\('state_house'\s*,\s*'state_senate'\)/i),
      expect.arrayContaining(['MI']),
    )
  })
})

// Reset mocks between describe blocks (vitest auto-resets when vi.mock is
// hoisted but explicit resets keep cross-test isolation deterministic).
beforeEach(() => {
  mockedFetchPdf.mockReset()
  mockedExtractPdfText.mockReset()
})
```

Note: the import-order convention requires `vi.mock` calls at module top BEFORE the imports being mocked. vitest hoists them automatically; the explicit ordering is for clarity.

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/mi-board
```
Expected: FAIL — the stub adapter doesn't implement the production flow.

- [ ] **Step 3: Replace `mi-board.ts` with production implementation**

Replace `packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts` entire contents:

```ts
import type { Client } from 'pg'
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { deriveMiPfdUrl, parseMiPfdText } from './mi-pfd-helpers.ts'

const FILING_YEAR_DEFAULT = 2024  // v1 hardcodes current cycle; backfill is a future slice
const RATE_LIMIT_MS = 1000

/**
 * Michigan Personal Financial Disclosure (PFD) parser.
 *
 * Slug `mi-board` is the slice 5I stub legacy name (Michigan SOS
 * handles PFD filings, not the Michigan Bureau of Elections "board",
 * but the slug stays for state_ethics_orgs row continuity).
 *
 * Flow per legislator: query officials for MI state_house +
 * state_senate; derive PDF URL via deriveMiPfdUrl(legislator, year);
 * fetchPdf(url) → extractPdfText(buffer) → parseMiPfdText(text);
 * emit one NormalizedFinancialDisclosure per parsed line item.
 *
 * external_id format: `mi-pfd-{Lastname}-{Firstname}-{year}-{lineNo}`.
 * Deterministic across re-runs; (source, external_id) UNIQUE handles
 * dedup at DB layer.
 *
 * Per-legislator silent skip on:
 *   - Empty derived URL (single-name legislators)
 *   - fetchPdf rejection (404, timeout, network error)
 *   - Empty extractPdfText result (parse failure)
 *   - parseMiPfdText returning [] (no recognized line items)
 *
 * Production fetch volume: ~148 MI legislators × 1 PDF each = 148
 * fetches per orchestrator run, ~148s at 1-req/sec.
 */
export const miBoardDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'mi-board',
  component: 'disclosures',
  covered_states: ['MI'],
  async fetchEvents(opts): Promise<NormalizedFinancialDisclosure[]> {
    if (opts.fetcher) return opts.fetcher()

    const client = opts.client as Client
    const res = await client.query<{
      openstates_person_id: string
      full_name: string
    }>(
      `select openstates_person_id, full_name from public.officials
       where chamber in ('state_house', 'state_senate')
         and state = $1
         and in_office = true`,
      ['MI'],
    )

    const out: NormalizedFinancialDisclosure[] = []
    const rows = res.rows
    const totalRows = rows.length
    const year = FILING_YEAR_DEFAULT

    for (let i = 0; i < totalRows; i += 1) {
      const legislator = rows[i]!
      const url = deriveMiPfdUrl({ full_name: legislator.full_name }, year)
      if (!url) continue

      let buffer: Buffer
      try {
        buffer = await fetchPdf(url)
      } catch {
        continue
      }

      const text = await extractPdfText(buffer)
      if (!text) continue

      const lineItems = parseMiPfdText(text)
      if (lineItems.length === 0) continue

      // Re-derive normalized lastname-firstname for external_id (matches URL derivation)
      const normalized = legislator.full_name
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
      const nameParts = normalized.split(/\s+/).filter(Boolean)
      const lastName = nameParts[nameParts.length - 1]!
      const firstName = nameParts[0]!

      lineItems.forEach((item, idx) => {
        const lineNo = idx + 1
        const row: NormalizedFinancialDisclosure = {
          official_openstates_person_id: legislator.openstates_person_id,
          filing_year: year,
          income_source: item.income_source,
          income_kind: item.income_kind,
          state: 'MI',
          source_url: url,
          source: 'mi-board',
          external_id: `mi-pfd-${lastName}-${firstName}-${year}-${lineNo}`,
        }
        if (item.amount_range_low !== undefined) row.amount_range_low = item.amount_range_low
        if (item.amount_range_high !== undefined) row.amount_range_high = item.amount_range_high
        out.push(row)
      })

      // Audit M5 pattern: throttle after every iteration except the last.
      if (i < totalRows - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
      }
    }

    return out
  },
}
```

- [ ] **Step 4: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/mi-board
```
Expected: ~10 tests PASS (4 adapter shape + 1 fixture back-compat + 7 production-path).

- [ ] **Step 5: Run FULL @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~680 tests PASS (661 from Task 1 + 18 Task 2 + ~10 Task 3 production-path; Task 3 also adds vs replaces stub tests, net +~6 new beyond Task 1 count).

- [ ] **Step 6: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts \
        packages/db/supabase/seed/state-ethics/disclosures/mi-board.test.ts
git commit -m "$(cat <<'EOF'
feat(state-ethics): MI PFD parser — replace mi-board stub with production flow

Replace slice 5I stub with production PDF-extraction parser. First
concrete consumer of slice 19's shared/pdf.ts helper.

- Query officials for MI state_house + state_senate (~148 legislators).
- Per legislator: deriveMiPfdUrl → fetchPdf → extractPdfText →
  parseMiPfdText → emit one NormalizedFinancialDisclosure per
  recognized line item.
- external_id format: mi-pfd-{Lastname}-{Firstname}-{year}-{lineNo}.
  Deterministic across re-runs; (source, external_id) UNIQUE
  handles DB-side dedup.
- Per-legislator silent skip on: empty derived URL (single-name),
  fetchPdf rejection (404/timeout/network), empty extractPdfText
  (parse failure), no recognized line items.
- 1-req/sec throttle between legislators (audit M5 guard: skip
  after last iteration).
- ~10 vitest cases mocking the shared/pdf module + slice 18
  stubFetchBlocked for the production-path leak prevention test.

Existing fixture-injection test (slice 5I disclosures-mi.json
envelope) kept for back-compat.

Production fetch volume: ~148 PDFs × 1-req/sec ≈ 148s per run.

Per spec: docs/superpowers/specs/2026-05-25-pdf-parsing-mi-pfd-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Closure — CLAUDE.md slice 19 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 19 entry)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice19_pdf_parsing_mi_pfd.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Append slice 19 entry to CLAUDE.md**

After the slice 18 entry in `## Slices delivered`, append:

```markdown
- **Slice 19 — PDF-parsing infrastructure + MI PFD** (2026-05-25): Adds `pdf-parse` workspace dep + canonical shared text-extraction helper (`packages/db/supabase/seed/shared/pdf.ts` exporting `extractPdfText` + `fetchPdf`) + first concrete consumer (MI PFD financial_disclosures via `mi-board.ts`, replacing slice 5I stub). MI PFD URL pattern audit-derived (`michigan.gov/sos/.../<Lastname>-<Firstname>-PFDDR-<year>.pdf`); v1 hardcodes year=2024 (backfill is a future slice). `parseMiPfdText` section-walker over "Sources of Income" numbered lines emits one `NormalizedFinancialDisclosure` per line item (slice 17 line-item-oriented shape). `external_id` = `mi-pfd-{Lastname}-{Firstname}-{year}-{lineNo}` for deterministic dedup. Per-legislator silent skip on URL/fetch/parse failure; 1-req/sec throttle (slice 18 audit M5 guard). Helper unlocks NY FDS line-item fill (slice 20) + CA FPPC + TX TEC per-case PDFs (slice 21+). Mock text strings only — no real PDF fixtures committed; end-to-end pdf-parse integration verified by manual scaffold run. ~9 files; no schema work; pgTAP unchanged at 402 plans. Test count: 653 → ~680 (+~27 new across pdf.ts helper, mi-pfd-helpers, mi-board production-path).
```

No new Gotcha — slice 17 placeholder-row pattern + slice 18 helpers cover the patterns this slice uses.

- [ ] **Step 2: Write memory file**

Use Write tool to create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice19_pdf_parsing_mi_pfd.md`:

```markdown
---
name: project-chiaro-slice19-pdf-parsing-mi-pfd
description: Slice 19 — PDF-parsing infrastructure + MI PFD first concrete consumer
metadata:
  type: project
---

Slice 19 shipped 2026-05-25 — merged locally to master as squash `<squash SHA>`. Feature branch `slice-19-pdf-parsing-mi-pfd` deleted post-merge.

**Scope:** Add pdf-parse workspace dep + canonical shared text-extraction helper + MI PFD as first concrete consumer. Audit's strongest cross-cutting recommendation (3 slice memory mentions in 15/16/17). Slice 18 deliberately landed first so this slice's parsers use the new tooling (stubFetchBlocked, generic StateXxxAdapter<E>, composite typecheck).

**What shipped:**
- `pdf-parse@1.1.1` added to `@chiaro/db` deps.
- `seed/shared/pdf.ts` with `extractPdfText(buffer)` + `fetchPdf(url, opts?)`. 15s default timeout for PDFs (vs 5s HTML adapters).
- `state-ethics/disclosures/mi-pfd-helpers.ts` with `deriveMiPfdUrl`, `classifyIncomeKind`, `parseMiPfdText`.
- `state-ethics/disclosures/mi-board.ts` replaces slice 5I stub with production PDF flow.
- ~27 new vitest cases. Test count: 653 → ~680.

**Durable lessons:**

1. **`pdf-parse` requires module-level vi.mock at import time.** pdf-parse runs a side-effect at import (reads its own bundled test PDF), so naively importing it in a test file may fail in CI. Pattern: `vi.mock('pdf-parse', () => ({ default: vi.fn() }))` at the top of test files that import the helper. Tests then control the mock per-case.

2. **PDF fetch timeout > HTML fetch timeout.** PDFs may be MB-scale; 15s default is the right baseline. HTML adapters use 5s. Encoded as constants in `shared/pdf.ts` (`DEFAULT_TIMEOUT_MS = 15000`).

3. **`extractPdfText` swallows errors → empty string.** pdf-parse writes warnings to stderr for edge cases (encrypted PDFs, embedded fonts, non-standard layouts) without always throwing. Empty result is the canonical "couldn't extract" signal; callers check `if (!text) continue`. Operator monitors production parse rate.

4. **MI PFD URL pattern: `<Lastname>-<Firstname>` collapse.** Multi-word first names (e.g. "Mary Jo Smith") map to firstname=Mary, lastname=Smith. Middle names discarded. NFD-normalize accented characters per slice 18 Bug 1 lesson.

5. **Single-name legislator silent skip.** `deriveMiPfdUrl` returns empty string for single-token names; downstream `fetchPdf('')` rejects; legislator skipped. Acceptable v1 — rare in practice.

6. **Line-item regex is audit-speculative.** v1 ships conservative `^\d+\.\s` + amount-range patterns. Production drift surfaces as low parse rate; operator iterates regex in subsequent slices. Mock-text tests can't catch real-PDF layout quirks.

7. **`mi-pfd-{Lastname}-{Firstname}-{year}-{lineNo}` external_id format.** Deterministic across re-runs. Re-deriving the same normalized name pattern from the legislator's full_name (NFD + first/last split) is essential — if the URL builder normalizes differently from the external_id builder, dedup breaks. Both use the same `normalize('NFD').replace(/\p{Diacritic}/gu, '')` + `.split(/\s+/)` pipeline.

8. **PDF infra helper hoisted to `seed/shared/`** (not `state-ethics/_shared.ts`). PDF parsing is cross-domain — slice 20+ uses it for NY FDS, slice 21+ for TX TEC + CA FPPC. Matches `seed/shared/officials.ts` precedent for cross-domain helpers.

9. **Mock-text-only test fixture strategy.** No real PDF binaries committed; tests inject canned text via `extractPdfText` mock. End-to-end pdf-parse integration verified by 1 manual scaffold run during implementation. Tradeoff: CI doesn't catch real-PDF parse regressions, but avoids binary churn in repo + keeps tests fast.

10. **Audit M5 throttle guard naturally extends to PDF fetchers.** Same `if (i < totalRows - 1)` pattern from slice 18 `fetchPerMemberOffices`. Saves ~1s/run vs slice 17 unguarded version.

**Active follow-ups (operator):**

- **Slice 20: NY FDS line-item fill** — read existing slice 17 placeholder rows + their `source_url` (PDF link); fetch each PDF; run pdf-parse + NY-specific line-item parser; emit augmented rows with `external_id = filing-{NY_filing_id}-{lineNo}`. Reuses `extractPdfText` + `fetchPdf` helpers.
- **Slice 21: TX TEC per-case sworn-complaint PDFs** — extends slice 16 TX TEC combined parser to follow the PDF Download link per case.
- **Slice 22: CA FPPC Form 700** — audit URL `fppc.ca.gov/search-filings/form-700-search/search-filed-form-700s/` is HTML index + PDF filings; structurally similar to NY FDS.
- **MI PFD URL pattern verification:** scaffold-time fetch of 2-3 real URLs to confirm audit-derived path segments. If `MI_PFD_BASE` constant needs adjustment, single-line update.
- **MI PFD line-item regex iteration:** monitor production parse rate; refine regex for real PDF layout quirks (column ordering, page breaks, header/footer noise).
- **PDF backfill (year < 2024):** v1 hardcodes year=2024; future slice handles enumeration over filing years per legislator.
- **`mi-board` slug rename consideration:** slice 5I named it after the Michigan Bureau of Elections "board" but actual filer is Michigan SOS. Slug stays for back-compat per slice 15-17 drift pattern. Document but don't change.

**Master state at slice 19 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans (unchanged). 16 production parsers total (was 15; +1 slice 19: MI PFD). `pdf-parse` is the first new workspace dep since `cheerio` (slice 9). @chiaro/db test count: ~680 (653 + ~27). Audit deferred candidates: 4 → 1 closed (MI PFD); 3 PDF-bound remain (NY FDS line-items, CA FPPC, TX TEC per-case) but all now unblocked by slice 19 infrastructure.

**Cross-links:** [[project-chiaro-slice15-ny-parsers]] (Normalized* shape verification), [[project-chiaro-slice17-ny-fds-fl-offices]] (placeholder-row pattern + line-item-oriented schema), [[project-chiaro-slice18-bug-fix-tooling-refactors]] (stubFetchBlocked helper, generic StateXxxAdapter<E>, composite typecheck). Audit: `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`.
```

- [ ] **Step 3: Update MEMORY.md index**

Read `MEMORY.md`. Find the slice 18 line. Add IMMEDIATELY AFTER:

```markdown
- [Chiaro slice 19 PDF parsing + MI PFD](project_chiaro_slice19_pdf_parsing_mi_pfd.md) — pdf-parse workspace dep + shared seed/shared/pdf.ts helper (extractPdfText + fetchPdf) + MI PFD parser replacing slice 5I stub (audit bucket-C "predictable PDF URLs"); line-item rows per income source with deterministic external_id; mock-text-only test strategy
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
- `pnpm --filter @chiaro/db exec vitest run` — ~680 tests pass
- `pnpm --filter @chiaro/officials-ui exec vitest run` — 256 tests pass (unchanged from slice 18)
- `pnpm --filter @chiaro/web build` — 12 routes green

- [ ] **Step 5: Commit Task 4**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 19 closure — CLAUDE.md entry

Slice 19 ships pdf-parse infrastructure + MI PFD parser replacing
slice 5I stub. First concrete consumer of seed/shared/pdf.ts helper.
NY FDS line-items + CA FPPC + TX TEC per-case PDFs now unblocked
for slice 20+.

No new Gotcha — slice 17 placeholder-row pattern + slice 18 helpers
cover the patterns this slice uses.

@chiaro/db test count: +~27 (653 → ~680).
Audit deferred candidates: 4 → 3 closed; 3 PDF-bound remain
(all unblocked by this slice's infrastructure).
pgTAP unchanged at 402 plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo working tree — write them in Steps 2-3 but do NOT git add them.)

---

## Workspace verify gate (recap)

After all 4 tasks complete:

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run                         # ~680 tests green
pnpm --filter @chiaro/officials-ui exec vitest run               # 256 tests green (unchanged)
pnpm --filter @chiaro/web build                                  # 12 routes
git log master..HEAD --oneline                                   # 6 commits (spec + plan + 4 implementation)
```

---

## Self-review notes

### Spec coverage

- ✅ pdf-parse workspace dep — Task 1 Step 1
- ✅ extractPdfText + fetchPdf helpers — Task 1 Step 4
- ✅ Helper unit tests with vi.mock — Task 1 Step 2
- ✅ deriveMiPfdUrl + classifyIncomeKind + parseMiPfdText — Task 2 Step 3
- ✅ NFD normalize for accented chars (slice 18 lesson applied) — Task 2
- ✅ MI PFD adapter production flow — Task 3 Step 3
- ✅ Mock-text-only test strategy — Task 3 vi.mock pattern
- ✅ Production-path stubFetchBlocked usage — Task 3 Step 1
- ✅ Deterministic external_id with augmented line number — Task 3
- ✅ Audit M5 throttle guard — Task 3 production flow
- ✅ Closure docs + memory — Task 4

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. URL pattern audit-derived flagged with port-time verification. Memory file `<squash SHA>` placeholder filled post-merge.

### Type consistency

- `NormalizedFinancialDisclosure` shape per `state-ethics/shared.ts:5-17` (verified during slice 17, unchanged).
- `ParsedMiPfdLineItem` is internal to mi-pfd-helpers.ts (parser intermediate); maps cleanly to NormalizedFinancialDisclosure fields.
- `StateEthicsAdapter<NormalizedFinancialDisclosure>` (already narrowed in slice 18 Task 4) — Task 3 builds on the typed interface.
- pdf-parse default-import + `esModuleInterop: true` (verified in tsconfig.base.json).

### Known incomplete details

- MI PFD URL `MI_PFD_BASE` constant audit-derived; implementer verifies via 2-3 real URL fetches during scaffold. Path segments `0,4670,7-127-1633_8722_56081-` are Michigan SOS portal IDs that may change.
- Line-item regex tested only against representative mocked text. Real PDF layout quirks (column ordering, page-break artifacts, header/footer noise) surface only at first production run.
- `@types/pdf-parse` may or may not be needed — Task 1 Step 1 includes fallback to ambient .d.ts if pdf-parse's bundled types are missing.
- Memory `<squash SHA>` filled post-merge per slice 14-18 precedent.
- Task 3 test count estimate (~10) may differ by ±2 due to vitest grouping; implementer reports actual.
- v1 hardcodes year=2024; backfill (pre-2024) is slice 20+ scope.
