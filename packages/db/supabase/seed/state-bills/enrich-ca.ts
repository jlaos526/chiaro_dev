import {
  type StateEnrichAdapter,
  type EnrichStats,
  updateStateBillAugment,
  fetchWithRetry,
} from './shared.ts'

interface CALeginfoBillEnvelope {
  bill_id: string
  session: string
  status_substage?: string
  hearing_date?: string
  fiscal_impact_amount?: number
  party_vote_split?: object
}

type CABillFetcher = (billRef: {
  bill_type: string
  number: number
  session: string
}) => Promise<CALeginfoBillEnvelope | null>

const defaultFetcher: CABillFetcher = async (billRef) => {
  const url = `https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=${billRef.bill_type}-${billRef.number}&session=${billRef.session}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('json')) return (await res.json()) as CALeginfoBillEnvelope
    return null
  } catch {
    return null
  }
}

export const enrichCalifornia: StateEnrichAdapter = {
  state: 'CA',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: CABillFetcher =
      (opts as never as { fetcher?: CABillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = {
      state: 'CA',
      billsUpdated: 0,
      errors: [],
    }

    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'CA' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type,
          number: b.number,
          session: opts.session,
        })
        if (!fetched) continue
        const updated = await updateStateBillAugment(
          opts.client,
          {
            state: 'CA',
            session: opts.session,
            bill_type: b.bill_type,
            number: b.number,
          },
          {
            status_substage: fetched.status_substage ?? null,
            hearing_date: fetched.hearing_date ?? null,
            fiscal_impact_amount: fetched.fiscal_impact_amount ?? null,
            party_vote_split: fetched.party_vote_split ?? null,
            augmented_from: 'ca-leginfo',
          },
        )
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`CA ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
