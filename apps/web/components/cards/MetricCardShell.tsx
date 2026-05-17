import type { ReactNode } from 'react'
import { type CategoryId, CATEGORY_ACCENT, CATEGORY_CARD_GRADIENT } from '@chiaro/ui-tokens'

interface BaseProps {
  value: ReactNode
  label: string
  caption?: ReactNode
  categoryId: CategoryId
  placeholder?: boolean
}

type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
  | { onExpand?: never; externalSourceUrl?: never }

export type MetricCardShellProps = BaseProps & DrillDown

export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const { value, label, caption, categoryId, placeholder = false } = props
  const dotColor = CATEGORY_ACCENT[categoryId]
  const bg = placeholder ? '#f6f4ed' : CATEGORY_CARD_GRADIENT[categoryId]

  const valueStyle: React.CSSProperties = placeholder
    ? { fontSize: '1.4rem', fontWeight: 700, color: '#807a72', fontStyle: 'italic', lineHeight: 1.1 }
    : { fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    color: placeholder ? '#5a5751' : '#1a1714',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
  }

  const captionStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: '#807a72',
    marginTop: 2,
    lineHeight: 1.4,
    fontStyle: placeholder ? 'italic' : 'normal',
  }

  let cta: ReactNode = null
  if (!placeholder) {
    if ('onExpand' in props && typeof props.onExpand === 'function') {
      const onExpand = props.onExpand
      cta = (
        <button
          onClick={onExpand}
          aria-label={`Expand evidence for ${label}`}
          style={{ background: 'none', border: 'none', padding: 0, marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', textDecoration: 'underline', cursor: 'pointer' }}
        >
          view evidence →
        </button>
      )
    } else if ('externalSourceUrl' in props && typeof props.externalSourceUrl === 'string') {
      cta = (
        <a
          href={props.externalSourceUrl}
          target="_blank"
          rel="noreferrer"
          style={{ marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', textDecoration: 'underline', display: 'inline-block' }}
        >
          view source →
        </a>
      )
    }
  }

  return (
    <article
      aria-label={`${label}: ${typeof value === 'string' ? value : ''}`}
      style={{
        border: '1px solid #d8d4c9',
        borderRadius: 6,
        padding: 12,
        background: bg,
      }}
    >
      <div style={valueStyle}>{value}</div>
      <div style={labelStyle}>
        <span
          data-testid="category-dot"
          style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block', marginRight: 6 }}
        />
        {label}
      </div>
      {caption && <div style={captionStyle}>{caption}</div>}
      {cta}
    </article>
  )
}
