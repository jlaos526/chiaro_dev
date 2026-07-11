import { Pressable, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import type { OfficialWithDistrict } from '@chiaro/officials'

function chamberLabelFor(o: OfficialWithDistrict): string {
  if (o.chamber === 'state_house') return 'State Representative'
  if (o.chamber === 'state_senate' || o.chamber === 'state_legislature') return 'State Senator'
  return o.title ?? 'State Legislator'
}

export interface StateOfficialsCardSectionProps {
  officials: OfficialWithDistrict[]
  /** Invoked when a state-official row is tapped. Consumers wire router
   * navigation (e.g. `/state-officials/[id]`) here. */
  onSelect: (target: { officialId: string }) => void
}

export function StateOfficialsCardSection({
  officials,
  onSelect,
}: StateOfficialsCardSectionProps): React.JSX.Element | null {
  const { semantic } = useBrandTokens()
  if (officials.length === 0) return null

  return (
    <View testID="state-section" style={{ marginTop: 24 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          textTransform: 'uppercase',
          color: semantic.text.muted,
          marginBottom: 12,
        }}
      >
        State
      </Text>
      <View style={{ gap: 8 }}>
        {officials.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => onSelect({ officialId: o.id })}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: semantic.border.default,
              borderRadius: 12,
              backgroundColor: semantic.bg.app,
            }}
          >
            <Text style={{ fontSize: 12, color: semantic.text.muted }}>{chamberLabelFor(o)}</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: semantic.text.primary,
                marginTop: 2,
              }}
            >
              {o.full_name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
