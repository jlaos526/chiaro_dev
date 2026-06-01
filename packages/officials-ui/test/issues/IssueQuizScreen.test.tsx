import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { IssueLens, IssueTopic, QuizAnswer, QuizQuestion } from '@chiaro/issues'
import { IssueQuizScreen } from '../../src/issues/IssueQuizScreen.tsx'
import { IssueFlowProvider, useIssueFlow } from '../../src/issues/IssueFlowProvider.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

function mkQ(slug: string, prompt: string, display_order = 0): QuizQuestion {
  return { slug, prompt, agree_direction: 1, display_order }
}

function mkLens(
  slug: string,
  label: string,
  lens_type: 'stance' | 'watchlist',
  quiz_questions: QuizQuestion[],
): IssueLens {
  return {
    slug,
    topic_slug: 'environment',
    label,
    lens_type,
    description: '',
    measurement_sources: [],
    quiz_questions,
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
      // SELECTED stance lens → its questions appear.
      mkLens('conservation', 'Conservation', 'stance', [
        mkQ('q-protect', 'We should protect more public land.', 0),
        mkQ('q-emissions', 'Emissions caps are worth the cost.', 1),
      ]),
      // SELECTED watchlist lens → NOT scored, contributes NO questions.
      mkLens('industry-watch', 'Industry Watch', 'watchlist', [mkQ('q-watch', 'Should not appear.', 0)]),
      // UNSELECTED stance lens → its questions must NOT appear.
      mkLens('renewables', 'Renewables', 'stance', [mkQ('q-renew', 'Also should not appear.', 0)]),
    ],
  },
] as unknown as IssueTopic[]

/** Seeds selected topics + lenses inside the provider; surfaces the answers. */
function Harness({
  lenses,
  children,
}: {
  lenses: Record<string, string[]>
  children: ReactNode
}): React.JSX.Element {
  const flow = useIssueFlow()
  return (
    <div>
      <div data-testid="answers">{JSON.stringify(flow.answers)}</div>
      <button
        onClick={() => {
          for (const [topicSlug, lensSlugs] of Object.entries(lenses)) {
            flow.toggleTopic(topicSlug)
            for (const lensSlug of lensSlugs) flow.toggleLens(topicSlug, lensSlug)
          }
        }}
      >
        seed
      </button>
      {children}
    </div>
  )
}

function answers(testid: HTMLElement): QuizAnswer[] {
  return JSON.parse(testid.textContent ?? '[]') as QuizAnswer[]
}

describe('IssueQuizScreen', () => {
  it('builds questions ONLY from selected stance lenses (skips watchlist + unselected)', () => {
    const { getByText, queryByText } = wrap(
      <IssueFlowProvider>
        <Harness lenses={{ environment: ['conservation', 'industry-watch'] }}>
          <IssueQuizScreen catalog={CATALOG} onFinish={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed'))
    // Stance-lens questions appear.
    expect(getByText('We should protect more public land.')).toBeTruthy()
    expect(getByText('Emissions caps are worth the cost.')).toBeTruthy()
    // Watchlist question + unselected-stance question do NOT.
    expect(queryByText('Should not appear.')).toBeNull()
    expect(queryByText('Also should not appear.')).toBeNull()
  })

  it('pressing Agree records the answer via setAnswer', () => {
    const { getByText, getAllByText, getByTestId } = wrap(
      <IssueFlowProvider>
        <Harness lenses={{ environment: ['conservation'] }}>
          <IssueQuizScreen catalog={CATALOG} onFinish={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed'))
    // First question's "Agree" (multiple cards each have one).
    fireEvent.click(getAllByText('Agree')[0]!)
    const recorded = answers(getByTestId('answers'))
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      topicSlug: 'environment',
      lensSlug: 'conservation',
      questionSlug: 'q-protect',
      answer: 'agree',
      starred: false,
    })
  })

  it('the star toggle flips `starred` on the answer (extra weight)', () => {
    const { getByText, getAllByText, getAllByRole, getByTestId } = wrap(
      <IssueFlowProvider>
        <Harness lenses={{ environment: ['conservation'] }}>
          <IssueQuizScreen catalog={CATALOG} onFinish={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed'))
    fireEvent.click(getAllByText('Agree')[0]!)
    // Star buttons are tagged; press the first.
    const stars = getAllByRole('button').filter((b) => b.getAttribute('data-star-toggle') != null)
    expect(stars.length).toBeGreaterThan(0)
    fireEvent.click(stars[0]!)
    const recorded = answers(getByTestId('answers'))
    expect(recorded[0]?.starred).toBe(true)
  })

  it('"See my radar" is disabled until EVERY question is answered (skip counts), then calls onFinish', () => {
    const onFinish = vi.fn()
    const { getByText, getAllByText } = wrap(
      <IssueFlowProvider>
        <Harness lenses={{ environment: ['conservation'] }}>
          <IssueQuizScreen catalog={CATALOG} onFinish={onFinish} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed'))
    const finish = getByText(/see my radar/i)
    // No answers → disabled, pressing is a no-op.
    fireEvent.click(finish)
    expect(onFinish).not.toHaveBeenCalled()
    // Answer only the first question → still incomplete.
    fireEvent.click(getAllByText('Agree')[0]!)
    fireEvent.click(getByText(/see my radar/i))
    expect(onFinish).not.toHaveBeenCalled()
    // Skip the second question → now all answered (skip counts as answered).
    fireEvent.click(getAllByText('Skip')[1]!)
    fireEvent.click(getByText(/see my radar/i))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('shows progress as answered / total', () => {
    const { getByText, getAllByText } = wrap(
      <IssueFlowProvider>
        <Harness lenses={{ environment: ['conservation'] }}>
          <IssueQuizScreen catalog={CATALOG} onFinish={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed'))
    expect(getByText(/0\s*\/\s*2/)).toBeTruthy()
    fireEvent.click(getAllByText('Agree')[0]!)
    expect(getByText(/1\s*\/\s*2/)).toBeTruthy()
  })

  it('the chosen answer reflects aria-pressed selected state', () => {
    const { getByText, getAllByText, getAllByRole } = wrap(
      <IssueFlowProvider>
        <Harness lenses={{ environment: ['conservation'] }}>
          <IssueQuizScreen catalog={CATALOG} onFinish={() => {}} />
        </Harness>
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText('seed'))
    fireEvent.click(getAllByText('Agree')[0]!)
    const agreeBtn = getAllByRole('button').find(
      (b) => b.textContent === 'Agree' && b.getAttribute('aria-pressed') === 'true',
    )
    expect(agreeBtn).toBeTruthy()
  })

  it('renders under a dark wrapper without throwing', () => {
    const darkWrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)
    expect(() =>
      render(
        <IssueFlowProvider>
          <Harness lenses={{ environment: ['conservation'] }}>
            <IssueQuizScreen catalog={CATALOG} onFinish={() => {}} />
          </Harness>
        </IssueFlowProvider>,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
