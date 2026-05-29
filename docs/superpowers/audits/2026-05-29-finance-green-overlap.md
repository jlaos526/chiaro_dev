# Finance green overlap audit

**Status:** Audit-tier (research). 2026-05-29. Branch: `slice-43-prep-finance-green-audit`.

**Question:** After slice 41 made `CATEGORY_ACCENT['finance']` emerald `#1a8f5a`, does `BRAND_SEMANTIC.signal.success` (`#3da75b` light / `#5dc97f` dark) still carry a distinct meaning, or has the slice 37 distinction collapsed into noise?

**Scope:** Reskin roadmap decision **#5 Finance "money in" green**. Audit-only — no code changes; ships findings + recommendation; slice 43 spec acts on the recommendation.

---

## 1. The three green tokens

Chiaro's `@chiaro/ui-tokens` package currently exports three distinct green stops:

| Token | Light | Dark | Slice origin | Conceptual intent |
|---|---|---|---|---|
| `BRAND_SEMANTIC.signal.success` | `#3da75b` | `#5dc97f` | 37 | "Finance money-in / positive signal" (per `palette.ts:38` comment) |
| `BRAND_SEMANTIC.alert.success.fg` | `#1f9b88` | `#4dbfb0` | 32 (teal) | General positive-status semaphore (success alerts, "dismissed" status, etc.) |
| `CATEGORY_ACCENT['finance']` | `#1a8f5a` | `#1a8f5a` | 41 (collapsed) | Finance card identity (gradient bg, accent dot on card header) |

Two of these three are visually similar emerald-greens (`signal.success` `#3da75b` and `CATEGORY_ACCENT.finance` `#1a8f5a`). The third (`alert.success` `#1f9b88`) is teal — visually distinct and out of scope for this audit.

## 2. Per-consumer mapping

### `signal.success` consumers (2 sites, both finance-specific)

| File | Line | Use |
|---|---|---|
| `packages/officials-ui/src/finance/FinanceSummaryStrip.tsx` | 31 | `dotColor` — small 5px round indicator next to "Total Raised, 2024" / "Small-donor %" / "PAC %" labels inside the finance summary card |
| `packages/officials-ui/src/finance/TopAmountBreakdown.tsx` | 86 | `backgroundColor` — horizontal progress-bar fill for ranked dollar amounts (top donors, top industries) inside the finance breakdown card |

**Zero non-finance consumers in `packages/`, `apps/web/`, or `apps/mobile/`.** The slice 37 "abstract positive money signal" framing turned out to have no callers outside finance components.

### `CATEGORY_ACCENT['finance']` consumers (slice 41 family — finance card identity)

- `CATEGORY_CARD_BG_SOLID['finance']` `#d4e8d8` (light) / `#1c2521` (dark) — finance card background
- `CATEGORY_CARD_GRADIENT['finance']` `linear-gradient(180deg, #d4e8d8 0%, #fff 100%)` (light) / `#1c2521 → #16181c` (dark) — finance card background on web
- `SUB_CASCADE_ACCENT['finance']` `#7eb898` (light) / `#4e8060` (dark) — nested expand panel accents inside finance card
- The 6-category dot on `CATEGORY_CARD_BG_SOLID`'s top-left "dot+label" header via `useCategoryAccent('finance')` (consumed by `MetricCardShell.tsx` and similar)

### `alert.success` consumers (6 sites, all NON-finance)

Listed for completeness — these are the "general positive status" use cases and stay teal:

| File | Use |
|---|---|
| `FederalSponsoredBillsList.tsx:11` | Passed bill status indicator |
| `FederalCosponsoredBillsList.tsx:11` | Passed bill status indicator |
| `StateOfficialEventsList.tsx:21` | `recall_failed` event indicator |
| `StateIssueVotesEvidence.tsx:69` | `yes` vote indicator |
| `StateEthicsComplaintsList.tsx:19` | `dismissed` / `closed_no_action` indicator |
| `FederalEthicsAccountabilityCard.tsx:25` | Compliance ≥90% indicator |

**No interaction with the green-on-green collision.** `alert.success` stays out of scope.

## 3. Visual collision analysis

On the finance card, both greens render simultaneously:

```
┌──────────────────────────────────────────────┐
│  (gradient: #d4e8d8 pale emerald → #fff)     │
│                                              │
│  •  TOTAL RAISED, 2024                       │
│     [#3da75b dot]                            │
│  $4.2M  $850K  41%                           │
│                                              │
│  ───────────  TOP INDUSTRIES  ──────────     │
│                                              │
│  Real Estate   $920K   ▓▓▓▓▓▓▓▓▓▓▓░░░  ←     │
│                       [#3da75b fill]         │
│                                              │
└──────────────────────────────────────────────┘
       ↑ card border + dot accent: #1a8f5a (CATEGORY_ACCENT.finance)
```

The card's identity color (emerald `#1a8f5a` used for the gradient family and category accent on the header dot) and the in-card signal color (medium green `#3da75b` used for the small dots and progress bar fills) are both green, only ~25 hue degrees apart, with similar saturation in the light mode.

**Practical effect:**
- The reader sees "this is a green finance card with smaller green things inside it."
- The 2 greens are not so close that they merge (saturation difference is real), but they are close enough that the choice reads as either (a) intentional gradient family or (b) designer indecision.
- No reader will think "the dot color is a separate semantic from the card color" — that abstraction is invisible visually.

## 4. Options

### Option A — Collapse `signal.success` to equal `CATEGORY_ACCENT.finance` (recommended)

```ts
// In packages/ui-tokens/src/brand/palette.ts (or via semantic.ts derivation):
signal: { success: '#1a8f5a' }  // light
signal: { success: '#1a8f5a' }  // dark (slice 41 collapse: single hex per category)
```

**Tradeoffs:**
- ✅ Zero semantic loss — `signal.success` had no non-finance consumers; the "abstract positive money signal" framing was theoretical
- ✅ Simplest token surface — one green concept for finance instead of two
- ✅ Visual coherence — the in-card dots and progress bars share identity with the card itself; reads as "this whole card is finance-green"
- ✅ Slice 41 pattern consistency — slice 41 collapsed `CATEGORY_ACCENT_DARK` to mirror light; same shape here
- ⚠️ If a future "positive money" use case emerges that's NOT inside a finance card, it would need to either consume `CATEGORY_ACCENT.finance` directly (semantic drift — it's a category identity, not a signal) OR use `alert.success` (teal, conceptually correct but visually unfamiliar)

### Option B — Re-tone `signal.success` to a visually distinct color (brand orange or gold)

Replace `signal.success` with `BRAND_SEMANTIC.accent.primary` `#c46a2a` (light) / `#374f68` (dark):

```ts
signal: { success: p.accent[500] }  // both modes
```

**Tradeoffs:**
- ✅ Strong contrast on finance cards — orange progress bar on pale-green gradient pops
- ✅ Brand-on-brand — uses the deep orange accent for positive money signal
- ⚠️ Loses the "money = green" universal intuition (cross-cultural across the project's target US audience)
- ⚠️ `BRAND_SEMANTIC.accent.primary` is currently overloaded — focus rings, primary CTAs, logo border, BioPortrait gradient (light mode) all use it. Adding "positive money signal" to that list compounds the overload
- ⚠️ Dark-mode `accent.primary` is slate-blue `#374f68` — slate-blue progress bars on dark finance cards reads as "blue is the highlight color," not "money in"
- ⚠️ Semantic muddling: `accent` means "brand identity," `signal.success` means "positive event" — collapsing them blurs both

### Option C — Re-tone `signal.success` to gold (slice 41 Service Record family)

Replace with `CATEGORY_ACCENT['service-record']` `#c89a4e`:

```ts
signal: { success: '#c89a4e' }  // both modes (slice 41 collapse pattern)
```

**Tradeoffs:**
- ✅ Warm contrast against pale-green gradient
- ✅ "Money = gold" is a universal intuition (gold coins, treasury)
- ⚠️ Gold is now used 3 ways: (1) Service Record category identity, (2) AlignmentChip Mixed bg (slice 42), (3) "positive money signal" — overloading risk
- ⚠️ Gold on pale-green gradient reads as autumn/harvest, not "money flowing in"
- ⚠️ Slice 42 just locked AlignmentChip Mixed gold as the "on-the-fence" pivot; using gold for "positive money" adds a second emotional reading

### Option D — Status quo (keep both greens distinct)

No change. `signal.success` stays `#3da75b`; `CATEGORY_ACCENT.finance` stays `#1a8f5a`.

**Tradeoffs:**
- ✅ Zero work; lowest risk
- ⚠️ Visual green-on-green continues
- ⚠️ Token surface keeps a distinction that has no behavioral consequence (the 2 greens are visually similar enough that no reader will perceive the abstract semantic separation)
- ⚠️ "Designer indecision" smell persists

### Option E — Deepen `signal.success` to a darker emerald (intentional 2-stop gradient)

Replace with a deeper emerald that READS as a darker variant of the category accent:

```ts
signal: { success: '#0f5c3a' }  // light — much darker, deeper than category
signal: { success: '#7eb898' }  // dark — uses slice 41 SUB_CASCADE_ACCENT.finance light value
```

**Tradeoffs:**
- ✅ Communicates "deeper green = more emphatic positive" within the finance card
- ✅ Preserves the slice 37 distinction by deepening rather than collapsing
- ⚠️ The visual gradient family (gradient bg `#d4e8d8` → category `#1a8f5a` → signal `#0f5c3a`) makes 3 emerald stops on one card — could feel monochromatic
- ⚠️ Marginal — at this point you might as well collapse (Option A) or differentiate (Option B/C)

## 5. Recommendation

**Option A — Collapse `signal.success` to equal `CATEGORY_ACCENT.finance` (`#1a8f5a`, both modes).**

Reasoning:
1. **Slice 37 evidence is in.** The "abstract positive money signal" framing had zero non-finance consumers across ~2 years and ~500 components. The abstraction never paid for itself.
2. **Slice 41 already made finance category green.** The semantic distinction (`signal.success` = "money flowing in" vs `CATEGORY_ACCENT.finance` = "this card is about finance") is invisible to readers because both render as green inside the same card.
3. **Operational simplification.** One green concept for finance instead of two. Future palette tweaks happen in one place.
4. **No reader-facing loss.** The collapse changes 2 pixel sites (a 5px dot in `FinanceSummaryStrip` and the progress-bar fill in `TopAmountBreakdown`) from `#3da75b` to `#1a8f5a` — both still emerald, slightly deeper.
5. **Pattern continuity with slice 41 and 42.** Slice 41 collapsed `CATEGORY_ACCENT_DARK` to mirror light; slice 42 collapsed `signal.success` and `link.fg` aren't categorically the same but the "delete distinctions that turned out not to matter" instinct is the same.
6. **Reversible.** If a future use case needs a distinct "positive money signal" green, re-introducing the token is a 1-line palette.ts change — but the audit's evidence says that use case hasn't emerged and probably won't.

**What this means in slice 43 (if user confirms):**
- Modify `BRAND_PALETTE.light.signal.success`: `#3da75b` → `#1a8f5a`
- Modify `BRAND_PALETTE.dark.signal.success`: `#5dc97f` → `#1a8f5a` (collapse to single hex per slice 41 pattern)
- Update test assertions in `brand-palette.test.ts`, `brand-semantic.test.ts`, `domain-palette-dark.test.ts` per Gotcha #29
- No consumer code changes (`FinanceSummaryStrip` + `TopAmountBreakdown` still read via the same hook → automatically pick up new values)
- Document the collapse in `brand-migration.md` slice 43 entry
- ~4-5 files. **Patch-to-Compressed-Slice tier.**

## 6. Open questions

1. **Do we want to preserve `signal.success` as an export name** (with value equal to `CATEGORY_ACCENT.finance`) for back-compat, or **rename the consumers to use `useCategoryAccent('finance')`** directly and delete `signal.success` entirely? The latter is cleaner long-term but adds ~2 file edits in `FinanceSummaryStrip` + `TopAmountBreakdown`.

2. **Dark mode collapse.** Slice 41 set `CATEGORY_ACCENT_DARK['finance'] = '#1a8f5a'` (single hex). If we collapse `signal.success` to mirror, the dark `signal.success` goes from `#5dc97f` (current bright) to `#1a8f5a` (deeper). Visually this means dark-mode finance card dots+bars get DARKER (less visible against the cool-slate card bg `#1c2521`). May warrant a slice-41-style "use a lighter variant in dark" exception — e.g. `signal.success.light = '#1a8f5a'` and `signal.success.dark = '#7eb898'` (the slice 41 sub-cascade light tint). Worth surfacing as a visual companion check before committing.

3. **Whether to re-tone or add `signal.warning` / `signal.danger`.** Currently `signal` namespace has only `success`. Should the audit recommend ADDING `signal.warning` / `signal.danger` for future state needs, or leave the namespace single-key minimal? **Recommendation: leave it.** YAGNI per CLAUDE.md.

## 7. Audit conclusions

- `signal.success` is functionally a finance-specific token despite its abstract name.
- Slice 41's emerald finance accent + the existing `signal.success` form a visible green-on-green pair on every finance card.
- The cleanest path is **Option A (collapse)**, with two open questions for the slice 43 brainstorm:
  - **Q1:** keep export name or rename consumers
  - **Q2:** preserve dark-mode lightness via a 2-stop variant or collapse to single hex
- Audit recommends slice 43 ships as **Patch or Compressed Slice (4-5 files)**, not a full reskin slice. The work is small but worth ceremony because it touches the brand palette (the foundational token surface).

## 8. Files in scope (slice 43 spec preview)

If user approves Option A:

1. `packages/ui-tokens/src/brand/palette.ts` — update `signal.success` hex in both light + dark (1-line each)
2. `packages/ui-tokens/test/brand-palette.test.ts` — update hex assertions
3. `packages/ui-tokens/test/brand-semantic.test.ts` — update hex assertions
4. `packages/ui-tokens/test/domain-palette-dark.test.ts` — check for any `signal.success` hex pin (slice 41 lesson)
5. `docs/brand-book.md` — note the collapse + cross-reference to `CATEGORY_ACCENT.finance`
6. `docs/brand-migration.md` — append slice 43 entry
7. `CLAUDE.md` — slice 43 entry in Slices delivered
8. Possibly: `packages/officials-ui/src/finance/*.tsx` (if user picks Q1 = rename consumers)
