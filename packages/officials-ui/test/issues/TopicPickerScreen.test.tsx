import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { IssueTopic } from '@chiaro/issues'
import { TopicPickerScreen } from '../../src/issues/TopicPickerScreen.tsx'
import { IssueFlowProvider, useIssueFlow } from '../../src/issues/IssueFlowProvider.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (RepAlignmentStrip.test.tsx): wrap the tree
// in BrandModeOverrideContext.Provider to pin the brand mode.
const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

const TOPICS = Array.from({ length: 8 }, (_, i) => ({
  slug: `t${i}`,
  display_name: `Topic ${i}`,
  description: '',
  value_tags: [],
  display_order: i,
  active: true,
  lenses: [],
})) as unknown as IssueTopic[]

/** Surfaces the live selected-topic count alongside the screen for assertions. */
function CountReadout(): React.JSX.Element {
  const flow = useIssueFlow()
  return <div data-testid="count">{flow.selectedTopics.length}</div>
}

/** All topic-card buttons (tagged via `data-topic-card`), excluding Continue. */
function topicCards(all: HTMLElement[]): HTMLElement[] {
  return all.filter((el) => el.getAttribute('data-topic-card') != null)
}

/** A single topic card by index; throws (not `undefined`) if out of range so
 *  the call sites stay clean under `noUncheckedIndexedAccess`. */
function card(all: HTMLElement[], n: number): HTMLElement {
  const el = topicCards(all)[n]
  if (el == null) throw new Error(`no topic card at index ${n}`)
  return el
}

describe('TopicPickerScreen', () => {
  it('caps selection at 6 — a 7th card press does not select', () => {
    const { getAllByRole, getByTestId } = wrap(
      <IssueFlowProvider>
        <TopicPickerScreen topics={TOPICS} onNext={() => {}} />
        <CountReadout />
      </IssueFlowProvider>,
    )
    const all = getAllByRole('button')
    for (let i = 0; i < 7; i++) fireEvent.click(card(all, i))
    // Only 6 selected; the 7th press was a no-op.
    expect(getByTestId('count').textContent).toBe('6')
  })

  it('shows a "6 / 6" counter when at the cap', () => {
    const { getAllByRole, getByText } = wrap(
      <IssueFlowProvider>
        <TopicPickerScreen topics={TOPICS} onNext={() => {}} />
      </IssueFlowProvider>,
    )
    const all = getAllByRole('button')
    for (let i = 0; i < 6; i++) fireEvent.click(card(all, i))
    expect(getByText(/6\s*\/\s*6/)).toBeTruthy()
  })

  it('starts at "0 / 6" and shows incremental counts', () => {
    const { getAllByRole, getByText } = wrap(
      <IssueFlowProvider>
        <TopicPickerScreen topics={TOPICS} onNext={() => {}} />
      </IssueFlowProvider>,
    )
    expect(getByText(/0\s*\/\s*6/)).toBeTruthy()
    const all = getAllByRole('button')
    fireEvent.click(card(all, 0))
    expect(getByText(/1\s*\/\s*6/)).toBeTruthy()
  })

  it('Continue is disabled with 0 topics and enabled after picking ≥1', () => {
    const onNext = vi.fn()
    const { getAllByRole, getByText } = wrap(
      <IssueFlowProvider>
        <TopicPickerScreen topics={TOPICS} onNext={onNext} />
      </IssueFlowProvider>,
    )
    const cont = getByText('Continue')
    // Disabled at 0 → pressing does nothing.
    fireEvent.click(cont)
    expect(onNext).not.toHaveBeenCalled()
    // Pick one → Continue fires.
    const all = getAllByRole('button')
    fireEvent.click(card(all, 0))
    fireEvent.click(getByText('Continue'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('a selected card toggles back off when pressed again', () => {
    const { getAllByRole, getByText } = wrap(
      <IssueFlowProvider>
        <TopicPickerScreen topics={TOPICS} onNext={() => {}} />
      </IssueFlowProvider>,
    )
    const all = getAllByRole('button')
    fireEvent.click(card(all, 0))
    expect(getByText(/1\s*\/\s*6/)).toBeTruthy()
    fireEvent.click(card(all, 0))
    expect(getByText(/0\s*\/\s*6/)).toBeTruthy()
  })

  it('renders one card per topic', () => {
    const { getAllByRole } = wrap(
      <IssueFlowProvider>
        <TopicPickerScreen topics={TOPICS} onNext={() => {}} />
      </IssueFlowProvider>,
    )
    expect(topicCards(getAllByRole('button')).length).toBe(8)
  })

  it('renders under a dark wrapper without throwing', () => {
    const darkWrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)
    expect(() =>
      render(
        <IssueFlowProvider>
          <TopicPickerScreen topics={TOPICS} onNext={() => {}} />
        </IssueFlowProvider>,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
