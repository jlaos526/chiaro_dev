import { View } from 'react-native'
import type { AlignmentChipRow } from '@chiaro/officials'
import { AlignmentChip } from '../cards/AlignmentChip.tsx'

export interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  /** Optional press handler invoked per-chip with the source chip row.
   * Consumers wire platform-specific router navigation here. When omitted,
   * chips render inert (no nav). */
  onChipPress?: (chip: AlignmentChipRow) => void
}

export function BioAlignmentChipRow({
  chips,
  onChipPress,
}: BioAlignmentChipRowProps): React.JSX.Element | null {
  if (chips.length === 0) return null
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {chips.map(c => (
        <AlignmentChip
          key={c.issueArea}
          label={c.displayLabel}
          tier={c.tier}
          {...(onChipPress ? { onPress: () => onChipPress(c) } : {})}
        />
      ))}
    </View>
  )
}
