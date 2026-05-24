import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * Michigan does not publish a standing online portal for ethics
 * complaints against state legislators. MI Bureau of Elections
 * receives PFD-compliance complaints but does not expose them via a
 * public enforcement-actions feed.
 *
 * Recall/expulsion events for MI legislators continue to be sourced
 * via slice 9's Ballotpedia recalls adapter (nationwide). No source
 * exists for campaign-finance-violation events in MI.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const miBoardComplaints: StateEthicsAdapter = {
  slug: 'mi-board',
  component: 'complaints',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedEthicsComplaint[]> {
    return []
  },
}
