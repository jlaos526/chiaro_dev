import { Text, View } from 'react-native'
import { type AlignmentTier } from '@chiaro/ui-tokens'
import { useAlignmentChipColors } from '../brand-hooks.ts'

export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

// Glyph + label stay as inline constants — they're not palette concerns.
// Color values come from useAlignmentChipColors via the slice 42 refactor,
// so dark mode + future palette tweaks track automatically.
const GLYPH: Record<
  ComplianceIconProps['state'],
  { glyph: string; label: string; tier: AlignmentTier }
> = {
  'on-time': { glyph: '✓', label: 'Filed on time', tier: 'strongly-aligned' },
  late: { glyph: '✖', label: 'Late filing', tier: 'mostly-differs' }, // ✖ = U+2716
}

export function ComplianceIcon({ state }: ComplianceIconProps): React.JSX.Element {
  const { glyph, label, tier } = GLYPH[state]
  const { bg, fg } = useAlignmentChipColors(tier)
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{glyph}</Text>
    </View>
  )
}
