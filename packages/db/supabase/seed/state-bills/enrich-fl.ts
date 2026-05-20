import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface FLBillEnvelope {
  bill?: {
    CurrentCommittee?: string
    LastActionDate?: string
    FiscalImpactStatement?: { TotalAmount?: number }
  }
}

type FLBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<FLBillEnvelope | null>

const defaultFetcher: FLBillFetcher = async (billRef) => {
  const isHouse = billRef.bill_type === 'HB'
  const url = isHouse
    ? `https://www.myfloridahouse.gov/Sections/Bills/billsdetail.aspx?BillId=${billRef.bill_type}${billRef.number}&SessionId=${billRef.session}`
    : `https://www.flsenate.gov/Tracker/API/Bill/${billRef.bill_type}${billRef.number}/${billRef.session}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as FLBillEnvelope
  } catch {
    return null
  }
}

export const enrichFlorida: StateEnrichAdapter = {
  state: 'FL',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: FLBillFetcher =
      (opts as never as { fetcher?: FLBillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = { state: 'FL', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'FL' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched?.bill) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'FL', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.bill.CurrentCommittee                  ?? null,
          hearing_date:         fetched.bill.LastActionDate                    ?? null,
          fiscal_impact_amount: fetched.bill.FiscalImpactStatement?.TotalAmount ?? null,
          augmented_from:       'fl-senate-api',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`FL ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
