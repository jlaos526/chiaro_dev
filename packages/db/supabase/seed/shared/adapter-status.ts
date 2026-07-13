/**
 * Adapter lifecycle status (audit C35, slice 81).
 *
 * - 'production': a real parser is wired — 0 rows means the source had
 *   nothing (or drifted; triage with --instrument).
 * - 'stub': defaultFetcher returns [] pending operator wiring — 0 rows
 *   BY DESIGN, not coverage.
 * - 'deprecated': wrong-premise or dead source kept registered for
 *   back-compat (marked with @deprecated JSDoc on the adapter file) —
 *   0 rows BY DESIGN.
 */
export type AdapterStatus = 'production' | 'stub' | 'deprecated'

/** All valid statuses — handy for registry-annotation assertions in tests. */
export const ADAPTER_STATUSES: readonly AdapterStatus[] = ['production', 'stub', 'deprecated']

export interface AdapterStatusEntry {
  /** Display label, e.g. 'offices:tx-capitol' (community/ethics) or a bare org slug (scorecards). */
  label: string
  status: AdapterStatus
}

/**
 * End-of-run summary block making stub/deprecated adapters visible
 * (audit C35): a "green" orchestrator run can otherwise hide that a
 * source is a stub returning 0 rows. Line 1 is the count rollup;
 * line 2 (when any exist) names the stub + deprecated adapters so
 * their zero-row output can't be mistaken for healthy coverage.
 */
export function formatAdapterStatusSummary(entries: AdapterStatusEntry[]): string {
  const count = (status: AdapterStatus) => entries.filter((e) => e.status === status).length
  const lines = [
    `[adapters] production ${count('production')} · stub ${count('stub')} · deprecated ${count(
      'deprecated',
    )} — stub/deprecated adapters return 0 rows BY DESIGN (audit C35)`,
  ]
  const stubs = entries.filter((e) => e.status === 'stub').map((e) => e.label)
  const deprecated = entries.filter((e) => e.status === 'deprecated').map((e) => e.label)
  const segments: string[] = []
  if (stubs.length > 0) segments.push(`stub: ${stubs.join(', ')}`)
  if (deprecated.length > 0) segments.push(`deprecated: ${deprecated.join(', ')}`)
  if (segments.length > 0) lines.push(`[adapters] ${segments.join(' · ')}`)
  return lines.join('\n')
}
