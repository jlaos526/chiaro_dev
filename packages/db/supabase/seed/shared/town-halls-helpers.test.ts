import { describe, expect, it } from 'vitest'
import { deriveFormat } from './town-halls-helpers.ts'

describe('deriveFormat', () => {
  it('is_virtual=true → virtual', () => {
    expect(deriveFormat({ is_virtual: true, event_url: null, location: null })).toBe('virtual')
  })

  it('zoom URL + venue → hybrid', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://us02web.zoom.us/j/123',
      location: { venue: 'Capitol Room 100' },
    })).toBe('hybrid')
  })

  it('zoom URL no venue → virtual', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://us02web.zoom.us/j/123',
      location: null,
    })).toBe('virtual')
  })

  it('venue only, no virtual URL → in_person', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://www.mobilize.us/event/123/',
      location: { venue: 'Lafayette Library' },
    })).toBe('in_person')
  })

  it('google meet + venue → hybrid', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://meet.google.com/abc-defg-hij',
      location: { venue: 'Capitol' },
    })).toBe('hybrid')
  })
})
