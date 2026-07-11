import { describe, expect, it } from 'vitest'
import {
  parseTxTecOrderText,
} from './pdf-helpers.ts'

describe('parseTxTecOrderText', () => {
  it('returns empty result for empty text', () => {
    expect(parseTxTecOrderText('')).toEqual({})
  })

  it('returns empty result for garbage text', () => {
    expect(parseTxTecOrderText('completely unrelated content')).toEqual({})
  })

  it('extracts violation_summary from VIOLATION: header', () => {
    const text = `
TEXAS ETHICS COMMISSION
SC-202401-001 — Final Order

VIOLATION:
Failed to file annual personal financial statement by April 30 deadline.

CIVIL PENALTY: $1,500.00

DISPOSITION:
Resolved by Agreed Order.
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/Failed to file annual/)
    expect(result.penalty_amount).toBe(1500)
    expect(result.outcome_text).toMatch(/Resolved by Agreed Order/)
  })

  it('extracts violation_summary from ALLEGATION: header variant', () => {
    const text = `
ALLEGATION:
Respondent accepted prohibited gifts during legislative session.

CIVIL PENALTY: $5,000
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/prohibited gifts/)
    expect(result.penalty_amount).toBe(5000)
  })

  it('extracts violation_summary from FINDING: header variant', () => {
    const text = `
FINDING:
Late filing of campaign finance report — 14 days past deadline.
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/Late filing/)
    expect(result.penalty_amount).toBeUndefined()
  })

  it('extracts penalty with comma + decimal formats', () => {
    const text1 = 'CIVIL PENALTY: $15,000.00'
    const text2 = 'CIVIL PENALTY: $250'
    const text3 = 'PENALTY ASSESSED: $1,200.50'
    expect(parseTxTecOrderText(text1).penalty_amount).toBe(15000)
    expect(parseTxTecOrderText(text2).penalty_amount).toBe(250)
    expect(parseTxTecOrderText(text3).penalty_amount).toBe(1200)
  })

  it('extracts outcome_text from ORDER: header variant', () => {
    const text = `
VIOLATION: Late filing.
ORDER:
The Commission imposes a civil penalty in the amount stated above.
`
    const result = parseTxTecOrderText(text)
    expect(result.outcome_text).toMatch(/imposes a civil penalty/i)
  })

  it('handles partial parse (only some fields present)', () => {
    const text = `
VIOLATION:
Failed to register as lobbyist.
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toBeTruthy()
    expect(result.penalty_amount).toBeUndefined()
    expect(result.outcome_text).toBeUndefined()
  })

  it('handles multi-paragraph violation text', () => {
    const text = `
VIOLATION:
Respondent violated Texas Election Code 254.031 by failing to disclose
contributions in excess of $200 from individual donors.

Specific violations include:
- 3 contributions from John Doe totaling $1,200
- 2 contributions from Jane Smith totaling $850

CIVIL PENALTY: $2,000
`
    const result = parseTxTecOrderText(text)
    expect(result.violation_summary).toMatch(/Texas Election Code/)
    // Multi-paragraph capture includes the bullet list
    expect(result.violation_summary?.length).toBeGreaterThan(100)
  })
})
