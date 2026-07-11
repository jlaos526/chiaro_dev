import type { AlignmentTier } from '@chiaro/ui-tokens'
import { scoreToTier, titleCaseIssueArea } from '@chiaro/ui-tokens'
import type { Database } from '@chiaro/db'
import type { OfficialWithDistrict } from './types.ts'
import { isFederalLevel, isStateLevel } from './types.ts'

/**
 * Per-issue-area alignment chip for display on bio / officials cards.
 * Type lives in @chiaro/officials so shared UI components in
 * @chiaro/officials-ui can consume it without depending on app-side code.
 */
export interface AlignmentChipRow {
  issueArea: string
  displayLabel: string
  tier: AlignmentTier
  subCascadeSlug: string
}

type Rating = Database['public']['Tables']['scorecard_ratings']['Row'] & {
  org: Pick<Database['public']['Tables']['scorecard_orgs']['Row'], 'issue_area' | 'scoring_max'>
}

function ratingToChip(r: Rating): AlignmentChipRow {
  const tier = scoreToTier(r.score, r.org.scoring_max)
  return {
    issueArea: r.org.issue_area,
    displayLabel: titleCaseIssueArea(r.org.issue_area),
    tier,
    subCascadeSlug: r.org.issue_area,
  }
}

function tierIntensity(tier: AlignmentTier): number {
  if (tier === 'strongly-aligned') return 2
  if (tier === 'mostly-aligned') return 1
  if (tier === 'mixed') return 0
  if (tier === 'mostly-differs') return -1
  return -2
}

export function selectTopAlignmentChips(ratings: ReadonlyArray<Rating>): AlignmentChipRow[] {
  if (ratings.length === 0) return []

  // 1. Group by issue area; keep the strongest-signal rating per area.
  const byArea = new Map<string, Rating>()
  for (const r of ratings) {
    const existing = byArea.get(r.org.issue_area)
    if (!existing) {
      byArea.set(r.org.issue_area, r)
      continue
    }
    const existingPct = (existing.score / existing.org.scoring_max) * 100
    const candPct = (r.score / r.org.scoring_max) * 100
    if (Math.abs(candPct - 50) > Math.abs(existingPct - 50)) {
      byArea.set(r.org.issue_area, r)
    }
  }

  const grouped = Array.from(byArea.values()).map(ratingToChip)
  if (grouped.length <= 1) return grouped

  // 2. Sort by tier intensity descending (strongest aligned first).
  const byHighFirst = [...grouped].sort((a, b) => tierIntensity(b.tier) - tierIntensity(a.tier))
  const highest = byHighFirst[0]
  if (!highest) return []

  // 3. Look for a strong-differs / mostly-differs.
  const lowest = byHighFirst.find((c) => tierIntensity(c.tier) < 0) ?? null

  // 4. Third pick = next-highest excluding the two already picked.
  const picks: AlignmentChipRow[] = [highest]
  if (lowest && lowest.issueArea !== highest.issueArea) picks.push(lowest)
  for (const c of byHighFirst) {
    if (picks.some((p) => p.issueArea === c.issueArea)) continue
    picks.push(c)
    if (picks.length === 3) break
  }
  return picks
}

const STATE_ORDER: Record<string, number> = {
  state_house: 0,
  state_senate: 1,
  state_legislature: 2,
}

const FEDERAL_ORDER: Record<string, number> = {
  federal_house: 0,
  federal_senate: 1,
}

function compareByChamber(orderMap: Record<string, number>) {
  return (a: OfficialWithDistrict, b: OfficialWithDistrict) =>
    (orderMap[a.chamber] ?? 99) - (orderMap[b.chamber] ?? 99)
}

export interface OfficialsByLevel {
  federal: OfficialWithDistrict[]
  state: OfficialWithDistrict[]
}

export function groupOfficialsByLevel(officials: OfficialWithDistrict[]): OfficialsByLevel {
  const federal: OfficialWithDistrict[] = []
  const state: OfficialWithDistrict[] = []
  for (const o of officials) {
    if (isFederalLevel(o.chamber)) federal.push(o)
    else if (isStateLevel(o.chamber)) state.push(o)
  }
  federal.sort(compareByChamber(FEDERAL_ORDER))
  state.sort(compareByChamber(STATE_ORDER))
  return { federal, state }
}
