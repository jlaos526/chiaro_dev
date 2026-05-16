import { INDUSTRY_COLOR, INDUSTRY_DEFAULT_COLOR } from '@chiaro/ui-tokens'

interface IndustryRow {
  rank:     number
  industry: string
  amount:   number
}

export function FinanceIndustryBreakdown({ industries }: { industries: IndustryRow[] }) {
  const max = Math.max(...industries.map(i => i.amount), 1)
  return (
    <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
      {industries.slice(0, 10).map((ind) => (
        <li key={ind.rank} style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 6rem 1fr', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
          <span style={{ color: '#999' }}>{ind.rank}.</span>
          <span>{ind.industry}</span>
          <span style={{ fontWeight: 600 }}>${(ind.amount / 1000).toFixed(0)}k</span>
          <div style={{ background: '#eee', height: 8, borderRadius: 4 }}>
            <div style={{
              background: INDUSTRY_COLOR[ind.industry] ?? INDUSTRY_DEFAULT_COLOR,
              width: `${(ind.amount / max) * 100}%`,
              height: '100%', borderRadius: 4,
            }} />
          </div>
        </li>
      ))}
    </ol>
  )
}
