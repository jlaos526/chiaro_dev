# CA FPPC Form 700 Re-Audit (slice 21 pre-audit)

**Date:** 2026-05-25
**Trigger:** Slice 12 audit (2026-05-24) recommendation #10 flagged "CA financial_disclosures — FPPC Form 700 index URL flapped during audit; revalidate before scoping." Slice 21 spec opens with this re-audit task.
**Outcome:** Bucket B (Granicus DisclosureDocs SPA). Deprecate adapter; no parser to build.

## Method

Probed primary + alternate URLs via WebFetch. Inspected initial HTML markup for filing table, JSON-LD, hidden inputs, or any server-rendered list data. Looked for `<script>` src + footer copyright to identify the underlying framework/vendor.

## URLs probed + responses

| URL | Status | Shape |
|---|---|---|
| `https://www.fppc.ca.gov/search-filings/form-700-search/search-filed-form-700s/` | 200 | Sitecore/Optimizely CMS landing page with "Search Filed Form 700s" button → redirects to `form700search.fppc.ca.gov` |
| `https://www.fppc.ca.gov/transparency/statements-of-economic-interests-form-700.html` | 404 | Page reorganized since slice 12 audit |
| `https://www.fppc.ca.gov/learn/public-officials-and-employees-rules-/economic-interest-disclosure.html` | 404 | Same — reorganized |
| `https://www.fppc.ca.gov/transparency/form-700-filed-by-public-officials.html` | 404 | Same |
| `https://www.fppc.ca.gov/` (root) | 200 | Server-rendered HTML; links Form 700 search at `/search-filings/form-700-search/` (CMS landing page, no data) |
| `https://www.fppc.ca.gov/search-filings/form-700-search/` | 200 | CMS landing page; redirects searchers to `form700search.fppc.ca.gov` |
| `https://form700search.fppc.ca.gov/` | 200 | **SPA shell** (Granicus DisclosureDocs eRetrieval™ Version 3.26.0309, Granicus Inc. 2025-2026 copyright). No filings table, no `<form action>`, no inline JSON. All results client-rendered after JS bundle hydrates. |
| `https://form700search.fppc.ca.gov/Search/PublicSearch` | 200 | Same SPA shell. No JSON/HTML data leaked into initial markup. |

## Bucket classification

**Bucket B (JS-rendered SPA — Granicus DisclosureDocs eRetrieval).** Confirmed by:
- Footer copyright string identifies Granicus Inc.
- Version banner "DisclosureDocs eRetrieval™ Version 3.26.0309"
- Initial HTML markup contains no filings, no JSON-LD, no hidden form data
- The search interface URL pattern matches Granicus's standard SaaS deployment for ethics disclosures

## Why bucket-B disqualifies a slice 21 parser

Per slice 9 + 11 production-parser convention, Chiaro builds **cheerio HTML scrapers** for stable HTML sources, NOT Playwright/Puppeteer headless-browser pipelines for SPAs. Granicus DisclosureDocs:
- Renders all content client-side after JS execution
- Exposes no documented public REST/JSON API
- Backend XHR endpoints would need browser DevTools network capture to discover, are undocumented, and likely change without notice
- Is closed-source SaaS — vendor ToS may restrict automated scraping

A Playwright-based pivot would violate the no-headless-browser convention + introduce a new heavy dependency tree (~200MB Chromium) + ongoing maintenance cost for a single state's disclosures.

## Recommendation

**Deprecate `state-ethics/disclosures/ca-fppc.ts` adapter.** Add `@deprecated` JSDoc following slice 11 ACLU/AFP pattern. Adapter stays in `state_ethics_orgs` registry returning `[]` for back-compat (slice 5I row continuity). Document the Granicus DisclosureDocs migration pattern as **Gotcha #24** so future operators identify similar SaaS migrations immediately + skip re-audit cost.

## Future revisit triggers

- FPPC publishes a stable REST/JSON API for Form 700 search → revisit adapter.
- A different CA source surfaces (e.g. per-legislator self-disclosure PDFs on .ca.gov personal pages) → separate slice scope.
- Granicus DisclosureDocs vendor publishes a public API → revisit pattern across states.

## Audit cadence note

Per slice 12 audit's "Re-audit cadence" recommendation, sources should be re-validated annually. The 2026-05-24 → 2026-05-25 re-audit cycle here was triggered by slice 12's explicit flagging, not the annual cadence — annual cadence next due 2027-05-24.

## Cross-references

- Slice 11 LCV audit (`docs/superpowers/audits/2026-05-23-scorecard-discovery.md`) — origin of Gotcha #20 stub-shipping URL verification pattern
- Slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) — original bucket taxonomy + recommendation #10 (CA FPPC URL flapping)
- Gotcha #20 (CLAUDE.md) — stub-shipping requires per-pair URL verification
- Gotcha #24 (CLAUDE.md, added in slice 21) — Granicus DisclosureDocs SPA migration pattern
