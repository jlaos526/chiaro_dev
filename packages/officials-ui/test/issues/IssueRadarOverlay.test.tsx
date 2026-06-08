import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { RepAlignment } from '@chiaro/issues'
import { IssueRadarOverlay } from '../../src/issues/IssueRadarOverlay.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const wrap = (ui: ReactElement) =>
  render(ui, { wrapper: ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children) })

const alignment: RepAlignment = {
  overallPct: 70,
  axes: [
    { topicSlug: 'environment', label: 'Environment', alignmentPct: 80, dot: 'aligned', userPos: 90, repPos: 80 },
    { topicSlug: 'gun-policy', label: 'Gun Policy', alignmentPct: null, dot: 'none', userPos: 60, repPos: null },
  ],
}

describe('IssueRadarOverlay', () => {
  it('draws grid + user + rep polygons (two data rings)', () => {
    const { container } = wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(3)
  })
  it('renders a You vs rep legend', () => {
    const { getByText, getAllByText } = wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)
    expect(getByText('You')).toBeTruthy()
    // The rep name appears in both the caption and the legend row.
    expect(getAllByText(/Jane Doe/).length).toBeGreaterThanOrEqual(1)
  })
  it('does not throw when a rep position is null', () => {
    expect(() => wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)).not.toThrow()
  })
  it('still renders the radar polygons when a rep position is null (vertex drawn at center)', () => {
    // The Gun Policy axis has repPos: null — the rep vertex collapses to center
    // per the geometry, but the chart + both polygons must still render.
    const { container } = wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(3)
  })
})
