import { type CategoryId, SUB_CASCADE_ACCENT } from '@chiaro/ui-tokens'

export interface SubCascadeBarProps {
  categoryId: CategoryId
  subId: string
  name: string
  teaser: string | null
  open: boolean
  onToggle: () => void
  accentOverride?: string
  placeholder?: boolean
}

export function SubCascadeBar(props: SubCascadeBarProps): React.JSX.Element {
  const { categoryId, subId, name, teaser, open, onToggle, accentOverride, placeholder = false } = props
  const accent = accentOverride ?? SUB_CASCADE_ACCENT[categoryId]
  return (
    <button
      id={`subcat-${categoryId}-${subId}`}
      onClick={placeholder ? undefined : onToggle}
      disabled={placeholder}
      aria-expanded={!placeholder && open}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #e5e1d4',
        borderLeftWidth: '1px',
        borderLeftStyle: 'solid',
        borderLeftColor: accent,
        borderRadius: 5,
        background: placeholder ? '#f6f4ed' : '#fff',
        marginBottom: 4,
        cursor: placeholder ? 'default' : 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.7rem', color: placeholder ? '#807a72' : '#1a1714' }}>
        {open ? '▾' : '▸'}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', color: placeholder ? '#5a5751' : '#1a1714' }}>
          {name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '0.7rem',
            color: placeholder ? '#807a72' : '#5a5751',
            marginTop: 1,
            lineHeight: 1.4,
            fontStyle: placeholder ? 'italic' : 'normal',
          }}
        >
          {teaser}
        </span>
      </span>
    </button>
  )
}
