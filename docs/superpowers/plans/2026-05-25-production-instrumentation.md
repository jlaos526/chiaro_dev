# Slice 22 — Production-run instrumentation framework implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adapter-level skip-reason telemetry + orchestrator `--instrument` CLI flag so operator can run production ingest passes that capture diagnostic data without changing default behavior.

**Architecture:** 4 tasks sequenced — Task 1 builds the helper + WIDENS the adapter interface; Tasks 2-3 instrument adapter implementations; Task 4 wires the orchestrators + docs.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler. No new workspace deps. Uses slice 18's `tsconfig.seed.json` composite typecheck + `stubFetchBlocked` test helper.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-production-instrumentation-design.md` (slice 22 spec)
- Slice 18 plan — generic `StateXxxAdapter<E>` interface widening (slice 22 extends this to add `onSkip?`)
- Slice 20 plan — TX TEC `errors[]` dual-write pattern (slice 22 keeps for back-compat)
- Existing orchestrators: `packages/db/supabase/seed/state-{community,ethics}-ingest.ts`

**Key findings from file exploration:**

- `state-ethics-ingest.ts:73` calls `adapter.fetchEvents({ client, state? })` — the call site that needs to gain `onSkip`.
- CLI argv parsing already pattern: `process.argv.find(a => a.startsWith('--x='))` + `process.argv.includes('--flag')`.
- Existing `IngestStateEthicsOpts` accepts `client?` injection — instrumentation collector can be injected the same way for testability.
- TX TEC's existing `errors[]` array stays (back-compat); `onSkip` is called in addition (dual-write per slice 22 spec).
- `fetchPerMemberOffices` (slice 18 helper) needs both `adapter` slug + `onSkip` callback added to its opts.

---

## File Structure

### Created files (4)
```
packages/db/supabase/seed/shared/instrumentation.ts                  Task 1
packages/db/supabase/seed/shared/instrumentation.test.ts             Task 1
docs/superpowers/instrumentation-guide.md                            Task 4
~/.claude/projects/.../memory/project_chiaro_slice22_instrumentation.md   Task 4 (outside repo)
```

### Modified files (~14)
```
packages/db/supabase/seed/state-community/shared.ts                  Task 1 (interface widen)
packages/db/supabase/seed/state-ethics/shared.ts                     Task 1 (interface widen)

packages/db/supabase/seed/state-community/district-offices/_shared.ts          Task 2
packages/db/supabase/seed/state-community/district-offices/_shared.test.ts     Task 2
packages/db/supabase/seed/state-community/district-offices/ca-leginfo/{senate,assembly,index}.ts  Task 2
packages/db/supabase/seed/state-community/district-offices/mi-legislature/{senate,house,index}.ts Task 2
packages/db/supabase/seed/state-community/district-offices/fl-doe/{senate,house,index}.ts        Task 2
packages/db/supabase/seed/state-community/district-offices/ny-senate/{assembly,senate,index}.ts  Task 2

packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts        Task 3
packages/db/supabase/seed/state-ethics/disclosures/mi-board.test.ts   Task 3
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts        Task 3
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts   Task 3
packages/db/supabase/seed/state-ethics/tx-tec/shared.ts               Task 3
packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts          Task 3
packages/db/supabase/seed/state-ethics/complaints/tx-tec.ts           Task 3 (thin propagation)
packages/db/supabase/seed/state-ethics/events/tx-tec.ts               Task 3 (thin propagation)

packages/db/supabase/seed/state-community-ingest.ts                   Task 4
packages/db/supabase/seed/state-ethics-ingest.ts                      Task 4
CLAUDE.md                                                              Task 4
```

**Total touched: ~25 files.** Most are mechanical opts-propagation through adapter index.ts files.

---

## Task 1: `instrumentation.ts` + `StateXxxAdapter` interface widening

**Files:**
- Create: `packages/db/supabase/seed/shared/instrumentation.ts`
- Create: `packages/db/supabase/seed/shared/instrumentation.test.ts`
- Modify: `packages/db/supabase/seed/state-community/shared.ts` (widen `StateCommunityAdapter` opts)
- Modify: `packages/db/supabase/seed/state-ethics/shared.ts` (widen `StateEthicsAdapter` opts)

- [ ] **Step 1: Write the failing helper test**

Create `packages/db/supabase/seed/shared/instrumentation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createSkipCollector,
  formatSkipSummary,
  type SkipReason,
  type SkipSummary,
} from './instrumentation.ts'

describe('createSkipCollector', () => {
  it('returns onSkip + summary functions', () => {
    const collector = createSkipCollector()
    expect(typeof collector.onSkip).toBe('function')
    expect(typeof collector.summary).toBe('function')
  })

  it('aggregates skips by adapter + stage', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'fetch', reason: '404' })
    onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'timeout' })
    onSkip({ adapter: 'mi-board', stage: 'parse', reason: 'no items' })
    onSkip({ adapter: 'ny-jcope', stage: 'resolve', reason: 'unknown' })

    const s = summary()
    expect(s.grandTotal).toBe(4)
    expect(s.byAdapter.size).toBe(2)
    expect(s.byAdapter.get('mi-board')!.total).toBe(3)
    expect(s.byAdapter.get('mi-board')!.byStage.get('fetch')).toBe(2)
    expect(s.byAdapter.get('mi-board')!.byStage.get('parse')).toBe(1)
    expect(s.byAdapter.get('ny-jcope')!.total).toBe(1)
  })

  it('caps samples at MAX_SAMPLES_PER_ADAPTER (5)', () => {
    const { onSkip, summary } = createSkipCollector()
    for (let i = 0; i < 10; i += 1) {
      onSkip({ adapter: 'mi-board', stage: 'fetch', reason: `failure ${i}` })
    }
    const entry = summary().byAdapter.get('mi-board')!
    expect(entry.total).toBe(10)
    expect(entry.samples.length).toBe(5)
  })

  it('records grandTotal accurately', () => {
    const { onSkip, summary } = createSkipCollector()
    expect(summary().grandTotal).toBe(0)
    onSkip({ adapter: 'x', stage: 'fetch', reason: 'r' })
    expect(summary().grandTotal).toBe(1)
  })

  it('preserves legislator + detail in samples', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({
      adapter: 'mi-board',
      stage: 'fetch',
      legislator: 'Jane Doe',
      reason: '404',
      detail: 'https://example.com/jane.pdf',
    })
    const sample = summary().byAdapter.get('mi-board')!.samples[0]!
    expect(sample.legislator).toBe('Jane Doe')
    expect(sample.detail).toBe('https://example.com/jane.pdf')
  })
})

describe('formatSkipSummary', () => {
  it('returns "No skips recorded." for empty summary', () => {
    const s = createSkipCollector().summary()
    expect(formatSkipSummary(s)).toBe('No skips recorded.')
  })

  it('renders header with total + adapter counts', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'r' })
    onSkip({ adapter: 'ny-jcope', stage: 'resolve', reason: 'r' })
    const out = formatSkipSummary(summary())
    expect(out).toContain('Skip summary (2 skips across 2 adapters)')
  })

  it('sorts adapters by total skip count descending', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'low', stage: 'fetch', reason: 'r' })
    for (let i = 0; i < 5; i += 1) {
      onSkip({ adapter: 'high', stage: 'fetch', reason: 'r' })
    }
    const out = formatSkipSummary(summary())
    const highIdx = out.indexOf('[high]')
    const lowIdx = out.indexOf('[low]')
    expect(highIdx).toBeLessThan(lowIdx)
  })

  it('sorts stages within an adapter by count descending', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'parse', reason: 'r' })
    for (let i = 0; i < 3; i += 1) {
      onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'r' })
    }
    const out = formatSkipSummary(summary())
    const fetchIdx = out.indexOf('  fetch')
    const parseIdx = out.indexOf('  parse')
    expect(fetchIdx).toBeLessThan(parseIdx)
  })

  it('includes sample legislator + reason in stage line', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'fetch', legislator: 'Jane Doe', reason: '404 from URL' })
    const out = formatSkipSummary(summary())
    expect(out).toMatch(/Jane Doe/)
    expect(out).toMatch(/404 from URL/)
  })

  it('includes stage count', () => {
    const { onSkip, summary } = createSkipCollector()
    for (let i = 0; i < 7; i += 1) {
      onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'r' })
    }
    const out = formatSkipSummary(summary())
    expect(out).toMatch(/fetch\s+7/)
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run shared/instrumentation
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `instrumentation.ts`**

Create `packages/db/supabase/seed/shared/instrumentation.ts`:

```ts
/**
 * SkipReason — discriminated union capturing the moment an adapter
 * silently skips a record. Adapters call `opts.onSkip?.(reason)` at
 * each silent-continue site so an instrumentation run can attribute
 * skips to a stage + adapter + legislator.
 *
 * Slice 22 helper. Consumers: per-chamber district_offices parsers
 * (slice 18 fetchPerMemberOffices), MI PFD (slice 19), NY FDS line-
 * item fill (slice 20), TX TEC combined parser (slice 16 + 20).
 */
export interface SkipReason {
  /** Adapter slug, e.g. 'mi-board' or 'fl-doe'. */
  adapter: string
  /**
   * Which stage of the per-record flow failed:
   *   - 'derive_url'   — URL builder returned empty (e.g. single-name legislator)
   *   - 'fetch'        — HTTP failure: network, timeout, non-2xx response
   *   - 'extract'      — PDF/HTML text extraction returned empty
   *   - 'parse'        — text extracted but parser found no recognized items
   *   - 'resolve'      — legislator name didn't match officials table
   *   - 'filter'       — row didn't match LEGISLATOR_AGENCY_RE / chamber filter
   */
  stage: 'derive_url' | 'fetch' | 'extract' | 'parse' | 'resolve' | 'filter'
  /** Optional legislator full_name or order_number identifier for the skip. */
  legislator?: string
  /** One-line human-readable reason; goes in summary output. */
  reason: string
  /** Optional structured detail (e.g. URL, error message). For debug. */
  detail?: string
}

/**
 * SkipSummary — aggregated per-adapter rollup printed by formatSkipSummary
 * at the end of an --instrument run.
 */
export interface SkipSummary {
  byAdapter: Map<string, {
    byStage: Map<SkipReason['stage'], number>
    samples: SkipReason[]
    total: number
  }>
  grandTotal: number
}

/** Maximum sample skips retained per adapter (memory bound for stdout output). */
const MAX_SAMPLES_PER_ADAPTER = 5

/**
 * createSkipCollector — returns an `onSkip` callback to pass to adapter
 * opts + a `summary()` method to retrieve aggregated stats at the end
 * of an --instrument run.
 *
 * Usage:
 *   const { onSkip, summary } = createSkipCollector()
 *   await adapter.fetchEvents({ client, onSkip })
 *   console.log(formatSkipSummary(summary()))
 */
export function createSkipCollector(): {
  onSkip: (reason: SkipReason) => void
  summary: () => SkipSummary
} {
  const byAdapter = new Map<string, {
    byStage: Map<SkipReason['stage'], number>
    samples: SkipReason[]
    total: number
  }>()
  let grandTotal = 0

  return {
    onSkip(reason) {
      grandTotal += 1
      let entry = byAdapter.get(reason.adapter)
      if (!entry) {
        entry = { byStage: new Map(), samples: [], total: 0 }
        byAdapter.set(reason.adapter, entry)
      }
      entry.total += 1
      entry.byStage.set(reason.stage, (entry.byStage.get(reason.stage) ?? 0) + 1)
      if (entry.samples.length < MAX_SAMPLES_PER_ADAPTER) {
        entry.samples.push(reason)
      }
    },
    summary() {
      return { byAdapter, grandTotal }
    },
  }
}

/**
 * formatSkipSummary — render a SkipSummary to a human-readable
 * multi-line string for CLI/stdout output during an --instrument run.
 */
export function formatSkipSummary(s: SkipSummary): string {
  if (s.grandTotal === 0) return 'No skips recorded.'
  const lines: string[] = []
  lines.push(`Skip summary (${s.grandTotal} skips across ${s.byAdapter.size} adapters)`)
  lines.push('─'.repeat(40))

  const sortedAdapters = Array.from(s.byAdapter.entries())
    .sort(([, a], [, b]) => b.total - a.total)

  for (const [adapter, entry] of sortedAdapters) {
    lines.push(`[${adapter}]    ${entry.total} skips`)
    const sortedStages = Array.from(entry.byStage.entries())
      .sort(([, a], [, b]) => b - a)
    for (const [stage, count] of sortedStages) {
      const sample = entry.samples.find(s => s.stage === stage)
      const sampleStr = sample
        ? `(e.g. ${sample.legislator ? `${sample.legislator}: ` : ''}${sample.reason})`
        : ''
      lines.push(`  ${stage.padEnd(11)} ${String(count).padStart(3)}  ${sampleStr}`)
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run helper test to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run shared/instrumentation
```
Expected: 10 tests PASS.

- [ ] **Step 5: Widen `StateCommunityAdapter` opts interface**

Modify `packages/db/supabase/seed/state-community/shared.ts`:

Add import at top:
```diff
 import type { Client } from 'pg'
+import type { SkipReason } from '../shared/instrumentation.ts'
```

Add `onSkip` field to the adapter `fetchEvents` opts:

```diff
 export interface StateCommunityAdapter<E extends StateCommunityEvent = StateCommunityEvent> {
   slug: string
   component: CommunityComponent
   covered_states: string[]
   fetchEvents(opts: {
     client: Client
     state?: string
     session?: string
     fetcher?: () => Promise<E[]>
+    /**
+     * Optional skip-reason collector (slice 22). When passed, the
+     * adapter calls onSkip() at each silent-continue site with a
+     * SkipReason record. Used by orchestrator --instrument runs.
+     */
+    onSkip?: (reason: SkipReason) => void
   }): Promise<E[]>
 }
```

- [ ] **Step 6: Widen `StateEthicsAdapter` opts interface**

Mirror change in `packages/db/supabase/seed/state-ethics/shared.ts`:

```diff
 import type { Client } from 'pg'
+import type { SkipReason } from '../shared/instrumentation.ts'
```

```diff
 export interface StateEthicsAdapter<E extends StateEthicsEvent = StateEthicsEvent> {
   slug: string
   component: EthicsComponent
   covered_states: string[]
   fetchEvents(opts: {
     client: Client
     state?: string
     fetcher?: () => Promise<E[]>
+    onSkip?: (reason: SkipReason) => void
   }): Promise<E[]>
 }
```

- [ ] **Step 7: Composite typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS (interface change is purely additive; all adapter implementations remain valid because `onSkip` is optional).

- [ ] **Step 8: Run FULL @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 716 + 10 = ~726 tests PASS. Interface widening doesn't change runtime behavior; existing tests pass unchanged.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/db/supabase/seed/shared/instrumentation.ts \
        packages/db/supabase/seed/shared/instrumentation.test.ts \
        packages/db/supabase/seed/state-community/shared.ts \
        packages/db/supabase/seed/state-ethics/shared.ts
git commit -m "$(cat <<'EOF'
feat(seed): instrumentation framework — SkipReason + createSkipCollector

Add adapter-level skip-reason telemetry helpers + widen
StateCommunityAdapter + StateEthicsAdapter interfaces with optional
opts.onSkip callback.

- seed/shared/instrumentation.ts: SkipReason discriminated union
  (6 stages: derive_url / fetch / extract / parse / resolve / filter);
  createSkipCollector returns {onSkip, summary}; formatSkipSummary
  renders human-readable CLI output with per-adapter rollup +
  sample legislator + reason. Memory-bound via
  MAX_SAMPLES_PER_ADAPTER=5.
- StateCommunityAdapter<E>.fetchEvents opts gains onSkip? field
  (slice 18 generic interface kept; this is additive).
- StateEthicsAdapter<E>.fetchEvents opts gains onSkip? field.
- 10 vitest cases for createSkipCollector + formatSkipSummary.

No adapter implementation changes in this task — interface widening
only. Tasks 2-3 instrument the concrete adapters.

Slice 22 ships TOOLING; production run is operator follow-up.

Per spec: docs/superpowers/specs/2026-05-25-production-instrumentation-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `fetchPerMemberOffices` onSkip + per-chamber adapter propagation

**Files:**
- Modify: `state-community/district-offices/_shared.ts` (fetchPerMemberOffices gains onSkip + adapter)
- Modify: `state-community/district-offices/_shared.test.ts` (~8 new tests)
- Modify: 6 per-chamber adapter files (`ca-leginfo/{senate,assembly}.ts`, `mi-legislature/{senate,house}.ts`, `fl-doe/{senate,house}.ts`, `ny-senate/{assembly,senate}.ts` if applicable) — pass adapter slug + propagate onSkip
- Modify: 4 index.ts files (`ca-leginfo`, `mi-legislature`, `fl-doe`, `ny-senate`) — propagate onSkip from adapter-level opts to sub-fetchers

- [ ] **Step 1: Read current `_shared.ts` `fetchPerMemberOffices`**

```bash
sed -n '30,100p' packages/db/supabase/seed/state-community/district-offices/_shared.ts
```

Confirm `PerMemberOfficesOpts` shape + per-iteration silent-skip sites (deriveUrl null, fetch reject, parseDetailHtml empty, emitOfficeRow null).

- [ ] **Step 2: Extend `PerMemberOfficesOpts` interface**

In `_shared.ts`:
```diff
 import type { Client } from 'pg'
 import type { NormalizedDistrictOffice } from '../shared.ts'
+import type { SkipReason } from '../../shared/instrumentation.ts'

 // ... existing parseAddressText + constants ...

 export interface PerMemberOfficesOpts {
   chamber: 'state_house' | 'state_senate'
   state: string
+  /** Adapter slug for skip-reason attribution. NEW per slice 22. */
+  adapter: string
   deriveUrl: (legislator: {
     full_name: string
     district_id: string | null
     openstates_person_id: string
   }) => string | null
   parseDetailHtml: (html: string) => ParsedMemberDetail
   fetcher?: (url: string) => Promise<string>
+  /** Optional skip-reason collector. NEW per slice 22. */
+  onSkip?: (reason: SkipReason) => void
 }
```

- [ ] **Step 3: Instrument silent-skip sites in `fetchPerMemberOffices`**

In `_shared.ts` `fetchPerMemberOffices` body, add `opts.onSkip?.(...)` calls at each silent-continue site:

```ts
for (let i = 0; i < totalRows; i += 1) {
  const legislator = rows[i]!
  const url = opts.deriveUrl(legislator)
  if (!url) {
    opts.onSkip?.({
      adapter: opts.adapter,
      stage: 'derive_url',
      legislator: legislator.full_name,
      reason: 'deriveUrl returned null (e.g. missing district_id or unparseable name)',
    })
    continue
  }

  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher(url)
      : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch (e) {
    opts.onSkip?.({
      adapter: opts.adapter,
      stage: 'fetch',
      legislator: legislator.full_name,
      reason: 'fetch threw',
      detail: e instanceof Error ? e.message : String(e),
    })
    continue
  }

  const parsed = opts.parseDetailHtml(html)
  const hadCapitol = Boolean(parsed.capitol_office)
  const hadDistrict = Boolean(parsed.district_office)
  if (!hadCapitol && !hadDistrict) {
    opts.onSkip?.({
      adapter: opts.adapter,
      stage: 'parse',
      legislator: legislator.full_name,
      reason: 'parseDetailHtml returned no addresses',
    })
    // No continue — still passes through to emitOfficeRow which yields 0 rows
  }

  if (parsed.capitol_office) {
    const row = emitOfficeRow(parsed.capitol_office, {
      openstates_person_id: legislator.openstates_person_id,
      kind: 'capitol',
      source_url: url,
    })
    if (row) {
      out.push(row)
    } else {
      opts.onSkip?.({
        adapter: opts.adapter,
        stage: 'parse',
        legislator: legislator.full_name,
        reason: 'parseAddressText returned null for capitol office',
      })
    }
  }
  if (parsed.district_office) {
    const row = emitOfficeRow(parsed.district_office, {
      openstates_person_id: legislator.openstates_person_id,
      kind: 'district',
      source_url: url,
    })
    if (row) {
      out.push(row)
    } else {
      opts.onSkip?.({
        adapter: opts.adapter,
        stage: 'parse',
        legislator: legislator.full_name,
        reason: 'parseAddressText returned null for district office',
      })
    }
  }

  if (!opts.fetcher && i < totalRows - 1) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
  }
}
```

- [ ] **Step 4: Update 6 per-chamber parser files**

Each per-chamber file (`ca-leginfo/{senate,assembly}.ts`, `mi-legislature/{senate,house}.ts`, `fl-doe/{senate,house}.ts`, `ny-senate/{assembly,senate}.ts`) passes `adapter:` slug + propagates `opts.onSkip`:

**Example for `mi-legislature/senate.ts`:**
```diff
 export async function fetchMiSenateOffices(
   client: Pick<Client, 'query'>,
-  opts: { fetcher?: (url: string) => Promise<string> },
+  opts: {
+    fetcher?: (url: string) => Promise<string>
+    onSkip?: (reason: SkipReason) => void
+  },
 ): Promise<NormalizedDistrictOffice[]> {
   return fetchPerMemberOffices(client, {
     chamber: 'state_senate',
     state: 'MI',
+    adapter: 'mi-legislature',
     deriveUrl: (l) => deriveMiSenatorUrl(l.full_name),
     parseDetailHtml: parseMiSenatorProfileHtml,
     ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
+    ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
   })
 }
```

Also add the import:
```ts
import type { SkipReason } from '../../../shared/instrumentation.ts'
```

Per-chamber slug map:
- `ca-leginfo/senate.ts` → `adapter: 'ca-leginfo'`
- `ca-leginfo/assembly.ts` → `adapter: 'ca-leginfo'`
- `mi-legislature/senate.ts` → `adapter: 'mi-legislature'`
- `mi-legislature/house.ts` → `adapter: 'mi-legislature'`
- `fl-doe/senate.ts` → `adapter: 'fl-doe'`
- `fl-doe/house.ts` → `adapter: 'fl-doe'`
- `ny-senate/senate.ts` → `adapter: 'ny-senate'`
- `ny-senate/assembly.ts` → `adapter: 'ny-senate'` (if collapsed via fetchPerMemberOffices; verify)

- [ ] **Step 5: Update 4 index.ts dispatchers**

Each subfolder `index.ts` (`ca-leginfo/index.ts`, `mi-legislature/index.ts`, `fl-doe/index.ts`, `ny-senate/index.ts`) propagates `opts.onSkip` to its sub-fetchers.

**Example for `mi-legislature/index.ts`:**
```diff
 export const miLegislatureOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
   slug: 'mi-legislature',
   component: 'offices',
   covered_states: ['MI'],
   async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
     if (opts.fetcher) return opts.fetcher()

+    const subOpts = opts.onSkip ? { onSkip: opts.onSkip } : {}
     const [senate, house] = await Promise.all([
-      fetchMiSenateOffices(opts.client, {}),
-      fetchMiHouseOffices(opts.client, {}),
+      fetchMiSenateOffices(opts.client, subOpts),
+      fetchMiHouseOffices(opts.client, subOpts),
     ])
     return [...senate, ...house]
   },
 }
```

- [ ] **Step 6: Add `_shared.test.ts` onSkip tests**

Append to existing `_shared.test.ts`:

```ts
describe('fetchPerMemberOffices onSkip instrumentation', () => {
  it('calls onSkip with derive_url stage when deriveUrl returns null', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          openstates_person_id: 'ocd-1',
          full_name: 'Single Token',
          district_id: null,
        }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'TX',
      adapter: 'test-slug',
      deriveUrl: (l) => l.district_id ? `https://x/${l.full_name}` : null,
      parseDetailHtml: () => ({}),
      fetcher: async () => '',
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'test-slug',
      stage: 'derive_url',
      legislator: 'Single Token',
    })
  })

  it('calls onSkip with fetch stage when fetcher rejects', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'CA-1' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'test-slug',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => ({}),
      fetcher: async () => { throw new Error('network') },
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'test-slug',
      stage: 'fetch',
      legislator: 'Jane Doe',
    })
    expect(skips[0]!.detail).toMatch(/network/)
  })

  it('calls onSkip with parse stage when parseDetailHtml returns no addresses', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'CA-1' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'test-slug',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => ({}),  // returns no addresses
      fetcher: async () => 'fixture',
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips.length).toBeGreaterThanOrEqual(1)
    expect(skips.find(s => s.stage === 'parse')).toBeDefined()
  })

  it('calls onSkip with parse stage when emitOfficeRow returns null', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'CA-1' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'test-slug',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => ({ capitol_office: 'garbage no commas' }),
      fetcher: async () => 'fixture',
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'test-slug',
      stage: 'parse',
      legislator: 'Jane Doe',
    })
    expect(skips[0]!.reason).toMatch(/capitol/)
  })

  it('does NOT call onSkip when row emits successfully', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'CA-1' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'test-slug',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => ({ capitol_office: '123 Main St, Sacramento, CA 95814' }),
      fetcher: async () => 'fixture',
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips).toEqual([])
  })

  it('aggregates multiple skip reasons across legislators', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Single', district_id: null },
          { openstates_person_id: 'ocd-2', full_name: 'Jane Doe', district_id: 'CA-2' },
        ],
        rowCount: 2,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'test-slug',
      deriveUrl: (l) => l.district_id ? `https://x/${l.full_name}` : null,
      parseDetailHtml: () => ({}),  // empty addresses → parse skip for the 1 reachable AM
      fetcher: async () => '',
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips.length).toBeGreaterThanOrEqual(2)
    expect(skips.find(s => s.stage === 'derive_url')).toBeDefined()
    expect(skips.find(s => s.stage === 'parse')).toBeDefined()
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Single', district_id: null }],
        rowCount: 1,
      }),
    }
    const result = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'test-slug',
      deriveUrl: (l) => l.district_id ? `https://x/${l.full_name}` : null,
      parseDetailHtml: () => ({}),
      fetcher: async () => '',
    })
    expect(result).toEqual([])  // no rows emitted; no throw despite no onSkip
  })

  it('attaches adapter slug to all skip reasons', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'CA-1' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'CA',
      adapter: 'mi-legislature',  // intentionally wrong-state-for-adapter; just verifying attribution
      deriveUrl: () => null,
      parseDetailHtml: () => ({}),
      fetcher: async () => '',
      onSkip: (r) => { skips.push(r) },
    })
    expect(skips.every(s => s.adapter === 'mi-legislature')).toBe(true)
  })
})
```

- [ ] **Step 7: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/_shared
pnpm --filter @chiaro/db typecheck
```
Expected: ALL `_shared.test.ts` tests PASS (existing 14 + 8 new = 22). Typecheck PASS.

- [ ] **Step 8: Run FULL @chiaro/db test suite to verify no regression in adapter tests**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~734 tests PASS (726 from Task 1 + 8 new helper tests). Existing per-chamber adapter tests unchanged.

- [ ] **Step 9: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-community/district-offices
git commit -m "$(cat <<'EOF'
feat(seed): fetchPerMemberOffices + per-chamber adapters honor onSkip

Slice 22: instrument silent-skip sites in the shared
fetchPerMemberOffices helper + propagate the onSkip callback from
per-chamber adapter opts through Promise.all dispatch.

- _shared.ts: PerMemberOfficesOpts gains adapter: string + onSkip?
  fields. 4 silent-skip stages instrumented: derive_url, fetch,
  parse (capitol), parse (district). Plus parse on empty
  parseDetailHtml.
- 6 per-chamber parsers (ca-leginfo/{senate,assembly},
  mi-legislature/{senate,house}, fl-doe/{senate,house},
  ny-senate/{assembly,senate}) pass their adapter slug + propagate
  opts.onSkip through to fetchPerMemberOffices.
- 4 subfolder index.ts dispatchers propagate opts.onSkip to
  Promise.all sub-fetchers.
- 8 new vitest cases assert onSkip fires correctly at each stage +
  preserves silent-skip behavior when omitted (back-compat).

No production behavior change. Operator can now wire a skip
collector via opts.onSkip during --instrument runs (slice 22 Task 4).

Per spec: docs/superpowers/specs/2026-05-25-production-instrumentation-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `onSkip` in PDF parsers (MI PFD + NY FDS + TX TEC)

**Files:**
- Modify: `state-ethics/disclosures/mi-board.ts` + `.test.ts`
- Modify: `state-ethics/disclosures/ny-jcope.ts` + `.test.ts`
- Modify: `state-ethics/tx-tec/shared.ts` + `.test.ts`
- Modify: `state-ethics/complaints/tx-tec.ts` + `events/tx-tec.ts` (thin propagation)

For each adapter:
- Gain `opts.onSkip?` via the slice 18 generic `StateEthicsAdapter<E>` interface (already widened in Task 1)
- Instrument each silent-skip site with `opts.onSkip?.(...)` call

- [ ] **Step 1: Instrument `mi-board.ts`**

Modify `state-ethics/disclosures/mi-board.ts`. Add import:
```ts
import type { SkipReason } from '../../shared/instrumentation.ts'
```

In the per-legislator loop, instrument each silent-skip:
```ts
for (let i = 0; i < totalRows; i += 1) {
  const legislator = rows[i]!
  const url = deriveMiPfdUrl({ full_name: legislator.full_name }, year)
  if (!url) {
    opts.onSkip?.({
      adapter: 'mi-board',
      stage: 'derive_url',
      legislator: legislator.full_name,
      reason: 'deriveMiPfdUrl returned empty (single-name legislator)',
    })
    continue
  }

  let buffer: Buffer
  try {
    buffer = await fetchPdf(url)
  } catch (e) {
    opts.onSkip?.({
      adapter: 'mi-board',
      stage: 'fetch',
      legislator: legislator.full_name,
      reason: 'fetchPdf threw',
      detail: e instanceof Error ? e.message : String(e),
    })
    continue
  }

  const text = await extractPdfText(buffer)
  if (!text) {
    opts.onSkip?.({
      adapter: 'mi-board',
      stage: 'extract',
      legislator: legislator.full_name,
      reason: 'extractPdfText returned empty',
    })
    continue
  }

  const lineItems = parseMiPfdText(text)
  if (lineItems.length === 0) {
    opts.onSkip?.({
      adapter: 'mi-board',
      stage: 'parse',
      legislator: legislator.full_name,
      reason: 'parseMiPfdText returned no items',
    })
    continue
  }

  // ... existing line-item emission ...
}
```

Add 3 vitest cases to `mi-board.test.ts` (one per stage of skip: derive_url, fetch, parse). Existing tests pass unchanged.

- [ ] **Step 2: Instrument `ny-jcope.ts`**

Modify `state-ethics/disclosures/ny-jcope.ts`. Two pass instrumentation:

**First pass (placeholder emission):**
```ts
for (const row of parsedRows) {
  const chamber = inferChamberFromOfficeText(row.office_text)
  if (!chamber) {
    opts.onSkip?.({
      adapter: 'ny-jcope',
      stage: 'filter',
      legislator: row.full_name,
      reason: `office text "${row.office_text}" did not match Assembly/Senate`,
    })
    continue
  }

  const openstates_person_id = await resolveOpenstatesPersonId(client, {
    full_name: row.full_name,
    state: 'NY',
    chamber,
  })
  if (!openstates_person_id) {
    opts.onSkip?.({
      adapter: 'ny-jcope',
      stage: 'resolve',
      legislator: row.full_name,
      reason: 'unmatched in officials table',
    })
    continue
  }
  // ... placeholder emission ...
}
```

**Second pass (PDF line-item fill):**
```ts
for (let i = 0; i < pdfBudget; i += 1) {
  const { row, openstates_person_id } = resolvedFilings[i]!

  let buffer: Buffer
  try {
    buffer = await fetchPdf(row.source_url)
  } catch (e) {
    opts.onSkip?.({
      adapter: 'ny-jcope',
      stage: 'fetch',
      legislator: row.full_name,
      reason: 'fetchPdf threw (per-filing PDF)',
      detail: e instanceof Error ? e.message : String(e),
    })
    continue
  }

  const text = await extractPdfText(buffer)
  if (!text) {
    opts.onSkip?.({
      adapter: 'ny-jcope',
      stage: 'extract',
      legislator: row.full_name,
      reason: 'extractPdfText returned empty (per-filing PDF)',
    })
    continue
  }

  const lineItems = parseNyFdsText(text)
  if (lineItems.length === 0) {
    opts.onSkip?.({
      adapter: 'ny-jcope',
      stage: 'parse',
      legislator: row.full_name,
      reason: 'parseNyFdsText returned 0 line items',
    })
    continue
  }
  // ... line-item emission ...
}
```

Add 4 vitest cases to `ny-jcope.test.ts` (filter, resolve, fetch, parse stages).

- [ ] **Step 3: Instrument `tx-tec/shared.ts` (dual-write with existing errors[])**

Modify `state-ethics/tx-tec/shared.ts`. Update `fetchSwornComplaintOrders` signature:
```diff
 export async function fetchSwornComplaintOrders(
   client: Pick<Client, 'query'>,
   opts: {
     fetcher?: (url: string) => Promise<string>
     maxPdfsPerRun?: number
+    onSkip?: (reason: SkipReason) => void
   },
 ): Promise<TxTecOrdersResult> {
```

Add import:
```ts
import type { SkipReason } from '../../shared/instrumentation.ts'
```

Instrument silent-skip sites. Critically: TX TEC has an existing `errors[]` array for unresolved legislators — **dual-write `errors.push` + `opts.onSkip`** to preserve back-compat:

```ts
for (const row of parsedRows) {
  if (!isTexasLegislatorRow(row)) {
    opts.onSkip?.({
      adapter: 'tx-tec',
      stage: 'filter',
      legislator: row.respondent,
      reason: `agency "${row.agency}" not a TX state legislator`,
    })
    continue
  }

  const chamber: 'state_house' | 'state_senate' =
    /House/i.test(row.agency) ? 'state_house' : 'state_senate'

  const openstates_person_id = await resolveOpenstatesPersonId(client, {
    full_name: row.respondent,
    state: 'TX',
    chamber,
  })
  if (!openstates_person_id) {
    // DUAL-WRITE: existing errors[] consumers stay; new onSkip channel
    errors.push(`unresolved: ${row.respondent} (${chamber})`)
    opts.onSkip?.({
      adapter: 'tx-tec',
      stage: 'resolve',
      legislator: row.respondent,
      reason: `unmatched in officials (${chamber})`,
    })
    continue
  }
  // ... emit + collect for rowsToEnrich ...
}

// Second pass (PDF enrichment):
for (let i = 0; i < pdfBudget; i += 1) {
  const enrich = rowsToEnrich[i]!

  let buffer: Buffer
  try {
    buffer = await fetchPdf(enrich.source_pdf_url)
  } catch (e) {
    opts.onSkip?.({
      adapter: 'tx-tec',
      stage: 'fetch',
      legislator: complaints[enrich.complaintIdx]?.summary,
      reason: 'fetchPdf threw (per-case order PDF)',
      detail: e instanceof Error ? e.message : String(e),
    })
    continue
  }

  const text = await extractPdfText(buffer)
  if (!text) {
    opts.onSkip?.({
      adapter: 'tx-tec',
      stage: 'extract',
      reason: 'extractPdfText returned empty (per-case PDF)',
    })
    continue
  }
  // ... enrichment (no skip — even partial parse is success) ...
}
```

- [ ] **Step 4: Propagate `onSkip` through `tx-tec` adapter wrappers**

`state-ethics/complaints/tx-tec.ts`:
```diff
 export const txTecComplaints: StateEthicsAdapter<NormalizedEthicsComplaint> = {
   slug: 'tx-tec',
   component: 'complaints',
   covered_states: ['TX'],
   async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
     if (opts.fetcher) return opts.fetcher()
-    const { complaints } = await fetchSwornComplaintOrders(opts.client, {})
+    const { complaints } = await fetchSwornComplaintOrders(opts.client, {
+      ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
+    })
     return complaints
   },
 }
```

Mirror change in `state-ethics/events/tx-tec.ts`.

- [ ] **Step 5: Add ~10 vitest cases across 3 PDF parsers**

Add tests asserting onSkip fires correctly. Each adapter's test file gains a new `describe('xxx slice 22 onSkip instrumentation')` block with cases for each stage.

- [ ] **Step 6: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics
pnpm --filter @chiaro/db typecheck
```
Expected: state-ethics tests PASS. Typecheck PASS.

- [ ] **Step 7: Run FULL @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~744 tests PASS (734 from Task 2 + ~10 new).

- [ ] **Step 8: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-ethics
git commit -m "$(cat <<'EOF'
feat(state-ethics): MI PFD + NY FDS + TX TEC honor onSkip

Slice 22: instrument silent-skip sites in 3 PDF-aware ethics
adapters.

- mi-board.ts (slice 19): derive_url / fetch / extract / parse
  stages. 3 new vitest cases.
- ny-jcope.ts (slice 17+20): two-pass instrumentation. First pass
  emits filter (chamber-inference null) + resolve (unmatched
  legislator) skips. Second pass emits fetch / extract / parse
  per-filing PDF skips. 4 new vitest cases.
- tx-tec/shared.ts (slice 16+20): filter (non-legislator agency) +
  resolve + fetch + extract stages. DUAL-WRITE pattern: existing
  errors[] array stays (back-compat for slice 16/20 callers); new
  onSkip channel called in addition. 3 new vitest cases.
- tx-tec complaints + events adapter wrappers propagate opts.onSkip
  through to fetchSwornComplaintOrders.

All instrumentation is opt-in via the slice 22 onSkip callback;
when omitted, behavior is identical to slice 21 baseline.

Per spec: docs/superpowers/specs/2026-05-25-production-instrumentation-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `--instrument` CLI flag on orchestrators + docs + closure

**Files:**
- Modify: `state-community-ingest.ts` (add `--instrument` + `--no-apply` CLI handling)
- Modify: `state-ethics-ingest.ts` (mirror)
- Create: `docs/superpowers/instrumentation-guide.md`
- Modify: `CLAUDE.md` (slice 22 entry)
- Create (outside repo): memory file
- Modify (outside repo): MEMORY.md index

- [ ] **Step 1: Add `--instrument` + `--no-apply` to `state-ethics-ingest.ts`**

Extend `IngestStateEthicsOpts`:
```diff
 export interface IngestStateEthicsOpts {
   component?: EthicsComponent | 'all'
   state?: string
   skipOnError?: boolean
   adapters?: StateEthicsAdapter[]
   client?: Client
+  /** When true, collect skip reasons via shared collector + print summary at end. */
+  instrument?: boolean
+  /** When true, skip the UPSERT loop (dry-run). Useful with instrument=true. */
+  noApply?: boolean
 }

 export interface IngestStateEthicsStats {
   adaptersAttempted: number
   adaptersOk: number
   totalRowsUpserted: number
   totalOfficialsUnmatched: number
   byAdapter: StateEthicsStats[]
+  /** Populated when opts.instrument === true. Aggregated skip telemetry. */
+  skipSummary?: SkipSummary
 }
```

Add imports + wire collector:
```diff
+import { createSkipCollector, formatSkipSummary, type SkipSummary }
+  from './shared/instrumentation.ts'

 export async function ingestStateEthics(opts: IngestStateEthicsOpts): Promise<IngestStateEthicsStats> {
   // ... existing filter logic ...

   const client = opts.client ?? new Client({ connectionString: DB_URL })
   // ...

+  const collector = opts.instrument ? createSkipCollector() : null
+  const onSkip = collector?.onSkip

   const byAdapter: StateEthicsStats[] = []
   try {
     for (const adapter of adapters) {
       const adapterStats: StateEthicsStats = { /* ... */ }
       try {
-        const events = await adapter.fetchEvents({ client, ...(opts.state !== undefined ? { state: opts.state } : {}) })
+        const events = await adapter.fetchEvents({
+          client,
+          ...(opts.state !== undefined ? { state: opts.state } : {}),
+          ...(onSkip ? { onSkip } : {}),
+        })
         for (const event of events) {
+          if (opts.noApply) {
+            adapterStats.rowsUpserted += 1  // count as "would-upsert" but don't write
+            continue
+          }
           // ... existing UPSERT logic ...
         }
       }
     }
   }

   return {
     // ... existing fields ...
+    ...(collector ? { skipSummary: collector.summary() } : {}),
   }
 }
```

Extend CLI argv parsing:
```diff
 if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
   const componentArg = process.argv.find(a => a.startsWith('--component='))
   const stateArg     = process.argv.find(a => a.startsWith('--state='))
   const skipOnError  = process.argv.includes('--skip-on-error')
+  const instrument   = process.argv.includes('--instrument')
+  const noApply      = process.argv.includes('--no-apply')

   // ...

   ingestStateEthics({
     component, ...(state !== undefined ? { state } : {}),
-    skipOnError,
+    skipOnError, instrument, noApply,
   })
     .then(stats => {
       console.log(`State ethics ingest summary:`)
       // ... existing summary ...
+      if (stats.skipSummary) {
+        console.log('')
+        console.log(formatSkipSummary(stats.skipSummary))
+      }
       process.exit(stats.adaptersOk === stats.adaptersAttempted ? 0 : 1)
     })
 }
```

- [ ] **Step 2: Mirror changes in `state-community-ingest.ts`**

Same pattern — add `instrument?` + `noApply?` to IngestOpts + wire collector + CLI argv handling.

- [ ] **Step 3: Write `docs/superpowers/instrumentation-guide.md`**

Operator-facing doc covering:
- How to run `pnpm seed:state-ethics --instrument --no-apply`
- How to interpret the skip summary (per-adapter rollup, stage counts, sample legislator)
- How to debug specific high-skip adapters (drill into samples; consider raising MAX_SAMPLES_PER_ADAPTER for verbose runs)
- Recommended cadence: run after each parser slice ships + before each production deploy
- Example output snippet showing realistic MI PFD / NY FDS / TX TEC skip distributions
- Action thresholds: when to add a retry helper, when to iterate parser regex, when to deprecate

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm --filter @chiaro/web build
```
Expected: all green.

- [ ] **Step 5: Append slice 22 entry to CLAUDE.md**

After slice 21 entry, add slice 22 entry summarizing the framework.

- [ ] **Step 6: Write memory file + MEMORY.md index**

Standard slice closure pattern.

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-community-ingest.ts \
        packages/db/supabase/seed/state-ethics-ingest.ts \
        docs/superpowers/instrumentation-guide.md \
        CLAUDE.md
git commit -m "$(cat <<'EOF'
feat(seed): --instrument CLI flag + instrumentation-guide.md

Slice 22 closure. Both orchestrators (state-community-ingest.ts +
state-ethics-ingest.ts) gain --instrument + --no-apply CLI flags
wiring the shared createSkipCollector.

CLI modes:
- Default: rows committed; no telemetry
- --instrument: rows committed AND skip summary printed at end
- --instrument --no-apply: dry-run (no DB writes) + skip summary

Programmatic callers can pass opts.instrument: true + receive
stats.skipSummary in the return value.

docs/superpowers/instrumentation-guide.md documents operator usage,
output interpretation, and action thresholds (when to add retry,
iterate regex, or deprecate).

CLAUDE.md slice 22 entry. Closes 5 audit "blocked by production"
follow-ups (MI House TLS-flake rate, FL House MemberId, NY FDS
pagination, slug-derivation drift, real-PDF regex iteration) by
providing the tooling. Production run itself is operator follow-up.

Per spec: docs/superpowers/specs/2026-05-25-production-instrumentation-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Workspace verify gate (recap)

After all 4 tasks complete:

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run                         # ~744 tests green
pnpm --filter @chiaro/officials-ui exec vitest run               # 256 tests green (unchanged)
pnpm --filter @chiaro/web build                                  # 12 routes
git log master..HEAD --oneline                                   # 6 commits (spec + plan + 4 implementation)
```

---

## Self-review notes

### Spec coverage

- ✅ SkipReason discriminated union — Task 1
- ✅ createSkipCollector + formatSkipSummary — Task 1
- ✅ Generic adapter interface widening (StateCommunityAdapter + StateEthicsAdapter onSkip?) — Task 1
- ✅ fetchPerMemberOffices onSkip + 4 instrumented stages — Task 2
- ✅ 6 per-chamber adapter onSkip propagation — Task 2
- ✅ 4 subfolder index.ts dispatchers — Task 2
- ✅ MI PFD onSkip — Task 3
- ✅ NY FDS two-pass onSkip — Task 3
- ✅ TX TEC dual-write (errors[] + onSkip) — Task 3
- ✅ --instrument + --no-apply CLI on both orchestrators — Task 4
- ✅ instrumentation-guide.md — Task 4
- ✅ Closure docs + memory — Task 4

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. Each task contains full file content or precise diff blocks. ~28-30 new vitest cases distributed across tasks.

### Type consistency

- `SkipReason` import path: `'../shared/instrumentation.ts'` from state-community/shared.ts + state-ethics/shared.ts (1 level up)
- `SkipReason` import path: `'../../shared/instrumentation.ts'` from per-state adapters (2 levels up)
- `SkipReason` import path: `'../../../shared/instrumentation.ts'` from subfolder adapters (3 levels up)
- All adapter slugs match their `slug:` field in the StateXxxAdapter declaration
- `onSkip` is OPTIONAL throughout (`onSkip?`); back-compat preserved

### Known incomplete details

- Town-halls + mobilize + scorecards adapters NOT instrumented in this slice (deliberate per spec). Slice 23+ adds if needed.
- TX TEC `errors[]` array stays in the return shape; future slice migrates consumers.
- CLI argv parsing remains hand-rolled (no commander); 2 boolean flags added. If 3+ flags accumulate, migrate to a lib in a future slice.
- Test count estimate ±2 per task due to vitest grouping; implementer reports actual.
- `instrumentation-guide.md` example output is illustrative; real distributions surface only during actual production runs (out of scope here).
- Memory `<squash SHA>` placeholder filled post-merge per slice 14-21 precedent.
