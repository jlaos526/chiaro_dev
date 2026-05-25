# Slice 22 — Production-run instrumentation framework design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Slices 15-21 adapters (16 production parsers); slice 18 audit's 5 "blocked by production" follow-ups.

## Goal

Add adapter-level skip-reason telemetry + orchestrator-level `--instrument` CLI flag so operator can run production ingest passes that capture diagnostic data (which adapter failed where + why) without changing default behavior. Closes 5 audit follow-ups in one tooling slice:

- MI House TLS-flake rate (slice 16+17 carryover)
- FL House MemberId-as-district verification (slice 17)
- NY FDS pagination selector verification (slice 17)
- Per-senator slug-derivation drift monitoring (slice 15+16)
- NY FDS + TX TEC + MI PFD real-PDF regex iteration (slice 19+20)

This slice ships the **tooling**; the production run itself is operator follow-up. No real-network access required for implementation.

## Non-goals

- **No real production ingest run.** Operator schedules + executes after this slice merges.
- **No telemetry pipeline to external observability tool.** Stdout output only; future slice could add OpenTelemetry / structured-log shipping.
- **No retry-on-failure logic.** Skip telemetry observes, doesn't auto-remediate. If MI House TLS-flake rate >50%, separate slice adds retry helper based on the captured data.
- **No DB schema changes.** Stats are ephemeral per-run; not persisted.
- **No new workspace deps.** Pure TypeScript + existing seed helpers.
- **No instrumentation for legacy `errors[]`-array adapters (TX TEC).** Dual-write `onSkip` + `errors.push` for back-compat; future slice migrates errors[] consumers.
- **No instrumentation for low-stakes adapters in this slice.** Town-halls + mobilize + scorecards adapters keep silent-skip; slice 23+ adds hooks if production runs surface drift there.

## Architecture

```
seed/shared/
  instrumentation.ts                                       NEW (Task 1)
    - type SkipReason
    - type SkipSummary
    - createSkipCollector() helper
    - formatSkipSummary() CLI formatter
  instrumentation.test.ts                                  NEW (Task 1)

state-community/district-offices/
  _shared.ts                                               MODIFY (Task 2)
    - fetchPerMemberOffices opts gains onSkip?
    - emits skip-reasons at 4 stages: derive_url, fetch, parse, resolve
  _shared.test.ts                                          MODIFY (Task 2)

state-ethics/disclosures/
  mi-board.ts                                              MODIFY (Task 3)
  mi-board.test.ts                                         MODIFY (Task 3)
  ny-jcope.ts                                              MODIFY (Task 3)
  ny-jcope.test.ts                                         MODIFY (Task 3)
state-ethics/tx-tec/
  shared.ts                                                MODIFY (Task 3)
  shared.test.ts                                           MODIFY (Task 3)

state-community-ingest.ts                                  MODIFY (Task 4)
state-ethics-ingest.ts                                     MODIFY (Task 4)

docs/superpowers/
  instrumentation-guide.md                                 NEW (Task 4)

CLAUDE.md                                                  MODIFY (Task 4)
```

### File count

- **Created (4):** instrumentation.ts + .test.ts + instrumentation-guide.md + memory file (outside repo)
- **Modified (~14):**
  - `_shared.ts` + `_shared.test.ts` (1 helper file × 2)
  - mi-board.ts + .test.ts
  - ny-jcope.ts + .test.ts
  - tx-tec/shared.ts + .test.ts
  - state-community-ingest.ts + state-ethics-ingest.ts (2 orchestrators)
  - CLAUDE.md
- **Total touched: ~18 files**

## Components

### Task 1: `SkipReason` + `createSkipCollector` + `formatSkipSummary`

**File:** `packages/db/supabase/seed/shared/instrumentation.ts`

```ts
/**
 * SkipReason — discriminated union capturing the moment an adapter
 * silently skips a record. Adapters call `opts.onSkip?.(reason)` at
 * each silent-continue site so an instrumentation run can attribute
 * skips to a stage + adapter + legislator.
 */
export type SkipReason = {
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
    samples: SkipReason[]  // first ~5 skips per adapter for diagnostic context
    total: number
  }>
  grandTotal: number
}

/** Maximum sample skips retained per adapter (memory bound). */
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
 *
 * Format example:
 *   Skip summary (47 skips across 3 adapters)
 *   ─────────────────────────────────────────
 *   [mi-board]    37 skips
 *     fetch       30 (e.g. Jane Doe: 404 from MI_PFD_BASE/.../Doe-Jane-PFDDR-2024.pdf)
 *     parse       5  (e.g. Alex Smith: no recognized Sources of Income section)
 *     extract     2  (e.g. Bob Jones: empty PDF text)
 *   [ny-jcope]    8 skips
 *     resolve     6  (e.g. Maria Chen: unmatched in officials)
 *     parse       2  (e.g. ...)
 *   [fl-doe]      2 skips
 *     derive_url  2  (e.g. ...)
 */
export function formatSkipSummary(s: SkipSummary): string {
  if (s.grandTotal === 0) return 'No skips recorded.'
  const lines: string[] = []
  lines.push(`Skip summary (${s.grandTotal} skips across ${s.byAdapter.size} adapters)`)
  lines.push('─'.repeat(40))

  // Sort adapters by total skip count descending
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
      lines.push(`  ${stage.padEnd(11)} ${count}  ${sampleStr}`)
    }
  }

  return lines.join('\n')
}
```

**Tests** (~10 cases):
- `createSkipCollector` returns onSkip + summary functions
- onSkip aggregates by adapter + stage correctly
- samples capped at MAX_SAMPLES_PER_ADAPTER per adapter
- grandTotal sums all skips
- formatSkipSummary handles 0-skip case
- formatSkipSummary sorts adapters by total descending
- formatSkipSummary sorts stages by count descending within each adapter
- formatSkipSummary includes sample legislator + reason in output
- Empty adapter map → "No skips recorded."
- Type assertion: SkipReason discriminated union exhaustive in switch

### Task 2: `onSkip` callback in `fetchPerMemberOffices`

**File:** `packages/db/supabase/seed/state-community/district-offices/_shared.ts`

Extend `PerMemberOfficesOpts`:

```ts
export interface PerMemberOfficesOpts {
  chamber: 'state_house' | 'state_senate'
  state: string
  /** Slug for skip-reason attribution. NEW per slice 22. */
  adapter: string
  deriveUrl: (...) => string | null
  parseDetailHtml: (...) => ParsedMemberDetail
  fetcher?: (url: string) => Promise<string>
  /** Optional skip-reason collector. NEW per slice 22. */
  onSkip?: (reason: SkipReason) => void
}
```

Inside `fetchPerMemberOffices`, instrument each silent-skip site:

```ts
// Skip 1: deriveUrl returned null
if (!url) {
  opts.onSkip?.({
    adapter: opts.adapter,
    stage: 'derive_url',
    legislator: legislator.full_name,
    reason: 'deriveUrl returned null',
  })
  continue
}

// Skip 2: fetch failure
try {
  html = await fetcher(url)
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

// Skip 3: parseAddressText returned null (parseDetailHtml emitted empty addresses)
// — emit per failed sub-block (capitol + district independently)
```

Each per-chamber parser (ca-leginfo/{senate,assembly}, mi-legislature/{senate,house}, fl-doe/{senate,house}, ny-senate/senate.ts) PASSES its slug to `fetchPerMemberOffices` opts.adapter and optionally PROPAGATES opts.onSkip from its own opts:

```ts
// Example: ca-leginfo/assembly.ts
export async function fetchCaAssemblyOffices(
  client: Pick<Client, 'query'>,
  opts: {
    fetcher?: (url: string) => Promise<string>
    onSkip?: (reason: SkipReason) => void  // NEW
  },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_house',
    state: 'CA',
    adapter: 'ca-leginfo',  // NEW
    deriveUrl: (l) => l.district_id ? deriveAmDistrictUrl(parseDistrict(l.district_id)) : null,
    parseDetailHtml: parseCaAssemblymemberDetailHtml,
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
    ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),  // NEW
  })
}
```

Adapter-level `index.ts` files propagate `onSkip` to each sub-fetcher.

**Tests** (~8 cases): assert onSkip fires correctly for each stage; total skip count across multi-legislator scenarios matches expected.

### Task 3: `onSkip` in PDF parsers

**Files:** mi-board.ts (MI PFD), ny-jcope.ts (NY FDS), tx-tec/shared.ts (TX TEC)

Each adapter:
1. Gains `onSkip?` opts key (passed through generic StateXxxAdapter<E> from slice 18)
2. Instruments each silent-skip site

**mi-board.ts** skips: empty URL (single-name) / fetchPdf reject / empty text / 0 line items.
**ny-jcope.ts** skips: chamber inference null / unresolved openstates_person_id / PDF fetch reject (per filing) / empty text / 0 line items.
**tx-tec/shared.ts** skips: filter (non-legislator agency) / unresolved (already in `errors[]`) / PDF fetch reject / empty text.

For TX TEC, the existing `errors[]` mechanism stays (back-compat); `onSkip` is called in addition. Eventually slice 23+ migrates errors[] consumers to a unified channel.

**Tests** (~10 cases): one per adapter × major skip stage.

### Task 4: `--instrument` CLI flag on orchestrators + docs

**Files:** state-community-ingest.ts + state-ethics-ingest.ts

Both orchestrators gain CLI arg parsing:

```ts
const argv = process.argv.slice(2)
const isInstrument = argv.includes('--instrument')
const isNoApply = argv.includes('--no-apply')

const collector = isInstrument ? createSkipCollector() : null
const onSkip = collector?.onSkip

for (const adapter of ADAPTERS_DEFAULT) {
  const events = await adapter.fetchEvents({
    client,
    ...(onSkip ? { onSkip } : {}),
  })
  if (!isNoApply) {
    // existing UPSERT loop
  }
}

if (collector) {
  console.log(formatSkipSummary(collector.summary()))
}
```

Supports 3 modes:
- Default: rows committed; no telemetry
- `--instrument`: rows committed AND skip summary printed at end
- `--instrument --no-apply`: dry-run (no DB writes) + skip summary printed

**Docs:** `docs/superpowers/instrumentation-guide.md` documents:
- How to run `pnpm seed:state-ethics --instrument --no-apply`
- How to interpret the skip summary
- How to debug specific high-skip adapters (e.g. drill into samples)
- Recommended cadence (after each parser slice ships)

## Data flow

```
operator runs: pnpm seed:state-ethics --instrument [--no-apply]
  ↓
orchestrator (state-ethics-ingest.ts):
  - parses argv → { isInstrument, isNoApply }
  - if isInstrument: const { onSkip, summary } = createSkipCollector()
  - for each adapter in ADAPTERS_DEFAULT:
      events = await adapter.fetchEvents({ client, onSkip })
      if (!isNoApply) UPSERT events to DB
  - if isInstrument: console.log(formatSkipSummary(summary()))
  ↓
adapter (e.g. mi-board.ts):
  - per legislator:
      if !derivedUrl → onSkip?.({ stage: 'derive_url', adapter: 'mi-board', legislator, reason: 'empty URL' })
      try fetchPdf → catch → onSkip?.({ stage: 'fetch', ... })
      empty text → onSkip?.({ stage: 'extract', ... })
      0 line items → onSkip?.({ stage: 'parse', ... })
  ↓
collector aggregates → byAdapter map → SkipSummary → CLI output
```

## Error handling

- onSkip is OPTIONAL; default behavior unchanged when omitted
- onSkip throws? Caught + logged but doesn't crash adapter (defensive — collector bugs shouldn't break ingest)
- formatSkipSummary handles empty maps gracefully (returns "No skips recorded.")

## Testing strategy

- Unit tests for `createSkipCollector` + `formatSkipSummary` (~10 cases)
- Integration tests for `fetchPerMemberOffices` onSkip propagation (~8 cases)
- Per-adapter onSkip integration (~10 cases — 3 adapters × ~3 stages each)
- Orchestrator CLI tests deferred (argv parsing + integration with collector is more E2E; can stub if needed). Realistic v1: smoke-test orchestrator manually + add automated coverage in slice 23+ if drift surfaces.

Expected new tests: ~28. Total @chiaro/db: 716 → ~744.

## Verify gate

- `pnpm -r typecheck` → 11 packages green (composite from slice 18 covers seed tree)
- `pnpm --filter @chiaro/db exec vitest run` → ~744 tests green
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans

## Risk + tradeoffs

1. **Adapter signature changes.** Each PDF adapter + per-chamber adapter gains `opts.onSkip?`. Existing callers pass nothing → no behavior change. Tests need to verify back-compat.

2. **No real production run in this slice.** Operator schedules + executes separately. Slice ships tooling + docs; the run happens "out of band". Recommend operator runs after first stable production deploy.

3. **TX TEC dual-write (`errors[]` + `onSkip`).** Acceptable v1; future slice migrates errors[] consumers to onSkip.

4. **Slug attribution requires adapter constant.** Each per-chamber parser must pass its `adapter: 'ca-leginfo'` slug to `fetchPerMemberOffices`. Typo-prone but caught by skip summary review (wrong slug → wrong bucket in output).

5. **No structured-log shipping in this slice.** stdout-only. Future slice could add OpenTelemetry / Sentry breadcrumb integration.

6. **Memory bound on samples.** MAX_SAMPLES_PER_ADAPTER = 5 caps memory; sufficient for diagnostic context. Operator can rerun with detail logging if needed.

7. **CLI argv parsing is hand-rolled.** No `commander` or similar lib. ~3 lines per flag check. Acceptable v1; if 3+ flags accumulate, migrate to a lib.

8. **Other adapters (town_halls, mobilize, scorecards) NOT instrumented in this slice.** Lower-stakes; can add in slice 23+ if production runs surface drift.

## Cross-references

- Slice 18 audit (`docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`) — 5 "blocked by production" follow-ups this slice unblocks
- Slice 16 (MI House TLS-flake follow-up), slice 17 (FL House MemberId + NY FDS pagination), slice 19/20 (PDF regex iteration) — original silent-skip sites instrumented here
- Slice 18 helpers (`packages/db/supabase/seed/test-utils/stub-fetch.ts`, generic `StateXxxAdapter<E>`) — leveraged for tests + interface stability
- Memory: [[project-chiaro-slice18-bug-fix-tooling-refactors]] (audit-tooling pattern), [[project-chiaro-slice19-pdf-parsing-mi-pfd]], [[project-chiaro-slice20-ny-fds-tx-tec-pdfs]] (silent-skip sites instrumented here)
