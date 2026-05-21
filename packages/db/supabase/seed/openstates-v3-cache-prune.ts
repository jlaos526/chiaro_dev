import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pruneStaleCache } from './openstates-v3-fetch.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates')
const DEFAULT_TTL_DAYS = 7

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const cacheDirArg = process.argv.find(a => a.startsWith('--cache-dir='))
  const ttlArg      = process.argv.find(a => a.startsWith('--ttl-days='))
  const cacheDir    = cacheDirArg ? cacheDirArg.split('=')[1]! : DEFAULT_CACHE_DIR
  const ttlDays     = ttlArg      ? Number(ttlArg.split('=')[1]) : DEFAULT_TTL_DAYS

  if (!Number.isFinite(ttlDays) || ttlDays < 0) {
    console.error(`invalid --ttl-days value (got '${ttlArg}'); must be a non-negative number`)
    process.exit(2)
  }
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000

  pruneStaleCache(cacheDir, ttlMs)
    .then(removed => {
      console.log(`Pruned ${removed} stale cache file(s) older than ${ttlDays}d from ${cacheDir}`)
      process.exit(0)
    })
    .catch(err => {
      console.error(err.message)
      process.exit(1)
    })
}
