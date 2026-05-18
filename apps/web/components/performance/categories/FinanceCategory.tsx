'use client'

import { type CategoryId, FINANCE_SUB_SECTION_SHADES } from '@chiaro/ui-tokens'
import { useOfficialFinance } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { pacPercent } from '@/lib/derivations/finance'
import { FinanceSummaryStrip } from '@/components/finance/FinanceSummaryStrip'
import { FinanceSubSectionHeading } from '@/components/finance/FinanceSubSectionHeading'
import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'finance'
const client = createSupabaseBrowserClient()
const CYCLE = '2024'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function FinanceCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const q = useOfficialFinance(client, officialId, CYCLE)

  if (q.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  if (!q.data) {
    return (
      <p style={{ padding: 12, color: '#807a72' }}>
        No OpenSecrets data ingested for {CYCLE}.{' '}
        <a href="https://www.opensecrets.org/members-of-congress" target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → search OpenSecrets
        </a>
      </p>
    )
  }
  const { summary, industries, pacs } = q.data
  const pacSum = pacs.reduce((s, p) => s + p.amount, 0)
  const pct = pacPercent(summary.total_raised, pacSum)
  const topIndustry = industries[0]?.industry ?? null

  const pacsOpen = subCascade.isOpen(CATEGORY, 'pacs')
  const indOpen = subCascade.isOpen(CATEGORY, 'top-industries')

  return (
    <div style={{ padding: 12 }}>
      <FinanceSummaryStrip
        cycle={CYCLE}
        totalRaised={summary.total_raised}
        smallDonorPct={summary.small_donor_pct}
        pacPct={pct}
      />

      <FinanceSubSectionHeading
        label="Contributors"
        textColor={FINANCE_SUB_SECTION_SHADES.contributors.heading}
        ruleColor={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="pacs"
        name="PACs"
        teaser={`$${pacSum.toLocaleString()} · ${pacs.length} PACs`}
        open={pacsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'pacs')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      {pacsOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pacs.slice(0, 5).map(p => (
              <li key={p.pac_name} style={{ padding: '6px 0', borderBottom: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                <strong>{p.pac_name}</strong>: ${p.amount.toLocaleString()}
                {p.pac_fec_id && (
                  <a href={`https://www.fec.gov/data/committee/${p.pac_fec_id}/`} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#3b6ed1', fontSize: '0.72rem' }}>
                    → FEC
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="individual-donors"
        name="Individual Donors"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
        placeholder={true}
      />

      <FinanceSubSectionHeading
        label="Top Donor Industries & Organizations"
        textColor={FINANCE_SUB_SECTION_SHADES.topDonor.heading}
        ruleColor={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-industries"
        name="Top Industries"
        teaser={topIndustry ? `${topIndustry} leads` : 'no industries ingested'}
        open={indOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'top-industries')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      {indOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <TopAmountBreakdown
            rows={industries.map(i => ({ label: i.industry, amount: i.amount }))}
            noun={{ singular: 'industry', plural: 'industries' }}
            sourceUrl={summary.source_url}
          />
        </div>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-organizations"
        name="Top Organizations"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
        placeholder={true}
      />
    </div>
  )
}
