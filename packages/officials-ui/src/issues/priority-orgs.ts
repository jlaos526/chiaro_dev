import type { IssueTopic, UserIssueSelectionRow } from '@chiaro/issues'

/**
 * Given the user's issue selections and the full issue catalog, return the set
 * of scorecard org slugs the user cares about.
 *
 * Matching mirrors the scoring path EXACTLY: a selection is matched to a lens by
 * `(topic_slug, lens_slug)`, then every `measurement_sources[]` of type
 * `'scorecard'` contributes its `config.orgs[]`. Using the same org slugs that
 * drive `get_rep_issue_alignment` keeps the ★ tags and the alignment % from ever
 * disagreeing.
 *
 * Returns an EMPTY set when there are no selections (or no catalog) — callers
 * rely on this to keep the no-selections path identical to pre-slice-52 behavior.
 */
export function computePriorityOrgSlugs(
  selections: UserIssueSelectionRow[] | undefined,
  catalog: IssueTopic[] | undefined,
): Set<string> {
  const slugs = new Set<string>()
  if (!selections || selections.length === 0 || !catalog || catalog.length === 0) {
    return slugs
  }

  // Selected (topic_slug, lens_slug) pairs.
  const selected = new Set<string>()
  for (const s of selections) {
    selected.add(`${s.topic_slug}::${s.lens_slug}`)
  }

  for (const topic of catalog) {
    for (const lens of topic.lenses) {
      if (!selected.has(`${lens.topic_slug}::${lens.slug}`)) continue
      for (const source of lens.measurement_sources) {
        if (source.type !== 'scorecard') continue
        for (const org of source.config.orgs ?? []) {
          slugs.add(org)
        }
      }
    }
  }
  return slugs
}

/**
 * Stable matched-first partition: rows whose org slug is in `prioritySlugs`
 * come first (in their original relative order), then the rest (also in their
 * original order). When `prioritySlugs` is empty this returns the input order
 * unchanged (a new array with identical element order).
 */
export function sortPriorityFirst<T>(
  rows: readonly T[],
  orgSlugOf: (row: T) => string | null | undefined,
  prioritySlugs: Set<string>,
): T[] {
  if (prioritySlugs.size === 0) return rows.slice()
  const matched: T[] = []
  const rest: T[] = []
  for (const row of rows) {
    const slug = orgSlugOf(row)
    if (slug != null && prioritySlugs.has(slug)) matched.push(row)
    else rest.push(row)
  }
  return [...matched, ...rest]
}
