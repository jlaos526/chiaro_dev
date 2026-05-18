export interface BioServiceCardProps {
  role: string
  firstElectedYear: number | null
}

export function BioServiceCard({ role, firstElectedYear }: BioServiceCardProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 8,
        alignItems: 'center',
        background: '#f0eee5',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    >
      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#807a72', letterSpacing: '0.06em' }}>
        CURRENT ROLE
      </span>
      <span
        style={{
          background: '#1a1714',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: '0.72rem',
          fontWeight: 600,
        }}
      >
        {role}
      </span>
      {firstElectedYear != null && (
        <span style={{ fontSize: '0.72rem', color: '#5a5751' }}>· Since {firstElectedYear}</span>
      )}
    </div>
  )
}
