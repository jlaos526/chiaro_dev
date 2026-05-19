import { describe, expect, it, vi } from 'vitest'
import { fetchMembers } from './congress-gov.ts'

// As of commit b317497 the fetcher uses a two-phase flow: paginated list
// endpoint returns `{ members: [{ bioguideId, url }], pagination }`, then
// each member's full data is loaded via the detail URL. These tests mock
// both phases.

describe('fetchMembers', () => {
  it('paginates list, fans out detail fetches, and normalizes house members', async () => {
    const listPage = {
      members: [
        { bioguideId: 'P000197', url: 'https://api.congress.gov/v3/member/P000197' },
        { bioguideId: 'P000605', url: 'https://api.congress.gov/v3/member/P000605' },
      ],
      pagination: { next: null },
    }
    const detailPelosi = {
      member: {
        bioguideId: 'P000197',
        firstName: 'Nancy',
        lastName: 'Pelosi',
        directOrderName: 'Nancy Pelosi',
        district: 11,
        officialWebsiteUrl: 'https://pelosi.house.gov/',
        terms: [
          { chamber: 'House of Representatives', stateCode: 'CA', startYear: 2023, endYear: 2025 },
          { chamber: 'House of Representatives', stateCode: 'CA', startYear: 2025 },
        ],
        partyHistory: [{ partyAbbreviation: 'D', partyName: 'Democratic', startYear: 1987 }],
      },
    }
    const detailCastro = {
      member: {
        bioguideId: 'P000605',
        firstName: 'Joaquin',
        lastName: 'Castro',
        directOrderName: 'Joaquin Castro',
        district: 20,
        terms: [
          { chamber: 'House of Representatives', stateCode: 'TX', startYear: 2023, endYear: 2025 },
          { chamber: 'House of Representatives', stateCode: 'TX', startYear: 2025 },
        ],
        partyHistory: [{ partyAbbreviation: 'D' }],
      },
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input)
      if (url.includes('/member/P000197')) return new Response(JSON.stringify(detailPelosi), { status: 200 })
      if (url.includes('/member/P000605')) return new Response(JSON.stringify(detailCastro), { status: 200 })
      if (url.includes('/v3/member?')) return new Response(JSON.stringify(listPage), { status: 200 })
      return new Response('', { status: 404 })
    })

    const members = await fetchMembers('federal_house', '119', 'TEST_KEY')
    expect(members).toHaveLength(2)

    const pelosi = members.find(m => m.bioguideId === 'P000197')!
    expect(pelosi.chamber).toBe('federal_house')
    expect(pelosi.state).toBe('CA')
    expect(pelosi.fullName).toBe('Nancy Pelosi')
    expect(pelosi.party).toBe('D')
    expect(pelosi.districtNumber).toBe(11)
    expect(pelosi.senateClass).toBeNull()

    // list call uses chamber-filtered list URL with the API key header
    const listCall = fetchSpy.mock.calls.find(c => {
      const u = String(c[0])
      return u.includes('/v3/member?') && !u.includes('/member/P')
    })!
    expect(String(listCall[0])).toContain('api.congress.gov/v3/member')
    const headers = (listCall[1] as RequestInit).headers as Record<string, string>
    expect(headers['X-API-Key']).toBe('TEST_KEY')

    fetchSpy.mockRestore()
  })

  it('continues paginating list pages until pagination.next is null', async () => {
    const page1 = {
      members: [{ bioguideId: 'X000001', url: 'https://api.congress.gov/v3/member/X000001' }],
      pagination: { next: 'https://api.congress.gov/v3/member?offset=250&limit=250' },
    }
    const page2 = {
      members: [{ bioguideId: 'X000002', url: 'https://api.congress.gov/v3/member/X000002' }],
      pagination: { next: null },
    }
    // Two contiguous senate terms so deriveSenateClass picks a class.
    // 2019 % 6 === 3  →  Class 1.
    const detailX1 = {
      member: {
        bioguideId: 'X000001',
        firstName: 'A',
        lastName: 'B',
        directOrderName: 'A B',
        terms: [
          { chamber: 'Senate', stateCode: 'CA', startYear: 2019, endYear: 2025 },
          { chamber: 'Senate', stateCode: 'CA', startYear: 2025 },
        ],
        partyHistory: [{ partyAbbreviation: 'D' }],
      },
    }
    const detailX2 = {
      member: {
        bioguideId: 'X000002',
        firstName: 'C',
        lastName: 'D',
        directOrderName: 'C D',
        terms: [
          { chamber: 'Senate', stateCode: 'TX', startYear: 2019, endYear: 2025 },
          { chamber: 'Senate', stateCode: 'TX', startYear: 2025 },
        ],
        partyHistory: [{ partyAbbreviation: 'R' }],
      },
    }

    let listCallCount = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input)
      if (url.includes('/member/X000001')) return new Response(JSON.stringify(detailX1), { status: 200 })
      if (url.includes('/member/X000002')) return new Response(JSON.stringify(detailX2), { status: 200 })
      if (url.includes('/v3/member?')) {
        listCallCount++
        return new Response(JSON.stringify(listCallCount === 1 ? page1 : page2), { status: 200 })
      }
      return new Response('', { status: 404 })
    })

    const members = await fetchMembers('federal_senate', '119', 'TEST_KEY')
    expect(members).toHaveLength(2)
    expect(members.map(m => m.bioguideId).sort()).toEqual(['X000001', 'X000002'])
    expect(members.every(m => m.chamber === 'federal_senate')).toBe(true)
    expect(members.every(m => m.senateClass === 1)).toBe(true)
    expect(listCallCount).toBe(2)

    fetchSpy.mockRestore()
  })

  it('throws on non-2xx list response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    )
    await expect(fetchMembers('federal_house', '119', 'BAD')).rejects.toThrow(/403/)
    fetchSpy.mockRestore()
  })
})
