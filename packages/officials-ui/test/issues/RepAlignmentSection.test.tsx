import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// The sibling RepAlignmentStrip.test.tsx imports source via the package's
// `../../src/...` relative convention (no vitest alias), so the mocks below
// target the same relative paths.
let mockAlignment: any
let mockSelections: any[] | undefined

vi.mock('@chiaro/issues', () => ({
  useRepAlignment: () => ({ data: mockAlignment }),
  useMySelections: () => ({ data: mockSelections }),
}))
vi.mock('../../src/client-context.tsx', () => ({ useChiaroClient: () => ({}) }))

let stripProps: any
vi.mock('../../src/issues/RepAlignmentStrip.tsx', () => ({
  RepAlignmentStrip: (p: any) => {
    stripProps = p
    return <button onClick={p.onExpand}>strip hasSelections={String(p.hasSelections)}</button>
  },
}))
vi.mock('../../src/issues/IssueRadarOverlay.tsx', () => ({
  IssueRadarOverlay: () => <div data-testid="overlay" />,
}))

import { RepAlignmentSection } from '../../src/issues/RepAlignmentSection.tsx'

describe('RepAlignmentSection', () => {
  it('passes hasSelections=false when the user has no selections', () => {
    mockAlignment = null
    mockSelections = []
    render(<RepAlignmentSection officialId="o1" onSetup={() => {}} />)
    expect(stripProps.hasSelections).toBe(false)
  })

  it('passes hasSelections=true when the user has selections', () => {
    mockAlignment = { overallPct: 72, axes: [] }
    mockSelections = [{}]
    render(<RepAlignmentSection officialId="o1" onSetup={() => {}} />)
    expect(stripProps.hasSelections).toBe(true)
  })

  it('shows the overlay only when expanded and alignment has an overallPct', () => {
    mockAlignment = { overallPct: 72, axes: [] }
    mockSelections = [{}]
    render(<RepAlignmentSection officialId="o1" repName="Rep X" onSetup={() => {}} />)
    expect(screen.queryByTestId('overlay')).toBeNull() // collapsed initially
    fireEvent.click(screen.getByText(/strip/)) // toggle expand
    expect(screen.getByTestId('overlay')).toBeTruthy()
  })

  it('suppresses the overlay when overallPct is null even if expanded', () => {
    mockAlignment = { overallPct: null, axes: [] }
    mockSelections = [{}]
    render(<RepAlignmentSection officialId="o1" onSetup={() => {}} />)
    fireEvent.click(screen.getByText(/strip/))
    expect(screen.queryByTestId('overlay')).toBeNull()
  })
})
