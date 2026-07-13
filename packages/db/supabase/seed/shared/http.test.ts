import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedUrlFile, fetchCacheDir, fetchWithRetry, loadCachedUrl } from './http.ts'

const URL1 = 'https://example.com/things/2024.zip'

const okResponse = (bytes: number[] = [1, 2, 3]) => new Response(new Uint8Array(bytes))
const statusResponse = (status: number) => new Response('x', { status })

/** All retry tests pass backoffMs: 0 so exhaustion paths don't sleep. */
const fast = { backoffMs: 0 }

describe('fetchWithRetry', () => {
  it('returns the first success without retrying', async () => {
    const fetcher = vi.fn(async () => okResponse())
    const res = await fetchWithRetry(URL1, { ...fast, fetcher: fetcher as unknown as typeof fetch })
    expect(res.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('retries a 500 then returns the eventual 200', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(500))
      .mockResolvedValueOnce(okResponse())
    const res = await fetchWithRetry(URL1, { ...fast, fetcher: fetcher as unknown as typeof fetch })
    expect(res.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('retries a 429 then returns the eventual 200', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(okResponse())
    const res = await fetchWithRetry(URL1, { ...fast, fetcher: fetcher as unknown as typeof fetch })
    expect(res.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a non-retryable 4xx — the 404 response is returned as-is', async () => {
    const fetcher = vi.fn(async () => statusResponse(404))
    const res = await fetchWithRetry(URL1, { ...fast, fetcher: fetcher as unknown as typeof fetch })
    expect(res.status).toBe(404)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('retries thrown fetch errors (network / timeout)', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(okResponse())
    const res = await fetchWithRetry(URL1, { ...fast, fetcher: fetcher as unknown as typeof fetch })
    expect(res.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('returns the LAST retryable response when retries exhaust on 5xx', async () => {
    const fetcher = vi.fn(async () => statusResponse(503))
    const res = await fetchWithRetry(URL1, {
      ...fast,
      retries: 2,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(res.status).toBe(503)
    expect(fetcher).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('throws the last error when every attempt throws', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('conn reset'))
    await expect(
      fetchWithRetry(URL1, { ...fast, retries: 1, fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('conn reset')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('sets a per-attempt timeout signal when init has none', async () => {
    let observedSignal: AbortSignal | null | undefined
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      observedSignal = init?.signal
      return okResponse()
    })
    await fetchWithRetry(URL1, {
      ...fast,
      timeoutMs: 5000,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(observedSignal).toBeInstanceOf(AbortSignal)
  })

  it('respects a caller-provided init.signal (no timeout override)', async () => {
    const ctrl = new AbortController()
    let observedSignal: AbortSignal | null | undefined
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      observedSignal = init?.signal
      return okResponse()
    })
    await fetchWithRetry(URL1, {
      ...fast,
      init: { signal: ctrl.signal },
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(observedSignal).toBe(ctrl.signal)
  })
})

describe('cachedUrlFile', () => {
  it('derives an extension-less sha1(url) filename inside cacheDir', () => {
    const file = cachedUrlFile(URL1, '/cache')
    expect(basename(file)).toMatch(/^[0-9a-f]{40}$/)
    expect(file).toBe(join('/cache', basename(file)))
    // Deterministic: same url → same file
    expect(cachedUrlFile(URL1, '/cache')).toBe(file)
  })
})

describe('loadCachedUrl', () => {
  let dir: string | undefined

  afterEach(async () => {
    delete process.env.CHIARO_NO_FETCH_CACHE
    delete process.env.CHIARO_FETCH_CACHE_DIR
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('cache miss → fetches + writes the entry', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    const fetcher = vi.fn(async () => okResponse([7, 8]))
    const buf = await loadCachedUrl(URL1, {
      ...fast,
      cacheDir: dir,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect([...buf]).toEqual([7, 8])
    expect(fetcher).toHaveBeenCalledTimes(1)
    const onDisk = await readFile(cachedUrlFile(URL1, dir))
    expect([...onDisk]).toEqual([7, 8])
  })

  it('cache hit → returns disk bytes without calling the fetcher', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    await writeFile(cachedUrlFile(URL1, dir), Buffer.from([9, 9]))
    const fetcher = vi.fn(async () => okResponse([1]))
    const buf = await loadCachedUrl(URL1, {
      ...fast,
      cacheDir: dir,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect([...buf]).toEqual([9, 9])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('corrupt zero-byte entry → evicted + refetched once', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    await writeFile(cachedUrlFile(URL1, dir), Buffer.alloc(0))
    const fetcher = vi.fn(async () => okResponse([5]))
    const buf = await loadCachedUrl(URL1, {
      ...fast,
      cacheDir: dir,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect([...buf]).toEqual([5])
    expect(fetcher).toHaveBeenCalledTimes(1)
    const onDisk = await readFile(cachedUrlFile(URL1, dir))
    expect([...onDisk]).toEqual([5])
  })

  it('non-ok response → throws and caches nothing', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    const fetcher = vi.fn(async () => statusResponse(404))
    await expect(
      loadCachedUrl(URL1, { ...fast, cacheDir: dir, fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(`fetch ${URL1} failed: 404`)
    await expect(readFile(cachedUrlFile(URL1, dir))).rejects.toThrow()
  })

  it('retries transient failures through fetchWithRetry before caching', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(500))
      .mockResolvedValueOnce(okResponse([4]))
    const buf = await loadCachedUrl(URL1, {
      ...fast,
      cacheDir: dir,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect([...buf]).toEqual([4])
    expect(fetcher).toHaveBeenCalledTimes(2)
    const onDisk = await readFile(cachedUrlFile(URL1, dir))
    expect([...onDisk]).toEqual([4])
  })

  it('CHIARO_NO_FETCH_CACHE=1 bypasses both the read and the write', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    process.env.CHIARO_NO_FETCH_CACHE = '1'
    await writeFile(cachedUrlFile(URL1, dir), Buffer.from([9]))
    const fetcher = vi.fn(async () => okResponse([1]))
    const buf = await loadCachedUrl(URL1, {
      ...fast,
      cacheDir: dir,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect([...buf]).toEqual([1]) // fetched, not the stale cache entry
    expect(fetcher).toHaveBeenCalledTimes(1)
    const onDisk = await readFile(cachedUrlFile(URL1, dir))
    expect([...onDisk]).toEqual([9]) // untouched — nothing written
  })

  it('CHIARO_FETCH_CACHE_DIR env overrides the default cache dir', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chiaro-http-'))
    process.env.CHIARO_FETCH_CACHE_DIR = dir
    expect(fetchCacheDir()).toBe(dir)
    const fetcher = vi.fn(async () => okResponse([2]))
    const buf = await loadCachedUrl(URL1, { ...fast, fetcher: fetcher as unknown as typeof fetch })
    expect([...buf]).toEqual([2])
    const onDisk = await readFile(cachedUrlFile(URL1, dir))
    expect([...onDisk]).toEqual([2])
  })
})
