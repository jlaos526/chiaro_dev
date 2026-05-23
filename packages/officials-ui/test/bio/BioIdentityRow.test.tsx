import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BioIdentityRow } from '../../src/bio/BioIdentityRow.tsx'

describe('BioIdentityRow', () => {
  it('renders party short label + House label + district badge', () => {
    render(
      <BioIdentityRow
        party="D"
        chamber="federal_house"
        stateName="California"
        stateAbbrev="CA"
        districtNumber={11}
        atLarge={false}
      />,
    )
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText("California's 11th District")).toBeTruthy()
  })

  it('senate variant renders state name (no district number)', () => {
    render(
      <BioIdentityRow
        party="R"
        chamber="federal_senate"
        stateName="California"
        stateAbbrev="CA"
        districtNumber={null}
        atLarge={false}
      />,
    )
    expect(screen.getByText('Senate')).toBeTruthy()
    expect(screen.getByText('California')).toBeTruthy()
  })

  it('at-large variant renders "<state>\'s At-Large District"', () => {
    render(
      <BioIdentityRow
        party="R"
        chamber="federal_house"
        stateName="Wyoming"
        stateAbbrev="WY"
        districtNumber={null}
        atLarge={true}
      />,
    )
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
})
