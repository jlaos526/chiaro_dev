# Slice 55 — TIGER Download Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop re-downloading ~51 Census TIGER shapefiles on every CI run (~102/run across the `db` + `test` jobs, uncached) by adding a persistent on-disk zip cache wired into both CI jobs.

**Architecture:** A new `tiger-cache.ts` (`loadTigerZip`: read from an on-disk cache if present, else fetch + write atomically) replaces the bare `fetchWithRetry` call in `tiger-ingest.ts`'s `downloadAndUnzip`. CI gains `actions/cache/restore` + `save` (rolling key, save-on-failure) on both jobs; the seed's default cache dir (`homedir()/.cache/tiger`) already equals the cached path (`~/.cache/tiger`), so no env is set.

**Tech Stack:** TypeScript (strict, ESNext, `.ts` extensions), tsx, undici, unzipper, vitest, GitHub Actions (`actions/cache`).

**Spec:** `docs/superpowers/specs/2026-06-04-slice-55-tiger-cache-design.md`.

---

## Conventions (read once)
- Commit after every task. Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Relative imports use `.ts`. After each code task run `pnpm -r typecheck`.
- Run the seed tests with `pnpm --filter @chiaro/db test tiger` (covers `tiger-retry.test.ts` + the new `tiger-cache.test.ts`).
- **Ship via PR with all 4 CI jobs green** (Gotcha #30). This PR's CI still does ONE full TIGER download (bootstrap) + still risks a `seed:tiger` Census flake — retry the db job; admin-merge only with explicit approval if it's a provable unrelated external outage. **Validation that the fix works is the SECOND run** (post-merge): the `db` job should show ~0 "Fetching" lines.

---

## File Structure
- `packages/db/supabase/seed/tiger-cache.ts` — NEW: the on-disk zip cache helper (one clear responsibility: cache-or-fetch zip bytes).
- `packages/db/supabase/seed/tiger-cache.test.ts` — NEW: unit tests for the helper.
- `packages/db/supabase/seed/tiger-ingest.ts` — MODIFY: `downloadAndUnzip` uses the cache; `IngestCtx`/`main` thread `cacheDir`.
- `.github/workflows/ci.yml` — MODIFY: rolling-key restore/save on the `db` + `test` jobs.
- `CLAUDE.md` — MODIFY: Slices delivered entry + a Gotcha for the no-op-cache lesson.

---

## Task 1: `tiger-cache.ts` helper + unit test

**Files:**
- Create: `packages/db/supabase/seed/tiger-cache.ts`
- Create (test): `packages/db/supabase/seed/tiger-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/supabase/seed/tiger-cache.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTigerZip, tigerCacheFile } from './tiger-cache.ts'
import type { FetchResult } from './tiger-retry.ts'

const URL1 = 'https://www2.census.gov/geo/tiger/TIGER2024/CD/tl_2024_06_cd119.zip'

describe('tigerCacheFile', () => {
  it('derives the zip basename from the url', () => {
    expect(tigerCacheFile(URL1, '/cache')).toBe(join('/cache', 'tl_2024_06_cd119.zip'))
  })
})

describe('loadTigerZip', () => {
  it('cache miss → calls fetcher + writes the cache atomically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tcache-'))
    try {
      const bytes = new Uint8Array([1, 2, 3]).buffer
      const fetcher = vi.fn(async (): Promise<FetchResult> => ({ kind: 'ok', body: bytes }))
      const out = await loadTigerZip(URL1, dir, fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(out.kind).toBe('ok')
      expect(out.fromCache).toBe(false)
      const cached = await readFile(tigerCacheFile(URL1, dir))
      expect([...cached]).toEqual([1, 2, 3])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })

  it('cache hit → returns cached bytes without calling the fetcher', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tcache-'))
    try {
      await writeFile(tigerCacheFile(URL1, dir), Buffer.from([9, 9]))
      const fetcher = vi.fn(async (): Promise<FetchResult> => ({ kind: 'ok', body: new ArrayBuffer(0) }))
      const out = await loadTigerZip(URL1, dir, fetcher)
      expect(fetcher).not.toHaveBeenCalled()
      expect(out.fromCache).toBe(true)
      if (out.kind === 'ok') expect([...new Uint8Array(out.body)]).toEqual([9, 9])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })

  it('gap/error results are not cached', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tcache-'))
    try {
      const fetcher = vi.fn(async (): Promise<FetchResult> => ({ kind: 'gap', status: 404, message: 'not found' }))
      const out = await loadTigerZip(URL1, dir, fetcher)
      expect(out.kind).toBe('gap')
      expect(out.fromCache).toBe(false)
      await expect(readFile(tigerCacheFile(URL1, dir))).rejects.toThrow()
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/db test tiger-cache`
Expected: FAIL — `./tiger-cache.ts` not found.

- [ ] **Step 3: Implement `tiger-cache.ts`**

Create `packages/db/supabase/seed/tiger-cache.ts`:
```ts
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { fetchWithRetry, type FetchResult } from './tiger-retry.ts'

/** Default cache dir; on the CI runner homedir()/.cache/tiger === ~/.cache/tiger (the actions/cache path). */
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
 * atomically (.tmp + rename). Gap/error results are passed through, NOT cached.
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
      const buf = await readFile(file)
      // FetchResult.body is ArrayBuffer — slice off the Buffer's view to a standalone ArrayBuffer.
      return {
        kind: 'ok',
        body: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        fromCache: true,
      }
    }
  } catch {
    /* miss — fall through to fetch */
  }

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

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @chiaro/db test tiger-cache && pnpm -r typecheck`
Expected: 4/4 pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/tiger-cache.ts packages/db/supabase/seed/tiger-cache.test.ts
git commit -m "feat(slice-55): tiger-cache.ts persistent zip cache helper" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire `tiger-ingest.ts` to use the cache

**Files:**
- Modify: `packages/db/supabase/seed/tiger-ingest.ts`

- [ ] **Step 1: Add imports + `cacheDir` to `IngestCtx`**

At the top of `tiger-ingest.ts`, add to the `node:path` import `basename` (currently only `join`), and add a new import:
```ts
import { join, basename } from 'node:path'
import { loadTigerZip, evictTigerCache, tigerCacheDir } from './tiger-cache.ts'
```
Add `cacheDir` to the `IngestCtx` type:
```ts
type IngestCtx = {
  client: Client
  workDir: string
  cacheDir: string
  skip: { tierStates: Set<string>; tiers: Set<string> }
  stats: IngestStats
}
```

- [ ] **Step 2: Compute `cacheDir` in `main` + thread it into `ctx`**

In `main()`, right after `const workDir = await mkdtemp(join(tmpdir(), 'tiger-'))`, add:
```ts
  const cacheDir = tigerCacheDir()
  console.log(`TIGER zip cache: ${cacheDir}`)
  const ctx: IngestCtx = { client, workDir, cacheDir, skip, stats }
```
(Replace the existing `const ctx: IngestCtx = { client, workDir, skip, stats }` line.)

- [ ] **Step 3: Rewrite `downloadAndUnzip` to use the cache**

Replace the body of `downloadAndUnzip` (from `console.log(\`  Fetching ${url}\`)` through `const dir = await Open.buffer(buf)`) so it loads via the cache + handles a corrupt cache. The full new function:
```ts
async function downloadAndUnzip(
  url: string,
  ctx: IngestCtx,
): Promise<{ shp: string; dbf: string } | null> {
  let loaded = await loadTigerZip(url, ctx.cacheDir)
  if (loaded.kind === 'gap') {
    console.warn(`  GAP ${url} — ${loaded.message} (Census may not have published yet)`)
    ctx.stats.gaps.push({ url, status: loaded.status })
    return null
  }
  if (loaded.kind === 'error') {
    console.error(`  ERROR ${url} failed after ${loaded.attempts} attempts: ${loaded.message}`)
    ctx.stats.errors.push({ url, message: loaded.message })
    return null
  }
  console.log(loaded.fromCache ? `  Cached ${basename(new URL(url).pathname)}` : `  Fetched ${url}`)

  let dir
  try {
    dir = await Open.buffer(Buffer.from(loaded.body))
  } catch (e) {
    if (loaded.fromCache) {
      // Corrupt cache entry — evict and re-fetch once.
      console.warn(`  Corrupt cache for ${url} — re-fetching`)
      await evictTigerCache(url, ctx.cacheDir)
      loaded = await loadTigerZip(url, ctx.cacheDir)
      if (loaded.kind !== 'ok') {
        const msg = loaded.kind === 'error' ? loaded.message : 'gap on re-fetch'
        console.error(`  ERROR ${url} on re-fetch: ${msg}`)
        ctx.stats.errors.push({ url, message: msg })
        return null
      }
      try {
        dir = await Open.buffer(Buffer.from(loaded.body))
      } catch (e2) {
        console.error(`  ERROR ${url}: corrupt zip after re-fetch`)
        ctx.stats.errors.push({ url, message: `corrupt zip after re-fetch: ${String(e2)}` })
        return null
      }
    } else {
      console.error(`  ERROR ${url}: unzip failed`)
      ctx.stats.errors.push({ url, message: `unzip failed: ${String(e)}` })
      return null
    }
  }

  let shpPath = '', dbfPath = ''
  for (const entry of dir.files) {
    const lower = entry.path.toLowerCase()
    if (lower.endsWith('.shp')) {
      shpPath = join(ctx.workDir, entry.path)
      await writeFile(shpPath, await entry.buffer())
    } else if (lower.endsWith('.dbf')) {
      dbfPath = join(ctx.workDir, entry.path)
      await writeFile(dbfPath, await entry.buffer())
    }
  }
  if (!shpPath || !dbfPath) {
    console.error(`  ERROR ${url}: no .shp/.dbf in archive`)
    ctx.stats.errors.push({ url, message: 'no .shp/.dbf in archive' })
    return null
  }
  return { shp: shpPath, dbf: dbfPath }
}
```
> The `.shp/.dbf` extraction block + the final `return` are unchanged from the original — only the fetch/unzip front half is reworked.

- [ ] **Step 4: Verify**

Run: `pnpm -r typecheck && pnpm --filter @chiaro/db test tiger`
Expected: typecheck clean; `tiger-retry.test.ts` + `tiger-cache.test.ts` pass. (The `downloadAndUnzip` cache integration has no unit harness — it's validated end-to-end by CI per the spec. Do NOT run `pnpm db:seed-tiger` locally just to test it — that hits Census ~51× and is what we're trying to avoid.)

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/tiger-ingest.ts
git commit -m "feat(slice-55): seed:tiger reads/writes the persistent zip cache" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: CI — rolling-key TIGER cache on both jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: `db` job — replace the no-op cache step with restore + save**

In the `db` job, REMOVE the existing step:
```yaml
      - name: Cache TIGER 2024 download
        uses: actions/cache@v5
        with:
          path: ~/.cache/tiger
          key: tiger-2024-v1
```
and replace with a RESTORE before the seed step:
```yaml
      - name: Restore TIGER cache
        uses: actions/cache/restore@v5
        with:
          path: ~/.cache/tiger
          key: tiger-2024-v1-${{ github.run_id }}
          restore-keys: |
            tiger-2024-v1-
```
Then, immediately AFTER the `Seed districts (TIGER 2024)` step, ADD a save step (runs even if the seed failed, so partial caches persist):
```yaml
      - name: Save TIGER cache
        if: always()
        uses: actions/cache/save@v5
        with:
          path: ~/.cache/tiger
          key: tiger-2024-v1-${{ github.run_id }}
```
Do NOT add any `TIGER_CACHE_DIR` env — the seed default `homedir()/.cache/tiger` === `/home/runner/.cache/tiger` === the cached path.

- [ ] **Step 2: `test` job — add restore + save around its `Seed TIGER` step**

In the `test` job, ADD a restore step BEFORE the `Seed TIGER` step (it currently has none):
```yaml
      - name: Restore TIGER cache
        uses: actions/cache/restore@v5
        with:
          path: ~/.cache/tiger
          key: tiger-2024-v1-${{ github.run_id }}
          restore-keys: |
            tiger-2024-v1-
```
and a save step immediately AFTER `Seed TIGER`:
```yaml
      - name: Save TIGER cache
        if: always()
        uses: actions/cache/save@v5
        with:
          path: ~/.cache/tiger
          key: tiger-2024-v1-${{ github.run_id }}
```
> The `test` job `needs: [db, functions]`, so it runs after `db` and its restore picks up the cache `db` saved this same run (`tiger-2024-v1-<run_id>`) → ~0 Census fetches in `test` immediately. (Two jobs in one run share the same `tiger-2024-v1-<run_id>` key; whichever saves first wins, the other's save is a harmless no-op.)

- [ ] **Step 3: Validate the YAML**

Run a YAML lint / parse check (no special tool needed — confirm indentation matches the surrounding steps). Optionally: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` → no error.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(slice-55): rolling-key TIGER cache restore/save on db + test jobs" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Closeout — docs + PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the CLAUDE.md "Slices delivered" entry + a Gotcha**

Append after the Slice 54 bullet (or, if slice 54 hasn't merged yet, after the latest slice bullet present on this branch — i.e. Slice 53): a `**Slice 55 — TIGER download cache**` bullet summarizing: the existing `~/.cache/tiger` CI cache was a no-op (seed:tiger used a random `mkdtemp`), so every CI run re-downloaded ~51 Census shapefiles in BOTH the `db` + `test` jobs (~102/run, the slice-53 rerun flake amplifier); new `tiger-cache.ts` `loadTigerZip` (skip-if-present + atomic write + corrupt→re-fetch); CI rolling-key (`tiger-2024-v1-${{ github.run_id }}` + `restore-keys`) restore/save-on-failure on both jobs; no `TIGER_CACHE_DIR` env (seed default === the cache path); after the first run, ~0 Census downloads. Reference the spec.

Add a new Gotcha (next number after the current highest) capturing the durable lesson: **a cache step is only as good as the path the producer writes to** — `seed:tiger` downloaded to `mkdtemp(tmpdir())` while CI cached `~/.cache/tiger`, so the cache silently cached nothing for ages; when adding an `actions/cache`, verify the producer actually writes to the cached path (and prefer a rolling key + save-on-failure so partial/failed runs still persist). Also: GitHub Actions does NOT expand `~`/`$HOME` in `env:` values — rely on the producer's `homedir()` default matching the `actions/cache` `~/...` path (which the cache action DOES expand), rather than setting a `~`-containing env var.

- [ ] **Step 2: Full local verification**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db test tiger
pnpm test
```
Expected: clean / all pass. (Skip `db:seed-tiger` — don't hit Census locally.)

- [ ] **Step 3: Commit + open PR (Gotcha #30)**

```bash
git add CLAUDE.md
git commit -m "docs(slice-55): CLAUDE.md slice 55 entry + cache-path gotcha" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin slice-55-tiger-cache
gh pr create --base master --title "Slice 55 — TIGER download cache (stop re-hammering Census)"
```
(Write the PR body from the Goal + spec.) Watch CI (`gh pr checks <n> --watch`). The PR's CI still does ONE full TIGER download (bootstrap) — if it Census-flakes, retry the db job. Merge `--squash --delete-branch` when all 4 jobs are green. After merge, the FIRST master `db` run populates the durable cache; confirm a SUBSEQUENT run's `db` job shows ~0 "Fetched" lines (mostly "Cached …").

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Update the slice-55 memory note to SHIPPED with the squash hash. (Then resume slice 54: rebase `slice-54-you-vs-rep-radar` on the new master + PR it.)

---

## Self-Review notes (for the planner)
- **Spec coverage:** §4.1 module → Task 1; §4.2 ingest wiring → Task 2; §4.3 CI → Task 3; §5 tests → Task 1; §6 verification → Task 4. ✓
- **Body-type fix:** `loadTigerZip` cache-hit returns `body` as `ArrayBuffer` (slice off the `Buffer` view) to satisfy `FetchResult.body: ArrayBuffer` — the spec's `await readFile(file)` (a `Buffer`) would have been a type error; corrected in Task 1 Step 3.
- **Reconciliation confirmed while writing:** `FetchResult` is already exported from `tiger-retry.ts` with `body: ArrayBuffer` (no export change needed); `IngestCtx = {client, workDir, skip, stats}` (Task 2 adds `cacheDir`); `main` builds `ctx` right after `mkdtemp` (Task 2 Step 2).
- **Naming consistency:** `loadTigerZip`/`tigerCacheFile`/`evictTigerCache`/`tigerCacheDir`/`LoadResult`/`fromCache` identical across Tasks 1–2. CI key `tiger-2024-v1-${{ github.run_id }}` + `restore-keys: tiger-2024-v1-` identical across Task 3's two jobs.
- **No-placeholder:** complete code in every code step (helper, test, ingest rewrite, YAML blocks).
