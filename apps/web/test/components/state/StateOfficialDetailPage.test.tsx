import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'
import type { OfficialWithDistrict } from '@chiaro/officials'

function mkState(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid', full_name: 'Test Asm', first_name: 'Test', last_name: 'Asm',
    bioguide_id: null, openstates_person_id: 'ocd-person/x',
    chamber: 'state_house', party: 'Democratic', state: 'CA',
    district_id: 'did', district_code: '15', title: 'Assemblymember',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('StateOfficialDetailPage', () => {
  it('renders bio header with name + party + district', () => {
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />)
    expect(getByText('Test Asm')).toBeTruthy()
    expect(getByText(/Democratic/)).toBeTruthy()
    expect(getByText(/CA-15/)).toBeTruthy()
  })

  it('renders 5 ComingSoonCard placeholders', () => {
    const { getAllByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />)
    // Anchored to leaf element textContent so per-category body copy
    // (e.g. "Campaign finance — coming soon") doesn't double-count.
    expect(getAllByText(/^(?:Service Record|Issue Positions|Community Presence|Finance|Ethics & Accountability)$/i))
      .toHaveLength(5)
  })

  it('renders offices section above the placeholder cascade', () => {
    const offices = [{
      id: 'o1', official_id: 'oid', address: '1 Capitol, Sacramento CA',
      city: 'Sacramento', state: 'CA', zip: null, phone: '555-0100',
      source_url: 'https://openstates.org/',
    }]
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={offices as never} />)
    expect(getByText(/1 Capitol/)).toBeTruthy()
    expect(getByText('555-0100')).toBeTruthy()
  })

  it('NE state_legislature renders chamber as State Senator', () => {
    // tier 'state_legislature' isn't in district_tier enum (districts table predates the
    // 5-chamber officials expansion) — cast the inline mock to satisfy the test fixture shape.
    const ne = mkState({ chamber: 'state_legislature', state: 'NE', title: 'Senator',
      district: { id: 'did', tier: 'state_legislature', state: 'NE', code: 'NE-23', name: 'NE District 23' } as unknown as OfficialWithDistrict['district'] })
    const { getByText } = render(<StateOfficialDetailPage official={ne} offices={[]} />)
    expect(getByText(/State Senator/)).toBeTruthy()
  })

  it('multi-member district shows district_code with title', () => {
    const md = mkState({ state: 'MD', district_code: '1A', title: 'Delegate',
      district: { id: 'did', tier: 'state_house', state: 'MD', code: 'MD-01', name: 'MD HD 01' } })
    const { getByText } = render(<StateOfficialDetailPage official={md} offices={[]} />)
    expect(getByText(/Delegate/)).toBeTruthy()
    expect(getByText(/MD-01/)).toBeTruthy()
  })
})
