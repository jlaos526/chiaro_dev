import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateDistrictOfficesList } from '@/components/state/StateDistrictOfficesList'

describe('StateDistrictOfficesList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateDistrictOfficesList rows={[]} />)
    expect(getByText(/No district offices on file/i)).toBeTruthy()
  })

  it('renders office with address + phone + hours', () => {
    const rows = [{
      id: 'o1',
      official_id: 'oid',
      kind: 'district',
      street_1: '1234 Main St',
      street_2: null,
      city: 'San Jose',
      state: 'CA',
      postal_code: '95113',
      phone: '(408) 555-0100',
      email: null,
      hours_text: 'Mon-Fri 9am-5pm',
      source_url: 'https://x',
      ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateDistrictOfficesList rows={rows} />)
    expect(getByText(/District Office/i)).toBeTruthy()
    expect(getByText(/1234 Main St/)).toBeTruthy()
    expect(getByText(/\(408\) 555-0100/)).toBeTruthy()
    expect(getByText(/Mon-Fri 9am-5pm/)).toBeTruthy()
  })
})
