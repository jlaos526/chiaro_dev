import type { ReactNode } from 'react'
import { PillChevron } from './PillChevron'

export interface EvidenceExpandProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function EvidenceExpand({ title, open, onToggle, children }: EvidenceExpandProps): React.JSX.Element {
  return (
    <>
      {open && (
        <div style={{ marginTop: 14, borderTop: '1px dashed #d8d4c9', paddingTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1714', marginBottom: 8 }}>
            {title}
          </div>
          {children}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={onToggle}
          aria-expanded={open}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#1a1714',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          <PillChevron open={open} />
          {open ? 'Hide evidence' : 'view evidence'}
        </button>
      </div>
    </>
  )
}
