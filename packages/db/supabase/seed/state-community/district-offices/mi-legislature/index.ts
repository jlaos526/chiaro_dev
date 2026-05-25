import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchMiSenateOffices } from './senate.ts'
import { fetchMiHouseOffices } from './house.ts'

/**
 * MI state-legislator district offices, combining Senate
 * (senate.michigan.gov per-senator) and House
 * (house.mi.gov per-rep with TLS-flake tolerance).
 *
 * Slug `mi-legislature` is the slice 5H stub legacy name. Kept
 * for back-compat with state_community_orgs row continuity.
 */
export const miLegislatureOffices: StateCommunityAdapter = {
  slug: 'mi-legislature',
  component: 'offices',
  covered_states: ['MI'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (injected) return injected()

    const [senate, house] = await Promise.all([
      fetchMiSenateOffices(opts.client, {}),
      fetchMiHouseOffices(opts.client, {}),
    ])
    return [...senate, ...house]
  },
}
