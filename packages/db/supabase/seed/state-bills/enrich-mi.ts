import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface MIBillEnvelope {
  LastAction?: string
  LastActionDate?: string
  FiscalImpact?: number
}

type MIBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<MIBillEnvelope | null>

const defaultFetcher: MIBillFetcher = async (billRef) => {
  const url = `https://legislature.mi.gov/api/bill?billno=${billRef.bill_type}${billRef.number}&session=${billRef.session}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as MIBillEnvelope
  } catch {
    return null
  }
}

export const enrichMichigan: StateEnrichAdapter = {
  state: 'MI',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: MIBillFetcher =
      (opts as never as { fetcher?: MIBillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = { state: 'MI', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'MI' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'MI', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.LastAction       ?? null,
          hearing_date:         fetched.LastActionDate   ?? null,
          fiscal_impact_amount: fetched.FiscalImpact     ?? null,
          augmented_from:       'mi-legislature',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`MI ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
