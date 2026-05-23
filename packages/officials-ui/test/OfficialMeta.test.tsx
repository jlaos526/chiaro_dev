import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OfficialWithDistrict } from '@chiaro/officials'
import { OfficialMeta } from '../src/OfficialMeta.tsx'

function makeOfficial(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid',
    full_name: 'Jane Doe',
    party: 'Democratic',
    chamber: 'federal_house',
    state: 'CA',
    district_id: 'did',
    portrait_url: null,
    bioguide_id: 'D000000',
    is_active: true,
    next_election: null,
    district: { id: 'did', code: 'CA-12', tier: 'federal_house', state: 'CA', name: 'CA-12' },
    ...overrides,
  } as OfficialWithDistrict
}

describe('OfficialMeta', () => {
  it('renders House + district code for federal_house', () => {
    const official = makeOfficial()
    const { getByText } = render(<OfficialMeta official={official} />)
    expect(getByText(/House/)).toBeTruthy()
    expect(getByText(/CA-12/)).toBeTruthy()
  })

  it('renders Senate + state for federal_senate', () => {
    const official = makeOfficial({ chamber: 'federal_senate', state: 'NY' })
    const { getByText } = render(<OfficialMeta official={official} />)
    expect(getByText(/Senate/)).toBeTruthy()
    expect(getByText(/NY/)).toBeTruthy()
  })

  it('includes next-election text when provided', () => {
    const official = makeOfficial({ next_election: '2026-11-03' })
    const { getByText } = render(<OfficialMeta official={official} />)
    expect(getByText(/Next election/)).toBeTruthy()
  })
})
