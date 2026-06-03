# Slice 53 — Watchlist Evidence (donor watchlists) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 2 data-backed donor watchlists real — when a signed-in user selects them, every federal rep's Issue Positions card shows a `⚑` flag with evidence (the matched fossil-fuel / private-prison industries + $).

**Architecture:** Config-driven, on-the-fly, mirroring slice 52. The lens's `evidence_sources` jsonb holds `{type:'finance-industry', config:{category, industries[]}}`; a curated industry-name list per category is baked in at seed time; a new SECURITY DEFINER SQL fn `get_rep_watchlist_flags` (migration 0058, **no new tables**) evaluates each rep's `finance_industry_top` against it. `@chiaro/issues` exposes a typed query/hook; the 2 existing Issue Positions cards render inline flags. The 3 non-data-backed watchlists are deactivated.

**Tech Stack:** Postgres 15 + pgTAP, Supabase RPC, TypeScript (strict, ESNext, `.ts` extensions), TanStack Query, react-native-web 0.19, vitest, Next 15.

**Spec:** `docs/superpowers/specs/2026-06-03-slice-53-watchlist-evidence-design.md` (read §4 data model, §5 scoring fn, §7 UI before starting).

---

## Conventions (read once)

- **Commit after every task.** Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Relative imports use the `.ts`/`.tsx` extension.** No inline hex — UI consumes `useBrandTokens()`.
- After each code task run `pnpm -r typecheck` before committing.
- **NULL ≠ 0** — a rep with no industry data / no match yields no flag, never a zero/empty flag.
- **Federal-only:** `finance_industry_top` → `finance_summaries` is federal (OpenSecrets). State reps never match the 2 v1 watchlists; the UI slot still exists.
- **pgTAP:** each file `begin; select plan(N); … select * from finish(); rollback;`. Run the suite with `pnpm db:reset && pnpm seed:tiger && pnpm db:test` (needs `pnpm db:start`).
- **Ship via PR with all 4 CI jobs green** (Gotcha #30). Do NOT merge locally.

---

## File Structure

**Database (`packages/db/`)**
- `supabase/migrations/0058_watchlist_flags.sql` — `get_rep_watchlist_flags` fn + grant. (No tables/columns — `evidence_sources` + `active` exist from 0056.)
- `supabase/tests/get_rep_watchlist_flags.test.sql` — pgTAP.
- `supabase/seed/issue-catalog/finance-industry-categories.ts` — curated industry-name lists per category.
- `supabase/seed/issue-catalog/catalog-data.ts` — add `EvidenceSource` interface + `active?` to `LensSeed`; wire 2 donor watchlists; deactivate 3.
- `supabase/seed/issue-catalog/ingest.ts` — `active: l.active ?? true`.
- `supabase/seed/issue-catalog/ingest.test.ts` — add catalog-wiring assertions.
- `supabase/seed/fixtures/issue-catalog.fixture.ts` + `issue-catalog/ingest.integration.test.ts` — exercise an `evidence_sources`-bearing watchlist in CI.

**Package (`packages/issues/`)** — `src/{types,queries,keys,hooks,index}.ts` (+ `test/`).

**Shared UI (`packages/officials-ui/`)** — `src/issues/WatchlistFlag.tsx` + edits to `federal/FederalIssuePositionsCard.tsx`, `state/StateIssuePositionsCard.tsx`, barrel + tests.

**Docs** — `CLAUDE.md` slice-53 entry.

---

## PHASE 1 — Database & catalog

### Task 1: Catalog wiring — evidence_sources + deactivation

**Files:**
- Create: `packages/db/supabase/seed/issue-catalog/finance-industry-categories.ts`
- Modify: `packages/db/supabase/seed/issue-catalog/catalog-data.ts`
- Modify: `packages/db/supabase/seed/issue-catalog/ingest.ts`
- Modify (test): `packages/db/supabase/seed/issue-catalog/ingest.test.ts`

- [ ] **Step 1: Verify the real industry strings, then write the category lists**

First, with local Supabase up + finance seeded (or against any DB that ran `seed:finance`), inspect available industry names:
`pnpm --filter @chiaro/db exec psql "$SUPABASE_DB_URL" -c "select distinct industry from finance_industry_top order by 1;"`
> If finance isn't seeded locally, use the OpenSecrets industry names below as the starter set (they are the canonical OpenSecrets sector/industry labels) and refine in a follow-up. The match is exact against `finance_industry_top.industry`.

Create `packages/db/supabase/seed/issue-catalog/finance-industry-categories.ts`:
```ts
// Curated OpenSecrets industry-name lists per watchlist category. Strings must
// match finance_industry_top.industry EXACTLY (the SQL fn does `industry in (...)`).
// Operator extends these in code as new industries surface (YAGNI on a table).

export const FOSSIL_FUEL_INDUSTRIES: string[] = [
  'Oil & Gas',
  'Coal Mining',
  'Mining',
  'Electric Utilities',
  'Natural Gas Pipelines',
  'Oil & Gas Refining & Marketing',
]

export const PRIVATE_PRISON_INDUSTRIES: string[] = [
  'Private Prisons',
  'Corrections',
  'Prisons & Corrections',
]
```

- [ ] **Step 2: Write the failing catalog-wiring assertions**

Add to `packages/db/supabase/seed/issue-catalog/ingest.test.ts` (inside the existing `describe('ingestIssueCatalog', …)`):
```ts
  it('wires evidence_sources on the 2 donor watchlists', () => {
    const findLens = (slug: string) =>
      ISSUE_CATALOG.flatMap((t) => t.lenses).find((l) => l.slug === slug)!
    for (const slug of ['industry-donor-recipients', 'for-profit-prisons']) {
      const lens = findLens(slug)
      expect(lens.evidence_sources.length).toBeGreaterThan(0)
      const src = lens.evidence_sources[0] as { type: string; config: { industries: string[] } }
      expect(src.type).toBe('finance-industry')
      expect(src.config.industries.length).toBeGreaterThan(0)
    }
  })

  it('deactivates the 3 non-data-backed watchlists', () => {
    const findLens = (slug: string) =>
      ISSUE_CATALOG.flatMap((t) => t.lenses).find((l) => l.slug === slug)!
    for (const slug of ['slapp-suit-participants', 'anti-fraud-self-interest', 'epstein-related-protectors'])
      expect(findLens(slug).active).toBe(false)
    // the 2 donor watchlists stay active (active === undefined → defaults true at ingest)
    expect(findLens('industry-donor-recipients').active).not.toBe(false)
  })

  it('ingest writes active:false for deactivated lenses', async () => {
    const upserts: Record<string, unknown[]> = {}
    const client = {
      from: (table: string) => ({
        upsert: async (rows: unknown[]) => { upserts[table] = [...(upserts[table] ?? []), ...rows]; return { error: null } },
      }),
    } as never
    await ingestIssueCatalog(client)
    const slapp = (upserts['issue_lenses'] as Array<{ slug: string; active: boolean }>).find((r) => r.slug === 'slapp-suit-participants')!
    expect(slapp.active).toBe(false)
  })
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @chiaro/db test issue-catalog/ingest`
Expected: FAIL — `evidence_sources` empty / `active` undefined on those lenses.

- [ ] **Step 4: Add the `EvidenceSource` interface + `active?` to `LensSeed`**

In `packages/db/supabase/seed/issue-catalog/catalog-data.ts`, after the `MeasurementSource` interface add:
```ts
export interface EvidenceSource {
  type: 'finance-industry'
  config: { category: string; industries: string[]; min_amount?: number }
}
```
Change the `LensSeed` interface's `evidence_sources` type + add `active?`:
```ts
export interface LensSeed {
  slug: string; label: string; lens_type: 'stance' | 'watchlist'; description?: string
  measurement_sources: MeasurementSource[]; evidence_sources: EvidenceSource[]; quiz_questions: QuizQuestion[]; display_order: number
  active?: boolean
}
```
Add the import at the top of the file:
```ts
import { FOSSIL_FUEL_INDUSTRIES, PRIVATE_PRISON_INDUSTRIES } from './finance-industry-categories.ts'
```

- [ ] **Step 5: Wire the 2 donor watchlists + deactivate the 3 others**

In `catalog-data.ts`, replace the `industry-donor-recipients` lens (environment topic) `evidence_sources: []` with:
```ts
        measurement_sources: [],
        evidence_sources: [{ type: 'finance-industry', config: { category: 'fossil-fuel', industries: FOSSIL_FUEL_INDUSTRIES } }],
        quiz_questions: [] } ] },
```
Replace the `for-profit-prisons` lens (law-and-order) `evidence_sources: []` with:
```ts
        description: 'Reps receiving major private-prison-industry contributions.',
        measurement_sources: [],
        evidence_sources: [{ type: 'finance-industry', config: { category: 'private-prison', industries: PRIVATE_PRISON_INDUSTRIES } }],
        quiz_questions: [] },
```
Add `active: false` to the 3 non-backed watchlists. For `slapp-suit-participants` (law-and-order), add a `@deprecated` line + `active: false`:
```ts
      // @deprecated slice 53 — wrong-premise: no public SLAPP/court-records data source (Gotcha #20 audit 2026-06-03).
      { slug: 'slapp-suit-participants', label: 'SLAPP-Suit Participants', lens_type: 'watchlist', display_order: 5, active: false,
        description: 'Reps who filed or supported lawsuits aimed at silencing critics or the press.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] } ] },
```
And for `anti-fraud-self-interest` + `epstein-related-protectors`, add `active: false` + a deferral comment:
```ts
      // Deferred slice 53 — curated-data only (no auto-derivable source); revisit in a future curated slice.
      { slug: 'anti-fraud-self-interest', label: 'Anti-Fraud & Self-Interest', lens_type: 'watchlist', display_order: 2, active: false,
        description: 'Reps tied to fraud findings or votes that advanced their own financial interests.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] },
      // Deferred slice 53 — curated bill-list only (no Epstein subject tagging in Congress.gov); revisit in a future curated slice.
      { slug: 'epstein-related-protectors', label: 'Epstein-Related Protectors', lens_type: 'watchlist', display_order: 4, active: false,
        description: 'Reps who acted to block or delay release of Epstein-related records.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] },
```

- [ ] **Step 6: Pass `active` through the ingester**

In `packages/db/supabase/seed/issue-catalog/ingest.ts`, change the lensRows map's `active: true` to `active: l.active ?? true`:
```ts
    display_order: l.display_order, active: l.active ?? true })))
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm --filter @chiaro/db test issue-catalog/ingest && pnpm -r typecheck`
Expected: PASS — all ingest tests; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add packages/db/supabase/seed/issue-catalog
git commit -m "feat(slice-53): wire donor-watchlist evidence_sources + deactivate non-backed watchlists" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration 0058 — `get_rep_watchlist_flags` SQL fn

**Files:**
- Create: `packages/db/supabase/migrations/0058_watchlist_flags.sql`
- Create (test): `packages/db/supabase/tests/get_rep_watchlist_flags.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/get_rep_watchlist_flags.test.sql`:
```sql
begin;
select plan(6);

-- official
insert into public.officials (id, full_name, chamber, state, party, bioguide_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Test Rep', 'federal_house', 'CA', 'D', 'T000001');
-- finance summary + industry rows: one matching ('Oil & Gas'), one not ('Lawyers/Law Firms')
insert into public.finance_summaries (id, official_id, cycle, opensecrets_id, source_url)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '2024', 'N00000001', 'https://x');
insert into public.finance_industry_top (finance_summary_id, rank, industry, amount) values
  ('00000000-0000-0000-0000-0000000000c1', 1, 'Oil & Gas', 42000),
  ('00000000-0000-0000-0000-0000000000c1', 2, 'Lawyers/Law Firms', 5000);
-- user + catalog: Environment / industry-donor-recipients watchlist matching 'Oil & Gas'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a99', 'u@x.io');
insert into public.issue_topics (slug, display_name, description) values ('environment','Environment','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type, evidence_sources)
  values ('environment','industry-donor-recipients','Industry Donor Recipients','watchlist',
          '[{"type":"finance-industry","config":{"category":"fossil-fuel","industries":["Oil & Gas","Coal Mining"]}}]'::jsonb);
insert into public.user_issue_selections (user_id, topic_slug, lens_slug)
  values ('00000000-0000-0000-0000-000000000a99','environment','industry-donor-recipients');

select has_function('public','get_rep_watchlist_flags', array['uuid'], 'fn exists');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a99"}';

-- match → exactly one flag, with the right label + the matched industry in evidence
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          1, 'one flag for matching rep');
select is(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')->0->>'lensSlug',
          'industry-donor-recipients', 'flag carries the lens slug');
select is((public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')->0->'evidence'->0->>'industry'),
          'Oil & Gas', 'evidence lists the matched industry');

-- a rep with no matching industries → no flags
insert into public.officials (id, full_name, chamber, state, party, bioguide_id)
  values ('00000000-0000-0000-0000-0000000000f2', 'No Match', 'federal_house', 'TX', 'R', 'T000002');
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f2')),
          0, 'no flags when rep has no category industries');

reset role;
-- unauthenticated → empty array
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          0, 'unauthenticated → empty');

select * from finish();
rollback;
```
> Confirm the `officials` + `finance_summaries` insert columns against the live schema (`\d public.officials`, `\d public.finance_summaries`); adjust the seed inserts if a NOT NULL column is missing. The behavioral asserts are the contract.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:reset && pnpm db:test` (or just the one file). Expected: FAIL — `has_function` false.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0058_watchlist_flags.sql`:
```sql
-- Slice 53 — watchlist evidence. On-the-fly per-rep flags for the caller's
-- selected watchlist lenses (mirrors slice 52 get_rep_issue_alignment).
-- No new tables: reads issue_lenses.evidence_sources (0056) + finance data (0020).

create function public.get_rep_watchlist_flags(p_official_id uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  flags jsonb := '[]'::jsonb;
  rec record; src jsonb; cfg jsonb; ev jsonb; total numeric;
begin
  if uid is null then return '[]'::jsonb; end if;
  for rec in
    select t.slug as topic_slug, l.slug as lens_slug, l.label as label, l.evidence_sources as sources
    from user_issue_selections s
      join issue_lenses l on l.topic_slug = s.topic_slug and l.slug = s.lens_slug
      join issue_topics  t on t.slug = s.topic_slug
    where s.user_id = uid and l.lens_type = 'watchlist' and l.active
    order by t.display_order, l.display_order
  loop
    for src in select * from jsonb_array_elements(coalesce(rec.sources, '[]'::jsonb)) loop
      if src->>'type' = 'finance-industry' then
        cfg := src->'config';
        select coalesce(jsonb_agg(jsonb_build_object('industry', m.industry, 'amount', m.amount) order by m.amount desc), '[]'::jsonb),
               coalesce(sum(m.amount), 0)
          into ev, total
        from (
          select fit.industry, fit.amount
          from finance_industry_top fit
            join finance_summaries fs on fs.id = fit.finance_summary_id
          where fs.official_id = p_official_id
            and fs.cycle = (select max(cycle) from finance_summaries where official_id = p_official_id)
            and fit.industry in (select jsonb_array_elements_text(cfg->'industries'))
        ) m;
        if jsonb_array_length(ev) > 0 and total >= coalesce((cfg->>'min_amount')::numeric, 0) then
          flags := flags || jsonb_build_object(
            'topicSlug', rec.topic_slug, 'lensSlug', rec.lens_slug, 'label', rec.label,
            'category', cfg->>'category', 'totalAmount', total, 'evidence', ev);
        end if;
      end if;
    end loop;
  end loop;
  return flags;
end;
$$;

grant execute on function public.get_rep_watchlist_flags(uuid) to authenticated;
```
> Cycle selection v1: `max(cycle)` (latest by lexical text order — fine for 4-digit cycles). Known-limitation; refine if non-numeric cycles appear federally.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `get_rep_watchlist_flags.test.sql` 6/6.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0058_watchlist_flags.sql packages/db/supabase/tests/get_rep_watchlist_flags.test.sql
git commit -m "feat(slice-53): get_rep_watchlist_flags scoring fn (migration 0058)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: CI fixture coverage for evidence_sources

**Files:**
- Modify: `packages/db/supabase/seed/fixtures/issue-catalog.fixture.ts`
- Modify (test): `packages/db/supabase/seed/issue-catalog/ingest.integration.test.ts`

- [ ] **Step 1: Add evidence_sources to the fixture watchlist**

In `issue-catalog.fixture.ts`, change the `fx-for-profit-prisons` lens to carry an evidence source:
```ts
        slug: 'fx-for-profit-prisons',
        label: 'FX For-Profit Prisons',
        lens_type: 'watchlist',
        display_order: 0,
        description: 'Reps receiving major private-prison-industry contributions.',
        measurement_sources: [],
        evidence_sources: [{ type: 'finance-industry', config: { category: 'private-prison', industries: ['Private Prisons'] } }],
        quiz_questions: [],
```

- [ ] **Step 2: Add the failing assertion**

In `packages/db/supabase/seed/issue-catalog/ingest.integration.test.ts`, add an `it` (inside the existing `describe`) asserting the persisted lens kept its evidence_sources:
```ts
  it('persists evidence_sources on a watchlist lens', async () => {
    await ingestIssueCatalog(svc as never, ISSUE_CATALOG_FIXTURE)
    const { data } = await svc.from('issue_lenses')
      .select('evidence_sources').eq('slug', 'fx-for-profit-prisons').single()
    expect(((data?.evidence_sources ?? []) as unknown[]).length).toBeGreaterThan(0)
  })
```
> Match the existing test's `svc` client + import of `ISSUE_CATALOG_FIXTURE`; if the existing test already ingests in `beforeAll`, drop the re-ingest line and just query.

- [ ] **Step 3: Run (with local Supabase env exported)**

Run: `pnpm --filter @chiaro/db test ingest.integration`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/seed/fixtures/issue-catalog.fixture.ts packages/db/supabase/seed/issue-catalog/ingest.integration.test.ts
git commit -m "test(slice-53): CI fixture covers evidence_sources persistence" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 2 — `@chiaro/issues` package

### Task 4: Types + key + query (+ fetchCatalog active filter)

**Files:**
- Modify: `packages/issues/src/types.ts`, `packages/issues/src/keys.ts`, `packages/issues/src/queries.ts`
- Modify (test): `packages/issues/test/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/issues/test/queries.test.ts`, add a test for the new query + update the existing `fetchCatalog` mock to include `.eq()`:
```ts
import { fetchRepAlignment, fetchCatalog, fetchRepWatchlistFlags } from '../src/queries.ts'
// …
  it('fetchRepWatchlistFlags calls the RPC and returns its payload', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ topicSlug: 'environment', lensSlug: 'industry-donor-recipients', label: 'X', category: 'fossil-fuel', totalAmount: 42000, evidence: [{ industry: 'Oil & Gas', amount: 42000 }] }], error: null })
    const out = await fetchRepWatchlistFlags(clientWith({ rpc }), 'off-1')
    expect(rpc).toHaveBeenCalledWith('get_rep_watchlist_flags', { p_official_id: 'off-1' })
    expect(out).toHaveLength(1)
    expect(out[0].evidence[0].industry).toBe('Oil & Gas')
  })
```
Update the existing `fetchCatalog groups lenses under topics` test's mock so `select` returns an object exposing `eq` → `order` (the query now filters active):
```ts
    const from = vi.fn((table: string) => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({
        data: table === 'issue_topics'
          ? [{ slug: 'environment', display_name: 'Environment', lenses: undefined }]
          : [{ topic_slug: 'environment', slug: 'conservation', lens_type: 'stance', measurement_sources: [], quiz_questions: [] }],
        error: null }) }) }) }))
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/issues test queries`
Expected: FAIL — `fetchRepWatchlistFlags` not exported; `fetchCatalog` mock shape mismatch.

- [ ] **Step 3: Add the types**

In `packages/issues/src/types.ts`, append:
```ts
export interface EvidenceSource {
  type: 'finance-industry'
  config: { category: string; industries: string[]; min_amount?: number }
}
export interface WatchlistEvidenceItem { industry: string; amount: number }
export interface RepWatchlistFlag {
  topicSlug: string
  lensSlug: string
  label: string
  category: string
  totalAmount: number
  evidence: WatchlistEvidenceItem[]
}
```

- [ ] **Step 4: Add the key**

In `packages/issues/src/keys.ts`, add to `issuesKeys`:
```ts
  repWatchlistFlags: (officialId: string) => [...issuesKeys.all, 'repWatchlistFlags', officialId] as const,
```

- [ ] **Step 5: Add the query + active filter**

In `packages/issues/src/queries.ts`: add `RepWatchlistFlag` to the type import; add `.eq('active', true)` to the lens query inside `fetchCatalog`; add the new query.
```ts
import type { IssueTopic, IssueLens, RepAlignment, UserIssueSelectionRow, RepWatchlistFlag } from './types.ts'
// inside fetchCatalog — the lenses query:
  const { data: lenses, error: le } = await client.from('issue_lenses').select('*').eq('active', true).order('display_order')
// new export:
export async function fetchRepWatchlistFlags(client: ChiaroClient, officialId: string): Promise<RepWatchlistFlag[]> {
  const { data, error } = await client.rpc('get_rep_watchlist_flags', { p_official_id: officialId })
  if (error) throw error
  return (data as RepWatchlistFlag[] | null) ?? []
}
```
> Leave the topics query unchanged (only lenses are deactivated). The `eq` is chained before `order` to match the updated mock.

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @chiaro/issues test queries && pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/issues/src/types.ts packages/issues/src/keys.ts packages/issues/src/queries.ts packages/issues/test/queries.test.ts
git commit -m "feat(slice-53): RepWatchlistFlag type + fetchRepWatchlistFlags + fetchCatalog active filter" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `useRepWatchlistFlags` hook

**Files:**
- Modify: `packages/issues/src/hooks.ts`, `packages/issues/src/index.ts`
- Modify (test): `packages/issues/test/hooks.test.tsx`

- [ ] **Step 1: Write the failing test**

In `packages/issues/test/hooks.test.tsx`, add a key-shape assertion (mirrors the existing `useRepAlignment` key test):
```ts
import { issuesKeys } from '../src/keys.ts'
it('repWatchlistFlags key is officialId-scoped', () => {
  expect(issuesKeys.repWatchlistFlags('x')).toEqual(['issues', 'repWatchlistFlags', 'x'])
})
```

- [ ] **Step 2: Run to verify it fails / passes**

Run: `pnpm --filter @chiaro/issues test hooks`
Expected: FAIL until Step 3 wires the key (key already added in Task 4, so this may pass — ensure `hooks.ts` compiles after Step 3).

- [ ] **Step 3: Add the hook**

In `packages/issues/src/hooks.ts`, add the imports + hook (mirror `useRepAlignment`):
```ts
import { fetchCatalog, fetchMySelections, fetchRepAlignment, fetchRepWatchlistFlags } from './queries.ts'
// …
export function useRepWatchlistFlags(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: issuesKeys.repWatchlistFlags(officialId),
    queryFn: () => fetchRepWatchlistFlags(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}
```
`index.ts` already re-exports `./hooks.ts` + `./types.ts` via `export *` — no barrel edit needed.

- [ ] **Step 4: Verify + commit**

Run: `pnpm --filter @chiaro/issues test && pnpm -r typecheck`
```bash
git add packages/issues/src/hooks.ts packages/issues/test/hooks.test.tsx
git commit -m "feat(slice-53): useRepWatchlistFlags hook" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 3 — Shared UI

### Task 6: `WatchlistFlag` component

**Files:**
- Create: `packages/officials-ui/src/issues/WatchlistFlag.tsx`
- Modify: `packages/officials-ui/src/index.ts` (barrel)
- Create (test): `packages/officials-ui/test/issues/WatchlistFlag.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/issues/WatchlistFlag.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { WatchlistFlag } from '../../src/issues/WatchlistFlag.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const wrap = (ui: React.ReactElement) =>
  render(ui, { wrapper: ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children) })

describe('WatchlistFlag', () => {
  it('renders the label + evidence summary', () => {
    const { getByText } = wrap(
      <WatchlistFlag flag={{ topicSlug: 'environment', lensSlug: 'industry-donor-recipients',
        label: 'Industry Donor Recipients', category: 'fossil-fuel', totalAmount: 42000,
        evidence: [{ industry: 'Oil & Gas', amount: 30000 }, { industry: 'Coal Mining', amount: 12000 }] }} />)
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
    expect(getByText(/Oil & Gas/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test WatchlistFlag`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `WatchlistFlag.tsx`**

Create `packages/officials-ui/src/issues/WatchlistFlag.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native'
import type { RepWatchlistFlag } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'

export interface WatchlistFlagProps {
  flag: RepWatchlistFlag
}

/** Compact thousands formatter: 42000 → "$42k", 950 → "$950". */
function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
}

/**
 * An inline "⚑" watchlist flag for the Issue Positions card: shows the matched
 * watchlist label + an evidence line (the contributing industries + total).
 * Presentational; the card fetches via useRepWatchlistFlags and renders one per
 * match. Distinct from the ★ IssuePriorityTag (different glyph + tone).
 */
export function WatchlistFlag({ flag }: WatchlistFlagProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const industries = flag.evidence.map((e) => e.industry).join(', ')
  return (
    <View
      accessibilityLabel={`Watchlist flag: ${flag.label}`}
      style={[styles.row, { backgroundColor: semantic.bg.subtle, borderColor: semantic.border.default }]}
    >
      <Text style={[styles.label, { color: semantic.alert.warning.fg }]} numberOfLines={1}>
        ⚑ {flag.label}
      </Text>
      <Text style={[styles.evidence, { color: semantic.text.muted }]} numberOfLines={2}>
        {money(flag.totalAmount)} from {industries}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  evidence: { fontSize: 12, marginTop: 2 },
})
```
> Confirm `semantic.alert.warning.fg` exists in `brand-hooks`/ui-tokens (slice 37 added `alert.warning`); if the exact path differs, use the closest warning/flag token — no inline hex.

- [ ] **Step 4: Barrel-export**

In `packages/officials-ui/src/index.ts`, add next to the other `issues/*` exports:
```ts
export { WatchlistFlag, type WatchlistFlagProps } from './issues/WatchlistFlag.tsx'
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @chiaro/officials-ui test WatchlistFlag && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/WatchlistFlag.tsx packages/officials-ui/src/index.ts packages/officials-ui/test/issues/WatchlistFlag.test.tsx
git commit -m "feat(slice-53): WatchlistFlag component" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Integrate flags into `FederalIssuePositionsCard`

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx`
- Create (test): `packages/officials-ui/test/federal/FederalIssuePositionsCard.test.tsx` (or extend if it exists)

- [ ] **Step 1: Write the failing test**

Create/extend `packages/officials-ui/test/federal/FederalIssuePositionsCard.test.tsx`. Mock `@chiaro/officials` (scorecard ratings) + `@chiaro/issues` (selections/catalog empty, one watchlist flag):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return { ...actual, useOfficialScorecardRatings: () => ({ data: [], isLoading: false }) }
})
vi.mock('@chiaro/issues', async () => {
  const actual = await vi.importActual<object>('@chiaro/issues')
  return {
    ...actual,
    useMySelections: () => ({ data: [] }),
    useIssueCatalog: () => ({ data: [] }),
    useRepWatchlistFlags: () => ({ data: [{ topicSlug: 'environment', lensSlug: 'industry-donor-recipients',
      label: 'Industry Donor Recipients', category: 'fossil-fuel', totalAmount: 42000,
      evidence: [{ industry: 'Oil & Gas', amount: 42000 }] }] }),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { FederalIssuePositionsCard } from '../../src/federal/FederalIssuePositionsCard.tsx'

const mockClient = { from: () => {} } as unknown as ChiaroClient
const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
    { wrapper: ({ children }: { children: ReactNode }) =>
        createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children) },
  )
}

describe('FederalIssuePositionsCard — watchlist flags', () => {
  it('renders a watchlist flag even with no scorecard ratings', () => {
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="off-1" />)
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test FederalIssuePositionsCard`
Expected: FAIL — flag not rendered (card doesn't consume the hook yet).

- [ ] **Step 3: Wire the hook + render flags**

In `FederalIssuePositionsCard.tsx`: add imports + the hook + a `flagsSection`, rendered after the title in BOTH the empty-rows branch and the normal branch.
```tsx
import { useMySelections, useIssueCatalog, useRepWatchlistFlags } from '@chiaro/issues'
import { WatchlistFlag } from '../issues/WatchlistFlag.tsx'
// … inside the component, after the existing hooks:
  const watchlistFlags = useRepWatchlistFlags(client, officialId)
  const flags = watchlistFlags.data ?? []
  const flagsSection =
    flags.length > 0 ? (
      <View>{flags.map((f) => <WatchlistFlag key={`${f.topicSlug}::${f.lensSlug}`} flag={f} />)}</View>
    ) : null
```
In the `rows.length === 0` branch, insert `{flagsSection}` after the `<Text … >Issue Positions</Text>` (and keep the "No issue-position ratings…" text). In the final (normal) `return`, insert `{flagsSection}` after the `<Text … >Issue Positions</Text>` title, before the summary line.
> Loading branch stays unchanged (no flags while ratings load).

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @chiaro/officials-ui test FederalIssuePositionsCard && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx packages/officials-ui/test/federal/FederalIssuePositionsCard.test.tsx
git commit -m "feat(slice-53): watchlist flags in FederalIssuePositionsCard" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Integrate flags into `StateIssuePositionsCard`

**Files:**
- Modify: `packages/officials-ui/src/state/StateIssuePositionsCard.tsx`
- Create (test): `packages/officials-ui/test/state/StateIssuePositionsCard.test.tsx` (or extend)

- [ ] **Step 1: Write the failing test**

Create/extend `packages/officials-ui/test/state/StateIssuePositionsCard.test.tsx` (self-contained):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return { ...actual, useOfficialStateScorecardRatings: () => ({ data: [], isLoading: false }) }
})
vi.mock('@chiaro/issues', async () => {
  const actual = await vi.importActual<object>('@chiaro/issues')
  return {
    ...actual,
    useMySelections: () => ({ data: [] }),
    useIssueCatalog: () => ({ data: [] }),
    useRepWatchlistFlags: () => ({ data: [{ topicSlug: 'environment', lensSlug: 'industry-donor-recipients',
      label: 'Industry Donor Recipients', category: 'fossil-fuel', totalAmount: 42000,
      evidence: [{ industry: 'Oil & Gas', amount: 42000 }] }] }),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateIssuePositionsCard } from '../../src/state/StateIssuePositionsCard.tsx'

const mockClient = { from: () => {} } as unknown as ChiaroClient
const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
    { wrapper: ({ children }: { children: ReactNode }) =>
        createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children) },
  )
}

describe('StateIssuePositionsCard — watchlist flags', () => {
  it('renders a watchlist flag even with no scorecard ratings', () => {
    const { getByText } = wrap(<StateIssuePositionsCard officialId="off-1" />)
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test StateIssuePositionsCard`
Expected: FAIL — flag not rendered.

- [ ] **Step 3: Wire the hook + render flags**

In `StateIssuePositionsCard.tsx`: add `useRepWatchlistFlags` + `WatchlistFlag` imports; compute `flags`/`flagsSection` (same as Task 7); render `{flagsSection}` after the `<Text style={titleStyle}>Issue Positions</Text>` in the empty branch, the priority-path branch, and the grouped-path branch (NOT the loading branch).
> State donor data is federal-only → in production `flags` is empty for state reps and `flagsSection` is null (card unchanged). The slot exists for future state watchlists.

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @chiaro/officials-ui test StateIssuePositionsCard && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/state/StateIssuePositionsCard.tsx packages/officials-ui/test/state/StateIssuePositionsCard.test.tsx
git commit -m "feat(slice-53): watchlist flags in StateIssuePositionsCard" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 4 — Closeout

### Task 9: Full verification + docs + PR

**Files:**
- Modify: `CLAUDE.md` (Slices delivered — add Slice 53; Gotcha refs)

- [ ] **Step 1: Full green sweep (local)**

Run, in order:
```bash
pnpm -r typecheck
pnpm db:reset && pnpm seed:tiger && pnpm db:test   # incl. get_rep_watchlist_flags (428→ +? plans)
pnpm test
pnpm --filter @chiaro/web build
pnpm --filter @chiaro/web test                      # web render tests (Gotcha #30)
pnpm --filter @chiaro/mobile test
```
Expected: all PASS. Capture the new pgTAP plan count.

- [ ] **Step 2: Seed the real catalog + smoke**

Run: `pnpm seed:issue-catalog` then confirm the 2 donor watchlists carry evidence_sources and the 3 others are inactive:
`select slug, active, evidence_sources from issue_lenses where lens_type='watchlist';`

- [ ] **Step 3: Write the CLAUDE.md "Slices delivered" entry**

Append a `**Slice 53 — watchlist evidence (donor watchlists)**` bullet: evidence_sources model + `get_rep_watchlist_flags` (migration 0058, no new tables), 2 federal donor watchlists wired via curated industry lists, 3 non-backed watchlists deactivated (SLAPP wrong-premise; anti-fraud + Epstein deferred), inline `⚑` flags in the Issue Positions cards, federal-only (Gotcha #15 preserved). Note radar overlay still deferred. Reference the 2026-06-03 data-availability audit + Gotcha #20.

- [ ] **Step 4: Commit + open PR (Gotcha #30)**

```bash
git add CLAUDE.md
git commit -m "docs(slice-53): CLAUDE.md slice 53 entry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin slice-53-watchlist-evidence
gh pr create --base master --title "Slice 53 — Watchlist evidence (donor watchlists)"
```
(Write the PR body from this plan's Goal + the spec's scope: evidence model + `get_rep_watchlist_flags` + 2 federal donor watchlists + 3 deactivations + inline `⚑` flags; note radar overlay deferred. End with the Claude Code trailer.)
Then watch CI (`gh pr checks <n> --watch`); merge `--squash --delete-branch` ONLY when all 4 jobs (db/build/functions/test) are green. Sync master.

- [ ] **Step 5: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Update the slice-53 memory note to SHIPPED with the squash hash.

---

## Self-Review notes (for the planner)

- **Spec coverage:** §4 model → Task 1 (catalog + EvidenceSource) + Task 4 (types); §4.2 industry lists → Task 1; §5 scoring fn → Task 2; §6 package → Tasks 4-5; §7 UI → Tasks 6-8; §8 testing → throughout + Task 3; §9 verification → Task 9; §10 deferrals → respected (no radar, no new tables, federal-only). ✓
- **Active deactivation actually hides the lenses:** Task 1 sets `active:false` + ingest passes it through; Task 4 adds `.eq('active', true)` to `fetchCatalog`'s lens query (so the flow's picker drops them) + the SQL fn filters `l.active`. ✓
- **Naming consistency:** `get_rep_watchlist_flags`, `EvidenceSource`, `RepWatchlistFlag`, `fetchRepWatchlistFlags`, `useRepWatchlistFlags`, `issuesKeys.repWatchlistFlags`, `WatchlistFlag` used identically across tasks.
- **Live-code reconciliation items (flagged inline):** exact `finance_industry_top.industry` strings (Task 1 Step 1); `officials`/`finance_summaries` insert columns (Task 2 Step 1); `semantic.alert.warning.fg` token path (Task 6 Step 3); whether a `FederalIssuePositionsCard`/`StateIssuePositionsCard` test file already exists (Tasks 7-8).
