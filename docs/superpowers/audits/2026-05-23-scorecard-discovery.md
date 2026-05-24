# Scorecard URL Discovery Audit — 2026-05-23

**Context:** Slice 5G shipped 5 state-scorecard org adapters (ACLU, LCV, NRA, Planned Parenthood, AFP) as stubs assuming each had per-state-affiliate URLs with parseable HTML rosters. Slice 9 shipped NRA-PVF as the first production parser. Before slice 11 committed to wiring the remaining 4 orgs, a discovery pass audited all 21 (org, state) URL pairs to verify the adapter premise.

## TL;DR

Audited 21 (org, state) URLs. Only 2 are production-parseable HTML rosters (LCV-MI, LCV-CO). 1 is JS-rendered partial (LCV-CA caucus profiles). 1 is PDF-only (LCV-NY). 6 are anti-bot gated (LCV-OR + 5 PP states). 11 have NO published scorecard at all (all 6 ACLU + all 5 AFP — the adapter premise was wrong: ACLU chapters publish bill-position trackers, AFP only publishes a federal scorecard).

## Method

For each (org, state) pair, fetched the URL via `WebFetch` and classified into one of these buckets:

- **A** — Production-parseable HTML: 200 OK, contains table/list with legislator names + grades
- **B** — JS-rendered SPA: 200 OK, but content rendered client-side
- **C** — PDF-only: HTML page links to PDF scorecard
- **D** — Image/scanned: scorecard is an image
- **E** — 404 gone
- **F** — Anti-bot gate (403)
- **G** — No published scorecard for org/state pair

For bucket A entries, noted HTML structure (table shape, key selectors). No scraping — classification only.

## Findings table

### ACLU (6 states)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | G | `https://www.aclusocal.org/en/legislation` | Bill tracker only, no legislator grades. Primary `acluca.org` 404. ACLU NorCal also lacks scorecard. |
| NY | G | n/a | `nyclu.org/legislative-scorecard` 404; site lacks any scorecard. |
| TX | G | n/a | `aclutx.org/legislative-scorecard` 404; site lacks scorecard. |
| MI | G | n/a | `aclumich.org/legislation` is bill-tracking only. |
| IL | G | n/a | `aclu-il.org/legislation-page` is bill-tracking only. |
| MA | G | n/a | `aclum.org/en/legislation` is bill-tracking only. |

**ACLU verdict:** ACLU state chapters universally publish bill-position trackers, not legislator scorecards. Adapter premise wrong.

### LCV (5 states)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| CA | B (partial) | `https://envirovoters.org/scorecard` | CLCV via `ecovote.org` redirect. Has caucus profiles (Climate Action vs Polluter), NOT a full sortable table. Lawmaker pages parseable but require enumeration. |
| NY | C | `https://nylcv.org/` press releases | Data lives in PDFs (e.g. "2019 State Environmental Scorecard"). HTML is publication summaries only. |
| MI | A | `https://www.michiganlcv.org/lawmakers/` | Server-rendered table cols: Name (link), Party, Lifetime Score, Chamber, District, Corp Utility Donations, 2025-2026 Score. ~110 rows. **Cleanest scrape target in audit.** |
| CO | A | `https://conservationco.org/scorecards/2025-scorecard/2025-house/` + `/2025-senate/` | Two server-rendered tables. House cols: Rep (link), Party-District, 2025 Score %, Lifetime Score %. ~80 reps + ~40 senators. |
| OR | F | n/a | All `olcv.org` paths return 403 — anti-bot gate. Would need browser UA. |

### Planned Parenthood (5 states)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| ME | F | (403) | Cloudflare gate on every PP path attempted. |
| NH | F | (403) | Same. |
| NJ | F | (403) | Same. |
| MA | F | (403) | Same. |
| NY | F | (403) | Same. |

**PP verdict:** All 5 PP state pages gated. UA-probe spike needed to confirm whether gated pages have HTML data vs PDFs.

### AFP (5 states)

| State | Bucket | Working URL | Notes |
|---|---|---|---|
| FL | G | `https://americansforprosperity.org/florida` (homepage only) | State chapter pages exist but contain no per-state scorecard. Only AFP-wide `national-scorecard` link surfaces. |
| SC | G | n/a | Same. |
| MS | G | n/a | Same. |
| PA | G | n/a | Same. |
| IN | G | n/a | Same. |

**AFP verdict:** AFP publishes only one consolidated `national-scorecard` (federal scope). State-chapter scorecards do not exist.

## Bucket summary

| Bucket | Count | (org, state) pairs |
|---|---|---|
| A — Production-parseable HTML | 2 | LCV-MI, LCV-CO |
| B — JS-rendered SPA / partial-data | 1 | LCV-CA |
| C — PDF-only | 1 | LCV-NY |
| D — Image-only | 0 | — |
| E — 404 gone | 0 | — |
| F — Anti-bot gate | 6 | LCV-OR + PP×5 |
| G — No published scorecard | 11 | ACLU×6 + AFP×5 |

Total: 21 (LCV-CO counted as 1 across House + Senate subpages).

## Slice 11 scope decisions

| (org, state) | Bucket | Slice 11 decision |
|---|---|---|
| LCV-MI | A | **Ship** — `michiganlcv.org/lawmakers/` server-rendered table parser |
| LCV-CO | A | **Ship** — `conservationco.org/scorecards/<year>-scorecard/{house,senate}/` two-table parser |
| LCV-CA | B | Defer — caucus profiles need schema decision (caucus_label vs score) |
| LCV-NY | C | Defer — PDF tar pit |
| LCV-OR | F | Defer — UA-probe spike (future slice) |
| PP × 5 | F | Defer — UA-probe spike (future slice) |
| ACLU × 6 | G | **Deprecate** — wrong premise; @deprecated stubs with `covered_states: []` |
| AFP × 5 | G | **Deprecate** — wrong premise; @deprecated stubs with `covered_states: []` |

## Durable lessons

1. **Stub-shipping pattern requires per-pair URL verification before adapter scaffolding.** Slice 5G shipped 5 org adapters assuming all 21 URLs had parseable HTML. Audit found ~50% have no published scorecard at all. The gap is taxonomy (wrong data shape assumption), not parser difficulty.

2. **ACLU and AFP publish different artifact types than slice 5G modeled.** ACLU publishes per-bill positions; AFP publishes only federal-tier scorecards. Both require adapter premise changes, not just production parser wiring.

3. **HTML-scrape adapters have a long tail of failure modes.** Beyond simple 404 / parseable / unparseable, anti-bot gates (Cloudflare 403), JS-rendered SPAs, PDF-only delivery, and image-scanned scorecards each require different handling.

4. **Per-org-affiliate URLs vary unpredictably.** ACLU NY is `nyclu.org`; LCV NY is `nylcv.org`; PP NY is `ppempireaction.org`. The `<org-slug><state-code>.org/legislative-scorecard` template assumed by slice 5G holds for none of the 4 orgs.

## Re-audit cadence

Recommend re-running this audit annually (orgs may publish new scorecards; existing URLs may rot). Future audits land as new dated files (`YYYY-MM-DD-scorecard-discovery.md`), not edits to this file.

## Cross-references

- Slice 5G (`docs/superpowers/specs/2026-05-21-state-issue-positions-design.md`) — original stub-shipping pattern
- Slice 9 (`docs/superpowers/specs/2026-05-22-nra-ballotpedia-parsers-design.md`) — NRA-PVF production parser template
- Slice 11 (`docs/superpowers/specs/2026-05-23-lcv-scorecards-design.md`) — this slice's spec
- Gotcha #20 in `CLAUDE.md` (to be added in this slice)
