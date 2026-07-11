import { describe, it, expect } from 'vitest'
import type { IssueTopic, UserIssueSelectionRow } from '@chiaro/issues'
import { computePriorityOrgSlugs, sortPriorityFirst } from '../../src/issues/priority-orgs.ts'

function sel(topic: string, lens: string): UserIssueSelectionRow {
  return {
    topic_slug: topic,
    lens_slug: lens,
    position: 80,
    importance: 1,
    display_order: 0,
    selected_at: '2026-01-01',
    user_id: 'u1',
  }
}

// Deliberately-partial fixtures: only the fields computePriorityOrgSlugs reads
// (slug, name, lenses[].{topic_slug, slug, measurement_sources}). Cast once at
// the array level through `unknown` to skip the unused IssueTopic/IssueLens
// columns (active, description, label, …).
const CATALOG = [
  {
    slug: 'environment',
    name: 'Environment',
    display_order: 0,
    lenses: [
      {
        topic_slug: 'environment',
        slug: 'climate',
        lens_type: 'stance',
        measurement_sources: [
          { type: 'scorecard', weight: 1, config: { orgs: ['lcv', 'sierra'] } },
          { type: 'bill-vote', weight: 1, config: { subjects: ['energy'] } },
        ],
        quiz_questions: [],
      },
    ],
  },
  {
    slug: 'guns',
    name: 'Guns',
    display_order: 1,
    lenses: [
      {
        topic_slug: 'guns',
        slug: 'second-amendment',
        lens_type: 'stance',
        measurement_sources: [{ type: 'scorecard', weight: 1, config: { orgs: ['nra'] } }],
        quiz_questions: [],
      },
    ],
  },
] as unknown as IssueTopic[]

describe('computePriorityOrgSlugs', () => {
  it('returns empty set when there are no selections', () => {
    expect(computePriorityOrgSlugs([], CATALOG).size).toBe(0)
    expect(computePriorityOrgSlugs(undefined, CATALOG).size).toBe(0)
  })

  it('returns empty set when catalog is missing', () => {
    expect(computePriorityOrgSlugs([sel('environment', 'climate')], undefined).size).toBe(0)
    expect(computePriorityOrgSlugs([sel('environment', 'climate')], []).size).toBe(0)
  })

  it('collects scorecard org slugs for matched (topic,lens) pairs only', () => {
    const out = computePriorityOrgSlugs([sel('environment', 'climate')], CATALOG)
    expect([...out].sort()).toEqual(['lcv', 'sierra'])
    // bill-vote source contributes nothing; non-selected guns lens excluded.
    expect(out.has('nra')).toBe(false)
  })

  it('unions org slugs across multiple selections', () => {
    const out = computePriorityOrgSlugs(
      [sel('environment', 'climate'), sel('guns', 'second-amendment')],
      CATALOG,
    )
    expect([...out].sort()).toEqual(['lcv', 'nra', 'sierra'])
  })

  it('ignores a selection whose (topic,lens) does not match any catalog lens', () => {
    const out = computePriorityOrgSlugs([sel('environment', 'nonexistent')], CATALOG)
    expect(out.size).toBe(0)
  })
})

describe('sortPriorityFirst', () => {
  const rows = [
    { id: 'a', slug: 'x' },
    { id: 'b', slug: 'lcv' },
    { id: 'c', slug: 'y' },
    { id: 'd', slug: 'nra' },
  ]
  const slugOf = (r: { slug: string }) => r.slug

  it('returns input order unchanged (new array) when priority set is empty', () => {
    const out = sortPriorityFirst(rows, slugOf, new Set())
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(out).not.toBe(rows)
  })

  it('floats matched rows to the top, stable within both partitions', () => {
    const out = sortPriorityFirst(rows, slugOf, new Set(['lcv', 'nra']))
    // matched in original relative order (b before d), then the rest (a, c).
    expect(out.map((r) => r.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('treats null/undefined slug as non-matched', () => {
    const withNull = [
      { id: 'a', slug: null },
      { id: 'b', slug: 'lcv' },
    ]
    const out = sortPriorityFirst(
      withNull,
      (r: { slug: string | null }) => r.slug,
      new Set(['lcv']),
    )
    expect(out.map((r) => r.id)).toEqual(['b', 'a'])
  })
})
