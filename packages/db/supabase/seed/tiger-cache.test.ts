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
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('cache hit → returns cached bytes without calling the fetcher', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tcache-'))
    try {
      await writeFile(tigerCacheFile(URL1, dir), Buffer.from([9, 9]))
      const fetcher = vi.fn(
        async (): Promise<FetchResult> => ({ kind: 'ok', body: new ArrayBuffer(0) }),
      )
      const out = await loadTigerZip(URL1, dir, fetcher)
      expect(fetcher).not.toHaveBeenCalled()
      expect(out.fromCache).toBe(true)
      if (out.kind === 'ok') expect([...new Uint8Array(out.body)]).toEqual([9, 9])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('gap/error results are not cached', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tcache-'))
    try {
      const fetcher = vi.fn(
        async (): Promise<FetchResult> => ({ kind: 'gap', status: 404, message: 'not found' }),
      )
      const out = await loadTigerZip(URL1, dir, fetcher)
      expect(out.kind).toBe('gap')
      expect(out.fromCache).toBe(false)
      await expect(readFile(tigerCacheFile(URL1, dir))).rejects.toThrow()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
