/**
 * SkipReason — discriminated union capturing the moment an adapter
 * silently skips a record. Adapters call `opts.onSkip?.(reason)` at
 * each silent-continue site so an instrumentation run can attribute
 * skips to a stage + adapter + legislator.
 *
 * Slice 22 helper. Consumers: per-chamber district_offices parsers
 * (slice 18 fetchPerMemberOffices), MI PFD (slice 19), NY FDS line-
 * item fill (slice 20), TX TEC combined parser (slice 16 + 20).
 */
export interface SkipReason {
  /** Adapter slug, e.g. 'mi-board' or 'fl-doe'. */
  adapter: string
  /**
   * Which stage of the per-record flow failed:
   *   - 'derive_url'   — URL builder returned empty (e.g. single-name legislator)
   *   - 'fetch'        — HTTP failure: network, timeout, non-2xx response
   *   - 'extract'      — PDF/HTML text extraction returned empty
   *   - 'parse'        — text extracted but parser found no recognized items
   *   - 'resolve'      — legislator name didn't match officials table
   *   - 'resolve_ambiguous' — name matched >1 in-office official; attribution
   *                     would be arbitrary, so the row is dropped (audit G3)
   *   - 'filter'       — row didn't match LEGISLATOR_AGENCY_RE / chamber filter
   */
  stage: 'derive_url' | 'fetch' | 'extract' | 'parse' | 'resolve' | 'resolve_ambiguous' | 'filter'
  /** Optional legislator full_name or order_number identifier for the skip. */
  legislator?: string
  /** One-line human-readable reason; goes in summary output. */
  reason: string
  /** Optional structured detail (e.g. URL, error message). For debug. */
  detail?: string
}

/**
 * SkipSummary — aggregated per-adapter rollup printed by formatSkipSummary
 * at the end of an --instrument run.
 */
export interface SkipSummary {
  byAdapter: Map<string, {
    byStage: Map<SkipReason['stage'], number>
    samples: SkipReason[]
    total: number
  }>
  grandTotal: number
}

/** Maximum sample skips retained per adapter (memory bound for stdout output). */
const MAX_SAMPLES_PER_ADAPTER = 5

/**
 * createSkipCollector — returns an `onSkip` callback to pass to adapter
 * opts + a `summary()` method to retrieve aggregated stats at the end
 * of an --instrument run.
 *
 * Usage:
 *   const { onSkip, summary } = createSkipCollector()
 *   await adapter.fetchEvents({ client, onSkip })
 *   console.log(formatSkipSummary(summary()))
 */
export function createSkipCollector(): {
  onSkip: (reason: SkipReason) => void
  summary: () => SkipSummary
} {
  const byAdapter = new Map<string, {
    byStage: Map<SkipReason['stage'], number>
    samples: SkipReason[]
    total: number
  }>()
  let grandTotal = 0

  return {
    onSkip(reason) {
      grandTotal += 1
      let entry = byAdapter.get(reason.adapter)
      if (!entry) {
        entry = { byStage: new Map(), samples: [], total: 0 }
        byAdapter.set(reason.adapter, entry)
      }
      entry.total += 1
      entry.byStage.set(reason.stage, (entry.byStage.get(reason.stage) ?? 0) + 1)
      if (entry.samples.length < MAX_SAMPLES_PER_ADAPTER) {
        entry.samples.push(reason)
      }
    },
    summary() {
      return { byAdapter, grandTotal }
    },
  }
}

/**
 * formatSkipSummary — render a SkipSummary to a human-readable
 * multi-line string for CLI/stdout output during an --instrument run.
 */
export function formatSkipSummary(s: SkipSummary): string {
  if (s.grandTotal === 0) return 'No skips recorded.'
  const lines: string[] = []
  lines.push(`Skip summary (${s.grandTotal} skips across ${s.byAdapter.size} adapters)`)
  lines.push('─'.repeat(40))

  const sortedAdapters = Array.from(s.byAdapter.entries())
    .sort(([, a], [, b]) => b.total - a.total)

  for (const [adapter, entry] of sortedAdapters) {
    lines.push(`[${adapter}]    ${entry.total} skips`)
    const sortedStages = Array.from(entry.byStage.entries())
      .sort(([, a], [, b]) => b - a)
    for (const [stage, count] of sortedStages) {
      const sample = entry.samples.find(s => s.stage === stage)
      const sampleStr = sample
        ? `(e.g. ${sample.legislator ? `${sample.legislator}: ` : ''}${sample.reason})`
        : ''
      lines.push(`  ${stage.padEnd(11)} ${String(count).padStart(3)}  ${sampleStr}`)
    }
  }

  return lines.join('\n')
}
