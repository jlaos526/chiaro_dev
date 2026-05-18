export interface PillChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

const SIZE_PX = { sm: 18, md: 20 } as const
const FONT_REM = { sm: 0.7, md: 0.72 } as const

export function PillChevron({ open, size = 'md' }: PillChevronProps): React.JSX.Element {
  const px = SIZE_PX[size]
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: '50%',
        background: '#f0eee5',
        color: '#1a1714',
        fontSize: `${FONT_REM[size]}rem`,
        flexShrink: 0,
      }}
    >
      {open ? '▾' : '▸'}
    </span>
  )
}
