# State Scorecards Coverage Matrix (slice 5G Task 4)

Research output for sub-slice 5G adapter `covered_states[]` arrays. v1 scaffolding lists the states most likely to have a published state-legislator scorecard for each org; production parsers are operator follow-up per (org, state) tuple.

## Per-org coverage matrix

| Org | Slug | Known coverage states (v1) | Format | Notes |
|---|---|---|---|---|
| ACLU state chapters | `aclu` | CA, NY, TX, MI, IL, MA, PA, ID | HTML page + PDF per chapter | Per-chapter independent publication. Each chapter chooses its own bill set, scoring window (typically biennial sessions), and presentation format. PA + CA + ID confirmed via direct page hits; TX/MI/IL/MA/NY assumed via the 50-state-blueprint chapter network — operator should verify per-chapter URLs when wiring parsers. No central index. |
| LCV state affiliates | `lcv` | CA, NY, MI, CO, OR, WA, NJ, MD, VA | PDF + HTML | ~30+ state affiliates in the Conservation Voters Movement. Annual scorecards align with state legislative sessions. Confirmed 2024 publications for NY (NYLCV), VA (VALCV), MD (MDLCV), NJ (NJLCV), MI (Michigan LCV), CA (CA Environmental Voters), OR (OLCV). State affiliates publish independently — no unified API. |
| NRA state grades | `nra` | All 50 (centralized) | Letter grades A-F (HTML per-state) | NRA-PVF maintains `nrapvf.org/grades/{state}/` pages covering all 50 states for both federal and state-legislator candidates. Centralized publication is the most parser-friendly of the 5 orgs. v1 scaffolding focuses on the high-population set CA, NY, FL, TX, MI, WI to match the 5D/5E state coverage footprint; remaining 44 states are operator follow-up (parser is identical, only the URL slug changes). |
| Planned Parenthood Action | `planned-parenthood` | ME, NH, NJ, MA, NY | HTML + PDF (per state action fund) | Per-state Action Fund affiliates publish independently. Confirmed via direct page hits: Maine (PPMAF), New Hampshire (PPNHAF — 2024 House + Senate), NJ (PPActionNJ), MA (PP Advocacy Fund MA). CA/TX/MI/FL coverage NOT confirmed in 5G scaffolding scan — those PP affiliates may publish scorecards but they weren't surfaced in 2-3 fetches. Operator follow-up to confirm before parser wiring. |
| Americans for Prosperity | `afp` | FL, SC, MS, PA, IN | HTML + PDF (per state chapter) | AFP has 30+ state chapters but state-leg-scorecard publication is uneven. Confirmed publishers: FL (`floridascorecard.com` — dedicated subdomain), SC (2024 release), MS (2024 release), PA (`pataxpayerscorecard.com`), IN (PDF archive). National scorecard (`AFP National Scorecard`) tracks federal Congress, NOT state legs. CA / NY / MI / WI / TX appear to NOT have dedicated AFP state-leg scorecards published despite chapters existing — chapters in those states focus on issue advocacy rather than rated voting records. **This is the org with the largest gap between "has a chapter" and "publishes a state-leg scorecard."** |

## Per-adapter `covered_states[]` values (load-bearing — drives Tasks 9-13)

These arrays go in each adapter's exported `StateScorecardAdapter` object. v1 ships stubs returning `[]` from `fetchRatings()`; production parsers per (org, state) tuple are operator follow-up.

- ACLU: `['CA', 'NY', 'TX', 'MI', 'IL', 'MA']`
- LCV: `['CA', 'NY', 'MI', 'CO', 'OR']`
- NRA: `['CA', 'NY', 'FL', 'TX', 'MI', 'WI']`
- Planned Parenthood: `['ME', 'NH', 'NJ', 'MA', 'NY']`
- AFP: `['FL', 'SC', 'MS', 'PA', 'IN']`

## Format

Each (org, state) combo will need its own parser in the production fetcher. v1 stubs return `[]`. Operator wires parsers per-tuple as scrapers/CSV/PDF ingest is built. Adapter pattern in `packages/db/supabase/seed/state-scorecards/` mirrors slice 5D enrich-* and 5E state-finance/ patterns: per-adapter file, default fetcher returning `[]`, tests inject normalized fixtures.

## States covered by ≥1 org (v1 union)

CA, NY, FL, TX, MI, IL, MA, WI, CO, OR, ME, NH, NJ, SC, MS, PA, IN — **17 states** in v1 scaffolding (broader than the original ~10 estimate because Planned Parenthood and AFP coverage skews toward different states than the 5D/5E footprint).

The 5D/5E "core 5" footprint (CA, NY, FL, TX, MI) gets 1-3 orgs each:
- **CA**: ACLU, LCV, NRA (3)
- **NY**: ACLU, LCV, NRA, PP (4)
- **FL**: NRA, AFP (2)
- **TX**: ACLU, NRA (2)
- **MI**: ACLU, LCV, NRA (3)

Other 33 states are out of v1 scope. Adding them = additional `covered_states[]` entries + per-tuple parsers; no schema or orchestrator changes required.

## Surprises / operator notes

1. **AFP has a "chapter exists vs scorecard published" gap.** AFP-CA, AFP-NY, AFP-MI all exist but none publish a state-legislator scorecard with rated voting records. Their state-chapter output is mostly press releases + issue advocacy. The orgs that DO publish (FL, SC, MS, PA, IN) skew Southern/Midwestern. AFP's `covered_states[]` skews red-state by design.

2. **Planned Parenthood coverage skews Northeast.** ME / NH / NJ / MA are confirmed publishers; the big purple/red states (TX, FL, MI) where PP advocacy is highest-stakes don't surface dedicated state-leg scorecards in the 2-3 fetch budget. May be a discoverability issue (PP affiliates sometimes bury scorecards inside the national Planned Parenthood Action Fund site rather than dedicated subdomains) — worth a deeper operator scan during parser wiring.

3. **NRA is the only "centralized" org.** All 50 states under `nrapvf.org/grades/{state}/`. Parser for NRA can probably be written once and parameterized by state slug. The other 4 orgs require per-(org, state) parsers because each chapter chooses its own page structure.

4. **LCV state affiliates rebrand inconsistently.** "Environmental Voters" (CA), "Conservation Colorado" (CO), "Conservation Voters" (some) — the LCV name isn't uniformly on the affiliate's masthead. URL discovery for parser wiring needs the operator to consult LCV's affiliate directory at lcv.org, NOT a uniform `{state}lcv.org` pattern.

5. **PDF-only scorecards are common** (ACLU-PA, ACLU-ID, several LCV affiliates). PDF parsing will be required for some (org, state) tuples — not just HTML scraping. Consider deferring PDF-only tuples to a later operator pass after HTML tuples are stable.

## Sources surveyed

- ACLU: `aclu.org/scorecard`, `aclupa.org`, `aclucalaction.org`, `acluidaho.org`
- LCV: `lcv.org`, `nylcv.org`, `valcv.org`, `mdlcv.org`, `njlcv.org`, `michiganlcv.org`, `olcvscorecard.org`
- NRA: `nrapvf.org/grades/`
- Planned Parenthood: `plannedparenthoodaction.org` (NH, ME, NJ, MA action-fund subpaths)
- AFP: `americansforprosperity.org`, `floridascorecard.com`, `pataxpayerscorecard.com`
