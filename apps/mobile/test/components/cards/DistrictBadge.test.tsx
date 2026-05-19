import { render, screen } from '@testing-library/react-native'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge', () => {
  it('house with district number renders ordinal text', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Ohio" districtNumber={15} atLarge={false} />)
    expect(screen.getByText("Ohio's 15th District")).toBeTruthy()
  })
  it('senate renders state name only', () => {
    render(<DistrictBadge chamber="federal_senate" stateName="Ohio" districtNumber={null} atLarge={false} />)
    expect(screen.getByText('Ohio')).toBeTruthy()
  })
  it('at-large renders "<State>\'s At-Large District"', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Wyoming" districtNumber={null} atLarge={true} />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('ordinals 11/12/13 use "th"', () => {
    render(<DistrictBadge chamber="federal_house" stateName="New York" districtNumber={11} atLarge={false} />)
    expect(screen.getByText("New York's 11th District")).toBeTruthy()
  })
  it('ordinals 21st/22nd/23rd', () => {
    render(<DistrictBadge chamber="federal_house" stateName="Texas" districtNumber={21} atLarge={false} />)
    expect(screen.getByText("Texas's 21st District")).toBeTruthy()
  })
})
