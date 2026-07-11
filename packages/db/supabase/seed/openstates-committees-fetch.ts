import { fetch } from 'undici'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasFlag, isCliEntry, parseFlag } from './shared/cli.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://v3.openstates.org/committees'
const PER_PAGE = 20
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_RETRY_ON_429 = 5
const BASE_BACKOFF_MS = 1000
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates-committees')

type FetchLike = typeof fetch

export interface FetchOpenStatesCommitteesOpts {
  state: string
  cacheDir?: string
  apiKey?: string
  force?: boolean
  /** Test-only fetch injection. */
  fetcher?: FetchLike
  /** Test-only override of TTL (ms). */
  ttlMs?: number
}

export interface FetchOpenStatesCommitteesStats {
  state: string
  pagesFetched: number
  committeesCached: number
  committeesSkippedFresh: number
  errors: string[]
}

interface V3CommitteesResponse {
  results: unknown[]
  pagination: { page: number; per_page: number; max_page: number; total_items: number }
}

function isV3CommitteesResponse(x: unknown): x is V3CommitteesResponse {
  if (typeof x !== 'object' || x === null) return false
  const r = x as { results?: unknown; pagination?: unknown }
  return Array.isArray(r.results) && typeof r.pagination === 'object' && r.pagination !== null
}

function slugFilename(state: string, committeeId: string): string {
  const safe = committeeId.replace(/[^a-zA-Z0-9-]/g, '-')
  return `${state}-${safe}.json`
}

async function isFresh(path: string, ttlMs: number): Promise<boolean> {
  try {
    const s = await stat(path)
    return Date.now() - s.mtimeMs < ttlMs
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPage(
  fetcher: FetchLike,
  url: string,
  apiKey: string,
): Promise<V3CommitteesResponse> {
  for (let attempt = 1; attempt <= MAX_RETRY_ON_429; attempt++) {
    const res = await fetcher(url, { headers: { 'X-API-Key': apiKey } })
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      const waitMs = retryAfter
        ? Number(retryAfter) * 1000
        : BASE_BACKOFF_MS * Math.pow(2, attempt - 1)
      if (attempt === MAX_RETRY_ON_429) {
        throw new Error(`429 after ${MAX_RETRY_ON_429} attempts: ${url}`)
      }
      await sleep(waitMs)
      continue
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
    }
    const body = await res.json()
    if (!isV3CommitteesResponse(body)) {
      throw new Error(`malformed v3 response: missing results or pagination at ${url}`)
    }
    return body
  }
  throw new Error('unreachable')
}

export async function fetchOpenStatesCommittees(
  opts: FetchOpenStatesCommitteesOpts,
): Promise<FetchOpenStatesCommitteesStats> {
  const apiKey = opts.apiKey ?? process.env.OPENSTATES_API_KEY
  if (!apiKey) {
    throw new Error('OPENSTATES_API_KEY env var (or apiKey option) is required')
  }
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR
  const ttlMs = opts.ttlMs ?? TTL_MS
  const fetcher = opts.fetcher ?? fetch
  const state = opts.state.toUpperCase()
  const stateLower = opts.state.toLowerCase()
  const jurisdiction = `ocd-jurisdiction/country:us/state:${stateLower}/government`

  await mkdir(cacheDir, { recursive: true })

  const stats: FetchOpenStatesCommitteesStats = {
    state,
    pagesFetched: 0,
    committeesCached: 0,
    committeesSkippedFresh: 0,
    errors: [],
  }

  let page = 1
  let maxPage = 1
  do {
    const url = new URL(BASE_URL)
    url.searchParams.set('jurisdiction', jurisdiction)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(PER_PAGE))
    url.searchParams.set('include', 'memberships,sources,meetings')

    let body: V3CommitteesResponse
    try {
      body = await fetchPage(fetcher, url.toString(), apiKey)
    } catch (err) {
      stats.errors.push((err as Error).message)
      break
    }
    stats.pagesFetched += 1
    maxPage = body.pagination.max_page

    for (const committee of body.results) {
      const cid = (committee as { id?: unknown }).id
      if (typeof cid !== 'string' || !cid.startsWith('ocd-committee/')) {
        stats.errors.push(`skipped result with non-string or non-committee id`)
        continue
      }
      const file = join(cacheDir, slugFilename(state, cid))
      if (!opts.force && (await isFresh(file, ttlMs))) {
        stats.committeesSkippedFresh += 1
        continue
      }
      await writeFile(file, JSON.stringify(committee, null, 2), 'utf8')
      stats.committeesCached += 1
    }
    page += 1
  } while (page <= maxPage)

  return stats
}

/** Remove cache files older than ttlMs. */
export async function pruneStaleCommitteesCache(
  cacheDir: string,
  ttlMs: number = TTL_MS,
): Promise<number> {
  let entries: string[]
  try {
    entries = await readdir(cacheDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw err
  }
  let removed = 0
  const { unlink } = await import('node:fs/promises')
  for (const e of entries) {
    if (!e.endsWith('.json')) continue
    const path = join(cacheDir, e)
    if (!(await isFresh(path, ttlMs))) {
      await unlink(path)
      removed += 1
    }
  }
  return removed
}

if (isCliEntry(import.meta.url)) {
  const state = parseFlag('state')
  const force = hasFlag('force')
  if (state === undefined) {
    console.error('usage: tsx openstates-committees-fetch.ts --state=XX [--force]')
    process.exit(2)
  }
  fetchOpenStatesCommittees({ state, force })
    .then((stats) => {
      console.log('OpenStates committees fetch summary:')
      console.log(`  state:                  ${stats.state}`)
      console.log(`  pages fetched:          ${stats.pagesFetched}`)
      console.log(`  committees cached:      ${stats.committeesCached}`)
      console.log(`  committees skipped(fresh): ${stats.committeesSkippedFresh}`)
      console.log(`  errors:                 ${stats.errors.length}`)
      for (const e of stats.errors) console.log(`    - ${e}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
