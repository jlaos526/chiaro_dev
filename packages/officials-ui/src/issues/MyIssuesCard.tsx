'use client'

import { Platform, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import type { IssueTopic, UserIssueSelectionRow } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { SmartAnchor } from '../primitives/SmartAnchor.tsx'
import { IssueRadarChart } from './IssueRadarChart.tsx'

export interface MyIssuesCardProps {
  /** The user's saved selection rows (parent fetches via `useMySelections`). */
  selections: UserIssueSelectionRow[]
  /** The full issue catalog (parent fetches via `useIssueCatalog`). */
  catalog: IssueTopic[]
  /** Enter / re-enter the issue-priorities flow (edit mode). */
  onEdit: () => void
  /**
   * Web: rendered as `href` on a real `<a>` wrapping the edit/setup CTA.
   * Preserves middle-click / Cmd-click → "open in new tab", status-bar URL
   * preview, browser history. Plain left-click still routes via `onEdit`.
   * Native (or web without it): the plain `<BrandButton onPress={onEdit}>`.
   */
  editHref?: string
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
export function MyIssuesCard({ selections, catalog, onEdit, editHref }: MyIssuesCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  // Web smart-anchor wrapper for the edit/setup CTA: a real <a href> with
  // modifier-key passthrough; plain left-click still dispatches to onEdit. The
  // inner BrandButton's onPress is a no-op in this path so the click fires once
  // (via the anchor). Native (or web without editHref) → the plain button.
  const wrapCta = (label: string, button: ReactNode): ReactNode => {
    if (Platform.OS === 'web' && editHref) {
      return (
        <SmartAnchor
          href={editHref}
          onPress={onEdit}
          accessibilityLabel={label}
          style={{ display: 'inline-block', cursor: 'pointer' }}
        >
          {button}
        </SmartAnchor>
      )
    }
    return button
  }

  const ctaOnPress = Platform.OS === 'web' && editHref ? () => {} : onEdit

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
          {wrapCta(
            'Set your issue priorities',
            <BrandButton onPress={ctaOnPress} size="default" accessibilityLabel="Set your issue priorities">
              Set your issue priorities
            </BrandButton>,
          )}
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
        {wrapCta(
          'Edit your issue priorities',
          <BrandButton
            onPress={ctaOnPress}
            variant="secondary"
            size="sm"
            accessibilityLabel="Edit your issue priorities"
          >
            Edit priorities
          </BrandButton>,
        )}
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
