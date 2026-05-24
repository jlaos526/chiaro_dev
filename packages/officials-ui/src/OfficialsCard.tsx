import { Pressable, Text, View } from 'react-native'
import {
  groupOfficialsByLevel,
  selectTopAlignmentChips,
  STATE_NAMES,
  useMyOfficials,
  useOfficialMetrics,
  useOfficialScorecardRatings,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
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
}

function OfficialRow({
  o,
  onSelect,
  chipHref,
}: {
  o: OfficialWithDistrict
  onSelect: (target: OfficialsCardSelectTarget) => void
  chipHref?: (target: { officialId: string; subCascadeSlug: string }) => string
}): React.JSX.Element {
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

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.neutral.border,
        borderRadius: 6,
        backgroundColor: COLORS.neutral.background,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={handlePress} accessibilityLabel={`View ${o.full_name}`}>
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={handlePress}>
            <Text style={{ fontWeight: '600', fontSize: 15, color: COLORS.brand.text }}>{o.full_name}</Text>
          </Pressable>
          <DistrictBadge
            chamber={o.chamber as 'federal_house' | 'federal_senate'}
            stateName={stateName}
            stateAbbrev={o.state}
            districtNumber={o.chamber === 'federal_house' ? districtNumber : null}
            atLarge={o.chamber === 'federal_house' && atLarge}
          />
          <Text style={{ fontSize: 11, color: COLORS.neutral.mute, marginTop: 2 }}>
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
}: OfficialsCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <Text>Loading officials…</Text>
  if (error) return <Text>Couldn&apos;t load officials.</Text>
  if (!data || data.length === 0) {
    return (
      <Pressable onPress={onCalibrate} accessibilityRole="link">
        <Text style={{ color: COLORS.brand.primary }}>Calibrate your address to see your delegation.</Text>
      </Pressable>
    )
  }

  const { federal, state } = groupOfficialsByLevel(data)

  return (
    <View
      accessibilityLabel="Your officials"
      style={{ padding: 16, backgroundColor: COLORS.neutral.surface, borderRadius: 8 }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.brand.text, marginBottom: 10 }}>
        Your officials
      </Text>
      {federal.length > 0 ? (
        <View testID="federal-section">
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              textTransform: 'uppercase',
              color: COLORS.neutral.textMuted,
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
            />
          ))}
        </View>
      ) : null}
      <StateOfficialsCardSection
        officials={state}
        onSelect={onSelect}
      />
      <Pressable onPress={onSeeAll} accessibilityRole="link">
        <Text style={{ fontSize: 14, color: COLORS.brand.primary, marginTop: 10 }}>See all officials →</Text>
      </Pressable>
    </View>
  )
}
