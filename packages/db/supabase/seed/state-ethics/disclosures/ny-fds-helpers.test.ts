import { describe, expect, it } from 'vitest'
import { parseNyFdsText } from './ny-fds-helpers.ts'

describe('parseNyFdsText', () => {
  it('returns [] for empty text', () => {
    expect(parseNyFdsText('')).toEqual([])
  })

  it('returns [] for text missing Sources/Schedule of Income header', () => {
    expect(parseNyFdsText('Some random PDF text with no recognized section')).toEqual([])
  })

  it('parses single income line item with "Sources of Income" header', () => {
    const text = `
NYS Financial Disclosure Statement 2024
Filer: Jane Doe (NYS Senate)

Sources of Income
1. Salary, State of New York: $50,000 - $100,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      income_source: expect.stringMatching(/State of New York/),
      income_kind: 'salary',
      amount_range_low: 50000,
      amount_range_high: 100000,
    })
  })

  it('parses "Schedule of Income" header variant', () => {
    const text = `
Part III. Schedule of Income
1. Consulting fees, XYZ LLC: $10,000 - $25,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.income_kind).toBe('consulting')
  })

  it('parses multiple income line items', () => {
    const text = `
Sources of Income
1. Salary, State of New York: $50,000 - $100,000
2. Consulting fees, XYZ LLC: $10,000 - $25,000
3. Rental income, 123 Main: $5,000 - $25,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.income_kind)).toEqual(['salary', 'consulting', 'rental'])
  })

  it('handles "Less than $X" amount form', () => {
    const text = `
Sources of Income
1. Minor consulting: Less than $5,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.amount_range_low).toBe(0)
    expect(items[0]?.amount_range_high).toBe(5000)
  })

  it('handles "Over $X" amount form (open-ended)', () => {
    const text = `
Sources of Income
1. Salary, State of New York: Over $250,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.amount_range_low).toBe(250000)
    expect(items[0]?.amount_range_high).toBeUndefined()
  })

  it('handles en-dash and em-dash amount separators', () => {
    const items1 = parseNyFdsText('Sources of Income\n1. Salary: $1,000–$10,000')
    const items2 = parseNyFdsText('Sources of Income\n1. Salary: $1,000—$10,000')
    expect(items1[0]?.amount_range_high).toBe(10000)
    expect(items2[0]?.amount_range_high).toBe(10000)
  })

  it('classifies dividend / interest as dividend (NY plural fix)', () => {
    const text = `
Sources of Income
1. Dividends from common stock: $5,000 - $25,000
2. Interest income, savings: $1,000 - $5,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(2)
    expect(items[0]?.income_kind).toBe('dividend')
    expect(items[1]?.income_kind).toBe('dividend')
  })

  it('classifies royalty income', () => {
    const items = parseNyFdsText('Sources of Income\n1. Royalties from book: $1,000 - $5,000')
    expect(items[0]?.income_kind).toBe('royalty')
  })

  it('falls back to "other" for unrecognized income kind', () => {
    const items = parseNyFdsText(
      'Sources of Income\n1. Lottery winnings, Dec 2024: $5,000 - $10,000',
    )
    expect(items[0]?.income_kind).toBe('other')
  })

  it('skips lines without recognizable amount range', () => {
    const text = `
Sources of Income
1. Salary, State of New York (no amount listed)
2. Consulting: $1,000 - $5,000
`
    const items = parseNyFdsText(text)
    expect(items).toHaveLength(1) // Only line 2 has a parseable range
    expect(items[0]?.income_kind).toBe('consulting')
  })
})
