import { fetch } from 'undici'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasFlag, isCliEntry, parseFlag } from './shared/cli.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://v3.openstates.org/bills'
const PER_PAGE = 20
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_RETRY_ON_429 = 5
const BASE_BACKOFF_MS = 1000
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates')

type FetchLike = typeof fetch

export interface FetchOpenStatesV3Opts {
  state: string
  session: string
  cacheDir?: string
  apiKey?: string
  force?: boolean
  /** Test-only fetch injection. */
  fetcher?: FetchLike
  /** Test-only override of TTL (ms). */
  ttlMs?: number
}

export interface FetchOpenStatesV3Stats {
  state: string
  session: string
  pagesFetched: number
  billsCached: number
  billsSkippedFresh: number
  votesCached: number
  votesSkippedFresh: number
  errors: string[]
}

interface V3BillsResponse {
  results: unknown[]
  pagination: { page: number; per_page: number; max_page: number; total_items: number }
}

function isV3BillsResponse(x: unknown): x is V3BillsResponse {
  if (typeof x !== 'object' || x === null) return false
  const r = x as { results?: unknown; pagination?: unknown }
  return Array.isArray(r.results) && typeof r.pagination === 'object' && r.pagination !== null
}

function slugFilename(state: string, billId: string): string {
  const safe = billId.replace(/[^a-zA-Z0-9-]/g, '-')
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
): Promise<V3BillsResponse> {
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
    if (!isV3BillsResponse(body)) {
      throw new Error(`malformed v3 response: missing results or pagination at ${url}`)
    }
    return body
  }
  throw new Error('unreachable')
}

export async function fetchOpenStatesV3(
  opts: FetchOpenStatesV3Opts,
): Promise<FetchOpenStatesV3Stats> {
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

  const stats: FetchOpenStatesV3Stats = {
    state,
    session: opts.session,
    pagesFetched: 0,
    billsCached: 0,
    billsSkippedFresh: 0,
    votesCached: 0,
    votesSkippedFresh: 0,
    errors: [],
  }

  let page = 1
  let maxPage = 1
  do {
    const url = new URL(BASE_URL)
    url.searchParams.set('jurisdiction', jurisdiction)
    url.searchParams.set('session', opts.session)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(PER_PAGE))
    url.searchParams.set('include', 'sponsorships,subjects,actions,sources,votes')

    let body: V3BillsResponse
    try {
      body = await fetchPage(fetcher, url.toString(), apiKey)
    } catch (err) {
      stats.errors.push((err as Error).message)
      break
    }
    stats.pagesFetched += 1
    maxPage = body.pagination.max_page

    for (const bill of body.results) {
      const billId = (bill as { id?: unknown }).id
      if (typeof billId !== 'string' || !billId.startsWith('ocd-bill/')) {
        stats.errors.push(`skipped result with non-string or non-bill id`)
        continue
      }
      const file = join(cacheDir, slugFilename(state, billId))
      if (!opts.force && (await isFresh(file, ttlMs))) {
        stats.billsSkippedFresh += 1
      } else {
        await writeFile(file, JSON.stringify(bill, null, 2), 'utf8')
        stats.billsCached += 1
      }
      // Extract embedded vote events. v3 returns votes inline when include=votes;
      // each entry lacks an explicit bill_id field (parent is implicit), so we
      // inject one before writing to match the OpenStatesVoteEnvelope shape the
      // loader expects.
      const embeddedVotes = (bill as { votes?: unknown }).votes
      if (Array.isArray(embeddedVotes)) {
        for (const v of embeddedVotes) {
          const voteId = (v as { id?: unknown }).id
          if (typeof voteId !== 'string' || !voteId.startsWith('ocd-vote/')) {
            stats.errors.push(`bill ${billId}: embedded vote has non-string or non-vote id`)
            continue
          }
          const voteFile = join(cacheDir, slugFilename(state, voteId))
          if (!opts.force && (await isFresh(voteFile, ttlMs))) {
            stats.votesSkippedFresh += 1
            continue
          }
          const voteEnvelope = { ...(v as object), bill_id: billId }
          await writeFile(voteFile, JSON.stringify(voteEnvelope, null, 2), 'utf8')
          stats.votesCached += 1
        }
      }
    }
    page += 1
  } while (page <= maxPage)

  return stats
}

/**
 * Remove cache files older than ttlMs (default 7d). Useful for housekeeping.
 * Returns the count of removed files.
 */
export async function pruneStaleCache(cacheDir: string, ttlMs: number = TTL_MS): Promise<number> {
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
  const session = parseFlag('session')
  const force = hasFlag('force')
  if (state === undefined || session === undefined) {
    console.error('usage: tsx openstates-v3-fetch.ts --state=XX --session=YYYY [--force]')
    process.exit(2)
  }
  fetchOpenStatesV3({ state, session, force })
    .then((stats) => {
      console.log('OpenStates v3 fetch summary:')
      console.log(`  state:                ${stats.state}`)
      console.log(`  session:              ${stats.session}`)
      console.log(`  pages fetched:        ${stats.pagesFetched}`)
      console.log(`  bills cached:         ${stats.billsCached}`)
      console.log(`  bills skipped(fresh): ${stats.billsSkippedFresh}`)
      console.log(`  votes cached:         ${stats.votesCached}`)
      console.log(`  votes skipped(fresh): ${stats.votesSkippedFresh}`)
      console.log(`  errors:               ${stats.errors.length}`)
      for (const e of stats.errors) console.log(`    - ${e}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
