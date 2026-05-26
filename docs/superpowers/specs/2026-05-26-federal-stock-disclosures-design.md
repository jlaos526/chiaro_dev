# Slice 26 — Federal stock_transactions + annual financial disclosures design

**Status:** approved 2026-05-26 (verbal — brainstorming flow)
**Builds on:** Slice 8 (federal stock_transactions source/external_id schema parity), slice 9 (HTML-scrape production parser pattern + Gotcha #18), slice 16 (combined-parser pattern: 1 fetch → 2 schema sinks), slice 19 (pdf-parse workspace dep + shared `seed/shared/pdf.ts` helper), slice 20 (PDF-fill patterns: expand-rows vs enrich-rows), slice 22 (instrumentation framework + onSkip).

## Goal

Ship 4 production parsers across 2 chambers × 2 form types, closing the slice 8 federal/state asymmetry that left `stock_transactions` schema-wired but adapter-less. Adds 2 new federal tables for annual financial disclosure (FD) data that doesn't fit the transaction-oriented `stock_transactions` schema.

After this slice:
- Federal `stock_transactions` gets real production data (House + Senate PTRs)
- Federal `federal_holdings` + `federal_disclosure_other` tables (new) get real annual FD data
- `/officials/[id]` `FederalEthicsAccountabilityCard` gains 2 new subsections (Holdings, Other Disclosures)
- Operator runs `pnpm seed:federal-ptrs --year=2025` + `pnpm seed:federal-fds --year=2024`

## Non-goals

- **No state-side parity work.** State has no STOCK Act analogue (slice 13 dropped `state_stock_transactions`); no state holdings table needed (state FDs already use `state_financial_disclosures`).
- **No backfill of pre-2018 data.** PTR filings predate ~2012 but the schema's `external_id` + `(source, external_id)` UNIQUE assumes deterministic IDs only verified for 2018+ filings.
- **No deduplication against pre-slice-8 `source='legacy'` rows.** Legacy rows stay; new ingest writes with adapter-slug source. Operator can manually clean later.
- **No re-flagging of past trades for STOCK Act compliance.** `stock_transactions.days_late` is a generated column; recompute is automatic.
- **No new workspace deps.** Reuses slice 19 `pdf-parse` + cheerio (slice 9).
- **No headless-browser fallback for Senate.** Agreement gate is a form POST (slice 9-style HTML-scrape pattern). If gate proves untractable mid-flight, deprecate Senate FD adapter per slice 11 LCV/AFP precedent and ship House-only.

## Architecture

### Files in scope

```
Migrations ────────────────────────────────────────────────────────────
  packages/db/supabase/migrations/0054_federal_disclosure_tables.sql       NEW
  packages/db/supabase/migrations/0055_federal_disclosure_rls.sql          NEW
  packages/db/supabase/tests/federal_holdings.test.sql                     NEW (~10 plans)
  packages/db/supabase/tests/federal_disclosure_other.test.sql             NEW (~10 plans)

Shared helpers ────────────────────────────────────────────────────────
  packages/db/supabase/seed/federal-disclosures/shared/pdf-parsers.ts      NEW
  packages/db/supabase/seed/federal-disclosures/shared/senate-agreement.ts NEW
  packages/db/supabase/seed/federal-disclosures/shared/house-zip.ts        NEW
  packages/db/supabase/seed/federal-disclosures/shared/types.ts            NEW

PTR adapters (write to stock_transactions) ────────────────────────────
  packages/db/supabase/seed/federal-disclosures/ptr/house-efd.ts           NEW
  packages/db/supabase/seed/federal-disclosures/ptr/senate-efpfd.ts        NEW
  packages/db/supabase/seed/federal-disclosures/ptr/index.ts               NEW
  packages/db/supabase/seed/federal-ptrs-ingest.ts                         NEW (CLI orchestrator)

FD adapters (write to federal_holdings + federal_disclosure_other) ────
  packages/db/supabase/seed/federal-disclosures/fd/house-efd.ts            NEW
  packages/db/supabase/seed/federal-disclosures/fd/senate-efpfd.ts         NEW
  packages/db/supabase/seed/federal-disclosures/fd/index.ts                NEW
  packages/db/supabase/seed/federal-fds-ingest.ts                          NEW (CLI orchestrator)

Tests ─────────────────────────────────────────────────────────────────
  packages/db/supabase/seed/federal-disclosures/ptr/house-efd.test.ts      NEW
  packages/db/supabase/seed/federal-disclosures/ptr/senate-efpfd.test.ts   NEW
  packages/db/supabase/seed/federal-disclosures/fd/house-efd.test.ts       NEW
  packages/db/supabase/seed/federal-disclosures/fd/senate-efpfd.test.ts    NEW
  packages/db/supabase/seed/federal-disclosures/shared/pdf-parsers.test.ts NEW
  packages/db/supabase/seed/federal-disclosures/shared/senate-agreement.test.ts NEW
  packages/db/supabase/seed/federal-ptrs-ingest.test.ts                    NEW
  packages/db/supabase/seed/federal-fds-ingest.test.ts                     NEW

@chiaro/officials TS surface ─────────────────────────────────────────
  packages/officials/src/types.ts                                          MODIFY (+ FederalHolding, FederalDisclosureOther)
  packages/officials/src/queries.ts                                        MODIFY (+ 2 fetchers)
  packages/officials/src/keys.ts                                           MODIFY (+ 2 key factories)
  packages/officials/src/hooks.ts                                          MODIFY (+ 2 useQuery hooks)

UI ────────────────────────────────────────────────────────────────────
  packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx    MODIFY (+ 2 subsections)
  packages/officials-ui/src/federal/FederalHoldingsList.tsx                NEW
  packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx         NEW
  packages/officials-ui/src/index.ts                                       MODIFY (barrel exports)
  packages/officials-ui/test/federal/FederalHoldingsList.test.tsx          NEW
  packages/officials-ui/test/federal/FederalDisclosureOtherList.test.tsx   NEW
  packages/officials-ui/test/federal/FederalEthicsAccountabilityCard.test.tsx  MODIFY (subsection assertions)

Closure ───────────────────────────────────────────────────────────────
  CLAUDE.md                                                                slice 26 entry + Gotcha entries
  memory file + MEMORY.md index                                            (outside repo)
```

### File count: ~30 files. **Mega-Slice tier.**

## Components

### Database

**Migration 0054 — `federal_disclosure_tables.sql`**

```sql
-- Slice 26: federal annual financial disclosure tables. Mirrors state side
-- (state_financial_disclosures from slice 5I) in spirit but uses a more
-- normalized 2-table split (holdings + other) per slice 26 design decision.
-- PTRs continue to write to existing public.stock_transactions; only annual
-- FDs land in these new tables.

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
  'Federal annual financial disclosure holdings (assets owned + income). PTRs (stock transactions) live in stock_transactions; annual FD holdings live here.';
comment on table public.federal_disclosure_other is
  'Federal annual financial disclosure non-stock content (gifts, travel, positions, agreements, liabilities, compensation, honoraria).';
```

**Migration 0055 — `federal_disclosure_rls.sql`**

```sql
alter table public.federal_holdings           enable row level security;
alter table public.federal_disclosure_other   enable row level security;

create policy federal_holdings_select_all
  on public.federal_holdings           for select using (true);
create policy federal_disclosure_other_select_all
  on public.federal_disclosure_other   for select using (true);

revoke insert, update, delete on public.federal_holdings           from anon, authenticated;
revoke insert, update, delete on public.federal_disclosure_other   from anon, authenticated;
```

Mirrors slice 5I 0050 + slice 8 patterns.

**pgTAP test files:**

`federal_holdings.test.sql` — `plan(10)`: table exists, official_id FK ON DELETE RESTRICT, filing_year NOT NULL, asset_type CHECK enum, income_type CHECK enum, unique partial index, btree index, RLS enabled, select policy, DML revoked.

`federal_disclosure_other.test.sql` — same shape with category CHECK enum + RLS.

Total pgTAP delta: 402 → ~422 plans.

### Shared helpers

**`shared/types.ts`** — normalized interfaces emitted by adapters:

```ts
export interface NormalizedPtr {
  // resolution: openstates_person_id n/a for federal; resolve via bioguide_id
  official_bioguide_id?: string
  official_full_name?:   string    // fallback if bioguide_id absent
  filing_year:           number
  transaction_date:      string    // ISO date
  filing_date:           string
  asset_ticker?:         string
  asset_name?:           string
  transaction_type:      'purchase' | 'sale' | 'exchange'
  amount_range_low?:     number
  amount_range_high?:    number
  source_url:            string
  external_id:           string    // adapter-slug-prefixed, deterministic
}

export interface NormalizedHolding {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  asset_name?:           string
  asset_ticker?:         string
  asset_type?:           'stock'|'bond'|'mutual_fund'|'etf'|'trust'|'partnership'|'real_estate'|'cash'|'other'
  value_min?:            number
  value_max?:            number
  income_type?:          'dividends'|'interest'|'capital_gains'|'rent'|'royalties'|'none'|'other'
  income_min?:           number
  income_max?:           number
  source_url:            string
  external_id:           string
}

export interface NormalizedDisclosureOther {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  category:              'gift'|'travel'|'position'|'agreement'|'liability'|'compensation'|'honoraria'
  description?:          string
  source_party?:         string
  value_min?:            number
  value_max?:            number
  value_text?:           string
  source_url:            string
  external_id:           string
}
```

**`shared/pdf-parsers.ts`** — section walkers reused across House + Senate FD adapters. Uses slice 19 `extractPdfText` + `fetchPdf` from `seed/shared/pdf.ts`. Exports:

- `parsePtrText(text)` — walks "Schedule of Transactions" section, emits `{ trades: NormalizedPtr[] }`. Handles asset names (sometimes with `[ST]` / `[OP]` suffixes), `D` (Disposition / sale) vs `P` (Purchase) markers, asset class codes.
- `parseFdText(text)` — combined parser: walks "Schedule A" (holdings) + "Schedule B" (transactions, ignored for FD context) + "Schedule C" (liabilities → `category='liability'`) + "Schedule D" (positions → `position`) + "Schedule E" (agreements → `agreement`) + "Schedule F" (compensation → `compensation`) + "Schedule G" (honoraria → `honoraria`) + "Schedule H" (gifts → `gift`) + "Schedule I" (travel → `travel`). Returns `{ holdings, other }`.
- `classifyAssetType(name, code)` — maps asset codes (e.g. `EF` = exchange fund / ETF, `MF` = mutual fund, `ST` = stock) → enum value.
- `classifyAmountRange(text)` — parses "1,001 - 15,000" / "$50,001 - $100,000" / "Over $1,000,000" → `{ min, max }`.

**`shared/senate-agreement.ts`** — 2-step CSRF + agreement helper:

```ts
export interface SenateSession {
  csrfToken: string
  cookieJar: string
}

export async function acceptSenateAgreement(opts: {
  fetcher?: typeof fetch
}): Promise<SenateSession>

export async function searchSenateEfpfd(opts: {
  session: SenateSession
  reportType: '7c' | '11'  // 11 = annual FD; 7c = PTR
  year:       number
  fetcher?:   typeof fetch
}): Promise<SearchResult[]>

interface SearchResult {
  filingId:   string
  fullName:   string
  reportDate: string
  pdfUrl:     string
}
```

Documents the agreement gate semantics (Senate-only constraint, browser-style UA header per slice 9 + Gotcha #18, throttle 1-req/sec between PDF fetches).

**`shared/house-zip.ts`** — yearly bulk ZIP download + extraction helper:

```ts
export async function fetchHouseDisclosureZip(opts: {
  year:       number
  formType:   'ptr' | 'fd'   // 'ptr-pdfs/{year}.zip' vs 'financial-pdfs/{year}.zip'
  fetcher?:   typeof fetch
}): Promise<HouseZipManifest>

interface HouseZipManifest {
  filings: Array<{
    filingId:    string         // House filing ID from XML index
    bioguideId?: string
    fullName:    string
    pdfBytes:    Uint8Array
    pdfUrl:      string         // canonical URL for source_url field
  }>
}
```

Uses `node:zlib` + a minimal ZIP reader (or workspace `adm-zip` dep — confirm at scaffold; if new dep needed, add to plan). The yearly ZIP includes an XML index manifest mapping filing IDs to bioguide IDs.

### Adapters

**`ptr/house-efd.ts`:**

```ts
import type { StockAdapter, NormalizedPtr } from '../shared/types.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { parsePtrText } from '../shared/pdf-parsers.ts'
import { extractPdfText } from '../../shared/pdf.ts'

export const houseEfdPtr: StockAdapter<NormalizedPtr> = {
  slug: 'house-efd-ptr',
  async fetchTransactions(opts) {
    const manifest = await fetchHouseDisclosureZip({
      year: opts.year, formType: 'ptr', fetcher: opts.fetcher,
    })
    const out: NormalizedPtr[] = []
    for (const f of manifest.filings) {
      try {
        const text = await extractPdfText(f.pdfBytes)
        const { trades } = parsePtrText(text)
        for (let i = 0; i < trades.length; i++) {
          out.push({
            ...trades[i],
            official_bioguide_id: f.bioguideId,
            official_full_name:   f.fullName,
            source_url:           f.pdfUrl,
            external_id:          `house-ptr-${f.filingId}-${i + 1}`,
          })
        }
      } catch (err) {
        opts.onSkip?.({ stage: 'parse', reason: `house-ptr ${f.filingId}: ${err.message}` })
      }
    }
    return out
  },
}
```

**`ptr/senate-efpfd.ts`** — similar shape but uses `acceptSenateAgreement` + `searchSenateEfpfd` + per-filing PDF fetch loop with 1-req/sec throttle.

**`fd/house-efd.ts`** — combined parser pattern (slice 16 precedent). Emits `{ holdings, other }`:

```ts
export const houseEfdFd: FdAdapter = {
  slug: 'house-efd-fd',
  async fetchDisclosures(opts) {
    const manifest = await fetchHouseDisclosureZip({
      year: opts.year, formType: 'fd', fetcher: opts.fetcher,
    })
    const holdings: NormalizedHolding[] = []
    const other:    NormalizedDisclosureOther[] = []
    for (const f of manifest.filings) {
      try {
        const text = await extractPdfText(f.pdfBytes)
        const parsed = parseFdText(text)
        // ... line-numbered external_ids
      } catch (err) {
        opts.onSkip?.({ stage: 'parse', reason: `house-fd ${f.filingId}: ${err.message}` })
      }
    }
    return { holdings, other }
  },
}
```

**`fd/senate-efpfd.ts`** — same shape, Senate fetch path.

**Orchestrator dispatch order:** ptr/index.ts iterates `[houseEfdPtr, senateEfpfdPtr]`; fd/index.ts iterates `[houseEfdFd, senateEfpfdFd]`. Each adapter is isolated — one failure doesn't abort others. UPSERT against `(source, external_id)` UNIQUE.

### CLI orchestrators

**`federal-ptrs-ingest.ts`:**
- `pnpm seed:federal-ptrs --year=2025 [--chamber=house|senate|all] [--instrument] [--no-apply]`
- Default loop: `--year=2025` ingests 2025 + 2024.
- `--chamber` filter; default `all`.
- `--instrument` enables skip-summary output (slice 22 framework).
- `--no-apply` disables DB writes (dry run).

**`federal-fds-ingest.ts`:** same flag shape, writes to both new tables.

### TS surface

**`packages/officials/src/types.ts`** — add:

```ts
export type FederalHolding         = Database['public']['Tables']['federal_holdings']['Row']
export type FederalDisclosureOther = Database['public']['Tables']['federal_disclosure_other']['Row']
```

**`packages/officials/src/queries.ts`** — add 2 fetchers (single-step PostgREST, mirrors slice 13's federal queries):

```ts
export async function fetchOfficialHoldings(
  client: ChiaroClient, officialId: string
): Promise<FederalHolding[]>

export async function fetchOfficialDisclosureOther(
  client: ChiaroClient, officialId: string
): Promise<FederalDisclosureOther[]>
```

Both return rows for the given `official_id`, ordered by `filing_year DESC, value_max DESC`.

**`keys.ts` + `hooks.ts`** — `useOfficialHoldings(officialId)` + `useOfficialDisclosureOther(officialId)` per slice 10 TanStack pattern (5min staleTime / 30min gcTime).

### UI

**`FederalEthicsAccountabilityCard.tsx` expansion:**

Card currently has subsections: STOCK Act compliance + Trades (from `stock_transactions`).

Add: "Holdings" + "Other Disclosures" subsections. The card becomes 4 subsections wide. Per Gotcha #15 reasoning, this is an intentional federal/state asymmetry — state has 2 cards because of recall + ethics complaints data; federal has 1 card with 4 subsections.

Each subsection is wrapped in a `CardSubsection` (slice 14 component) with collapsible `aria-expanded` chevron.

**`FederalHoldingsList.tsx`** — renders holdings rows grouped by `filing_year`. Each row: `asset_name` + `asset_ticker` chip + value range + income type/range. Empty state ("No holdings on file") when query returns `[]`.

**`FederalDisclosureOtherList.tsx`** — renders rows grouped by `category` then `filing_year`. Each row: `description` + `source_party` + value (range or text). Categories surface as pill labels (`COLORS.brand.text` + `COLORS.neutral.surface` per ui-tokens).

Both list components follow slice 10 RNW component conventions: `Platform.OS === 'web'` works via createElement escape hatches where needed; existing pattern from slice 14 + 25.

## Data flow

```
CLI: pnpm seed:federal-ptrs --year=2025 [--instrument]
  ↓
federal-ptrs-ingest.ts orchestrator
  ↓ iterate chambers (default: house + senate)
  ↓
ptr/index.ts → ptr/house-efd.ts OR ptr/senate-efpfd.ts
  ↓ fetchTransactions(opts) — returns NormalizedPtr[]
  ↓
orchestrator: resolveOfficialByBioguide OR resolveOfficialByName + bioguide_id fallback
  ↓
UPSERT into public.stock_transactions via (source, external_id) UNIQUE
  ↓
skipSummary printed if --instrument; rows applied if !--no-apply
```

FD flow is structurally same but combined-parser emits `{ holdings, other }` and orchestrator writes to BOTH new tables.

**Senate agreement gate state:** module-level closure caches `SenateSession` for the run; resets on next adapter invocation.

**Throttle:** Senate per-filing PDF: 1-req/sec (slice 19+20 convention). House ZIP: single download, no per-PDF throttle.

**Cache:** 7-day on-disk cache at `packages/db/supabase/seed/.cache/federal-disclosures/` (gitignored). Mirrors slice 5D openstates cache pattern.

## Error handling

All silent-skip sites instrumented per slice 22+23 framework. 6 stages possible:

- **`derive_url`** — yearly ZIP URL pattern drift (House), Senate report_type code drift
- **`fetch`** — HTTP error, ZIP corruption, Senate agreement-gate failure (CSRF token extraction failed, prohibition_agreement POST rejected)
- **`extract`** — PDF text extraction failure via slice 19 pdf module
- **`parse`** — section walker can't find expected headers (e.g. "Schedule of Transactions", "Schedule A")
- **`resolve`** — official name doesn't match any current/former federal legislator
- **`filter`** — filing outside `--year` window, non-PTR row in PTR context, etc.

Errors are localized; one bad PDF doesn't abort the run. The orchestrator returns `{ inserted, skipped, errors }`. `--instrument` prints aggregated skip-summary table via `formatSkipSummary` (slice 22).

## Testing strategy

**pgTAP:** 2 new test files, ~20 plans (402 → ~422).

**Vitest:** ~46 new cases across 8 test files. Mock-text-only convention from slice 19 (no real PDFs committed). Mock fetchers + skip-injection per slice 22+23 pattern.

**Integration smoke:** ingest tests in `db` package run orchestrator with mocked fetcher + `--no-apply` flag; assert skip counts + apply counts.

**Web build smoke:** `/officials/[id]` bundle delta target ≤ +10kB (2 new list components + 2 card subsections).

**Mobile parity:** none in this slice — mobile officials-detail page is already redesigned (slice 5 mobile DoD parity); RNW conversion (slice 10) means new components auto-flow to mobile. Skip mobile-specific work.

## Verify gate

- `pnpm -r typecheck` → 11/11 packages green
- `pnpm db:reset` then `pnpm db:test` → 402 → ~422 pgTAP plans
- `pnpm --filter @chiaro/db exec vitest run` → 784 → ~830 tests
- `pnpm --filter @chiaro/officials-ui exec vitest run` → 258 → ~270 tests
- `pnpm --filter @chiaro/web build` → 12 routes green, `/officials/[id]` bundle delta within tolerance

## Risk + tradeoffs

1. **Senate agreement gate is the highest-risk surface.** If `efdsearch.senate.gov` requires JS-rendered form (vs static HTML form), the fetcher will fail. Per slice 11+21 deprecation precedent: if the gate proves untractable mid-flight, deprecate Senate FD + Senate PTR adapters and ship House-only. Don't pivot to Playwright/Puppeteer.

2. **House ZIP filename / URL pattern drift.** `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}.zip` is the documented pattern but the Clerk's site changes occasionally. Adapter onSkip-instruments URL derivation; operator can adjust URL constant if drift detected.

3. **Schema split (2 new tables vs combined) diverges from state parity.** State side uses a single `state_financial_disclosures` table with a `category` discriminator. Federal split into `federal_holdings` + `federal_disclosure_other` is more normalized but creates a federal/state schema asymmetry. Documented as a deliberate per-slice choice. If future query patterns regret the split, a slice can union the two via a view.

4. **`stock_transactions` legacy data co-exists with new ingest.** Pre-slice-8 rows have `source='legacy'`; slice 26 writes `source='house-efd-ptr'` / `'senate-efpfd-ptr'`. UPSERT against `(source, external_id) UNIQUE` doesn't dedup across source values. Operator may want a cleanup pass later. Not in scope.

5. **Annual FD parsing is harder than PTRs.** PTRs are 1-2 pages with a clear transaction table. Annual FDs are 30-80 pages with 9 schedules (Schedule A through I), heterogeneous formatting per filer, line items spanning multiple lines. Section walkers may underreport on filings with non-standard formatting. Conservative under-reporting is acceptable (mirrors slice 5F `bills_passed_count` heuristic acceptance).

6. **External_id determinism for FD line items.** Format `{adapter-slug}-{filing-id}-{schedule}-{lineNo}` (e.g. `house-fd-1234567-A-3`). Filing ID is from House XML index manifest / Senate filing detail page. If filings get re-uploaded with the same ID but different content, UPSERT semantics overwrite — acceptable v1; operator notes drift via `--instrument`.

7. **No paid data source (e.g. CapitolTrades, Quiver).** All adapters use public government sources. Slower to update than commercial aggregators but free + no rate-limit concerns + canonical source URLs.

8. **Mega-Slice file count (~30).** Larger than recent Compressed-Slices. Subagent-driven execution will need 8-10 sequenced implementer tasks (Gotcha #25: sequential implementers). Plan must decompose accordingly.

9. **Web build bundle impact.** 2 new list components + 2 card subsections may push `/officials/[id]` past target +10kB. Slice 10 RNW conversion already added ~30kB; this slice's UI is mostly list-renderers (low CSS, no new icons). Realistic delta: +5-8kB.

10. **Federal stock + FD data is publicly available but politically sensitive.** Civic transparency is the use case; no editorial commentary or labeling ("controversial trades", "ROI", etc.) — surface raw filings with neutral UI copy. Document in the slice 26 closure that no editorial UI was added.

## Schema verification needed during planning

- Verify `Database['public']['Tables']['stock_transactions']['Row']` matches new adapter shape (post-slice-8 columns). Cross-check `packages/db/src/types.ts` regeneration.
- Verify `extractPdfText` + `fetchPdf` (slice 19) handle large multi-page FDs without memory issues (~30-80 page PDFs).
- Verify `resolveOfficialByName` (slice 8 shared/officials.ts) accepts a federal Chamber union; if it only handles state chambers post-slice-8, extend to include `federal_house` + `federal_senate`.

## Cross-references

- Slice 8 (federal stock_transactions schema parity — source/external_id columns + (source, external_id) UNIQUE; explicitly deferred adapter work this slice closes)
- Slice 9 (HTML-scrape production parser pattern + Gotcha #18 a/b/c — cheerio + BROWSER_USER_AGENT + 1-req/sec throttle)
- Slice 11 (LCV-MI + LCV-CO production parsers + ACLU/AFP deprecation pattern that this slice's Senate fallback mirrors if gate fails)
- Slice 13 (state_stock_transactions drop + Gotcha #21 — informs federal/state schema-asymmetry justification)
- Slice 15 (NY COELIG combined-parser pattern: 1 fetch → 2 schema sinks via shared helper)
- Slice 16 (CA + MI + TX district_offices + TX TEC combined parser — extends slice 15 combined-parser pattern to non-NY states)
- Slice 19 (pdf-parse workspace dep + shared `seed/shared/pdf.ts` helper + MI PFD first PDF parser)
- Slice 20 (NY FDS + TX TEC PDF parsing patterns: expand-rows vs enrich-rows)
- Slice 22 (instrumentation framework: SkipReason discriminated union + createSkipCollector + formatSkipSummary)
- Slice 23 (instrumentation completion across all production adapters)
- Memory: [[project-chiaro-slice8-federal-parity]] (federal/state schema parity origin), [[project-chiaro-slice19-pdf-parsing-mi-pfd]] (PDF helper canonical entry), [[project-chiaro-slice20-ny-fds-tx-tec-pdfs]] (PDF parsing patterns), [[project-chiaro-slice22-instrumentation]] (onSkip pattern)
