# Slice 55 — TIGER Download Cache Design Spec

**Date:** 2026-06-04
**Branch:** `slice-55-tiger-cache`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Compressed Slice (~3 files)

## 1. Goal / problem

`seed:tiger` re-downloads ~51 Census shapefiles from `www2.census.gov` on **every CI run**, in BOTH the `db` job and the `test` job (~102 downloads/run), completely uncached. Reruns multiply it (slice 53's 4 `db` reruns ≈ 200+ Census hits, which fed the HTTP-520 flake loop). This slice makes the downloads cacheable so CI does ~0 Census fetches after the first run populates the cache.

## 2. Root cause

- `packages/db/supabase/seed/tiger-ingest.ts` `downloadAndUnzip(url)` calls `fetchWithRetry(url)` and extracts the .shp/.dbf into a **fresh random `mkdtemp(join(tmpdir(), 'tiger-'))` workDir** each run. It never reads or writes a persistent cache.
- CI's "Cache TIGER 2024 download" step (`actions/cache@v5`, `path: ~/.cache/tiger`, `key: tiger-2024-v1`) caches a directory the seed **never writes to** → the cache is a **no-op**.
- The `test` job runs `seed:tiger` too, with **no cache step at all**.
- The seed's "resume" skip (slice 5A) only skips districts already in the DB — fresh per CI job, so no cross-run/job benefit.

## 3. Scope

**In:** a persistent on-disk ZIP cache in `seed:tiger` (env-overridable dir, skip-download-if-present, atomic write, corrupt-cache → re-fetch); CI wiring on BOTH jobs (`TIGER_CACHE_DIR` + a rolling-key restore/save with save-on-failure); a unit test for the cache helper.
**Out:** changing the in-DB resume heuristic; the local memory-pressure Supabase issue (separate); any TIGER data/version change (still TIGER 2024).

## 4. Design

### 4.1 New module `packages/db/supabase/seed/tiger-cache.ts`
```ts
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import { join } from 'node:path'
import { fetchWithRetry, type FetchResult } from './tiger-retry.ts'

/** Default cache dir (CI sets TIGER_CACHE_DIR=~/.cache/tiger to match its actions/cache path). */
export function tigerCacheDir(): string {
  return process.env.TIGER_CACHE_DIR ?? join(homedir(), '.cache', 'tiger')
}

/** Stable cache filename for a TIGER url (the zip basename, e.g. tl_2024_06_cd119.zip). */
export function tigerCacheFile(url: string, cacheDir: string): string {
  return join(cacheDir, basename(new URL(url).pathname))
}

export type LoadResult = FetchResult & { fromCache: boolean }

/**
 * Return the zip bytes for `url` — from the on-disk cache if present, else via
 * `fetcher` (default fetchWithRetry), writing a successful fetch to the cache
 * atomically (.tmp + rename, so a crash never leaves a corrupt entry). Gap/error
 * results are passed through and NOT cached.
 */
export async function loadTigerZip(
  url: string,
  cacheDir: string,
  fetcher: (u: string) => Promise<FetchResult> = fetchWithRetry,
): Promise<LoadResult> {
  const file = tigerCacheFile(url, cacheDir)
  try {
    const s = await stat(file)
    if (s.isFile() && s.size > 0) {
      return { kind: 'ok', body: await readFile(file), fromCache: true }
    }
  } catch { /* miss — fall through to fetch */ }

  const result = await fetcher(url)
  if (result.kind === 'ok') {
    await mkdir(cacheDir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, Buffer.from(result.body))
    await rename(tmp, file)
  }
  return { ...result, fromCache: false }
}

/** Delete a (corrupt) cache entry so the next load re-fetches. */
export async function evictTigerCache(url: string, cacheDir: string): Promise<void> {
  await rm(tigerCacheFile(url, cacheDir), { force: true })
}
```
> `FetchResult` shape comes from `tiger-retry.ts` (a tagged union `{kind:'ok', body, ...} | {kind:'gap', ...} | {kind:'error', ...}`). The plan must confirm the exact `ok` field name (`body`) + whether `FetchResult` is exported (export it if not).

### 4.2 `tiger-ingest.ts` — use the cache
- Compute `const cacheDir = tigerCacheDir()` once (in `main`, alongside the `mkdtemp` workDir); thread it onto `IngestCtx`.
- In `downloadAndUnzip(url, ctx)`: replace `const result = await fetchWithRetry(url)` with `let loaded = await loadTigerZip(url, ctx.cacheDir)`; keep the gap/error branches (`loaded.kind === 'gap'/'error'`). Wrap the `Open.buffer(buf)` unzip in try/catch: on throw, if `loaded.fromCache`, `await evictTigerCache(url, ctx.cacheDir)` + re-`loadTigerZip` once (now a guaranteed fetch) + retry the unzip; if it still fails or wasn't cached, record the error + return null (today's behavior). Log "Cached <name>" when `fromCache`, else the existing "Fetching <url>".
- The `mkdtemp` workDir stays (per-run scratch for extracted .shp/.dbf); ONLY the raw zip download is cached.

### 4.3 CI — `.github/workflows/ci.yml`
**No `TIGER_CACHE_DIR` env is set in CI.** GitHub Actions does NOT expand `~`/`$HOME` inside `env:` values, so `TIGER_CACHE_DIR: ~/.cache/tiger` would write to a dir literally named `~`. Instead, rely on the seed's DEFAULT: `homedir()/.cache/tiger` resolves to `/home/runner/.cache/tiger` on the runner, which is exactly the path `actions/cache` caches via `path: ~/.cache/tiger` (the cache action DOES expand `~`). Same path, no env needed. (`TIGER_CACHE_DIR` stays as an override knob for non-default environments.)

**Rolling key (so save-on-failure accumulates partial caches; a static key locks after the first save):**
- **`db` job:** replace the single `actions/cache@v5` step (`Cache TIGER 2024 download`) with `actions/cache/restore@v5` (before `Seed districts`) keyed `tiger-2024-v1-${{ github.run_id }}` + `restore-keys: tiger-2024-v1-`, `path: ~/.cache/tiger`; and a post `actions/cache/save@v5` step (`if: always()`, same key + path) AFTER the seed step. No env change to the seed step.
- **`test` job:** add the same restore (before `Seed TIGER`) + save (`if: always()`) with the same key/path. (`test` `needs: db`, so it restores the cache `db` just saved this run → ~0 downloads in `test` immediately.)

Effect: run 1 `db` fetches + saves `tiger-2024-v1-<run1>`; `test` restores it → 0 fetches. Run 2 `db` restores `tiger-2024-v1-` prefix (most recent) → 0 fetches. Census load drops to ~0 after the first run; reruns resume from the partial cache instead of re-downloading.

## 5. Tests
`packages/db/supabase/seed/tiger-cache.test.ts` (vitest, mirrors `tiger-retry.test.ts`): use a temp `cacheDir` (`mkdtemp`) + a fake fetcher.
- **cache miss → fetch + write:** absent file → `loadTigerZip` calls the fetcher once, returns `fromCache:false`, and the cache file now exists with the bytes.
- **cache hit → no fetch:** pre-write a cache file → `loadTigerZip` returns its bytes + `fromCache:true` and the fetcher is NOT called (spy asserts 0 calls).
- **gap/error not cached:** a fetcher returning `{kind:'gap'}` / `{kind:'error'}` → no cache file written, `fromCache:false`, result passed through.
- **`tigerCacheFile`** derives the zip basename from the url (`…/tl_2024_06_cd119.zip` → `tl_2024_06_cd119.zip`).

## 6. Verification (Gotcha #30 — merge via green PR CI)
`pnpm -r typecheck` · `pnpm --filter @chiaro/db test tiger-cache` · `pnpm test`. The real cache behavior is validated by CI itself: the **first** post-merge `db` run still downloads TIGER (populating the cache) + the `test` job should show "Cached …" (restored from `db`'s same-run save); a **second** run's `db` job should show ~0 "Fetching" lines. Ship via PR with all 4 CI jobs green (this PR's CI still does one full TIGER download to seed the cache — unavoidable bootstrap).

## 7. Open items for the plan to reconcile against live code
1. `tiger-retry.ts` — confirm the `FetchResult` `ok`-variant field name (assumed `body`) + export `FetchResult` if not already.
2. `IngestCtx` type — add `cacheDir: string`; confirm where `ctx` is constructed (`main`, near the `mkdtemp` workDir).
3. `actions/cache/restore@v5` / `save@v5` are the correct sub-action refs (the repo already uses `actions/cache@v5`).
4. Confirm on the runner `homedir()` === `/home/runner` so the seed default `homedir()/.cache/tiger` === the `actions/cache` `path: ~/.cache/tiger` (they must be the same absolute path for the cache to work). No `TIGER_CACHE_DIR` env is set in CI (see §4.3) — the default alignment is load-bearing.
