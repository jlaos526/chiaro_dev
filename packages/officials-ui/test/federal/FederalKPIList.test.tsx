import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { FederalKPIList } from '../../src/federal/FederalKPIList.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

describe('FederalKPIList', () => {
  it('renders empty state when metrics is null', () => {
    const { getByText } = render(<FederalKPIList metrics={null} />)
    expect(getByText(/No KPI data available/i)).toBeTruthy()
  })

  it('renders 5 tiles for House member', () => {
    const metrics = {
      bills_sponsored_count: 12,
      bills_cosponsored_count: 45,
      attendance_pct: 96,
      subject_breadth: 8,
      lives_in_district: true,
    } as never
    const { getByText } = render(<FederalKPIList metrics={metrics} />)
    expect(getByText(/12/)).toBeTruthy()
    expect(getByText(/96%/)).toBeTruthy()
    expect(getByText(/✓ Yes/)).toBeTruthy()
    expect(getByText(/Lives in district/)).toBeTruthy()
  })

  it('hides lives_in_district tile when hideLivesInDistrict=true (Senate)', () => {
    const metrics = {
      bills_sponsored_count: 1,
      bills_cosponsored_count: 1,
      attendance_pct: 95,
      subject_breadth: 1,
      lives_in_district: null,
    } as never
    const { queryByText } = render(<FederalKPIList metrics={metrics} hideLivesInDistrict />)
    expect(queryByText(/Lives in district/)).toBeNull()
  })

  it('em-dash NULL convention for unset metrics', () => {
    const metrics = {
      bills_sponsored_count: null,
      bills_cosponsored_count: null,
      attendance_pct: null,
      subject_breadth: null,
      lives_in_district: null,
    } as never
    const { getAllByText } = render(<FederalKPIList metrics={metrics} />)
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalKPIList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const metrics = {
      bills_sponsored_count: 12,
      bills_cosponsored_count: 45,
      attendance_pct: 96,
      subject_breadth: 8,
      lives_in_district: true,
    } as never
    expect(() =>
      render(<FederalKPIList metrics={metrics} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalKPIList metrics={metrics} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
