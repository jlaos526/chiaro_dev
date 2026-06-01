import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { RepAlignment } from '@chiaro/issues'
import { RepAlignmentStrip } from '../../src/issues/RepAlignmentStrip.tsx'
import { IssueRadarOverlay } from '../../src/issues/IssueRadarOverlay.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (see BioPortrait.test.tsx + IssueRadarChart
// .test.tsx): wrap the tree in BrandModeOverrideContext.Provider to pin the
// brand mode, rather than a (non-existent) TestBrandProvider helper.
const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

const ALIGNED: RepAlignment = {
  overallPct: 72,
  axes: [{ topicSlug: 'environment', label: 'Environment', alignmentPct: 80, dot: 'aligned' }],
}

describe('RepAlignmentStrip', () => {
  it('shows the CTA when the user has no selections', () => {
    const onSetup = vi.fn()
    const { getByText } = wrap(
      <RepAlignmentStrip
        alignment={null}
        hasSelections={false}
        onSetup={onSetup}
        onExpand={vi.fn()}
      />,
    )
    fireEvent.click(getByText(/set your issue priorities/i))
    expect(onSetup).toHaveBeenCalled()
  })

  it('shows the percent + dots when aligned', () => {
    const { getByText } = wrap(
      <RepAlignmentStrip hasSelections onExpand={vi.fn()} onSetup={vi.fn()} alignment={ALIGNED} />,
    )
    expect(getByText('72%')).toBeTruthy()
  })

  it('calls onExpand when the aligned strip is pressed', () => {
    const onExpand = vi.fn()
    const { getByText } = wrap(
      <RepAlignmentStrip
        hasSelections
        onExpand={onExpand}
        onSetup={vi.fn()}
        alignment={ALIGNED}
      />,
    )
    fireEvent.click(getByText('72%'))
    expect(onExpand).toHaveBeenCalled()
  })

  it('exposes aria-expanded as a direct DOM attribute (Gotcha #22)', () => {
    const { getByRole } = wrap(
      <RepAlignmentStrip
        hasSelections
        expanded
        onExpand={vi.fn()}
        onSetup={vi.fn()}
        alignment={ALIGNED}
      />,
    )
    // RNW 0.19 does not translate accessibilityState={{expanded}} → aria-expanded;
    // the component must pass the direct prop. Assert the actual DOM attribute.
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true')
  })

  it('renders one dot per axis', () => {
    const { getByRole } = wrap(
      <RepAlignmentStrip
        hasSelections
        onExpand={vi.fn()}
        onSetup={vi.fn()}
        alignment={{
          overallPct: 50,
          axes: [
            { topicSlug: 'a', label: 'A', alignmentPct: 90, dot: 'aligned' },
            { topicSlug: 'b', label: 'B', alignmentPct: 50, dot: 'partial' },
            { topicSlug: 'c', label: 'C', alignmentPct: 10, dot: 'differs' },
          ],
        }}
      />,
    )
    const dots = getByRole('button').querySelectorAll('[data-axis-dot]')
    expect(dots.length).toBe(3)
  })

  it('shows grey "no comparable record" state when overallPct is null', () => {
    const { getByText } = wrap(
      <RepAlignmentStrip
        hasSelections
        onExpand={vi.fn()}
        onSetup={vi.fn()}
        alignment={{ overallPct: null, axes: [{ topicSlug: 'x', label: 'X', alignmentPct: null, dot: 'none' }] }}
      />,
    )
    expect(getByText(/no comparable record/i)).toBeTruthy()
  })

  it('does not fire onExpand from the null-record state', () => {
    const onExpand = vi.fn()
    const { getByText } = wrap(
      <RepAlignmentStrip
        hasSelections
        onExpand={onExpand}
        onSetup={vi.fn()}
        alignment={{ overallPct: null, axes: [] }}
      />,
    )
    fireEvent.click(getByText(/no comparable record/i))
    expect(onExpand).not.toHaveBeenCalled()
  })

  it('renders under both light and dark wrappers without throwing', () => {
    const darkWrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)
    expect(() =>
      render(<RepAlignmentStrip hasSelections onExpand={vi.fn()} onSetup={vi.fn()} alignment={ALIGNED} />, {
        wrapper: darkWrapper,
      }),
    ).not.toThrow()
  })
})

describe('IssueRadarOverlay', () => {
  const THREE: RepAlignment = {
    overallPct: 60,
    axes: [
      { topicSlug: 'env', label: 'Environment', alignmentPct: 80, dot: 'aligned' },
      { topicSlug: 'gun', label: 'Gun Policy', alignmentPct: 40, dot: 'partial' },
      { topicSlug: 'imm', label: 'Immigration', alignmentPct: null, dot: 'none' },
    ],
  }

  it('renders the radar chart (single alignment ring → grid + user = 2 polygons)', () => {
    const { container } = wrap(<IssueRadarOverlay alignment={THREE} />)
    // No repValues passed → IssueRadarChart draws grid + user only.
    expect(container.querySelectorAll('polygon').length).toBe(2)
  })

  it('shows a per-rep caption when repName is provided', () => {
    const { getByText } = wrap(<IssueRadarOverlay alignment={THREE} repName="Alex Rivera" />)
    expect(getByText(/your alignment with alex rivera per issue/i)).toBeTruthy()
  })

  it('shows a generic caption when repName is omitted', () => {
    const { getByText } = wrap(<IssueRadarOverlay alignment={THREE} />)
    expect(getByText(/your alignment per issue/i)).toBeTruthy()
  })

  it('does not throw when an axis has null alignmentPct (collapses to center)', () => {
    expect(() => wrap(<IssueRadarOverlay alignment={THREE} repName="X" />)).not.toThrow()
  })

  it('threads repValues to the chart for a future true overlay (3 polygons)', () => {
    const { container } = wrap(
      <IssueRadarOverlay alignment={THREE} repName="X" repValues={[0.5, 0.5, 0.5]} />,
    )
    // grid + rep + user = 3 polygons once repValues is supplied.
    expect(container.querySelectorAll('polygon').length).toBe(3)
  })
})
