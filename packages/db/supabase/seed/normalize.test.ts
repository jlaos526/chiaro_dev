import { describe, expect, it } from 'vitest'
import { CongressGovMemberSchema, normalizeMember } from './normalize.ts'

describe('CongressGovMemberSchema', () => {
  it('parses a senator response', () => {
    const raw = {
      bioguideId: 'F000062',
      firstName: 'Dianne',
      lastName: 'Feinstein',
      directOrderName: 'Dianne Feinstein',
      partyName: 'Democratic',
      state: 'California',
      stateCode: 'CA',
      chamber: 'Senate',
      terms: { item: [{ chamber: 'Senate', startYear: 2017, endYear: 2023 }] },
      district: null,
      senateClass: 1,
      officialWebsiteUrl: 'https://www.feinstein.senate.gov',
      nextElection: null,
    }
    const parsed = CongressGovMemberSchema.parse(raw)
    expect(parsed.bioguideId).toBe('F000062')
  })

  it('rejects bad shape', () => {
    expect(() => CongressGovMemberSchema.parse({ bioguideId: 123 })).toThrow()
  })
})

describe('normalizeMember', () => {
  it('normalizes a house member', () => {
    const raw = {
      bioguideId: 'P000197',
      firstName: 'Nancy',
      lastName: 'Pelosi',
      directOrderName: 'Nancy Pelosi',
      partyName: 'Democratic',
      state: 'California',
      stateCode: 'CA',
      chamber: 'House of Representatives',
      district: 11,
      senateClass: null,
      terms: { item: [{ chamber: 'House of Representatives', startYear: 2023, endYear: 2025 }] },
      officialWebsiteUrl: 'https://pelosi.house.gov',
      nextElection: '2026-11-03',
    }
    const member = normalizeMember(raw)
    expect(member.chamber).toBe('house')
    expect(member.party).toBe('D')
    expect(member.state).toBe('CA')
    expect(member.districtNumber).toBe(11)
    expect(member.senateClass).toBeNull()
    expect(member.portraitUrl).toBe(
      'https://bioguide.congress.gov/bioguide/photo/P/P000197.jpg',
    )
  })

  it('maps senator with class', () => {
    const raw = {
      bioguideId: 'S000033',
      firstName: 'Bernard',
      lastName: 'Sanders',
      directOrderName: 'Bernard Sanders',
      partyName: 'Independent',
      state: 'Vermont',
      stateCode: 'VT',
      chamber: 'Senate',
      district: null,
      senateClass: 1,
      terms: { item: [] },
      officialWebsiteUrl: 'https://www.sanders.senate.gov',
      nextElection: null,
    }
    const member = normalizeMember(raw)
    expect(member.chamber).toBe('senate')
    expect(member.party).toBe('I')
    expect(member.senateClass).toBe(1)
    expect(member.districtNumber).toBeNull()
  })

  it('handles at-large house seat', () => {
    const raw = {
      bioguideId: 'P000123',
      firstName: 'X',
      lastName: 'Y',
      directOrderName: 'X Y',
      partyName: 'Republican',
      state: 'Wyoming',
      stateCode: 'WY',
      chamber: 'House of Representatives',
      district: 0,
      senateClass: null,
      terms: { item: [] },
      officialWebsiteUrl: null,
      nextElection: null,
    }
    const member = normalizeMember(raw)
    expect(member.districtNumber).toBe(0)
  })
})
