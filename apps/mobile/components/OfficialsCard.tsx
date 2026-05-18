import { Text, View, Pressable } from 'react-native'
import { Link } from 'expo-router'
import {
  useMyOfficials,
  useOfficialScorecardRatings,
  useOfficialMetrics,
  useOfficialFinance,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

function OfficialRow({ o }: { o: OfficialWithDistrict }) {
  const scorecards = useOfficialScorecardRatings(supabase, o.id)
  const metrics    = useOfficialMetrics(supabase, o.id)
  const finance    = useOfficialFinance(supabase, o.id, '2024')

  const top3        = (scorecards.data ?? []).slice(0, 3)
  const topIndustry = finance.data?.industries[0]?.industry
  const attendance  = metrics.data?.attendance_pct

  const hasStrip = top3.length > 0 || !!topIndustry || attendance != null

  const stripParts: string[] = []
  if (top3.length > 0) {
    stripParts.push(top3.map((s) => `${s.org.slug.toUpperCase()} ${s.score}`).join(' · '))
  }
  if (topIndustry) stripParts.push(topIndustry)
  if (attendance != null) stripParts.push(`Att. ${attendance}%`)

  return (
    <Link href={`/officials/${o.id}`} asChild>
      <Pressable
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
        accessibilityLabel={`${o.full_name}, ${o.party}`}
      >
        <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600' }}>{o.full_name}</Text>
          <PartyBadge party={o.party as any} />
          <OfficialMeta official={o} />
          {hasStrip && (
            <Text style={{ fontSize: 11, color: COLORS.neutral.mute, marginTop: 2 }}>
              {stripParts.join(' · ')}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  )
}

export function OfficialsCard() {
  const { data, isLoading, error } = useMyOfficials(supabase)

  if (isLoading) return <Text>Loading your officials…</Text>
  if (error)     return <Text>Couldn't load officials.</Text>
  if (!data || data.length === 0) {
    return (
      <View>
        <Text style={{ fontWeight: '600' }}>Your officials</Text>
        <Link href="/calibrate"><Text>Calibrate your address</Text></Link>
      </View>
    )
  }

  return (
    <View>
      <Text style={{ fontWeight: '600', marginBottom: 8 }}>Your officials</Text>
      {data.map((o) => (
        <OfficialRow key={o.id} o={o} />
      ))}
      <Link href="/officials"><Text style={{ marginTop: 8 }}>See all officials →</Text></Link>
    </View>
  )
}
