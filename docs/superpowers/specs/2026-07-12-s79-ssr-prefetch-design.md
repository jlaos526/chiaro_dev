# S79 — SSR prefetch + round-trip collapse (design)

Wave-3 opener (optimization-roadmap S79; audit C4 + C18 + C22 + C7). Requirements
source is the 2026-06-10 audit; this spec pins the decisions the findings left open.
Critic ruling honored: **C4 lands before C18** (prefetch is keyed on the query-key
contract, so C18's fetcher-internal rewrites don't disturb it).

## Decisions

### D1 — C4 prefetch scope (web detail pages)
Server-prefetch **exactly the queries the cards fire unconditionally on mount**,
via `QueryClient.prefetchQuery` + `Promise.all` + `<HydrationBoundary>`:

- Federal `/officials/[id]`: metrics, sponsored/cosponsored/missed **counts**
  (S75 shapes), stock transactions, holdings, disclosure-other, finance,
  town halls, district offices, scorecard ratings, leadership history.
- State `/state-officials/[id]`: metrics, state votes, sponsored state bills,
  state finance summary + donors, state scorecards, state town halls, state
  district offices, committee hearings, financial disclosures, ethics
  complaints, official events.

**Excluded**: the S75 `enabled: openX`-gated full-row bill/vote queries (fetch
on expand stays lazy — prefetching them would undo S75), and the two per-user
issue RPCs (alignment, watchlist flags — auth-context data; client-side).
C18(c) — the server/client double-fetch of leadership + scorecards — dissolves
here: the page stops hand-fetching them and the dehydrated cache serves both
the bio composition and the card hooks.

### D2 — C18 embed collapses (all proven against real PostgREST before merge)
1. **Finance 5→1**: `finance_summaries` with 4 child embeds; fetcher composes
   the existing `OfficialFinance` shape — hooks/keys unchanged.
2. **Sponsored/cosponsored 2→1 (federal AND state)**: invert to anchor on the
   bills table (S75 state-votes precedent): `bills.select('*, sponsors:bill_sponsors!inner(role)')`
   filtered on `sponsors.official_id` + `sponsors.role` + `congress`, ordered
   server-side on the parent's own date column. Return shape unchanged.
3. **State donors 3→1**: donors fetcher becomes one query — summary row with
   `donors:state_finance_individual_donors(*)` embed (rank-ordered).
4. **Hearings 3→1**: anchor on `state_committee_hearings` with
   `attendance:...!inner(official_id)` filter (the "PostgREST cannot filter on
   joined columns" comment predates `!inner`).
5. **Catalog 2→1**: `issue_topics.select('*, lenses:issue_lenses(*)')` with
   embedded `active` filter + embedded `display_order` ordering.

### D3 — C22 home N+1: EMBED variant
`fetchMyOfficials` embeds `metrics:official_metrics(salary_role,tenure_years)`
+ `ratings:scorecard_ratings(*, org:scorecard_orgs(issue_area,scoring_max))`;
`OfficialsCard`'s per-row hooks are REMOVED and rows read the embedded data.
(2 + 2N requests → 2. The batched-fetcher variant was rejected: key-compat
bookkeeping for no additional win once rows stop fetching.)

### D4 — C7: `onPrefetch` callback, not next/link
SmartAnchor stays next-free (shared package): optional `onPrefetch?: () => void`
fired on `onMouseEnter`/`onFocus` in the web branch only. Web wrappers pass
`() => router.prefetch(href)`. Hover/focus-gated ONLY — no viewport prefetch
(N-row fan-out per the verifier's pushback).

## Verification contract
- Every new embed shape gets a live-PostgREST integration case (S75 harness
  precedent; officials package gains an integration block for finance/bills
  embeds; issues catalog asserted against the seeded local catalog).
- Result-equivalence: existing unit suites keep passing with mocks updated to
  the new chains only where chains changed.
- Bundle/round-trip evidence in the PR: request-count table before/after
  (from code inspection: federal ~29 → ~11 client-side becomes ~0 on
  first paint + hydrate; exact table in the PR body).
