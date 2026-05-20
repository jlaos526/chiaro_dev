import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '@chiaro/ui-tokens'
import type { OfficialWithDistrict } from '@chiaro/officials'

function chamberLabelFor(o: OfficialWithDistrict): string {
  if (o.chamber === 'state_house') return 'State Representative'
  if (o.chamber === 'state_senate' || o.chamber === 'state_legislature') return 'State Senator'
  return o.title ?? 'State Legislator'
}

export function StateOfficialsCardSection({
  officials,
}: {
  officials: OfficialWithDistrict[]
}) {
  const router = useRouter()
  if (officials.length === 0) return null

  return (
    <View testID="state-section" style={{ marginTop: 24 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          textTransform: 'uppercase',
          color: COLORS.neutral.textMuted,
          marginBottom: 12,
        }}
      >
        State
      </Text>
      <View style={{ gap: 8 }}>
        {officials.map(o => (
          <Pressable
            key={o.id}
            onPress={() => router.push(`/state-officials/${o.id}` as never)}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: COLORS.neutral.border,
              borderRadius: 12,
              backgroundColor: COLORS.neutral.surface,
            }}
          >
            <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {chamberLabelFor(o)}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.brand.text, marginTop: 2 }}>
              {o.full_name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
