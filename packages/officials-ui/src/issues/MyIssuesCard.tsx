'use client'

import { StyleSheet, View } from 'react-native'
import type { IssueTopic, UserIssueSelectionRow } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { IssueRadarChart } from './IssueRadarChart.tsx'

export interface MyIssuesCardProps {
  /** The user's saved selection rows (parent fetches via `useMySelections`). */
  selections: UserIssueSelectionRow[]
  /** The full issue catalog (parent fetches via `useIssueCatalog`). */
  catalog: IssueTopic[]
  /** Enter / re-enter the issue-priorities flow (edit mode). */
  onEdit: () => void
}

/** Resolve a lens's type from the catalog ('stance' | 'watchlist' | undefined). */
function lensTypeOf(
  catalog: IssueTopic[],
  topicSlug: string,
  lensSlug: string,
): IssueTopic['lenses'][number]['lens_type'] | undefined {
  return catalog
    .find((t) => t.slug === topicSlug)
    ?.lenses.find((l) => l.slug === lensSlug)?.lens_type
}

/** A topic's human label from the catalog, falling back to the slug. */
function topicLabel(catalog: IssueTopic[], topicSlug: string): string {
  return catalog.find((t) => t.slug === topicSlug)?.display_name ?? topicSlug
}

/**
 * Build the radar axes from saved selections: one axis per distinct topic (in
 * first-seen order, which follows `display_order`), valued by the mean of that
 * topic's STANCE-lens positions (skipping nulls) scaled to 0–1. Watchlist rows
 * and null positions don't contribute to the value; a topic with no scorable
 * stance still gets a 0 spoke so the shape stays stable.
 */
function buildRadar(
  selections: UserIssueSelectionRow[],
  catalog: IssueTopic[],
): { labels: string[]; values: number[] } {
  const order: string[] = []
  const stanceByTopic = new Map<string, number[]>()
  for (const sel of selections) {
    if (!order.includes(sel.topic_slug)) {
      order.push(sel.topic_slug)
      stanceByTopic.set(sel.topic_slug, [])
    }
    if (
      lensTypeOf(catalog, sel.topic_slug, sel.lens_slug) === 'stance' &&
      sel.position != null
    ) {
      stanceByTopic.get(sel.topic_slug)?.push(sel.position)
    }
  }
  const labels = order.map((slug) => topicLabel(catalog, slug))
  const values = order.map((slug) => {
    const scores = stanceByTopic.get(slug) ?? []
    if (scores.length === 0) return 0
    return scores.reduce((s, v) => s + v, 0) / scores.length / 100
  })
  return { labels, values }
}

/**
 * Home / settings re-entry preview for the user's issue priorities.
 *
 * Two states:
 *  1. No selections → an empty-state card inviting setup (CTA → `onEdit`).
 *  2. Selections exist → a small radar preview (axes = distinct topics, values =
 *     mean stance position per topic) + an "Edit priorities" CTA.
 *
 * Presentational only — the parent fetches via `useMySelections` +
 * `useIssueCatalog` and passes the rows + catalog + nav callback. Mode-aware
 * via `useBrandTokens()`.
 */
export function MyIssuesCard({ selections, catalog, onEdit }: MyIssuesCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  if (selections.length === 0) {
    return (
      <View
        accessibilityLabel="Your issue priorities"
        style={[styles.card, { backgroundColor: semantic.bg.card, borderColor: semantic.border.default }]}
      >
        <BrandHeading level={3}>Set your issue priorities</BrandHeading>
        <BrandBodyText muted size="sm">
          Tell us what you care about and we&apos;ll show how your officials line up.
        </BrandBodyText>
        <View style={styles.cta}>
          <BrandButton onPress={onEdit} size="default" accessibilityLabel="Set your issue priorities">
            Set your issue priorities
          </BrandButton>
        </View>
      </View>
    )
  }

  const { labels, values } = buildRadar(selections, catalog)

  return (
    <View
      accessibilityLabel="Your issue priorities"
      style={[styles.card, { backgroundColor: semantic.bg.card, borderColor: semantic.border.default }]}
    >
      <BrandHeading level={3}>Your issue priorities</BrandHeading>
      <View style={styles.chartWrap}>
        <IssueRadarChart axes={labels} userValues={values} size={170} />
      </View>
      <View style={styles.cta}>
        <BrandButton
          onPress={onEdit}
          variant="secondary"
          size="sm"
          accessibilityLabel="Edit your issue priorities"
        >
          Edit priorities
        </BrandButton>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    alignItems: 'center',
  },
  chartWrap: {
    alignItems: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
})
