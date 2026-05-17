import { type CategoryId, CATEGORY_ACCENT, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import { PillChevron } from '@/components/cards/PillChevron'

export interface CategoryBarProps {
  categoryId: CategoryId
  teaser: string | null
  open: boolean
  onToggle: () => void
}

export function CategoryBar({ categoryId, teaser, open, onToggle }: CategoryBarProps): React.JSX.Element {
  const accent = CATEGORY_ACCENT[categoryId]
  const label = CATEGORY_LABEL[categoryId]
  return (
    <button
      id={`category-${categoryId}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`category-body-${categoryId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '11px 14px',
        border: '1px solid #d8d4c9',
        borderLeftWidth: '2px',
        borderLeftStyle: 'solid',
        borderLeftColor: accent,
        borderRadius: open ? '6px 6px 0 0' : 6,
        borderBottom: open ? 'none' : '1px solid #d8d4c9',
        background: '#fff',
        marginBottom: open ? 0 : 6,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <PillChevron open={open} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: '#1a1714', lineHeight: 1.2 }}>
          {label}
        </span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#5a5751', marginTop: 2, lineHeight: 1.4 }}>
          {teaser ?? <em style={{ color: '#807a72' }}>no data yet</em>}
        </span>
      </span>
    </button>
  )
}
