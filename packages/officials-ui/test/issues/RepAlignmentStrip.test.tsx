import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { RepAlignment } from '@chiaro/issues'
import { RepAlignmentStrip } from '../../src/issues/RepAlignmentStrip.tsx'
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
  axes: [{ topicSlug: 'environment', label: 'Environment', alignmentPct: 80, dot: 'aligned', userPos: 90, repPos: 80 }],
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
            { topicSlug: 'a', label: 'A', alignmentPct: 90, dot: 'aligned', userPos: 90, repPos: 85 },
            { topicSlug: 'b', label: 'B', alignmentPct: 50, dot: 'partial', userPos: 50, repPos: 40 },
            { topicSlug: 'c', label: 'C', alignmentPct: 10, dot: 'differs', userPos: 10, repPos: 80 },
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
        alignment={{ overallPct: null, axes: [{ topicSlug: 'x', label: 'X', alignmentPct: null, dot: 'none', userPos: null, repPos: null }] }}
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

// IssueRadarOverlay has its own dedicated test file (IssueRadarOverlay.test.tsx)
// covering the slice-54 two-polygon you-vs-rep rewrite.
