'use client'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { ScorecardCard } from './ScorecardCard'
import { FinanceCard } from './FinanceCard'
import { ShowUpWorkloadCard } from './ShowUpWorkloadCard'
import { PositionSalaryCard } from './PositionSalaryCard'
import { ConstituentConnectionCard } from './ConstituentConnectionCard'

const client = createSupabaseBrowserClient()

export function OfficialPerformance({ officialId }: { officialId: string }) {
  const scorecards = useOfficialScorecardRatings(client, officialId)

  return (
    <article style={{ display: 'grid', gap: 24, marginTop: 24 }}>
      <h2 style={{ margin: 0 }}>Performance — 119th Congress</h2>

      <section>
        <h3 style={{ margin: '0 0 8px' }}>Issue stance scorecards</h3>
        {scorecards.isLoading ? <p>Loading…</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {(scorecards.data ?? []).map(r => (
              <ScorecardCard key={r.id} rating={r} officialId={officialId} />
            ))}
            {(scorecards.data ?? []).length === 0 && (
              <p style={{ color: '#999' }}>No scorecards ingested yet — run pnpm seed:scorecards.</p>
            )}
          </div>
        )}
      </section>

      <FinanceCard officialId={officialId} />
      <ShowUpWorkloadCard officialId={officialId} />
      <PositionSalaryCard officialId={officialId} />
      <ConstituentConnectionCard officialId={officialId} />
    </article>
  )
}
