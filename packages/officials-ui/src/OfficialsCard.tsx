import { createElement } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import {
  groupOfficialsByLevel,
  selectTopAlignmentChips,
  STATE_NAMES,
  useMyOfficials,
  useOfficialMetrics,
  useOfficialScorecardRatings,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { useBrandTokens } from './brand-hooks.ts'
import { AlignmentChip } from './cards/AlignmentChip.tsx'
import { DistrictBadge } from './cards/DistrictBadge.tsx'
import { OfficialAvatar } from './OfficialAvatar.tsx'
import { StateOfficialsCardSection } from './state/StateOfficialsCardSection.tsx'
import { useChiaroClient } from './client-context.tsx'

function parseDistrict(code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (!code) return { districtNumber: null, atLarge: false }
  if (code.endsWith('-AL')) return { districtNumber: null, atLarge: true }
  const parts = code.split('-')
  const tail = parts[1]
  const n = tail ? parseInt(tail, 10) : NaN
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

export interface OfficialsCardSelectTarget {
  officialId: string
  /** When present, indicates the user pressed an alignment chip and the
   * consumer should deep-link to that issue-positions sub-cascade. */
  subCascadeSlug?: string
}

export interface OfficialsCardProps {
  /** Invoked when the user taps an official row or alignment chip.
   * Consumers wire router navigation here. */
  onSelect: (target: OfficialsCardSelectTarget) => void
  /** Invoked when the "See all officials" link is tapped. */
  onSeeAll: () => void
  /** Invoked when the calibrate prompt (shown when user has no officials) is tapped. */
  onCalibrate: () => void
  /** Optional URL builder for chip href (web a11y restoration; native ignored). */
  chipHref?: (target: { officialId: string; subCascadeSlug: string }) => string
  /** Optional URL builder for the row link href (web a11y restoration;
   * native ignored). When provided, the official name renders as real
   * `<a href>` on web with plain left-click intercepted to `onSelect`. */
  rowHref?: (target: { officialId: string }) => string
  /** Optional URL for the "See all officials" link (web a11y restoration; native ignored). */
  seeAllHref?: string
  /** Optional URL for the calibrate prompt (web a11y restoration; native ignored). */
  calibrateHref?: string
}

function OfficialRow({
  o,
  onSelect,
  chipHref,
  rowHref,
}: {
  o: OfficialWithDistrict
  onSelect: (target: OfficialsCardSelectTarget) => void
  chipHref?: (target: { officialId: string; subCascadeSlug: string }) => string
  rowHref?: (target: { officialId: string }) => string
}): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const scorecards = useOfficialScorecardRatings(client, o.id)
  const metrics = useOfficialMetrics(client, o.id)

  const stateName = STATE_NAMES[o.state] ?? o.state
  const chips = selectTopAlignmentChips(scorecards.data ?? [])
  const salaryRole = metrics.data?.salary_role
  const currentRole = salaryRole && salaryRole !== 'Member'
    ? salaryRole
    : o.chamber === 'federal_house' ? 'Representative' : 'Senator'
  const tenure = metrics.data?.tenure_years

  const { districtNumber, atLarge } = parseDistrict(o.district?.code ?? null)
  const handlePress = () => onSelect({ officialId: o.id })
  const href = rowHref?.({ officialId: o.id })

  const nameElement = (
    <Text style={{ fontWeight: '600', fontSize: 15, color: semantic.text.primary }}>{o.full_name}</Text>
  )

  let nameLink: React.JSX.Element
  if (Platform.OS === 'web' && href) {
    nameLink = createElement(
      'a',
      {
        href,
        onClick: (e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          handlePress()
        },
        'aria-label': `View ${o.full_name}`,
        style: {
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
          display: 'inline-block',
        },
      },
      nameElement,
    )
  } else {
    nameLink = (
      <Pressable onPress={handlePress}>
        {nameElement}
      </Pressable>
    )
  }

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderRadius: 6,
        backgroundColor: semantic.bg.elevated,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={handlePress} accessibilityLabel={`View ${o.full_name}`}>
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {nameLink}
          <DistrictBadge
            chamber={o.chamber as 'federal_house' | 'federal_senate'}
            stateName={stateName}
            stateAbbrev={o.state}
            districtNumber={o.chamber === 'federal_house' ? districtNumber : null}
            atLarge={o.chamber === 'federal_house' && atLarge}
          />
          <Text style={{ fontSize: 11, color: semantic.text.muted, marginTop: 2 }}>
            {currentRole} · {o.chamber === 'federal_house' ? 'House' : 'Senate'}
            {tenure != null && tenure > 0 ? ` · ${tenure} yr` : ''}
          </Text>
          {chips.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {chips.map(c => (
                <AlignmentChip
                  key={c.issueArea}
                  label={c.displayLabel}
                  tier={c.tier}
                  {...(chipHref ? { href: chipHref({ officialId: o.id, subCascadeSlug: c.subCascadeSlug }) } : {})}
                  onPress={() => onSelect({ officialId: o.id, subCascadeSlug: c.subCascadeSlug })}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export function OfficialsCard({
  onSelect,
  onSeeAll,
  onCalibrate,
  chipHref,
  rowHref,
  seeAllHref,
  calibrateHref,
}: OfficialsCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const { data, isLoading, error, refetch } = useMyOfficials(client)

  if (isLoading) return <Text style={{ color: semantic.text.muted }}>Loading officials…</Text>
  if (error) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: semantic.text.muted }}>Couldn&apos;t load officials.</Text>
        <Pressable onPress={() => { void refetch() }} accessibilityRole="button">
          <Text style={{ color: semantic.accent.primary, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    )
  }
  if (!data || data.length === 0) {
    const calibrateContent = (
      <Text style={{ color: semantic.accent.primary }}>
        Calibrate your address to see your delegation.
      </Text>
    )

    if (Platform.OS === 'web' && calibrateHref) {
      return createElement(
        'a',
        {
          href: calibrateHref,
          onClick: (e: MouseEvent) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
            e.preventDefault()
            onCalibrate()
          },
          style: {
            textDecoration: 'none',
            cursor: 'pointer',
            display: 'inline-block',
          },
        },
        calibrateContent,
      )
    }

    return (
      <Pressable onPress={onCalibrate} accessibilityRole="link">
        {calibrateContent}
      </Pressable>
    )
  }

  const { federal, state } = groupOfficialsByLevel(data)

  const seeAllText = (
    <Text style={{ fontSize: 14, color: semantic.accent.primary, marginTop: 10 }}>
      See all officials →
    </Text>
  )

  let seeAllElement: React.JSX.Element
  if (Platform.OS === 'web' && seeAllHref) {
    seeAllElement = createElement(
      'a',
      {
        href: seeAllHref,
        onClick: (e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          onSeeAll()
        },
        style: {
          textDecoration: 'none',
          cursor: 'pointer',
          display: 'inline-block',
        },
      },
      seeAllText,
    )
  } else {
    seeAllElement = (
      <Pressable onPress={onSeeAll} accessibilityRole="link">
        {seeAllText}
      </Pressable>
    )
  }

  return (
    <View
      accessibilityLabel="Your officials"
      style={{ padding: 16, backgroundColor: semantic.bg.app, borderRadius: 8 }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: semantic.text.primary, marginBottom: 10 }}>
        Your officials
      </Text>
      {federal.length > 0 ? (
        <View testID="federal-section">
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              textTransform: 'uppercase',
              color: semantic.text.muted,
              marginBottom: 12,
            }}
          >
            Federal
          </Text>
          {federal.map(o => (
            <OfficialRow
              key={o.id}
              o={o}
              onSelect={onSelect}
              {...(chipHref ? { chipHref } : {})}
              {...(rowHref ? { rowHref } : {})}
            />
          ))}
        </View>
      ) : null}
      <StateOfficialsCardSection
        officials={state}
        onSelect={onSelect}
      />
      {seeAllElement}
    </View>
  )
}
