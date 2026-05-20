import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface TXBillEnvelope {
  bill?: {
    lastActionDescription?: string
    lastActionDate?: string
    fiscalNote?: { totalCost?: number } | null
  }
}

type TXBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<TXBillEnvelope | null>

const defaultFetcher: TXBillFetcher = async (billRef) => {
  const url = `https://capitol.texas.gov/api/v1/bills/${billRef.session}/${billRef.bill_type}${billRef.number}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as TXBillEnvelope
  } catch {
    return null
  }
}

export const enrichTexas: StateEnrichAdapter = {
  state: 'TX',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: TXBillFetcher =
      (opts as never as { fetcher?: TXBillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = { state: 'TX', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'TX' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched?.bill) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'TX', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.bill.lastActionDescription      ?? null,
          hearing_date:         fetched.bill.lastActionDate              ?? null,
          fiscal_impact_amount: fetched.bill.fiscalNote?.totalCost       ?? null,
          augmented_from:       'tx-capitol',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`TX ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
