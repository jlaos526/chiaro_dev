'use client'
import { useOfficialFinance } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MetricCardShell } from './MetricCardShell'
import { FinanceIndustryBreakdown } from './FinanceIndustryBreakdown'

const client = createSupabaseBrowserClient()

export function FinanceCard({ officialId, cycle = '2024' }: { officialId: string; cycle?: string }) {
  const q = useOfficialFinance(client, officialId, cycle)

  if (q.isLoading) return <p>Loading finance…</p>
  if (q.error || !q.data) {
    return (
      <MetricCardShell
        title={`Campaign finance — ${cycle}`}
        value="—"
        caption="No OpenSecrets data ingested yet"
        externalSourceUrl="https://www.opensecrets.org/members-of-congress"
      />
    )
  }

  const { summary, industries, pacs } = q.data
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>Campaign finance — {cycle}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <MetricCardShell
          title="Total raised"
          value={summary.total_raised !== null ? `$${(summary.total_raised / 1_000_000).toFixed(1)}M` : '—'}
          externalSourceUrl={summary.source_url}
        />
        <MetricCardShell
          title="Small-donor %"
          value={summary.small_donor_pct !== null ? `${summary.small_donor_pct}%` : '—'}
          caption="Contributions under $200"
          externalSourceUrl={summary.source_url}
        />
        <MetricCardShell
          title="In-state donor %"
          value={summary.in_state_pct !== null ? `${summary.in_state_pct}%` : '—'}
          caption={summary.out_of_state_pct !== null ? `${summary.out_of_state_pct}% out-of-state` : ''}
          externalSourceUrl={summary.source_url}
        />
      </div>

      <div>
        <h4 style={{ margin: '8px 0 4px' }}>Top donor industries</h4>
        <FinanceIndustryBreakdown industries={industries} />
        <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
          <a href={summary.source_url} target="_blank" rel="noreferrer">→ full breakdown on OpenSecrets</a>
        </p>
      </div>

      <div>
        <h4 style={{ margin: '8px 0 4px' }}>Notable PACs</h4>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {pacs.slice(0, 5).map(p => (
            <li key={p.pac_name} style={{ padding: '4px 0' }}>
              <strong>{p.pac_name}</strong>: ${p.amount.toLocaleString()}
              {p.pac_fec_id && (
                <a href={`https://www.fec.gov/data/committee/${p.pac_fec_id}/`} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
                  → FEC
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
