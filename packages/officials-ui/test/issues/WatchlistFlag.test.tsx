import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { WatchlistFlag } from '../../src/issues/WatchlistFlag.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const wrap = (ui: React.ReactElement) =>
  render(ui, { wrapper: ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children) })

describe('WatchlistFlag', () => {
  it('renders the label + evidence summary', () => {
    const { getByText } = wrap(
      <WatchlistFlag flag={{ topicSlug: 'environment', lensSlug: 'industry-donor-recipients',
        label: 'Industry Donor Recipients', category: 'fossil-fuel', totalAmount: 42000,
        evidence: [{ industry: 'Oil & Gas', amount: 30000 }, { industry: 'Coal Mining', amount: 12000 }] }} />)
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
    expect(getByText(/Oil & Gas/i)).toBeTruthy()
  })
})
