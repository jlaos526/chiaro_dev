import {
  type StateEnrichAdapter,
  type EnrichStats,
  updateStateBillAugment,
  fetchWithRetry,
} from './shared.ts'

interface NYSenateBillEnvelope {
  result?: {
    status?: { statusDesc?: string; actionDate?: string }
    votes?: {
      items?: Array<{
        memberVotes?: {
          items?: Record<string, { count: number }>
        }
      }>
    }
    fiscalNote?: { totalCost?: number }
  }
}

type NYBillFetcher = (billRef: {
  bill_type: string
  number: number
  session: string
}) => Promise<NYSenateBillEnvelope | null>

const defaultFetcher =
  (apiKey: string): NYBillFetcher =>
  async (billRef) => {
    const url = `https://api.nysenate.gov/api/3/bills/${billRef.session}/${billRef.bill_type}${billRef.number}?key=${apiKey}`
    try {
      const res = await fetchWithRetry(url)
      if (!res.ok) return null
      return (await res.json()) as NYSenateBillEnvelope
    } catch {
      return null
    }
  }

export const enrichNewYork: StateEnrichAdapter = {
  state: 'NY',
  async enrich(opts): Promise<EnrichStats> {
    const apiKey = process.env.NY_SENATE_API_KEY
    if (!apiKey) {
      return {
        state: 'NY',
        billsUpdated: 0,
        errors: [],
        skipped: true,
        skipReason: 'NY_SENATE_API_KEY not set — NY augment skipped',
      }
    }

    const fetcher: NYBillFetcher =
      (opts as never as { fetcher?: NYBillFetcher }).fetcher ?? defaultFetcher(apiKey)

    const stats: EnrichStats = { state: 'NY', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'NY' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type,
          number: b.number,
          session: opts.session,
        })
        if (!fetched?.result) continue
        const status = fetched.result.status
        const fiscalNote = fetched.result.fiscalNote
        const voteItems = fetched.result.votes?.items?.[0]?.memberVotes?.items
        const partyVoteSplit = voteItems
          ? Object.fromEntries(Object.entries(voteItems).map(([k, v]) => [k, v.count]))
          : null

        const updated = await updateStateBillAugment(
          opts.client,
          {
            state: 'NY',
            session: opts.session,
            bill_type: b.bill_type,
            number: b.number,
          },
          {
            status_substage: status?.statusDesc ?? null,
            hearing_date: status?.actionDate ?? null,
            fiscal_impact_amount: fiscalNote?.totalCost ?? null,
            party_vote_split: partyVoteSplit ?? null,
            augmented_from: 'ny-senate-api',
          },
        )
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`NY ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
