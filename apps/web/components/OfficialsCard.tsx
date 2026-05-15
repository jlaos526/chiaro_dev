'use client'

import Link from 'next/link'
import { useMyOfficials } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

export function OfficialsCard() {
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <section aria-label="Your officials"><p>Loading your officials…</p></section>
  if (error)     return <section aria-label="Your officials"><p>Couldn't load officials.</p></section>
  if (!data || data.length === 0) {
    return (
      <section aria-label="Your officials">
        <h2>Your officials</h2>
        <p><Link href="/calibrate">Calibrate your address</Link> to see your delegation.</p>
      </section>
    )
  }

  return (
    <section aria-label="Your officials">
      <h2>Your officials</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {data.map((o) => (
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
      <p><Link href="/officials">See all officials →</Link></p>
    </section>
  )
}
