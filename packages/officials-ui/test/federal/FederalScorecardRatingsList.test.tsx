import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalScorecardRatingsList } from '../../src/federal/FederalScorecardRatingsList.tsx'

describe('FederalScorecardRatingsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalScorecardRatingsList rows={[]} />)
    expect(getByText(/No scorecard ratings on file/i)).toBeTruthy()
  })

  it('groups ratings by lean', () => {
    const rows = [
      {
        id: 'r1',
        score: 95,
        official_id: 'oid',
        congress: '119',
        ingested_at: '2026-01-01',
        source_url: 'https://x',
        scorecard_id: 'o1',
        org: {
          id: 'o1',
          name: 'ACLU',
          issue_area: 'civil-liberties',
          lean: 'progressive',
          scoring_max: 100,
          scoring_min: 0,
          slug: 'aclu',
          methodology_url: 'https://x',
          notes: null,
        },
      },
      {
        id: 'r2',
        score: 20,
        official_id: 'oid',
        congress: '119',
        ingested_at: '2026-01-01',
        source_url: 'https://x',
        scorecard_id: 'o2',
        org: {
          id: 'o2',
          name: 'NRA',
          issue_area: 'second-amendment',
          lean: 'conservative',
          scoring_max: 100,
          scoring_min: 0,
          slug: 'nra',
          methodology_url: 'https://x',
          notes: null,
        },
      },
    ] as never[]
    const { getByText } = render(<FederalScorecardRatingsList rows={rows} />)
    expect(getByText(/Progressive/)).toBeTruthy()
    expect(getByText(/Conservative/)).toBeTruthy()
    expect(getByText(/ACLU/)).toBeTruthy()
    expect(getByText(/NRA/)).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalScorecardRatingsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows = [
      {
        id: 'r1',
        score: 95,
        official_id: 'oid',
        congress: '119',
        ingested_at: '2026-01-01',
        source_url: 'https://x',
        scorecard_id: 'o1',
        org: {
          id: 'o1',
          name: 'ACLU',
          issue_area: 'civil-liberties',
          lean: 'progressive',
          scoring_max: 100,
          scoring_min: 0,
          slug: 'aclu',
          methodology_url: 'https://x',
          notes: null,
        },
      },
    ] as never[]
    expect(() =>
      render(<FederalScorecardRatingsList rows={rows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalScorecardRatingsList rows={rows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
