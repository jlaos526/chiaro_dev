import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalLeadershipList } from '../../src/federal/FederalLeadershipList.tsx'

describe('FederalLeadershipList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalLeadershipList rows={[]} />)
    expect(getByText(/No leadership positions on file/i)).toBeTruthy()
  })

  it('renders role + date range with present when end_date is null', () => {
    const rows = [{
      id: 'l1', official_id: 'oid',
      role: 'Chair, Committee on Ways and Means',
      chamber: 'federal_house', party: 'D',
      start_date: '2023-01-03', end_date: null,
      source_url: 'https://congress.gov/x',
    }] as never[]
    const { getByText } = render(<FederalLeadershipList rows={rows} />)
    expect(getByText(/Chair, Committee on Ways and Means/)).toBeTruthy()
    expect(getByText(/2023-01-03 – present/)).toBeTruthy()
  })

  it('renders end_date when present', () => {
    const rows = [{
      id: 'l1', official_id: 'oid',
      role: 'Ranking Member, Energy and Commerce',
      chamber: 'federal_house', party: 'D',
      start_date: '2021-01-03', end_date: '2023-01-03',
      source_url: 'https://congress.gov/x',
    }] as never[]
    const { getByText } = render(<FederalLeadershipList rows={rows} />)
    expect(getByText(/2021-01-03 – 2023-01-03/)).toBeTruthy()
  })
})
