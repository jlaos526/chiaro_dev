# S81 — Ingest ops + cadence (design)

Re-planned Wave 3, third slice (audit C34 + C35 + C36 + C37). Mega tier.

## Decisions

### D1 — C34 scheduler (`.github/workflows/scheduled-ingest.yml`)
GitHub Actions weekly cron against STAGING (Sun 06:17 UTC + manual dispatch).
Where-it-runs + credential-custody decisions are recorded in the workflow
header. v1 scope = key-free/key-in-hand sources only: federal officials,
state legislators (openstates/people clone-and-flatten per runbook §4),
Mobilize town halls (federal + state, `--instrument`). Logs persist as 30-day
artifacts (the "persisted skip telemetry"); a failed step fails the job and
the GitHub failure email is the v1 alerting consumer. Flag-requiring and
missing-key steps stay manual (documented in CLAUDE.md). Complements — does
not replace — the S79.5 keep-alive cron.

### D2 — C36 one retry helper (`seed/shared/http.ts`)
`fetchWithRetry(url, { timeoutMs=15000, retries=2, backoffMs=1000, init })`
modeled on tiger-retry's backoff. Adopted at the audit's five named gap
sites: `district-offices/_shared.ts` per-member fetch, `shared/pdf.ts`,
`federal-disclosures/shared/house-zip.ts`, `senate-agreement.ts` (GET+POST —
currently NO timeout at all), `state-community/town-halls/mobilize.ts`
pagination (one transient page failure currently truncates the nationwide
sweep silently). The state-bills + scorecards duplicates delegate to it
(re-export for back-compat); tiger-retry keeps its bespoke FetchResult shape
but its call path already caches via slice-55 (leave as-is, comment
cross-ref). Retry only on network error / 5xx / 429 — never on other 4xx.

### D3 — C37 on-disk caching
Generic `loadCachedUrl(url, cacheDir, fetcher)` in `seed/shared/http.ts`
following the slice-55 tiger-cache contract (skip-if-present, atomic
`.tmp`+rename, corrupt-entry evict-and-refetch; Gotcha #31: producer writes
the SAME path consumers read). Adopted for the two heaviest re-download
sites: House yearly bulk ZIPs (`house-zip.ts`) and per-filing PDFs
(`shared/pdf.ts` `fetchPdf`), default cache root `homedir()/.cache/chiaro`
(env `CHIARO_FETCH_CACHE_DIR` override; `--no-cache` CLI escape). Per-member
office HTML loops stay UNCACHED v1 (freshness matters more than bytes;
recorded).

### D4 — C35 stub-vs-production visibility
Every adapter registry entry gains an explicit `status:
'production' | 'stub' | 'deprecated'`; orchestrators print a one-line
summary table at run end (`production 9 · stub 13 · deprecated 8 — stub/
deprecated adapters returned 0 rows BY DESIGN`) so a healthy-looking run
can't hide that a source is a stub. No behavior change to dispatch.

## Verification
- Unit tests for the retry helper (attempt counting, 4xx no-retry, timeout)
  + cache helper (hit/miss/corrupt) following slice-55's tiger-cache tests.
- Adoption sites keep their existing tests green (stubFetchBlocked contract
  from slice 18 still holds — the helper takes an injectable fetcher).
- Workflow YAML validated by actionlint-style review + a manual
  workflow_dispatch run after merge.
