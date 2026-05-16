import { COLORS } from '@chiaro/ui-tokens'
import type { ReactNode } from 'react'

interface BaseProps {
  title:   string
  value:   ReactNode
  caption?: ReactNode
}

// Drill-down contract: caller MUST provide either onExpand (internal drawer)
// OR externalSourceUrl (link out). TypeScript enforces it via discriminated union.
type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }

export type MetricCardShellProps = BaseProps & DrillDown

export function MetricCardShell(props: MetricCardShellProps) {
  const { title, value, caption } = props
  const cta = 'onExpand' in props
    ? <button onClick={props.onExpand} style={ctaStyle} aria-label={`Expand evidence for ${title}`}>view evidence →</button>
    : <a href={props.externalSourceUrl} target="_blank" rel="noreferrer" style={ctaStyle}>view source →</a>

  return (
    <article style={cardStyle} aria-label={`${title}: ${typeof value === 'string' ? value : ''}`}>
      <header style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.neutral.textMuted, marginBottom: 6 }}>
        {title}
      </header>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.brand.text }}>{value}</div>
      {caption && <div style={{ fontSize: '0.85rem', color: COLORS.neutral.mute, marginTop: 4 }}>{caption}</div>}
      <footer style={{ marginTop: 8 }}>{cta}</footer>
    </article>
  )
}

const cardStyle = {
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8,
  padding: 12,
  background: COLORS.neutral.background,
} as const

const ctaStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: '0.85rem',
  color: COLORS.brand.primary,
  cursor: 'pointer',
  textDecoration: 'underline',
} as const
