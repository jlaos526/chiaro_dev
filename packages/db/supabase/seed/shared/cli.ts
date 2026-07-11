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

/**
 * Parse a `--name=value` CLI flag out of argv. Returns the substring after
 * the flag's first `=`, or `undefined` when the flag is absent.
 *
 * Replaces the `process.argv.find(a => a.startsWith('--name='))` +
 * `.split('=')[1]` idiom duplicated across ~12 seed/ ingest scripts.
 *
 * Semantics (matched to the code it replaces):
 * - `name` is the BARE flag name — no `--` prefix, no trailing `=`.
 *   `parseFlag('session')` matches `--session=2024` → `'2024'`.
 * - First occurrence wins (mirrors `Array.prototype.find`).
 * - A present-but-empty flag (`--session=`) returns `''` (empty string),
 *   NOT `undefined` — callers must distinguish "flag omitted" (`undefined`)
 *   from "flag given with an empty value" (`''`) exactly as the pre-helper
 *   `arg ? arg.split('=')[1] : default` idiom did (`arg` was the whole
 *   `--session=` token, which is truthy). Use `?? default` for the default
 *   branch, and `x === undefined` for presence guards.
 * - Defaults to the full `process.argv` (matching the replaced call sites,
 *   which searched the whole array; a `--name=` token never collides with
 *   argv[0]/argv[1]).
 *
 * NOTE vs `.split('=')[1]`: this returns everything after the FIRST `=`, so
 * a value that itself contains `=` is preserved intact (split truncated it).
 * No current flag carries `=` in its value, so behaviour is identical for
 * every real input.
 */
export function parseFlag(
  name: string,
  argv: readonly string[] = process.argv,
): string | undefined {
  const prefix = `--${name}=`
  const match = argv.find((a) => a.startsWith(prefix))
  return match === undefined ? undefined : match.slice(prefix.length)
}

/**
 * Returns true if the bare boolean flag `--name` is present in argv.
 *
 * Replaces the `process.argv.includes('--name')` idiom (e.g. `--instrument`,
 * `--no-apply`, `--fixture-mode`, `--skip-on-error`, `--force`,
 * `--skip-bills`, `--skip-votes`). `name` is the BARE flag name — no `--`.
 * Does NOT match a `--name=value` value flag (exact `--name` membership only,
 * matching `Array.prototype.includes`). Defaults to the full `process.argv`.
 */
export function hasFlag(name: string, argv: readonly string[] = process.argv): boolean {
  return argv.includes(`--${name}`)
}
