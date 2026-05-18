import { Text, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  href?: string
}

export function AlignmentChip({ label, tier, href }: AlignmentChipProps) {
  const router = useRouter()
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chipStyle = {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: bg,
  }
  const textStyle = {
    fontSize: 12, fontWeight: '500' as const,
    color: fg, lineHeight: 16,
  }
  if (!href) {
    return (
      <View style={chipStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityLabel={`View ${label} positions`}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
