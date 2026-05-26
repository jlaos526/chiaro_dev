import { describe, expect, it } from 'vitest'
import {
  classifyAmountRange,
  classifyAssetType,
  classifyTransactionType,
  parseFdText,
  parsePtrText,
} from './pdf-parsers.ts'

describe('classifyAmountRange', () => {
  it('parses standard range', () => {
    expect(classifyAmountRange('$1,001 - $15,000')).toEqual({ min: 1001, max: 15000, text: '$1,001 - $15,000' })
  })
  it('parses "Over $X" form', () => {
    expect(classifyAmountRange('Over $50,000,000')).toEqual({ min: 50000000, text: 'Over $50,000,000' })
  })
  it('parses "Less than $X" form', () => {
    expect(classifyAmountRange('Less than $200')).toEqual({ max: 200, text: 'Less than $200' })
  })
  it('returns text-only when no match', () => {
    expect(classifyAmountRange('Variable')).toEqual({ text: 'Variable' })
  })
})

describe('classifyTransactionType', () => {
  it('maps P → purchase', () => { expect(classifyTransactionType('P')).toBe('purchase') })
  it('maps S → sale',     () => { expect(classifyTransactionType('S')).toBe('sale') })
  it('maps D → sale (disposition variant)', () => { expect(classifyTransactionType('D')).toBe('sale') })
  it('maps E → exchange', () => { expect(classifyTransactionType('E')).toBe('exchange') })
  it('returns null for unknown', () => { expect(classifyTransactionType('XY')).toBeNull() })
})

describe('classifyAssetType', () => {
  it('maps ST → stock',       () => { expect(classifyAssetType('ST')).toBe('stock') })
  it('maps MF → mutual_fund', () => { expect(classifyAssetType('MF')).toBe('mutual_fund') })
  it('returns other for unknown', () => { expect(classifyAssetType('ZZ')).toBe('other') })
  it('returns other for undefined', () => { expect(classifyAssetType()).toBe('other') })
})

describe('parsePtrText', () => {
  it('emits trade rows from mock PTR text', () => {
    const mock = `
Schedule of Transactions
01/05/2025 01/19/2025 P AAPL Apple Inc. $1,001 - $15,000
01/12/2025 01/26/2025 S MSFT Microsoft Corp $15,001 - $50,000
`
    const { trades } = parsePtrText(mock, { filing_year: 2025, source_url: 'https://example/test.pdf' })
    expect(trades.length).toBe(2)
    expect(trades[0]).toMatchObject({
      transaction_type: 'purchase', asset_ticker: 'AAPL', amount_range_low: 1001, amount_range_high: 15000,
    })
    expect(trades[1]!.transaction_type).toBe('sale')
  })
  it('skips lines that do not match the row regex', () => {
    const mock = 'random unrelated text\nSchedule of Transactions\nmalformed line\n'
    const { trades } = parsePtrText(mock, { filing_year: 2025, source_url: 'x' })
    expect(trades.length).toBe(0)
  })
})

describe('parseFdText', () => {
  it('returns empty arrays when no schedules found', () => {
    const { holdings, other } = parseFdText('no schedules here', { filing_year: 2024, source_url: 'x' })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
  })
  // Per-schedule tests added once parseScheduleA/C/H/I are implemented at scaffold.
})
