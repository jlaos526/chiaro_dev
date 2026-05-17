'use client'

import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'ethics-accountability'
void CATEGORY
const client = createSupabaseBrowserClient()

function formatRange(low: number | null, high: number | null): string {
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`)
  if (low == null || high == null) return '—'
  return `${fmt(low)}–${fmt(high)}`
}

export function EthicsAccountabilityCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const [stockOpen, setStockOpen] = useState(false)
  const stock = useOfficialStockTransactions(client, officialId, { enabled: stockOpen })

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data

  const data = stock.data ?? []
  const worstCase = data.reduce((max, t) => Math.max(max, t.days_late ?? 0), 0)
  const volumeLow = data.reduce((s, t) => s + (t.amount_range_low ?? 0), 0)
  const volumeHigh = data.reduce((s, t) => s + (t.amount_range_high ?? 0), 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: 12 }}>
      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.stock_act_compliance_pct != null ? `${m.stock_act_compliance_pct}%` : '—'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d68a1f', marginRight: 6, display: 'inline-block' }} />
          STOCK Act Compliance
        </div>
        <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>
          {m?.stock_act_disclosures_late ?? 0} late / {m?.stock_act_disclosures_total ?? 0} total
          {data.length > 0 && worstCase > 0 && <> · worst: {worstCase} days</>}
        </div>
        {data.length > 0 && (
          <div style={{ fontSize: '0.7rem', color: '#807a72' }}>
            Total disclosed volume: {formatRange(volumeLow, volumeHigh)}
          </div>
        )}
        <EvidenceExpand title="Transactions" open={stockOpen} onToggle={() => setStockOpen((v) => !v)}>
          {stock.isLoading ? (
            <p>Loading…</p>
          ) : data.length === 0 ? (
            <p style={{ color: '#807a72', fontSize: '0.82rem' }}>No STOCK Act disclosures filed.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.map((t) => {
                const late = (t.days_late ?? 0) > 0
                return (
                  <li key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0eee5', fontSize: '0.82rem', color: '#1a1714' }}>
                    <ComplianceIcon state={late ? 'late' : 'on-time'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{t.asset_ticker ?? t.asset_name ?? '?'}</strong>
                        <span style={{ fontWeight: 600 }}>{formatRange(t.amount_range_low, t.amount_range_high)}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#5a5751', marginTop: 3 }}>
                        {t.transaction_type ?? '?'} · filed {t.filing_date}
                        {late && (
                          <>
                            {' '}· <strong>{t.days_late} days late</strong>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', marginTop: 3 }}>
                        <a href={t.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>→ source</a>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </EvidenceExpand>
      </article>

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.in_state_donations_pct != null ? `${m.in_state_donations_pct}%` : '—'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d68a1f', marginRight: 6, display: 'inline-block' }} />
          In-State Donors
        </div>
        {m?.out_of_state_donations_pct != null && (
          <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>
            {m.out_of_state_donations_pct}% out-of-state
          </div>
        )}
        <a href="https://www.opensecrets.org/" target="_blank" rel="noreferrer" style={{ marginTop: 10, fontSize: '0.72rem', color: '#3b6ed1', display: 'inline-block', textDecoration: 'underline' }}>
          view source →
        </a>
      </article>
    </div>
  )
}
