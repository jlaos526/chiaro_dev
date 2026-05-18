import { describe, expect, it } from 'vitest'
import type { Database } from '@chiaro/db'
import { selectTopAlignmentChips, type AlignmentChipRow } from '@/lib/derivations/alignment'

type Rating = Database['public']['Tables']['scorecard_ratings']['Row'] & {
  org: Database['public']['Tables']['scorecard_orgs']['Row']
}

function rating(score: number, issueArea: string, name = 'Org', max = 100): Rating {
  return {
    id: 'r-' + Math.random(),
    scorecard_id: 's-' + issueArea,
    official_id: 'o1',
    congress: '119',
    score,
    source_url: 'https://example.org',
    ingested_at: '2026-01-01',
    org: {
      id: 's-' + issueArea,
      slug: issueArea,
      name,
      issue_area: issueArea,
      lean: 'progressive',
      methodology_url: 'https://example.org/method',
      scoring_min: 0,
      scoring_max: max,
      notes: null,
    },
  } as Rating
}

describe('selectTopAlignmentChips', () => {
  it('returns [] when input is empty', () => {
    expect(selectTopAlignmentChips([])).toEqual([])
  })

  it('picks highest, lowest, then next-highest when there is a strong-differs', () => {
    const ratings = [
      rating(95, 'environment', 'LCV'),
      rating(0,  'second-amendment', 'NRA'),
      rating(90, 'civil-rights', 'NAACP'),
      rating(85, 'civil-liberties', 'ACLU'),
    ]
    const picks = selectTopAlignmentChips(ratings)
    expect(picks).toHaveLength(3)
    expect(picks[0]?.issueArea).toBe('environment')
    expect(picks[1]?.issueArea).toBe('second-amendment')
    expect(picks[2]?.issueArea).toBe('civil-rights')
  })

  it('picks 3 highest when no strong-differs exists', () => {
    const ratings = [
      rating(95, 'environment'),
      rating(90, 'civil-rights'),
      rating(85, 'civil-liberties'),
      rating(70, 'labor'),
    ]
    const picks = selectTopAlignmentChips(ratings)
    expect(picks.map(p => p.issueArea)).toEqual(['environment', 'civil-rights', 'civil-liberties'])
  })

  it('returns 1 chip when only 1 rating exists', () => {
    const picks = selectTopAlignmentChips([rating(95, 'environment')])
    expect(picks).toHaveLength(1)
  })

  it('each chip carries tier + display label + sub-cascade slug', () => {
    const picks = selectTopAlignmentChips([rating(92, 'environment', 'LCV')])
    expect(picks[0]).toEqual<AlignmentChipRow | undefined>({
      issueArea: 'environment',
      displayLabel: 'Environment',
      tier: 'strongly-aligned',
      subCascadeSlug: 'environment',
    })
  })

  it('groups duplicate issue areas by picking the strongest signal per area', () => {
    const ratings = [
      rating(95, 'environment', 'LCV'),
      rating(60, 'environment', 'Sierra Club'),
      rating(0, 'second-amendment', 'NRA'),
    ]
    const picks = selectTopAlignmentChips(ratings)
    expect(picks.filter(p => p.issueArea === 'environment')).toHaveLength(1)
    expect(picks[0]?.tier).toBe('strongly-aligned')
  })
})
