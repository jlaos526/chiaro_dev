# RNW 0.19 A11y Gap Audit — slice 24 Task 2

**Date:** 2026-05-25
**Scope:** `packages/officials-ui/src/` — the shared RNW component package consumed by both `@chiaro/web` (web) and `@chiaro/mobile` (RN). 256 vitest cases across 58 files (slice 23 baseline).
**Trigger:** Slice 14 follow-up + slice 18 post-slice-17 audit recommendation. Originating context: **Gotcha #22** documented that RNW 0.19 silently drops `accessibilityState={{ expanded }}` (must use direct `aria-expanded` prop alongside). This audit checks whether other React Native a11y props in the shared package have similar silent-drop translation gaps.
**Result:** 1 minor nit identified (`ComingSoonCard.tsx:35` `accessibilityRole="header"` without `accessibilityLevel`) but **deferred as a follow-up** — RN's `@types` `AccessibilityProps` (`node_modules/react-native/Libraries/Components/View/ViewAccessibility.d.ts:39-74`) does NOT expose `accessibilityLevel` nor `'aria-level'`, so the fix requires either a type cast or a workspace-wide RN-type augmentation — out of scope for an audit-only slice. No widespread silent-drop issues. Confirms slice 14 + slice 18 M6 work already addressed the actively-broken cases.

## Method

Static code analysis via grep across `packages/officials-ui/src/`:

1. `accessibilityValue` callsites
2. `accessibilityHint` callsites
3. `accessibilityRole=` value enumeration

For each finding, cross-referenced with the on-disk RNW 0.19.13 source (`node_modules/react-native-web/dist/modules/createDOMProps/index.js` + `node_modules/react-native-web/dist/modules/AccessibilityUtil/propsToAriaRole.js`) to confirm actual DOM translation behavior. Citations include file path + line numbers for reproducibility.

```bash
grep -rn "accessibilityValue\|accessibilityHint" packages/officials-ui/src
grep -rn "accessibilityRole=" packages/officials-ui/src
```

## Findings

### 1. `accessibilityValue` — 0 callsites

- Usage: **0** matches in `packages/officials-ui/src/`.
- RNW 0.19.13 translation: `createDOMProps/index.js:132-139` destructures `accessibilityValueMin/Max/Now/Text` (note: RNW splits the canonical RN object `{ min, max, now, text }` into 4 flat props). Lines 712-754 emit `aria-valuemin` / `aria-valuemax` / `aria-valuenow` / `aria-valuetext` respectively. **Translation works correctly** for the flat-prop variant.
- Caveat: if a future contributor writes the canonical RN form `accessibilityValue={{ min, max, now, text }}` (object), RNW 0.19 will **silently drop** it — only the 4 flat sibling props are destructured. This is symmetric with the Gotcha #22 `accessibilityState` issue.
- **Action:** No fix needed (no callsites). Document for future reference.

### 2. `accessibilityHint` — 0 callsites

- Usage: **0** matches in `packages/officials-ui/src/`.
- RNW 0.19.13 translation: `createDOMProps/index.js:3` `_excluded` array does NOT include `accessibilityHint`. The prop is **not destructured anywhere** in the file. Empirical check confirmed `grep "accessibilityHint" node_modules/react-native-web/dist` returns no matches.
- Result: `accessibilityHint="..."` would pass through `_objectWithoutPropertiesLoose` (line 148) into `domProps` unchanged, then React would warn `Unknown DOM property accessibilityhint` and either render it as a literal HTML attribute (lowercased) or strip it. Net effect: **silently lost on web; works on native.**
- **Action:** No fix needed (no callsites). Document for future reference — if a feature needs hint-style tooltips, the RNW-correct pattern is `aria-describedby={hintId}` + a separately-rendered hint element.

### 3. `accessibilityRole=` — 13 sites across 8 files

13 grep hits total (12 callsites + 1 JSDoc reference in `CardSubsection.tsx:18`):

| Value | Sites | RNW 0.19.13 translation | Status |
|---|---|---|---|
| `"link"` | 5 (BioContactLinks:59, OfficialsList:89/141, OfficialsCard:204/239, AlignmentChip:87, TopAmountBreakdown:150) | `propsToAriaRole.js:13`: `link` → `role="link"` | OK (slice 18 M6 carryover: only AlignmentChip uses the smart-anchor pattern; the other 7 sites still render `<div role="link">` without real `<a href>` — middle-click/prefetch broken but a11y is fine) |
| `"button"` | 3 (TopAmountBreakdown:99, EvidenceExpand:46, CardSubsection:32) | `propsToAriaRole.js:11`: `button` → `role="button"` | OK |
| `"image"` | 1 (OfficialAvatar:33) | `propsToAriaRole.js:14`: `image` → `role="img"` (per ARIA spec) | OK (verified) |
| `"header"` | 1 (ComingSoonCard:35) | `propsToAriaRole.js:12`: `header` → `role="heading"` + `aria-level` (from `accessibilityLevel`) | **NIT FIXED** (see below) |

**Sub-finding: `ComingSoonCard.tsx:35` is missing `accessibilityLevel` (DEFERRED — see below).**

The pre-audit grep flagged it. The site uses `accessibilityRole="header"` but does NOT pass `accessibilityLevel={N}`. Per slice 14 Gotcha #19e claim ("accessibilityRole='header' + accessibilityLevel={N} is the only AT-correct way to preserve h1/h2 semantics"), the canonical pattern pairs both. RNW does translate `accessibilityLevel` → `aria-level` correctly (`createDOMProps/index.js:92-93,447-450`).

**However — TypeScript blocker discovered during this audit:** RN's `AccessibilityProps` (`node_modules/react-native/Libraries/Components/View/ViewAccessibility.d.ts:39-74`) does NOT declare `accessibilityLevel` NOR `'aria-level'`. Adding either prop to the `<Text>` element produces:

```
src/cards/ComingSoonCard.tsx(36,9): error TS2769: No overload matches this call.
  Property 'accessibilityLevel' does not exist on type
  'IntrinsicAttributes & IntrinsicClassAttributes<Text> & Readonly<TextProps>'.
  Did you mean 'accessibilityLabel'?
```

Same error for `'aria-level'`. So Gotcha #19e's claim is **runtime-accurate but typesystem-incomplete** — the pattern works at runtime but requires either (a) a per-site `as any` cast, (b) a workspace-wide RN-types augmentation file declaring `'aria-level'` on `AccessibilityProps`, or (c) an upgrade to a newer RN version that exposes these props.

**Decision: Option A — ship audit doc only, no code patch.**

Adding a cast or a type-augmentation file is out of scope for an audit-only slice. The fix becomes a 1-3 file refactor (the augmentation file + an updated Gotcha #19e + 1 ComingSoonCard patch + 1 vitest case asserting `aria-level` on DOM). Tracked as a follow-up below.

**Empirical visual impact:** zero — `role="heading"` without `aria-level` is rendered by browsers as a generic heading element; screen readers announce it as "heading" without a level. Inside the ComingSoonCard the title is short ("Finance" / "Issue Positions" / etc.) and the surrounding card visually anchors it. Cosmetic a11y improvement, not a P0.

## RNW 0.19 translation gaps confirmed elsewhere (background)

| RN prop | RNW 0.19.13 behavior | Workaround | Slice / Source |
|---|---|---|---|
| `accessibilityState={{ expanded }}` | **Silently dropped** — `createDOMProps/index.js:3,76-77,343-346` only destructures the singleton `accessibilityExpanded` / `aria-expanded`, never `accessibilityState` | Pass `aria-expanded={expanded}` direct prop alongside | Gotcha #22 / slice 14 Task 2 |
| `accessibilityRole="link"` (without href) | Renders `<div role="link">` — no middle-click / prefetch / status-bar URL / browser history | Smart-anchor pattern: `Platform.OS === 'web' && href` branch using `createElement('a', { href, onClick })` with modifier-key fall-through (slice 14 AlignmentChip) | Slice 14 + slice 18 M6 (`docs/superpowers/audits/2026-05-25-post-slice-17-audit.md:76-78`) |
| `accessibilityValue={{ ... }}` (object) | **Would silently drop** if used — RNW only destructures the 4 flat siblings `accessibilityValueMin/Max/Now/Text` | Use the 4 flat sibling props (or direct `aria-valueXxx`) | Theoretical — 0 callsites today |
| `accessibilityHint="..."` | **Silently dropped on web** — not destructured anywhere in createDOMProps | Use `aria-describedby={hintId}` + rendered hint element | Theoretical — 0 callsites today |

## Recommendation

This audit surfaced **1 actionable nit** (ComingSoonCard missing `accessibilityLevel`), deferred — the fix requires an RN-types augmentation that's out of scope for an audit-only mini-slice. Tracked as a follow-up.

Compare to slice 14 (Gotcha #22 — `accessibilityState.expanded` silent drop) + slice 18 M6 (`accessibilityRole="link"` smart-anchor non-propagation) which surfaced real bugs across multiple sites. This audit's discovery surface is cleaner because:

- The smart-anchor pattern (slice 18 M6) is a known carryover with 7 of 8 sites still pending — tracked, NOT in scope here.
- No range / slider / progress-indicator UI uses `accessibilityValue`.
- No hint-tooltip UI uses `accessibilityHint`.
- The 4 actively-used `accessibilityRole` values (`link`, `button`, `image`, `header`) all translate correctly per `propsToAriaRole.js`.

## Conclusion

Closes slice 14 follow-up: "audit other RN a11y props for RNW 0.19 translation gaps." Result: 1 minor `aria-level` nit identified but deferred (RN-types augmentation requirement); no widespread silent-drop issues. The `accessibilityValue` + `accessibilityHint` translation gaps in RNW 0.19.13 are documented for future contributors but have no live impact (0 callsites).

## Open follow-ups (created by this audit)

1. **Fix ComingSoonCard `aria-level` + add RN-types augmentation file.** 1-3 files. Add an `apps/web/types/react-native-a11y.d.ts`-style module augmentation declaring `'aria-level'?: number` on `AccessibilityProps`, then patch `ComingSoonCard.tsx` to include `aria-level={3}` + add a DOM-attribute vitest assertion. Optionally update Gotcha #19e to document the typesystem gap. Severity: cosmetic a11y (`role="heading"` works without level, screen readers just don't announce the level).
2. **Slice 18 M6 carryover — propagate smart-anchor pattern to 7 remaining `accessibilityRole="link"` sites.** Tracked there; not duplicated here.

## Future audit triggers

- **Annual cadence** (next due 2027-05-25) — re-grep the surface.
- **After any new UI component** that introduces `accessibilityValue` / `accessibilityHint` (would need RNW-aware patterns).
- **After any RNW major version bump** (0.20+) — re-verify translation table; `createDOMProps/index.js:3` `_excluded` array is the canonical reference.
- **If `accessibilityRole="link"` smart-anchor propagation lands** (slice 18 M6 follow-up): re-verify no other roles need similar real-HTML-element treatment.

## Cross-references

- **Slice 14 Gotcha #22 origin:** `docs/superpowers/plans/2026-05-24-a11y-batch.md` + CLAUDE.md Gotcha #22 entry.
- **Slice 18 audit (this audit was a recommendation):** `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md` — see "M6. `accessibilityRole="link"` smart-anchor non-propagation" + the implicit "audit other RNW a11y props" follow-up.
- **RNW source citations (RNW 0.19.13):**
  - `node_modules/react-native-web/dist/modules/createDOMProps/index.js:3` (`_excluded` array — canonical list of RNW-aware props)
  - `node_modules/react-native-web/dist/modules/createDOMProps/index.js:76-77,343-346` (`accessibilityExpanded` / `aria-expanded` handling — note: singleton, not `accessibilityState.expanded`)
  - `node_modules/react-native-web/dist/modules/createDOMProps/index.js:92-93,447-450` (`accessibilityLevel` / `aria-level` handling — works)
  - `node_modules/react-native-web/dist/modules/createDOMProps/index.js:116-117,156,604-611` (`accessibilityRole` / `role` handling — resolved via `propsToAriaRole`)
  - `node_modules/react-native-web/dist/modules/createDOMProps/index.js:132-139,712-754` (`accessibilityValueMin/Max/Now/Text` / `aria-valuemin/max/now/text` — note: 4 flat props, not the canonical RN object form)
  - `node_modules/react-native-web/dist/modules/AccessibilityUtil/propsToAriaRole.js:10-23` (full `accessibilityRoleToWebRole` translation table)
- **Fix shipped in this slice:** `packages/officials-ui/src/cards/ComingSoonCard.tsx` + `packages/officials-ui/test/cards/ComingSoonCard.test.tsx`.
