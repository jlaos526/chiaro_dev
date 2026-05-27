import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateEthicsComplaintsList } from '../../src/state/StateEthicsComplaintsList.tsx'

describe('StateEthicsComplaintsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateEthicsComplaintsList rows={[]} />)
    expect(getByText(/No ethics complaints on file/i)).toBeTruthy()
  })

  it('renders complaint with status chip + summary', () => {
    const rows = [{
      id: 'c1',
      complaint_date: '2026-03-01',
      status: 'open',
      summary: 'Failed to disclose income.',
      disposition: null,
    }] as never[]
    const { getByText } = render(<StateEthicsComplaintsList rows={rows} />)
    expect(getByText(/2026-03-01/)).toBeTruthy()
    expect(getByText(/Open/)).toBeTruthy()
    expect(getByText(/Failed to disclose income/)).toBeTruthy()
  })

  it('renders disposition when present', () => {
    const rows = [{
      id: 'c1', complaint_date: '2026-03-01', status: 'sanctioned',
      summary: 'X', disposition: 'Fined $1000',
    }] as never[]
    const { getByText } = render(<StateEthicsComplaintsList rows={rows} />)
    expect(getByText(/Sanctioned/)).toBeTruthy()
    expect(getByText(/Disposition: Fined \$1000/)).toBeTruthy()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateEthicsComplaintsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows = [{
      id: 'c1', complaint_date: '2026-03-01', status: 'open',
      summary: 'X', disposition: null,
    }] as never[]
    expect(() =>
      render(<StateEthicsComplaintsList rows={rows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateEthicsComplaintsList rows={rows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
