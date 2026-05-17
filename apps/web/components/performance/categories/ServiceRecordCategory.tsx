'use client'

import { useState } from 'react'
import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { firstElectedYear, tenureByChamber } from '@/lib/derivations/service-record'
import { MetricCardShell } from '@/components/cards/MetricCardShell'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'service-record'
const client = createSupabaseBrowserClient()
const CRS_URL = 'https://crsreports.congress.gov/product/pdf/R/R44648'

export function ServiceRecordCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const history = useOfficialLeadershipHistory(client, officialId)
  const [tenureOpen, setTenureOpen] = useState(false)
  const [leadershipOpen, setLeadershipOpen] = useState(false)

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data
  const rows = history.data ?? []
  const elected = firstElectedYear(rows)
  const tenure = tenureByChamber(rows)
  const totalTenure = Number((tenure.house + tenure.senate).toFixed(1))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 12 }}>
      <MetricCardShell
        categoryId={CATEGORY}
        value={m?.salary_usd ? `$${Number(m.salary_usd).toLocaleString()}` : '—'}
        label="Base Salary"
        caption={m?.salary_role ?? null}
        externalSourceUrl={CRS_URL}
      />

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {totalTenure > 0 ? `${totalTenure} yrs` : '—'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c89a4e', marginRight: 6, display: 'inline-block' }} />
          Tenure
        </div>
        {elected != null && <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>First elected {elected}</div>}
        {(tenure.house > 0 && tenure.senate > 0) && (
          <EvidenceExpand title="Tenure by chamber" open={tenureOpen} onToggle={() => setTenureOpen(v => !v)}>
            <p style={{ fontSize: '0.82rem', color: '#1a1714', margin: 0 }}>
              {tenure.house.toFixed(1)} yrs House · {tenure.senate.toFixed(1)} yrs Senate
            </p>
          </EvidenceExpand>
        )}
      </article>

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.salary_role && m.salary_role !== 'Member' ? m.salary_role : 'Member'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c89a4e', marginRight: 6, display: 'inline-block' }} />
          Leadership Role
        </div>
        <EvidenceExpand title="Leadership history" open={leadershipOpen} onToggle={() => setLeadershipOpen(v => !v)}>
          {rows.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#5a5751', margin: 0 }}>No leadership history ingested.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map(r => (
                <li key={r.id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem', color: '#1a1714' }}>
                  <strong>{r.role}</strong> · {r.start_date} – {r.end_date ?? 'present'}
                  <br />
                  <a href={r.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>
                    → source
                  </a>
                </li>
              ))}
            </ul>
          )}
        </EvidenceExpand>
      </article>
    </div>
  )
}
