import { describe, expect, it, vi } from 'vitest'
import {
  BROWSER_USER_AGENT,
  RATE_LIMIT_MS,
  normalizePartyChar,
  resolveOpenstatesPersonId,
} from './helpers.ts'

describe('helpers — constants', () => {
  it('BROWSER_USER_AGENT identifies ChiaroBot', () => {
    expect(BROWSER_USER_AGENT).toMatch(/Mozilla/)
    expect(BROWSER_USER_AGENT).toMatch(/ChiaroBot/)
  })

  it('RATE_LIMIT_MS is 1 second', () => {
    expect(RATE_LIMIT_MS).toBe(1000)
  })
})

describe('normalizePartyChar', () => {
  it('D → Democratic', () => expect(normalizePartyChar('D')).toBe('Democratic'))
  it('R → Republican', () => expect(normalizePartyChar('R')).toBe('Republican'))
  it('I → Independent', () => expect(normalizePartyChar('I')).toBe('Independent'))
  it('case-insensitive: d → Democratic', () => expect(normalizePartyChar('d')).toBe('Democratic'))
  it('unknown returns input unchanged', () => expect(normalizePartyChar('X')).toBe('X'))
})

describe('resolveOpenstatesPersonId', () => {
  it('returns openstates_person_id on case-insensitive name match', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'osp-12345' }],
        rowCount: 1,
      }),
    }
    const result = await resolveOpenstatesPersonId(client as never, {
      full_name: 'Jane DOE',
      state: 'MI',
      chamber: 'state_house',
    })
    expect(result).toBe('osp-12345')
    expect(client.query).toHaveBeenCalledOnce()
  })

  it('returns null when no match', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await resolveOpenstatesPersonId(client as never, {
      full_name: 'Jane Doe',
      state: 'MI',
      chamber: 'state_house',
    })
    expect(result).toBeNull()
  })

  it('returns null when row has NULL openstates_person_id', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: null }],
        rowCount: 1,
      }),
    }
    const result = await resolveOpenstatesPersonId(client as never, {
      full_name: 'Jane Doe',
      state: 'MI',
      chamber: 'state_house',
    })
    expect(result).toBeNull()
  })
})
