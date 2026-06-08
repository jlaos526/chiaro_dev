import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// `/issues` is a 'use client' stepper island — no server-side auth guard.
// Mock the @chiaro/officials-ui flow screens as divs so we exercise the page's
// own wiring (provider + step state) without pulling the RNW component tree.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@chiaro/officials-ui', () => ({
  useChiaroClient: () => ({}),
  IssueFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="issue-flow-provider">{children}</div>
  ),
  IssueWelcomeScreen: () => <div data-testid="issue-welcome-screen" />,
  TopicPickerScreen: () => <div data-testid="topic-picker-screen" />,
  LensPickerScreen: () => <div data-testid="lens-picker-screen" />,
  IssueQuizScreen: () => <div data-testid="issue-quiz-screen" />,
  IssueRadarResultScreen: () => <div data-testid="issue-radar-result-screen" />,
}))

vi.mock('@chiaro/issues', () => ({
  useIssueCatalog: () => ({ data: [] }),
  useMySelections: () => ({ data: null }),
  useSaveSelections: () => ({ mutateAsync: vi.fn() }),
}))

import IssuesPage from '../../app/issues/page'

describe('issues page', () => {
  it('mounts the flow provider + welcome step for the initial render', () => {
    const { container } = render(<IssuesPage />)
    expect(container.querySelector('[data-testid="issue-flow-provider"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="issue-welcome-screen"]')).toBeTruthy()
  })

  it('only renders the welcome step (not later steps) on first mount', () => {
    const { container } = render(<IssuesPage />)
    expect(container.querySelector('[data-testid="topic-picker-screen"]')).toBeNull()
    expect(container.querySelector('[data-testid="issue-radar-result-screen"]')).toBeNull()
  })
})
