import { pathToFileURL } from 'node:url'

/**
 * Returns true if the calling module was invoked directly as a CLI
 * (vs imported as a library). Canonical Node.js cross-platform pattern
 * for detecting CLI entry — pass `import.meta.url` from the caller.
 *
 * Slice 30 origin (consolidates slice 28's pathToFileURL-reverse fix
 * applied to state-officials-ingest.ts). Replaces 2 broken patterns
 * found across seed/:
 *
 * 1. `file://${process.argv[1].replace(/\\/g, '/')}` — 2-slash bug:
 *    produces `file://C:/...` while import.meta.url is `file:///C:/...`.
 *    Silently no-ops on Windows. 15 files affected pre-slice-30.
 *
 * 2. `fileURLToPath(import.meta.url) === process.argv[1]` — forward
 *    direction. Works in current environments but fragile across
 *    path-separator + drive-letter case normalization.
 *
 * Usage:
 *   import { isCliEntry } from './shared/cli.ts'
 *   if (isCliEntry(import.meta.url)) {
 *     // CLI parsing + dispatch
 *   }
 *
 * Why `pathToFileURL(argv[1]).href` works cross-platform:
 *   pathToFileURL('C:\\Users\\...\\foo.ts') → 'file:///C:/Users/.../foo.ts'
 *   matches the same shape Node emits in import.meta.url. The reverse
 *   direction (fileURLToPath) is fragile because path separator and
 *   drive-letter case normalization differ across platforms.
 */
export function isCliEntry(importMetaUrl: string): boolean {
  if (!process.argv[1]) return false
  return importMetaUrl === pathToFileURL(process.argv[1]).href
}
