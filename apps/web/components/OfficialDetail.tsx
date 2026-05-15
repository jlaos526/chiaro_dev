'use client'

import Link from 'next/link'
import { useOfficial } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

export function OfficialDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useOfficial(client, id)

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Couldn't load this official.</p>

  return (
    <article>
      <Link href="/officials">← Back</Link>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
        <OfficialAvatar fullName={data.full_name} portraitUrl={data.portrait_url} size={96} />
        <div>
          <h1 style={{ margin: 0 }}>{data.full_name}</h1>
          <p style={{ margin: '4px 0' }}>
            <PartyBadge party={data.party as any} />{' '}
            <OfficialMeta official={data} />
          </p>
        </div>
      </header>
      <dl style={{ marginTop: 16 }}>
        <dt>Chamber</dt><dd>{data.chamber === 'house' ? 'House of Representatives' : 'Senate'}</dd>
        <dt>State</dt><dd>{data.state}</dd>
        <dt>District</dt><dd>{data.district.name}</dd>
        {data.senate_class != null && (<><dt>Senate class</dt><dd>{data.senate_class}</dd></>)}
        {data.next_election && (<><dt>Next election</dt><dd>{data.next_election}</dd></>)}
        {data.official_url && (
          <>
            <dt>Official site</dt>
            <dd><a href={data.official_url} target="_blank" rel="noreferrer">{data.official_url}</a></dd>
          </>
        )}
        {data.twitter_handle && (
          <>
            <dt>Twitter</dt>
            <dd>
              <a href={`https://twitter.com/${data.twitter_handle}`} target="_blank" rel="noreferrer">
                @{data.twitter_handle}
              </a>
            </dd>
          </>
        )}
      </dl>
    </article>
  )
}
