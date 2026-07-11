import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, rm, writeFile, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  fetchOpenStatesCommittees,
  pruneStaleCommitteesCache,
} from './openstates-committees-fetch.ts'

function mkCommittee(suffix: string) {
  return {
    id: `ocd-committee/00000000-0000-0000-0000-${suffix}`,
    name: `Test Committee ${suffix}`,
    jurisdiction: {
      id: 'ocd-jurisdiction/country:us/state:ca/government',
      classification: 'state',
    },
    chamber: 'lower',
    memberships: [],
    sources: [{ url: 'https://x' }],
  }
}

function mkResponse(results: object[], page: number, maxPage: number): Response {
  return new Response(
    JSON.stringify({
      results,
      pagination: { page, per_page: 20, max_page: maxPage, total_items: results.length },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

let cacheDir: string

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'openstates-committees-cache-'))
})

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('fetchOpenStatesCommittees', () => {
  it('happy path: single page of 2 committees writes 2 cache files', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(mkResponse([mkCommittee('001'), mkCommittee('002')], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA',
      cacheDir,
      apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.pagesFetched).toBe(1)
    expect(stats.committeesCached).toBe(2)
    expect(stats.errors).toEqual([])
    const files = (await readdir(cacheDir)).filter((f) => f.endsWith('.json'))
    expect(files).toHaveLength(2)
  })

  it('paginates: 2 pages of 1 committee each writes 2 files', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(mkResponse([mkCommittee('001')], 1, 2))
      .mockResolvedValueOnce(mkResponse([mkCommittee('002')], 2, 2))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA',
      cacheDir,
      apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.pagesFetched).toBe(2)
    expect(stats.committeesCached).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('TTL skip: fresh existing file is not re-fetched', async () => {
    const cmt = mkCommittee('001')
    const file = join(cacheDir, `CA-${cmt.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([cmt], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA',
      cacheDir,
      apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(0)
    expect(stats.committeesSkippedFresh).toBe(1)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk).toEqual({ stale: 'old data' })
  })

  it('TTL expiry: stale file is re-fetched', async () => {
    const cmt = mkCommittee('001')
    const file = join(cacheDir, `CA-${cmt.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(file, eightDaysAgo, eightDaysAgo)
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([cmt], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA',
      cacheDir,
      apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(1)
    expect(stats.committeesSkippedFresh).toBe(0)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk.id).toBe(cmt.id)
  })

  it('--force bypasses TTL', async () => {
    const cmt = mkCommittee('001')
    const file = join(cacheDir, `CA-${cmt.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([cmt], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA',
      cacheDir,
      apiKey: 'test',
      force: true,
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(1)
    expect(stats.committeesSkippedFresh).toBe(0)
  })

  it('429 retries then succeeds', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      Promise.resolve().then(fn)
      return 0 as never
    }) as never)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(mkResponse([mkCommittee('001')], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA',
      cacheDir,
      apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('missing api key throws', async () => {
    await expect(
      fetchOpenStatesCommittees({
        state: 'CA',
        cacheDir,
        fetcher: vi.fn() as never,
      }),
    ).rejects.toThrow(/OPENSTATES_API_KEY/)
  })

  it('pruneStaleCommitteesCache removes stale files', async () => {
    const stale = join(cacheDir, 'CA-stale.json')
    const fresh = join(cacheDir, 'CA-fresh.json')
    await writeFile(stale, '{}', 'utf8')
    await writeFile(fresh, '{}', 'utf8')
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(stale, eightDaysAgo, eightDaysAgo)
    const removed = await pruneStaleCommitteesCache(cacheDir)
    expect(removed).toBe(1)
    const remaining = await readdir(cacheDir)
    expect(remaining).toEqual(['CA-fresh.json'])
  })
})
