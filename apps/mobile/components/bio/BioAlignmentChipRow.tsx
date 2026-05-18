import { View } from 'react-native'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

export interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  officialId: string
}

export function BioAlignmentChipRow({ chips, officialId }: BioAlignmentChipRowProps) {
  if (chips.length === 0) return null
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {chips.map(c => (
        <AlignmentChip
          key={c.issueArea}
          label={c.displayLabel}
          tier={c.tier}
          href={`/officials/${officialId}?cat=issue-positions&sub=${c.subCascadeSlug}`}
        />
      ))}
    </View>
  )
}
