/**
 * Re-export shim — `groupOfficialsByLevel` + `OfficialsByLevel` now live in
 * `@chiaro/officials/derivations`. This file kept for backwards compat with
 * existing imports (`@/lib/derivations/officials-by-level`); new consumers
 * should import from `@chiaro/officials` directly.
 */
export { groupOfficialsByLevel, type OfficialsByLevel } from '@chiaro/officials'
