'use client'
import { useState } from 'react'
import {
  useOfficialMetrics,
  useOfficialDistrictOffices,
  useOfficialTownHalls,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MetricCardShell } from './MetricCardShell'

type DistrictOfficeRow   = Database['public']['Tables']['district_offices']['Row']
type TownHallRow         = Database['public']['Tables']['town_halls']['Row']
type StockTransactionRow = Database['public']['Tables']['stock_transactions']['Row']

const client = createSupabaseBrowserClient()

export function ConstituentConnectionCard({ officialId }: { officialId: string }) {
  const m = useOfficialMetrics(client, officialId)
  const [open, setOpen] = useState<'offices' | 'town-halls' | 'stock' | null>(null)
  const offices  = useOfficialDistrictOffices(client, officialId, { enabled: open === 'offices' })
  const halls    = useOfficialTownHalls(client, officialId, '119', { enabled: open === 'town-halls' })
  const stock    = useOfficialStockTransactions(client, officialId, { enabled: open === 'stock' })

  if (m.isLoading) return <p>Loading…</p>
  if (!m.data)     return null

  return (
    <section>
      <h3 style={{ margin: '0 0 8px' }}>Constituent connection</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <MetricCardShell
          title="Lives in district"
          value={m.data.lives_in_district === null ? 'N/A (Senate)' : m.data.lives_in_district ? '✓ Yes' : '✗ No'}
          caption={m.data.home_district_id ? 'home maps to a district' : 'address outside represented district'}
          externalSourceUrl="https://www.fec.gov/data/"
        />
        <MetricCardShell
          title="District offices"
          value={m.data.district_offices_count ?? 0}
          onExpand={() => setOpen('offices')}
        />
        <MetricCardShell
          title="Town halls (119th)"
          value={m.data.town_halls_count ?? 0}
          onExpand={() => setOpen('town-halls')}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
        <MetricCardShell
          title="STOCK Act compliance"
          value={m.data.stock_act_compliance_pct !== null ? `${m.data.stock_act_compliance_pct}%` : '—'}
          caption={`${m.data.stock_act_disclosures_late ?? 0} late / ${m.data.stock_act_disclosures_total ?? 0} total`}
          onExpand={() => setOpen('stock')}
        />
        <MetricCardShell
          title="In-state donors"
          value={m.data.in_state_donations_pct !== null ? `${m.data.in_state_donations_pct}%` : '—'}
          caption={m.data.out_of_state_donations_pct !== null ? `${m.data.out_of_state_donations_pct}% out-of-state` : ''}
          externalSourceUrl="https://www.opensecrets.org/"
        />
      </div>

      {open && (
        <div role="dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }}>
          <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff', padding: 24, borderRadius: 12, maxHeight: '80vh', overflow: 'auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>{drillTitle(open)}</h3>
              <button onClick={() => setOpen(null)}>×</button>
            </header>
            {open === 'offices'    && renderOffices(offices.data, offices.isLoading)}
            {open === 'town-halls' && renderHalls(halls.data, halls.isLoading)}
            {open === 'stock'      && renderStock(stock.data, stock.isLoading)}
          </div>
        </div>
      )}
    </section>
  )
}

function drillTitle(k: 'offices' | 'town-halls' | 'stock') {
  return k === 'offices' ? 'District offices' : k === 'town-halls' ? 'Town halls' : 'STOCK Act transactions'
}

function renderOffices(data: DistrictOfficeRow[] | undefined, loading: boolean) {
  if (loading) return <p>Loading…</p>
  const rows = data ?? []
  if (rows.length === 0) return <p>No district offices listed.</p>
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {rows.map(o => (
        <li key={o.id} style={{ padding: '8px 0', borderTop: '1px solid #eee' }}>
          <strong>{o.city}, {o.state}</strong><br />
          {o.address} {o.zip}<br />
          {o.phone && <a href={`tel:${o.phone}`}>{o.phone}</a>}{' '}
          <a href={o.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>→ source</a>
        </li>
      ))}
    </ul>
  )
}

function renderHalls(data: TownHallRow[] | undefined, loading: boolean) {
  if (loading) return <p>Loading…</p>
  const rows = data ?? []
  if (rows.length === 0) return <p>No town halls in the 119th Congress.</p>
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {rows.map(h => (
        <li key={h.id} style={{ padding: '8px 0', borderTop: '1px solid #eee' }}>
          <strong>{h.event_date}</strong> · {h.city ?? '?'}, {h.state ?? '?'} · {h.format ?? '?'}{' '}
          <a href={h.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>→ Town Hall Project</a>
        </li>
      ))}
    </ul>
  )
}

function renderStock(data: StockTransactionRow[] | undefined, loading: boolean) {
  if (loading) return <p>Loading…</p>
  const rows = data ?? []
  if (rows.length === 0) return <p>No STOCK Act disclosures filed.</p>
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {rows.map(t => {
        const late = (t.days_late ?? 0) > 0
        return (
          <li
            key={t.id}
            style={{ padding: '8px 0', borderTop: '1px solid #eee', color: late ? '#c5364a' : 'inherit' }}
          >
            <strong>{t.transaction_date}</strong> · {t.transaction_type ?? '?'} · {t.asset_ticker ?? t.asset_name ?? '?'}
            {' '}· filed {t.filing_date} {late && <em>({t.days_late} days late)</em>}{' '}
            <a href={t.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>→ source</a>
          </li>
        )
      })}
    </ul>
  )
}
