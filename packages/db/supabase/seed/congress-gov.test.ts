import { describe, expect, it, vi } from 'vitest'
import { fetchMembers } from './congress-gov.ts'

describe('fetchMembers', () => {
  it('paginates and normalizes house members', async () => {
    const fixture = await import('./fixtures/congress-gov-house-119.json', {
      with: { type: 'json' },
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(fixture.default), { status: 200 }),
    )

    const members = await fetchMembers('house', '119', 'TEST_KEY')
    expect(members).toHaveLength(2)
    expect(members[0].bioguideId).toBe('P000197')
    expect(members[0].chamber).toBe('house')
    expect(members[0].state).toBe('CA')

    const calledUrl = fetchSpy.mock.calls[0]![0]
    const init     = fetchSpy.mock.calls[0]![1] as RequestInit
    expect(String(calledUrl)).toContain('api.congress.gov/v3/member')
    expect((init.headers as Record<string,string>)['X-API-Key']).toBe('TEST_KEY')
    fetchSpy.mockRestore()
  })

  it('continues fetching when pagination.next is non-null', async () => {
    const page1 = {
      members: [{ bioguideId: 'X000001', firstName:'A', lastName:'B',
        directOrderName:'A B', partyName:'Democratic', state:'CA', stateCode:'CA',
        chamber:'Senate', district:null, senateClass:1, terms:{item:[]},
        officialWebsiteUrl:null, nextElection:null }],
      pagination: { next: 'https://api.congress.gov/v3/member?offset=250&limit=250' },
    }
    const page2 = {
      members: [{ bioguideId: 'X000002', firstName:'C', lastName:'D',
        directOrderName:'C D', partyName:'Republican', state:'TX', stateCode:'TX',
        chamber:'Senate', district:null, senateClass:2, terms:{item:[]},
        officialWebsiteUrl:null, nextElection:null }],
      pagination: { next: null },
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))

    const members = await fetchMembers('senate', '119', 'TEST_KEY')
    expect(members).toHaveLength(2)
    expect(members.map((m) => m.bioguideId)).toEqual(['X000001','X000002'])
    fetchSpy.mockRestore()
  })

  it('throws on non-2xx', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    )
    await expect(fetchMembers('house', '119', 'BAD')).rejects.toThrow(/403/)
    fetchSpy.mockRestore()
  })
})
