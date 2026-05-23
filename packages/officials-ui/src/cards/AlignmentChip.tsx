import { Pressable, Text, View } from 'react-native'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  /** Optional press handler. When provided, the chip renders as a pressable
   * link-role element; consumers pass a router-navigation closure. When
   * omitted, the chip renders inert. */
  onPress?: () => void
}

export function AlignmentChip({ label, tier, onPress }: AlignmentChipProps): React.JSX.Element {
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chipStyle = {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: bg,
    alignSelf: 'flex-start' as const,
  }
  const textStyle = {
    fontSize: 12,
    fontWeight: '500' as const,
    color: fg,
    lineHeight: 17,
  }
  if (!onPress) {
    return (
      <View style={chipStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`View ${label} positions`}
      style={chipStyle}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  )
}
