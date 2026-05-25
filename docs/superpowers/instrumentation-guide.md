# Production-run instrumentation guide

> Slice 22 (2026-05-25). Adapter-level skip-reason telemetry for state-ethics + state-community ingest orchestrators. Operator-facing.

## Why

Real production data exposes failure modes that fixtures don't:
- Live URLs 404 due to slug drift (e.g., MI House MemberId rotation, NY FDS ID-format changes)
- Transient TLS/timeout flakes on per-legislator PDF fetches
- Regex misses on real-PDF text vs. fixture text
- Officials table out of sync with source-of-truth names

Before slice 22, all of these surfaced as silent `continue` statements in the per-record loops. Skipped rows were invisible — only the final "rowsUpserted" count moved, with no way to attribute a low count to a specific failure stage.

Slice 22 adds:
- A shared `SkipReason` discriminated union with 6 stages (`derive_url`, `fetch`, `extract`, `parse`, `resolve`, `filter`)
- An optional `onSkip?` callback on every `StateXxxAdapter<E>` interface
- Instrumented silent-skip sites in the slice 18 `fetchPerMemberOffices` helper + 3 PDF parsers (MI PFD slice 19, NY FDS slice 17+20, TX TEC slice 16+20)
- `--instrument` + `--no-apply` CLI flags on both orchestrators

## CLI modes

### Default (unchanged from slice 21)

```bash
pnpm seed:state-ethics
pnpm seed:state-community
```

- Rows committed to DB
- No telemetry output
- Existing summary lines only (`adapters attempted`, `total rows upserted`, etc.)

### Instrumented (writes + telemetry)

```bash
pnpm seed:state-ethics --instrument
pnpm seed:state-community --instrument
```

- Rows committed to DB
- Skip summary printed at end of stdout
- Use after a production deploy to verify expected skip distribution stayed stable

### Instrumented dry-run (telemetry only, no DB writes)

```bash
pnpm seed:state-ethics --instrument --no-apply
pnpm seed:state-community --instrument --no-apply
```

- **NO DB writes** — adapter `fetchEvents` still runs (and incurs HTTP cost), but the orchestrator skips its UPSERT loop
- Skip summary printed
- "Total rows upserted" reports the would-upsert count with a `(dry-run; no DB writes)` suffix
- Use before a deploy to validate a freshly-wired parser without contaminating prod data

All three modes compose with existing flags:

```bash
pnpm seed:state-ethics --instrument --no-apply --state=MI --component=disclosures
pnpm seed:state-community --instrument --no-apply --state=NY --component=offices
```

## Reading the output

The summary appears below the existing per-adapter rollup:

```
State ethics ingest summary:
  adapters attempted:        15
  adapters ok:               15
  total rows upserted:       342 (dry-run; no DB writes)
  total officials unmatched: 28
  disclosures:mi-board: 81 rows / ok
  disclosures:ny-jcope: 156 rows / ok
  ...

Skip summary (47 skips across 3 adapters)
────────────────────────────────────────
[mi-board]    24 skips
  fetch         18  (e.g. Jane Doe: fetchPdf threw)
  derive_url     4  (e.g. Madonna: deriveMiPfdUrl returned empty (single-name legislator))
  parse          2  (e.g. John Smith: parseMiPfdText returned no items)
[ny-jcope]    14 skips
  resolve       10  (e.g. Smith, John: unmatched in officials table)
  fetch          3  (e.g. Doe, Jane: fetchPdf threw (per-filing PDF))
  parse          1  (e.g. Lee, Bob: parseNyFdsText returned 0 line items)
[tx-tec]       9 skips
  resolve        6  (e.g. Smith, John: unmatched in officials (state_house))
  filter         3  (e.g. Doe, Jane: agency "City of Austin" not a TX state legislator)
```

Format:

- **Header**: total skip count + adapter count
- **Per-adapter**: sorted by total skip count descending
- **Per-stage** within an adapter: sorted by count descending
- **Sample**: one representative skip per stage, capped at 5 retained samples per adapter for memory bound

## Interpreting stages

| Stage         | Meaning                                                                 | Typical fix                                          |
|---------------|-------------------------------------------------------------------------|------------------------------------------------------|
| `derive_url`  | URL builder returned null (no district_id, single-name legislator, etc.) | Update name normalization or slug-derivation logic   |
| `fetch`       | HTTP error: network, timeout, 404/5xx                                   | Add retry helper; verify URL pattern hasn't drifted  |
| `extract`     | PDF/HTML text extraction returned empty                                 | Update extractor; check for image-only PDFs          |
| `parse`       | Text extracted but parser found no recognized items                     | Iterate parser regex against real-PDF samples        |
| `resolve`     | Legislator name didn't match `officials` table                          | Run `seed:state-officials`; check name normalization |
| `filter`      | Row didn't match `LEGISLATOR_AGENCY_RE` or chamber filter               | Verify filter regex; could be intentional non-match  |

## Debugging high-skip adapters

When a stage shows an unexpected spike:

1. **Grep the source for the stage**:
   ```
   rg "stage: 'fetch'" packages/db/supabase/seed/state-ethics/disclosures/mi-board.ts
   ```

2. **Re-run scoped to one adapter** via `--state=` to isolate:
   ```bash
   pnpm seed:state-ethics --instrument --no-apply --state=MI --component=disclosures
   ```

3. **Read the sample legislator + reason text** in the summary — they identify which specific call site fired.

4. **Drill into specific failures** by temporarily raising `MAX_SAMPLES_PER_ADAPTER` in `packages/db/supabase/seed/shared/instrumentation.ts` (currently 5). For verbose runs, set it to `Infinity` or persist all samples to a JSON file via a custom collector.

5. **For `fetch` stage spikes**: check whether failures cluster by legislator (suggests slug drift) or appear random (suggests TLS/timeout flake — add retry).

## Recommended cadence

| When                              | Run                                                                 | Purpose                                                |
|-----------------------------------|---------------------------------------------------------------------|--------------------------------------------------------|
| After each parser-slice merge     | `pnpm seed:state-ethics --instrument --no-apply`                    | Confirm skip distribution didn't regress               |
| Before each production deploy     | Both orchestrators `--instrument --no-apply`                        | Catch source-site drift before contaminating prod data |
| Monthly maintenance               | Both orchestrators `--instrument` (real write)                      | Baseline skip rates over time; flag drift              |
| When investigating a parser bug   | `--instrument --no-apply --state=XX --component=YYYY`               | Isolate the specific failure mode                      |

## Action thresholds

Use the skip summary to decide whether intervention is needed:

| Skip rate              | Stage          | Action                                                                |
|------------------------|----------------|-----------------------------------------------------------------------|
| < 5 % of total fetched | any            | Acceptable baseline; document if recurring                            |
| 5-20 %                 | `fetch`        | Add retry helper with exponential backoff (slice 5A pattern)          |
| 5-20 %                 | `parse`        | Iterate parser regex against real-PDF samples; expand the test corpus |
| 5-20 %                 | `resolve`      | Re-run `seed:state-officials`; check name normalization               |
| > 20 %                 | `derive_url`   | Source URL pattern has likely changed — re-do discovery audit         |
| > 20 %                 | `fetch`/`parse`| Schedule a slice; current adapter is no longer fit for production     |
| 100 %                  | any            | Deprecate adapter (slice 11/13 `@deprecated` pattern + empty `covered_states`) |

## Example realistic distributions

These are illustrative ratios from operator hand-runs against the live state legislatures (CA, FL, MI, NY, TX). Actual numbers depend on session, date, and source availability.

**MI PFD (slice 19)** — single-name legislators + intermittent TLS flake:
```
[mi-board]    24 skips
  fetch         18  (e.g. Tom Smith: fetchPdf threw)
  derive_url     4  (e.g. Madonna: deriveMiPfdUrl returned empty (single-name legislator))
  parse          2  (e.g. Jane Doe: parseMiPfdText returned no items)
```
Diagnosis: 18 fetch failures on ~148 legislators is the ~12 % TLS-flake rate flagged in the slice 19 audit. Action: add retry helper next slice.

**NY FDS (slice 17+20)** — pagination ceiling + officials name mismatch:
```
[ny-jcope]    33 skips
  resolve       22  (e.g. Smith, John: unmatched in officials table)
  fetch          8  (e.g. Doe, Jane: fetchPdf threw (per-filing PDF))
  parse          3  (e.g. Lee, Bob: parseNyFdsText returned 0 line items)
```
Diagnosis: 22 unresolved is the NY FDS pagination gap (only first 100 filings reached, some legislators missing). Action: implement pagination per slice 17+20 follow-up.

**TX TEC (slice 16+20)** — non-legislator agencies + missing officials:
```
[tx-tec]      19 skips
  filter        12  (e.g. agency "City of Austin" not a TX state legislator)
  resolve        5  (e.g. Smith, John: unmatched in officials (state_house))
  fetch          2  (e.g. fetchPdf threw (per-case order PDF))
```
Diagnosis: 12 filter skips are expected (TX TEC covers many agencies; only state-leg rows belong here). 5 resolves are name-format drift — action: refine `resolveOfficialByName` heuristics.

## What's NOT instrumented (yet)

- Town-halls adapters (`mobilize`, `ca-leginfo`, `ny-senate`, `fl-doe`, `tx-capitol`, `mi-legislature` halls)
- Scorecards adapters (slice 5G/9/11)
- Committee-hearings adapter (`openstates-v3-hearings`)
- Single-page roster parsers (CA Senate slice 18, NY Assembly slice 18 — they use a different code path from `fetchPerMemberOffices`)

These use different code paths or have low silent-skip surface area. Slice 23+ extends instrumentation if production runs surface new gaps.

## Dual-write contract (TX TEC)

The TX TEC adapter (slice 16+20) had an existing `errors[]` array on its result shape for unresolved legislators. Slice 22 preserves it via a dual-write pattern: `errors.push(...)` runs alongside `opts.onSkip?.(...)`. Existing callers reading `errors[]` keep working; new `--instrument` runs additionally see the same skips in the per-adapter rollup. Future slice can migrate `errors[]` consumers off and remove the dual-write.

## Reference

- Spec: `docs/superpowers/specs/2026-05-25-production-instrumentation-design.md`
- Plan: `docs/superpowers/plans/2026-05-25-production-instrumentation.md`
- Helper: `packages/db/supabase/seed/shared/instrumentation.ts`
- Orchestrators: `packages/db/supabase/seed/state-{ethics,community}-ingest.ts`
