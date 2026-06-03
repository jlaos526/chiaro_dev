import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { IssueTopic, UserIssueSelectionRow } from '@chiaro/issues'
import { MyIssuesCard } from '../../src/issues/MyIssuesCard.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children),
  })

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
        quiz_questions: [],
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
  {
    slug: 'healthcare',
    display_name: 'Healthcare',
    description: 'hc',
    display_order: 2,
    active: true,
    value_tags: [],
    lenses: [
      {
        slug: 'public-coverage',
        topic_slug: 'healthcare',
        label: 'Public Coverage',
        description: null,
        display_order: 1,
        active: true,
        lens_type: 'stance',
        evidence_sources: [] as never,
        measurement_sources: [],
        quiz_questions: [],
      },
    ],
  },
] as IssueTopic[]

function row(over: Partial<UserIssueSelectionRow>): UserIssueSelectionRow {
  return {
    user_id: 'u1',
    topic_slug: 'environment',
    lens_slug: 'conservation',
    display_order: 0,
    position: 80,
    importance: 1,
    selected_at: '2026-06-01T00:00:00Z',
    ...over,
  }
}

describe('MyIssuesCard', () => {
  it('renders the empty state + fires onEdit from the CTA', () => {
    const onEdit = vi.fn()
    const { getByRole } = wrap(<MyIssuesCard selections={[]} catalog={CATALOG} onEdit={onEdit} />)
    const cta = getByRole('button', { name: /set your issue priorities/i })
    expect(cta).toBeTruthy()
    fireEvent.click(cta)
    expect(onEdit).toHaveBeenCalled()
  })

  it('renders a radar preview + Edit CTA when selections exist', () => {
    const onEdit = vi.fn()
    const { container, getByText } = wrap(
      <MyIssuesCard
        selections={[
          row({ topic_slug: 'environment', lens_slug: 'conservation', position: 80 }),
          row({ topic_slug: 'healthcare', lens_slug: 'public-coverage', position: 40, display_order: 1 }),
        ]}
        catalog={CATALOG}
        onEdit={onEdit}
      />,
    )
    // grid + user polygon (no rep) = 2 polygons.
    expect(container.querySelectorAll('polygon').length).toBe(2)
    // 2 distinct topics → 2 spokes.
    expect(container.querySelectorAll('line').length).toBe(2)
    fireEvent.click(getByText(/edit priorities/i))
    expect(onEdit).toHaveBeenCalled()
  })

  it('renders one axis per distinct topic, averaging only stance positions', () => {
    const { container } = wrap(
      <MyIssuesCard
        selections={[
          // environment: stance(80) + watchlist(null) → axis value = 80/100.
          row({ topic_slug: 'environment', lens_slug: 'conservation', position: 80 }),
          row({ topic_slug: 'environment', lens_slug: 'regulation', position: null }),
        ]}
        catalog={CATALOG}
        onEdit={vi.fn()}
      />,
    )
    // 1 distinct topic → 1 spoke (watchlist row does not add an axis).
    expect(container.querySelectorAll('line').length).toBe(1)
  })

  it('renders under the dark wrapper without throwing', () => {
    const darkWrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)
    expect(() =>
      render(<MyIssuesCard selections={[row({})]} catalog={CATALOG} onEdit={vi.fn()} />, {
        wrapper: darkWrapper,
      }),
    ).not.toThrow()
  })
})
