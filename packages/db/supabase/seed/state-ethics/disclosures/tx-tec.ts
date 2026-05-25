import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * Texas Ethics Commission explicitly does not publish Personal
 * Financial Statements (PFS) online. The TEC Quick View page
 * states filings exist but the agency withholds the file feed.
 * No production parser is possible for TX financial disclosures
 * without CPRA-style request fulfillment.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const txTecDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'tx-tec',
  component: 'disclosures',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedFinancialDisclosure[]> {
    return []
  },
}
