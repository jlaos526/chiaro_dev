import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge', () => {
  it('house variant renders district ordinal', () => {
    render(<DistrictBadge chamber="federal_house" stateName="California" stateAbbrev="CA" districtNumber={11} />)
    expect(screen.getByText("California's 11th District")).toBeTruthy()
  })
  it('senate variant renders state name only (no district number)', () => {
    render(<DistrictBadge chamber="federal_senate" stateName="California" stateAbbrev="CA" districtNumber={null} />)
    expect(screen.getByText('California')).toBeTruthy()
  })
  it('at-large house variant', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Wyoming" stateAbbrev="WY" districtNumber={null} atLarge={true} />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('includes SVG map pin', () => {
    const { container } = render(<DistrictBadge chamber="federal_senate" stateName="California" stateAbbrev="CA" districtNumber={null} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
  it('renders 1st/2nd/3rd correctly', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Texas" stateAbbrev="TX" districtNumber={1} />)
    expect(screen.getByText("Texas's 1st District")).toBeTruthy()
    render(<DistrictBadge chamber="federal_house" stateName="Texas" stateAbbrev="TX" districtNumber={2} />)
    expect(screen.getByText("Texas's 2nd District")).toBeTruthy()
    render(<DistrictBadge chamber="federal_house" stateName="Texas" stateAbbrev="TX" districtNumber={3} />)
    expect(screen.getByText("Texas's 3rd District")).toBeTruthy()
    render(<DistrictBadge chamber="federal_house" stateName="Texas" stateAbbrev="TX" districtNumber={21} />)
    expect(screen.getByText("Texas's 21st District")).toBeTruthy()
  })
})

describe('DistrictBadge — state chambers', () => {
  it('state_house renders state-NN compact', () => {
    const { getByText } = render(
      <DistrictBadge chamber="state_house" stateName="California" stateAbbrev="CA" districtNumber={null} districtCode="15" />,
    )
    expect(getByText('CA-15')).toBeTruthy()
  })

  it('state_senate renders state-SD N label', () => {
    const { getByText } = render(
      <DistrictBadge chamber="state_senate" stateName="California" stateAbbrev="CA" districtNumber={null} districtCode="8" />,
    )
    expect(getByText('CA-SD 8')).toBeTruthy()
  })

  it('state_legislature (NE) renders state-LD N label', () => {
    const { getByText } = render(
      <DistrictBadge chamber="state_legislature" stateName="Nebraska" stateAbbrev="NE" districtNumber={null} districtCode="23" />,
    )
    expect(getByText('NE-LD 23')).toBeTruthy()
  })
})
