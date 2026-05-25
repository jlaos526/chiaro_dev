import { describe, expect, it } from 'vitest'
import {
  createSkipCollector,
  formatSkipSummary,
  type SkipReason,
  type SkipSummary,
} from './instrumentation.ts'

describe('createSkipCollector', () => {
  it('returns onSkip + summary functions', () => {
    const collector = createSkipCollector()
    expect(typeof collector.onSkip).toBe('function')
    expect(typeof collector.summary).toBe('function')
  })

  it('aggregates skips by adapter + stage', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'fetch', reason: '404' })
    onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'timeout' })
    onSkip({ adapter: 'mi-board', stage: 'parse', reason: 'no items' })
    onSkip({ adapter: 'ny-jcope', stage: 'resolve', reason: 'unknown' })

    const s = summary()
    expect(s.grandTotal).toBe(4)
    expect(s.byAdapter.size).toBe(2)
    expect(s.byAdapter.get('mi-board')!.total).toBe(3)
    expect(s.byAdapter.get('mi-board')!.byStage.get('fetch')).toBe(2)
    expect(s.byAdapter.get('mi-board')!.byStage.get('parse')).toBe(1)
    expect(s.byAdapter.get('ny-jcope')!.total).toBe(1)
  })

  it('caps samples at MAX_SAMPLES_PER_ADAPTER (5)', () => {
    const { onSkip, summary } = createSkipCollector()
    for (let i = 0; i < 10; i += 1) {
      onSkip({ adapter: 'mi-board', stage: 'fetch', reason: `failure ${i}` })
    }
    const entry = summary().byAdapter.get('mi-board')!
    expect(entry.total).toBe(10)
    expect(entry.samples.length).toBe(5)
  })

  it('records grandTotal accurately', () => {
    const { onSkip, summary } = createSkipCollector()
    expect(summary().grandTotal).toBe(0)
    onSkip({ adapter: 'x', stage: 'fetch', reason: 'r' })
    expect(summary().grandTotal).toBe(1)
  })

  it('preserves legislator + detail in samples', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({
      adapter: 'mi-board',
      stage: 'fetch',
      legislator: 'Jane Doe',
      reason: '404',
      detail: 'https://example.com/jane.pdf',
    })
    const sample = summary().byAdapter.get('mi-board')!.samples[0]!
    expect(sample.legislator).toBe('Jane Doe')
    expect(sample.detail).toBe('https://example.com/jane.pdf')
  })
})

describe('formatSkipSummary', () => {
  it('returns "No skips recorded." for empty summary', () => {
    const s = createSkipCollector().summary()
    expect(formatSkipSummary(s)).toBe('No skips recorded.')
  })

  it('renders header with total + adapter counts', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'r' })
    onSkip({ adapter: 'ny-jcope', stage: 'resolve', reason: 'r' })
    const out = formatSkipSummary(summary())
    expect(out).toContain('Skip summary (2 skips across 2 adapters)')
  })

  it('sorts adapters by total skip count descending', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'low', stage: 'fetch', reason: 'r' })
    for (let i = 0; i < 5; i += 1) {
      onSkip({ adapter: 'high', stage: 'fetch', reason: 'r' })
    }
    const out = formatSkipSummary(summary())
    const highIdx = out.indexOf('[high]')
    const lowIdx = out.indexOf('[low]')
    expect(highIdx).toBeLessThan(lowIdx)
  })

  it('sorts stages within an adapter by count descending', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'parse', reason: 'r' })
    for (let i = 0; i < 3; i += 1) {
      onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'r' })
    }
    const out = formatSkipSummary(summary())
    const fetchIdx = out.indexOf('  fetch')
    const parseIdx = out.indexOf('  parse')
    expect(fetchIdx).toBeLessThan(parseIdx)
  })

  it('includes sample legislator + reason in stage line', () => {
    const { onSkip, summary } = createSkipCollector()
    onSkip({ adapter: 'mi-board', stage: 'fetch', legislator: 'Jane Doe', reason: '404 from URL' })
    const out = formatSkipSummary(summary())
    expect(out).toMatch(/Jane Doe/)
    expect(out).toMatch(/404 from URL/)
  })

  it('includes stage count', () => {
    const { onSkip, summary } = createSkipCollector()
    for (let i = 0; i < 7; i += 1) {
      onSkip({ adapter: 'mi-board', stage: 'fetch', reason: 'r' })
    }
    const out = formatSkipSummary(summary())
    expect(out).toMatch(/fetch\s+7/)
  })
})

// Type-only smoke check: ensure SkipSummary export is consumable.
const _typeCheck: SkipSummary | null = null
void _typeCheck
const _reasonTypeCheck: SkipReason | null = null
void _reasonTypeCheck
