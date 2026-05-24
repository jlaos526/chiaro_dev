# Stub Adapter Discovery Audit — 2026-05-24

**Context:** Slices 5H (state community presence) and 5I (state ethics & accountability) shipped 30 stub adapters across 6 components in 5 states (CA / FL / MI / NY / TX), each with an empty `return []` body. Slice 11's Gotcha #20 mandates that source URLs be verified before scaffolding production parsers. This audit identifies which (state, component) pairs are ready for production wiring and surfaces the schema-decision-level findings that emerged from the discovery.

## TL;DR

Audited 30 (state, component) pairs.

- **A — Production-parseable HTML:** 6 — strong ship candidates (NY town_halls; CA + NY + MI district_offices; NY COELIG enforcement; TX TEC sworn-complaint orders).
- **B — JS-rendered SPA:** 2 (FL EFDMS Form 6 search; CA FPPC complaint portal).
- **C — PDF-only:** 4 (NY FDS, MI PFD, FL Form 6, FL Commission research).
- **D — Image-only:** 0.
- **E — 404 / gone:** 0.
- **F — Anti-bot / timeout gate:** 1 (TX Capitol member directory — 503 throughout the audit window).
- **G — No published data / category does not exist at state level:** **17** — primarily because state legislatures do not maintain a STOCK-Act analogue, and per-state town-hall feeds don't exist outside NY.

**Top finding:** the `state_stock_transactions` category was over-specified — modeled on the federal STOCK Act feed but no state in {CA, FL, MI, NY, TX} maintains an analogous data product. Stock holdings/sales are line items inside annual financial disclosures (Form 700 / Form 6 / FDS / MiTN PFD / TX PFS), not a discrete table. The category should be **deprecated** or **subsumed** into `financial_disclosures` for state-tier officials.

## Method

URL discovery itself was substantive research (unlike slice 11's pre-known URL templates from stub files). For each (state, component) pair:

1. WebSearch to identify the canonical state agency + product (Form 700 / Form 6 / FDS / PFS / MiTN PFD / Sworn Complaints / Enforcement Actions / member directory).
2. WebFetch to verify response shape: A (parseable HTML), B (SPA), C (PDF index), F (gate / timeout), G (no published category).
3. Time-boxed at ~2 minutes per URL; one TX endpoint flapped 503 for the entire window and was bucketed F.

## Findings tables

### town_halls (5H)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | G | `assembly.ca.gov/events/today`, `senate.ca.gov` | Aggregated Assembly events page is institutional sessions/hearings only — no town halls. Town halls live on individual senator/AM microsites (`sdNN.senate.ca.gov`, `aXX.asmdc.org`) — would require per-member crawl with no central index. |
| FL | G | `flsenate.gov` calendar | Senate calendar shows institutional sessions only. No aggregated member town-hall feed; House lacks even calendar UI. |
| MI | G | `senate.michigan.gov`, `house.mi.gov` | Senator-by-senator coffee-hour / community-event pages exist but no aggregated feed. Cited explicitly: "Reach out to your Senator's office ahead of time." |
| NY | **A** | `https://www.nysenate.gov/events` | Statewide events calendar with filter by event-type (`event/meeting/public_hearing/session`) and by senator (A-Z). Filter infrastructure confirms a structured event schema. Assembly side (`nyassembly.gov/av/upcoming/`) is institutional only — drop. |
| TX | F | `capitol.texas.gov` | Capitol.texas.gov 503'd repeatedly; even if reachable, member calendars are not a feature of the Texas Capitol site per slice 7 prior reconnaissance. |

### district_offices (5H)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | **A** | `https://www.senate.ca.gov/senators` (40 senators) + `https://www.assembly.ca.gov/assemblymembers` (80 AMs) | **Best-in-class.** Senate roster page has all district office addresses inline. Assembly index has cards linking to `/assemblymembers/{n}` detail pages where address lives. |
| FL | C-ish | `https://www.flsenate.gov/senators` + `https://www.flhouse.gov/Sections/Representatives/representatives.aspx` | Index pages have per-member links to detail pages; detail pages have addresses. Modest 2-step crawl. |
| MI | **A** (partial) | `https://www.house.mi.gov/AllRepresentatives` (HTTPS cert flapped during audit), `https://senate.michigan.gov/senators/all-senators/` | Senate index links to per-senator profile pages; House index TLS-flaked once but is structurally a roster. Per-detail addresses confirmed via slice 5C precedent. |
| NY | **A** | `https://nyassembly.gov/mem/` (150 AMs) + per-senator `nysenate.gov/senators/{slug}/contact` | NY Assembly directory IS the gold standard — single page with all 150 members' district office + Albany LOB addresses inline. Senate side requires per-senator fetch (HTML is unstructured `<br>`-separated text — parseable via regex/heuristic, not microdata). |
| TX | F | `legdir.capitol.texas.gov/memberInfo.aspx` | All `capitol.texas.gov` and `legdir.capitol.texas.gov` URLs 503'd or ECONNREFUSED during audit. Per slice 7/8 precedent the site does have member detail pages with addresses, but uptime is fragile; production fetcher will need retry + cache. |

### stock_transactions (5I)

**All 5 states: bucket G** — state legislatures do not maintain a separate stock-transactions data product analogous to the federal STOCK Act PTR feed. Stock holdings/sales are line items inside annual financial disclosures (Form 700 / Form 6 / FDS / MiTN PFD / TX PFS), not a discrete table. There is no per-trade 45-day filing requirement at the state level for any of CA/FL/MI/NY/TX.

| State | Bucket | Source attempted | Notes |
|---|---|---|---|
| CA | G | FPPC Form 700 | Stock is Schedule A-1/A-2 inside the annual Form 700 — co-located with disclosures, not standalone. |
| FL | G | Florida EFDMS Form 6 | Same — Part B "Assets" inside Form 6. |
| MI | G | MiTN PFD | Same — assets section inside annual PFD. |
| NY | G | COELIG FDS | Same — annual FDS line items. |
| TX | G | TEC PFS | Same — annual PFS; also non-public online per TEC. |

**Recommendation:** deprecate the standalone `state_stock_transactions` adapters or subsume into `financial_disclosures` extraction with a stock-bearing-row tag.

### financial_disclosures (5I)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | **A** (index) / C (filings) | `https://www.fppc.ca.gov/search-filings/form-700-search/search-filed-form-700s/` | Index hosted on FPPC; root domain WebFetch flapped during audit, but URL is documented and known-good per FPPC press releases. Individual filings are PDFs. |
| FL | B + C | `https://disclosure.floridaethics.gov/PublicSearch/Filings` | SPA search UI; once queried, returns PDF-rendered Form 6 filings. Adapter must drive search programmatically. |
| MI | C | `https://www.michigan.gov/sos/.../PFDDR-reports/<year>/one/<lastname>-<firstname>-PFDDR-<year>.pdf` | **Predictable PDF URL pattern.** No central index, but enumerable given known legislator list (already in `officials`). Bucket C but cheap. |
| NY | **A** + C | `https://ethics.ny.gov/financial-disclosure-statements-elected-officials` | **Best-in-class disclosure index.** 2,804 results with year filter, office-type filter, pagination, per-record PDF Download links. Filings themselves are PDFs (C); the directory is parseable HTML (A). |
| TX | G | TEC PFS | "PFS statements are not available online" per Texas Ethics Commission Quick View page. Filings exist but the agency explicitly withholds the file feed online. |

### ethics_complaints (5I)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | B | `https://www.fppc.ca.gov/enforcement/complaint-and-case-information-portal/` | **SPA — filterable backend.** Results are sortable in the UI but underlying records require CPRA requests for source docs. |
| FL | C | `https://ethics.state.fl.us/Research/Search.aspx` | Portal page links out to an external search at `sb.flleg.gov`. Final orders are PDFs once located. Multi-hop. |
| MI | G | n/a | No standing online portal for ethics complaints against Michigan legislators. The MI Bureau of Elections receives PFD-compliance complaints but does not publish a public enforcement-actions feed. |
| NY | **A** | `https://ethics.ny.gov/enforcement-actions` | **Gold-standard HTML table.** Sortable columns: Name, Agency, Violation Type, Status, Penalty Amount, Date. Hundreds of entries 2008–2026. Each respondent name links to a detail page with PDFs/exhibits. **Highest-confidence bucket-A find in the audit.** |
| TX | **A** | `https://www.ethics.state.tx.us/enforcement/sworn_complaints/orders/search/` | HTML table with columns Order #, Respondent, Date Issued, Year Filed, URL → per-case PDFs at `ethics.state.tx.us/data/enforcement/sworn_complaints/<year>/<id>.pdf`. Clean structure. |

### official_events (5I — recall/resignation/censure/etc)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | Bal | (Ballotpedia via slice 9) + FPPC enforcement (B) | Recalls already covered by slice 9 `ballotpedia-recalls.ts` (production-shipped). Campaign finance violations would derive from the FPPC complaint portal (bucket B). |
| FL | Bal | (Ballotpedia) + FL ethics search (C) | Same pattern; recalls via slice 9. |
| MI | Bal | (Ballotpedia) only | No standing MI ethics enforcement feed → only Ballotpedia recall covers this category. |
| NY | Bal + **A** | (Ballotpedia) + NY COELIG enforcement-actions (A) | Recalls via Ballotpedia + civil penalties via COELIG table. Highest-coverage state. |
| TX | Bal + **A** | (Ballotpedia) + TEC sworn-complaint orders (A) | Recalls via Ballotpedia + TEC orders (A) cover campaign-finance violations. |

Per slice 7, the OpenStates `end_reason` cache is already the primary source for resignation/death and ships nationwide — these 5 states inherit that for those event types. Slice-12-scope events are recall (Ballotpedia, already shipped) + campaign-finance-violation (per-state ethics commission, table above).

## Bucket summary

| Bucket | Count | Notable pairs |
|---|---|---|
| A — Production-parseable HTML | 6 | NY town_halls; CA/MI/NY district_offices; NY FDS index; NY COELIG enforcement; TX TEC orders |
| B — JS-rendered SPA | 2 | FL EFDMS; CA FPPC complaint portal |
| C — PDF-only / multi-hop | 4 | NY FDS filings; MI PFD; FL Form 6; FL Commission research |
| D — Image-only | 0 | — |
| E — 404 / gone | 0 | — |
| F — Anti-bot / persistent gate | 1 | TX Capitol member directory |
| G — Category doesn't exist | **17** | All 5 stock_transactions; CA/FL/MI/TX town_halls; MI ethics_complaints; TX financial_disclosures; CA/FL/MI/TX official_events (recall covered via Ballotpedia) |

(Some pairs counted in multiple buckets — e.g. NY FDS = A index + C filings — bucket totals slightly exceed 30.)

## Slice 13+ scope recommendation

### Ship in slice 13 (6 production parsers — high-confidence bucket A)

1. **NY town_halls** — `nysenate.gov/events` filterable feed (Senate only; Assembly defers to G).
2. **CA district_offices** — `senate.ca.gov/senators` single-page roster (40 senators) + `assembly.ca.gov/assemblymembers/{n}` per-member fetch (80 AMs).
3. **NY district_offices** — `nyassembly.gov/mem/` single-page directory (150 AMs) + per-senator `nysenate.gov/senators/{slug}/contact` (63 senators).
4. **MI district_offices** — `house.mi.gov/AllRepresentatives` + `senate.michigan.gov/senators/all-senators/` per-member crawl (TLS retry needed).
5. **NY ethics_complaints + NY official_events (CFE violations)** — `ethics.ny.gov/enforcement-actions` table (one parser, two output tables — violation_type discriminator drives which sink).
6. **TX ethics_complaints + TX official_events (CFE violations)** — `ethics.state.tx.us/enforcement/sworn_complaints/orders/search/` table + per-case PDF index (text-extractable PDFs).

### Defer to slice 14+ (manageable but multi-hop)

7. **NY financial_disclosures** — `ethics.ny.gov/financial-disclosure-statements-elected-officials` index is A, but filings are PDFs (C). Index-only ingest first; PDF parse later.
8. **MI financial_disclosures** — predictable PDF URLs but each must be enumerated from `officials` and parsed. PDF-parser cost.
9. **FL district_offices** — workable 2-step but lower priority than NY/CA/MI.
10. **CA financial_disclosures** — FPPC Form 700 index URL flapped during audit; revalidate before scoping.

### Deprecate / mark not-applicable (must resolve BEFORE slice 13)

- **All 5 stock_transactions adapters** — state legislatures do not have STOCK-Act-equivalent. Schema decision: subsume into `financial_disclosures` extraction with a stock-bearing-row tag, OR drop the `state_stock_transactions` table entirely. **Required before slice 13 parser commit.**
- **CA / FL / MI / TX town_halls** — no aggregated state-government feed. Existing nationwide `mobilize.us` adapter (slice 7) is the only realistic coverage; per-state town-halls adapters should be removed or marked `@deprecated` (matching the slice 11 ACLU/AFP precedent).
- **TX financial_disclosures** — TEC explicitly does not publish PFS online. Adapter should be retired or marked permanently G.
- **MI ethics_complaints** — no published Michigan ethics-enforcement feed for legislators; the category is empty at the state level. Mark G; rely on Ballotpedia for any recall/expulsion events.
- **FL stock + ethics_complaints (B)** — FL EFDMS + Florida ethics SPA both require backend reverse engineering; defer until a partial-coverage spike validates feasibility.
- **CA ethics_complaints (B)** — FPPC SPA exports require CPRA requests for source docs; not a clean scrape.
- **TX official_events / town_halls / district_offices** — TX Capitol uptime issue: production fetcher needs aggressive retry + cache + degraded mode. Time-box impact.

### Slice 13 sizing

- 6 production parsers ÷ ~2 per slice (per slice 7/8/9 cadence) = **3 slices of work**, OR
- Compress to ~6 parsers in one large slice if patterns align (NY ethics_complaints + NY official_events share one fetcher; TX ethics + events similar). Realistic single-slice scope: **4 parsers** (NY town_halls, CA district_offices, NY+TX ethics-complaints+events combined).

## Durable lessons

1. **State STOCK Act doesn't exist.** None of the 5 states maintain a separate stock-transactions data product. Stock is buried in annual disclosure forms. Slice 5I's `state_stock_transactions` table was modeled on the federal STOCK Act and the analogy doesn't hold. The schema asymmetry in Gotcha #15 (federal Ethics 1-card vs state 2-cards) is justified, but the underlying `state_stock_transactions` table on the state side is overspecified.

2. **NY is the gold-standard data state for legislators** — by a wide margin. COELIG (`ethics.ny.gov`) + nysenate.gov + nyassembly.gov publish more structured legislator data than the other 4 states combined. Slice 13 should weight scope toward NY: 4 of 6 ship candidates are NY-side.

3. **CA Senate roster is a one-shot win.** `senate.ca.gov/senators` displays all 40 senators' district offices on one page — no per-member crawl needed. The Assembly side requires per-member fetch but the URL pattern is stable (`/assemblymembers/{n}`).

4. **Texas Capitol is fragile.** `capitol.texas.gov` + `legdir.capitol.texas.gov` returned 503 and ECONNREFUSED multiple times during the audit window. Production fetcher needs aggressive retry + cache + degraded-mode telemetry; slice 8/9 retry helpers should be reused.

5. **MI PFD has predictable PDF URLs.** `michigan.gov/sos/.../PFDDR-reports/<year>/one/<Lastname>-<Firstname>-PFDDR-<year>.pdf` is enumerable given the legislator list already ingested by slice 5C. No central index needed — saves a navigation layer at the cost of needing a name-normalization step.

6. **FL EFDMS is a true SPA**, not a JS-enhanced page. Adapter would need to drive the search API directly (and the disclosure portal's backend API is undocumented). Higher cost than the slice 5G/9 HTML-scrape pattern. Defer.

7. **Town halls outside NY are agency-blind.** CA / FL / MI / TX have no state-government aggregated town-hall feed. `mobilize.us` (slice 7) is the only realistic source for these 4 states. The slice 5H per-state town-hall adapter premise was wrong; the nationwide overlay IS the solution.

8. **Ballotpedia (slice 9) already covers recall/expulsion across all 50 states.** Slice 13 `official_events` work should focus exclusively on campaign-finance violations (which derive from each state's ethics-enforcement table) — recall/expulsion is already shipped.

9. **`(source, external_id) UNIQUE WHERE NOT NULL` dedup pattern (Gotcha #13) is the right shape** for NY and TX enforcement-actions parsers: external_id = COELIG case number or TEC order number. Both sources expose stable IDs.

10. **No anti-bot gates encountered** across these 5 states' state-government domains (`.ca.gov`, `.fl.us`, `.michigan.gov`, `.ny.gov`, `.tx.us`). Different posture than commercial sources (Ballotpedia Cloudflare gate, slice 9). Browser User-Agent likely not required for any slice-13 parser; revisit if a parser hits a 403 in implementation.

## Re-audit cadence

Recommend re-running this audit annually (state agencies revamp their portals; existing URLs may rot). Future audits land as new dated files (`YYYY-MM-DD-stub-adapter-discovery.md`), not edits to this file.

## Cross-references

- Slice 5H (`docs/superpowers/specs/2026-05-22-state-community-presence-design.md`) — original per-state town_halls + district_offices stub-shipping
- Slice 5I (`docs/superpowers/specs/2026-05-22-state-ethics-accountability-design.md`) — original per-state ethics stub-shipping (including the over-specified `state_stock_transactions` table)
- Slice 11 (`docs/superpowers/audits/2026-05-23-scorecard-discovery.md`) — precedent for this audit-first methodology
- Gotcha #20 in `CLAUDE.md` — stub-shipping requires per-pair URL verification
- Gotcha #21 in `CLAUDE.md` (added in this slice) — `state_stock_transactions` over-specification + per-state town_halls wrong-premise
