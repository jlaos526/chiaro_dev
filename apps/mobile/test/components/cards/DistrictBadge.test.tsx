import { render, screen } from '@testing-library/react-native'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge', () => {
  it('house with district number renders ordinal text', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Ohio" stateAbbrev="OH" districtNumber={15} atLarge={false} />)
    expect(screen.getByText("Ohio's 15th District")).toBeTruthy()
  })
  it('senate renders state name only', () => {
    render(<DistrictBadge chamber="federal_senate" stateName="Ohio" stateAbbrev="OH" districtNumber={null} atLarge={false} />)
    expect(screen.getByText('Ohio')).toBeTruthy()
  })
  it('at-large renders "<State>\'s At-Large District"', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Wyoming" stateAbbrev="WY" districtNumber={null} atLarge={true} />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('ordinals 11/12/13 use "th"', () => {
    render(<DistrictBadge chamber="federal_house" stateName="New York" stateAbbrev="NY" districtNumber={11} atLarge={false} />)
    expect(screen.getByText("New York's 11th District")).toBeTruthy()
  })
  it('ordinals 21st/22nd/23rd', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Texas" stateAbbrev="TX" districtNumber={21} atLarge={false} />)
    expect(screen.getByText("Texas's 21st District")).toBeTruthy()
  })
})

describe('DistrictBadge — state chambers', () => {
  it('state_house renders state-NN compact', () => {
    render(
      <DistrictBadge chamber="state_house" stateName="California" stateAbbrev="CA" districtNumber={null} districtCode="15" />,
    )
    expect(screen.getByText('CA-15')).toBeTruthy()
  })
  it('state_senate renders state-SD N label', () => {
    render(
      <DistrictBadge chamber="state_senate" stateName="California" stateAbbrev="CA" districtNumber={null} districtCode="8" />,
    )
    expect(screen.getByText('CA-SD 8')).toBeTruthy()
  })
  it('state_legislature (NE) renders state-LD N label', () => {
    render(
      <DistrictBadge chamber="state_legislature" stateName="Nebraska" stateAbbrev="NE" districtNumber={null} districtCode="23" />,
    )
    expect(screen.getByText('NE-LD 23')).toBeTruthy()
  })
})
