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
