import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { QuizAnswer, UserIssueSelectionRow } from '@chiaro/issues'
import { IssueFlowProvider, useIssueFlow } from '../../src/issues/IssueFlowProvider.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (RepAlignmentStrip.test.tsx): wrap the tree
// in BrandModeOverrideContext.Provider to pin the brand mode, rather than a
// (non-existent) TestBrandProvider helper.
const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

/** A tiny consumer that surfaces the flow state + buttons that drive it. */
function Probe(): React.JSX.Element {
  const flow = useIssueFlow()
  return (
    <div>
      <div data-testid="topics">{flow.selectedTopics.join(',')}</div>
      <div data-testid="lenses">{JSON.stringify(flow.selectedLenses)}</div>
      <div data-testid="answers">{flow.answers.length}</div>
      <button onClick={() => flow.toggleTopic('a')}>toggle-a</button>
      <button onClick={() => flow.toggleTopic('b')}>toggle-b</button>
      <button onClick={() => flow.toggleLens('a', 'l1')}>lens-a-l1</button>
      <button
        onClick={() =>
          flow.setAnswer({ topicSlug: 'a', lensSlug: 'l1', questionSlug: 'q1', answer: 'agree', starred: false })
        }
      >
        ans-q1
      </button>
      <button onClick={() => flow.reset()}>reset</button>
    </div>
  )
}

describe('useIssueFlow', () => {
  it('throws when used outside the provider', () => {
    // Suppress React's error logging noise for the expected throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/IssueFlowProvider/i)
    spy.mockRestore()
  })

  it('toggleTopic adds then removes a topic', () => {
    const { getByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <Probe />
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('toggle-a'))
    expect(getByTestId('topics').textContent).toBe('a')
    fireEvent.click(getByText('toggle-a'))
    expect(getByTestId('topics').textContent).toBe('')
  })

  it('toggleLens adds then removes a lens under its topic', () => {
    const { getByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <Probe />
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('lens-a-l1'))
    expect(JSON.parse(getByTestId('lenses').textContent ?? '{}')).toEqual({ a: ['l1'] })
    fireEvent.click(getByText('lens-a-l1'))
    expect(JSON.parse(getByTestId('lenses').textContent ?? '{}')).toEqual({ a: [] })
  })

  it('setAnswer upserts by (topic,lens,question)', () => {
    function AnswerProbe(): React.JSX.Element {
      const flow = useIssueFlow()
      const a: QuizAnswer = { topicSlug: 'a', lensSlug: 'l1', questionSlug: 'q1', answer: 'agree', starred: false }
      const a2: QuizAnswer = { ...a, answer: 'disagree', starred: true }
      return (
        <div>
          <div data-testid="count">{flow.answers.length}</div>
          <div data-testid="latest">{flow.answers.map((x) => `${x.answer}/${x.starred}`).join(',')}</div>
          <button onClick={() => flow.setAnswer(a)}>set</button>
          <button onClick={() => flow.setAnswer(a2)}>reset-same-key</button>
        </div>
      )
    }
    const { getByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <AnswerProbe />
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('set'))
    expect(getByTestId('count').textContent).toBe('1')
    // Same (topic,lens,question) → replaces, does NOT append.
    fireEvent.click(getByText('reset-same-key'))
    expect(getByTestId('count').textContent).toBe('1')
    expect(getByTestId('latest').textContent).toBe('disagree/true')
  })

  it('caps selectedTopics at 6 — the 7th toggle is a no-op', () => {
    function CapProbe(): React.JSX.Element {
      const flow = useIssueFlow()
      return (
        <div>
          <div data-testid="count">{flow.selectedTopics.length}</div>
          {Array.from({ length: 7 }, (_, i) => (
            <button key={i} onClick={() => flow.toggleTopic(`t${i}`)}>{`add-t${i}`}</button>
          ))}
        </div>
      )
    }
    const { getByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <CapProbe />
      </IssueFlowProvider>,
    )
    for (let i = 0; i < 7; i++) fireEvent.click(getByText(`add-t${i}`))
    // Only 6 added; the 7th was a no-op (not added as a 7th).
    expect(getByTestId('count').textContent).toBe('6')
  })

  it('reset clears topics, lenses, and answers', () => {
    const { getByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <Probe />
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('toggle-a'))
    fireEvent.click(getByText('lens-a-l1'))
    fireEvent.click(getByText('ans-q1'))
    fireEvent.click(getByText('reset'))
    expect(getByTestId('topics').textContent).toBe('')
    expect(JSON.parse(getByTestId('lenses').textContent ?? '{}')).toEqual({})
    expect(getByTestId('answers').textContent).toBe('0')
  })

  it('hydrate (via initialSelections) pre-populates topics ordered by display_order + lenses', () => {
    const rows: UserIssueSelectionRow[] = [
      mkRow('environment', 'conservation', 1),
      mkRow('environment', 'climate-action', 1),
      mkRow('immigration', 'border-enforcement', 0),
    ]
    const { getByTestId } = wrap(
      <IssueFlowProvider initialSelections={rows}>
        <Probe />
      </IssueFlowProvider>,
    )
    // Ordered by display_order asc → immigration (0) before environment (1).
    expect(getByTestId('topics').textContent).toBe('immigration,environment')
    expect(JSON.parse(getByTestId('lenses').textContent ?? '{}')).toEqual({
      immigration: ['border-enforcement'],
      environment: ['conservation', 'climate-action'],
    })
  })

})

function mkRow(topic_slug: string, lens_slug: string, display_order: number): UserIssueSelectionRow {
  return {
    user_id: 'u1',
    topic_slug,
    lens_slug,
    display_order,
    importance: 1,
    position: null,
    selected_at: '2026-05-31T00:00:00Z',
  }
}
