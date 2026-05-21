import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, rm, writeFile, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fetchOpenStatesV3, pruneStaleCache } from './openstates-v3-fetch.ts'

function mkBill(suffix: string, extra: object = {}) {
  return {
    id: `ocd-bill/00000000-0000-0000-0000-${suffix}`,
    jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
    session: '20252026',
    identifier: `AB ${parseInt(suffix.slice(-3), 16)}`,
    title: `Test ${suffix}`,
    sources: [{ url: 'https://x' }],
    openstates_url: 'https://y',
    ...extra,
  }
}

function mkEmbeddedVote(suffix: string) {
  return {
    id: `ocd-vote/00000000-0000-0000-0000-${suffix}`,
    motion_text: `Motion ${suffix}`,
    result: 'passed',
    start_date: '2025-03-01',
    organization: { classification: 'lower' },
    votes: [{ voter_name: 'X', voter_id: 'ocd-person/1', option: 'yes' }],
    sources: [{ url: 'https://v' }],
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

  it('extracts embedded votes and writes them as separate envelopes with injected bill_id', async () => {
    const bill = mkBill('001', { votes: [mkEmbeddedVote('v01'), mkEmbeddedVote('v02')] })
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(stats.votesCached).toBe(2)
    expect(stats.errors).toEqual([])

    const files = (await readdir(cacheDir)).filter(f => f.endsWith('.json'))
    expect(files).toHaveLength(3)  // 1 bill + 2 votes

    const voteFile = files.find(f => f.includes('ocd-vote-00000000-0000-0000-0000-v01'))!
    const voteEnvelope = JSON.parse(await readFile(join(cacheDir, voteFile), 'utf8'))
    expect(voteEnvelope.bill_id).toBe(bill.id)
    expect(voteEnvelope.id).toBe('ocd-vote/00000000-0000-0000-0000-v01')
    expect(voteEnvelope.motion_text).toBe('Motion v01')
    expect(voteEnvelope.organization.classification).toBe('lower')
  })

  it('bill with empty votes array: only bill cached, no vote files', async () => {
    const bill = mkBill('001', { votes: [] })
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(stats.votesCached).toBe(0)
    const files = (await readdir(cacheDir)).filter(f => f.endsWith('.json'))
    expect(files).toHaveLength(1)
  })

  it('bill missing votes field: graceful skip, no vote files', async () => {
    const bill = mkBill('001')  // no votes field at all
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(stats.votesCached).toBe(0)
    expect(stats.errors).toEqual([])
  })

  it('embedded vote missing id is logged + skipped', async () => {
    const bill = mkBill('001', {
      votes: [
        mkEmbeddedVote('vok'),
        { motion_text: 'orphan vote, no id' },
      ],
    })
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.billsCached).toBe(1)
    expect(stats.votesCached).toBe(1)
    expect(stats.errors).toHaveLength(1)
    expect(stats.errors[0]).toMatch(/embedded vote has non-string or non-vote id/)
  })

  it('vote TTL skip: fresh vote file not re-written', async () => {
    const bill = mkBill('001', { votes: [mkEmbeddedVote('v01')] })
    const voteId = 'ocd-vote/00000000-0000-0000-0000-v01'
    const voteSlug = voteId.replace(/[^a-zA-Z0-9-]/g, '-')
    const voteFile = join(cacheDir, `CA-${voteSlug}.json`)
    await writeFile(voteFile, JSON.stringify({ stale: 'preserved' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.votesCached).toBe(0)
    expect(stats.votesSkippedFresh).toBe(1)
    const onDisk = JSON.parse(await readFile(voteFile, 'utf8'))
    expect(onDisk).toEqual({ stale: 'preserved' })
  })

  it('--force re-fetches votes too', async () => {
    const bill = mkBill('001', { votes: [mkEmbeddedVote('v01')] })
    const voteId = 'ocd-vote/00000000-0000-0000-0000-v01'
    const voteSlug = voteId.replace(/[^a-zA-Z0-9-]/g, '-')
    const voteFile = join(cacheDir, `CA-${voteSlug}.json`)
    await writeFile(voteFile, JSON.stringify({ stale: 'old' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([bill], 1, 1))
    const stats = await fetchOpenStatesV3({
      state: 'CA', session: '20252026',
      cacheDir, apiKey: 'test', force: true,
      fetcher: fetcher as never,
    })
    expect(stats.votesCached).toBe(1)
    const onDisk = JSON.parse(await readFile(voteFile, 'utf8'))
    expect(onDisk.id).toBe(voteId)
    expect(onDisk.bill_id).toBe(bill.id)
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
