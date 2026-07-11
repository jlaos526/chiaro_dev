import { View } from 'react-native'
import type { AlignmentChipRow } from '@chiaro/officials'
import { AlignmentChip } from '../cards/AlignmentChip.tsx'

export interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  /** Optional press handler invoked per-chip with the source chip row.
   * Consumers wire platform-specific router navigation here. When omitted,
   * chips render inert (no nav). */
  onChipPress?: (chip: AlignmentChipRow) => void
  /** Optional URL builder for chip href (web a11y restoration).
   * On web with this prop set, each chip renders as a real <a href> via
   * the smart-anchor pattern (middle-click + prefetch + status-bar URL
   * preview). Native ignores. */
  chipHref?: (chip: AlignmentChipRow) => string
}

export function BioAlignmentChipRow({
  chips,
  onChipPress,
  chipHref,
}: BioAlignmentChipRowProps): React.JSX.Element | null {
  if (chips.length === 0) return null
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {chips.map((c) => (
        <AlignmentChip
          key={c.issueArea}
          label={c.displayLabel}
          tier={c.tier}
          {...(chipHref ? { href: chipHref(c) } : {})}
          {...(onChipPress ? { onPress: () => onChipPress(c) } : {})}
        />
      ))}
    </View>
  )
}
