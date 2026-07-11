import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { IssueLens, IssueTopic } from '@chiaro/issues'
import { LensPickerScreen } from '../../src/issues/LensPickerScreen.tsx'
import { IssueFlowProvider, useIssueFlow } from '../../src/issues/IssueFlowProvider.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (TopicPickerScreen.test.tsx): wrap the tree
// in BrandModeOverrideContext.Provider to pin the brand mode.
const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

function mkLens(
  slug: string,
  label: string,
  lens_type: 'stance' | 'watchlist' = 'stance',
): IssueLens {
  return {
    slug,
    topic_slug: 'environment',
    label,
    lens_type,
    description: '',
    measurement_sources: [],
    quiz_questions: [],
    display_order: 0,
    active: true,
  } as unknown as IssueLens
}

const CATALOG: IssueTopic[] = [
  {
    slug: 'environment',
    display_name: 'Environment',
    description: '',
    value_tags: [],
    display_order: 0,
    active: true,
    lenses: [
      mkLens('conservation', 'Conservation', 'stance'),
      mkLens('industry-watch', 'Industry Watch', 'watchlist'),
    ],
  },
  {
    slug: 'housing',
    display_name: 'Housing',
    description: '',
    value_tags: [],
    display_order: 1,
    active: true,
    lenses: [mkLens('affordability', 'Affordability', 'stance')],
  },
] as unknown as IssueTopic[]

/** Seeds `selectedTopics` from inside the provider, then surfaces the lens map. */
function Harness({
  topics,
  children,
}: {
  topics: string[]
  children: ReactNode
}): React.JSX.Element {
  const flow = useIssueFlow()
  return (
    <div>
      <div data-testid="lenses">{JSON.stringify(flow.selectedLenses)}</div>
      <button onClick={() => topics.forEach((t) => flow.toggleTopic(t))}>seed-topics</button>
      {children}
    </div>
  )
}

/** Lens rows are tagged via `data-lens-row`. */
function lensRows(all: HTMLElement[]): HTMLElement[] {
  return all.filter((el) => el.getAttribute('data-lens-row') != null)
}

describe('LensPickerScreen', () => {
  it('lists lenses for each selected topic with a lens_type badge', () => {
    const onNext = vi.fn()
    const { getByText, getAllByRole } = wrap(
      <IssueFlowProvider>
        <Harness topics={['environment']}>
          <LensPickerScreen catalog={CATALOG} onNext={onNext} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed-topics'))
    // Environment's two lenses are listed; the unselected topic (housing) is not.
    expect(getByText('Conservation')).toBeTruthy()
    expect(getByText('Industry Watch')).toBeTruthy()
    expect(() => getByText('Affordability')).toThrow()
    // Two lens rows for the one selected topic.
    expect(lensRows(getAllByRole('button')).length).toBe(2)
    // Each lens_type surfaces a distinguishing badge (exact text — avoids the
    // intro copy that also mentions "stance"/"watchlists").
    expect(getByText('Stance')).toBeTruthy()
    expect(getByText('Watchlist')).toBeTruthy()
  })

  it('toggling a lens records it via toggleLens', () => {
    const { getByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <Harness topics={['environment']}>
          <LensPickerScreen catalog={CATALOG} onNext={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed-topics'))
    fireEvent.click(getByText('Conservation'))
    expect(JSON.parse(getByTestId('lenses').textContent ?? '{}')).toEqual({
      environment: ['conservation'],
    })
    // Toggling again removes it.
    fireEvent.click(getByText('Conservation'))
    expect(JSON.parse(getByTestId('lenses').textContent ?? '{}')).toEqual({ environment: [] })
  })

  it('Continue is disabled until ≥1 lens per selected topic, then calls onNext', () => {
    const onNext = vi.fn()
    const { getByText } = wrap(
      <IssueFlowProvider>
        <Harness topics={['environment', 'housing']}>
          <LensPickerScreen catalog={CATALOG} onNext={onNext} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed-topics'))
    // Nothing picked → Continue is a no-op.
    fireEvent.click(getByText('Continue'))
    expect(onNext).not.toHaveBeenCalled()
    // Pick a lens for only ONE of the two topics → still disabled.
    fireEvent.click(getByText('Conservation'))
    fireEvent.click(getByText('Continue'))
    expect(onNext).not.toHaveBeenCalled()
    // Pick a lens for the second topic → now enabled.
    fireEvent.click(getByText('Affordability'))
    fireEvent.click(getByText('Continue'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('lens rows carry accessibilityRole="button" with selected state', () => {
    const { getByText, getAllByRole } = wrap(
      <IssueFlowProvider>
        <Harness topics={['environment']}>
          <LensPickerScreen catalog={CATALOG} onNext={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed-topics'))
    const rows = lensRows(getAllByRole('button'))
    expect(rows.length).toBe(2)
    // Not yet selected.
    expect(rows[0]?.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(getByText('Conservation'))
    const after = lensRows(getAllByRole('button'))
    expect(
      after.find((r) => r.textContent?.includes('Conservation'))?.getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('renders under a dark wrapper without throwing', () => {
    const darkWrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)
    expect(() =>
      render(
        <IssueFlowProvider>
          <Harness topics={['environment']}>
            <LensPickerScreen catalog={CATALOG} onNext={() => {}} />
          </Harness>
        </IssueFlowProvider>,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
