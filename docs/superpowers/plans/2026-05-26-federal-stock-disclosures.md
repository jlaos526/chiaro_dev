# Slice 26 — Federal stock_transactions + annual FD parsers implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md Gotcha #25: implementer agents MUST run sequentially (never parallel).

**Goal:** Ship 4 production parsers (House EFD + Senate EFPFD × PTR + annual FD) that write into the existing `stock_transactions` table + 2 new federal tables (`federal_holdings` + `federal_disclosure_other`). Closes the slice 8 federal/state adapter asymmetry.

**Architecture:** Combined-parser pattern for FDs (slice 16 precedent: 1 fetch → 2 schema sinks). House uses yearly bulk ZIP downloads via existing `unzipper` workspace dep. Senate uses 2-step agreement-gate POST + per-filing PDF fetch with 1-req/sec throttle.

**Tech Stack:** TypeScript strict; existing workspace deps only (`pdf-parse` from slice 19, `cheerio` from slice 9, `unzipper` already pinned in `packages/db/package.json` per verification at planning time, `pg`, `node:zlib`).

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md`
- `packages/db/supabase/seed/shared/pdf.ts` — slice 19 helpers `extractPdfText` + `fetchPdf`
- `packages/db/supabase/seed/shared/officials.ts` — `resolveOfficialByName` already supports `federal_house` + `federal_senate` chambers (verified at planning)
- `packages/db/supabase/seed/shared/instrumentation.ts` — slice 22 `SkipReason` + `createSkipCollector`
- `packages/db/supabase/seed/state-ethics/tx-tec/shared.ts` — slice 16 combined-parser pattern reference (1 source → 2 sinks)
- `packages/db/supabase/seed/state-finance/fetch-ca.ts` — adapter `slug` + `fetchFinanceSummaries` interface pattern (analog for `StockAdapter`/`FdAdapter`)
- `packages/db/supabase/seed/stock-watcher-ingest.ts` — pre-slice-8 legacy ingest path (kept intact; slice 26 writes are non-legacy)

**Key findings from planning-time investigation:**

- `extractPdfText(buffer: Buffer): Promise<string>` and `fetchPdf(url, { timeoutMs? }): Promise<Buffer>` confirmed (slice 19).
- `Chamber` union already includes `federal_house` + `federal_senate` (slice 8 broadening). No extension needed.
- `unzipper@^0.12.3` already pinned in `packages/db/package.json`. No new workspace dep.
- `stock_transactions` Row type at `packages/db/src/types.ts:1619` — columns: id, official_id, transaction_date, filing_date, days_late (generated), asset_ticker, asset_name, transaction_type, amount_range_low, amount_range_high, source_url, ingested_at, source, external_id.
- `FederalStockTransactionsList.tsx` exists (slice 4 / 13) — pattern to mirror for new list components: Database row-type prop + `formatAmountRange()` helper + `Pressable` wrapper for `source_url` linking.
- `FederalEthicsAccountabilityCard.tsx` (slice 6) — currently 1-card with STOCK Act compliance + Trades subsections via `CardSubsection`. Slice 26 adds 2 more subsections (4 total). `useOfficialMetrics` + `useOfficialStockTransactions` hooks already wired.

**Real source URLs (planning-time best knowledge; implementer verifies at scaffold):**
- House PTR ZIPs: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}.zip`
- House annual FD ZIPs: `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}.zip`
- Senate EFPFD search: `https://efdsearch.senate.gov/search/`
- Senate report_type codes: `7c` (PTR) / `11` (annual FD)

If URL drift is detected at Task 3/5 scaffold, the implementer updates the URL constant + flags in commit message. If anti-bot gate proves intractable on Senate side, deprecate Senate adapters per slice 11+21 precedent and proceed House-only.

---

## File Structure

### Created files (~25 new)
```
Migrations + pgTAP ──────────────────────────────────────────────────
  packages/db/supabase/migrations/0054_federal_disclosure_tables.sql
  packages/db/supabase/migrations/0055_federal_disclosure_rls.sql
  packages/db/supabase/tests/federal_holdings.test.sql
  packages/db/supabase/tests/federal_disclosure_other.test.sql

Shared helpers ──────────────────────────────────────────────────────
  packages/db/supabase/seed/federal-disclosures/shared/types.ts
  packages/db/supabase/seed/federal-disclosures/shared/pdf-parsers.ts
  packages/db/supabase/seed/federal-disclosures/shared/senate-agreement.ts
  packages/db/supabase/seed/federal-disclosures/shared/house-zip.ts
  packages/db/supabase/seed/federal-disclosures/shared/pdf-parsers.test.ts
  packages/db/supabase/seed/federal-disclosures/shared/senate-agreement.test.ts

PTR adapters ────────────────────────────────────────────────────────
  packages/db/supabase/seed/federal-disclosures/ptr/house-efd.ts
  packages/db/supabase/seed/federal-disclosures/ptr/senate-efpfd.ts
  packages/db/supabase/seed/federal-disclosures/ptr/index.ts
  packages/db/supabase/seed/federal-disclosures/ptr/house-efd.test.ts
  packages/db/supabase/seed/federal-disclosures/ptr/senate-efpfd.test.ts
  packages/db/supabase/seed/federal-ptrs-ingest.ts
  packages/db/supabase/seed/federal-ptrs-ingest.test.ts

FD adapters ─────────────────────────────────────────────────────────
  packages/db/supabase/seed/federal-disclosures/fd/house-efd.ts
  packages/db/supabase/seed/federal-disclosures/fd/senate-efpfd.ts
  packages/db/supabase/seed/federal-disclosures/fd/index.ts
  packages/db/supabase/seed/federal-disclosures/fd/house-efd.test.ts
  packages/db/supabase/seed/federal-disclosures/fd/senate-efpfd.test.ts
  packages/db/supabase/seed/federal-fds-ingest.ts
  packages/db/supabase/seed/federal-fds-ingest.test.ts

UI ──────────────────────────────────────────────────────────────────
  packages/officials-ui/src/federal/FederalHoldingsList.tsx
  packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx
  packages/officials-ui/test/federal/FederalHoldingsList.test.tsx
  packages/officials-ui/test/federal/FederalDisclosureOtherList.test.tsx
```

### Modified files (~7)
```
  packages/db/package.json                                              (CLI script entries; verify unzipper)
  packages/officials/src/types.ts                                       (+ FederalHolding, FederalDisclosureOther)
  packages/officials/src/queries.ts                                     (+ 2 fetchers)
  packages/officials/src/keys.ts                                        (+ 2 key factories)
  packages/officials/src/hooks.ts                                       (+ 2 useQuery hooks)
  packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx (+ 2 subsections)
  packages/officials-ui/src/index.ts                                    (barrel exports for new list components)
  packages/officials-ui/test/federal/FederalEthicsAccountabilityCard.test.tsx
  CLAUDE.md                                                              (slice 26 entry + Gotcha entries)
```

**Total touched: ~32 files.** Mega-Slice tier.

---

## Task 1: Database — migrations 0054 + 0055 + pgTAP tests

**Files:**
- Create: `packages/db/supabase/migrations/0054_federal_disclosure_tables.sql`
- Create: `packages/db/supabase/migrations/0055_federal_disclosure_rls.sql`
- Create: `packages/db/supabase/tests/federal_holdings.test.sql`
- Create: `packages/db/supabase/tests/federal_disclosure_other.test.sql`

- [ ] **Step 1: Write migration 0054 (`federal_disclosure_tables.sql`)**

```sql
-- Slice 26: federal annual financial disclosure tables. Annual FDs don't fit
-- the transaction-oriented stock_transactions schema. State side uses a single
-- state_financial_disclosures table with a category discriminator (slice 5I
-- 0047); federal side splits into holdings + other for clearer query semantics.
-- PTRs (Periodic Transaction Reports) continue to write to existing
-- public.stock_transactions; annual FD content lands here.

create table public.federal_holdings (
  id              uuid primary key default gen_random_uuid(),
  official_id     uuid not null references public.officials(id) on delete restrict,
  filing_year     int  not null,
  source          text not null,
  external_id     text,
  source_url      text not null,
  asset_name      text,
  asset_ticker    text,
  asset_type      text check (asset_type in
    ('stock','bond','mutual_fund','etf','trust','partnership','real_estate','cash','other')),
  value_min       numeric(15,2),
  value_max       numeric(15,2),
  income_type     text check (income_type in
    ('dividends','interest','capital_gains','rent','royalties','none','other')),
  income_min      numeric(15,2),
  income_max      numeric(15,2),
  ingested_at     timestamptz not null default now()
);

create unique index federal_holdings_source_external_id_uniq
  on public.federal_holdings(source, external_id)
  where external_id is not null;

create index federal_holdings_official_idx
  on public.federal_holdings(official_id, filing_year desc);

create table public.federal_disclosure_other (
  id              uuid primary key default gen_random_uuid(),
  official_id     uuid not null references public.officials(id) on delete restrict,
  filing_year     int  not null,
  source          text not null,
  external_id     text,
  source_url      text not null,
  category        text not null check (category in
    ('gift','travel','position','agreement','liability','compensation','honoraria')),
  description     text,
  source_party    text,
  value_min       numeric(15,2),
  value_max       numeric(15,2),
  value_text      text,
  ingested_at     timestamptz not null default now()
);

create unique index federal_disclosure_other_source_external_id_uniq
  on public.federal_disclosure_other(source, external_id)
  where external_id is not null;

create index federal_disclosure_other_official_idx
  on public.federal_disclosure_other(official_id, filing_year desc);

comment on table public.federal_holdings is
  'Federal annual FD holdings (assets owned + income). PTRs in stock_transactions; annual FD holdings here. Slice 26.';
comment on table public.federal_disclosure_other is
  'Federal annual FD non-stock content (gifts, travel, positions, agreements, liabilities, compensation, honoraria). Slice 26.';
```

- [ ] **Step 2: Write migration 0055 (`federal_disclosure_rls.sql`)**

```sql
-- Slice 26: RLS for federal_holdings + federal_disclosure_other. Public read,
-- service-role writes (mirrors slice 5I 0050 + slice 8 patterns).

alter table public.federal_holdings           enable row level security;
alter table public.federal_disclosure_other   enable row level security;

create policy federal_holdings_select_all
  on public.federal_holdings           for select using (true);
create policy federal_disclosure_other_select_all
  on public.federal_disclosure_other   for select using (true);

revoke insert, update, delete on public.federal_holdings           from anon, authenticated;
revoke insert, update, delete on public.federal_disclosure_other   from anon, authenticated;
```

- [ ] **Step 3: Apply migrations locally + regenerate types**

```bash
pnpm db:reset
pnpm --filter @chiaro/db exec supabase gen types typescript --local --schema public > packages/db/src/types.ts
```

Verify `Database['public']['Tables']['federal_holdings']['Row']` + `Database['public']['Tables']['federal_disclosure_other']['Row']` appear in regenerated types.

- [ ] **Step 4: Write pgTAP `federal_holdings.test.sql`**

```sql
begin;
select plan(10);

select has_table('public', 'federal_holdings', 'federal_holdings table exists');

-- Required NOT NULL columns
select col_not_null('public', 'federal_holdings', 'official_id');
select col_not_null('public', 'federal_holdings', 'filing_year');
select col_not_null('public', 'federal_holdings', 'source');
select col_not_null('public', 'federal_holdings', 'source_url');

-- ON DELETE RESTRICT FK
select fk_ok(
  'public', 'federal_holdings', 'official_id',
  'public', 'officials',         'id',
  'federal_holdings.official_id FK to officials with ON DELETE RESTRICT'
);

-- CHECK enums
select col_has_check('public', 'federal_holdings', 'asset_type');
select col_has_check('public', 'federal_holdings', 'income_type');

-- Indexes
select has_index('public', 'federal_holdings', 'federal_holdings_source_external_id_uniq');
select has_index('public', 'federal_holdings', 'federal_holdings_official_idx');

-- RLS enabled (handled in 0055; this asserts state after db:reset which applies all migrations)
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'federal_holdings' $$,
  ARRAY[true],
  'RLS enabled on federal_holdings'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Write pgTAP `federal_disclosure_other.test.sql`** — same shape (10 plans) with category CHECK enum verification + RLS assertion.

- [ ] **Step 6: Verify pgTAP green**

```bash
pnpm db:reset
pnpm db:test
```

Expected: 402 → 422 plans (+~20). All green.

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/db/supabase/migrations/0054_federal_disclosure_tables.sql \
        packages/db/supabase/migrations/0055_federal_disclosure_rls.sql \
        packages/db/supabase/tests/federal_holdings.test.sql \
        packages/db/supabase/tests/federal_disclosure_other.test.sql \
        packages/db/src/types.ts
git commit -m "$(cat <<'EOF'
feat(db): slice 26 task 1 — federal_holdings + federal_disclosure_other tables

Migrations 0054 (schema) + 0055 (RLS). Mirrors slice 5I 0047+0050 pattern
for state_financial_disclosures but split into 2 normalized tables for
federal side (per slice 26 spec decision).

- federal_holdings: assets owned + income (annual FD Schedule A + Schedule B)
- federal_disclosure_other: gifts/travel/positions/agreements/liabilities/
  compensation/honoraria (annual FD Schedules C-I)
- (source, external_id) UNIQUE WHERE external_id IS NOT NULL on both
- ON DELETE RESTRICT FK to officials (slice 5I precedent for evidence preservation)
- 20 new pgTAP plans (402 → 422)
- Regenerated packages/db/src/types.ts

PTRs continue to write to existing public.stock_transactions; only
annual FDs land in these new tables.

Per spec: docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared helpers — types + PDF parsers + Senate agreement + House ZIP

**Files:**
- Create: `packages/db/supabase/seed/federal-disclosures/shared/types.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/shared/pdf-parsers.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/shared/senate-agreement.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/shared/house-zip.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/shared/pdf-parsers.test.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/shared/senate-agreement.test.ts`

- [ ] **Step 1: Write `shared/types.ts`** — adapter interfaces + normalized row types

```ts
import type { SkipReason } from '../../shared/instrumentation.ts'

export interface NormalizedPtr {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  transaction_date:      string  // ISO date YYYY-MM-DD
  filing_date:           string
  asset_ticker?:         string
  asset_name?:           string
  transaction_type:      'purchase' | 'sale' | 'exchange'
  amount_range_low?:     number
  amount_range_high?:    number
  source_url:            string
  external_id:           string
}

export interface NormalizedHolding {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  asset_name?:           string
  asset_ticker?:         string
  asset_type?:           'stock' | 'bond' | 'mutual_fund' | 'etf' | 'trust' | 'partnership' | 'real_estate' | 'cash' | 'other'
  value_min?:            number
  value_max?:            number
  income_type?:          'dividends' | 'interest' | 'capital_gains' | 'rent' | 'royalties' | 'none' | 'other'
  income_min?:           number
  income_max?:           number
  source_url:            string
  external_id:           string
}

export interface NormalizedDisclosureOther {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  category:              'gift' | 'travel' | 'position' | 'agreement' | 'liability' | 'compensation' | 'honoraria'
  description?:          string
  source_party?:         string
  value_min?:            number
  value_max?:            number
  value_text?:           string
  source_url:            string
  external_id:           string
}

export interface FederalAdapterOpts {
  year:    number
  fetcher?: typeof fetch
  onSkip?: (r: SkipReason) => void
}

export interface PtrAdapter {
  slug: 'house-efd-ptr' | 'senate-efpfd-ptr'
  fetchTransactions(opts: FederalAdapterOpts): Promise<NormalizedPtr[]>
}

export interface FdAdapter {
  slug: 'house-efd-fd' | 'senate-efpfd-fd'
  fetchDisclosures(opts: FederalAdapterOpts): Promise<{
    holdings: NormalizedHolding[]
    other:    NormalizedDisclosureOther[]
  }>
}
```

- [ ] **Step 2: Write `shared/pdf-parsers.ts`** — section walkers

```ts
import type { NormalizedPtr, NormalizedHolding, NormalizedDisclosureOther } from './types.ts'

const AMOUNT_RANGE_RE =
  /\$?([\d,]+)(?:\.\d{2})?\s*[-–to]+\s*\$?([\d,]+)(?:\.\d{2})?/i

const OVER_RE = /Over\s+\$?([\d,]+)/i
const LESS_THAN_RE = /Less\s+than\s+\$?([\d,]+)/i

export function classifyAmountRange(text: string): { min?: number; max?: number; text: string } {
  const trimmed = text.trim()
  const m = AMOUNT_RANGE_RE.exec(trimmed)
  if (m) {
    return {
      min: Number(m[1].replace(/,/g, '')),
      max: Number(m[2].replace(/,/g, '')),
      text: trimmed,
    }
  }
  const over = OVER_RE.exec(trimmed)
  if (over) return { min: Number(over[1].replace(/,/g, '')), text: trimmed }
  const less = LESS_THAN_RE.exec(trimmed)
  if (less) return { max: Number(less[1].replace(/,/g, '')), text: trimmed }
  return { text: trimmed }
}

const TXN_TYPE_MAP: Record<string, 'purchase' | 'sale' | 'exchange'> = {
  'P': 'purchase', 'PURCHASE': 'purchase', 'BUY': 'purchase',
  'S': 'sale',     'SALE':     'sale',     'D':   'sale',    'DISPOSITION': 'sale',
  'E': 'exchange', 'EXCHANGE': 'exchange',
}

export function classifyTransactionType(marker: string): 'purchase' | 'sale' | 'exchange' | null {
  return TXN_TYPE_MAP[marker.trim().toUpperCase()] ?? null
}

const ASSET_CODE_MAP: Record<string, NormalizedHolding['asset_type']> = {
  'ST':  'stock',
  'GS':  'stock',           // government stock variants
  'CS':  'stock',
  'MF':  'mutual_fund',
  'EF':  'etf',
  'BD':  'bond',
  'CB':  'bond',
  'TR':  'trust',
  'PS':  'partnership',
  'RE':  'real_estate',
  'CA':  'cash',
}

export function classifyAssetType(code?: string): NormalizedHolding['asset_type'] {
  if (!code) return 'other'
  return ASSET_CODE_MAP[code.trim().toUpperCase()] ?? 'other'
}

/**
 * Parse PTR PDF text. Walks "Schedule of Transactions" or similar header,
 * emits transaction rows. Conservative under-reporting on non-standard
 * formatting (line items not matching expected shape are skipped).
 *
 * Mock-text-only testing per slice 19+20 convention; real PDF binaries
 * are not committed.
 */
export function parsePtrText(text: string, ctx: { filing_year: number; source_url: string }): {
  trades: Omit<NormalizedPtr, 'external_id'>[]
} {
  const trades: Omit<NormalizedPtr, 'external_id'>[] = []
  const lines = text.split(/\r?\n/)
  let inSection = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/Schedule of (Transactions|Sales|Purchases)/i.test(line)) { inSection = true; continue }
    if (!inSection) continue
    // Heuristic row regex: <date> <date> <Action> <Asset> <Amount range>
    // Example: 01/05/2025 01/19/2025 P AAPL Apple Inc. $1,001 - $15,000
    const m = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([A-Z]+)\s+([\w.&'-]+)\s+(.+?)\s+(\$?[\d,]+(?:\.\d{2})?(?:\s*[-–to]+\s*\$?[\d,]+(?:\.\d{2})?)?)$/i.exec(line)
    if (!m) continue
    const ttype = classifyTransactionType(m[3])
    if (!ttype) continue
    const range = classifyAmountRange(m[6])
    trades.push({
      filing_year:      ctx.filing_year,
      transaction_date: isoFromUsDate(m[1]),
      filing_date:      isoFromUsDate(m[2]),
      asset_ticker:     m[4],
      asset_name:       m[5].trim(),
      transaction_type: ttype,
      amount_range_low:  range.min,
      amount_range_high: range.max,
      source_url:        ctx.source_url,
    })
  }
  return { trades }
}

function isoFromUsDate(s: string): string {
  const [m, d, y] = s.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * Parse annual FD PDF text. Walks all 9 schedules (A-I). Returns combined
 * holdings + other arrays. Schedule mapping:
 *   A = holdings/income (federal_holdings)
 *   B = transactions  (IGNORED — annual FD context; PTRs are the canonical source)
 *   C = liabilities   (federal_disclosure_other category='liability')
 *   D = positions     (category='position')
 *   E = agreements    (category='agreement')
 *   F = compensation  (category='compensation')
 *   G = honoraria     (category='honoraria')
 *   H = gifts         (category='gift')
 *   I = travel        (category='travel')
 */
export function parseFdText(text: string, ctx: { filing_year: number; source_url: string }): {
  holdings: Omit<NormalizedHolding, 'external_id'>[]
  other:    Omit<NormalizedDisclosureOther, 'external_id'>[]
} {
  // Walk schedule headers; emit appropriate row types. See implementer
  // task 2 step 3 for the detailed walker. The scaffold ships a basic
  // version covering Schedules A, C, H, I (the highest-value categories);
  // remaining schedules can land as a slice 26 follow-up if real data
  // surfaces parser gaps.
  const holdings: Omit<NormalizedHolding, 'external_id'>[] = []
  const other:    Omit<NormalizedDisclosureOther, 'external_id'>[] = []

  const SECTION_RE = /Schedule\s+([A-I])\b/g
  const sections = splitBySchedule(text, SECTION_RE)
  for (const [letter, body] of sections.entries()) {
    if (letter === 'A')        holdings.push(...parseScheduleA(body, ctx))
    else if (letter === 'C')   other.push(...parseScheduleC(body, ctx))
    else if (letter === 'H')   other.push(...parseScheduleH(body, ctx))
    else if (letter === 'I')   other.push(...parseScheduleI(body, ctx))
    // D/E/F/G left for follow-up — emit nothing (silent under-reporting acceptable v1)
  }
  return { holdings, other }
}

// — Implementation details for parseScheduleA/C/H/I follow at scaffold time;
//   see Task 2 Step 3 for guidance. Each is ~30 lines of regex/line-walker.

function splitBySchedule(text: string, re: RegExp): Map<string, string> {
  // Iterates header matches, slices the text between adjacent headers.
  // Returns Map<letter, body-text>.
  const map = new Map<string, string>()
  // Implementer fills at scaffold; trivial.
  return map
}

function parseScheduleA(body: string, ctx: { filing_year: number; source_url: string }): Omit<NormalizedHolding, 'external_id'>[] {
  // Walk line items: <asset_name>, <code>, <value-range>, <income-type>, <income-range>.
  // Implementer fills with regex matching observed header structure.
  return []
}

function parseScheduleC(body: string, ctx: { filing_year: number; source_url: string }): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  // Liabilities: <creditor> <type> <amount range>
  return []
}

function parseScheduleH(body: string, ctx: { filing_year: number; source_url: string }): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  // Gifts: <source/giver> <description> <value range>
  return []
}

function parseScheduleI(body: string, ctx: { filing_year: number; source_url: string }): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  // Travel: <source/payer> <itinerary description> <value range>
  return []
}
```

- [ ] **Step 3: Implement `splitBySchedule` + the 4 schedule walkers**

The above scaffold returns empty arrays from each `parseScheduleX`. Real implementation walks each section's text + emits row objects. Implementer writes:

```ts
function splitBySchedule(text: string, re: RegExp): Map<string, string> {
  const map = new Map<string, string>()
  const matches: Array<{ letter: string; start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    matches.push({ letter: m[1], start: m.index, end: m.index + m[0].length })
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end
    const end   = i + 1 < matches.length ? matches[i + 1].start : text.length
    map.set(matches[i].letter, text.slice(start, end))
  }
  return map
}
```

For each schedule walker, write a regex per the real-world line format (verify by sampling 2-3 PDFs at scaffold; mock text strings only in tests):

```ts
function parseScheduleA(body: string, ctx: { filing_year: number; source_url: string }) {
  // Heuristic: each line item is <name><whitespace><code?><whitespace><value-range>
  const out: Omit<NormalizedHolding, 'external_id'>[] = []
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || /^Schedule\s+/i.test(trimmed)) continue
    // Implementer refines regex per observed PDF structure.
    // Conservative under-reporting on non-matching lines.
  }
  return out
}
```

If real-world PDFs reveal heterogeneous formatting, the parser emits onSkip via callback OR returns empty array for that filing (silent under-reporting acceptable per spec Risk #5).

- [ ] **Step 4: Write `shared/senate-agreement.ts`** — 2-step CSRF + agreement flow

```ts
import * as cheerio from 'cheerio'

const BROWSER_UA = 'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'
const BASE_URL   = 'https://efdsearch.senate.gov'

export interface SenateSession {
  csrfToken: string
  cookie:    string
}

export async function acceptSenateAgreement(opts: {
  fetcher?: typeof fetch
}): Promise<SenateSession> {
  const fetcher = opts.fetcher ?? fetch
  // Step 1: GET landing page; extract CSRF token + cookie
  const res = await fetcher(`${BASE_URL}/search/`, {
    headers: { 'User-Agent': BROWSER_UA },
  })
  if (!res.ok) throw new Error(`Senate landing fetch failed: ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const csrfToken = $('input[name="csrfmiddlewaretoken"]').attr('value')
  if (!csrfToken) throw new Error('Senate CSRF token not found in landing HTML')
  const cookie = extractCsrfCookie(res.headers.get('set-cookie') ?? '')
  // Step 2: POST agreement form
  const form = new URLSearchParams({
    csrfmiddlewaretoken: csrfToken,
    prohibition_agreement: '1',
  })
  const post = await fetcher(`${BASE_URL}/search/home/`, {
    method:  'POST',
    headers: {
      'User-Agent':   BROWSER_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie':       cookie,
      'Referer':      `${BASE_URL}/search/`,
    },
    body: form.toString(),
  })
  if (!post.ok) throw new Error(`Senate agreement POST failed: ${post.status}`)
  return { csrfToken, cookie }
}

function extractCsrfCookie(setCookieHeader: string): string {
  const m = /csrftoken=([^;]+)/.exec(setCookieHeader)
  return m ? `csrftoken=${m[1]}` : ''
}

export interface SenateSearchOpts {
  session:    SenateSession
  reportType: '7c' | '11'  // 7c = PTR; 11 = annual FD
  year:       number
  fetcher?:   typeof fetch
}

export interface SenateSearchResult {
  filingId:   string
  fullName:   string
  reportDate: string
  pdfUrl:     string
}

export async function searchSenateEfpfd(opts: SenateSearchOpts): Promise<SenateSearchResult[]> {
  // POST /search/report/ with session + filter form; parse results HTML.
  // Implementer writes the POST body + cheerio selector at scaffold per
  // observed real-world Senate response format.
  return []
}
```

- [ ] **Step 5: Write `shared/house-zip.ts`** — yearly ZIP downloader

```ts
import { open as unzipperOpen } from 'unzipper'
import type { Buffer } from 'node:buffer'

const BASE_URL = 'https://disclosures-clerk.house.gov/public_disc'

export interface HouseFiling {
  filingId:    string
  bioguideId?: string
  fullName:    string
  pdfBytes:    Buffer
  pdfUrl:      string
}

export interface HouseZipManifest {
  filings: HouseFiling[]
}

export async function fetchHouseDisclosureZip(opts: {
  year:     number
  formType: 'ptr' | 'fd'
  fetcher?: typeof fetch
}): Promise<HouseZipManifest> {
  const fetcher = opts.fetcher ?? fetch
  const path = opts.formType === 'ptr' ? 'ptr-pdfs' : 'financial-pdfs'
  const url  = `${BASE_URL}/${path}/${opts.year}.zip`
  const res  = await fetcher(url, { headers: { 'User-Agent': 'ChiaroBot/1.0' } })
  if (!res.ok) throw new Error(`House ZIP fetch failed: ${res.status} (${url})`)
  const buf = Buffer.from(await res.arrayBuffer())
  const zip = await unzipperOpen.buffer(buf)
  // Index manifest is a CSV/XML alongside per-filing PDFs in the ZIP.
  // Implementer reads the index entry first, then matches PDF entries
  // by filingId, building the HouseFiling[] array.
  // Each entry's pdfUrl is the canonical per-filing URL on the Clerk's site.
  const filings: HouseFiling[] = []
  // Implementer fills at scaffold per observed ZIP structure.
  return { filings }
}
```

- [ ] **Step 6: Write `shared/pdf-parsers.test.ts`** — mock-text unit tests

```ts
import { describe, expect, it } from 'vitest'
import { classifyAmountRange, classifyTransactionType, classifyAssetType, parsePtrText, parseFdText } from './pdf-parsers.ts'

describe('classifyAmountRange', () => {
  it('parses standard range', () => {
    expect(classifyAmountRange('$1,001 - $15,000')).toEqual({ min: 1001, max: 15000, text: '$1,001 - $15,000' })
  })
  it('parses "Over $X" form', () => {
    expect(classifyAmountRange('Over $50,000,000')).toEqual({ min: 50000000, text: 'Over $50,000,000' })
  })
  it('parses "Less than $X" form', () => {
    expect(classifyAmountRange('Less than $200')).toEqual({ max: 200, text: 'Less than $200' })
  })
  it('returns text-only when no match', () => {
    expect(classifyAmountRange('Variable')).toEqual({ text: 'Variable' })
  })
})

describe('classifyTransactionType', () => {
  it('maps P → purchase', () => { expect(classifyTransactionType('P')).toBe('purchase') })
  it('maps S → sale',     () => { expect(classifyTransactionType('S')).toBe('sale') })
  it('maps D → sale (disposition variant)', () => { expect(classifyTransactionType('D')).toBe('sale') })
  it('maps E → exchange', () => { expect(classifyTransactionType('E')).toBe('exchange') })
  it('returns null for unknown', () => { expect(classifyTransactionType('XY')).toBeNull() })
})

describe('classifyAssetType', () => {
  it('maps ST → stock',       () => { expect(classifyAssetType('ST')).toBe('stock') })
  it('maps MF → mutual_fund', () => { expect(classifyAssetType('MF')).toBe('mutual_fund') })
  it('returns other for unknown', () => { expect(classifyAssetType('ZZ')).toBe('other') })
  it('returns other for undefined', () => { expect(classifyAssetType()).toBe('other') })
})

describe('parsePtrText', () => {
  it('emits trade rows from mock PTR text', () => {
    const mock = `
Schedule of Transactions
01/05/2025 01/19/2025 P AAPL Apple Inc. $1,001 - $15,000
01/12/2025 01/26/2025 S MSFT Microsoft Corp $15,001 - $50,000
`
    const { trades } = parsePtrText(mock, { filing_year: 2025, source_url: 'https://example/test.pdf' })
    expect(trades.length).toBe(2)
    expect(trades[0]).toMatchObject({
      transaction_type: 'purchase', asset_ticker: 'AAPL', amount_range_low: 1001, amount_range_high: 15000,
    })
    expect(trades[1].transaction_type).toBe('sale')
  })
  it('skips lines that do not match the row regex', () => {
    const mock = 'random unrelated text\nSchedule of Transactions\nmalformed line\n'
    const { trades } = parsePtrText(mock, { filing_year: 2025, source_url: 'x' })
    expect(trades.length).toBe(0)
  })
})

describe('parseFdText', () => {
  it('returns empty arrays when no schedules found', () => {
    const { holdings, other } = parseFdText('no schedules here', { filing_year: 2024, source_url: 'x' })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
  })
  // Per-schedule tests added once parseScheduleA/C/H/I are implemented at scaffold.
})
```

- [ ] **Step 7: Write `shared/senate-agreement.test.ts`** — mock-fetch unit tests

```ts
import { describe, expect, it, vi } from 'vitest'
import { acceptSenateAgreement } from './senate-agreement.ts'

describe('acceptSenateAgreement', () => {
  it('extracts CSRF token + cookie from landing then POSTs agreement', async () => {
    const landingHtml = '<form><input name="csrfmiddlewaretoken" value="abc123" /></form>'
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: () => Promise.resolve(landingHtml),
        headers: { get: () => 'csrftoken=cookie-abc123; Path=/; HttpOnly' } as unknown as Headers,
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const session = await acceptSenateAgreement({ fetcher: fetcher as unknown as typeof fetch })
    expect(session.csrfToken).toBe('abc123')
    expect(session.cookie).toBe('csrftoken=cookie-abc123')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('throws when CSRF token not found', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('<form></form>'),
      headers: { get: () => '' },
    })
    await expect(acceptSenateAgreement({ fetcher: fetcher as unknown as typeof fetch }))
      .rejects.toThrow(/CSRF token not found/)
  })

  it('throws when landing fetch fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('') })
    await expect(acceptSenateAgreement({ fetcher: fetcher as unknown as typeof fetch }))
      .rejects.toThrow(/landing fetch failed/)
  })
})
```

- [ ] **Step 8: Run scoped tests + typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run federal-disclosures/shared
pnpm -r typecheck
```

Expected: shared/* tests green (~15-20 cases); typecheck 11/11 green.

- [ ] **Step 9: Commit Task 2**

```bash
git add packages/db/supabase/seed/federal-disclosures/shared/
git commit -m "$(cat <<'EOF'
feat(seed): slice 26 task 2 — federal-disclosures/shared helpers

Shared infrastructure for slice 26 Tasks 3-6:
- types.ts: NormalizedPtr / NormalizedHolding / NormalizedDisclosureOther
  + PtrAdapter / FdAdapter interfaces (slice 22 onSkip pattern)
- pdf-parsers.ts: classifyAmountRange / classifyTransactionType /
  classifyAssetType + parsePtrText + parseFdText (combined Schedule A/C/H/I
  walker; D/E/F/G deferred to follow-up per spec Risk #5)
- senate-agreement.ts: 2-step CSRF + prohibition_agreement POST flow
  (browser UA per Gotcha #18; cheerio extraction)
- house-zip.ts: yearly ZIP download + extraction via existing workspace
  unzipper dep; emits HouseFiling[] manifest

Mock-text-only tests per slice 19+20 convention (no real PDF binaries
committed). 15+ new vitest cases in shared/.

Per spec: docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: PTR adapters + orchestrator

**Files:**
- Create: `packages/db/supabase/seed/federal-disclosures/ptr/house-efd.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/ptr/senate-efpfd.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/ptr/index.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/ptr/house-efd.test.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/ptr/senate-efpfd.test.ts`
- Create: `packages/db/supabase/seed/federal-ptrs-ingest.ts`
- Create: `packages/db/supabase/seed/federal-ptrs-ingest.test.ts`
- Modify: `packages/db/package.json` (add `seed:federal-ptrs` script)

- [ ] **Step 1: Write `ptr/house-efd.ts`**

```ts
import { extractPdfText } from '../../shared/pdf.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { parsePtrText } from '../shared/pdf-parsers.ts'
import type { PtrAdapter, NormalizedPtr } from '../shared/types.ts'

export const houseEfdPtr: PtrAdapter = {
  slug: 'house-efd-ptr',
  async fetchTransactions(opts) {
    let manifest
    try {
      manifest = await fetchHouseDisclosureZip({
        year: opts.year, formType: 'ptr', fetcher: opts.fetcher,
      })
    } catch (err: any) {
      opts.onSkip?.({ stage: 'fetch', reason: `house-ptr ZIP fetch ${opts.year}: ${err?.message ?? err}` })
      return []
    }
    const out: NormalizedPtr[] = []
    for (const f of manifest.filings) {
      let text = ''
      try {
        text = await extractPdfText(f.pdfBytes)
      } catch (err: any) {
        opts.onSkip?.({ stage: 'extract', reason: `house-ptr ${f.filingId}: ${err?.message ?? err}` })
        continue
      }
      if (!text) {
        opts.onSkip?.({ stage: 'extract', reason: `house-ptr ${f.filingId}: empty extract` })
        continue
      }
      const { trades } = parsePtrText(text, { filing_year: opts.year, source_url: f.pdfUrl })
      if (trades.length === 0) {
        opts.onSkip?.({ stage: 'parse', reason: `house-ptr ${f.filingId}: zero trades` })
        continue
      }
      for (let i = 0; i < trades.length; i++) {
        out.push({
          ...trades[i],
          official_bioguide_id: f.bioguideId,
          official_full_name:   f.fullName,
          external_id:          `house-ptr-${f.filingId}-${i + 1}`,
        })
      }
    }
    return out
  },
}
```

- [ ] **Step 2: Write `ptr/senate-efpfd.ts`**

```ts
import { extractPdfText } from '../../shared/pdf.ts'
import { fetchPdf } from '../../shared/pdf.ts'
import { acceptSenateAgreement, searchSenateEfpfd } from '../shared/senate-agreement.ts'
import { parsePtrText } from '../shared/pdf-parsers.ts'
import type { PtrAdapter, NormalizedPtr } from '../shared/types.ts'

const THROTTLE_MS = 1000

export const senateEfpfdPtr: PtrAdapter = {
  slug: 'senate-efpfd-ptr',
  async fetchTransactions(opts) {
    let session
    try {
      session = await acceptSenateAgreement({ fetcher: opts.fetcher })
    } catch (err: any) {
      opts.onSkip?.({ stage: 'fetch', reason: `senate agreement gate: ${err?.message ?? err}` })
      return []
    }
    let results
    try {
      results = await searchSenateEfpfd({
        session, reportType: '7c', year: opts.year, fetcher: opts.fetcher,
      })
    } catch (err: any) {
      opts.onSkip?.({ stage: 'fetch', reason: `senate ptr search ${opts.year}: ${err?.message ?? err}` })
      return []
    }
    const out: NormalizedPtr[] = []
    for (let n = 0; n < results.length; n++) {
      const r = results[n]
      let pdfBytes
      try {
        pdfBytes = await fetchPdf(r.pdfUrl)
      } catch (err: any) {
        opts.onSkip?.({ stage: 'fetch', reason: `senate-ptr ${r.filingId} pdf: ${err?.message ?? err}` })
        continue
      }
      const text = await extractPdfText(pdfBytes)
      if (!text) {
        opts.onSkip?.({ stage: 'extract', reason: `senate-ptr ${r.filingId}: empty extract` })
        continue
      }
      const { trades } = parsePtrText(text, { filing_year: opts.year, source_url: r.pdfUrl })
      if (trades.length === 0) {
        opts.onSkip?.({ stage: 'parse', reason: `senate-ptr ${r.filingId}: zero trades` })
        continue
      }
      for (let i = 0; i < trades.length; i++) {
        out.push({
          ...trades[i],
          official_full_name: r.fullName,
          external_id:        `senate-ptr-${r.filingId}-${i + 1}`,
        })
      }
      // Throttle between filings (skip after last)
      if (n + 1 < results.length) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_MS))
      }
    }
    return out
  },
}
```

- [ ] **Step 3: Write `ptr/index.ts`** — orchestrator dispatch

```ts
import type { PtrAdapter } from '../shared/types.ts'
import { houseEfdPtr }    from './house-efd.ts'
import { senateEfpfdPtr } from './senate-efpfd.ts'

export const PTR_ADAPTERS: PtrAdapter[] = [houseEfdPtr, senateEfpfdPtr]
```

- [ ] **Step 4: Write adapter tests (`ptr/house-efd.test.ts` + `ptr/senate-efpfd.test.ts`)**

Each test file mocks the shared helpers (`fetchHouseDisclosureZip` / `acceptSenateAgreement` / `searchSenateEfpfd` / `fetchPdf` / `extractPdfText`) and asserts:
- Happy path: emits expected NormalizedPtr count + correct external_id format
- Empty extract: onSkip called with stage='extract'
- Zero-trades parse: onSkip called with stage='parse'
- Fetch failure: onSkip called with stage='fetch'; returns []

Use the slice 22 `createSkipCollector` to capture skip events in test.

- [ ] **Step 5: Write `federal-ptrs-ingest.ts`** — CLI orchestrator

Follows the pattern of `state-finance-ingest.ts` / `federal-community-mobilize-ingest.ts`:
- Parse CLI args: `--year`, `--chamber=house|senate|all`, `--instrument`, `--no-apply`
- Default loop: current year + 1 prior
- For each year + adapter:
  - Call `adapter.fetchTransactions({ year, onSkip: collector.onSkip })`
  - Resolve official_id via bioguide OR `resolveOfficialByName`
  - UPSERT into `stock_transactions` via `(source, external_id) UNIQUE`
- Print skip summary if `--instrument`
- Exit code: 0 success, non-zero on uncaught throws

Skeleton:

```ts
#!/usr/bin/env tsx
import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { createSkipCollector, formatSkipSummary } from './shared/instrumentation.ts'
import { resolveOfficialByName } from './shared/officials.ts'
import { PTR_ADAPTERS } from './federal-disclosures/ptr/index.ts'

interface Opts {
  year?:     number
  chamber:   'house' | 'senate' | 'all'
  instrument: boolean
  noApply:    boolean
}

function parseArgs(): Opts { /* ... */ }

export async function ingestFederalPtrs(opts: Opts & { client?: Client }) {
  const client = opts.client ?? new Client({ connectionString: SUPABASE_DB_URL })
  // ... iterate PTR_ADAPTERS filtered by opts.chamber
  // ... apply year(s)
  // ... build collector, dispatch each adapter
  // ... resolve official_id, UPSERT into stock_transactions
  return { inserted, skipped: collector.summary() }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const opts = parseArgs()
  ingestFederalPtrs(opts).then(...)
}
```

Full implementation per `state-finance-ingest.ts` precedent.

- [ ] **Step 6: Write `federal-ptrs-ingest.test.ts`** — integration smoke

Mock fetchers + assert orchestrator pipeline:
- Apply mode: rows land in stock_transactions
- --no-apply mode: zero rows written; skip summary captured
- --instrument prints summary
- --chamber=house filter only runs houseEfdPtr

- [ ] **Step 7: Add `seed:federal-ptrs` script to `packages/db/package.json`**

```diff
   "scripts": {
+    "seed:federal-ptrs": "tsx supabase/seed/federal-ptrs-ingest.ts",
     "seed:federal-fds":  "tsx supabase/seed/federal-fds-ingest.ts",  // Task 6
     ...
```

(Add the `federal-fds` script in Task 6.)

- [ ] **Step 8: Run scoped tests + typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run federal-disclosures/ptr federal-ptrs-ingest
pnpm -r typecheck
```

Expected: 10-15 new test cases green; typecheck 11/11.

- [ ] **Step 9: Commit Task 3**

```bash
git add packages/db/supabase/seed/federal-disclosures/ptr/ \
        packages/db/supabase/seed/federal-ptrs-ingest.ts \
        packages/db/supabase/seed/federal-ptrs-ingest.test.ts \
        packages/db/package.json
git commit -m "$(cat <<'EOF'
feat(seed): slice 26 task 3 — federal PTR adapters + ingest orchestrator

- ptr/house-efd.ts: yearly ZIP → per-PDF parse → NormalizedPtr[]
- ptr/senate-efpfd.ts: 2-step agreement + per-filing PDF + 1-req/sec throttle
- ptr/index.ts: PTR_ADAPTERS dispatch array
- federal-ptrs-ingest.ts: CLI orchestrator (--year / --chamber / --instrument /
  --no-apply); resolves official_id by bioguide OR full_name; UPSERTs into
  stock_transactions via (source, external_id) UNIQUE
- pnpm seed:federal-ptrs --year=2025 [--chamber=house|senate|all]
- ~10-15 new vitest cases

Slice 22 instrumentation framework (onSkip) wired into all silent-skip
sites: fetch / extract / parse / resolve / filter stages.

Per spec: docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: FD adapters + orchestrator

**Files:**
- Create: `packages/db/supabase/seed/federal-disclosures/fd/house-efd.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/fd/senate-efpfd.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/fd/index.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/fd/house-efd.test.ts`
- Create: `packages/db/supabase/seed/federal-disclosures/fd/senate-efpfd.test.ts`
- Create: `packages/db/supabase/seed/federal-fds-ingest.ts`
- Create: `packages/db/supabase/seed/federal-fds-ingest.test.ts`
- Modify: `packages/db/package.json` (add `seed:federal-fds` script)

Same shape as Task 3 but combined-parser pattern. Each adapter `fetchDisclosures` returns `{ holdings: NormalizedHolding[], other: NormalizedDisclosureOther[] }`. Orchestrator writes to BOTH new tables.

- [ ] **Step 1: Write `fd/house-efd.ts`**

```ts
import { extractPdfText } from '../../shared/pdf.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { parseFdText } from '../shared/pdf-parsers.ts'
import type { FdAdapter, NormalizedHolding, NormalizedDisclosureOther } from '../shared/types.ts'

export const houseEfdFd: FdAdapter = {
  slug: 'house-efd-fd',
  async fetchDisclosures(opts) {
    let manifest
    try {
      manifest = await fetchHouseDisclosureZip({
        year: opts.year, formType: 'fd', fetcher: opts.fetcher,
      })
    } catch (err: any) {
      opts.onSkip?.({ stage: 'fetch', reason: `house-fd ZIP ${opts.year}: ${err?.message ?? err}` })
      return { holdings: [], other: [] }
    }
    const holdings: NormalizedHolding[] = []
    const other:    NormalizedDisclosureOther[] = []
    for (const f of manifest.filings) {
      let text = ''
      try { text = await extractPdfText(f.pdfBytes) }
      catch (err: any) {
        opts.onSkip?.({ stage: 'extract', reason: `house-fd ${f.filingId}: ${err?.message ?? err}` })
        continue
      }
      if (!text) {
        opts.onSkip?.({ stage: 'extract', reason: `house-fd ${f.filingId}: empty extract` })
        continue
      }
      const parsed = parseFdText(text, { filing_year: opts.year, source_url: f.pdfUrl })
      for (let i = 0; i < parsed.holdings.length; i++) {
        holdings.push({
          ...parsed.holdings[i],
          official_bioguide_id: f.bioguideId,
          official_full_name:   f.fullName,
          external_id:          `house-fd-${f.filingId}-A-${i + 1}`,
        })
      }
      for (let i = 0; i < parsed.other.length; i++) {
        const row = parsed.other[i]
        other.push({
          ...row,
          official_bioguide_id: f.bioguideId,
          official_full_name:   f.fullName,
          external_id:          `house-fd-${f.filingId}-${schedLetterFor(row.category)}-${i + 1}`,
        })
      }
    }
    return { holdings, other }
  },
}

function schedLetterFor(cat: NormalizedDisclosureOther['category']): string {
  return {
    liability: 'C', position: 'D', agreement: 'E',
    compensation: 'F', honoraria: 'G', gift: 'H', travel: 'I',
  }[cat]
}
```

- [ ] **Step 2: Write `fd/senate-efpfd.ts`** — same shape; uses `acceptSenateAgreement` + `searchSenateEfpfd` with `reportType: '11'`.

- [ ] **Step 3: Write `fd/index.ts`** — `FD_ADAPTERS` dispatch array.

- [ ] **Step 4: Write FD adapter tests** — mirror Task 3 Step 4 pattern with combined return shape.

- [ ] **Step 5: Write `federal-fds-ingest.ts`** — CLI orchestrator writing to BOTH new tables:

```ts
// For each FD adapter:
const { holdings, other } = await adapter.fetchDisclosures({ year, fetcher, onSkip })
// Resolve official_id, UPSERT holdings → federal_holdings + other → federal_disclosure_other
```

- [ ] **Step 6: Write `federal-fds-ingest.test.ts`** — integration smoke (same shape as PTR ingest test).

- [ ] **Step 7: Add `seed:federal-fds` script to `packages/db/package.json`**

- [ ] **Step 8: Run scoped tests + typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run federal-disclosures/fd federal-fds-ingest
pnpm -r typecheck
```

- [ ] **Step 9: Commit Task 4** — analogous to Task 3 commit message.

---

## Task 5: @chiaro/officials TS surface for new tables

**Files:**
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/queries.ts`
- Modify: `packages/officials/src/keys.ts`
- Modify: `packages/officials/src/hooks.ts`

- [ ] **Step 1: Add type aliases to `types.ts`**

```ts
export type FederalHolding         = Database['public']['Tables']['federal_holdings']['Row']
export type FederalDisclosureOther = Database['public']['Tables']['federal_disclosure_other']['Row']
```

Place alongside existing federal type aliases.

- [ ] **Step 2: Add fetchers to `queries.ts`**

```ts
export async function fetchOfficialHoldings(
  client: ChiaroClient, officialId: string
): Promise<FederalHolding[]> {
  const { data, error } = await client
    .from('federal_holdings')
    .select('*')
    .eq('official_id', officialId)
    .order('filing_year', { ascending: false })
    .order('value_max',   { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function fetchOfficialDisclosureOther(
  client: ChiaroClient, officialId: string
): Promise<FederalDisclosureOther[]> {
  const { data, error } = await client
    .from('federal_disclosure_other')
    .select('*')
    .eq('official_id', officialId)
    .order('filing_year', { ascending: false })
    .order('category',    { ascending: true })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 3: Add key factories to `keys.ts`**

```ts
export const officialKeys = {
  // ... existing keys
  holdings:           (id: string) => ['official', id, 'holdings'] as const,
  disclosureOther:    (id: string) => ['official', id, 'disclosure-other'] as const,
}
```

- [ ] **Step 4: Add hooks to `hooks.ts`**

```ts
export function useOfficialHoldings(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: officialKeys.holdings(officialId),
    queryFn:  () => fetchOfficialHoldings(client, officialId),
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  })
}

export function useOfficialDisclosureOther(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: officialKeys.disclosureOther(officialId),
    queryFn:  () => fetchOfficialDisclosureOther(client, officialId),
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  })
}
```

- [ ] **Step 5: Add integration tests in `packages/officials/test/queries.integration.test.ts`** — mirror existing test patterns for stock_transactions queries:
- Seed federal_holdings + federal_disclosure_other rows for a test official
- Assert fetcher returns correct rows + ordering

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials exec vitest run
pnpm -r typecheck
```

- [ ] **Step 7: Commit Task 5**

```bash
git add packages/officials/src/types.ts packages/officials/src/queries.ts \
        packages/officials/src/keys.ts packages/officials/src/hooks.ts \
        packages/officials/test/queries.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(officials): slice 26 task 5 — federal_holdings + federal_disclosure_other TS surface

- types.ts: FederalHolding + FederalDisclosureOther row aliases from Database
- queries.ts: fetchOfficialHoldings + fetchOfficialDisclosureOther
  (single-step PostgREST per slice 13 federal queries precedent)
- keys.ts: officialKeys.holdings + officialKeys.disclosureOther factories
- hooks.ts: useOfficialHoldings + useOfficialDisclosureOther (5min stale /
  30min gc — slice 10 TanStack convention)
- Integration tests assert ordering by filing_year DESC + value_max DESC
  (holdings) and filing_year DESC + category (other)

Per spec: docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: UI — list components + FederalEthicsAccountabilityCard expansion

**Files:**
- Create: `packages/officials-ui/src/federal/FederalHoldingsList.tsx`
- Create: `packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx`
- Create: `packages/officials-ui/test/federal/FederalHoldingsList.test.tsx`
- Create: `packages/officials-ui/test/federal/FederalDisclosureOtherList.test.tsx`
- Modify: `packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx`
- Modify: `packages/officials-ui/src/index.ts` (barrel exports)
- Modify: `packages/officials-ui/test/federal/FederalEthicsAccountabilityCard.test.tsx`

- [ ] **Step 1: Write `FederalHoldingsList.tsx`** — mirror existing `FederalStockTransactionsList.tsx` shape

```tsx
'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { FederalHolding } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'n/a'
  const fmt = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export interface FederalHoldingsListProps {
  rows: FederalHolding[]
}

export function FederalHoldingsList({ rows }: FederalHoldingsListProps): React.JSX.Element {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No holdings on file.</Text>
  }
  // Group by filing_year for sectioned rendering
  const byYear = new Map<number, FederalHolding[]>()
  for (const r of rows) {
    const list = byYear.get(r.filing_year) ?? []
    list.push(r); byYear.set(r.filing_year, list)
  }
  const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a)
  return (
    <View style={styles.list}>
      {sortedYears.map(year => (
        <View key={year} style={styles.section}>
          <Text style={styles.yearHeading}>{year}</Text>
          {byYear.get(year)!.map(r => {
            const low = r.value_min == null ? null : Number(r.value_min)
            const high = r.value_max == null ? null : Number(r.value_max)
            return (
              <Pressable
                key={r.id}
                onPress={() => Linking.openURL(r.source_url).catch(() => {})}
                style={styles.row}
                accessibilityRole="link"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.asset_name ?? 'Unknown asset'}</Text>
                  {r.asset_ticker && <Text style={styles.ticker}>{r.asset_ticker}</Text>}
                  {r.asset_type && <Text style={styles.muted}>{r.asset_type}</Text>}
                </View>
                <Text style={styles.amount}>{formatAmountRange(low, high)}</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list:        { gap: 12 },
  section:     { gap: 6 },
  yearHeading: { fontSize: 14, fontWeight: '600', color: COLORS.brand.text },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  name:        { fontSize: 13, color: COLORS.brand.text },
  ticker:      { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  muted:       { fontSize: 12, color: COLORS.neutral.textMuted },
  amount:      { fontSize: 13, fontWeight: '600', color: COLORS.brand.text },
})
```

- [ ] **Step 2: Write `FederalDisclosureOtherList.tsx`** — grouped by category, then filing_year

Similar shape; category as section header (e.g. "Gifts", "Travel", "Liabilities") with rows underneath. Use a category label map:

```tsx
const CATEGORY_LABEL: Record<FederalDisclosureOther['category'], string> = {
  gift: 'Gifts',
  travel: 'Travel',
  position: 'Positions',
  agreement: 'Agreements',
  liability: 'Liabilities',
  compensation: 'Compensation',
  honoraria: 'Honoraria',
}
```

Each row: `description` (asset/source) + `source_party` (giver/payer) + value (range from value_min/max OR value_text).

- [ ] **Step 3: Modify `FederalEthicsAccountabilityCard.tsx`** — add 2 new collapsible subsections

```tsx
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
  useOfficialHoldings,            // NEW
  useOfficialDisclosureOther,     // NEW
} from '@chiaro/officials'
// ...
import { FederalHoldingsList }         from './FederalHoldingsList.tsx'
import { FederalDisclosureOtherList }  from './FederalDisclosureOtherList.tsx'

// Inside the component:
const holdings = useOfficialHoldings(client, officialId)
const other    = useOfficialDisclosureOther(client, officialId)

const [openHoldings, setOpenHoldings] = useState(false)
const [openOther,    setOpenOther]    = useState(false)

// Loading state guard: extend to include holdings + other
if (metrics.isLoading || stock.isLoading || holdings.isLoading || other.isLoading) { ... }

// Add 2 new <CardSubsection> blocks after existing Trades subsection
<CardSubsection
  title={`Holdings (${holdings.data?.length ?? 0})`}
  expanded={openHoldings}
  onToggle={() => setOpenHoldings(v => !v)}
>
  <FederalHoldingsList rows={holdings.data ?? []} />
</CardSubsection>

<CardSubsection
  title={`Other Disclosures (${other.data?.length ?? 0})`}
  expanded={openOther}
  onToggle={() => setOpenOther(v => !v)}
>
  <FederalDisclosureOtherList rows={other.data ?? []} />
</CardSubsection>
```

- [ ] **Step 4: Add barrel exports to `packages/officials-ui/src/index.ts`**

```ts
export { FederalHoldingsList,        type FederalHoldingsListProps }        from './federal/FederalHoldingsList.tsx'
export { FederalDisclosureOtherList, type FederalDisclosureOtherListProps } from './federal/FederalDisclosureOtherList.tsx'
```

Place alongside existing `FederalStockTransactionsList` export.

- [ ] **Step 5: Write component tests for `FederalHoldingsList` + `FederalDisclosureOtherList`**

For each:
- Renders empty state when `rows={[]}`
- Renders grouped sections (holdings by year; other by category)
- Formats value ranges correctly
- `accessibilityRole="link"` on Pressable rows (smart-anchor pattern from slice 18 M6 → slice 25)

Direct-DOM-attribute assertions per slice 14 Gotcha #22 + slice 25 patterns.

- [ ] **Step 6: Update `FederalEthicsAccountabilityCard.test.tsx`** — add assertions for new subsections appearing with row counts.

- [ ] **Step 7: Run scoped tests + typecheck + web build**

```bash
pnpm --filter @chiaro/officials-ui exec vitest run federal
pnpm -r typecheck
pnpm --filter @chiaro/web build
```

Expected: ~12 new test cases; typecheck 11/11; web build green; `/officials/[id]` bundle delta ≤ +10kB.

- [ ] **Step 8: Commit Task 6**

```bash
git add packages/officials-ui/src/federal/FederalHoldingsList.tsx \
        packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx \
        packages/officials-ui/test/federal/FederalHoldingsList.test.tsx \
        packages/officials-ui/test/federal/FederalDisclosureOtherList.test.tsx \
        packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx \
        packages/officials-ui/test/federal/FederalEthicsAccountabilityCard.test.tsx \
        packages/officials-ui/src/index.ts
git commit -m "$(cat <<'EOF'
feat(officials-ui): slice 26 task 6 — Holdings + Other Disclosures subsections

FederalEthicsAccountabilityCard gains 2 new collapsible subsections via
CardSubsection (slice 14 Gotcha #22 aria-expanded pattern):
- Holdings: grouped by filing_year DESC; asset_name + ticker + type + value range
- Other Disclosures: grouped by category (gifts/travel/positions/etc.) then year

Federal/state UI asymmetry intentional (Gotcha #15): federal has 1
Ethics card with 4 subsections; state has 2 cards. Reasoning is unchanged.

- FederalHoldingsList + FederalDisclosureOtherList list components
  (mirror FederalStockTransactionsList convention)
- Pressable rows with accessibilityRole="link" (slice 18 M6 / slice 25 smart-anchor pattern)
- ~12 new vitest cases including aria-* direct-DOM assertions

/officials/[id] bundle delta: <+10kB per spec verify gate.

Per spec: docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Closure — CLAUDE.md slice entry + Gotcha entries + memory

**Files:**
- Modify: `CLAUDE.md` (slice 26 entry + Gotcha entries if surfaced)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice26_federal_stock_disclosures.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Append slice 26 entry to `CLAUDE.md` `## Slices delivered`**

After slice 25 entry, append:

```markdown
- **Slice 26 — Federal stock_transactions + annual FD production parsers** (2026-05-26): Mega-Slice (~32 files). Closes the slice 8 federal/state asymmetry that left `stock_transactions` schema-wired but adapter-less. 4 production parsers (House EFD + Senate EFPFD × PTR + annual FD). Migrations 0054 (`federal_holdings` + `federal_disclosure_other` tables, +20 pgTAP plans) + 0055 (RLS). House uses yearly bulk ZIP downloads (`public_disc/{ptr|financial}-pdfs/{year}.zip`) via existing workspace `unzipper` dep. Senate uses 2-step `acceptSenateAgreement` POST flow (CSRF token + `prohibition_agreement=1`) + per-filing PDF fetch with 1-req/sec throttle. Combined-parser pattern for FDs (slice 16 precedent): 1 PDF → `{ holdings, other }` written to both new tables. Slice 22+23 instrumentation framework wired throughout (6-stage SkipReason via onSkip + `--instrument` + `--no-apply` CLI flags). New CLI scripts: `pnpm seed:federal-ptrs --year=2025` + `pnpm seed:federal-fds --year=2024`. UI: `FederalEthicsAccountabilityCard` gains 2 new collapsible subsections (Holdings, Other Disclosures) — card grows from 2 to 4 subsections; federal/state UI asymmetry per Gotcha #15 stays intentional. New shared list components: `FederalHoldingsList` + `FederalDisclosureOtherList`. ~46 new vitest cases (784 → ~830) + 12 officials-ui (258 → ~270) + 20 pgTAP (402 → ~422). New TS surface in @chiaro/officials: `FederalHolding`, `FederalDisclosureOther`, `useOfficialHoldings`, `useOfficialDisclosureOther`.
```

- [ ] **Step 2: Add new Gotcha entries** if implementer surfaces durable lessons. Likely candidates:

- **#27 — Senate EFPFD agreement gate is a stable POST contract.** Document the 2-step flow + CSRF token + `prohibition_agreement=1` body. Flag pattern as the canonical workaround for similar government anti-bot agreement gates.
- **#28 — House EFD ZIP manifest structure.** Document the year/path conventions + how `unzipper` is used to extract per-filing PDFs + index.

(Implementer decides at scaffold whether to add these. The audit-into-Gotcha pattern from slice 25 + slice 18 applies — add ONLY if non-obvious.)

- [ ] **Step 3: Write memory file**

Use Write tool with absolute path `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice26_federal_stock_disclosures.md`. Content template (filling `<squash SHA>` post-merge):

```markdown
---
name: project-chiaro-slice26-federal-stock-disclosures
description: Slice 26 — federal stock_transactions + annual FD production parsers (House + Senate)
metadata:
  type: project
---

Slice 26 shipped 2026-05-26 — merged locally to master as squash `<squash SHA>`. Mega-Slice tier (~32 files). Closes the slice 8 federal/state asymmetry that left federal stock_transactions schema-wired without adapters.

**What shipped:**
- 4 production parsers (House EFD + Senate EFPFD × PTR + annual FD)
- 2 new federal tables: federal_holdings + federal_disclosure_other (migration 0054 + 0055 RLS; 20 pgTAP plans)
- House yearly ZIP download via existing workspace `unzipper`
- Senate 2-step agreement-gate POST + per-filing PDF + 1-req/sec throttle
- Combined-parser pattern for FDs (slice 16 precedent: 1 PDF → 2 schema sinks)
- 2 new CLI scripts: seed:federal-ptrs + seed:federal-fds
- Slice 22+23 instrumentation framework wired (onSkip + --instrument + --no-apply)
- @chiaro/officials TS surface: FederalHolding + FederalDisclosureOther + 2 hooks
- @chiaro/officials-ui: FederalHoldingsList + FederalDisclosureOtherList + 2 new card subsections

**Durable lessons:**

1. **Senate EFPFD agreement gate is a stable POST contract.** 2-step flow: GET landing → extract csrfmiddlewaretoken + Set-Cookie csrftoken → POST `/search/home/` with form-encoded `csrfmiddlewaretoken={token}` + `prohibition_agreement=1` + Cookie header. Browser-style User-Agent required (slice 9 Gotcha #18 convention). Module-level session cache works for per-run reuse. If gate proves untractable, deprecate per slice 11+21 precedent — don't pivot to Playwright/Puppeteer.

2. **Federal/state schema asymmetry is intentional.** State side has no STOCK Act analogue (slice 13 + Gotcha #21) — stock data buried in annual FDs, so state_financial_disclosures absorbs it. Federal side has PTRs as separate STOCK Act filings AND annual FDs with non-stock content (gifts, travel, etc.) — slice 26 splits annual content into 2 normalized tables (holdings + other) rather than mimicking state's single-table category-discriminator approach. If future query patterns regret the split, a view can union them.

3. **House yearly bulk ZIP is much cleaner than per-filing scrape.** disclosures-clerk.house.gov publishes `public_disc/{ptr|financial}-pdfs/{year}.zip` archives containing N PDFs + an XML manifest mapping filing IDs to bioguide IDs. Single download per year-chamber-form-type combination eliminates per-filing HTTP fetches + their rate-limit risk. Senate has no equivalent bulk download; per-filing scrape is the only option.

4. **Combined-parser pattern (1 PDF → 2 sinks) extends from slice 16 NY COELIG.** The federal FD parser walks 9 schedules (A through I) and emits `{ holdings, other }` arrays. The orchestrator UPSERTs each into its respective table. Same `(source, external_id) UNIQUE WHERE external_id IS NOT NULL` dedup semantics on each table.

5. **PDF parser conservative under-reporting is acceptable.** Annual FDs have heterogeneous formatting per filer; the section walker can't catch every line item. v1 ships Schedule A + C + H + I (highest-value categories); D/E/F/G are explicit follow-ups. Under-reporting (zero rows for a schedule) is acceptable; over-reporting (false rows) is not. Mirrors slice 5F bills_passed_count heuristic acceptance.

6. **External_id format determinism is load-bearing for UPSERT.** Format: `{adapter-slug}-{filing-id}-{schedule-letter}-{line-no}` for FDs; `{adapter-slug}-{filing-id}-{line-no}` for PTRs. Filing-id is derivable from House XML manifest or Senate filing-detail URL. If filings get re-uploaded with same ID but different content, UPSERT overwrites — v1 trade-off documented.

7. **Pre-slice-8 `source='legacy'` rows co-exist with new ingest.** UPSERT against `(source, external_id) UNIQUE` doesn't dedup across source values. Operator can do a cleanup pass later if duplication surfaces. Not in scope for slice 26.

8. **Bundle delta for officials route is forecastable.** 2 new list components + 2 card subsections ≈ +5-8kB on `/officials/[id]`. Slice 10 RNW conversion already absorbed the main cost; subsequent UI extensions are cheap.

**Active follow-ups (operator):**
- Schedule D/E/F/G FD walkers (real-world PDF surveying needed first)
- Operator schedules production-run instrumentation pass against slice 26 adapters (slice 22 framework: `--instrument --no-apply` against 2024+2025)
- Possible cleanup of pre-slice-8 `source='legacy'` rows in stock_transactions
- LCV-OR + PP × 5 anti-bot probe (slice 11 carryover)
- party_unity_state real implementation (slice 5F carryover)
- NH multi-word district codes (slice 5C carryover)
- Mobile DoD on-device smoke (blocked on EAS APK + Apple Developer credentials)

**Master state at slice 26 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0055; pgTAP 402 → ~422 plans. @chiaro/db test count: 784 → ~830 (+~46). @chiaro/officials-ui: 258 → ~270 (+~12).

**Cross-links:** [[project-chiaro-slice8-federal-parity]] (federal stock_transactions schema parity origin this slice closes), [[project-chiaro-slice13-stock-cleanup]] (Gotcha #21 + state schema rationale), [[project-chiaro-slice16-ca-mi-tx-parsers]] (combined-parser pattern), [[project-chiaro-slice19-pdf-parsing-mi-pfd]] (pdf module canonical entry), [[project-chiaro-slice20-ny-fds-tx-tec-pdfs]] (PDF parsing patterns), [[project-chiaro-slice22-instrumentation]] (onSkip framework). Spec: `docs/superpowers/specs/2026-05-26-federal-stock-disclosures-design.md`.
```

- [ ] **Step 4: Update `MEMORY.md` index** — append after slice 25 line:

```markdown
- [Chiaro slice 26 federal stock + annual FD parsers](project_chiaro_slice26_federal_stock_disclosures.md) — Mega-Slice (~32 files). 4 production parsers (House + Senate × PTR + FD). 2 new federal tables (holdings + other). House bulk ZIP via unzipper; Senate 2-step agreement-gate POST + 1-req/sec throttle. Combined-parser pattern for FDs. Closes slice 8 deferred adapter work. Migrations 0054+0055.
```

- [ ] **Step 5: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm db:reset
pnpm db:test
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/officials exec vitest run
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm --filter @chiaro/web build
```

Expected:
- typecheck: 11/11 green
- pgTAP: ~422 plans green
- @chiaro/db vitest: ~830 tests green
- @chiaro/officials: existing green + new integration tests
- @chiaro/officials-ui: ~270 tests green
- web build: 12 routes green

- [ ] **Step 6: Commit Task 7** (CLAUDE.md only — memory files outside repo)

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 26 closure — CLAUDE.md entry + Gotcha entries

Mega-Slice (~32 files). Closes the slice 8 federal/state asymmetry —
federal stock_transactions now has real production adapters (House EFD
+ Senate EFPFD × PTR + annual FD).

- 2 new tables: federal_holdings + federal_disclosure_other (0054+0055)
- 4 production parsers + 2 CLI orchestrators
- Slice 22+23 instrumentation framework wired throughout
- UI: 2 new subsections on FederalEthicsAccountabilityCard
- New @chiaro/officials TS surface for new tables

pgTAP: 402 → ~422 plans (+20)
@chiaro/db vitest: 784 → ~830 (+~46)
@chiaro/officials-ui: 258 → ~270 (+~12)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Workspace verify gate (recap)

After all 7 tasks complete:

```bash
pnpm -r typecheck                                          # 11 packages green
pnpm db:reset                                              # apply 0054 + 0055
pnpm db:test                                               # ~422 pgTAP plans green
pnpm --filter @chiaro/db exec vitest run                   # ~830 tests green
pnpm --filter @chiaro/officials exec vitest run            # all green
pnpm --filter @chiaro/officials-ui exec vitest run         # ~270 tests green
pnpm --filter @chiaro/web build                            # 12 routes green
git log master..HEAD --oneline                             # ~9 commits (spec + plan + 7 task commits)
```

---

## Self-review notes

### Spec coverage

- ✅ Migration 0054 (federal_holdings + federal_disclosure_other tables) — Task 1
- ✅ Migration 0055 (RLS) — Task 1
- ✅ pgTAP test files — Task 1
- ✅ Shared types + PDF parsers + Senate agreement + House ZIP — Task 2
- ✅ PTR adapters (House + Senate) + orchestrator + CLI — Task 3
- ✅ FD adapters (House + Senate) + orchestrator + CLI — Task 4
- ✅ @chiaro/officials TS surface — Task 5
- ✅ UI list components + card subsection expansion — Task 6
- ✅ Closure (CLAUDE.md + memory) — Task 7

### Placeholder scan

No "TBD"/"TODO". Plan acknowledges 4 schedules ship in v1 (A, C, H, I); D/E/F/G are explicit follow-ups (per spec Risk #5). `<squash SHA>` placeholder in memory file is the standard slice 14-25 post-merge fill-in.

### Type consistency

- `NormalizedPtr` shape matches `stock_transactions` column set (post slice 8 source/external_id)
- `NormalizedHolding` + `NormalizedDisclosureOther` shapes match new table columns
- `PtrAdapter.slug` + `FdAdapter.slug` type unions match exactly the source values written to DB
- `external_id` format is deterministic + documented per row type
- Helper signatures: `extractPdfText(buffer: Buffer)`, `fetchPdf(url, { timeoutMs? })`, `acceptSenateAgreement`, `searchSenateEfpfd`, `fetchHouseDisclosureZip` — all match the verified slice 19 + new module signatures

### Known incomplete details

- `parseScheduleA/C/H/I` walkers ship as scaffold-time fillers. The plan provides regex placeholders; the implementer refines per real-world PDF sampling at scaffold (no real PDFs committed; mock-text tests stand in). This is by design — accepting Risk #5 (conservative under-reporting).
- House XML manifest structure is best-knowledge at planning; implementer verifies the actual ZIP contents at Task 2 Step 5 scaffold. If manifest is CSV not XML, the parsing logic adapts inline.
- Senate `searchSenateEfpfd` POST body shape needs scaffold-time verification. Plan provides the interface; implementer fills the POST form fields per observed Senate response.
- `<squash SHA>` in memory file gets filled post-merge per slice 14-25 convention.
- Bundle-delta target (+10kB) is forecastable but not exact; web build smoke verifies.

### Subagent decomposition (per Gotcha #25 — sequential implementers)

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7. Each is a separate implementer subagent dispatched serially with full task text + spec context. Two-stage review (spec compliance + code quality) after each implementer, per subagent-driven-development skill.

Task 2 is the largest single-file task (PDF parsers); consider splitting into 2 sub-tasks (helpers + parsers) if the implementer reports complexity exceeds the comfort zone. Task 3 + Task 4 are structurally similar; lessons from Task 3 review carry into Task 4 dispatch.
