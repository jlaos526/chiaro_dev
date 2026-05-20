import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useMyOfficials, useOfficialScorecardRatings, useOfficialMetrics } from '@chiaro/officials'
import type { OfficialWithDistrict } from '@chiaro/officials'
import { OfficialAvatar } from './OfficialAvatar'
import { DistrictBadge } from './cards/DistrictBadge'
import { AlignmentChip } from './cards/AlignmentChip'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { groupOfficialsByLevel } from '@/lib/derivations/officials-by-level'
import { StateOfficialsCardSection } from './state/StateOfficialsCardSection'

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut',
  DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan',
  MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
  NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia',
}

function parseDistrict(code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (!code) return { districtNumber: null, atLarge: false }
  if (code.endsWith('-AL')) return { districtNumber: null, atLarge: true }
  const parts = code.split('-')
  const tail = parts[1]
  const n = tail ? parseInt(tail, 10) : NaN
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

function OfficialRow({ o }: { o: OfficialWithDistrict }) {
  const router = useRouter()
  const scorecards = useOfficialScorecardRatings(supabase, o.id)
  const metrics = useOfficialMetrics(supabase, o.id)
  const stateName = STATE_NAMES[o.state] ?? o.state
  const chips = selectTopAlignmentChips(scorecards.data ?? [])
  const currentRole = metrics.data?.salary_role && metrics.data.salary_role !== 'Member'
    ? metrics.data.salary_role
    : (o.chamber === 'federal_house' ? 'Representative' : 'Senator')
  const { districtNumber, atLarge } = parseDistrict(o.district?.code ?? null)

  return (
    <View style={{ padding: 12, borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6, backgroundColor: '#fff', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => router.push(`/officials/${o.id}`)} accessibilityLabel={`View ${o.full_name}`}>
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.push(`/officials/${o.id}`)}>
            <Text style={{ fontWeight: '600', fontSize: 15, color: '#1a1714' }}>{o.full_name}</Text>
          </Pressable>
          <DistrictBadge
            chamber={o.chamber}
            stateName={stateName}
            stateAbbrev={o.state}
            districtNumber={o.chamber === 'federal_house' ? districtNumber : null}
            atLarge={o.chamber === 'federal_house' && atLarge}
          />
          <Text style={{ fontSize: 11, color: '#3a352b', marginTop: 2 }}>
            {currentRole} · {o.chamber === 'federal_house' ? 'House' : 'Senate'}
          </Text>
          {chips.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {chips.map(c => (
                <AlignmentChip
                  key={c.issueArea}
                  label={c.displayLabel}
                  tier={c.tier}
                  href={`/officials/${o.id}?cat=issue-positions&sub=${c.subCascadeSlug}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export function OfficialsCard() {
  const router = useRouter()
  const { data, isLoading, error } = useMyOfficials(supabase)
  if (isLoading) return <Text>Loading officials…</Text>
  if (error) return <Text>Failed to load officials.</Text>
  if (!data || data.length === 0) return <Text>No officials yet — calibrate your address.</Text>

  const { federal, state } = groupOfficialsByLevel(data)

  return (
    <View style={{ padding: 16, backgroundColor: '#f7f5ef', borderRadius: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1714', marginBottom: 10 }}>Your officials</Text>
      {federal.length > 0 && (
        <View testID="federal-section">
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: 12,
            }}
          >
            Federal
          </Text>
          {federal.map(o => <OfficialRow key={o.id} o={o} />)}
        </View>
      )}
      <StateOfficialsCardSection officials={state} />
      <Pressable onPress={() => router.push('/officials')}>
        <Text style={{ fontSize: 14, color: '#3b6ed1', marginTop: 10 }}>See all officials →</Text>
      </Pressable>
    </View>
  )
}
