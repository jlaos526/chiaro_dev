import Link from 'next/link'
import { type AlignmentTier, ALIGNMENT_CHIP_COLORS } from '@chiaro/ui-tokens'

export interface AlignmentChipProps {
  label: string
  tier: AlignmentTier
  href?: string
}

export function AlignmentChip({ label, tier, href }: AlignmentChipProps): React.JSX.Element {
  const { bg, fg } = ALIGNMENT_CHIP_COLORS[tier]
  const chip = (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.74rem',
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  )
  if (!href) return chip
  return (
    <Link href={href} style={{ textDecoration: 'none' }} aria-label={`View ${label} positions`}>
      {chip}
    </Link>
  )
}
