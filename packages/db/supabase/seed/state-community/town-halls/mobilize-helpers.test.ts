import { describe, expect, it } from 'vitest'
import {
  extractLegislatorName,
  inferChamberFromTitle,
  deriveFormat,
  isStateLegislatorEvent,
} from './mobilize-helpers.ts'

describe('isStateLegislatorEvent', () => {
  it('matches "State Senator <Name>"', () => {
    expect(isStateLegislatorEvent('Town Hall with State Senator Mike Foote', '')).toBe(true)
  })
  it('matches "Assemblymember <Name>"', () => {
    expect(isStateLegislatorEvent('Assemblymember Emily Sirota — Community Town Hall', '')).toBe(
      true,
    )
  })
  it('matches "Delegate <Name>"', () => {
    expect(isStateLegislatorEvent('Delegate Pat Smith Virtual Town Hall', '')).toBe(true)
  })
  it('matches "State Rep. <Name>"', () => {
    expect(isStateLegislatorEvent('State Rep. John Doe', '')).toBe(true)
  })
  it('rejects federal "Senator <Name>" (no "State" prefix)', () => {
    expect(isStateLegislatorEvent('Town Hall with Senator Elizabeth Warren', '')).toBe(false)
  })
  it('rejects vague "Community Town Hall"', () => {
    expect(isStateLegislatorEvent('Community Town Hall in Brooklyn', '')).toBe(false)
  })
  it('falls back to description when title has no match', () => {
    expect(isStateLegislatorEvent('Open Forum', 'Featuring State Senator Jane Roe')).toBe(true)
  })
})

describe('extractLegislatorName', () => {
  it('extracts from "State Senator <Name>"', () => {
    expect(extractLegislatorName('Town Hall with State Senator Mike Foote')).toBe('Mike Foote')
  })
  it('extracts hyphenated last name', () => {
    expect(extractLegislatorName('State Senator Maria Lopez-Garcia')).toBe('Maria Lopez-Garcia')
  })
  it('extracts from "Assemblymember <Name>"', () => {
    expect(extractLegislatorName('Assemblymember Emily Sirota — Community Town Hall')).toBe(
      'Emily Sirota',
    )
  })
  it('extracts from "Delegate <Name>"', () => {
    expect(extractLegislatorName('Delegate Pat Smith Virtual Town Hall')).toBe('Pat Smith')
  })
  it('extracts from "State Rep. <Name>"', () => {
    expect(extractLegislatorName('State Rep. John Doe')).toBe('John Doe')
  })
  it('returns null when no match', () => {
    expect(extractLegislatorName('Community Town Hall in Brooklyn')).toBeNull()
  })
})

describe('inferChamberFromTitle', () => {
  it('"State Senator" → state_senate', () => {
    expect(inferChamberFromTitle('State Senator Mike Foote')).toBe('state_senate')
  })
  it('"Assemblymember" → state_house', () => {
    expect(inferChamberFromTitle('Assemblymember Emily Sirota')).toBe('state_house')
  })
  it('"State Rep." → state_house', () => {
    expect(inferChamberFromTitle('State Rep. John Doe')).toBe('state_house')
  })
  it('"Delegate" → state_house', () => {
    expect(inferChamberFromTitle('Delegate Pat Smith')).toBe('state_house')
  })
  it('"State Representative" → state_house', () => {
    expect(inferChamberFromTitle('State Representative Jane Roe')).toBe('state_house')
  })
  it('returns null for non-match', () => {
    expect(inferChamberFromTitle('Community Town Hall')).toBeNull()
  })
})

describe('deriveFormat', () => {
  it('is_virtual=true → virtual', () => {
    expect(deriveFormat({ is_virtual: true, event_url: null, location: null })).toBe('virtual')
  })
  it('zoom URL + venue → hybrid', () => {
    expect(
      deriveFormat({
        is_virtual: false,
        event_url: 'https://us02web.zoom.us/j/123',
        location: { venue: 'Capitol Room 100' },
      }),
    ).toBe('hybrid')
  })
  it('zoom URL no venue → virtual', () => {
    expect(
      deriveFormat({
        is_virtual: false,
        event_url: 'https://us02web.zoom.us/j/123',
        location: null,
      }),
    ).toBe('virtual')
  })
  it('venue only, no virtual URL → in_person', () => {
    expect(
      deriveFormat({
        is_virtual: false,
        event_url: 'https://www.mobilize.us/event/123/',
        location: { venue: 'Lafayette Library' },
      }),
    ).toBe('in_person')
  })
  it('handles google meet URL as hybrid when venue present', () => {
    expect(
      deriveFormat({
        is_virtual: false,
        event_url: 'https://meet.google.com/abc-defg-hij',
        location: { venue: 'Capitol' },
      }),
    ).toBe('hybrid')
  })
})
