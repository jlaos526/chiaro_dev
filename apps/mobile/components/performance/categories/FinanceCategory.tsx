import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId, FINANCE_SUB_SECTION_SHADES } from '@chiaro/ui-tokens'
import { useOfficialFinance } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { pacPercent } from '@/lib/derivations/finance'
import { FinanceSummaryStrip } from '@/components/finance/FinanceSummaryStrip'
import { FinanceSubSectionHeading } from '@/components/finance/FinanceSubSectionHeading'
import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'finance'
const CYCLE = '2024'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function FinanceCategory({
  officialId,
  subCascade,
}: {
  officialId: string
  subCascade: SubCascadeProps
}): React.JSX.Element {
  const q = useOfficialFinance(supabase, officialId, CYCLE)

  if (q.isLoading) {
    return <Text style={{ padding: 12, color: '#807a72' }}>Loading…</Text>
  }
  if (!q.data) {
    return (
      <View style={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <Text style={{ color: '#807a72' }}>
          No OpenSecrets data ingested for {CYCLE}.{' '}
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL('https://www.opensecrets.org/members-of-congress').catch(() => {})
          }
        >
          <Text style={{ color: '#3b6ed1', textDecorationLine: 'underline' }}>
            → search OpenSecrets
          </Text>
        </Pressable>
      </View>
    )
  }
  const { summary, industries, pacs, individualDonors, topOrgs } = q.data
  const pacSum = pacs.reduce((s, p) => s + p.amount, 0)
  const pct = pacPercent(summary.total_raised, pacSum)
  const topIndustry = industries[0]?.industry ?? null
  const donorSum = individualDonors.reduce((s, d) => s + Number(d.amount), 0)
  const topOrg = topOrgs[0]?.org_name ?? null

  const pacsOpen = subCascade.isOpen(CATEGORY, 'pacs')
  const indOpen = subCascade.isOpen(CATEGORY, 'top-industries')
  const donorsOpen = subCascade.isOpen(CATEGORY, 'individual-donors')
  const orgsOpen = subCascade.isOpen(CATEGORY, 'top-organizations')

  return (
    <View style={{ padding: 12 }}>
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
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <View>
            {pacs.slice(0, 5).map((p, idx) => (
              <View
                key={p.pac_name}
                style={{
                  paddingVertical: 6,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: '#f0eee5',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                }}
              >
                <Text style={{ fontSize: 13, color: '#1a1714' }}>
                  <Text style={{ fontWeight: '700' }}>{p.pac_name}</Text>
                  <Text>: ${p.amount.toLocaleString()}</Text>
                </Text>
                {p.pac_fec_id && (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`https://www.fec.gov/data/committee/${p.pac_fec_id}/`).catch(() => {})
                    }
                  >
                    <Text style={{ marginLeft: 8, color: '#3b6ed1', fontSize: 12, textDecorationLine: 'underline' }}>
                      → FEC
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="individual-donors"
        name="Individual Donors"
        teaser={
          individualDonors.length > 0
            ? `$${donorSum.toLocaleString()} · ${individualDonors.length} donors`
            : 'no individual donor data ingested'
        }
        open={donorsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'individual-donors')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.contributors.accent}
      />
      {donorsOpen && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <TopAmountBreakdown
            rows={individualDonors.map(d => ({ label: d.donor_name, amount: Number(d.amount) }))}
            noun={{ singular: 'donor', plural: 'donors' }}
            sourceUrl={summary.source_url}
          />
        </View>
      )}

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
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <TopAmountBreakdown
            rows={industries.map(i => ({ label: i.industry, amount: Number(i.amount) }))}
            noun={{ singular: 'industry', plural: 'industries' }}
            sourceUrl={summary.source_url}
          />
        </View>
      )}
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="top-organizations"
        name="Top Organizations"
        teaser={topOrg ? `${topOrg} leads` : 'no organization data ingested'}
        open={orgsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'top-organizations')}
        accentOverride={FINANCE_SUB_SECTION_SHADES.topDonor.accent}
      />
      {orgsOpen && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <TopAmountBreakdown
            rows={topOrgs.map(o => ({ label: o.org_name, amount: Number(o.amount) }))}
            noun={{ singular: 'organization', plural: 'organizations' }}
            sourceUrl={summary.source_url}
          />
        </View>
      )}
    </View>
  )
}
