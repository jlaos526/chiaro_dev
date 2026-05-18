import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

export interface BioAlignmentChipRowProps {
  chips: AlignmentChipRow[]
  officialId: string
}

export function BioAlignmentChipRow({ chips, officialId }: BioAlignmentChipRowProps): React.JSX.Element | null {
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {chips.map(c => (
        <AlignmentChip
          key={c.issueArea}
          label={c.displayLabel}
          tier={c.tier}
          href={`/officials/${officialId}#issue-positions:${c.subCascadeSlug}`}
        />
      ))}
    </div>
  )
}
