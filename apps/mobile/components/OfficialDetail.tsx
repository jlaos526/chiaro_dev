import { Linking, Text, View, Pressable } from 'react-native'
import { useOfficial } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

export function OfficialDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useOfficial(supabase, id)

  if (isLoading) return <Text>Loading…</Text>
  if (error || !data) return <Text>Couldn't load this official.</Text>

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <OfficialAvatar fullName={data.full_name} portraitUrl={data.portrait_url} size={96} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{data.full_name}</Text>
          <PartyBadge party={data.party as any} />
          <OfficialMeta official={data} />
        </View>
      </View>

      <View style={{ marginTop: 16, gap: 8 }}>
        <Row label="Chamber"      value={data.chamber === 'house' ? 'House of Representatives' : 'Senate'} />
        <Row label="State"        value={data.state} />
        <Row label="District"     value={data.district.name} />
        {data.senate_class != null && <Row label="Senate class" value={String(data.senate_class)} />}
        {data.next_election && <Row label="Next election" value={data.next_election} />}
      </View>

      {data.official_url && (
        <Pressable onPress={() => Linking.openURL(data.official_url!)} style={{ marginTop: 16 }}>
          <Text style={{ color: '#5b6cff' }}>Open official site →</Text>
        </Pressable>
      )}
      {data.twitter_handle && (
        <Pressable
          onPress={() => Linking.openURL(`https://twitter.com/${data.twitter_handle}`)}
          style={{ marginTop: 8 }}
        >
          <Text style={{ color: '#5b6cff' }}>@{data.twitter_handle}</Text>
        </Pressable>
      )}
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ fontWeight: '600', width: 120 }}>{label}</Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  )
}
