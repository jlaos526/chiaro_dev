import { describe, expect, it, vi } from 'vitest'
import {
  parseAddressText,
  fetchPerMemberOffices,
  emitOfficeRow,
  type ParsedMemberDetail,
} from './_shared.ts'

describe('parseAddressText', () => {
  // Existing slice 15 + 16 behavior covered indirectly via per-parser tests;
  // direct test cases here lock the contract.
  it('parses standard "Street, City, State Zip · Phone: ..." format', () => {
    const result = parseAddressText('123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234')
    expect(result).toEqual({
      street_1: '123 Main Street',
      city: 'Buffalo',
      state: 'NY',
      postal_code: '14201',
      phone: '(716) 555-1234',
    })
  })

  it('returns null when state-zip segment is malformed', () => {
    expect(parseAddressText('123 Main, Buffalo, malformed')).toBeNull()
  })
})

describe('emitOfficeRow', () => {
  it('returns row when address parses', () => {
    const row = emitOfficeRow('123 Main Street, Buffalo, NY 14201', {
      openstates_person_id: 'ocd-person/test',
      kind: 'capitol',
      source_url: 'https://example.com/profile',
    })
    expect(row).toMatchObject({
      official_openstates_person_id: 'ocd-person/test',
      kind: 'capitol',
      street_1: '123 Main Street',
      city: 'Buffalo',
      state: 'NY',
      postal_code: '14201',
    })
  })

  it('returns null when address parsing fails', () => {
    expect(emitOfficeRow('garbage no commas', {
      openstates_person_id: 'ocd-person/test',
      kind: 'capitol',
      source_url: 'https://example.com',
    })).toBeNull()
  })
})

describe('fetchPerMemberOffices', () => {
  const fixture: ParsedMemberDetail = {
    capitol_office: '100 Capitol St, Lansing, MI 48909',
    district_office: '200 Local Ave, Detroit, MI 48201',
  }

  it('queries officials with the supplied chamber + state', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => ({}),
      fetcher: async () => '',
    })
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('chamber = $1'),
      ['state_senate', 'MI'],
    )
  })

  it('emits 2 rows per resolved legislator with both addresses', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith', district_id: 'MI-8' },
        ],
        rowCount: 2,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    // 2 legislators × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('skips legislators when deriveUrl returns null', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: null },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith', district_id: 'MI-8' },
        ],
        rowCount: 2,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => l.district_id ? `https://example.com/${l.full_name}` : null,
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    expect(rows).toHaveLength(2)  // Only Alex resolves
  })

  it('silently skips legislators on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith', district_id: 'MI-8' },
        ],
        rowCount: 2,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => fixture,
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('TLS handshake failed')
        return 'html'
      },
    })
    expect(rows).toHaveLength(2)  // First errors, second succeeds
  })

  it('skips throttle when fetcher injected (test mode)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: Array.from({ length: 5 }, (_, i) => ({
          openstates_person_id: `ocd-${i}`,
          full_name: `Name ${i}`,
          district_id: `MI-${i}`,
        })),
        rowCount: 5,
      }),
    }
    const start = Date.now()
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    const elapsed = Date.now() - start
    expect(rows).toHaveLength(10)  // 5 × 2 = 10
    expect(elapsed).toBeLessThan(500)  // No throttle delays
  })

  it('emits only capitol when district_office is missing from parse', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
        ],
        rowCount: 1,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => ({ capitol_office: '100 Capitol St, Lansing, MI 48909' }),
      fetcher: async () => 'html',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.kind).toBe('capitol')
  })

  it('emits 0 rows when both addresses fail to parse', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
        ],
        rowCount: 1,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => ({ capitol_office: 'garbage', district_office: 'also garbage' }),
      fetcher: async () => 'html',
    })
    expect(rows).toHaveLength(0)
  })

  it('tolerates legislator rows that omit district_id (mock-friendly)', async () => {
    // MI senate + NY senate test mocks intentionally omit district_id
    // because their deriveUrl callbacks key off full_name slug.
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe' },
        ],
        rowCount: 1,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => {
        // l.district_id should be null (coerced from undefined)
        expect(l.district_id).toBeNull()
        return `https://example.com/${l.full_name}`
      },
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    expect(rows).toHaveLength(2)
  })

  it('returns empty when officials query yields 0 rows', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_house',
      state: 'CA',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    expect(rows).toEqual([])
  })

  it('passes through the resolved URL as the source_url on each row', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
        ],
        rowCount: 1,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: () => 'https://senate.michigan.gov/senators/jane-doe/',
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    expect(rows.every(r => r.source_url === 'https://senate.michigan.gov/senators/jane-doe/')).toBe(true)
  })
})
