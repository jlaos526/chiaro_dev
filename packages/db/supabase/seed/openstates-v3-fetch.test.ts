import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, rm, writeFile, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fetchOpenStatesV3, pruneStaleCache } from './openstates-v3-fetch.ts'

function mkBill(suffix: string) {
  return {
    id: `ocd-bill/00000000-0000-0000-0000-${suffix}`,
    jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
    session: '20252026',
    identifier: `AB ${parseInt(suffix.slice(-3), 16)}`,
    title: `Test ${suffix}`,
    sources: [{ url: 'https://x' }],
    openstates_url: 'https://y',
  }
}

function mkResponse(results: object[], page: number, maxPage: number): Response {
  return new Response(JSON.stringify({
    results,
    pagination: { page, per_page: 20, max_page: maxPage, total_items: results.length },
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

let cacheDir: string

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'openstates-cache-'))
})

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('fetchOpenStatesV3', () => {
  it('happy path: single page of 2 bills writes 2 cache files', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([mkBill('001'), mkBill('002')], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.pagesFetched).toBe(1)
    expect(stats.billsCached).toBe(2)
    expect(stats.billsSkippedFresh).toBe(0)
    expect(stats.errors).toEqual([])
    const files = (await readdir(cacheDir)).filter(f => f.endsWith('.json'))
    expect(files).toHaveLength(2)
  })

  it('paginates: 2 pages of 1 bill each writes 2 files', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(mkResponse([mkBill('001')], 1, 2))
      .mockResolvedValueOnce(mkResponse([mkBill('002')], 2, 2))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.pagesFetched).toBe(2)
    expect(stats.billsCached).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('TTL skip: fresh existing file is not re-fetched', async () => {
    const bill = mkBill('001')
    const file = join(cacheDir, `CA-${bill.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(0)
    expect(stats.billsSkippedFresh).toBe(1)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk).toEqual({ stale: 'old data' })
  })

  it('TTL expiry: stale file is re-fetched', async () => {
    const bill = mkBill('001')
    const file = join(cacheDir, `CA-${bill.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(file, eightDaysAgo, eightDaysAgo)
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(stats.billsSkippedFresh).toBe(0)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk.id).toBe(bill.id)
  })

  it('--force bypasses TTL: fresh file is re-fetched', async () => {
    const bill = mkBill('001')
    const file = join(cacheDir, `CA-${bill.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test', force: true,
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(stats.billsSkippedFresh).toBe(0)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk.id).toBe(bill.id)
  })

  it('429 retries then succeeds', async () => {
    // Collapse the 429 backoff sleeps to zero so the test doesn't wait seconds.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      Promise.resolve().then(fn)
      return 0 as never
    }) as never)
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(mkResponse([mkBill('001')], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('missing api key throws', async () => {
    await expect(fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir,
      fetcher: vi.fn() as never,
    })).rejects.toThrow(/OPENSTATES_API_KEY/)
  })
})

describe('pruneStaleCache', () => {
  it('removes files older than ttl, keeps fresh ones', async () => {
    const stale = join(cacheDir, 'CA-stale.json')
    const fresh = join(cacheDir, 'CA-fresh.json')
    await writeFile(stale, '{}', 'utf8')
    await writeFile(fresh, '{}', 'utf8')
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(stale, eightDaysAgo, eightDaysAgo)
    const removed = await pruneStaleCache(cacheDir)
    expect(removed).toBe(1)
    const remaining = await readdir(cacheDir)
    expect(remaining).toEqual(['CA-fresh.json'])
  })

  it('returns 0 for missing cache dir', async () => {
    const removed = await pruneStaleCache(join(cacheDir, 'does-not-exist'))
    expect(removed).toBe(0)
  })
})
