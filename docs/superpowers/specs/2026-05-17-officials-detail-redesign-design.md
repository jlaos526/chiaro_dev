# Officials Detail Page Redesign — Design Spec

**Date:** 2026-05-17
**Status:** Design — pending plan
**Scope:** `apps/web/app/officials/[id]/page.tsx` (detail page) + `apps/web/components/OfficialsCard.tsx` (home mini-strip)
**Predecessor:** Slice 4 (`docs/superpowers/specs/2026-05-15-slice-4-bills-votes-metrics-design.md`)

---

## Goal

Reorganize the `/officials/[id]` page so a voter can scan a representative's record in three layers: top-line summary (always visible), drill-down per metric category (expand on click), and source-cited evidence (modal drawer). Add OpenSecrets-style structure to the Finance category. Standardize the bio header across all reps. Reframe the home page "Your officials" mini-strip around issue alignment, not raw scorecard numbers.

The current slice-4 page works but renders as a wall of 5 stacked sections — voter gets no scanning hierarchy and the cards feel undifferentiated. This redesign introduces an information hierarchy: category bar → sub-cascade → metric card → evidence drawer.

---

## Out of scope

- New data ingest pipelines (any "data coming slice 5+" entries are documented placeholders, not built here)
- Comparison view (`/officials/compare`) — slice 4.5
- Bills list view (`/bills`) — slice 4.5
- Mobile app (`apps/mobile`) — separate slice
- District-centroid map data for the mini-strip — option D not chosen
- User-preference-driven scorecard weighting — slice 5+

---

## High-level structure

`/officials/[id]` renders three regions top-to-bottom:

1. **Bio header** — standardized photo + name + identity chips + service-role card + contact links (replaces today's free-form `OfficialDetail`)
2. **Performance section** — six categories, all collapsed by default with preview chips on each
3. **Existing slice-4 cards** — superseded; the Performance section replaces `OfficialPerformance` entirely

---

## Visual language — locked decisions

This section captures every styling decision from the 2026-05-17 brainstorm. Implementation must match these values exactly so the design feels coherent end-to-end.

### Category bar (used by all 6 categories)

```
┌──────────────────────────────────────────────────────────┐
│ [ ▸ ] Service Record                                     │
│       Speaker · since 2007                               │
└──────────────────────────────────────────────────────────┘
 ↑ 2px left-edge accent (per-category color, palette A)
```

- **Layout**: pill chevron on the left + stacked name/teaser on its right; nothing on the right side of the bar (no inline preview chip)
- **Pill chevron**: 20×20px circle, `background: #f0eee5`, `color: #1a1714`, font-size 0.72rem; glyph `▸` when collapsed, `▾` when expanded
- **Category name**: `font-weight: 700`, `font-size: 0.95rem`, `color: #1a1714`
- **Teaser line** (the "hint of more"): short narrative + key fact, `font-size: 0.75rem`, `color: #5a5751`, line-height 1.4. See per-category teaser table below.
- **Outer bar**: `padding: 11px 14px`, `border: 1px solid #d8d4c9`, `border-left: 2px solid <CATEGORY_ACCENT[id]>`, `border-radius: 6px`, white background, `margin-bottom: 6px`
- **Open state**: border-bottom removed, border-radius collapses to `6px 6px 0 0`; body container below shares the same left accent and continues the visual frame

#### Category accent palette (palette A — semantic earthen)

| Category               | Accent hex | Token name                              |
| ---------------------- | ---------- | --------------------------------------- |
| Service Record         | `#c89a4e`  | `CATEGORY_ACCENT['service-record']`      |
| Issue Positions        | `#3b6ed1`  | `CATEGORY_ACCENT['issue-positions']`     |
| Community Presence     | `#1f9b88`  | `CATEGORY_ACCENT['community-presence']`  |
| Finance                | `#3da75b`  | `CATEGORY_ACCENT['finance']`             |
| Ethics & Accountability | `#d68a1f` | `CATEGORY_ACCENT['ethics-accountability']` |
| Voting & Bills         | `#7d57c1`  | `CATEGORY_ACCENT['voting-bills']`        |

#### Per-category teaser line content (hybrid: short narrative + key fact)

| Category               | Teaser line                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| Service Record         | `<role> · since <first-elected-year>`                             |
| Issue Positions        | `Strongly aligned on <top-aligned-issue>, differs on <top-differs-issue>` (omit phrase if only aligned data exists) |
| Community Presence     | `Lives in district · <N> office<s>, <M> recent town hall<s>`      |
| Finance                | `$<total-raised> raised · top industry: <top-industry-name>`      |
| Ethics & Accountability | `<N> stock trade<s> late · majority of donors <in/out>-of-state` |
| Voting & Bills         | `<Attendance label> · <N> bill<s> introduced this Congress`       |

Teaser is computed in the queries/derivation layer, not in the component. Falls back gracefully when data is missing (omit clauses with no data; show "no data yet" if the entire line would be empty).

### Sub-cascade bar (Issue Positions / Finance / Voting & Bills only)

```
   ┌──────────────────────────────────────────────────┐
   │ ▸  Environment                                    │
   │    LCV Strongly Aligned · Sierra Club ...         │
   └──────────────────────────────────────────────────┘
    ↑ 1px left accent in a lighter shade of parent category color
```

- **Layout**: same stacked-text pattern as category bar, smaller scale
- **Chevron**: plain `▸` / `▾` character (no pill), `font-size: 0.7rem`, `color: #1a1714`
- **Name**: `font-weight: 600`, `font-size: 0.82rem`, `color: #1a1714`
- **Teaser**: `font-size: 0.7rem`, `color: #5a5751`, line-height 1.4
- **Outer**: `padding: 8px 12px`, `border: 1px solid #e5e1d4`, `border-left: 1px solid <sub-accent-color>`, `border-radius: 5px`, white background, `margin-bottom: 4px`
- **Sub-accent color**: lighter shade of parent category accent (e.g., parent `#3b6ed1` → sub `#87aae0`)
- **Expanded body**: when sub-cascade opens, content stacks **vertically** below — one metric card per row, full-width. No 2-column grids. Padding `0 12px 12px`, gap `8px`.

### MetricCardShell (used everywhere a metric renders)

```
┌──────────────────────────────────────┐
│ $223,500                              │  ← value (1.25–1.4rem, 700)
│ ● Base Salary                         │  ← category dot + label
│ Speaker                               │  ← caption (muted)
│                                       │
│ view source →                         │  ← drill-down link
└──────────────────────────────────────┘
```

- **Container**: `padding: 12px`, `border: 1px solid #d8d4c9`, `border-radius: 6px`, **subtle vertical gradient** background (tinted toward white from the parent category's accent — e.g., Finance: `linear-gradient(180deg, #f4faf6 0%, #fff 100%)`)
- **Value (top)**: `font-size: 1.25–1.4rem`, `font-weight: 700`, `color: #1a1714`, `line-height: 1.1`. Phrases (e.g., "Strongly Aligned") render at the lower end of the size range; numbers render at the higher end.
- **Label row**: `font-size: 0.82rem`, `color: #1a1714`, `margin-top: 8px`, flex-row with a 6×6px **category-color dot** (`CATEGORY_ACCENT[parentCategoryId]`) before the label text
- **Caption** (optional secondary line): `font-size: 0.7rem`, `color: #807a72`, `line-height: 1.4`, `margin-top: 2px`
- **CTA link**: `margin-top: 10px`, `font-size: 0.72rem`, `color: #3b6ed1`, underlined; text is `view evidence →` (internal drill) or `view source →` (external link). Discriminated union from slice 4 still enforces at compile time.

### Grayed/placeholder MetricCardShell (data coming slice 5+)

- Background: `#f6f4ed` (solid, no gradient)
- Border: `#e5e1d4` (same as default)
- Value: `font-style: italic`, `color: #807a72`, content is `—`
- Label: `color: #5a5751`
- Caption: `color: #807a72`, `font-style: italic`, content is `data coming slice 5+`
- **No opacity reduction** (text stays fully readable)
- `cursor: default`, no hover effect, not clickable

### Pill chevron (reused everywhere a toggle is needed)

- 20×20px circle (or 18×18px on sub-cascade rows for visual subordination)
- `background: #f0eee5`
- `color: #1a1714`
- `font-size: 0.72rem` (or 0.7rem in 18×18 variant)
- `flex-shrink: 0`
- Glyph `▸` collapsed, `▾` expanded
- Inside a full-width toggle button: same chevron + label text + counter (e.g., "Show 5 more industries · 5 of 10 shown")

### Drill-down stack (4 levels)

1. **Category bar** — preview teaser visible (always-shown short narrative)
2. **Sub-cascade bar** (only inside Issue Positions / Finance / Voting & Bills) — preview chip visible
3. **MetricCardShell** — full value + label + caption + "view evidence →" link
4. **Inline expand within card** (replaces slice-4's modal drawer) — see *Evidence drawer* below

---

## Bio header

### Layout

Centered vertical stack with chips arranged in two horizontal rows. Variant C from brainstorming: service row wrapped in a soft tinted card.

```
                  ┌────────────┐
                  │  portrait  │
                  └────────────┘

                Nancy Pelosi

         [D]  [House]  [CA-11]            ← Row 1: identity chips

      ┌──────────────────────────────┐
      │ CURRENT ROLE  [Speaker] · Since 2007 │  ← Row 2: service card
      └──────────────────────────────┘

      pelosi.house.gov · @SpeakerPelosi   ← Contact links
```

### Field mapping

| Element              | Source                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| Portrait             | `officials.portrait_url`, fallback to initials avatar (existing slice 3 component) |
| Name                 | `officials.full_name`                                                   |
| Party chip (Row 1)   | `officials.party` → `PARTY_COLOR` / `PARTY_LABEL` tokens                |
| Chamber chip (Row 1) | `officials.chamber` → "House" or "Senate"                               |
| District chip (Row 1) | House: `${state}-${district_number}` zero-padded, or `${state}-AL` for at-large. Senate: full state name (e.g., "California"). |
| Current role         | Most-recent `officials_leadership_history` entry where `end_date is null`. Falls back to "Representative" or "Senator" if none. |
| Tenure ("Since YYYY")| Min `start_date` from `officials_leadership_history`, year only         |
| Official URL link    | `officials.official_url`, hidden if null                                |
| Twitter link         | `officials.twitter_handle`, prefixed `@`, links to `https://twitter.com/<handle>`, hidden if null |

### Visual styling

- Portrait: 72×72px circle, fallback initials avatar uses gradient from `COLORS.brand.*`
- Name: 1.5rem, font-weight 700, no truncation
- Identity chips (Row 1): 0.72rem, 3px×10px padding, 12px border radius
  - Party chip: filled, color from `PARTY_COLOR[party]`, white text
  - Chamber + district chips: filled with `COLORS.neutral.background`, dark text
- Service card (Row 2): tinted background (`COLORS.neutral.background`), 8px radius, 6px×10px padding, inline-flex
  - Label "CURRENT ROLE": 0.7rem uppercase, `COLORS.neutral.textMuted`, letter-spacing 0.06em
  - Role chip: solid dark (`COLORS.brand.text` background, white text)
  - Tenure: 0.72rem, `COLORS.neutral.mute`
- Contact links: 0.75rem, `COLORS.brand.primary`, separated by middle-dot
- Container: max-width 600px, centered, 24px vertical padding

### Senate variant

- District chip reads `${state}` instead of `${state}-${district_number}` (e.g., "California" or "CA")
- Service card shows class instead of district position when no leadership role: "CURRENT ROLE  [Senator] · Class 1 · Since 2025"

### No-leadership-role variant

- Service card role chip reads "Representative" (house) or "Senator" (senate)
- Tenure derived from `terms[].startYear` min if leadership history is empty

### Edge cases

- No portrait → initials avatar, gradient seeded by party color
- Independent (party `'I'` or `'ID'`) → grey chip
- At-large district (`AK`, `DE`, `MT`, `ND`, `SD`, `VT`, `WY`) → district chip reads `${state}-AL`
- Mobile (≤640px) → chips wrap naturally, no overflow; portrait shrinks to 60×60px, name to 1.3rem

---

## Performance section — overall

### Order

Categories appear in this order (locked):

1. **Service Record**
2. **Issue Positions**
3. **Community Presence**
4. **Finance**
5. **Ethics & Accountability**
6. **Voting & Bills**

Rationale: identity → stated positions → local connection → money → ethics check → actual voting record. The narrative arc opens with the person and ends with their concrete legislative output (the deepest drill-down).

### Default state

All six categories start collapsed. Each collapsed category bar shows:

- Chevron (▸ / ▾) on the left
- Category name (bold)
- Preview chip on the right (muted text, headline numbers)

Click anywhere on the bar to expand.

### Preview chips (when collapsed)

| Category               | Preview chip                                                                     |
| ---------------------- | -------------------------------------------------------------------------------- |
| Service Record         | `Speaker · 18.5 yrs · first elected 2007`                                        |
| Issue Positions        | `9 issues · 10 sources`                                                          |
| Community Presence     | `Lives in district ✓ · 1 office · 1 town hall in last 90 days`                   |
| Finance                | `$5.2M raised · 28% small-donor · 1% PAC`                                        |
| Ethics & Accountability | `STOCK: 50% compliant · in-state 67%`                                            |
| Voting & Bills         | `50% attendance · 1 sponsored · 1 cosponsored`                                   |

Preview chip fields fall back gracefully when data is missing (e.g., "no scorecards yet" if `scorecard_ratings` is empty for the official).

### Drill-down stack (4 levels)

1. **Category bar** — preview chip visible
2. **Sub-cascade bar** (only inside Issue Positions, Finance, Voting & Bills) — preview chip visible
3. **Card** — full metric value + caption + "view evidence →" link
4. **Evidence drawer (modal)** — full source list with external links. Unchanged from slice 4.

### Sub-cascade applicability

- **Has sub-cascade:** Issue Positions, Finance, Voting & Bills
- **Flat (cards inline when category expands):** Service Record, Community Presence, Ethics & Accountability

Sub-cascade is overkill when a category has fewer than 4 distinct metric groups.

---

## Issue Positions

### Structure

Two-level cascade.

- Category bar expands → reveals 9 issue-area sub-cascade bars
- Each issue-area sub-cascade expands → reveals 1+ scorecard cards

### Sub-categories (issue areas)

Derived from `scorecard_orgs.issue_area`. DB values are kebab-case; UI title-cases them.

| `issue_area` (DB)      | Display label             |
| ---------------------- | ------------------------- |
| `environment`          | Environment               |
| `civil-liberties`      | Civil Liberties           |
| `civil-rights`         | Civil Rights              |
| `reproductive-rights`  | Reproductive Rights       |
| `liberal-policy`       | Liberal Policy            |
| `conservative-policy`  | Conservative Policy       |
| `business-policy`      | Business Policy           |
| `second-amendment`     | Second Amendment          |
| `labor`                | Labor                     |

Sub-categories appear in alphabetical order by display label. Within a sub-category, sources are alphabetical by `scorecard_orgs.name`.

### Sub-category preview chip

When the issue-area sub-cascade is collapsed, the preview chip shows each source's alignment label, joined by middle-dot. Example for Environment (LCV 92, Sierra Club 95):

```
▸ Environment    2 sources    LCV Strongly Aligned · Sierra Club Strongly Aligned
```

For single-source issue areas:

```
▸ Civil Liberties    1 source    ACLU Mostly Aligned
```

### Scorecard card

Replaces the slice-4 `ScorecardCard`. The format change is the title row:

- **Before (slice 4):** `League of Conservation Voters (environment)` — 0.75rem uppercase eyebrow
- **After:** `**Environment** (League of Conservation Voters)` — issue area bolded, org in muted parens, regular case, 0.95rem

The numeric score (e.g., 92) is **no longer shown on the card** — it appears only in the evidence drawer. The card surfaces the textual alignment label instead.

### Score-to-label translation

5-tier mapping from `scorecard_ratings.score` (0–`scoring_max`, typically 0–100):

| Normalized score (0–100) | Label              |
| ------------------------ | ------------------ |
| 90–100                   | Strongly Aligned   |
| 70–89                    | Mostly Aligned     |
| 40–69                    | Mixed              |
| 10–39                    | Mostly Differs     |
| 0–9                      | Strongly Differs   |

If `scoring_max` ≠ 100, normalize first: `(score / scoring_max) * 100`.

Label rendered in `COLORS.brand.text` (neutral, no partisan tint).

### Card layout

```
┌──────────────────────────────────────┐
│ Environment (League of Conservation Voters) │  ← issue bold + org muted
│                                              │
│ Strongly Aligned                             │  ← alignment label, neutral
│                                              │
│ → methodology       view evidence →          │  ← drill-down links
└──────────────────────────────────────┘
```

### Evidence drawer — inline expand, no modal

Slice 4 shipped a centered-modal `ScorecardEvidenceDrawer`. This redesign **replaces the modal with inline expansion** to match the cascade-on-click language used everywhere else on the page.

Behavior:

- "view evidence →" link is replaced by a `[ ▸ ] view evidence` pill-chevron button at the bottom of the card.
- Click toggles inline expansion: a dashed-top divider appears within the card, followed by an evidence section (e.g., a "Transactions" sub-heading and source rows).
- Button label flips to `[ ▾ ] Hide evidence` when expanded.
- The card itself grows in height; no overlay, no z-index layering, no focus trap. Page scroll handles long lists.
- Same drill-down contract: every row inside the expanded section MUST include at least one external `<a>` link to the authoritative source (housestockwatcher, congress.gov, etc.).

Row styling inside the evidence section (Stock Act transactions are the worked example below; the same pattern applies to missed votes, sponsored bills, town halls, leadership history, etc.):

```
─── Transactions ──────────────────────────────
[ ✓ ] NVDA · NVIDIA Corp              $15K–$50K
      Purchase · filed 15 days after transaction
      → housestockwatcher.com source

[ ✖ ] TSLA · Tesla Inc                $100K–$250K
      Sale · filed 73 days after transaction · 28 days late
      → housestockwatcher.com source
```

- All row text uses **the same dark color (`#1a1714`)** — late rows are NOT color-coded.
- Late status is conveyed by:
  1. The leading **compliance icon** (✓ for on-time, ✖ for late) in a small chip
  2. **Bolded** "X days late" inside the metadata text

Compliance icon chip:

- 20×20px (sometimes 18×18 in tight contexts) filled circle
- On-time (`✓`, U+2713): `background: #c5e3c7`, `color: #1f4d24` (Strongly Aligned colors)
- Late (`✖`, U+2716 Heavy Multiplication X): `background: #f4d3c0`, `color: #7a3e1c` (Mostly Differs colors)
- The `✖` glyph (U+2716) is the locked X variant — `✗` (U+2717) reads as unprofessional; `✖` has cleaner, bolder geometry.

These icons are **only used in evidence drawer rows** (binary compliance state). They do NOT appear on alignment chips (which use color-only on the home mini-strip and the textual ALIGNMENT_LABEL inside MetricCardShell values).

---

## Finance

### Structure

Category bar expands → reveals a 3-stat summary strip + 2 named sub-sections, each containing peer sub-cascades.

```
▾ Finance                                   $5.2M raised · 28% small-donor · 1% PAC

  ┌────────────────────────────────────────┐
  │ TOTAL RAISED  $5.2M                    │
  │ SMALL-DONOR % 28%                      │   ← Summary strip
  │ PAC %         0.6%                     │
  └────────────────────────────────────────┘

  Contributors                              ← Sub-section heading

  ▸ PACs                  $32.5K · 12 PACs
  ▸ Individual Donors     data coming slice 5+    ← grayed placeholder

  Top Donor Industries & Organizations       ← Sub-section heading

  ▸ Top Industries        Securities & Investment leads
  ▸ Top Organizations     data coming slice 5+
```

### Summary strip

Three metrics in a 3-column grid with **vertical dividers** between cells. Total Raised is the headline (slightly larger); the other two are supporting.

| Metric           | Source                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- |
| Total raised     | `finance_summaries.total_raised` for current cycle                                     |
| Small-donor %    | `finance_summaries.small_donor_pct`                                                    |
| PAC %            | `sum(finance_pac_contributions.amount) / finance_summaries.total_raised * 100`, computed in the queries layer |

Styling:

- Container: `padding: 12px 14px`, `border: 1px solid #d8d4c9`, `border-radius: 6px`, background = `CATEGORY_CARD_GRADIENT['finance']` (sage tint toward white)
- Grid: `grid-template-columns: 1.3fr 1fr 1fr` — Total Raised gets ~30% more width
- Vertical dividers: `border-left: 1px solid #d8d4c9` on cells 2 and 3, with `padding: 0 12px` (or `padding-left: 12px` on the last cell)
- Label row: `font-size: 0.66rem`, `color: #5a5751`, `text-transform: uppercase`, `letter-spacing: 0.08em`, `font-weight: 600`, with a 5×5px Finance-green dot (`CATEGORY_ACCENT['finance']`) prefix
- **Value sizing — headline emphasis** (~1.25× ratio, locked):
  - Total Raised: `font-size: 1.45rem`, `font-weight: 800`
  - Small-donor % + PAC %: `font-size: 1.15rem`, `font-weight: 700`
  - All values: `color: #1a1714`, `line-height: 1`

In-state donor % (which was in slice 4's FinanceCard) **moves to Ethics & Accountability** (see below).

### Sub-section heading style — multi-shade

Each of Finance's two sub-sections gets its own light green shade. Both stay clearly in the green family but differ enough to visually group the rows underneath.

Heading style is uppercase eyebrow with a thin horizontal rule extending right:

```
CONTRIBUTORS  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ PACs
▸ Individual Donors

TOP DONOR INDUSTRIES & ORGANIZATIONS  ━━━━━━━━━━━━━
▸ Top Industries
▸ Top Organizations
```

| Sub-section                                | Heading text color | Rule + sub-cascade left-accent color |
| ------------------------------------------ | ------------------ | ------------------------------------ |
| Contributors                               | `#2d5d3a` (deep sage) | `#a8d2b1` (sage)                   |
| Top Donor Industries & Organizations       | `#2a5d4a` (deep mint) | `#a8d4c0` (mint)                  |

Both reference `FINANCE_SUB_SECTION_SHADES` token (see *Visual design tokens*).

Heading text: `font-size: 0.72rem`, `text-transform: uppercase`, `letter-spacing: 0.1em`, `font-weight: 700`. Rule: `flex: 1; height: 1px; background: <accent>`. Margin: `12px 0 6px`.

### Sub-section 1: Contributors

Heading text in `#2d5d3a` with sage rule.

| Sub-cascade        | Source / status                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------- |
| PACs               | Aggregate from `finance_pac_contributions`. Preview chip: `$<total> · <count> PACs`. Sub-cascade left accent: `#a8d2b1`. |
| Individual Donors  | **Not in current data.** Grayed placeholder (per *Grayed/placeholder MetricCardShell* spec). Not clickable. |

### Sub-section 2: Top Donor Industries & Organizations

Heading text in `#2a5d4a` with mint rule.

| Sub-cascade        | Source / status                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Top Industries     | `finance_industry_top` ordered by rank. Preview chip: top industry name + " leads". Sub-cascade left accent: `#a8d4c0`. |
| Top Organizations  | **Not in current data.** Grayed placeholder. Not clickable.                                  |

### Sub-cascade expanded content

**PACs** — table of contributing PACs (existing `finance_pac_contributions` query), 5 rows + "See all PACs →" link. Each row: PAC name + amount + FEC drill-down link.

**Top Industries** — stacked-row bar chart (`IndustryBreakdown` component — restyle of slice-4's `FinanceIndustryBreakdown`):

- **Layout** — each industry renders as a row:
  ```
  Industry name                              $TOTAL  · NN%
  ════════════════════════════════════════════════════════
                                              (thin green bar)
  ```
  Name + dollar + % on one line; thin 6px-height bar below, full row width, proportional fill.
- **Bar fill color**: single `CATEGORY_ACCENT['finance']` (`#3da75b`) for every row. No per-industry color variation (slice 4's `INDUSTRY_COLOR` token retained for future reuse but unused here).
- **Bar track color**: `#e8e6dd`
- **% column** is shown alongside the dollar amount (e.g., "$412K · 31%"), `font-size: 0.72rem`, `color: #5a5751`.
- **Sort**: server returns top 10 by dollar descending. No client-side sort toggle in this redesign (deferred to slice 5+).
- **Top-1 row emphasis** — only the industry name gets a visual lift: `font-weight: 700`, `font-size: 0.92rem` (vs. `600` / `0.82rem` for other rows). **Bar height, color, padding, dollar formatting are identical to every other row.** No row tint, no rank badge.
- **Top 5 / Top 10 toggle**:
  - 5 rows shown by default.
  - Below the rows: a full-width button styled as the pill chevron toggle (matches category-bar pattern):
    ```
    [ ▸ ]  Show 5 more industries           5 of 10 shown
    ```
  - On expand: shows all 10 rows; chevron rotates to ▾, label becomes "Show less", counter updates to "10 of 10 shown".
  - Button styling: `width: 100%`, `background: #fff`, `border: 1px solid #d8d4c9`, `border-radius: 6px`, `padding: 8px 12px`, flex with 10px gap; chevron pill on left, label center-left, counter right (`color: #5a5751`, `font-size: 0.72rem`).
- Below the toggle, a single external link: "→ full breakdown on OpenSecrets".

### Cycle

Current cycle only (`2024` for the 119th Congress). No cycle selector in this redesign. Deferred to slice 5+.

### Grayed placeholders

Display style for "data coming slice 5+" — applies to sub-cascade rows AND MetricCardShells where data isn't ingested:

- Background: `#f6f4ed` (solid beige; not opacity reduction)
- Border: `#e5e1d4` (same as default rows)
- Name color: `#5a5751`
- Teaser/caption: `color: #807a72`, `font-style: italic`, content = `data coming slice 5+`
- Not clickable (cursor: default, no hover effect)
- Full opacity — text stays readable

---

## Voting & Bills

### Structure

Single-level sub-cascade with 3 consolidated metrics. No sub-section headings — flat under the category bar.

```
▾ Voting & Bills                            50% attendance · 1 sponsored · 1 cosponsored

  ▸ Voting Record         50% attendance
  ▸ Bills Authored        1 sponsored, 1 cosponsored
  ▸ Committee Work        data coming slice 5+
```

### Sub-cascades

**Voting Record** — `official_metrics.attendance_pct`, `votes_voted_count`, `votes_missed_count`, `total_roll_calls`. Expanded view: card showing attendance % + missed-votes drill-down (existing `useOfficialMissedVotes` hook + drawer).

**Bills Authored** — combines `bills_sponsored_count` + `bills_cosponsored_count` (slice 4 had these as separate cards; here merged). Preview chip: `<N> sponsored, <M> cosponsored`. Expanded view: two side-by-side card sections — Sponsored (left) and Cosponsored (right). Each card drills into the existing bills-list drawer via `useOfficialSponsoredBills` / `useOfficialCosponsoredBills`.

**Committee Work** — `committee_assignment_count` + `committee_leadership_count`. Both are slice-5 placeholders today. Render as grayed-out sub-cascade.

---

## Community Presence (flat)

### Structure

Category bar expands → reveals 3 metric cards in a horizontal grid. No sub-cascade.

Today's metrics:
- Lives in district (boolean)
- District offices count
- Town halls count (current Congress)

### Expansion items added (all `free` — from existing data, no new ingest)

- **Office address list with external map links** — when District Offices card is expanded, list each `district_offices` row with full address + phone (already in slice 4's drill-down drawer). Each address gets a "→ open in Google Maps" link constructed from `https://maps.google.com/?q=<urlencoded address>`. The embedded Leaflet map with pins is deferred to slice 4.5+ (requires geocoding + new lat/lng columns on `district_offices`).
- **Town hall format breakdown** — when Town Halls card is expanded, show counts per `town_halls.format` (in-person, virtual, phone, hybrid).
- **Town hall cadence** — small secondary text on the Town Halls card: "Last event: <date> · <N> in last 90 days".

### Card layout

```
┌──────────┬──────────┬───────────────┐
│  LIVES   │ DISTRICT │ TOWN HALLS    │
│  IN      │ OFFICES  │ (119th)       │
│ DISTRICT │          │               │
│  ✓ Yes   │    1     │      1        │
│ home maps│view ev → │ last: 2026-02-15│
│ to CA-11 │          │ 1 in 90 days  │
└──────────┴──────────┴───────────────┘
```

---

## Service Record (flat)

### Structure

Category bar expands → reveals 3 metric cards in a horizontal grid. No sub-cascade.

Today's metrics:
- Base salary
- Tenure (years)
- Leadership role

### Expansion items added (all `free`)

- **First elected date** — derive from `min(officials_leadership_history.start_date)` (year only). Show below the Tenure value as muted caption: "First elected 2007".
- **Leadership timeline** — when Leadership role card is expanded (existing drawer), show every role with start_date / end_date as a vertical timeline. Already implemented in slice 4 via `useOfficialLeadershipHistory`; just refine visual layout to a timeline rather than a list.
- **Tenure by chamber** — when Tenure card is expanded, show split: "12.5 yrs House · 0 yrs Senate" for officials who switched chambers. Derive by summing `(end_date - start_date)` per chamber from leadership history.

### Card layout

```
┌──────────┬──────────┬─────────────┐
│  BASE    │ TENURE   │ LEADERSHIP  │
│  SALARY  │          │ ROLE        │
│ $223,500 │ 18.5 yrs │ Speaker     │
│ Speaker  │ first    │ view ev →   │
│view src →│ elected  │             │
│          │ 2007     │             │
│          │ view ev →│             │
└──────────┴──────────┴─────────────┘
```

---

## Ethics & Accountability (flat)

### Structure

Category bar expands → reveals 2 metric cards in a horizontal grid. No sub-cascade.

Metrics:

- **STOCK Act compliance** — `official_metrics.stock_act_compliance_pct`, `stock_act_disclosures_total`, `stock_act_disclosures_late`. **Moved into this category** from slice 4's `ConstituentConnectionCard`.
- **In-state donors** — `official_metrics.in_state_donations_pct`, `out_of_state_donations_pct`. **Moved into this category** from slice 4's `FinanceCard`.

### Expansion items added (all `free`)

- **STOCK Act worst-case late days** — `max(stock_transactions.days_late) where official_id = $1`. Show as secondary text on the STOCK Act card: "Worst case: 28 days late".
- **Total disclosed volume** — show as a range: `sum(amount_range_low) – sum(amount_range_high)` across all `stock_transactions` for the current Congress. Display as secondary text on the STOCK Act card, e.g., for Pelosi's 2 trades (NVDA $15K–$50K + TSLA $100K–$250K): "Total disclosed volume: $115K–$300K".

### Card layout

```
┌────────────────┬────────────────┐
│ STOCK ACT      │ IN-STATE       │
│ COMPLIANCE     │ DONORS         │
│      50%       │      67%       │
│ 1 late / 2 total│ 33% out-of-state│
│ Worst: 28 days │ view source →  │
│ $115K-$300K vol│                │
│ view ev →      │                │
└────────────────┴────────────────┘
```

---

## Home page mini-strip

### Scope

`apps/web/components/OfficialsCard.tsx` — the per-official rows on the home page "Your officials" section.

### Today (slice 4)

```
[Avatar] Nancy Pelosi (D)
         House · CA-11 · Member of Congress
         LCV 92 · SIERRA-CLUB 95 · ACLU 85 · Securities & Investment · Att. 50%
```

### Redesign

```
[Avatar] Nancy Pelosi
         📍 California's 11th District             ← map pin + district name (was: party badge + chamber meta)
         Speaker · House · since 2007              ← service meta
         [Environment] [Civil Rights] [Second Amendment]   ← alignment chips (color-only)
```

### Removed

- Party chip / badge at the top of the strip
- Raw scorecard scores (e.g., "LCV 92")
- Top industry text (moved to detail page only)
- Raw attendance percentage (moved to detail page only)
- **Alignment-tier symbols** — chips no longer carry `✓✓` / `✗` glyphs. Tier is conveyed by background color alone.

### Added

- **Map pin glyph + district name** — `<svg>` pin (red `#d13b3b`) + "California's 11th District" (house) or "California" (senate). 12×14px SVG inline.
- **Alignment chips** — top 3 scorecard ratings, selected by the strongest signals:
  1. Highest-aligned (e.g., LCV 95 → green chip)
  2. Lowest-aligned (e.g., NRA 0 → amber chip)
  3. Third pick: next-highest if no strong-differs exists, otherwise next-lowest

Chip format: `<issue_area title-cased>` — text only, no trailing symbol. Tier is encoded entirely in the background + text color.

#### Chip click behavior (deep-link to detail-page sub-cascade)

Each chip is a `<Link>` wrapping the chip span:

```tsx
<Link href={`/officials/${officialId}#${categoryId}:${subCascadeSlug}`}>
  <span className={`chip chip-${tier}`}>{issueArea}</span>
</Link>
```

Hash format: `<categoryId>:<subCascadeSlug>` — e.g., `#issue-positions:environment` or `#issue-positions:second-amendment`.

On `/officials/[id]` mount, the page reads `window.location.hash` once and:

1. Opens the matching category in `ExpandedState.categories`.
2. Opens the matching sub-cascade in `ExpandedState.subCascades` (key `<categoryId>:<subId>`).
3. Calls `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the sub-cascade DOM node.

Anchor IDs added to existing components for hash targeting:

- `CategoryBar` renders `id="category-<categoryId>"`
- `SubCascadeBar` renders `id="subcat-<categoryId>-<subCascadeSlug>"`

#### Hover affordance

On chip hover: `filter: brightness(0.96)` + `box-shadow: 0 1px 4px rgba(0,0,0,0.08)`. Cursor becomes `pointer`. No underline. Color unchanged.

Chip colors (extending `@chiaro/ui-tokens`):

| Tier              | Background | Text     |
| ----------------- | ---------- | -------- |
| Strongly Aligned  | `#c5e3c7`  | `#1f4d24` |
| Mostly Aligned    | `#d4ecd5`  | `#2a6b30` |
| Mixed             | `#f0eee5`  | `#5a5751` |
| Mostly Differs    | `#f4d3c0`  | `#7a3e1c` |
| Strongly Differs  | `#f0b8a0`  | `#5a2812` |

### Senate variant

- Map pin + "California" (state name only — no district number)
- Same alignment chip logic

### No-scorecards-yet variant

- Hide the alignment chip row entirely (graceful degradation — same as slice 4 behavior)

---

## Visual design tokens

### New tokens added to `@chiaro/ui-tokens`

```ts
// packages/ui-tokens/src/alignment.ts
export type AlignmentTier =
  | 'strongly-aligned'
  | 'mostly-aligned'
  | 'mixed'
  | 'mostly-differs'
  | 'strongly-differs'

export const ALIGNMENT_LABEL: Record<AlignmentTier, string> = {
  'strongly-aligned': 'Strongly Aligned',
  'mostly-aligned':   'Mostly Aligned',
  'mixed':            'Mixed',
  'mostly-differs':   'Mostly Differs',
  'strongly-differs': 'Strongly Differs',
}

// NOTE: no ALIGNMENT_SYMBOL constant — chips render by color only, no trailing glyph.
// The textual ALIGNMENT_LABEL is used inside the MetricCardShell value slot
// (e.g., "Strongly Aligned"), not as chip suffix.

export const ALIGNMENT_CHIP_COLORS: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#c5e3c7', fg: '#1f4d24' },
  'mostly-aligned':   { bg: '#d4ecd5', fg: '#2a6b30' },
  'mixed':            { bg: '#f0eee5', fg: '#5a5751' },
  'mostly-differs':   { bg: '#f4d3c0', fg: '#7a3e1c' },
  'strongly-differs': { bg: '#f0b8a0', fg: '#5a2812' },
}

export function scoreToTier(score: number, scoringMax: number): AlignmentTier {
  const pct = (score / scoringMax) * 100
  if (pct >= 90) return 'strongly-aligned'
  if (pct >= 70) return 'mostly-aligned'
  if (pct >= 40) return 'mixed'
  if (pct >= 10) return 'mostly-differs'
  return 'strongly-differs'
}
```

```ts
// packages/ui-tokens/src/issue-area.ts
export function titleCaseIssueArea(kebab: string): string {
  return kebab.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
```

```ts
// packages/ui-tokens/src/category.ts
export type CategoryId =
  | 'service-record'
  | 'issue-positions'
  | 'community-presence'
  | 'finance'
  | 'ethics-accountability'
  | 'voting-bills'

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  'service-record':        'Service Record',
  'issue-positions':       'Issue Positions',
  'community-presence':    'Community Presence',
  'finance':               'Finance',
  'ethics-accountability': 'Ethics & Accountability',
  'voting-bills':          'Voting & Bills',
}

// Palette A — semantic earthen (locked 2026-05-17)
export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#c89a4e', // gold
  'issue-positions':       '#3b6ed1', // civic blue
  'community-presence':    '#1f9b88', // teal
  'finance':               '#3da75b', // money green
  'ethics-accountability': '#d68a1f', // amber
  'voting-bills':          '#7d57c1', // statute purple
}

// Lighter shade per category — used by sub-cascade bars' 1px left accent
export const SUB_CASCADE_ACCENT: Record<CategoryId, string> = {
  'service-record':        '#e1c896',
  'issue-positions':       '#87aae0',
  'community-presence':    '#7fc7bb',
  'finance':               '#8fc89d',
  'ethics-accountability': '#ecbc7d',
  'voting-bills':          '#b39bd9',
}

// Subtle gradient background per category — used on MetricCardShell + summary strip
export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string> = {
  'service-record':        'linear-gradient(180deg, #fcfaf2 0%, #fff 100%)',
  'issue-positions':       'linear-gradient(180deg, #f6f8fc 0%, #fff 100%)',
  'community-presence':    'linear-gradient(180deg, #f3faf8 0%, #fff 100%)',
  'finance':               'linear-gradient(180deg, #f4faf6 0%, #fff 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #fcf7f0 0%, #fff 100%)',
  'voting-bills':          'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)',
}
```

```ts
// packages/ui-tokens/src/finance-shades.ts
// Multi-shade Finance sub-section pair: Contributors stays in sage,
// Top Donor Industries & Organizations uses mint (cool-tinged green).
export const FINANCE_SUB_SECTION_SHADES = {
  contributors: {
    accent: '#a8d2b1',  // sage — sub-cascade left border + rule
    heading: '#2d5d3a',  // deep sage — uppercase heading text
  },
  topDonor: {
    accent: '#a8d4c0',  // mint — sub-cascade left border + rule
    heading: '#2a5d4a',  // deep mint — uppercase heading text
  },
} as const
```

Re-export all of these from `packages/ui-tokens/src/index.ts`.

### Existing tokens used

- `COLORS.brand.text`, `COLORS.brand.primary`, `COLORS.brand.background`
- `COLORS.neutral.background`, `COLORS.neutral.border`, `COLORS.neutral.mute`, `COLORS.neutral.textMuted`
- `PARTY_COLOR`, `PARTY_LABEL`, `PARTY_SHORT`
- `INDUSTRY_COLOR`, `INDUSTRY_DEFAULT_COLOR`

---

## Component architecture

### New components

```
apps/web/components/
  bio/
    BioHeader.tsx                      — orchestrator
    BioPortrait.tsx                    — portrait + initials fallback
    BioIdentityRow.tsx                 — Row 1: party + chamber + district chips
    BioServiceCard.tsx                 — Row 2: tinted card with role + tenure
    BioContactLinks.tsx                — official_url + twitter
  performance/
    PerformanceSection.tsx             — top-level wrapper; renders 6 categories in order; reads URL hash on mount
    CategoryBar.tsx                    — collapsible bar with pill chevron + name + teaser + per-category left accent
    SubCascadeBar.tsx                  — mini-category-bar pattern with 1px sub-accent
    categories/
      ServiceRecordCategory.tsx        — flat, 3 metric cards
      IssuePositionsCategory.tsx       — sub-cascade by issue area; cards stack vertically when sub-cascade opens
      CommunityPresenceCategory.tsx    — flat, 3 metric cards
      FinanceCategory.tsx              — summary strip + 2 sub-sections (Contributors, Top Donor); multi-shade headings
      EthicsAccountabilityCategory.tsx — flat, 2 metric cards
      VotingBillsCategory.tsx          — sub-cascade, 3 consolidated metrics (Voting Record, Bills Authored, Committee Work)
    cards/
      MetricCardShell.tsx              — value-top layout with category-color dot + subtle gradient
      AlignmentChip.tsx                — color-only chip (no symbol), 5-tier; deep-link href support
      DistrictBadge.tsx                — map pin + district/state text (used in mini-strip)
      ComplianceIcon.tsx               — ✓/✖ filled-chip icon used in evidence rows (binary state)
      EvidenceExpand.tsx               — inline-expand controller (replaces slice 4's modal drawer)
    chips/
      CategoryAccent.tsx               — exposes the 2px left-accent border helper for category bars + bodies
      PreviewChipText.tsx              — narrative teaser renderer for collapsed bars
    finance/
      FinanceSummaryStrip.tsx          — 3-cell gradient strip; headline emphasis on Total Raised
      FinanceSubSectionHeading.tsx     — uppercase eyebrow + thin rule; shade-aware
      IndustryBreakdown.tsx            — stacked rows with top-5/top-10 pill-chevron toggle, top-1 header emphasis
```

### Removed / superseded slice-4 components

- `OfficialDetail.tsx` (replaced by `BioHeader`)
- `OfficialPerformance.tsx` (replaced by `PerformanceSection`)
- `ScorecardCard.tsx` (subsumed into `IssuePositionsCategory`)
- `ScorecardEvidenceDrawer.tsx` (**removed** — modal pattern replaced by inline expand inside the relevant cards)
- `FinanceCard.tsx` (replaced by `FinanceCategory`)
- `FinanceIndustryBreakdown.tsx` (replaced by `IndustryBreakdown` with new visual + top-5/10 toggle)
- `ShowUpWorkloadCard.tsx` (replaced by `VotingBillsCategory`)
- `PositionSalaryCard.tsx` (replaced by `ServiceRecordCategory`)
- `ConstituentConnectionCard.tsx` (split — STOCK Act + in-state % → Ethics; lives-in-district + offices + town halls → Community Presence)

### Modified

- `OfficialsCard.tsx` (home mini-strip) — replace inline chips block with new district-badge + alignment-chips treatment, drop party chip from header

---

## State management

### Expand / collapse state

Per-category and per-sub-cascade open state held in `useState` on `PerformanceSection`. State key shape:

```ts
type ExpandedState = {
  categories: Set<CategoryId>
  subCascades: Set<`${CategoryId}:${SubCascadeId}`>
}
```

Categories: `'service-record' | 'issue-positions' | 'community-presence' | 'finance' | 'ethics-accountability' | 'voting-bills'`.

Sub-cascades: kebab-case scoped under their category (e.g., `'issue-positions:environment'`, `'finance:pacs'`, `'voting-bills:voting-record'`).

#### URL hash → expand-and-scroll on mount

The detail page reads `window.location.hash` once on mount to support deep-linking from the home page mini-strip's alignment chips.

Hash format: `#<categoryId>:<subCascadeSlug>` — e.g., `#issue-positions:environment`, `#finance:top-industries`.

On mount:

1. Parse the hash; extract `categoryId` and optional `subCascadeSlug`.
2. Add `categoryId` to `ExpandedState.categories`.
3. If `subCascadeSlug` is present and the category supports sub-cascades, add `${categoryId}:${subCascadeSlug}` to `ExpandedState.subCascades`.
4. Use a `useEffect` after first render to call `document.getElementById('subcat-' + categoryId + '-' + subCascadeSlug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`. If no sub-cascade, target `'category-' + categoryId` instead.

The hash is not written back to the URL when the user toggles in-page expansion (avoids polluting back-button history).

Anchor IDs (rendered by the corresponding components):

- `CategoryBar` → `id="category-<categoryId>"`
- `SubCascadeBar` → `id="subcat-<categoryId>-<subCascadeSlug>"`

### Drill-down evidence-expansion

Each metric card owns its own evidence-open `useState`. Clicking the `view evidence` pill-chevron button toggles it. This replaces slice 4's modal-drawer state pattern (per *Evidence drawer — inline expand*).

### Query keys

No new TanStack Query keys. Existing slice-4 hooks (`useOfficialMetrics`, `useOfficialScorecardRatings`, `useOfficialFinance`, etc.) are reused. The alignment-chip derivation, preview-chip computation, and PAC % calculation happen in render — no new query layer.

---

## Data — no schema changes

This redesign introduces **zero migrations**. All data already exists in slice 4's DB layer. New derivations:

| Derived value                          | Computed from                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| First elected year                     | `min(officials_leadership_history.start_date).year` per official              |
| Tenure by chamber                      | Sum of `(end_date - start_date)` from `officials_leadership_history` grouped by `chamber` |
| STOCK Act worst-case late days         | `max(stock_transactions.days_late) where official_id = $1`                    |
| Total stock trading volume             | `sum((amount_range_low + amount_range_high) / 2)` over `stock_transactions` current Congress |
| PAC %                                  | `sum(finance_pac_contributions.amount) / finance_summaries.total_raised * 100` |
| Alignment tier per scorecard rating    | `scoreToTier(score, scoring_max)` (token function)                            |
| Top 3 alignment chips for mini-strip   | Sort `scorecard_ratings` for the official by `scoreToTier` then by absolute deviation from 50 (strongest signals first); take top 3 |

All computations live in the queries / hooks layer of `@chiaro/officials` (and `@chiaro/bills` for the bills authored merge). No DB views or RPCs added.

---

## Drill-down audit contract — preserved

The slice-4 design contract still holds: every metric in the Performance section drills to evidence — either an internal drawer (`onExpand`) or an external link (`externalSourceUrl`). `MetricCardShell`'s TypeScript discriminated union enforces this at compile time. The redesign adds two new layers (category bar + sub-cascade bar), but each card at the leaf still requires the drill-down contract.

The audit doc at `docs/superpowers/slice-4-drill-down-audit.md` continues to apply; the table's rows are re-grouped under the new category structure when the redesign ships.

---

## Acceptance criteria

1. `/officials/[id]` for a representative with full slice-4 fixture data renders the new layout with all 6 categories collapsed, each showing its preview teaser ("Speaker · since 2007", "$5.2M raised · top industry: Securities & Investment", etc.) and the correct per-category accent color (palette A).
2. Clicking any category bar toggles its expansion. Clicking a sub-cascade bar (inside Issue Positions / Finance / Voting & Bills) toggles its expansion. Pill chevron rotates ▸ ↔ ▾ between states.
3. Issue Positions, when expanded, shows 9 issue-area sub-cascades alphabetically. Each scorecard card uses the new title format (**Issue** (Org)) and renders the textual alignment label (e.g., "Strongly Aligned"), not the numeric score.
4. Finance expanded view shows the 3-stat summary strip (Total Raised at 1.45rem, Small-donor % + PAC % at 1.15rem with vertical dividers + Finance-green dots + gradient background) + 2 sub-sections with multi-shade uppercase headings (Contributors in sage `#a8d2b1`, Top Donor in mint `#a8d4c0`) + 4 sub-cascades total. Individual Donors and Top Organizations render as grayed-out placeholders (`#f6f4ed` fill, italic muted text, full opacity).
5. Top Industries sub-cascade, when expanded, shows 5 stacked rows by default with single Finance-green bars (`#3da75b`). Row 1's industry name uses `font-weight: 700` + `font-size: 0.92rem`; all other rows + all bar heights identical. A full-width pill-chevron toggle button reads "Show 5 more industries · 5 of 10 shown" and expands to 10 rows on click.
6. Bio header renders consistently across house reps (with district number), senators (with class), independents (with grey party chip), at-large reps (district chip reads `XX-AL`), and reps with no leadership history (role chip reads "Representative" / "Senator").
7. Home page mini-strip shows the map-pin district badge ("California's 11th District" for house, full state name for senate) + 3 color-only alignment chips. **Chips carry no symbol/glyph** — tier is conveyed by background color only.
8. Each alignment chip on the home mini-strip is a `<Link>` with `href="/officials/[id]#<categoryId>:<subSlug>"`. Clicking jumps to the detail page; on mount the page parses the hash, opens both the matching category AND sub-cascade, and scrolls the sub-cascade into view via `scrollIntoView({ behavior: 'smooth', block: 'start' })`.
9. Evidence sections (replacing slice-4 modal drawers) expand inline within their parent card. Each compliance row shows a filled-chip icon — green ✓ chip (`#c5e3c7` / `#1f4d24`) for compliant rows, amber ✖ chip (U+2716, `#f4d3c0` / `#7a3e1c`) for non-compliant rows. **All transaction text uses the same dark color (`#1a1714`)** — late status is conveyed by the icon + bolded "X days late" in metadata, not by row-text color.
10. `pnpm --filter @chiaro/web build` succeeds with no TS errors.
11. `pnpm --filter @chiaro/web typecheck` clean across all 9 workspace packages.
12. No regressions on auth flow (`/sign-in` redirect for unauthenticated users) or calibration gate (`/calibrate` redirect for uncalibrated users).

---

## Out of scope — deferred to slice 5+

These came up during brainstorming. None are in scope for this redesign.

### Community Presence
- Embedded Leaflet map showing office pins (needs lat/lng columns on `district_offices` + geocoding pass in `unitedstates-legislators-ingest`)
- Years in district (residency tenure data)
- Local roots — birthplace, education in district
- Constituent newsletter cadence
- District tour days/year
- Casework volume

### Service Record
- Pre-Congress career (profession before politics)
- Education history
- Caucus memberships
- Election margins (last 3 cycles)
- Notable bills passed
- Committee history (cross-Congress)

### Ethics & Accountability
- Net worth growth during tenure (annual financial disclosure forms)
- Lobbyist-funded travel
- Spouse / dependent stock trades (STOCK Act extension)
- Disclosed gifts above threshold
- Past ethics findings (censures, House Ethics, OCE)
- Family employment conflicts in lobbying / regulated industries
- Position-vs-vote consistency
- Earmarks directed to donor-affiliated entities

### Finance
- Cycle selector + cycle-over-cycle comparison (e.g., "-71.4% vs previous")
- Individual donor totals + breakdown (PAC vs individual split — need new ingest)
- Top Organizations (corporate level, distinct from industries)
- Top State contributions
- Independent expenditures / dark money

### Voting & Bills
- Committee assignments + leadership (slice-5 placeholder already)
- Party unity / bipartisan vote percentages (slice-5 placeholder)
- Per-bill voting record table

Each deferred item gets its own brainstorm + spec when its slice arrives.
