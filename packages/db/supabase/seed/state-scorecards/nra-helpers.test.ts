import { describe, expect, it } from 'vitest'
import {
  STATE_2_TO_NAME,
  STATE_NAME_TO_2,
  inferChamberFromNraTable,
  parseNraGradesHtml,
  type ParsedNraRow,
} from './nra-helpers.ts'

describe('STATE_2_TO_NAME', () => {
  it('maps all 50 states', () => {
    expect(Object.keys(STATE_2_TO_NAME).length).toBe(50)
  })
  it('maps CA → california', () => {
    expect(STATE_2_TO_NAME.CA).toBe('california')
  })
  it('maps NY → new-york (hyphenated)', () => {
    expect(STATE_2_TO_NAME.NY).toBe('new-york')
  })
  it('maps NC → north-carolina', () => {
    expect(STATE_2_TO_NAME.NC).toBe('north-carolina')
  })
})

describe('STATE_NAME_TO_2 (inverse)', () => {
  it('roundtrip: STATE_2_TO_NAME → STATE_NAME_TO_2 → original code', () => {
    for (const [code, name] of Object.entries(STATE_2_TO_NAME)) {
      expect(STATE_NAME_TO_2[name]).toBe(code)
    }
  })
})

describe('inferChamberFromNraTable', () => {
  it('"State Senate" → state_senate', () => {
    expect(inferChamberFromNraTable('State Senate')).toBe('state_senate')
  })
  it('"State House" → state_house', () => {
    expect(inferChamberFromNraTable('State House')).toBe('state_house')
  })
  it('"State Assembly" → state_house', () => {
    expect(inferChamberFromNraTable('State Assembly')).toBe('state_house')
  })
  it('"State House of Representatives" → state_house', () => {
    expect(inferChamberFromNraTable('State House of Representatives')).toBe('state_house')
  })
  it('"U.S. Senate" → federal_senate', () => {
    expect(inferChamberFromNraTable('U.S. Senate')).toBe('federal_senate')
  })
  it('"Senate" (no State prefix) → federal_senate', () => {
    expect(inferChamberFromNraTable('Senate')).toBe('federal_senate')
  })
  it('"U.S. House of Representatives" → federal_house', () => {
    expect(inferChamberFromNraTable('U.S. House of Representatives')).toBe('federal_house')
  })
  it('"House of Representatives" (no State prefix) → federal_house', () => {
    expect(inferChamberFromNraTable('House of Representatives')).toBe('federal_house')
  })
  it('unknown → null', () => {
    expect(inferChamberFromNraTable('Some Other Chamber')).toBeNull()
  })
})

describe('parseNraGradesHtml', () => {
  it('extracts legislator name + chamber + grade from sample HTML', () => {
    const html = `
      <html><body>
        <h2>State Senate</h2>
        <table>
          <tr><td><a href="/grade/123">Jane Doe</a></td><td class="grade">A+</td></tr>
          <tr><td><a href="/grade/456">John Smith</a></td><td class="grade">F</td></tr>
        </table>
        <h2>State House</h2>
        <table>
          <tr><td><a href="/grade/789">Pat Lee</a></td><td class="grade">B+</td></tr>
        </table>
      </body></html>
    `
    const rows = parseNraGradesHtml(html)
    expect(rows.length).toBe(3)
    expect(rows[0]).toEqual({ name: 'Jane Doe',  chamberLabel: 'State Senate', letterGrade: 'A+' } as ParsedNraRow)
    expect(rows[1]).toEqual({ name: 'John Smith', chamberLabel: 'State Senate', letterGrade: 'F' } as ParsedNraRow)
    expect(rows[2]).toEqual({ name: 'Pat Lee',   chamberLabel: 'State House',  letterGrade: 'B+' } as ParsedNraRow)
  })

  it('skips rows with blank grade', () => {
    const html = `
      <html><body>
        <h2>State Senate</h2>
        <table>
          <tr><td><a>No Grade</a></td><td class="grade"></td></tr>
          <tr><td><a>Has Grade</a></td><td class="grade">A</td></tr>
        </table>
      </body></html>
    `
    const rows = parseNraGradesHtml(html)
    expect(rows.length).toBe(1)
    expect(rows[0]!.name).toBe('Has Grade')
  })

  it('handles AQ (Aborted Questionnaire) — keep but caller filters via letterToNumeric', () => {
    const html = `
      <html><body>
        <h2>State Senate</h2>
        <table>
          <tr><td><a>AQ Person</a></td><td class="grade">AQ</td></tr>
        </table>
      </body></html>
    `
    const rows = parseNraGradesHtml(html)
    expect(rows.length).toBe(1)
    expect(rows[0]!.letterGrade).toBe('AQ')
  })
})
