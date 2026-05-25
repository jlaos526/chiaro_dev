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
export const txTecComplaints: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'complaints',
  covered_states: ['TX'],
  async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (injected) return injected()
    const { complaints } = await fetchSwornComplaintOrders(opts.client, {})
    return complaints
  },
}
