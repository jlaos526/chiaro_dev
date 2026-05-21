import type { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
  upsertStateFinance,
  resolveOfficialByName,
} from './shared.ts'

interface FLFilingPayload {
  full_name: string
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source_url: string
  donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer?: string | null
    occupation?: string | null
    city?: string | null
    donor_state?: string | null
  }>
}

type FLFetcher = (cycle: string) => Promise<FLFilingPayload[]>

const defaultFetcher: FLFetcher = async () => {
  // Production: scrape dos.elections.myflorida.com.
  // HTML-fragile; expect parser maintenance churn. Stub returns [].
  return []
}

const STATE: FinanceState = 'FL'

export const fetchFlorida: StateFinanceAdapter = {
  state: STATE,
  async fetch(opts): Promise<StateFinanceStats> {
    const fetcher: FLFetcher =
      (opts as never as { fetcher?: FLFetcher }).fetcher ?? defaultFetcher

    const stats: StateFinanceStats = {
      state: STATE,
      summariesUpserted: 0,
      donorsUpserted: 0,
      officialsMatched: 0,
      officialsUnmatched: [],
      errors: [],
    }

    let filings: FLFilingPayload[]
    try {
      filings = await fetcher(opts.cycle)
    } catch (err) {
      stats.errors.push(`FL fetcher failed: ${(err as Error).message}`)
      return stats
    }

    for (const f of filings) {
      try {
        const officialId = await resolveOfficialByName(opts.client, {
          full_name: f.full_name, state: STATE, chamber: f.chamber,
        })
        if (!officialId) {
          stats.officialsUnmatched.push(f.full_name)
          continue
        }
        await upsertStateFinance(opts.client,
          { official_id: officialId, cycle: opts.cycle },
          {
            total_raised: f.total_raised,
            total_disbursed: f.total_disbursed,
            small_donor_pct: f.small_donor_pct,
            in_state_pct: f.in_state_pct,
            source: 'fl-doe',
            source_url: f.source_url,
          },
          f.donors,
        )
        stats.summariesUpserted += 1
        stats.donorsUpserted += f.donors.length
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push(`FL ${f.full_name}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
