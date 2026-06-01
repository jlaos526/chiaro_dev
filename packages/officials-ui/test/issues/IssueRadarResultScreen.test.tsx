import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { IssueTopic } from '@chiaro/issues'
import { IssueRadarResultScreen } from '../../src/issues/IssueRadarResultScreen.tsx'
import { IssueFlowProvider } from '../../src/issues/IssueFlowProvider.tsx'
import { useIssueFlow } from '../../src/issues/IssueFlowProvider.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (see IssueRadarChart.test.tsx +
// RepAlignmentStrip.test.tsx): wrap the tree in BrandModeOverrideContext.Provider
// to pin the brand mode rather than a (non-existent) TestBrandProvider helper.
const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

/**
 * A tiny in-tree seeder: renders inside the provider and drives the wizard
 * state (toggle topics/lenses, set answers) before the assertions run. This is
 * the officials-ui idiom for pre-loading flow state without reaching into the
 * provider's internals.
 */
function Seed({ run }: { run: (flow: ReturnType<typeof useIssueFlow>) => void }): null {
  const flow = useIssueFlow()
  run(flow)
  return null
}

// A catalog with one topic (environment) holding one STANCE lens (conservation)
// with two quiz questions, plus a WATCHLIST lens (regulation) with none.
const CATALOG: IssueTopic[] = [
  {
    slug: 'environment',
    display_name: 'Environment',
    description: 'env',
    display_order: 1,
    active: true,
    value_tags: [],
    lenses: [
      {
        slug: 'conservation',
        topic_slug: 'environment',
        label: 'Conservation',
        description: null,
        display_order: 1,
        active: true,
        lens_type: 'stance',
        evidence_sources: [] as never,
        measurement_sources: [],
        quiz_questions: [
          { slug: 'q1', prompt: 'Protect more land?', agree_direction: 1, display_order: 1 },
          { slug: 'q2', prompt: 'Cut protections?', agree_direction: -1, display_order: 2 },
        ],
      },
      {
        slug: 'regulation',
        topic_slug: 'environment',
        label: 'Regulation',
        description: null,
        display_order: 2,
        active: true,
        lens_type: 'watchlist',
        evidence_sources: [] as never,
        measurement_sources: [],
        quiz_questions: [],
      },
    ],
  },
] as IssueTopic[]

describe('IssueRadarResultScreen', () => {
  it('saves the derived selections (empty flow → empty array payload)', () => {
    const onSave = vi.fn()
    const { getByText } = wrap(
      <IssueFlowProvider>
        <IssueRadarResultScreen catalog={[] as never} onSave={onSave} />
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText(/save/i))
    expect(onSave).toHaveBeenCalledWith(expect.any(Array))
    expect(onSave.mock.calls[0]![0]).toEqual([])
  })

  it('builds a stance row with derived position + importance, watchlist row with null/1', () => {
    const onSave = vi.fn()
    const { getByText } = wrap(
      <IssueFlowProvider>
        <Seed
          run={(flow) => {
            flow.toggleTopic('environment')
            flow.toggleLens('environment', 'conservation')
            flow.toggleLens('environment', 'regulation')
            // Both stance answers agree with the topic direction → position 100.
            // Star one → importance 2.
            flow.setAnswer({
              topicSlug: 'environment',
              lensSlug: 'conservation',
              questionSlug: 'q1',
              answer: 'agree', // agree_direction +1 → 1
              starred: true,
            })
            flow.setAnswer({
              topicSlug: 'environment',
              lensSlug: 'conservation',
              questionSlug: 'q2',
              answer: 'disagree', // agree_direction -1 → 1
              starred: false,
            })
          }}
        />
        <IssueRadarResultScreen catalog={CATALOG} onSave={onSave} />
      </IssueFlowProvider>,
    )
    fireEvent.click(getByText(/save/i))
    const payload = onSave.mock.calls[0]![0]
    expect(payload).toEqual(
      expect.arrayContaining([
        {
          topic_slug: 'environment',
          lens_slug: 'conservation',
          display_order: 0,
          position: 100,
          importance: 2,
        },
        {
          topic_slug: 'environment',
          lens_slug: 'regulation',
          display_order: 0,
          position: null,
          importance: 1,
        },
      ]),
    )
    // One row per selected lens — no extras.
    expect(payload).toHaveLength(2)
  })

  it('renders a radar with one axis per selected topic', () => {
    const onSave = vi.fn()
    const { container } = wrap(
      <IssueFlowProvider>
        <Seed
          run={(flow) => {
            flow.toggleTopic('environment')
            flow.toggleLens('environment', 'conservation')
            flow.setAnswer({
              topicSlug: 'environment',
              lensSlug: 'conservation',
              questionSlug: 'q1',
              answer: 'agree',
              starred: false,
            })
          }}
        />
        <IssueRadarResultScreen catalog={CATALOG} onSave={onSave} />
      </IssueFlowProvider>,
    )
    // grid + user polygon (no rep) = 2 polygons.
    expect(container.querySelectorAll('polygon').length).toBe(2)
    // one spoke per axis (single topic → 1 spoke).
    expect(container.querySelectorAll('line').length).toBe(1)
  })

  it('shows the "Your issue priorities" heading', () => {
    const { getByText } = wrap(
      <IssueFlowProvider>
        <IssueRadarResultScreen catalog={[] as never} onSave={vi.fn()} />
      </IssueFlowProvider>,
    )
    expect(getByText(/your issue priorities/i)).toBeTruthy()
  })

  it('renders under the dark wrapper without throwing', () => {
    const darkWrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)
    expect(() =>
      render(
        <IssueFlowProvider>
          <IssueRadarResultScreen catalog={CATALOG} onSave={vi.fn()} />
        </IssueFlowProvider>,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
