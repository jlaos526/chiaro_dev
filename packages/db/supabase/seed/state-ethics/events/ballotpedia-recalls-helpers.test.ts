import { describe, expect, it } from 'vitest'
import {
  mapOutcomeToEventType,
  extractDate,
  parseLegislatorName,
  slugifyName,
  BROWSER_USER_AGENT,
  parseRecallYearLinks,
  parseRecallRows,
  type ParsedRecallRow,
} from './ballotpedia-recalls-helpers.ts'

describe('mapOutcomeToEventType', () => {
  it('Recalled → recall_succeeded', () => {
    expect(mapOutcomeToEventType('Recall election: legislator recalled')).toBe('recall_succeeded')
  })
  it('Removed from office → recall_succeeded', () => {
    expect(mapOutcomeToEventType('Removed from office')).toBe('recall_succeeded')
  })
  it('Retained → recall_failed', () => {
    expect(mapOutcomeToEventType('Recall election: legislator retained')).toBe('recall_failed')
  })
  it('Petition failed → recall_failed', () => {
    expect(mapOutcomeToEventType('Petition failed')).toBe('recall_failed')
  })
  it('Insufficient signatures → recall_failed', () => {
    expect(mapOutcomeToEventType('Insufficient signatures')).toBe('recall_failed')
  })
  it('Withdrew → recall_failed', () => {
    expect(mapOutcomeToEventType('Petition withdrew')).toBe('recall_failed')
  })
  it('Active → recall_attempt', () => {
    expect(mapOutcomeToEventType('Active')).toBe('recall_attempt')
  })
  it('Pending → recall_attempt', () => {
    expect(mapOutcomeToEventType('Pending')).toBe('recall_attempt')
  })
  it('Petition filed → recall_attempt', () => {
    expect(mapOutcomeToEventType('Petition filed')).toBe('recall_attempt')
  })
  it('Unknown → null (log + skip)', () => {
    expect(mapOutcomeToEventType('Something weird')).toBeNull()
  })
})

describe('extractDate', () => {
  it('parses "January 15, 2024"', () => {
    expect(extractDate('January 15, 2024')).toBe('2024-01-15')
  })
  it('parses "Jan 15, 2024"', () => {
    expect(extractDate('Jan 15, 2024')).toBe('2024-01-15')
  })
  it('parses ISO "2024-01-15"', () => {
    expect(extractDate('2024-01-15')).toBe('2024-01-15')
  })
  it('returns null for unparseable text', () => {
    expect(extractDate('not a date')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(extractDate('')).toBeNull()
  })
})

describe('parseLegislatorName', () => {
  it('strips "State Sen." prefix', () => {
    expect(parseLegislatorName('State Sen. Jane Doe')).toEqual({ name: 'Jane Doe', chamber: 'state_senate' })
  })
  it('strips "State Rep." prefix', () => {
    expect(parseLegislatorName('State Rep. John Smith')).toEqual({ name: 'John Smith', chamber: 'state_house' })
  })
  it('strips "State Del." prefix → state_house', () => {
    expect(parseLegislatorName('State Del. Pat Lee')).toEqual({ name: 'Pat Lee', chamber: 'state_house' })
  })
  it('strips "State Senator" word', () => {
    expect(parseLegislatorName('State Senator Maria Lopez')).toEqual({ name: 'Maria Lopez', chamber: 'state_senate' })
  })
  it('strips "Assemblymember" → state_house', () => {
    expect(parseLegislatorName('Assemblymember Carlos Reyes')).toEqual({ name: 'Carlos Reyes', chamber: 'state_house' })
  })
  it('returns null for federal title (Senator without "State" prefix)', () => {
    expect(parseLegislatorName('Senator Elizabeth Warren')).toBeNull()
  })
  it('returns null for bare name (no recognized prefix)', () => {
    expect(parseLegislatorName('Just A Name')).toBeNull()
  })
})

describe('slugifyName', () => {
  it('lowercases + hyphenates', () => {
    expect(slugifyName('Jane Doe')).toBe('jane-doe')
  })
  it('handles hyphens in last names', () => {
    expect(slugifyName('Maria Lopez-Garcia')).toBe('maria-lopez-garcia')
  })
  it('strips apostrophes', () => {
    expect(slugifyName("Sean O'Brien")).toBe('sean-obrien')
  })
})

describe('BROWSER_USER_AGENT', () => {
  it('contains Mozilla prefix and ChiaroBot identifier', () => {
    expect(BROWSER_USER_AGENT).toMatch(/^Mozilla\/5\.0/)
    expect(BROWSER_USER_AGENT).toMatch(/ChiaroBot/)
  })
})

describe('parseRecallYearLinks', () => {
  it('extracts per-year URLs from index HTML', () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/State_legislative_recall_efforts,_2024">2024 efforts</a></li>
          <li><a href="/State_legislative_recall_efforts,_2025">2025 efforts</a></li>
          <li><a href="/State_legislative_recall_efforts,_2026">2026 efforts</a></li>
          <li><a href="/Some_other_page">Unrelated</a></li>
        </ul>
      </body></html>
    `
    const links = parseRecallYearLinks(html)
    expect(links).toEqual([
      { year: 2024, url: 'https://ballotpedia.org/State_legislative_recall_efforts,_2024' },
      { year: 2025, url: 'https://ballotpedia.org/State_legislative_recall_efforts,_2025' },
      { year: 2026, url: 'https://ballotpedia.org/State_legislative_recall_efforts,_2026' },
    ])
  })
})

describe('parseRecallRows', () => {
  it('extracts state + legislator + date + status from per-year HTML', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>State</th><th>Legislator</th><th>Date</th><th>Status</th></tr>
          <tr><td>California</td><td>State Sen. Jane Doe</td><td>March 15, 2024</td><td>Petition failed</td></tr>
          <tr><td>Texas</td><td>State Rep. John Smith</td><td>June 1, 2024</td><td>Recalled</td></tr>
        </table>
      </body></html>
    `
    const rows = parseRecallRows(html)
    expect(rows.length).toBe(2)
    expect(rows[0]).toMatchObject({
      stateName: 'California',
      legislatorRaw: 'State Sen. Jane Doe',
      dateText: 'March 15, 2024',
      status: 'Petition failed',
    } as Partial<ParsedRecallRow>)
  })

  it('skips header rows + rows with too few cells', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>State</th><th>Legislator</th></tr>
          <tr><td>California</td></tr>
          <tr><td>Texas</td><td>State Rep. John</td><td>June 1, 2024</td><td>Recalled</td></tr>
        </table>
      </body></html>
    `
    const rows = parseRecallRows(html)
    expect(rows.length).toBe(1)
    expect(rows[0]!.stateName).toBe('Texas')
  })
})
