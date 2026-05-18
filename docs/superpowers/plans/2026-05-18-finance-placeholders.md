# Finance Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two soft-beige placeholder sub-cascades in the Finance category ("Individual Donors" and "Top Organizations") with full UI + DB + live OpenSecrets ingest, and refactor `IndustryBreakdown` into a generalized `TopAmountBreakdown` shared across all three Finance bar-chart sub-cascades.

**Architecture:** Two new child tables (`finance_individual_donors`, `finance_top_organizations`) hang off `finance_summaries` mirroring the existing `finance_industry_top` / `finance_pac_contributions` shape. OpenSecrets adapter gains two endpoints (`candContrib`, `candOrgs`) in the existing `Promise.all`, capped at top-10 per category. `IndustryBreakdown` becomes `TopAmountBreakdown` with a `noun: { singular, plural }` prop and `rows[].label` generalized field.

**Tech Stack:** PostgreSQL + Supabase migrations · pgTAP · Node + `pg` for ingest · OpenSecrets v1 API · TypeScript strict · Next 15 + React 19 · vitest + @testing-library/react · @chiaro/officials TanStack hook

**Spec:** `docs/superpowers/specs/2026-05-18-finance-placeholders-design.md`

---

## File structure

```
packages/db/supabase/migrations/
  0024_finance_individuals_and_orgs.sql                NEW
  0025_finance_individuals_and_orgs_rls.sql            NEW
packages/db/supabase/tests/
  finance_individuals_and_orgs.test.sql                NEW (pgTAP)
packages/db/supabase/seed/
  opensecrets-adapter.ts                               modify (+ candContrib + candOrgs endpoints, extend FinanceSnapshot)
  finance-ingest.ts                                    modify (+ upsert blocks for the two new child tables)
  finance-ingest.test.ts                               modify (assert new tables populate, idempotency)
  fixtures/opensecrets-summary-N00007360.json          modify (+ individual_donors, top_organizations arrays)
packages/db/src/types.ts                               regenerated (pnpm db:gen-types)
packages/officials/src/queries.ts                     modify (extend OfficialFinance + fetchOfficialFinance)

apps/web/components/finance/
  IndustryBreakdown.tsx                                DELETE (renamed)
  TopAmountBreakdown.tsx                               NEW (rename + generalize)
apps/web/test/components/finance/
  IndustryBreakdown.test.tsx                          DELETE (renamed)
  TopAmountBreakdown.test.tsx                          NEW (migrate + 1 new case for noun parameterization)
apps/web/components/performance/categories/
  FinanceCategory.tsx                                  modify (use TopAmountBreakdown for 3 cascades, drop 2 placeholders)
```

---

## Phase A — DB schema (Tasks 1-2)

### Task 1: Migration 0024 — new child tables

**Files:**
- Create: `packages/db/supabase/migrations/0024_finance_individuals_and_orgs.sql`

- [ ] **Step 1: Write the migration**

`packages/db/supabase/migrations/0024_finance_individuals_and_orgs.sql`:

```sql
-- Slice 5: top individual donors + top organizations per official per cycle.
-- Both tables cascade off finance_summaries; row count capped at top-10 per
-- (summary, rank) by the ingest pipeline (UI shows max 10 via Show-5-more toggle).

create table public.finance_individual_donors (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank               smallint not null check (rank between 1 and 10),
  donor_name         text not null,
  amount             numeric(15,2) not null,
  employer           text,
  occupation         text,
  primary key (finance_summary_id, rank)
);

create table public.finance_top_organizations (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank               smallint not null check (rank between 1 and 10),
  org_name           text not null,
  amount             numeric(15,2) not null,
  primary key (finance_summary_id, rank)
);

create index finance_individual_donors_summary_idx on public.finance_individual_donors(finance_summary_id);
create index finance_top_organizations_summary_idx on public.finance_top_organizations(finance_summary_id);
```

- [ ] **Step 2: Apply migration locally**

Run:

```bash
pnpm db:reset 2>&1 | tail -10
```

Expected: applies migrations 0001–0025 (your new 0024 + soon-to-be 0025), reports success. The new tables should be created during the 0024 step.

Verify the tables exist:

```bash
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});await c.connect();const r=await c.query(\"select tablename from pg_tables where schemaname='public' and tablename in ('finance_individual_donors','finance_top_organizations') order by tablename\");console.table(r.rows);await c.end()})()"
```

Expected: two rows printed (`finance_individual_donors`, `finance_top_organizations`).

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/migrations/0024_finance_individuals_and_orgs.sql
git commit -m "feat(db): migration 0024 — finance_individual_donors + finance_top_organizations child tables"
```

---

### Task 2: Migration 0025 — RLS for new tables

**Files:**
- Create: `packages/db/supabase/migrations/0025_finance_individuals_and_orgs_rls.sql`

- [ ] **Step 1: Write the migration**

`packages/db/supabase/migrations/0025_finance_individuals_and_orgs_rls.sql`:

```sql
-- Public-read RLS for the two new finance child tables (mirrors 0021_finance_rls.sql
-- which gates finance_summaries / finance_industry_top / finance_pac_contributions).

alter table public.finance_individual_donors  enable row level security;
alter table public.finance_top_organizations  enable row level security;

create policy finance_individual_donors_select_all on public.finance_individual_donors  for select using (true);
create policy finance_top_organizations_select_all on public.finance_top_organizations  for select using (true);

revoke insert, update, delete on public.finance_individual_donors from anon, authenticated;
revoke insert, update, delete on public.finance_top_organizations from anon, authenticated;
```

- [ ] **Step 2: Apply + verify**

```bash
pnpm db:reset 2>&1 | tail -10
```

Expected: applies all migrations 0001–0025 cleanly.

Verify RLS is enabled:

```bash
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});await c.connect();const r=await c.query(\"select relname, relrowsecurity from pg_class where oid in ('public.finance_individual_donors'::regclass, 'public.finance_top_organizations'::regclass)\");console.table(r.rows);await c.end()})()"
```

Expected: both tables show `relrowsecurity: true`.

- [ ] **Step 3: Regenerate Database types**

```bash
pnpm db:gen-types 2>&1 | tail -3
```

This rewrites `packages/db/src/types.ts` with rows for the two new tables, so downstream packages (`@chiaro/officials`) get typed access in Task 5.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0025_finance_individuals_and_orgs_rls.sql packages/db/src/types.ts
git commit -m "feat(db): migration 0025 — RLS for new finance child tables + regen types"
```

---

## Phase B — Ingest pipeline (Tasks 3-4)

### Task 3: Extend OpenSecrets adapter with candContrib + candOrgs

**Files:**
- Modify: `packages/db/supabase/seed/opensecrets-adapter.ts`
- Modify: `packages/db/supabase/seed/fixtures/opensecrets-summary-N00007360.json`

(Adapter changes are mechanical extensions; coverage comes via the extended `finance-ingest.test.ts` in Task 4.)

- [ ] **Step 1: Extend the fixture**

Edit `packages/db/supabase/seed/fixtures/opensecrets-summary-N00007360.json` to add the two new arrays after `pacs`:

```json
{
  "cycle": "2024",
  "total_raised": 5234189,
  "total_disbursed": 4892711,
  "small_donor_pct": 28.4,
  "in_state_pct": 67.2,
  "out_of_state_pct": 32.8,
  "source_url": "https://www.opensecrets.org/members-of-congress/summary?cid=N00007360&cycle=2024",
  "industries": [
    { "rank": 1, "industry": "Securities & Investment", "amount": 412000 },
    { "rank": 2, "industry": "Real Estate", "amount": 287500 },
    { "rank": 3, "industry": "Lawyers/Law Firms", "amount": 245000 }
  ],
  "pacs": [
    { "pac_name": "Realtors PAC", "pac_fec_id": "C00030718", "amount": 10000 },
    { "pac_name": "AT&T Inc Federal PAC", "pac_fec_id": "C00109017", "amount": 7500 }
  ],
  "individual_donors": [
    { "rank": 1, "donor_name": "Alice Donor",   "amount": 25000, "employer": "Acme Inc",   "occupation": "Engineer" },
    { "rank": 2, "donor_name": "Bob Donor",     "amount": 18500, "employer": "Beta LLC",   "occupation": "Attorney" },
    { "rank": 3, "donor_name": "Carol Donor",   "amount": 14200, "employer": null,         "occupation": "Retired" }
  ],
  "top_organizations": [
    { "rank": 1, "org_name": "Acme Industries", "amount": 50000 },
    { "rank": 2, "org_name": "Beta Corp",       "amount": 32000 }
  ]
}
```

- [ ] **Step 2: Replace adapter contents**

Replace `packages/db/supabase/seed/opensecrets-adapter.ts` with:

```ts
// Six endpoints per official per cycle:
//   candSummary?cid={cid}&cycle={cycle}            → total raised, small donor %, etc.
//   candIndustry?cid={cid}&cycle={cycle}            → top industries
//   candPacs?cid={cid}&cycle={cycle}                → named PAC contributions
//   candIndByState?cid={cid}&cycle={cycle}          → in-state vs out-of-state %
//   candContrib?cid={cid}&cycle={cycle}             → top individual donors (NEW slice 5)
//   candOrgs?cid={cid}&cycle={cycle}                → top organizations (NEW slice 5)
// Free tier: 200 calls/day. Full Congress backfill at 6 calls/official → ~17 days.

export interface FinanceSnapshot {
  cycle:             string
  total_raised:      number | null
  total_disbursed:   number | null
  small_donor_pct:   number | null
  in_state_pct:      number | null
  out_of_state_pct:  number | null
  source_url:        string
  industries:        Array<{ rank: number; industry: string; amount: number }>
  pacs:              Array<{ pac_name: string; pac_fec_id: string | null; amount: number }>
  individual_donors: Array<{ rank: number; donor_name: string; amount: number; employer: string | null; occupation: string | null }>
  top_organizations: Array<{ rank: number; org_name: string; amount: number }>
}

const API_BASE = 'https://www.opensecrets.org/api/'

export async function fetchFinanceSnapshot(
  opensecretsCID: string,
  cycle: string,
  apiKey: string,
  opts?: { fixturePath?: string },
): Promise<FinanceSnapshot> {
  if (opts?.fixturePath) {
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(opts.fixturePath, 'utf8')
    return JSON.parse(text) as FinanceSnapshot
  }

  const summaryUrl   = `${API_BASE}?method=candSummary&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const industryUrl  = `${API_BASE}?method=candIndustry&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const pacsUrl      = `${API_BASE}?method=candPacs&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const stateUrl     = `${API_BASE}?method=candIndByState&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const contribUrl   = `${API_BASE}?method=candContrib&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const orgsUrl      = `${API_BASE}?method=candOrgs&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`

  const [summary, industry, pacs, state, contrib, orgs] = await Promise.all([
    fetch(summaryUrl).then(r => r.json()),
    fetch(industryUrl).then(r => r.json()),
    fetch(pacsUrl).then(r => r.json()),
    fetch(stateUrl).then(r => r.json()),
    fetch(contribUrl).then(r => r.json()).catch(() => null),
    fetch(orgsUrl).then(r => r.json()).catch(() => null),
  ])

  const s = (summary as any).response.summary['@attributes']

  // Each new endpoint wrapped in try/catch so a malformed shape can't kill the whole snapshot.
  let individual_donors: FinanceSnapshot['individual_donors'] = []
  try {
    const contribRows = (contrib as any)?.response?.contributors?.contributor ?? []
    individual_donors = contribRows.slice(0, 10).map((row: any, idx: number) => ({
      rank: idx + 1,
      donor_name: row['@attributes'].contrib,
      amount: Number(row['@attributes'].total) || 0,
      employer: row['@attributes'].employer ?? null,
      occupation: row['@attributes'].occupation ?? null,
    }))
  } catch {
    individual_donors = []
  }

  let top_organizations: FinanceSnapshot['top_organizations'] = []
  try {
    const orgRows = (orgs as any)?.response?.organizations?.organization ?? []
    top_organizations = orgRows.slice(0, 10).map((row: any, idx: number) => ({
      rank: idx + 1,
      org_name: row['@attributes'].org_name,
      amount: Number(row['@attributes'].total) || 0,
    }))
  } catch {
    top_organizations = []
  }

  return {
    cycle,
    total_raised:    Number(s.total)  || null,
    total_disbursed: Number(s.spent)  || null,
    small_donor_pct: Number(s.contrib_from_individuals_small_pct) || null,
    in_state_pct:    Number((state as any).response['cand_state']?.['@attributes']?.in_state_pct) || null,
    out_of_state_pct: Number((state as any).response['cand_state']?.['@attributes']?.out_of_state_pct) || null,
    source_url: `https://www.opensecrets.org/members-of-congress/summary?cid=${opensecretsCID}&cycle=${cycle}`,
    industries: ((industry as any).response.industries.industry ?? []).slice(0, 25).map((row: any, idx: number) => ({
      rank: idx + 1,
      industry: row['@attributes'].industry_name,
      amount: Number(row['@attributes'].total) || 0,
    })),
    pacs: ((pacs as any).response.pacs.pac ?? []).map((row: any) => ({
      pac_name: row['@attributes'].pac_name,
      pac_fec_id: row['@attributes'].fec_pac_id ?? null,
      amount: Number(row['@attributes'].total) || 0,
    })),
    individual_donors,
    top_organizations,
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck 2>&1 | tail -3
```

Expected: clean. The adapter's TypeScript signature now matches the new `FinanceSnapshot` interface; `finance-ingest.ts` still only reads `snap.industries` and `snap.pacs` (the new fields are unused until Task 4), which is fine — extra properties don't break the consumer.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/seed/opensecrets-adapter.ts packages/db/supabase/seed/fixtures/opensecrets-summary-N00007360.json
git commit -m "feat(seed): OpenSecrets adapter — candContrib + candOrgs endpoints (top 10 cap)"
```

---

### Task 4: Extend finance-ingest with delete-then-insert for new child tables

**Files:**
- Modify: `packages/db/supabase/seed/finance-ingest.ts`
- Modify: `packages/db/supabase/seed/finance-ingest.test.ts`

- [ ] **Step 1: Extend failing test**

Replace `packages/db/supabase/seed/finance-ingest.test.ts` entirely with:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestFinance } from './finance-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURES = join(__dirname, 'fixtures')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_house','CA','CA-11-fixfin','CA-11 fixture',
      st_geogfromtext('MULTIPOLYGON(((-122.5 37.7,-122.4 37.7,-122.4 37.8,-122.5 37.8,-122.5 37.7)))'),
      'FX-fin')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-11-fixfin'")
  await client.query(`
    insert into public.officials (bioguide_id, opensecrets_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('FINTEST1','N00007360','Nancy','Pelosi','Nancy Pelosi','house','D','CA',$1::uuid,null,'119')
    on conflict (bioguide_id) do update set opensecrets_id = excluded.opensecrets_id
  `, [d.rows[0].id])
})

afterEach(async () => {
  await client.query("delete from public.finance_summaries where official_id in (select id from public.officials where bioguide_id = 'FINTEST1')")
  await client.query("delete from public.officials where bioguide_id = 'FINTEST1'")
  await client.query("delete from public.districts where code = 'CA-11-fixfin'")
  await client.end()
})

describe('ingestFinance', () => {
  it('upserts finance_summaries + industries + pacs + individual donors + top organizations from fixture', async () => {
    const stats = await ingestFinance({
      apiKey: 'unused',
      cycle: '2024',
      fixturesDir: FIXTURES,
    })

    expect(stats.officialsProcessed).toBe(1)
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.industriesUpserted).toBe(3)
    expect(stats.pacsUpserted).toBe(2)
    expect(stats.individualDonorsUpserted).toBe(3)
    expect(stats.topOrganizationsUpserted).toBe(2)
    expect(stats.errors).toEqual([])

    const summary = await client.query(`
      select fs.total_raised, fs.in_state_pct
      from public.finance_summaries fs
      join public.officials o on o.id = fs.official_id
      where o.bioguide_id = 'FINTEST1' and fs.cycle = '2024'
    `)
    expect(summary.rows.length).toBe(1)
    expect(Number(summary.rows[0].total_raised)).toBe(5234189)

    const ind = await client.query(`
      select rank, industry from public.finance_industry_top
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
      order by rank
    `)
    expect(ind.rows.length).toBe(3)
    expect(ind.rows[0].industry).toBe('Securities & Investment')

    const donors = await client.query(`
      select rank, donor_name, amount, employer, occupation from public.finance_individual_donors
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
      order by rank
    `)
    expect(donors.rows.length).toBe(3)
    expect(donors.rows[0].donor_name).toBe('Alice Donor')
    expect(Number(donors.rows[0].amount)).toBe(25000)
    expect(donors.rows[0].employer).toBe('Acme Inc')
    expect(donors.rows[2].employer).toBeNull()

    const orgs = await client.query(`
      select rank, org_name, amount from public.finance_top_organizations
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
      order by rank
    `)
    expect(orgs.rows.length).toBe(2)
    expect(orgs.rows[0].org_name).toBe('Acme Industries')
    expect(Number(orgs.rows[0].amount)).toBe(50000)

    // Idempotent re-run — counts stay stable (delete-then-insert).
    const stats2 = await ingestFinance({ apiKey: 'unused', cycle: '2024', fixturesDir: FIXTURES })
    expect(stats2.summariesUpserted).toBe(1)
    expect(stats2.individualDonorsUpserted).toBe(3)
    expect(stats2.topOrganizationsUpserted).toBe(2)
    const donorsAgain = await client.query(`
      select count(*)::int as c from public.finance_individual_donors
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
    `)
    expect(donorsAgain.rows[0].c).toBe(3)  // not 6 — delete-then-insert is idempotent

    // Cascade-delete: removing the summary clears both new child tables.
    await client.query(`delete from public.finance_summaries where official_id in (select id from public.officials where bioguide_id = 'FINTEST1')`)
    const donorsAfter = await client.query(`select count(*)::int as c from public.finance_individual_donors`)
    const orgsAfter = await client.query(`select count(*)::int as c from public.finance_top_organizations`)
    expect(donorsAfter.rows[0].c).toBe(0)
    expect(orgsAfter.rows[0].c).toBe(0)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test supabase/seed/finance-ingest.test.ts 2>&1 | tail -10
```

Expected: test fails because `stats.individualDonorsUpserted` is `undefined` (field doesn't exist yet on `FinanceIngestStats`).

- [ ] **Step 3: Replace ingest contents**

Replace `packages/db/supabase/seed/finance-ingest.ts` with:

```ts
#!/usr/bin/env tsx
// Slice 4+5: iterate officials with opensecrets_id set, fetch snapshot from OpenSecrets,
// upsert finance_summaries + replace finance_industry_top + finance_pac_contributions +
// finance_individual_donors + finance_top_organizations.
// Idempotent: re-running is safe (per-summary delete-then-insert for all children).

import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { fetchFinanceSnapshot, type FinanceSnapshot } from './opensecrets-adapter.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface FinanceIngestArgs {
  apiKey:    string
  cycle?:    string
  snapshotFetcher?: typeof fetchFinanceSnapshot
  fixturesDir?: string   // when set, the adapter loads from <dir>/opensecrets-summary-<cid>.json
}

export interface FinanceIngestStats {
  officialsProcessed:        number
  summariesUpserted:         number
  industriesUpserted:        number
  pacsUpserted:              number
  individualDonorsUpserted:  number
  topOrganizationsUpserted:  number
  errors:                    Array<{ official_id: string; cid: string; message: string }>
}

export async function ingestFinance(args: FinanceIngestArgs): Promise<FinanceIngestStats> {
  const cycle = args.cycle ?? '2024'
  const fetcher = args.snapshotFetcher ?? fetchFinanceSnapshot
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  const stats: FinanceIngestStats = {
    officialsProcessed: 0,
    summariesUpserted: 0,
    industriesUpserted: 0,
    pacsUpserted: 0,
    individualDonorsUpserted: 0,
    topOrganizationsUpserted: 0,
    errors: [],
  }

  try {
    const officials = await client.query<{ id: string; opensecrets_id: string }>(
      `select id, opensecrets_id from public.officials where opensecrets_id is not null`
    )

    for (const o of officials.rows) {
      stats.officialsProcessed++
      try {
        const fixturePath = args.fixturesDir
          ? `${args.fixturesDir}/opensecrets-summary-${o.opensecrets_id}.json`
          : undefined
        const snap: FinanceSnapshot = await fetcher(o.opensecrets_id, cycle, args.apiKey, { fixturePath })

        await client.query('BEGIN')

        const ins = await client.query<{ id: string }>(`
          insert into public.finance_summaries
            (official_id, cycle, opensecrets_id, total_raised, total_disbursed,
             small_donor_pct, in_state_pct, out_of_state_pct, source_url)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          on conflict (official_id, cycle) do update set
            opensecrets_id   = excluded.opensecrets_id,
            total_raised     = excluded.total_raised,
            total_disbursed  = excluded.total_disbursed,
            small_donor_pct  = excluded.small_donor_pct,
            in_state_pct     = excluded.in_state_pct,
            out_of_state_pct = excluded.out_of_state_pct,
            source_url       = excluded.source_url,
            ingested_at      = now()
          returning id
        `, [o.id, cycle, o.opensecrets_id, snap.total_raised, snap.total_disbursed,
            snap.small_donor_pct, snap.in_state_pct, snap.out_of_state_pct, snap.source_url])
        const summaryId = ins.rows[0].id
        stats.summariesUpserted++

        await client.query('delete from public.finance_industry_top where finance_summary_id = $1', [summaryId])
        for (const ind of snap.industries) {
          await client.query(`
            insert into public.finance_industry_top
              (finance_summary_id, rank, industry, amount)
            values ($1,$2,$3,$4)
          `, [summaryId, ind.rank, ind.industry, ind.amount])
          stats.industriesUpserted++
        }

        await client.query('delete from public.finance_pac_contributions where finance_summary_id = $1', [summaryId])
        for (const pac of snap.pacs) {
          await client.query(`
            insert into public.finance_pac_contributions
              (finance_summary_id, pac_name, pac_fec_id, amount)
            values ($1,$2,$3,$4)
          `, [summaryId, pac.pac_name, pac.pac_fec_id, pac.amount])
          stats.pacsUpserted++
        }

        await client.query('delete from public.finance_individual_donors where finance_summary_id = $1', [summaryId])
        for (const d of snap.individual_donors) {
          await client.query(`
            insert into public.finance_individual_donors
              (finance_summary_id, rank, donor_name, amount, employer, occupation)
            values ($1,$2,$3,$4,$5,$6)
          `, [summaryId, d.rank, d.donor_name, d.amount, d.employer, d.occupation])
          stats.individualDonorsUpserted++
        }

        await client.query('delete from public.finance_top_organizations where finance_summary_id = $1', [summaryId])
        for (const org of snap.top_organizations) {
          await client.query(`
            insert into public.finance_top_organizations
              (finance_summary_id, rank, org_name, amount)
            values ($1,$2,$3,$4)
          `, [summaryId, org.rank, org.org_name, org.amount])
          stats.topOrganizationsUpserted++
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        stats.errors.push({
          official_id: o.id,
          cid: o.opensecrets_id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    await client.end().catch(() => {})
  }

  return stats
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const apiKey = process.env.OPENSECRETS_API_KEY
  if (!apiKey) { console.error('OPENSECRETS_API_KEY required'); process.exit(1) }
  ingestFinance({ apiKey })
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
```

- [ ] **Step 4: Run green + typecheck**

```bash
pnpm --filter @chiaro/db test supabase/seed/finance-ingest.test.ts 2>&1 | tail -10
pnpm --filter @chiaro/db typecheck 2>&1 | tail -3
```

Expected: test passes (idempotent re-run + cascade-delete assertions all green); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/finance-ingest.ts packages/db/supabase/seed/finance-ingest.test.ts
git commit -m "feat(seed): finance-ingest upserts finance_individual_donors + finance_top_organizations"
```

---

## Phase C — Query layer (Task 5)

### Task 5: Extend OfficialFinance type + fetchOfficialFinance query

**Files:**
- Modify: `packages/officials/src/queries.ts`

(No dedicated unit test for the query layer — covered by the existing `@chiaro/officials` integration test pattern + manual smoke at the end. Database types regenerated in Task 2 already include the new tables.)

- [ ] **Step 1: Replace fetchOfficialFinance + OfficialFinance**

Open `packages/officials/src/queries.ts`. Three changes near lines 47-102:

**Edit A** — add two new row type aliases below the existing `FinancePACRow`:

```ts
type FinanceIndividualDonorRow      = Database['public']['Tables']['finance_individual_donors']['Row']
type FinanceTopOrganizationRow      = Database['public']['Tables']['finance_top_organizations']['Row']
```

**Edit B** — extend the `OfficialFinance` interface:

```ts
export interface OfficialFinance {
  summary:           FinanceSummaryRow
  industries:        FinanceIndustryRow[]
  pacs:              FinancePACRow[]
  individualDonors:  FinanceIndividualDonorRow[]
  topOrgs:           FinanceTopOrganizationRow[]
}
```

**Edit C** — replace `fetchOfficialFinance` body:

```ts
export async function fetchOfficialFinance(
  client: ChiaroClient, officialId: string, cycle: string,
): Promise<OfficialFinance | null> {
  const { data: summary, error } = await client.from('finance_summaries')
    .select('*').eq('official_id', officialId).eq('cycle', cycle).maybeSingle()
  if (error) throw error
  if (!summary) return null
  const summaryRow = summary as FinanceSummaryRow

  const [industriesRes, pacsRes, donorsRes, orgsRes] = await Promise.all([
    client.from('finance_industry_top')
      .select('*').eq('finance_summary_id', summaryRow.id).order('rank', { ascending: true }),
    client.from('finance_pac_contributions')
      .select('*').eq('finance_summary_id', summaryRow.id).order('amount', { ascending: false }),
    client.from('finance_individual_donors')
      .select('*').eq('finance_summary_id', summaryRow.id).order('rank', { ascending: true }),
    client.from('finance_top_organizations')
      .select('*').eq('finance_summary_id', summaryRow.id).order('rank', { ascending: true }),
  ])

  return {
    summary: summaryRow,
    industries: (industriesRes.data ?? []) as FinanceIndustryRow[],
    pacs: (pacsRes.data ?? []) as FinancePACRow[],
    individualDonors: (donorsRes.data ?? []) as FinanceIndividualDonorRow[],
    topOrgs: (orgsRes.data ?? []) as FinanceTopOrganizationRow[],
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @chiaro/officials typecheck 2>&1 | tail -3
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
```

Expected: both clean. The new return-shape fields are additive — `FinanceCategory.tsx` destructures `{ summary, industries, pacs }` today, which keeps working; the new fields are ignored until Task 7 wires them up.

- [ ] **Step 3: Commit**

```bash
git add packages/officials/src/queries.ts
git commit -m "feat(officials): fetchOfficialFinance returns individualDonors + topOrgs arrays"
```

---

## Phase D — UI refactor + integration (Tasks 6-7)

### Task 6: Refactor IndustryBreakdown → TopAmountBreakdown (atomic rename + test migrate + call-site update)

**Files:**
- Create: `apps/web/components/finance/TopAmountBreakdown.tsx`
- Delete: `apps/web/components/finance/IndustryBreakdown.tsx`
- Create: `apps/web/test/components/finance/TopAmountBreakdown.test.tsx`
- Delete: `apps/web/test/components/finance/IndustryBreakdown.test.tsx`
- Modify: `apps/web/components/performance/categories/FinanceCategory.tsx` (one-line import + one-line call-site change)

This task atomically renames + generalizes + migrates the existing call site so the workspace stays green throughout.

- [ ] **Step 1: Create the new test file**

`apps/web/test/components/finance/TopAmountBreakdown.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'

const TEN = Array.from({ length: 10 }, (_, i) => ({
  label: `Industry ${i + 1}`,
  amount: (10 - i) * 50_000,
}))

const NOUN_INDUSTRY = { singular: 'industry', plural: 'industries' }
const NOUN_DONOR = { singular: 'donor', plural: 'donors' }

describe('TopAmountBreakdown', () => {
  it('renders 5 rows by default', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    expect(screen.getByText('Industry 1')).toBeTruthy()
    expect(screen.getByText('Industry 5')).toBeTruthy()
    expect(screen.queryByText('Industry 6')).toBeNull()
  })

  it('toggle button reads "Show 5 more <noun.plural>"', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    expect(screen.getByText('Show 5 more industries')).toBeTruthy()
    expect(screen.getByText('5 of 10 shown')).toBeTruthy()
  })

  it('toggle copy reflects a different noun', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_DONOR} />)
    expect(screen.getByText('Show 5 more donors')).toBeTruthy()
  })

  it('clicking toggle reveals rows 6-10 + flips to "Show less"', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    fireEvent.click(screen.getByText('Show 5 more industries').closest('button')!)
    expect(screen.getByText('Industry 6')).toBeTruthy()
    expect(screen.getByText('Industry 10')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
    expect(screen.getByText('10 of 10 shown')).toBeTruthy()
  })

  it('row 1 label uses bolder + slightly larger font', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    const row1 = screen.getByText('Industry 1')
    expect(row1.style.fontWeight).toBe('700')
    expect(row1.style.fontSize).toBe('0.92rem')
  })

  it('row 2+ uses 600 / 0.82rem', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    const row2 = screen.getByText('Industry 2')
    expect(row2.style.fontWeight).toBe('600')
    expect(row2.style.fontSize).toBe('0.82rem')
  })

  it('percent is shown next to dollar', () => {
    render(<TopAmountBreakdown rows={[{ label: 'A', amount: 500 }, { label: 'B', amount: 500 }]} noun={NOUN_INDUSTRY} />)
    const pcts = screen.getAllByText(/50%/)
    expect(pcts.length).toBe(2)
  })

  it('toggle hidden when <=5 rows', () => {
    render(<TopAmountBreakdown rows={TEN.slice(0, 3)} noun={NOUN_INDUSTRY} />)
    expect(screen.queryByText(/Show 5 more/)).toBeNull()
  })

  it('renders "full breakdown on OpenSecrets" link', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} sourceUrl="https://www.opensecrets.org/example" />)
    const link = screen.getByText(/full breakdown on OpenSecrets/)
    expect(link.closest('a')?.getAttribute('href')).toBe('https://www.opensecrets.org/example')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test components/finance/TopAmountBreakdown 2>&1 | tail -10
```

Expected: 9 tests fail (import-resolve error: `TopAmountBreakdown` doesn't exist yet).

- [ ] **Step 3: Create the new component**

`apps/web/components/finance/TopAmountBreakdown.tsx`:

```tsx
import { useState } from 'react'
import { PillChevron } from '@/components/cards/PillChevron'

export interface TopAmountRow {
  label: string
  amount: number
}

export interface TopAmountNoun {
  singular: string
  plural: string
}

export interface TopAmountBreakdownProps {
  rows: ReadonlyArray<TopAmountRow>
  noun: TopAmountNoun
  sourceUrl?: string
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function TopAmountBreakdown({ rows, noun, sourceUrl }: TopAmountBreakdownProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
    <div style={{ background: 'linear-gradient(180deg, #f4faf6 0%, #fff 100%)', border: '1px solid #d8d4c9', borderRadius: 6, padding: '14px 16px', fontSize: '0.82rem', color: '#1a1714' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((r, idx) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const isTop = idx === 0
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: isTop ? 700 : 600, fontSize: isTop ? '0.92rem' : '0.82rem', color: '#1a1714' }}>
                  {r.label}
                </span>
                <span>
                  <span style={{ fontWeight: 700, color: '#1a1714' }}>{formatMoney(r.amount)}</span>{' '}
                  <span style={{ color: '#5a5751', fontSize: '0.72rem' }}>· {pct}%</span>
                </span>
              </div>
              <div style={{ marginTop: 4, height: 6, background: '#e8e6dd', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: '#3da75b', width: `${(r.amount / max) * 100}%`, height: '100%' }} />
              </div>
            </div>
          )
        })}
      </div>

      {showToggle && (
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            marginTop: 12,
            width: '100%',
            background: '#fff',
            border: '1px solid #d8d4c9',
            borderRadius: 6,
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#1a1714',
            fontSize: '0.82rem',
          }}
        >
          <PillChevron open={expanded} />
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>
            {expanded ? 'Show less' : `Show 5 more ${noun.plural}`}
          </span>
          <span style={{ color: '#5a5751', fontSize: '0.72rem' }}>
            {expanded ? `${rows.length} of ${rows.length} shown` : `5 of ${rows.length} shown`}
          </span>
        </button>
      )}

      {sourceUrl && (
        <div style={{ marginTop: 12, fontSize: '0.78rem' }}>
          <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1', textDecoration: 'underline' }}>
            → full breakdown on OpenSecrets
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Migrate the FinanceCategory call site**

Open `apps/web/components/performance/categories/FinanceCategory.tsx`. Two edits:

**Edit A** — replace the import:

```diff
- import { IndustryBreakdown } from '@/components/finance/IndustryBreakdown'
+ import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'
```

**Edit B** — update the Top Industries call site (line ~109):

```diff
- <IndustryBreakdown rows={industries} sourceUrl={summary.source_url} />
+ <TopAmountBreakdown
+   rows={industries.map(i => ({ label: i.industry, amount: i.amount }))}
+   noun={{ singular: 'industry', plural: 'industries' }}
+   sourceUrl={summary.source_url}
+ />
```

- [ ] **Step 5: Delete the old files**

```bash
rm apps/web/components/finance/IndustryBreakdown.tsx
rm apps/web/test/components/finance/IndustryBreakdown.test.tsx
```

- [ ] **Step 6: Run green + workspace typecheck**

```bash
pnpm --filter @chiaro/web test components/finance/TopAmountBreakdown 2>&1 | tail -10
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
pnpm --filter @chiaro/web build 2>&1 | tail -10
```

Expected: 9 tests pass; typecheck clean; build green.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/components/finance apps/web/test/components/finance apps/web/components/performance/categories/FinanceCategory.tsx
git commit -m "refactor(web): IndustryBreakdown → TopAmountBreakdown (rows[].label + noun prop)"
```

---

### Task 7: Replace 2 placeholder SubCascadeBars with real cascades

**Files:**
- Modify: `apps/web/components/performance/categories/FinanceCategory.tsx`

(No dedicated unit test — covered by manual smoke. The new sub-cascades reuse already-tested `TopAmountBreakdown` and `SubCascadeBar` primitives.)

- [ ] **Step 1: Replace contents**

Replace `apps/web/components/performance/categories/FinanceCategory.tsx` entirely with:

```tsx
'use client'

import { type CategoryId, FINANCE_SUB_SECTION_SHADES } from '@chiaro/ui-tokens'
import { useOfficialFinance } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { pacPercent } from '@/lib/derivations/finance'
import { FinanceSummaryStrip } from '@/components/finance/FinanceSummaryStrip'
import { FinanceSubSectionHeading } from '@/components/finance/FinanceSubSectionHeading'
import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'finance'
const client = createSupabaseBrowserClient()
const CYCLE = '2024'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function FinanceCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const q = useOfficialFinance(client, officialId, CYCLE)

  if (q.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  if (!q.data) {
    return (
      <p style={{ padding: 12, color: '#807a72' }}>
        No OpenSecrets data ingested for {CYCLE}.{' '}
        <a href="https://www.opensecrets.org/members-of-congress" target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → search OpenSecrets
        </a>
      </p>
    )
  }
  const { summary, industries, pacs, individualDonors, topOrgs } = q.data
  const pacSum = pacs.reduce((s, p) => s + p.amount, 0)
  const pct = pacPercent(summary.total_raised, pacSum)
  const topIndustry = industries[0]?.industry ?? null
  const donorSum = individualDonors.reduce((s, d) => s + Number(d.amount), 0)
  const topOrg = topOrgs[0]?.org_name ?? null

  const pacsOpen = subCascade.isOpen(CATEGORY, 'pacs')
  const indOpen = subCascade.isOpen(CATEGORY, 'top-industries')
  const donorsOpen = subCascade.isOpen(CATEGORY, 'individual-donors')
  const orgsOpen = subCascade.isOpen(CATEGORY, 'top-organizations')

  return (
    <div style={{ padding: 12 }}>
      <FinanceSummaryStrip
        cycle={CYCLE}
        totalRaised={summary.total_raised}
        smallDonorPct={summary.small_donor_pct}
        pacPct={pct}
      />

      <FinanceSubSectionHeading
        label="Contributors"
        textColor={FINANCE_SUB_SECTION_SHADES.contributors.heading}
        ruleColor={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="pacs"
        name="PACs"
        teaser={`$${pacSum.toLocaleString()} · ${pacs.length} PACs`}
        open={pacsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'pacs')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      {pacsOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pacs.slice(0, 5).map(p => (
              <li key={p.pac_name} style={{ padding: '6px 0', borderBottom: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                <strong>{p.pac_name}</strong>: ${p.amount.toLocaleString()}
                {p.pac_fec_id && (
                  <a href={`https://www.fec.gov/data/committee/${p.pac_fec_id}/`} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#3b6ed1', fontSize: '0.72rem' }}>
                    → FEC
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="individual-donors"
        name="Individual Donors"
        teaser={
          individualDonors.length > 0
            ? `$${donorSum.toLocaleString()} · ${individualDonors.length} donors`
            : 'no individual donor data ingested'
        }
        open={donorsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'individual-donors')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      {donorsOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <TopAmountBreakdown
            rows={individualDonors.map(d => ({ label: d.donor_name, amount: Number(d.amount) }))}
            noun={{ singular: 'donor', plural: 'donors' }}
            sourceUrl={summary.source_url}
          />
        </div>
      )}

      <FinanceSubSectionHeading
        label="Top Donor Industries & Organizations"
        textColor={FINANCE_SUB_SECTION_SHADES.topDonor.heading}
        ruleColor={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-industries"
        name="Top Industries"
        teaser={topIndustry ? `${topIndustry} leads` : 'no industries ingested'}
        open={indOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'top-industries')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      {indOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <TopAmountBreakdown
            rows={industries.map(i => ({ label: i.industry, amount: Number(i.amount) }))}
            noun={{ singular: 'industry', plural: 'industries' }}
            sourceUrl={summary.source_url}
          />
        </div>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-organizations"
        name="Top Organizations"
        teaser={topOrg ? `${topOrg} leads` : 'no organization data ingested'}
        open={orgsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'top-organizations')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      {orgsOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <TopAmountBreakdown
            rows={topOrgs.map(o => ({ label: o.org_name, amount: Number(o.amount) }))}
            noun={{ singular: 'organization', plural: 'organizations' }}
            sourceUrl={summary.source_url}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm --filter @chiaro/web typecheck 2>&1 | tail -3
pnpm --filter @chiaro/web build 2>&1 | tail -10
```

Expected: clean typecheck, green build.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/performance/categories/FinanceCategory.tsx
git commit -m "feat(web): FinanceCategory — Individual Donors + Top Organizations sub-cascades wired"
```

---

## Phase E — pgTAP + final verify (Tasks 8-9)

### Task 8: pgTAP test for new tables + RLS

**Files:**
- Create: `packages/db/supabase/tests/finance_individuals_and_orgs.test.sql`

- [ ] **Step 1: Write the pgTAP file**

`packages/db/supabase/tests/finance_individuals_and_orgs.test.sql`:

```sql
begin;

select plan(16);

-- Schema (migration 0024)
select has_table('public', 'finance_individual_donors', 'finance_individual_donors table exists');
select has_table('public', 'finance_top_organizations', 'finance_top_organizations table exists');

select has_column('public', 'finance_individual_donors', 'donor_name',  'donor_name col present');
select has_column('public', 'finance_individual_donors', 'employer',    'employer col present');
select has_column('public', 'finance_individual_donors', 'occupation',  'occupation col present');
select has_column('public', 'finance_top_organizations', 'org_name',    'org_name col present');

select col_is_pk('public', 'finance_individual_donors',
                 array['finance_summary_id','rank'],
                 'finance_individual_donors composite PK');
select col_is_pk('public', 'finance_top_organizations',
                 array['finance_summary_id','rank'],
                 'finance_top_organizations composite PK');

select col_has_check('public', 'finance_individual_donors', 'rank',
                     'finance_individual_donors rank has range check');
select col_has_check('public', 'finance_top_organizations', 'rank',
                     'finance_top_organizations rank has range check');

select has_index('public', 'finance_individual_donors', 'finance_individual_donors_summary_idx',
                 'finance_individual_donors index exists');
select has_index('public', 'finance_top_organizations', 'finance_top_organizations_summary_idx',
                 'finance_top_organizations index exists');

-- RLS (migration 0025)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_individual_donors'::regclass),
  'finance_individual_donors has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_top_organizations'::regclass),
  'finance_top_organizations has RLS enabled'
);

-- Seed prerequisite: one official + one finance_summary so we can verify
-- cascade-delete and anon INSERT denial.
set local role service_role;
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house','CA','CA-fin-iao-test','CA fin iao test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-iao')
  on conflict (tier,code) do nothing;
insert into public.officials (bioguide_id, first_name, last_name, full_name,
  chamber, party, state, district_id, senate_class, source_version)
  select 'IAOTST1','F','T','IAO Test','house','D','CA', id, null, '119'
  from public.districts where code = 'CA-fin-iao-test'
  on conflict (bioguide_id) do nothing;
insert into public.finance_summaries (official_id, cycle, opensecrets_id, source_url)
  select id, '2024', 'N99IAO', 'https://x' from public.officials where bioguide_id = 'IAOTST1';
insert into public.finance_individual_donors (finance_summary_id, rank, donor_name, amount)
  select id, 1, 'Test Donor', 1000 from public.finance_summaries where opensecrets_id = 'N99IAO';
insert into public.finance_top_organizations (finance_summary_id, rank, org_name, amount)
  select id, 1, 'Test Org', 5000 from public.finance_summaries where opensecrets_id = 'N99IAO';
reset role;

set local role anon;
select throws_ok(
  $$ insert into public.finance_individual_donors (finance_summary_id, rank, donor_name, amount)
     select id, 2, 'Bad Donor', 999 from public.finance_summaries where opensecrets_id = 'N99IAO' $$,
  '42501', null,
  'anon cannot INSERT into finance_individual_donors'
);
reset role;

-- Cascade-delete verification: deleting the parent summary clears both child tables.
set local role service_role;
delete from public.finance_summaries where opensecrets_id = 'N99IAO';
select is(
  (select count(*)::int from public.finance_individual_donors),
  0,
  'cascade-delete removes finance_individual_donors rows'
);
select is(
  (select count(*)::int from public.finance_top_organizations),
  0,
  'cascade-delete removes finance_top_organizations rows'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP**

```bash
pnpm db:test 2>&1 | tail -15
```

Expected: existing pgTAP files still pass; new `finance_individuals_and_orgs.test.sql` reports 16/16 passing. (CLAUDE.md gotcha #6 still applies: 4 TIGER-dependent tests in `tiger_ingest.test.sql` may fail unless `pnpm seed:tiger` ran first — that's pre-existing, unrelated to this task.)

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/tests/finance_individuals_and_orgs.test.sql
git commit -m "test(db): pgTAP for finance_individual_donors + finance_top_organizations (schema + RLS + cascade-delete)"
```

---

### Task 9: Final verify + audit doc

**Files:**
- Modify: `docs/superpowers/slice-4-drill-down-audit.md` (mark relevant rows resolved)

- [ ] **Step 1: Workspace checks**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/web build 2>&1 | tail -10
pnpm --filter @chiaro/web test 2>&1 | tail -10
pnpm --filter @chiaro/db test 2>&1 | tail -10
```

Expected: typecheck clean (9 packages); web build green; web tests green (existing + new `TopAmountBreakdown.test.tsx`); db tests green (extended `finance-ingest.test.ts`).

- [ ] **Step 2: Manual smoke**

Confirm local services are running:

```bash
pnpm db:start                                          # if not already up
pnpm --filter @chiaro/db functions:serve               # background; loads .env.local for GEOCODIO_KEY
pnpm --filter @chiaro/web dev                          # background
```

Re-run the Mike Carey audit fixture so his `finance_individual_donors` + `finance_top_organizations` rows are seeded (the fixture's `audit-fixture-attach.ts` may need updating for the new tables — if so, treat that as a small follow-up commit, NOT a plan failure):

```bash
AUDIT_TARGET_BIOGUIDE=C001126 pnpm --filter @chiaro/db exec tsx supabase/seed/audit-fixture-attach.ts 2>&1 | tail -5
```

Then in a signed-in browser at `http://localhost:3000/officials/<carey-id>`:

- Open Finance category → "Individual Donors" sub-cascade expands into bars (not soft-beige placeholder).
- Open "Top Organizations" sub-cascade expands into bars.
- Confirm "Top Industries" (existing) still works (regression check).
- Visit a senator (Bernie Moreno) → Finance category empty-state still fires; no crashes.

- [ ] **Step 3: Update audit doc**

Open `docs/superpowers/slice-4-drill-down-audit.md`. In the Finance category section (around line ~47-59), find the rows about "Individual Donors" and "Top Organizations" placeholder sub-cascades. Annotate them as resolved by this slice:

```
✅ RESOLVED 2026-05-18 (PR pending — slice 5A finance placeholders) — <original row>
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/slice-4-drill-down-audit.md
git commit -m "docs(audit): mark Individual Donors + Top Organizations placeholders resolved"
```

---

## Acceptance — recapped from the spec

After Task 9 lands, all 12 spec acceptance criteria must pass:

1. ✅ Finance category renders both Individual Donors + Top Organizations as real sub-cascades (no more soft-beige placeholders).
2. ✅ Both sub-cascades render `TopAmountBreakdown` bars with top 5 default + "Show 5 more" toggle.
3. ✅ Top Industries continues to work (migrated to the shared component).
4. ✅ `pnpm seed:finance` populates the two new tables when official has OpenSecrets CID.
5. ✅ Each new table has at most 10 rows per (official, cycle); existing `finance_industry_top` still at 25.
6. ✅ Cascade-delete of `finance_summaries` clears child rows in both new tables.
7. ✅ Empty-state (no ingest) → existing "No OpenSecrets..." copy still fires.
8. ✅ Per-endpoint parse failure leaves other endpoints intact.
9. ✅ `pnpm -r typecheck` clean.
10. ✅ `pnpm --filter @chiaro/web build` succeeds.
11. ✅ All new + migrated unit tests green.
12. ✅ New pgTAP test passes against fresh local Supabase + migrations 0024+0025.

---

## Plan self-review notes

- **Spec coverage:** Every spec section maps to ≥1 task. Migration 0024 = Task 1. Migration 0025 + types regen = Task 2. Adapter `candContrib`/`candOrgs` = Task 3. Ingest upserts = Task 4. Query extension = Task 5. UI refactor = Task 6. UI integration = Task 7. pgTAP = Task 8. Workspace verify + audit refresh = Task 9.
- **No placeholders:** Every code step shows the full code or a precise diff. No `TBD` / "implement similar to" / "add error handling". Per-endpoint try/catch is shown verbatim in Task 3. Empty-state copy is shown verbatim in Task 7.
- **Type consistency:** `FinanceIndividualDonorRow` / `FinanceTopOrganizationRow` introduced in Task 5; consumed in Task 7 via destructure `{ individualDonors, topOrgs }` from `useOfficialFinance`. `TopAmountRow.label` introduced in Task 6; consumed in Tasks 6 (industries migration) and 7 (donors + orgs). `noun` shape `{ singular, plural }` consistent across all three call sites in Tasks 6+7. `stats.individualDonorsUpserted` + `stats.topOrganizationsUpserted` introduced in Task 4's `FinanceIngestStats` interface; asserted in same Task 4's tests.
- **Database type regen:** Task 2 includes `pnpm db:gen-types` so `Database['public']['Tables']['finance_individual_donors']['Row']` is available in Task 5.
