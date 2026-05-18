import { CATEGORY_CARD_GRADIENT } from '@chiaro/ui-tokens'

export interface FinanceSummaryStripProps {
  cycle: string
  totalRaised: number | null
  smallDonorPct: number | null
  pacPct: number | null
}

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

const DOT = '#3da75b'

const labelStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  color: '#5a5751',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
}

const dotStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: DOT,
  display: 'inline-block',
  marginRight: 5,
}

const supportingValueStyle: React.CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 700,
  color: '#1a1714',
  marginTop: 6,
  lineHeight: 1,
}

const headlineValueStyle: React.CSSProperties = {
  fontSize: '1.45rem',
  fontWeight: 800,
  color: '#1a1714',
  marginTop: 6,
  lineHeight: 1,
}

export function FinanceSummaryStrip({ cycle, totalRaised, smallDonorPct, pacPct }: FinanceSummaryStripProps): React.JSX.Element {
  return (
    <div
      style={{
        background: CATEGORY_CARD_GRADIENT['finance'],
        border: '1px solid #d8d4c9',
        borderRadius: 6,
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr 1fr',
        alignItems: 'end',
        marginBottom: 10,
      }}
    >
      <div style={{ paddingRight: 14 }}>
        <div style={labelStyle}><span style={dotStyle} />Total Raised, {cycle}</div>
        <div style={headlineValueStyle}>{formatMoney(totalRaised)}</div>
      </div>
      <div style={{ borderLeft: '1px solid #d8d4c9', padding: '0 12px' }}>
        <div style={labelStyle}><span style={dotStyle} />Small-donor %</div>
        <div style={supportingValueStyle}>{formatPct(smallDonorPct)}</div>
      </div>
      <div style={{ borderLeft: '1px solid #d8d4c9', paddingLeft: 12 }}>
        <div style={labelStyle}><span style={dotStyle} />PAC %</div>
        <div style={supportingValueStyle}>{pacPct == null ? '—' : `${pacPct.toFixed(1)}%`}</div>
      </div>
    </div>
  )
}
