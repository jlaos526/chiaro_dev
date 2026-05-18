import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics, useOfficialLeadershipHistory } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { firstElectedYear, tenureByChamber } from '@/lib/derivations/service-record'
import { MetricCardShell } from '@/components/cards/MetricCardShell'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'service-record'
const CRS_URL = 'https://crsreports.congress.gov/product/pdf/R/R44648'

export function ServiceRecordCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(supabase, officialId)
  const history = useOfficialLeadershipHistory(supabase, officialId)
  const [tenureOpen, setTenureOpen] = useState(false)
  const [leadershipOpen, setLeadershipOpen] = useState(false)

  if (metrics.isLoading) {
    return <Text style={{ padding: 12, color: '#807a72' }}>Loading…</Text>
  }
  const m = metrics.data
  const rows = history.data ?? []
  const elected = firstElectedYear(rows)
  const tenure = tenureByChamber(rows)
  const totalTenure = Number((tenure.house + tenure.senate).toFixed(1))

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 }}>
      <View style={{ width: '31%' }}>
        <MetricCardShell
          categoryId={CATEGORY}
          value={m?.salary_usd ? `$${Number(m.salary_usd).toLocaleString()}` : '—'}
          label="Base Salary"
          caption={m?.salary_role ?? null}
          externalSourceUrl={CRS_URL}
        />
      </View>

      <View
        style={{
          width: '31%',
          borderWidth: 1,
          borderColor: '#d8d4c9',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#fcfaf2',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
          {totalTenure > 0 ? `${totalTenure} yrs` : '—'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#c89a4e', marginRight: 6 }}
          />
          <Text style={{ fontSize: 13, color: '#1a1714' }}>Tenure</Text>
        </View>
        {elected != null ? (
          <Text style={{ fontSize: 11, color: '#807a72', marginTop: 2 }}>First elected {elected}</Text>
        ) : null}
        {tenure.house > 0 && tenure.senate > 0 ? (
          <EvidenceExpand
            title="Tenure by chamber"
            open={tenureOpen}
            onToggle={() => setTenureOpen((v) => !v)}
          >
            <Text style={{ fontSize: 13, color: '#1a1714' }}>
              {tenure.house.toFixed(1)} yrs House · {tenure.senate.toFixed(1)} yrs Senate
            </Text>
          </EvidenceExpand>
        ) : null}
      </View>

      <View
        style={{
          width: '31%',
          borderWidth: 1,
          borderColor: '#d8d4c9',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#fcfaf2',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
          {m?.salary_role && m.salary_role !== 'Member' ? m.salary_role : 'Member'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#c89a4e', marginRight: 6 }}
          />
          <Text style={{ fontSize: 13, color: '#1a1714' }}>Leadership Role</Text>
        </View>
        <EvidenceExpand
          title="Leadership history"
          open={leadershipOpen}
          onToggle={() => setLeadershipOpen((v) => !v)}
        >
          {rows.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#5a5751' }}>No leadership history ingested.</Text>
          ) : (
            <View>
              {rows.map((r, i) => (
                <View
                  key={r.id}
                  style={{
                    paddingVertical: 8,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: '#f0eee5',
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#1a1714' }}>
                    <Text style={{ fontWeight: '700' }}>{r.role}</Text>
                    {' · '}
                    {r.start_date} – {r.end_date ?? 'present'}
                  </Text>
                  <Pressable onPress={() => Linking.openURL(r.source_url).catch(() => {})}>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#3b6ed1',
                        textDecorationLine: 'underline',
                        marginTop: 2,
                      }}
                    >
                      → source
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </EvidenceExpand>
      </View>
    </View>
  )
}
