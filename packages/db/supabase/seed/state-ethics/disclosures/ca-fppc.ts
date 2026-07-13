import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

/**
 * @deprecated CA Form 700 source migrated to Granicus DisclosureDocs
 * SPA (vendor-managed JavaScript application at
 * `form700search.fppc.ca.gov`). Pre-slice-21 audit (2026-05-25)
 * confirmed bucket-B classification — cheerio HTML scrape is no
 * longer tractable. See `docs/superpowers/audits/2026-05-25-ca-fppc-revalidation.md`
 * + Gotcha #24.
 *
 * Adapter stays in `state_ethics_orgs` registry for back-compat
 * (slice 5I row continuity); fetchEvents returns []. Operator should
 * NOT attempt a Playwright/Puppeteer pivot — slices 9 + 11 established
 * the no-headless-browser convention. If FPPC publishes a stable
 * REST/JSON API in the future, revisit this adapter.
 */
export const caFppcDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'ca-fppc',
  component: 'disclosures',
  status: 'deprecated',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
