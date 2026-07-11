'use client'

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { IssueTopic } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { useIssueFlow, MAX_TOPICS } from './IssueFlowProvider.tsx'

/**
 * Non-locking quick-start presets. Each chip pre-checks a curated set of
 * topics + their primary lenses; the user freely swaps afterward (the chip
 * NEVER locks the selection). Hardcoded UI sugar per spec #9 (not a DB table).
 *
 * Topic + lens slugs are pinned to the slice-52 catalog seed
 * (`packages/db/supabase/seed/issue-catalog/catalog-data.ts`). "Pro Life" is a
 * literal consistent-life-ethic preset (Healthcare + Education + Housing +
 * Foreign Policy), NOT an anti-abortion framing (spec #7).
 */
export const QUICK_START_PRESETS: ReadonlyArray<{
  label: string
  lenses: Record<string, string[]>
}> = [
  {
    label: 'Personal Freedoms',
    lenses: { 'civil-liberties': ['privacy-and-speech', 'limited-government'] },
  },
  {
    label: 'Pro Life',
    lenses: {
      healthcare: ['public-coverage'],
      education: ['public-schools'],
      housing: ['affordability-investment'],
      'foreign-policy': ['global-engagement'],
    },
  },
  {
    label: 'Equality First',
    lenses: {
      'civil-rights': ['anti-discrimination', 'equal-opportunity'],
      labor: ['worker-protections'],
    },
  },
  {
    label: 'Limited Government',
    lenses: {
      economy: ['free-markets'],
      'civil-liberties': ['limited-government'],
    },
  },
]

export interface IssueWelcomeScreenProps {
  /** The issue catalog (used to order pre-checked topics by display_order). */
  catalog: IssueTopic[]
  /** Begin the topic-picker step. */
  onStart: () => void
}

/**
 * Step 1 of the issue-priorities flow: a short intro + non-locking quick-start
 * chips + a "Get started" CTA.
 *
 * Pressing a chip pre-checks matching topics + lenses (capped at
 * {@link MAX_TOPICS}) but never locks them — the user can adjust in later
 * steps. Presentational; wizard state lives in {@link useIssueFlow}.
 */
export function IssueWelcomeScreen({
  catalog,
  onStart,
}: IssueWelcomeScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { selectedTopics, toggleTopic, toggleLens, reset } = useIssueFlow()

  const orderOf = (slug: string): number =>
    catalog.find((t) => t.slug === slug)?.display_order ?? Number.MAX_SAFE_INTEGER

  function applyPreset(preset: (typeof QUICK_START_PRESETS)[number]): void {
    // Non-locking: start from a clean slate so re-pressing a chip (or switching
    // chips) replaces rather than accumulates, then pre-check the preset's
    // topics (ordered by catalog display_order, capped) + their lenses.
    reset()
    const topicSlugs = Object.keys(preset.lenses).sort((a, b) => orderOf(a) - orderOf(b))
    for (const topicSlug of topicSlugs.slice(0, MAX_TOPICS)) {
      toggleTopic(topicSlug)
      for (const lensSlug of preset.lenses[topicSlug] ?? []) {
        toggleLens(topicSlug, lensSlug)
      }
    }
  }

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: semantic.bg.elevated }]}>
          <BrandHeading level={1}>Set your issue priorities</BrandHeading>
          <BrandBodyText muted>
            Tell us what you care about and we&apos;ll show how your elected officials line up with
            your views. Start from a quick pick below, or build your own on the next screens.
          </BrandBodyText>

          <Text style={[styles.chipsLabel, { color: semantic.text.muted }]}>Quick start</Text>
          <View style={styles.chips}>
            {QUICK_START_PRESETS.map((preset) => {
              // A chip reads as "active" when all its topics are currently picked.
              const active = Object.keys(preset.lenses).every((slug) =>
                selectedTopics.includes(slug),
              )
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => applyPreset(preset)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  aria-pressed={active}
                  accessibilityLabel={`Quick start: ${preset.label}`}
                  dataSet={{ presetChip: '' }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? semantic.accent.bg : semantic.bg.subtle,
                      borderColor: active ? semantic.accent.primary : semantic.border.default,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? semantic.accent.primary : semantic.text.body },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.footer}>
            <BrandButton onPress={onStart} size="lg">
              Get started
            </BrandButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 30,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  chipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 8,
    alignItems: 'stretch',
  },
})
