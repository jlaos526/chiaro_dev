import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalDistrictOfficesList } from '../../src/federal/FederalDistrictOfficesList.tsx'

describe('FederalDistrictOfficesList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalDistrictOfficesList rows={[]} />)
    expect(getByText(/No district offices on file/i)).toBeTruthy()
  })

  it('renders address + city/state + phone', () => {
    const rows = [{
      id: 'o1', official_id: 'oid',
      address: '123 Main St', city: 'San Jose', state: 'CA', zip: '95110',
      phone: '408-555-1212', source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<FederalDistrictOfficesList rows={rows} />)
    expect(getByText(/District Office · San Jose, CA/)).toBeTruthy()
    expect(getByText(/123 Main St/)).toBeTruthy()
    expect(getByText(/408-555-1212/)).toBeTruthy()
  })

  it('omits phone block when null', () => {
    const rows = [{
      id: 'o1', official_id: 'oid',
      address: '123 Main St', city: 'Reno', state: 'NV', zip: null,
      phone: null, source_url: 'https://x',
    }] as never[]
    const { getByText, queryByText } = render(<FederalDistrictOfficesList rows={rows} />)
    expect(getByText(/Reno, NV/)).toBeTruthy()
    expect(queryByText(/408-555-1212/)).toBeNull()
  })
})
