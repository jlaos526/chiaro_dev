import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'
import { fetchSwornComplaintOrders } from '../tx-tec/shared.ts'

/**
 * TX ethics complaints from TEC sworn-complaint orders table.
 *
 * Combined-parser pattern (mirror of slice 15 ny-coelig). Shared
 * helper at ../tx-tec/shared.ts fetches the orders table and emits
 * BOTH complaints + events; this wrapper returns only the complaints
 * slice.
 *
 * HTML-only; per-case PDFs at
 * ethics.state.tx.us/data/enforcement/sworn_complaints/<year>/<id>.pdf
 * deferred to a future PDF-parsing slice.
 */
export const txTecComplaints: StateEthicsAdapter<NormalizedEthicsComplaint> = {
  slug: 'tx-tec',
  component: 'complaints',
  status: 'production',
  covered_states: ['TX'],
  async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
    if (opts.fetcher) return opts.fetcher()
    const { complaints } = await fetchSwornComplaintOrders(opts.client, {
      ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
    })
    return complaints
  },
}
