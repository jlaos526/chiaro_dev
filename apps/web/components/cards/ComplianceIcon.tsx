export interface ComplianceIconProps {
  state: 'on-time' | 'late'
}

const STYLES = {
  'on-time': { bg: '#c5e3c7', fg: '#1f4d24', glyph: '✓', label: 'Filed on time' },
  'late':    { bg: '#f4d3c0', fg: '#7a3e1c', glyph: '✖', label: 'Late filing' },  // ✖ = U+2716
} as const

export function ComplianceIcon({ state }: ComplianceIconProps): React.JSX.Element {
  const { bg, fg, glyph, label } = STYLES[state]
  return (
    <span
      role="img"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: bg,
        color: fg,
        fontSize: '0.7rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  )
}
