import { describe, expect, it } from 'vitest'
import { deriveMiPfdUrl, parseMiPfdText, classifyIncomeKind } from './mi-pfd-helpers.ts'

describe('deriveMiPfdUrl', () => {
  it('builds the audit-derived URL pattern from full_name + year', () => {
    const url = deriveMiPfdUrl({ full_name: 'Jane Doe' }, 2024)
    expect(url).toMatch(/michigan\.gov.*Doe-Jane.*PFDDR.*2024\.pdf$/)
  })

  it('handles multi-word first names ("Mary Jo Smith" → "Smith-Mary")', () => {
    // Audit pattern is Lastname-Firstname; first word treated as firstname,
    // last word as lastname (collapses middle names).
    const url = deriveMiPfdUrl({ full_name: 'Mary Jo Smith' }, 2024)
    expect(url).toContain('Smith-Mary')
  })

  it('returns empty string for single-name legislators (silent skip downstream)', () => {
    expect(deriveMiPfdUrl({ full_name: 'Singleton' }, 2024)).toBe('')
  })

  it('handles accented characters via normalize-NFD (audit lesson)', () => {
    const url = deriveMiPfdUrl({ full_name: 'José Smith' }, 2024)
    expect(url).toContain('Smith-Jose')
  })
})

describe('classifyIncomeKind', () => {
  it('matches salary keywords', () => {
    expect(classifyIncomeKind('Salary from State of Michigan')).toBe('salary')
    expect(classifyIncomeKind('Wages, hourly')).toBe('salary')
    expect(classifyIncomeKind('Compensation for services')).toBe('salary')
  })

  it('matches consulting', () => {
    expect(classifyIncomeKind('Consulting fees from XYZ LLC')).toBe('consulting')
    expect(classifyIncomeKind('Advisory board honorarium')).toBe('consulting')
  })

  it('matches royalty', () => {
    expect(classifyIncomeKind('Royalties from book publication')).toBe('royalty')
  })

  it('matches rental', () => {
    expect(classifyIncomeKind('Rental income from 123 Main')).toBe('rental')
    expect(classifyIncomeKind('Rent income, residential property')).toBe('rental')
  })

  it('matches dividend / interest', () => {
    expect(classifyIncomeKind('Dividends from common stock')).toBe('dividend')
    expect(classifyIncomeKind('Interest income, savings account')).toBe('dividend')
  })

  it('falls back to "other" for unknown', () => {
    expect(classifyIncomeKind('Lottery winnings, December 2024')).toBe('other')
  })
})

describe('parseMiPfdText', () => {
  it('returns empty array for empty text', () => {
    expect(parseMiPfdText('')).toEqual([])
  })

  it('returns empty array for garbage text', () => {
    expect(parseMiPfdText('completely unrelated nonsense')).toEqual([])
  })

  it('extracts one line item with salary + dollar range', () => {
    const text = `
Personal Financial Disclosure 2024
Filer: Jane Doe

Sources of Income
1. Salary from State of Michigan: $50,000 - $100,000
`
    const items = parseMiPfdText(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      income_source: expect.stringContaining('State of Michigan'),
      income_kind: 'salary',
      amount_range_low: 50000,
      amount_range_high: 100000,
    })
  })

  it('extracts multiple line items (one per income source)', () => {
    const text = `
Sources of Income
1. Salary from State of Michigan: $50,000 - $100,000
2. Consulting fees from XYZ LLC: $10,000 - $50,000
3. Rental income from 123 Main Street: $1,000 - $10,000
`
    const items = parseMiPfdText(text)
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.income_kind)).toEqual(['salary', 'consulting', 'rental'])
  })

  it('handles "Less than $X" amount form', () => {
    const text = `
Sources of Income
1. Salary from minor consulting: Less than $1,000
`
    const items = parseMiPfdText(text)
    expect(items).toHaveLength(1)
    expect(items[0]?.amount_range_low).toBe(0)
    expect(items[0]?.amount_range_high).toBe(1000)
  })

  it('handles en-dash and em-dash amount separators', () => {
    const items1 = parseMiPfdText('Sources of Income\n1. Salary: $1,000–$10,000')
    const items2 = parseMiPfdText('Sources of Income\n1. Salary: $1,000—$10,000')
    expect(items1[0]?.amount_range_high).toBe(10000)
    expect(items2[0]?.amount_range_high).toBe(10000)
  })

  it('skips lines without recognizable amount range', () => {
    const text = `
Sources of Income
1. Salary from State of Michigan (no amount listed)
2. Consulting fees: $5,000 - $15,000
`
    const items = parseMiPfdText(text)
    // Only line 2 has parseable amount range
    expect(items).toHaveLength(1)
    expect(items[0]?.income_kind).toBe('consulting')
  })
})
