import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics } from '@chiaro/officials'
import {
  useOfficialMissedVotes,
  useOfficialSponsoredBills,
  useOfficialCosponsoredBills,
} from '@chiaro/bills'
import { supabase } from '@/lib/supabase'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'voting-bills'
const CONGRESS = '119'
const LINK = '#3b6ed1'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function VotingBillsCategory({
  officialId,
  subCascade,
}: {
  officialId: string
  subCascade: SubCascadeProps
}): React.JSX.Element {
  const metrics = useOfficialMetrics(supabase, officialId)
  const votingOpen = subCascade.isOpen(CATEGORY, 'voting-record')
  const billsOpen = subCascade.isOpen(CATEGORY, 'bills-authored')

  const missed = useOfficialMissedVotes(supabase, officialId, CONGRESS, { enabled: votingOpen })
  const sponsored = useOfficialSponsoredBills(supabase, officialId, CONGRESS, { enabled: billsOpen })
  const cosponsored = useOfficialCosponsoredBills(supabase, officialId, CONGRESS, { enabled: billsOpen })

  if (metrics.isLoading) {
    return <Text style={{ padding: 12, color: '#807a72' }}>Loading…</Text>
  }
  const m = metrics.data

  return (
    <View style={{ padding: 12 }}>
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="voting-record"
        name="Voting Record"
        teaser={m?.attendance_pct != null ? `${m.attendance_pct}% attendance` : 'no attendance data'}
        open={votingOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'voting-record')}
      />
      {votingOpen && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#d8d4c9',
              borderRadius: 6,
              padding: 12,
              backgroundColor: '#f7f4fc',
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
              {m?.attendance_pct != null ? `${m.attendance_pct}%` : '—'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7d57c1', marginRight: 6 }}
              />
              <Text style={{ fontSize: 13, color: '#1a1714' }}>Attendance</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#807a72', marginTop: 2 }}>
              {m?.votes_voted_count ?? 0}/{m?.total_roll_calls ?? 0} roll calls
            </Text>
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, color: '#1a1714', fontWeight: '700' }}>Missed votes:</Text>
              {missed.isLoading ? (
                <Text style={{ fontSize: 12, color: '#5a5751', marginTop: 4 }}>Loading…</Text>
              ) : (() => {
                const rows = missed.data ?? []
                if (rows.length === 0) {
                  return (
                    <Text style={{ fontSize: 12, color: '#807a72', marginTop: 6 }}>
                      None this Congress.
                    </Text>
                  )
                }
                return (
                  <View style={{ marginTop: 6 }}>
                    {rows.map((mv, i) => (
                      <View
                        key={mv.vote_id}
                        style={{
                          paddingVertical: 6,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: '#f0eee5',
                        }}
                      >
                        <Pressable
                          onPress={() => Linking.openURL(mv.vote.source_url).catch(() => {})}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: LINK,
                              textDecorationLine: 'underline',
                            }}
                          >
                            {mv.vote.vote_date} · {mv.vote.question}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )
              })()}
            </View>
          </View>
        </View>
      )}

      <SubCascadeBar
        categoryId={CATEGORY}
        subId="bills-authored"
        name="Bills Authored"
        teaser={`${m?.bills_sponsored_count ?? 0} sponsored, ${m?.bills_cosponsored_count ?? 0} cosponsored`}
        open={billsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'bills-authored')}
      />
      {billsOpen && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 12,
            paddingBottom: 12,
          }}
        >
          <View
            style={{
              flexBasis: 0,
              flexGrow: 1,
              minWidth: '47%',
              borderWidth: 1,
              borderColor: '#d8d4c9',
              borderRadius: 6,
              padding: 12,
              backgroundColor: '#f7f4fc',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1714', marginBottom: 6 }}>
              Sponsored
            </Text>
            {sponsored.isLoading ? (
              <Text style={{ fontSize: 12, color: '#5a5751' }}>Loading…</Text>
            ) : (() => {
              const rows = sponsored.data ?? []
              if (rows.length === 0) {
                return (
                  <Text style={{ fontSize: 12, color: '#807a72' }}>None this Congress.</Text>
                )
              }
              return (
                <View>
                  {rows.map((b, i) => (
                    <View
                      key={b.id}
                      style={{
                        paddingVertical: 6,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: '#f0eee5',
                      }}
                    >
                      <Pressable
                        onPress={() => Linking.openURL(b.source_url).catch(() => {})}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: LINK,
                            textDecorationLine: 'underline',
                          }}
                        >
                          {b.bill_type.toUpperCase()} {b.number}: {b.title}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )
            })()}
          </View>
          <View
            style={{
              flexBasis: 0,
              flexGrow: 1,
              minWidth: '47%',
              borderWidth: 1,
              borderColor: '#d8d4c9',
              borderRadius: 6,
              padding: 12,
              backgroundColor: '#f7f4fc',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1714', marginBottom: 6 }}>
              Cosponsored
            </Text>
            {cosponsored.isLoading ? (
              <Text style={{ fontSize: 12, color: '#5a5751' }}>Loading…</Text>
            ) : (() => {
              const rows = cosponsored.data ?? []
              if (rows.length === 0) {
                return (
                  <Text style={{ fontSize: 12, color: '#807a72' }}>None this Congress.</Text>
                )
              }
              return (
                <View>
                  {rows.map((b, i) => (
                    <View
                      key={b.id}
                      style={{
                        paddingVertical: 6,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: '#f0eee5',
                      }}
                    >
                      <Pressable
                        onPress={() => Linking.openURL(b.source_url).catch(() => {})}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: LINK,
                            textDecorationLine: 'underline',
                          }}
                        >
                          {b.bill_type.toUpperCase()} {b.number}: {b.title}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )
            })()}
          </View>
        </View>
      )}

      <SubCascadeBar
        categoryId={CATEGORY}
        subId="committee-work"
        name="Committee Work"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        placeholder={true}
      />
    </View>
  )
}
