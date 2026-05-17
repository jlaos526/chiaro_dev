import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioHeader } from '@/components/bio/BioHeader'

const PELOSI = {
  fullName: 'Nancy Pelosi',
  portraitUrl: null,
  party: 'D',
  chamber: 'house' as const,
  state: 'CA',
  stateName: 'California',
  districtNumber: 11,
  senateClass: null,
  atLarge: false,
  role: 'Speaker',
  firstElectedYear: 2007,
  officialUrl: 'https://pelosi.house.gov',
  twitterHandle: 'SpeakerPelosi',
}

describe('BioHeader', () => {
  it('renders name + 3 identity chips + service card + contact links for a house rep', () => {
    render(<BioHeader {...PELOSI} />)
    expect(screen.getByText('Nancy Pelosi')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText('CA-11')).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText(/Since 2007/)).toBeTruthy()
    expect(screen.getByText('pelosi.house.gov')).toBeTruthy()
    expect(screen.getByText('@SpeakerPelosi')).toBeTruthy()
  })

  it('senate variant uses full state name for district chip', () => {
    render(
      <BioHeader
        {...PELOSI}
        chamber="senate"
        districtNumber={null}
        senateClass={1}
        role="Senator"
      />
    )
    expect(screen.getByText('California')).toBeTruthy()
    expect(screen.queryByText('CA-11')).toBeNull()
  })

  it('at-large variant uses XX-AL district chip', () => {
    render(
      <BioHeader
        {...PELOSI}
        state="WY" stateName="Wyoming" districtNumber={null} atLarge={true} role="Representative" firstElectedYear={2023}
      />
    )
    expect(screen.getByText('WY-AL')).toBeTruthy()
  })

  it('gracefully hides contact links when both missing', () => {
    render(<BioHeader {...PELOSI} officialUrl={null} twitterHandle={null} />)
    expect(screen.queryByText('pelosi.house.gov')).toBeNull()
    expect(screen.queryByText(/@/)).toBeNull()
  })
})
