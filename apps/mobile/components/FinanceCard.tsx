import { View, Text, Linking, Pressable, ScrollView } from 'react-native'
import { useOfficialFinance } from '@chiaro/officials'
import { INDUSTRY_COLOR, INDUSTRY_DEFAULT_COLOR, COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { MetricCardShell } from './MetricCardShell'

export function FinanceCard({
  officialId,
  cycle = '2024',
}: {
  officialId: string
  cycle?: string
}) {
  const q = useOfficialFinance(supabase, officialId, cycle)

  if (q.isLoading) return <Text>Loading finance…</Text>
  if (!q.data) {
    return (
      <MetricCardShell
        title={`Finance — ${cycle}`}
        value="—"
        caption="No OpenSecrets data ingested yet"
        externalSourceUrl="https://www.opensecrets.org/members-of-congress"
      />
    )
  }

  const { summary, industries, pacs } = q.data
  const max = Math.max(...industries.map((i) => i.amount), 1)

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
        Campaign finance — {cycle}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <MetricCardShell
            title="Total raised"
            value={
              summary.total_raised !== null
                ? `$${(summary.total_raised / 1_000_000).toFixed(1)}M`
                : '—'
            }
            externalSourceUrl={summary.source_url}
          />
        </View>
        <View style={{ flex: 1 }}>
          <MetricCardShell
            title="Small-donor %"
            value={
              summary.small_donor_pct !== null ? `${summary.small_donor_pct}%` : '—'
            }
            caption="Contributions under $200"
            externalSourceUrl={summary.source_url}
          />
        </View>
      </View>

      <Text style={{ fontWeight: '600', marginVertical: 8 }}>Top donor industries</Text>
      <ScrollView style={{ maxHeight: 240 }}>
        {industries.slice(0, 10).map((i) => (
          <View
            key={i.rank}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginVertical: 4,
            }}
          >
            <Text style={{ width: 24, color: COLORS.neutral.mute }}>{i.rank}.</Text>
            <Text style={{ flex: 2 }}>{i.industry}</Text>
            <Text style={{ width: 80, fontWeight: '600' }}>
              ${(i.amount / 1000).toFixed(0)}k
            </Text>
            <View
              style={{
                flex: 1,
                height: 8,
                backgroundColor: COLORS.neutral.border,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${(i.amount / max) * 100}%`,
                  height: '100%',
                  backgroundColor:
                    INDUSTRY_COLOR[i.industry] ?? INDUSTRY_DEFAULT_COLOR,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
      <Pressable onPress={() => Linking.openURL(summary.source_url)}>
        <Text style={{ color: COLORS.brand.primary, marginTop: 8 }}>
          → full breakdown on OpenSecrets
        </Text>
      </Pressable>

      <Text style={{ fontWeight: '600', marginTop: 12 }}>Notable PACs</Text>
      {pacs.slice(0, 5).map((p) => (
        <View key={p.pac_name} style={{ paddingVertical: 4 }}>
          <Text>
            <Text style={{ fontWeight: '700' }}>{p.pac_name}</Text>: $
            {p.amount.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  )
}
