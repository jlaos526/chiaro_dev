# Slice 4: Bills, Votes & Officials Performance Metrics — Design

**Date:** 2026-05-15
**Status:** Draft for review
**Slice:** Fourth vertical slice — Congress.gov bills + votes ingest, advocacy scorecard ratings, OpenSecrets campaign finance, salary + leadership history, constituent-connection cluster (residency, district offices, town halls, STOCK Act), performance metrics dashboard, compare view, bills/vote browsing, mobile parity.

## Goal

Shift Chiaro from "show me my reps" (slice 3) to **"show me what my reps actually do"** — built on a substantive issue-stance + campaign-finance + constituent-connection backbone, NOT generic civics metrics. A calibrated user lands on home, sees their federal officials' performance signals at a glance, drills into any rep's full metrics dashboard with underlying votes / bills / contributions / filings as evidence, can compare two reps side-by-side, can browse the bills + votes corpus directly.

**Drill-down transparency is a first-class requirement at every layer.** No metric value in the UI is shown without clickable provenance. Schema enforces this with `source_url` columns or evidence-FK tables per metric. Hooks return value-plus-evidence pairs. UI cards are clickable to evidence drawers.

Slice 4 also absorbs two previously-deferred sources:
- `github.com/unitedstates/congress-legislators` (slice 3 spec flagged it for "slice 4+") — needed here for leadership-role lookup (drives salary tier) + district office addresses + `bioguide_id ↔ opensecrets_id ↔ fec_candidate_id` mapping.

No state/local officials — that's slice 5.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Tier scope | Federal only — house + senate. State/local deferred to slice 5. |
| 2 | Headline feature | Issue-stance scorecards (advocacy ratings) + campaign finance influence + constituent-connection cluster — all surfaced on official detail page + home mini-strip + compare view |
| 3 | Underlying data | Bills + votes ingested from Congress.gov v3; bill ↔ subject mapping is the Library of Congress taxonomy already on bills |
| 4 | Stance methodology | External advocacy scorecards (primary) + raw vote tallies + bill-subject filter as drill-down. Slice 4 ships ~10 scorecards spanning left/right/single-issue lenses (LCV, Sierra Club, ACLU, NAACP, Planned Parenthood, ADA, Heritage Action, US Chamber, NRA, AFL-CIO). |
| 5 | Finance source | [OpenSecrets API](https://www.opensecrets.org/api) — top donor industries, named PAC contributions (including AIPAC-aligned PACs, NRA Political Victory Fund, etc.), small-donor %, total raised, in-state vs out-of-state breakdown |
| 6 | UI surfaces | (a) Official detail-page 5-section Performance dashboard (b) Home `OfficialsCard` mini-stat strip per rep (c) `/officials/compare?a=X&b=Y` side-by-side (d) `/bills` list + `/bills/[id]` detail with full roll-call results |
| 7 | Time window | Current Congress (119th, 2025–2026) for percentages + per-issue scores. Lifetime counters for tenure + career bill counts. No per-Congress historical scorecard drilldown (slice 6+). |
| 8 | Stance directional tagging | We do NOT editorially tag bills as "pro-X" or "anti-X". The scorecard publishers do that (their methodology, their judgment). We expose multiple scorecards across the spectrum and let users pick whose lens aligns with their values. |
| 9 | Metrics storage | Pre-computed into `official_metrics` table during ingest by a dedicated `recompute-metrics.ts` script; refreshed on every seed cycle (manual cadence matches slice 3) |
| 10 | Drill-down transparency | Every metric clickable → underlying votes/bills/contributions/filings. Every persisted metric row has either an explicit `source_url` column or evidence-FK rows. No black-box scores anywhere in the UI. |
| 11 | Per-tier scope | Federal house + senate only. Mobile + web parity follows slice 2/3 pattern. |
| 12 | Salary + leadership | Static CRS-sourced salary schedule (Member $174,000; Speaker $223,500; floor leaders + whips $193,400; chairs/ranking same as Members under current statute) × leadership role from Congress.gov v3 + unitedstates/congress-legislators YAML. Stored on `official_metrics.salary_usd` + `salary_role`. New `officials_leadership_history` table enables career-leadership drill-down. |
| 13 | Residency check | FEC Form 2 home address → GeocodIO → PostGIS spatial-contains query against the represented district. Stored as boolean + home district FK on `official_metrics`. **Precise coordinates are computed in-memory during ingest and never persisted** (privacy posture). House: meaningful signal. Senate: documented N/A (represented district = state). |
| 14 | Constituent connection cluster | 7 signals beyond raw residency: lives_in_district + in-state donor % + out-of-state donor % + district offices count + town halls held + STOCK Act compliance % + (in-district donor % deferred to slice 5 due to OpenSecrets free-tier limitation). |

## Architecture

### Monorepo additions

```
packages/
  db/
    supabase/
      migrations/
        0014_bills.sql                            # bills + bill_subjects + bill_sponsors junctions
        0015_bills_rls.sql
        0016_votes.sql                            # votes + vote_positions
        0017_votes_rls.sql
        0018_scorecards.sql                       # scorecard_orgs + scorecard_ratings
        0019_scorecards_rls.sql
        0020_finance.sql                          # finance_summaries + finance_industry_top + finance_pac_contributions
        0021_finance_rls.sql
        0022_official_metrics.sql                 # pre-computed scalar rollups + district_offices + town_halls + stock_transactions + officials_leadership_history
        0023_official_metrics_rls.sql
      seed/
        bills-votes-ingest.ts                     # Congress.gov v3
        scorecards/
          index.ts                                # orchestrator
          lcv.ts                                  # League of Conservation Voters CSV
          sierra-club.ts
          aclu.ts
          naacp.ts
          planned-parenthood.ts
          ada.ts                                  # Americans for Democratic Action
          heritage-action.ts
          us-chamber.ts
          nra.ts
          afl-cio.ts
          shared/                                 # bioguide-id resolver, fetch-with-retry
        finance-ingest.ts                         # OpenSecrets
        salary-residency-ingest.ts                # CRS schedule + FEC + GeocodIO + PostGIS
        town-halls-ingest.ts                      # Town Hall Project
        stock-watcher-ingest.ts                   # house-stock-watcher + senate-stock-watcher
        unitedstates-legislators-ingest.ts        # unitedstates/congress-legislators YAML
        recompute-metrics.ts                      # derives official_metrics rollups
        congressional-salary-schedule.ts          # static CRS-sourced table
      tests/
        bills_rls.test.sql
        votes_rls.test.sql
        scorecards_rls.test.sql
        finance_rls.test.sql
        official_metrics_rls.test.sql

  bills/                                          # NEW domain package
    src/
      index.ts
      types.ts                                    # BillRow, VoteRow, BillWithSubjectsAndSponsors, VoteWithPositions
      schemas.ts                                  # zod for Congress.gov bill + vote payloads
      keys.ts                                     # billsKeys + votesKeys hierarchical factories
      queries.ts                                  # fetchBills, fetchBill, fetchBillVotes,
                                                  # fetchOfficialSponsoredBills, fetchOfficialCosponsoredBills,
                                                  # fetchOfficialMissedVotes, fetchVotesOnSubject
      hooks.ts                                    # useBills, useBill, useBillVotes,
                                                  # useOfficialSponsoredBills, useOfficialMissedVotes,
                                                  # useOfficialVotesOnSubject

  officials/                                      # EXTENDED
    src/
      queries.ts                                  # + fetchOfficialMetrics, fetchOfficialScorecardRatings,
                                                  # + fetchOfficialFinanceSummary, fetchOfficialFinanceIndustries,
                                                  # + fetchOfficialFinancePACs, fetchOfficialDistrictOffices,
                                                  # + fetchOfficialTownHalls, fetchOfficialStockTransactions,
                                                  # + fetchOfficialLeadershipHistory
      hooks.ts                                    # + useOfficialMetrics, useOfficialScorecardRatings,
                                                  # + useOfficialFinance, useOfficialDistrictOffices,
                                                  # + useOfficialTownHalls, useOfficialStockTransactions,
                                                  # + useOfficialLeadershipHistory
      keys.ts                                     # + officialsKeys.metrics(id), .scorecards(id), .finance(id, cycle),
                                                  # + .districtOffices(id), .townHalls(id), .stockTransactions(id),
                                                  # + .leadershipHistory(id)

  ui-tokens/                                      # EXTENDED
    src/
      scorecard.ts                                # NEW: SCORECARD_LEAN_COLOR (progressive/conservative/etc.)
      finance.ts                                  # NEW: INDUSTRY_COLOR/INDUSTRY_LABEL helpers

apps/
  web/
    app/
      officials/[id]/page.tsx                     # MODIFIED: + Performance section composition
      officials/compare/page.tsx                  # NEW
      bills/page.tsx                              # NEW
      bills/[id]/page.tsx                         # NEW
    components/
      OfficialPerformance.tsx                     # NEW: top-level composer for the 5 sub-sections
      ScorecardCard.tsx                           # NEW: one scorecard rating card
      ScorecardEvidenceDrawer.tsx                 # NEW: drill-down to votes scored
      FinanceCard.tsx                             # NEW: top industries + PACs + totals
      FinanceIndustryBreakdown.tsx                # NEW: bar chart of top 10 industries
      ShowUpWorkloadCard.tsx                      # NEW: attendance, sponsorship, committee counts
      PositionSalaryCard.tsx                      # NEW: salary, tenure, leadership history
      ConstituentConnectionCard.tsx               # NEW: lives_in_district, offices, town halls, STOCK Act
      ComparePane.tsx                             # NEW: one column for one official in compare view
      BillsList.tsx                               # NEW: filterable list
      BillDetail.tsx                              # NEW: bill detail + roll-call table
      RollCallTable.tsx                           # NEW: chamber-wide vote positions per bill
      OfficialsCard.tsx                           # MODIFIED: + mini-stat strip
      MetricCardShell.tsx                         # NEW: shared scaffold — every metric card uses this
                                                  #      and ensures clickable drill-down affordance

  mobile/                                         # mirrored set of equivalents under apps/mobile/
```

### Schema migrations

#### `0014_bills.sql`

```sql
create type public.bill_type as enum ('hr','s','hjres','sjres','hconres','sconres','hres','sres');
create type public.bill_status as enum (
  'introduced','in_committee','reported','passed_chamber',
  'passed_both','enrolled','signed','vetoed','became_law','died'
);

create table public.bills (
  id               uuid primary key default gen_random_uuid(),
  congress         text not null,
  bill_type        public.bill_type not null,
  number           int  not null,
  title            text not null,
  short_title      text,
  policy_area      text,
  status           public.bill_status not null,
  introduced_date  date not null,
  latest_action    text,
  source_url       text not null,
  congress_gov_url text,
  ingested_at      timestamptz not null default now(),
  unique (congress, bill_type, number)
);

create table public.bill_subjects (
  bill_id uuid not null references public.bills(id) on delete cascade,
  subject text not null,
  primary key (bill_id, subject)
);

create table public.bill_sponsors (
  bill_id     uuid not null references public.bills(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete restrict,
  role        text not null check (role in ('sponsor','cosponsor')),
  added_date  date,
  primary key (bill_id, official_id, role)
);

create index bills_congress_idx         on public.bills(congress);
create index bills_policy_area_idx      on public.bills(policy_area);
create index bill_subjects_subject_idx  on public.bill_subjects(subject);
create index bill_sponsors_official_idx on public.bill_sponsors(official_id, role);
```

#### `0016_votes.sql`

```sql
create type public.vote_position as enum ('yes','no','present','not_voting');

create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  congress    text not null,
  chamber     public.official_chamber not null,
  session     int  not null,
  roll_call   int  not null,
  vote_date   date not null,
  question    text not null,
  result      text not null,
  bill_id     uuid references public.bills(id) on delete set null,
  source_url  text not null,
  ingested_at timestamptz not null default now(),
  unique (congress, chamber, session, roll_call)
);

create table public.vote_positions (
  vote_id     uuid not null references public.votes(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete restrict,
  position    public.vote_position not null,
  primary key (vote_id, official_id)
);

create index votes_bill_idx              on public.votes(bill_id) where bill_id is not null;
create index vote_positions_official_idx on public.vote_positions(official_id);
```

#### `0018_scorecards.sql`

```sql
create table public.scorecard_orgs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  issue_area      text not null,
  lean            text check (lean in ('progressive','conservative','libertarian','single-issue','centrist')),
  methodology_url text not null,
  scoring_min     int  not null default 0,
  scoring_max     int  not null default 100,
  notes           text
);

create table public.scorecard_ratings (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.scorecard_orgs(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  congress     text not null,
  score        numeric(5,2) not null,
  source_url   text not null,
  ingested_at  timestamptz not null default now(),
  unique (scorecard_id, official_id, congress)
);

create index scorecard_ratings_official_idx on public.scorecard_ratings(official_id, congress);
```

#### `0020_finance.sql`

```sql
create table public.finance_summaries (
  id               uuid primary key default gen_random_uuid(),
  official_id      uuid not null references public.officials(id) on delete restrict,
  cycle            text not null,
  total_raised     numeric(15,2),
  total_disbursed  numeric(15,2),
  small_donor_pct  numeric(5,2),
  in_state_pct     numeric(5,2),
  out_of_state_pct numeric(5,2),
  opensecrets_id   text not null,
  source_url       text not null,
  ingested_at      timestamptz not null default now(),
  unique (official_id, cycle)
);

create table public.finance_industry_top (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank               int  not null check (rank between 1 and 25),
  industry           text not null,
  amount             numeric(15,2) not null,
  primary key (finance_summary_id, rank)
);

create table public.finance_pac_contributions (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  pac_name           text not null,
  pac_fec_id         text,
  amount             numeric(15,2) not null,
  primary key (finance_summary_id, pac_name)
);

create index finance_summaries_official_idx on public.finance_summaries(official_id, cycle);
```

#### `0022_official_metrics.sql` (scalar rollups + 4 evidence tables + officials external-ID columns)

```sql
-- Add external-ID join columns to officials so unitedstates-legislators-ingest
-- can populate them (needed by finance-ingest for OpenSecrets join and by
-- salary-residency-ingest for openFEC join).
alter table public.officials
  add column opensecrets_id   text,
  add column fec_candidate_id text;

create index officials_opensecrets_idx   on public.officials(opensecrets_id)   where opensecrets_id is not null;
create index officials_fec_candidate_idx on public.officials(fec_candidate_id) where fec_candidate_id is not null;

-- Scalar rollups: one row per official
create table public.official_metrics (
  official_id                  uuid primary key references public.officials(id) on delete cascade,
  congress                     text not null,

  -- Show-up + workload
  attendance_pct               numeric(5,2),
  votes_voted_count            int,
  votes_missed_count           int,
  total_roll_calls             int,
  bills_sponsored_count        int,
  bills_cosponsored_count      int,
  career_bills_sponsored_count int,
  committee_assignment_count   int,
  committee_leadership_count   int,
  tenure_years                 numeric(4,1),

  -- Alignment supplements (primary stance via scorecards)
  party_unity_pct              numeric(5,2),
  bipartisan_vote_pct          numeric(5,2),

  -- Position + salary
  salary_usd                   numeric(10,2),
  salary_role                  text,

  -- Constituent connection
  lives_in_district            boolean,
  home_district_id             uuid references public.districts(id) on delete set null,
  in_state_donations_pct       numeric(5,2),
  out_of_state_donations_pct   numeric(5,2),
  district_offices_count       int,
  town_halls_count             int,
  stock_act_disclosures_total  int,
  stock_act_disclosures_late   int,
  stock_act_compliance_pct     numeric(5,2),

  computed_at                  timestamptz not null default now()
);

-- Evidence: district offices
create table public.district_offices (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete cascade,
  address     text not null,
  city        text not null,
  state       text not null,
  zip         text,
  phone       text,
  source_url  text not null
);
create index district_offices_official_idx on public.district_offices(official_id);

-- Evidence: town halls
create table public.town_halls (
  id                  uuid primary key default gen_random_uuid(),
  official_id         uuid not null references public.officials(id) on delete cascade,
  event_date          date not null,
  city                text,
  state               text,
  format              text check (format in ('in_person','virtual','phone','hybrid')),
  attendance_estimate int,
  source_url          text not null,
  ingested_at         timestamptz not null default now()
);
create index town_halls_official_date_idx on public.town_halls(official_id, event_date desc);

-- Evidence: STOCK Act transactions
create table public.stock_transactions (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete cascade,
  transaction_date  date not null,
  filing_date       date not null,
  days_late         int  generated always as (greatest(filing_date - transaction_date - 45, 0)) stored,
  asset_ticker     text,
  asset_name       text,
  transaction_type text check (transaction_type in ('purchase','sale','exchange')),
  amount_range_low  numeric(15,2),
  amount_range_high numeric(15,2),
  source_url        text not null,
  ingested_at       timestamptz not null default now()
);
create index stock_transactions_official_idx on public.stock_transactions(official_id, transaction_date desc);

-- Evidence: leadership history (career, all Congresses served)
create table public.officials_leadership_history (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete cascade,
  role        text not null,                            -- 'Speaker', 'Majority Leader', 'Whip', 'Committee Chair: …', etc.
  chamber     public.official_chamber not null,
  party       text,
  start_date  date not null,
  end_date    date,                                     -- null if currently held
  source_url  text not null
);
create index officials_leadership_history_official_idx on public.officials_leadership_history(official_id, start_date desc);
```

#### `0015 / 0017 / 0019 / 0021 / 0023` — RLS

All five follow the slice-3 pattern:
1. `enable row level security` on every table
2. `create policy <table>_select_all for select using (true)` — public-read
3. `revoke insert, update, delete on public.<table> from anon, authenticated` — defense in depth
4. Writes only via service-role through ingest scripts
5. pgTAP test files mirror the slice-3 structure (existence + RLS posture + service-role-can-insert + anon-cannot-mutate). One test file per migration pair.

### Ingest pipelines (7 + recompute)

All ingest scripts follow the slice-3 defensive pattern: open audit run → preflight count check → BEGIN transaction → upsert with `source_url` per row → threshold guard if mass-changes → COMMIT or ROLLBACK with audit row recording outcome. Same `officials_ingest_runs` audit table extended with a `source` discriminator column (or split into per-source tables; decision in plan).

#### 1. `bills-votes-ingest.ts` — Congress.gov v3

Endpoints: `/v3/bill?congress=119` (list, paginated), `/v3/bill/119/{type}/{number}` (detail), `/v3/house-vote?congress=119` + senate equivalent (roll-call lists), `/v3/{chamber}-vote/119/{session}/{rollCall}/members` (per-roll-call positions).

Volume: ~10K bills, ~1K roll calls. First full ingest ~5 hours wall time spread over 5K-req/hour rate limit. Steady state: incremental via `?fromDateTime=last-run`.

#### 2. `scorecards/index.ts` — Advocacy organizations

Per-org adapter pattern. Each adapter exports `fetchRatings(congress): Promise<NormalizedRating[]>` returning `{ bioguideId, score, source_url }[]`. Orchestrator joins by `bioguide_id` and upserts. `scorecard_orgs` seeded once with methodology URLs (drill-down anchor).

Initial 10 orgs span the political spectrum: LCV, Sierra Club, ACLU, NAACP, Planned Parenthood Action Fund, ADA, Heritage Action, US Chamber of Commerce, NRA Political Victory Fund, AFL-CIO.

Adapters are fragile to org website changes — each ships with a checked-in fixture + parser test. Adapter failures isolated; one org's broken parser shouldn't tank the others.

#### 3. `finance-ingest.ts` — OpenSecrets

Endpoints: `candSummary`, `candIndustry`, `candPacs`, `candIndByState` (state breakdown for in-state %). 3-4 calls per official per cycle × 535 officials = ~1,800 calls. Free tier: 200/day → ~9 days for full first ingest. Steady state: weekly refresh of top 50 by views, monthly full sweep.

Join: `opensecrets_id` (CID), populated on `officials.opensecrets_id` from the unitedstates-legislators YAML's `id.opensecrets` field.

Env: `OPENSECRETS_API_KEY` (new).

#### 4. `salary-residency-ingest.ts` — Salary + Lives-in-District

Two concerns in one script:

**Salary:** static `congressional-salary-schedule.ts` × leadership role lookup. CRS-sourced; documented with `source_url` constant.

**Residency:**
```
for each official:
  fec_filing = await openfec.candidates.latest(fec_candidate_id)
  geo = await geocodio.geocode(fec_filing.address)
  resolved_district = await postgis_contains(geo.lat, geo.lng)
  update official_metrics set
    lives_in_district = (resolved_district == represented_district),
    home_district_id  = resolved_district
  -- discard geo.lat, geo.lng — DO NOT persist
```

Env: `OPENFEC_API_KEY` (new), `GEOCODIO_KEY` (existing).

#### 5. `town-halls-ingest.ts` — Town Hall Project

[townhallproject.com](https://townhallproject.com/) publishes event data publicly. Paginated REST. Stable schema. Filter by `member.bioguide_id` to join. New `town_halls` rows per event with `source_url` linking back to the Town Hall Project event page.

No auth required.

#### 6. `stock-watcher-ingest.ts` — STOCK Act compliance

[house-stock-watcher.com](https://house-stock-watcher.com/) and [senate-stock-watcher.com](https://senate-stock-watcher.com/) aggregate House Clerk + Senate Office of Public Records disclosures. Both publish JSON via public API. Ingest each disclosure with `transaction_date`, `filing_date`, asset details — the generated `days_late` column captures violations (filing_date > transaction_date + 45 days).

No auth required for either site's public API.

#### 7. `unitedstates-legislators-ingest.ts` — Leadership + district offices + ID mapping

Source: [github.com/unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) — fetch raw YAML from GitHub. Files used:
- `legislators-current.yaml` — `leadership_roles[]` + `id.opensecrets` + `id.fec[]` mapping
- `legislators-historical.yaml` — historical leadership roles
- `legislators-district-offices.yaml` — district offices

Populates: `officials_leadership_history`, `district_offices`, `officials.opensecrets_id`, `officials.fec_candidate_id` (new columns to add via small auxiliary migration in slice 4).

No auth. One-shot YAML fetch from GitHub raw.

#### 8. `recompute-metrics.ts` — derived rollups

Runs **after** all ingest scripts. Pure read-then-write SQL: aggregates from `vote_positions`, `bill_sponsors`, `finance_summaries`, `district_offices`, `town_halls`, `stock_transactions`, `officials_leadership_history` into `official_metrics` row per official.

```sql
-- Pseudo: one big UPSERT per official, computed from all the contributing tables
insert into official_metrics (official_id, congress, attendance_pct, ...)
select o.id, '119',
       compute_attendance(o.id),
       compute_party_unity(o.id),
       ...
from officials o
where o.in_office = true
on conflict (official_id) do update set ...;
```

Idempotent. No external API calls. Cheap to re-run.

### Data sources summary

| Source | Purpose | Auth | Volume |
|---|---|---|---|
| Congress.gov v3 | Bills + votes | `CONGRESS_GOV_API_KEY` (existing) | ~22K calls first run, incremental thereafter |
| 10 advocacy orgs | Issue-stance scorecards | None (scrape) | ~10 adapters, ~5400 ratings (10 × 540 officials) |
| OpenSecrets API | Campaign finance | `OPENSECRETS_API_KEY` (new) | ~1800 calls/cycle |
| FEC openFEC API | FEC Form 2 addresses (residency) | `OPENFEC_API_KEY` (new) | ~540 calls |
| GeocodIO | Residency geocoding | `GEOCODIO_KEY` (existing) | ~540 calls |
| Town Hall Project | Town halls | None | ~thousands of events |
| house/senate-stock-watcher | STOCK Act | None | ~10K-20K transactions/cycle |
| unitedstates/congress-legislators | Leadership + offices + ID mapping | None (GitHub raw YAML) | 3 YAML files |

### Data-fetching layer

#### `@chiaro/bills` (new package)

Mirrors `@chiaro/officials` package shape. Domain: bills + votes (one package, tightly coupled FK graph).

Peer deps: `@tanstack/react-query`, `react`, `@chiaro/db`, `@chiaro/supabase-client`.

Hooks (all return `{ data, isLoading, error }` + optionally `sourceUrl`):

- `useBills(client, { congress, subject?, sponsorId?, status? })` — paginated list
- `useBill(client, billId)` — single bill with subjects + sponsors
- `useBillVotes(client, billId)` — all votes on a bill + per-rep positions
- `useOfficialSponsoredBills(client, officialId, { congress })` — drill-down for sponsorship metrics
- `useOfficialCosponsoredBills(client, officialId, { congress })`
- `useOfficialMissedVotes(client, officialId, { congress })` — drill-down for attendance
- `useOfficialVotesOnSubject(client, officialId, subject)` — drill-down for scorecard / issue-stance

#### `@chiaro/officials` extensions

New queries and hooks for the metrics dashboard:
- `useOfficialMetrics(client, officialId)` — scalar dashboard data
- `useOfficialScorecardRatings(client, officialId)` — array of org ratings
- `useOfficialFinance(client, officialId, cycle)` — summary + top industries + PACs
- `useOfficialDistrictOffices(client, officialId)` — drill-down for offices metric
- `useOfficialTownHalls(client, officialId, { congress })` — drill-down for town halls metric
- `useOfficialStockTransactions(client, officialId)` — drill-down for STOCK Act metric
- `useOfficialLeadershipHistory(client, officialId)` — drill-down for tenure + salary metric

All hooks accept the convention `{ enabled?: boolean }` so drill-down evidence hooks fire lazily on user interaction.

### UI surfaces

#### Surface 1: Official detail page Performance section

`/officials/[id]` adds a 5-section `Performance` block below the existing biographical info:

1. **Issue stance scorecards** — 10-card grid; each card has org name, issue area, score, methodology link, expand-affordance to evidence drawer with votes the org scored.

2. **Campaign finance — 2024 cycle** — Total raised, small-donor %, in-state vs out-of-state %, top 10 industries (bar chart), top 5 named PACs (incl. AIPAC PAC, NRA PVF, etc.). Every value clickable; "View on OpenSecrets" external link.

3. **Show-up & workload** — Attendance %, bills sponsored / cosponsored, career bills sponsored, committee assignments + leadership count, tenure years, party unity %, bipartisan vote %. All numbers clickable to drill-down (missed votes list, sponsored bills list, committee details, leadership history).

4. **Position, salary & leadership** — Base salary + role, tenure years, leadership history timeline. Salary value links to CRS schedule; history links to `officials_leadership_history` rows.

5. **Constituent connection** — Lives in district (✓/✗/N/A), in-state donor %, out-of-state donor %, district offices count + cities, town halls held + most-recent event, STOCK Act compliance % + late filings count. Each value clickable to evidence.

Composed via `OfficialPerformance.tsx` which delegates to 5 sub-cards. Every card uses `MetricCardShell.tsx` which enforces the drill-down contract (must accept `onExpand` prop; must render external `source_url` if no internal drill-down available).

#### Surface 2: Home `OfficialsCard` mini-stat strip

Below each official's name in the existing home officials card:

```
Senator Alex Padilla (D-CA)  [D]
  LCV 92  ·  ACLU 88  ·  NRA 8  ·  Top industry: Securities  ·  Attendance 94%
```

Fixed selection for slice 4 (configurable in slice 6). Each chip clickable → jumps to the corresponding section of the detail page with an anchor.

#### Surface 3: `/officials/compare?a=X&b=Y` side-by-side

Two `ComparePane` columns. Each column renders the same 5-section dashboard from Surface 1 but condensed. Aligned rows so the eye can scan deltas. Swap-officials affordance + shareable URL via query params.

#### Surface 4: `/bills` list + `/bills/[id]` detail

- `/bills` — paginated, filterable list (`congress`, `subject`, `sponsor`, `status`). Default: 119th Congress, all subjects.
- `/bills/[id]` — title, sponsor + cosponsors (linked to officials), subject tag list, latest action, full `RollCallTable.tsx` showing how every rep voted (filterable by chamber, party, state).

Mobile parity follows slice 2/3 pattern. Mobile-specific note: the `RollCallTable` and `ComparePane` are table-heavy; mobile uses stacked / swipeable layouts. **Possible slice 4.5 deferral candidate if mobile UI work balloons** — flag during plan.

### Drill-down transparency — first-class requirement

This is Decision #10 elevated to a design-wide principle. Concrete enforcement:

1. **Schema:** Every metric-bearing table has either an explicit `source_url` column (`bills.source_url`, `votes.source_url`, `scorecard_ratings.source_url`, `finance_summaries.source_url`, `district_offices.source_url`, `town_halls.source_url`, `stock_transactions.source_url`, `officials_leadership_history.source_url`) OR contributing-FK rows (`vote_positions`, `bill_sponsors`, `bill_subjects`, `finance_industry_top`, `finance_pac_contributions`). No metric is persisted without a traceable evidence trail.

2. **`official_metrics` is computed, not authoritative.** Every value is derivable from the source tables. UI never shows `official_metrics.X` without also linking to the source rows that produced X.

3. **Hooks:** Every metric hook either returns `sourceUrl` directly OR a paired evidence hook is available. The `MetricCardShell.tsx` component requires `onExpand` OR `externalSourceUrl` — TypeScript-enforced via the prop type.

4. **UI:** No metric value is rendered without a clickable affordance. Either it opens a drawer (with internal data) or it opens an external page (the canonical source). The "→" arrow next to a metric is non-negotiable.

5. **Audit step:** Verification plan includes a manual drill-down audit — every metric on the detail page clicked once to confirm provenance. Documented in a `slice-4-drill-down-audit.md` artifact.

## Visible outcome (definition of done)

A user who has completed slice 3 (calibrated + has officials data) sees, on both apps:

1. Home `OfficialsCard` shows each rep with a metric mini-strip (3 scorecards + top industry + attendance).
2. Tapping a rep → detail page with a 5-section Performance dashboard.
3. Every metric is clickable → drill-down drawer or external source. The drill-down audit confirms ~15 click-throughs all work.
4. `/officials/compare?a=X&b=Y` renders two officials side-by-side with the same dashboard.
5. `/bills` shows the current Congress's bills, filterable; `/bills/[id]` shows full bill detail + chamber roll-call table.
6. `pnpm seed:slice-4-full` runs all 7 ingest scripts + recompute-metrics cleanly. `official_metrics` populates with ~540 rows after the run.
7. RLS verified: anon → public-read on all new tables; anon mutation → blocked at the grant layer (42501); service-role → can write.
8. Drill-down transparency audit: manually clicked every metric on a sample official's detail page; documented findings in `docs/superpowers/slice-4-drill-down-audit.md`.

## Out of scope (explicit)

- **State + local officials** — slice 5.
- **In-district donor % at zip resolution** — slice 5 (free OpenSecrets tier exposes state-level only; full district resolution requires FEC bulk or paid tier).
- **Per-Congress historical scorecard / vote drilldown** — slice 6+. Slice 4 = current Congress + lifetime counters only.
- **Alignment scoring against user-stated positions** — slice 6.
- **Push notifications / vote alerts** — slice 6 (uses `push_tokens` table from slice 3).
- **Configurable home-card metric selection** — slice 6.
- **Legal/ethics event flags** — slice 7.
- **Civic-action affordances** (click-to-call, letter generator, town hall RSVP) — slice 8.
- **Promise tracking** — slice 9.
- **Cosponsor network analysis + multi-rep comparison** — slice 10.
- **Amendment + procedural vote tracking** — slice 11.
- **Cron-scheduled ingest** — slice 4.5 or 5 (slice 4 manual `pnpm seed:slice-4-full`).
- **Floor speeches, hearings, earmarks, federal contracts** — slice 12+.
- **Anonymous platform analytics** — slice 12+.
- **Mobile on-device DoD execution** — playbook at `docs/superpowers/mobile-dod-checklist.md`; externally gated per slice 3.5 deferral.

## Future slices roadmap

### Slice 5 — Data expansion + better residency

- State + local officials via OpenStates + Civic Info APIs (~7,400 state legislators + variable local)
- True in-district donor % via FEC bulk data ingest OR OpenSecrets paid tier
- Mobile parity in same slice or slice 5.5 mobile DoD
- Cron-scheduled ingest infrastructure (Supabase pg_cron extension or GitHub Actions scheduled workflow)

### Slice 6 — Personal alignment + alerts

- Alignment scoring: user states positions on N issues, compute alignment % vs rep's record on bills tagged those subjects
- Vote-alert push notifications (consumes `push_tokens` from slice 3)
- Configurable home-card metric selection
- "Recommended officials" surfaces: officials whose voting record best aligns with user's stated positions

### Slice 7 — Legal/ethics flag layer

- Curated dataset of ethics committee findings, indictments, settlements, FEC violations
- Surfaced as badges on official profile
- Drill-down to original filings
- Sources: OCE public reports, Senate Ethics, DOJ press releases, GAO investigations

### Slice 8 — Civic actions

- "Find officials anywhere" search (deferred from slice 3)
- Click-to-call / click-to-email via `legislators-district-offices.yaml` data
- Pre-filled letter generator scoped to specific vote / issue
- Town hall RSVP integration (slice-4 town_halls data + calendar export)

### Slice 9 — Promise tracking

- Campaign promise corpus (scrape campaign sites + debate transcripts, or partner with PolitiFact)
- Promise-to-action matching: classify each promise as kept / broken / no opportunity / unclear
- Per-official "promise tracker" with score + drill-down

### Slice 10 — Cross-rep analytics

- Cosponsor network analysis: graph of cross-aisle working relationships
- State delegation rollups: how an entire state's delegation votes as a bloc
- Primary challenger comparison (pull declared challengers from FEC filings)
- Multi-rep comparison view (N officials, not just 2)

### Slice 11 — Bills lifecycle depth

- Amendment tracking
- Procedural votes (motion to recommit, cloture, motion to table) — slice 4 ships final-passage only
- Bill genealogy (similar bills across Congresses)
- Killed-in-committee tracking

### Slice 12+ — Adjacent surfaces

- Floor speeches per official (Congress.gov `/v3/congressional-record/`)
- Hearing testimony + committee participation
- Earmark tracking (annual appropriations)
- Federal contract awards to district companies (USASpending.gov)
- Anonymous aggregate platform analytics
- Weekly email digest / newsletter
- District demographic context (Census)

## Open implementation questions

1. **STOCK Act source reliability.** Verify house-stock-watcher.com + senate-stock-watcher.com have current 119th data + stable APIs before committing. If unreliable, defer STOCK Act ingest to slice 4.5.
2. **Town Hall Project API coverage.** Verify event coverage extends through current Congress + API rate limits. If gaps, document and ship anyway.
3. **First-run Congress.gov ingest wall time.** ~5 hours for full first ingest at 5K req/hour. Acceptable for one-time seed; plan should specify the incremental query (`?fromDateTime`) for subsequent runs.
4. **OpenSecrets bioguide ↔ CID mapping completeness.** Verify the unitedstates-legislators YAML's `id.opensecrets` field is current for all 119th members. Manual fill for any gaps.
5. **Audit table generalization.** Slice 3's `officials_ingest_runs` was officials-specific. Slice 4 has 7 ingest pipelines. Generalize to `ingest_runs` with a `source` discriminator OR keep per-source tables. Plan decides.
6. **Slice cut-line.** If implementation plan exceeds ~40 tasks, consider splitting: slice 4 ships data layer + APIs + detail-page dashboard; slice 4.5 adds compare view + bills browse + mobile parity.

## Cross-cutting concerns

- **Observability:** every ingest run writes to `ingest_runs` audit table. UI surfaces "last refreshed" timestamps for each metric category. Failed ingests are non-fatal for the dashboard (last-known-good values stay; UI shows "stale data" badge if older than threshold).
- **Privacy:** residence lat/lng never persisted (computed in-memory during ingest). District-office addresses are already public via House Clerk records. Stock transactions are already public via STOCK Act filings. No new PII surfaces beyond what's already disclosed legally.
- **Drill-down transparency:** enforced by schema (source_url columns), hook contracts (MetricCardShell typing), and verification (manual audit). Every metric value clickable.
- **Accessibility:** metric cards include `aria-label` with the underlying numbers spoken out (e.g., `aria-label="League of Conservation Voters score 87 out of 100"`). Bar charts include data tables as alternative text.
- **Performance:** `official_metrics` is pre-computed → home + detail pages query a single indexed table for the dashboard's scalars. Evidence drill-downs are lazy. TanStack staleTime = 5 min for metric scalars; 30 min for evidence lists.
- **Feature flagging:** all new surfaces (`/officials/compare`, `/bills`, `/bills/[id]`) wrapped in a build-time `SLICE_4_ENABLED` flag for rollback. Toggled on at end of slice.

## Verification plan

- **pgTAP**: 10 new test files (one per migration pair) covering schema + RLS + service-role-can-insert. All green on a fresh `pnpm db:reset`.
- **Workspace typecheck**: 9 packages clean (`@chiaro/bills` is new; `@chiaro/officials`, `@chiaro/ui-tokens` are extended).
- **Vitest unit + integration**:
  - `@chiaro/bills` keys / queries / hooks
  - `@chiaro/officials` new metric / scorecard / finance / drill-down hooks
  - 7 seed scripts each ship adapter unit tests + at least one fixture-based scenario test
  - `recompute-metrics.ts` integration test against seeded fixtures
- **Web build**: Next 15 build succeeds. New routes: `/officials/compare`, `/bills`, `/bills/[id]`.
- **Mobile typecheck**: clean. (On-device DoD per slice 3.5 playbook.)
- **CI**: existing 4 jobs cover everything; no new jobs needed. The `seed:slice-4-full` aggregator runs in the `db` job after migrations so metrics populate in CI for visual smoke (fixture mode — no real external API calls in CI).
- **Drill-down transparency audit**: manual click-through of every metric on a sample official's detail page. Each clickable surface confirmed working. Documented in `docs/superpowers/slice-4-drill-down-audit.md`.

## Memory + spec-driven workflow

Spec lives at `docs/superpowers/specs/2026-05-15-slice-4-bills-votes-metrics-design.md`. Plan will live at `docs/superpowers/plans/2026-05-15-slice-4.md` after the writing-plans phase. Tasks execute via the per-task subagent + spec/quality review pattern from slice 3. The `pnpm test` (turbo with `^test`) command from slice 3.5 remains the canonical workspace test command; `pnpm -r test` continues to be racy on the shared DB and should not be used.
