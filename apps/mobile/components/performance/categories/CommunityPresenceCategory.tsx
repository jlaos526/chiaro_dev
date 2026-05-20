import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialDistrictOffices,
  useOfficialTownHalls,
} from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { MetricCardShell } from '@/components/cards/MetricCardShell'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'community-presence'
const CONGRESS = '119'
const ACCENT = '#1f9b88'
const LINK = '#3b6ed1'

function mapsUrl(addr: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`
}

function isRecent(eventDate: string, days = 90): boolean {
  const event = new Date(eventDate).getTime()
  const now = Date.now()
  return event >= now - days * 24 * 60 * 60 * 1000 && event <= now
}

export function CommunityPresenceCategory({
  officialId,
  chamber,
}: {
  officialId: string
  chamber: 'federal_house' | 'federal_senate'
}): React.JSX.Element {
  const metrics = useOfficialMetrics(supabase, officialId)
  const [officesOpen, setOfficesOpen] = useState(false)
  const [hallsOpen, setHallsOpen] = useState(false)
  const offices = useOfficialDistrictOffices(supabase, officialId, { enabled: officesOpen })
  const halls = useOfficialTownHalls(supabase, officialId, CONGRESS, { enabled: hallsOpen })

  if (metrics.isLoading) {
    return <Text style={{ padding: 12, color: '#807a72' }}>Loading…</Text>
  }
  const m = metrics.data
  const livesInDistrictUnavailable = chamber === 'federal_senate' || m?.lives_in_district == null

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 }}>
      <View style={{ width: '31%' }}>
        <MetricCardShell
          categoryId={CATEGORY}
          unavailable={livesInDistrictUnavailable}
          value={
            livesInDistrictUnavailable ? 'No Data' : m?.lives_in_district ? '✓ Yes' : '✗ No'
          }
          label="Lives in District"
          caption={
            livesInDistrictUnavailable
              ? 'no data available for this seat'
              : m?.home_district_id
                ? 'home maps to a district'
                : 'address outside represented district'
          }
          externalSourceUrl="https://www.fec.gov/data/"
        />
      </View>

      <View
        style={{
          width: '31%',
          borderWidth: 1,
          borderColor: '#d8d4c9',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#f3faf8',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
          {m?.district_offices_count ?? 0}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginRight: 6 }}
          />
          <Text style={{ fontSize: 13, color: '#1a1714' }}>District Offices</Text>
        </View>
        <EvidenceExpand
          title="Office locations"
          open={officesOpen}
          onToggle={() => setOfficesOpen((v) => !v)}
        >
          {offices.isLoading ? (
            <Text style={{ fontSize: 13, color: '#5a5751' }}>Loading…</Text>
          ) : (offices.data ?? []).length === 0 ? (
            <Text style={{ fontSize: 13, color: '#807a72' }}>No district offices listed.</Text>
          ) : (
            <View>
              {(offices.data ?? []).map((o, i) => {
                const full = `${o.address}, ${o.city}, ${o.state} ${o.zip ?? ''}`.trim()
                return (
                  <View
                    key={o.id}
                    style={{
                      paddingVertical: 8,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: '#f0eee5',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#1a1714', fontWeight: '700' }}>
                      {o.city}, {o.state}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#1a1714' }}>{o.address}</Text>
                    {o.zip ? (
                      <Text style={{ fontSize: 13, color: '#1a1714' }}>{o.zip}</Text>
                    ) : null}
                    {o.phone ? (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${o.phone}`).catch(() => {})}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: LINK,
                            textDecorationLine: 'underline',
                            marginTop: 2,
                          }}
                        >
                          {o.phone}
                        </Text>
                      </Pressable>
                    ) : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 10 }}>
                      <Pressable onPress={() => Linking.openURL(mapsUrl(full)).catch(() => {})}>
                        <Text style={{ fontSize: 11, color: LINK, textDecorationLine: 'underline' }}>
                          → open in Google Maps
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => Linking.openURL(o.source_url).catch(() => {})}>
                        <Text style={{ fontSize: 11, color: LINK, textDecorationLine: 'underline' }}>
                          → source
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </EvidenceExpand>
      </View>

      <View
        style={{
          width: '31%',
          borderWidth: 1,
          borderColor: '#d8d4c9',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#f3faf8',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
          {m?.town_halls_count ?? 0}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginRight: 6 }}
          />
          <Text style={{ fontSize: 13, color: '#1a1714' }}>Town Halls (119th)</Text>
        </View>
        <EvidenceExpand
          title="Town halls"
          open={hallsOpen}
          onToggle={() => setHallsOpen((v) => !v)}
        >
          {halls.isLoading ? (
            <Text style={{ fontSize: 13, color: '#5a5751' }}>Loading…</Text>
          ) : (() => {
            const data = halls.data ?? []
            if (data.length === 0) {
              return (
                <Text style={{ fontSize: 13, color: '#807a72' }}>
                  No town halls in the 119th Congress.
                </Text>
              )
            }
            const recent = data.filter((h) => isRecent(h.event_date))
            const formatCounts = data.reduce<Record<string, number>>((acc, h) => {
              const key = h.format ?? 'unknown'
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {})
            return (
              <View>
                <Text style={{ fontSize: 12, color: '#5a5751', marginBottom: 6 }}>
                  {recent.length} in last 90 days · last event: {data[0]?.event_date ?? '—'}
                </Text>
                <Text style={{ fontSize: 12, color: '#5a5751', marginBottom: 6 }}>
                  By format:{' '}
                  {Object.entries(formatCounts)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(' · ')}
                </Text>
                <View>
                  {data.map((h, i) => (
                    <View
                      key={h.id}
                      style={{
                        paddingVertical: 8,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: '#f0eee5',
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#1a1714' }}>
                        <Text style={{ fontWeight: '700' }}>{h.event_date}</Text>
                        {' · '}
                        {h.city ?? '?'}, {h.state ?? '?'} · {h.format ?? '?'}
                      </Text>
                      <Pressable onPress={() => Linking.openURL(h.source_url).catch(() => {})}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: LINK,
                            textDecorationLine: 'underline',
                            marginTop: 2,
                          }}
                        >
                          → Town Hall Project
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )
          })()}
        </EvidenceExpand>
      </View>
    </View>
  )
}
