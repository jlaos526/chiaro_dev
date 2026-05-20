import { describe, expect, it } from 'vitest'
import { groupOfficialsByLevel } from '@/lib/derivations/officials-by-level'
import type { OfficialWithDistrict } from '@chiaro/officials'

function mkOfficial(chamber: OfficialWithDistrict['chamber'], name: string): OfficialWithDistrict {
  return {
    id: name, bioguide_id: name, full_name: name, first_name: name, last_name: '',
    chamber, party: 'D', state: 'CA', district_id: 'd', in_office: true,
    senate_class: null, source_version: 'x', opensecrets_id: null, fec_candidate_id: null,
    openstates_person_id: null, district_code: null, title: null,
    district: { id: 'd', tier: 'federal_house', state: 'CA', code: 'CA-12', name: 'CA-12' },
  } as unknown as OfficialWithDistrict
}

describe('groupOfficialsByLevel', () => {
  it('empty input returns empty groups', () => {
    expect(groupOfficialsByLevel([])).toEqual({ federal: [], state: [] })
  })

  it('partitions by chamber level', () => {
    const officials = [
      mkOfficial('federal_house', 'Pelosi'),
      mkOfficial('federal_senate', 'Padilla'),
      mkOfficial('state_house', 'Asm'),
      mkOfficial('state_senate', 'Sen'),
    ]
    const grouped = groupOfficialsByLevel(officials)
    expect(grouped.federal.map(o => o.full_name)).toEqual(['Pelosi', 'Padilla'])
    expect(grouped.state.map(o => o.full_name)).toEqual(['Asm', 'Sen'])
  })

  it('state_legislature (NE) classified as state', () => {
    const ne = mkOfficial('state_legislature', 'NE-Sen')
    expect(groupOfficialsByLevel([ne]).state).toHaveLength(1)
  })

  it('orders federal: house-then-senate; state: house-then-senate-then-legislature', () => {
    const officials = [
      mkOfficial('state_senate', 'S-Sen'),
      mkOfficial('federal_senate', 'F-Sen'),
      mkOfficial('state_legislature', 'NE'),
      mkOfficial('federal_house', 'F-Rep'),
      mkOfficial('state_house', 'S-Rep'),
    ]
    const grouped = groupOfficialsByLevel(officials)
    expect(grouped.federal.map(o => o.full_name)).toEqual(['F-Rep', 'F-Sen'])
    expect(grouped.state.map(o => o.full_name)).toEqual(['S-Rep', 'S-Sen', 'NE'])
  })
})
