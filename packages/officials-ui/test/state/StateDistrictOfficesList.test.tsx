import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateDistrictOfficesList } from '../../src/state/StateDistrictOfficesList.tsx'

function makeOffice(id: string, overrides: Partial<Record<string, unknown>> = {}): never {
  return {
    id,
    kind: 'district',
    city: 'San Jose',
    state: 'CA',
    street_1: '123 Main St',
    street_2: null,
    postal_code: '95110',
    phone: '408-555-1212',
    hours_text: null,
    ...overrides,
  } as never
}

describe('StateDistrictOfficesList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateDistrictOfficesList rows={[]} />)
    expect(getByText(/No district offices on file/i)).toBeTruthy()
  })

  it('renders district office with phone', () => {
    const { getByText } = render(<StateDistrictOfficesList rows={[makeOffice('o1')]} />)
    expect(getByText(/District Office · San Jose, CA/)).toBeTruthy()
    expect(getByText(/123 Main St/)).toBeTruthy()
    expect(getByText(/408-555-1212/)).toBeTruthy()
  })

  it('renders Capitol Office label and hours_text when present', () => {
    const rows = [makeOffice('o1', { kind: 'capitol', hours_text: 'Mon-Fri 9-5' })]
    const { getByText } = render(<StateDistrictOfficesList rows={rows} />)
    expect(getByText(/Capitol Office · San Jose, CA/)).toBeTruthy()
    expect(getByText(/Hours: Mon-Fri 9-5/)).toBeTruthy()
  })
})
