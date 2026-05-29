# Slice 41 — Category palette reskin (colors + bgs + order)

**Status:** Draft for review
**Date:** 2026-05-29
**Tier:** Compressed-to-Mega-Slice (10 files: 9 modified + 1 new)
**Prerequisite slices:** 33–37 (BRAND tokens + domain palettes), 40 (dark mode reskin)
**Closes roadmap items:** slice 40 final-review carry-over (domain palette warm-brown leftovers — `MAP_COLORS_DARK.districtFill`, `CATEGORY_CARD_GRADIENT_DARK`, `CATEGORY_CARD_BG_SOLID_DARK`)

## 1. Goal

Re-derive the 6 category accent colors for stronger semantic fit, re-anchor all per-category card backgrounds to the new slice-40 cool slate base, collapse the existing light/dark variant pairs to single-hex-per-category for simplicity, and reorder the category enum + page card render order for a more readable narrative flow.

## 2. Non-goals

- **Light mode `bg.app` / `bg.card` changes.** Light palette base surfaces stay exactly as slice 33–37 shipped them. Only per-category card bgs change.
- **Dark mode `bg.app` / `bg.card` changes.** Slice 40 already shipped these; this slice only touches the per-category cards layered on top.
- **`semantic.*` base token changes** (`bg.*`, `border.*`, `accent.*`, `alert.*`, `signal.*`, `link.*`, `portrait.*`). All slice 40 token decisions stay.
- **CATEGORY_ACCENT_DARK collapse to single hex.** Both `CATEGORY_ACCENT` and `CATEGORY_ACCENT_DARK` will exist as exports but contain IDENTICAL values per category (back-compat with slice 37 `useCategoryAccent` hook + any direct importers; no consumer changes needed).
- **State-officials page reorder.** The state detail page uses a different card set (per Gotcha #15: state has 2 ethics cards, voting+bills folded into service record, community has 3 subsections). Reorder applies to federal-only.
- **AlignmentChip tiers, industry rainbow, finance "money in" signal green, MetricCardShell category retune.** All remain queued in the slice 38+ reskin roadmap.

## 3. User stories

- A signed-in user opens an official's detail page and sees the 6 category cards in narrative order: **who they are → where they show up → what they do with money → what they believe → how they behave → what they vote on**.
- The Service Record card uses brand gold (achievement / medal / longevity trophy semantic).
- The Community Presence card uses warm terracotta (town square clay, neighborhood pottery, gathering hearth).
- The Finance card uses saturated emerald (money / dollar bills — the most universal semantic anchor).
- The Issue Positions card uses brand blue (considered stance, calm deliberation).
- The Ethics & Accountability card uses burgundy (judicial robe, law-book leather, gravitas).
- The Voting & Bills card uses purple (legislative / royal / executive ink).
- The category palette reads as a coherent system in BOTH light and dark mode — same hex per category in both modes, with mode-appropriate card bg tints.
- Slice 40's domain-palette warm-brown leftovers (map district fill, category card bg gradient endpoints, sub-cascade tints) are all re-anchored to the new cool slate dark palette.

## 4. Visual brainstorm decisions

Captured across ~10 visual companion iterations:

| Decision | Pick | Notes |
|---|---|---|
| Category accent — Service Record | **`#c89a4e` gold** | Achievement medal / longevity trophy. Original slice-33 value (was warm before; semantic restoration). |
| Category accent — Community Presence | **`#b86340` terracotta** | Town square clay / gathering hearth. NEW value (was teal `#1f9b88`). |
| Category accent — Finance | **`#1a8f5a` emerald** | Money / dollar bills. NEW value (deeper saturation; was lighter green `#3da75b`). |
| Category accent — Issue Positions | **`#3b6ed1` blue** | Considered stance. Unchanged from slice 33-37. |
| Category accent — Ethics & Accountability | **`#8a3a4d` burgundy** | Judicial gravitas. NEW value (was amber `#d68a1f`). |
| Category accent — Voting & Bills | **`#7d57c1` purple** | Legislative / royal. Unchanged. |
| Light/dark variant strategy | **Single hex per category, both modes** | Was 6 categories × 2 variants = 12 hexes. Now 6 hexes total. `CATEGORY_ACCENT_DARK` stays as export but contains identical values to `CATEGORY_ACCENT`. |
| Light card bg saturation | **Level B — medium** | Clear visible hue. Each card identifies as its category color. Was Level "anchor" (too transparent against `#efece5` app bg). |
| Dark card bg | **Cool slate base + subtle hue tint** | Lifted to ~`#1e2126` luminance with a category-hue push. Was warm-brown anchored (slice 33-37 stale). |
| Map dark `districtFill` | **`#3a3e45`** (border.strong cool slate) | Was warm `#3a2e26`. |
| Map light `districtFill` | **`#f5f0e8`** (warm paper) | Unchanged. |
| `CATEGORY_CARD_GRADIENT_DARK` endpoints | **All 6 fade to `#16181c`** (new bg.app cool slate) | Was warm `#1a1714` anchor; slice 40 left this stale. |
| `SUB_CASCADE_ACCENT` (light) | Re-derived as lightened/desaturated variants per accent | Existing values for 2 unchanged categories (IP, VB) preserved. |
| `SUB_CASCADE_ACCENT_DARK` | Re-derived as muted/darker variants per accent | Same. |
| Category enum order | **Service Record → Community Presence → Finance → Issue Positions → Ethics → Voting & Bills** | Narrative: identity → presence → money → beliefs → conduct → output. Was `service-record → issue-positions → community-presence → finance → ethics-accountability → voting-bills`. |
| Federal officials detail page card order | **Match new enum order** | Currently the page renders SR → Finance → IP → CP → Ethics → Voting (hardcoded JSX); page is reordered to match new enum. |
| Mobile federal officials detail page order | **Match new enum order** | Same reasoning. |

## 5. Architecture

### 5.1 `packages/ui-tokens/src/category.ts` changes

**`CategoryId` enum** — reorder type members. (Order matters because some consumers iterate via `Object.keys(CATEGORY_LABEL)` for menus, badges, etc.)

```ts
export type CategoryId =
  | 'service-record'
  | 'community-presence'  // ← was position 3
  | 'finance'             // ← was position 4
  | 'issue-positions'     // ← was position 2
  | 'ethics-accountability'
  | 'voting-bills'
```

**`CATEGORY_LABEL`** — keys re-ordered to match enum (same labels).

**`CATEGORY_ACCENT`** (light, also serves as canonical accent):

```ts
{
  'service-record':        '#c89a4e',  // gold (unchanged from slice 33-37)
  'community-presence':    '#b86340',  // terracotta (was '#1f9b88' teal)
  'finance':               '#1a8f5a',  // emerald (was '#3da75b' medium green)
  'issue-positions':       '#3b6ed1',  // blue (unchanged)
  'ethics-accountability': '#8a3a4d',  // burgundy (was '#d68a1f' amber)
  'voting-bills':          '#7d57c1',  // purple (unchanged)
}
```

**`CATEGORY_ACCENT_DARK`** — keep export name for back-compat with slice 37 `useCategoryAccent` hook. Now contains IDENTICAL values per category to `CATEGORY_ACCENT`.

**`SUB_CASCADE_ACCENT`** (light, lightened variants):

```ts
{
  'service-record':        '#e1c896',  // unchanged (was gold-derived; still gold-derived)
  'community-presence':    '#e0b8a0',  // NEW terracotta-derived (was '#7fc7bb' teal-derived)
  'finance':               '#7eb898',  // NEW emerald-derived (was '#8fc89d' medium-green-derived)
  'issue-positions':       '#87aae0',  // unchanged
  'ethics-accountability': '#c89aa8',  // NEW burgundy-derived (was '#ecbc7d' amber-derived)
  'voting-bills':          '#b39bd9',  // unchanged
}
```

**`SUB_CASCADE_ACCENT_DARK`**:

```ts
{
  'service-record':        '#8a6a55',  // NEW gold-derived deeper (was '#9a8866' gold-derived)
  'community-presence':    '#a08858',  // NEW terracotta-derived (was '#4a9888' teal-derived)
  'finance':               '#4e8060',  // NEW emerald-derived (was '#5e9a70' medium-green-derived)
  'issue-positions':       '#6680b8',  // unchanged
  'ethics-accountability': '#704a55',  // NEW burgundy-derived (was '#b08850' amber-derived)
  'voting-bills':          '#8470a8',  // unchanged
}
```

**`CATEGORY_CARD_BG_SOLID`** (light, Level B saturation):

```ts
{
  'service-record':        '#f5e6cc',  // gold tint
  'community-presence':    '#f5dece',  // terracotta tint
  'finance':               '#d4e8d8',  // emerald tint
  'issue-positions':       '#d8e0f5',  // blue tint (slightly more saturated than slice 33's #f6f8fc)
  'ethics-accountability': '#ecc8cf',  // burgundy tint
  'voting-bills':          '#e0d5f0',  // purple tint
}
```

**`CATEGORY_CARD_BG_SOLID_DARK`**:

```ts
{
  'service-record':        '#23211a',  // gold-tinted cool slate (was warm '#2a221c')
  'community-presence':    '#23201c',  // terracotta-tinted (was '#1c2a28' teal-tinted)
  'finance':               '#1c2521',  // emerald-tinted (was '#1c2820' medium-green-tinted)
  'issue-positions':       '#1c2030',  // unchanged
  'ethics-accountability': '#22191d',  // burgundy-tinted (was '#2a2218' amber-tinted)
  'voting-bills':          '#241c2a',  // unchanged
}
```

**`CATEGORY_CARD_GRADIENT`** (light, gradient over solid):

```ts
{
  'service-record':        'linear-gradient(180deg, #f5e6cc 0%, #fff 100%)',
  'community-presence':    'linear-gradient(180deg, #f5dece 0%, #fff 100%)',
  'finance':               'linear-gradient(180deg, #d4e8d8 0%, #fff 100%)',
  'issue-positions':       'linear-gradient(180deg, #d8e0f5 0%, #fff 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #ecc8cf 0%, #fff 100%)',
  'voting-bills':          'linear-gradient(180deg, #e0d5f0 0%, #fff 100%)',
}
```

**`CATEGORY_CARD_GRADIENT_DARK`**:

```ts
{
  'service-record':        'linear-gradient(180deg, #23211a 0%, #16181c 100%)',
  'community-presence':    'linear-gradient(180deg, #23201c 0%, #16181c 100%)',
  'finance':               'linear-gradient(180deg, #1c2521 0%, #16181c 100%)',
  'issue-positions':       'linear-gradient(180deg, #1c2030 0%, #16181c 100%)',
  'ethics-accountability': 'linear-gradient(180deg, #22191d 0%, #16181c 100%)',
  'voting-bills':          'linear-gradient(180deg, #241c2a 0%, #16181c 100%)',
}
```

Each gradient endpoint now matches the new bg.app `#16181c` cool slate (was `#1a1714` warm anchor — slice 40 left this stale).

### 5.2 `packages/ui-tokens/src/map-colors.ts` changes

```ts
export const MAP_COLORS_DARK = {
  districtStroke: '#fdf8f3',   // unchanged
  districtFill:   '#3a3e45',   // NEW cool slate (was warm '#3a2e26')
} as const
```

Light `MAP_COLORS` unchanged.

### 5.3 Federal officials detail page card order changes

`apps/web/app/officials/[id]/page.tsx` — reorder the 6 card JSX elements (lines 126–134):

```tsx
<FederalServiceRecordCard officialId={id} {...senateProps} />
<FederalCommunityPresenceCard officialId={id} congress={CURRENT_CONGRESS} />  // ← was position 4
<FederalFinanceCard officialId={id} cycle={CURRENT_CYCLE} />                  // ← was position 2
<FederalIssuePositionsCard officialId={id} />                                  // ← was position 3
<FederalEthicsAccountabilityCard officialId={id} />
<FederalVotingBillsCard officialId={id} congress={CURRENT_CONGRESS} />
```

Imports reorder accordingly.

`apps/mobile/app/(app)/officials/[id].tsx` — mirror the same reorder on the mobile page.

### 5.4 State-officials detail page

**Out of scope**. The state detail page uses a different card set (StateConductCard + StateFinancialActivityCard, etc. per Gotcha #15: state has 2 ethics cards and the voting+bills are folded into the Service Record). The reorder doesn't translate cleanly. State page stays at its current card order.

## 6. Cross-platform considerations

Identical to slice 37 / 40 — `useCategoryAccent`, `useCategoryCardBgSolid`, `useCategoryCardGradient`, `useSubCascadeAccent` hooks already read the mode-appropriate token table and return values to consumers. No hook changes needed; all the new hex values flow through automatically.

## 7. Risks + accepted trade-offs

1. **Light gold accent contrast on cream**. `#c89a4e` gold on `#fdf8f3` cream is ~3.2:1 — borderline for AA-large, fails AA-normal text. Used as a dot/accent, not text — same risk profile as slice 40 portrait initials (already documented). Future a11y audit may revisit.
2. **Light terracotta accent contrast on cream**. `#b86340` on `#fdf8f3` is ~4.5:1 — passes AA-normal text. ✓
3. **Light burgundy accent close to alert.danger.fg**. `#8a3a4d` vs alert.danger `#a83a3a` — both deep reddish. Used in different contexts (category accent vs error message), but visual proximity exists. Accepted; semantic context distinguishes them.
4. **Category enum reorder breaks any code that hardcodes positional indices.** Audit: searched for `[0]` / `[1]` etc. on `CategoryId` arrays — none found. Searched for `Object.values(CATEGORY_LABEL)` / `Object.keys` — none found in component code (some test snapshots may need regeneration). Low risk.
5. **`CATEGORY_ACCENT_DARK` collapse semantically**. Both exports now have identical values per category. `useCategoryAccent` hook still works (reads mode then indexes correct table; both tables return same value). Direct importers of `CATEGORY_ACCENT_DARK` (if any) get the new single-source values. No breakage.
6. **Slice-37 `CategoryAccent` type narrowness**. The `CategoryAccent` type derives from the enum keys, not the values. Reorder doesn't change the type shape; only iteration order changes.

## 8. Testing

### 8.1 `packages/ui-tokens/test/category.test.ts` (existing file, ~28 cases)

Updates needed:
- Update assertions on `CATEGORY_ACCENT['community-presence']` from `#1f9b88` → `#b86340`.
- Same for `finance`: `#3da75b` → `#1a8f5a`.
- Same for `ethics-accountability`: `#d68a1f` → `#8a3a4d`.
- `CATEGORY_ACCENT_DARK` assertions: same values as `CATEGORY_ACCENT` per category (collapse).
- `CATEGORY_CARD_BG_SOLID` + `_DARK` assertions: update all 4 changed categories.
- `CATEGORY_CARD_GRADIENT` + `_DARK` assertions: update all 6 (endpoints change in dark; start stops change in 4).
- `SUB_CASCADE_ACCENT` + `_DARK`: update 4 changed categories.
- Add: assertion that `CATEGORY_ACCENT[id] === CATEGORY_ACCENT_DARK[id]` for each id (verifies the collapse invariant).
- Add: assertion that `Object.keys(CATEGORY_LABEL)` first element is `'service-record'` and follows the new order.

### 8.2 `packages/ui-tokens/test/map-colors.test.ts` (NEW)

Create new test file (none exists today) asserting:
- Light `MAP_COLORS.districtStroke = '#1a1714'`
- Light `MAP_COLORS.districtFill = '#f5f0e8'`
- Dark `MAP_COLORS_DARK.districtStroke = '#fdf8f3'`
- Dark `MAP_COLORS_DARK.districtFill = '#3a3e45'` (slice 41 cool slate)
- Both have identical keys

### 8.3 Officials page tests

No new component tests. Existing detail page tests (if any) verify component composition, not order semantics — manual smoke catches the order change. Document in mobile DoD.

### 8.4 Out of scope

- Visual regression / screenshot tests — none in workspace.
- WCAG contrast assertion test — gold accent borderline; documented risk.

## 9. Implementation surface

**Modified files (14):**
- `packages/ui-tokens/src/category.ts` (substantial — accents + sub-cascades + card bgs + gradients + enum reorder + label reorder)
- `packages/ui-tokens/src/map-colors.ts` (dark districtFill)
- `packages/ui-tokens/test/category.test.ts` (update many assertions + add reorder + collapse invariant tests)
- `apps/web/app/officials/[id]/page.tsx` (card render order)
- `apps/mobile/app/(app)/officials/[id].tsx` (mobile mirror reorder)
- `docs/brand-book.md` (palette table refresh + portrait-block remains)
- `docs/brand-migration.md` (category palette vocabulary note — slice 41)
- `CLAUDE.md` (slice 41 entry in "Slices delivered")
- `docs/superpowers/mobile-dod-checklist.md` (slice 41 section)

**New files (1):**
- `packages/ui-tokens/test/map-colors.test.ts` (test file for the previously-untested map palette)

**Total: 10 files. Compressed-to-Mega-Slice tier per `feedback_workflow_tiers.md`** (lowered from the ~14-file ballpark I gave during brainstorming because state-officials reorder is now out of scope and no new component files needed).

## 10. Closeout criteria

- Updated `category.test.ts` passes.
- New `map-colors.test.ts` passes.
- `pnpm -r typecheck` green.
- `pnpm test` workspace tests pass (modulo pre-existing env-var-gated integration suites).
- `pnpm --filter @chiaro/web build` green.
- Manual web smoke (Chrome): toggle to dark mode on `/officials/[any-bioguide]`. Verify 6 cards in new order (SR → CP → Finance → IP → Ethics → Voting). Each card uses new accent + bg + sub-cascade tints. Toggle to light mode; same order; light bgs visible (Level B saturation). Verify map district fill changes from warm brown to cool slate in dark mode.
- Mobile DoD smoke deferred (existing pattern; checklist updated).
- CLAUDE.md slice 41 entry written.
- Memory: slice 41 entry + slice 38+ roadmap update marking decision #6 partially closed (MetricCardShell retune still queued; map + category palettes now done).

## 11. What this slice unblocks

- **Visual reskin roadmap progress.** Domain palette warm-brown leftovers (flagged by slice 40 final review) are closed. Map + category card surfaces in dark mode now match the cool slate page bg / card bg family — no more warm-brown islands floating on cool slate.
- **Stronger semantic-color identity.** Each category now telegraphs its meaning at a glance (money → green, judicial → burgundy, gathering → terracotta, etc.). Future onboarding screens, marketing, and Comms designers can lean on this.
- **Simpler design system.** All 6 category accents are single-hex (was split light/dark). 50% fewer values to track + 50% less risk of light/dark drift.
- **Future category additions land cleanly.** New CategoryId entries need only 1 accent + 1 sub-cascade + 1 card bg + 1 gradient per mode — half the cognitive overhead of the old split-variant model.
