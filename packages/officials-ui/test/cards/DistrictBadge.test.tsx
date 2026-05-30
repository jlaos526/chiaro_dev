import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DistrictBadge } from '../../src/cards/DistrictBadge.tsx'

describe('DistrictBadge — federal', () => {
  it('house variant renders district ordinal', () => {
    const { getByText } = render(
      <DistrictBadge chamber="federal_house" stateName="California" stateAbbrev="CA" districtNumber={11} />,
    )
    expect(getByText("California's 11th District")).toBeTruthy()
  })
  it('senate variant renders state name only', () => {
    const { getByText } = render(
      <DistrictBadge chamber="federal_senate" stateName="California" stateAbbrev="CA" districtNumber={null} />,
    )
    expect(getByText('California')).toBeTruthy()
  })
  it('at-large house variant', () => {
    const { getByText } = render(
      <DistrictBadge chamber="federal_house" stateName="Wyoming" stateAbbrev="WY" districtNumber={null} atLarge={true} />,
    )
    expect(getByText("Wyoming's At-Large District")).toBeTruthy()
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

describe('DistrictBadge — slice 46 token wiring', () => {
  it('pin fill uses semantic.icon.location in light mode', () => {
    const { container } = render(
      <DistrictBadge chamber="federal_house" stateName="California" stateAbbrev="CA" districtNumber={11} />,
    )
    const path = container.querySelector('svg path') as SVGPathElement | null
    expect(path).not.toBeNull()
    // SVG fill attribute is a direct hex literal (NOT RNW-normalized).
    expect(path?.getAttribute('fill')).toBe('#e74c3c')
  })

  it('text color uses semantic.text.body in light mode', () => {
    const { container, getByText } = render(
      <DistrictBadge chamber="federal_house" stateName="California" stateAbbrev="CA" districtNumber={11} />,
    )
    const text = getByText("California's 11th District") as HTMLElement
    const style = text.getAttribute('style') ?? ''
    // RNW normalizes #3a322c (semantic.text.body light) to rgb(58, 50, 44).
    expect(style).toMatch(/color:\s*rgb\(58,\s*50,\s*44\)/)
  })
})
