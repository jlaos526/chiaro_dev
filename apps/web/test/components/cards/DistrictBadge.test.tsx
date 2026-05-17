import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge', () => {
  it('house variant renders district ordinal', () => {
    render(<DistrictBadge chamber="house" stateName="California" districtNumber={11} />)
    expect(screen.getByText("California's 11th District")).toBeTruthy()
  })
  it('senate variant renders state name only (no district number)', () => {
    render(<DistrictBadge chamber="senate" stateName="California" districtNumber={null} />)
    expect(screen.getByText('California')).toBeTruthy()
  })
  it('at-large house variant', () => {
    render(<DistrictBadge chamber="house" stateName="Wyoming" districtNumber={null} atLarge={true} />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('includes SVG map pin', () => {
    const { container } = render(<DistrictBadge chamber="senate" stateName="California" districtNumber={null} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
  it('renders 1st/2nd/3rd correctly', () => {
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={1} />)
    expect(screen.getByText("Texas's 1st District")).toBeTruthy()
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={2} />)
    expect(screen.getByText("Texas's 2nd District")).toBeTruthy()
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={3} />)
    expect(screen.getByText("Texas's 3rd District")).toBeTruthy()
    render(<DistrictBadge chamber="house" stateName="Texas" districtNumber={21} />)
    expect(screen.getByText("Texas's 21st District")).toBeTruthy()
  })
})
