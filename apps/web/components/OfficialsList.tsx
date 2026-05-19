'use client'

import Link from 'next/link'
import { useMyOfficials, type OfficialWithDistrict } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

function group(officials: OfficialWithDistrict[]) {
  return {
    senate: officials.filter((o) => o.chamber === 'federal_senate'),
    house:  officials.filter((o) => o.chamber === 'federal_house'),
  }
}

export function OfficialsList() {
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <p>Loading…</p>
  if (error)     return <p>Couldn't load officials.</p>
  if (!data || data.length === 0) {
    return <p><Link href="/calibrate">Calibrate your address</Link> to see your delegation.</p>
  }

  const { senate, house } = group(data)

  return (
    <>
      <Section title="Senate" items={senate} />
      <Section title="House"  items={house} />
    </>
  )
}

function Section({ title, items }: { title: string; items: OfficialWithDistrict[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {items.map((o) => (
          <li key={o.id}>
            <Link href={`/officials/${o.id}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
              <span style={{ flex: 1 }}>
                <strong>{o.full_name}</strong>{' '}
                <PartyBadge party={o.party as any} />
                <br />
                <small><OfficialMeta official={o} /></small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
