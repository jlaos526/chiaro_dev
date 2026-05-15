import { Text, View, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { useMyOfficials, type OfficialWithDistrict } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

export function OfficialsList() {
  const { data, isLoading, error } = useMyOfficials(supabase)

  if (isLoading) return <Text>Loading…</Text>
  if (error)     return <Text>Couldn't load officials.</Text>
  if (!data || data.length === 0) {
    return <Link href="/calibrate"><Text>Calibrate your address</Text></Link>
  }

  const senate = data.filter((o) => o.chamber === 'senate')
  const house  = data.filter((o) => o.chamber === 'house')

  return (
    <View>
      <Section title="Senate" items={senate} />
      <Section title="House"  items={house} />
    </View>
  )
}

function Section({ title, items }: { title: string; items: OfficialWithDistrict[] }) {
  if (items.length === 0) return null
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>{title}</Text>
      {items.map((o) => (
        <Link key={o.id} href={`/officials/${o.id}`} asChild>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{o.full_name}</Text>
              <PartyBadge party={o.party as any} />
              <OfficialMeta official={o} />
            </View>
          </Pressable>
        </Link>
      ))}
    </View>
  )
}
