import { Text, View, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { useMyOfficials } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

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
        <Link key={o.id} href={`/officials/${o.id}`} asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            accessibilityLabel={`${o.full_name}, ${o.party}`}
          >
            <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{o.full_name}</Text>
              <PartyBadge party={o.party as any} />
              <OfficialMeta official={o} />
            </View>
          </Pressable>
        </Link>
      ))}
      <Link href="/officials"><Text style={{ marginTop: 8 }}>See all officials →</Text></Link>
    </View>
  )
}
