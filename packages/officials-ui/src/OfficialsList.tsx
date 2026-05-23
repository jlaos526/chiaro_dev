import { Pressable, Text, View } from 'react-native'
import { useMyOfficials, type OfficialWithDistrict, type Party } from '@chiaro/officials'
import { OfficialAvatar } from './OfficialAvatar.tsx'
import { PartyBadge } from './PartyBadge.tsx'
import { OfficialMeta } from './OfficialMeta.tsx'
import { useChiaroClient } from './client-context.tsx'

export interface OfficialsListProps {
  /** Invoked when an official row is tapped. Consumers wire router
   * navigation (e.g. `/officials/[id]`) here. */
  onSelect: (target: { officialId: string }) => void
  /** Invoked when the calibrate prompt (shown when user has no officials) is tapped. */
  onCalibrate: () => void
}

function Section({
  title,
  items,
  onSelect,
}: {
  title: string
  items: OfficialWithDistrict[]
  onSelect: (target: { officialId: string }) => void
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <View accessibilityLabel={title} style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>{title}</Text>
      <View style={{ gap: 12 }}>
        {items.map(o => (
          <Pressable
            key={o.id}
            onPress={() => onSelect({ officialId: o.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            accessibilityRole="link"
            accessibilityLabel={`View ${o.full_name}`}
          >
            <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{o.full_name}</Text>
              <PartyBadge party={o.party as Party} />
              <OfficialMeta official={o} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export function OfficialsList({ onSelect, onCalibrate }: OfficialsListProps): React.JSX.Element {
  const client = useChiaroClient()
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <Text>Loading…</Text>
  if (error) return <Text>Couldn&apos;t load officials.</Text>
  if (!data || data.length === 0) {
    return (
      <Pressable onPress={onCalibrate} accessibilityRole="link">
        <Text style={{ color: '#3b6ed1' }}>Calibrate your address to see your delegation.</Text>
      </Pressable>
    )
  }

  const senate = data.filter(o => o.chamber === 'federal_senate')
  const house = data.filter(o => o.chamber === 'federal_house')

  return (
    <View>
      <Section title="Senate" items={senate} onSelect={onSelect} />
      <Section title="House" items={house} onSelect={onSelect} />
    </View>
  )
}
