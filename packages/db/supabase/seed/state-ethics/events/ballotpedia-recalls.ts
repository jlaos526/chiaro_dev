import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export const ballotpediaRecalls: StateEthicsAdapter = {
  slug: 'ballotpedia',
  component: 'events',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires ballotpedia.org/State_legislative_recalls HTML scrape.
    return []
  },
}
