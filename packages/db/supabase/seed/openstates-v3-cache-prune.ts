import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isCliEntry, parseFlag } from './shared/cli.ts'
import { pruneStaleCache } from './openstates-v3-fetch.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates')
const DEFAULT_TTL_DAYS = 7

if (isCliEntry(import.meta.url)) {
  const cacheDir = parseFlag('cache-dir') ?? DEFAULT_CACHE_DIR
  const ttlRaw = parseFlag('ttl-days')
  const ttlDays = ttlRaw !== undefined ? Number(ttlRaw) : DEFAULT_TTL_DAYS

  if (!Number.isFinite(ttlDays) || ttlDays < 0) {
    console.error(`invalid --ttl-days value (got '${ttlRaw}'); must be a non-negative number`)
    process.exit(2)
  }
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000

  pruneStaleCache(cacheDir, ttlMs)
    .then((removed) => {
      console.log(`Pruned ${removed} stale cache file(s) older than ${ttlDays}d from ${cacheDir}`)
      process.exit(0)
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
