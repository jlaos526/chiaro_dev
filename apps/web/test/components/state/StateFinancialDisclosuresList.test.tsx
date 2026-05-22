import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateFinancialDisclosuresList } from '@/components/state/StateFinancialDisclosuresList'

describe('StateFinancialDisclosuresList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateFinancialDisclosuresList rows={[]} />)
    expect(getByText(/No financial disclosures on file/i)).toBeTruthy()
  })

  it('renders rows with income kind + source + amount range', () => {
    const rows = [{
      id: 'd1', official_id: 'oid', state: 'CA',
      filing_year: 2025, filing_date: '2025-03-01',
      income_source: 'Acme Consulting LLC', income_kind: 'consulting',
      amount_range_low: 10000, amount_range_high: 25000,
      source_url: 'https://x', source: 'state-disclosure',
      external_id: 'd1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText, getAllByText } = render(<StateFinancialDisclosuresList rows={rows} />)
    expect(getByText(/Acme Consulting LLC/)).toBeTruthy()
    // "Consulting" appears in source name + kind label, so use getAllByText.
    expect(getAllByText(/Consulting/).length).toBeGreaterThanOrEqual(1)
    expect(getByText(/\$10k–\$25k/)).toBeTruthy()
  })

  it('groups disclosures by filing_year descending with year header', () => {
    const rows = [
      {
        id: 'd1', official_id: 'oid', state: 'CA',
        filing_year: 2024, filing_date: '2024-03-01',
        income_source: 'Old Job', income_kind: 'salary',
        amount_range_low: 50000, amount_range_high: 100000,
        source_url: 'https://x', source: 'src',
        external_id: 'd1', ingested_at: '2026-01-01',
      },
      {
        id: 'd2', official_id: 'oid', state: 'CA',
        filing_year: 2026, filing_date: '2026-03-01',
        income_source: 'Newer Job', income_kind: 'salary',
        amount_range_low: 60000, amount_range_high: 120000,
        source_url: 'https://x', source: 'src',
        external_id: 'd2', ingested_at: '2026-01-01',
      },
      {
        id: 'd3', official_id: 'oid', state: 'CA',
        filing_year: 2026, filing_date: '2026-03-01',
        income_source: 'Side Hustle', income_kind: 'consulting',
        amount_range_low: 5000, amount_range_high: 15000,
        source_url: 'https://x', source: 'src',
        external_id: 'd3', ingested_at: '2026-01-01',
      },
    ] as never[]
    const { getByText } = render(<StateFinancialDisclosuresList rows={rows} />)
    // 2026 group has 2 disclosures
    expect(getByText(/2026 \(2 disclosures\)/)).toBeTruthy()
    // 2024 group has 1 disclosure (singular)
    expect(getByText(/2024 \(1 disclosure\)/)).toBeTruthy()
  })
})
