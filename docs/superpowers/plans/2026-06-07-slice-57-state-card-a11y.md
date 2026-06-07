# Slice 57 — State-card correctness + detail-page a11y Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit track T2 — fix the state-card NULL/loading correctness bugs, guard evidence-row URLs, add `aria-expanded` to evidence toggles, build an h1/h2/h3 heading hierarchy across the detail page, and label the radar chart axes — all in `@chiaro/officials-ui`.

**Architecture:** Per-finding tasks, each a focused commit. Mirror the established federal patterns (loading guard, null-aware `allEmpty`, `url ? Pressable : View`, Gotcha #22 `aria-expanded`). Heading props are additive (`accessibilityRole="header"` + `accessibilityLevel={N}` → RNW `<div role="heading" aria-level="N">`). No schema, no visual restyle.

**Tech Stack:** react-native-web, react-native-svg, vitest + jsdom, TanStack Query (mocked in tests).

**Branch:** `slice-57-state-card-a11y` (spec `86e2865` already committed).

**Conventions (all established):**
- Sequential implementer dispatch only — never parallel `git add`/`commit` (Gotcha #25).
- Assert the **DOM attribute** for ARIA (`element.getAttribute('aria-expanded')`, `role`, `aria-level`), not the RN prop (Gotcha #22). RNW does not translate `accessibilityState` → `aria-expanded`; pass the **direct `aria-expanded`** prop too.
- After editing any web-rendered component, the officials-ui vitest suite is the gate; also run `pnpm --filter @chiaro/web test` if a web page changes (none here, but the build must stay green).
- Local Supabase not required (these are pure render tests). Run `pnpm --filter @chiaro/officials-ui test`.

---

## File map

| File | Change | Task |
|---|---|---|
| `src/state/StateServiceRecordCard.tsx` | B3 fmtCount on top rows + B4 loading guard + h2/h3 headings | 1, 8, 9 |
| `src/state/StateFinanceCard.tsx` | B5 loading guard + h2 heading | 2, 8 |
| `src/state/StateConductCard.tsx` | B9 null-aware allEmpty + h2 | 3, 8 |
| `src/state/StateCommunityPresenceCard.tsx` | B9 null-aware allEmpty + h2 | 3, 8 |
| `src/state/StateBillsEvidence.tsx` | B6 url-guard + C2 aria-expanded | 4 |
| `src/state/StateVotesEvidence.tsx` | B6 url-guard + C2 aria-expanded | 4 |
| `src/state/StateOfficialEventsList.tsx` | B6 url-guard | 5 |
| `src/state/StateTownHallsList.tsx` | B6 url-guard | 5 |
| `src/state/StateDonorsEvidence.tsx` | C2 aria-expanded | 6 |
| `src/state/StateIssuePositionsCard.tsx` | C2 aria-expanded + h2 | 6, 8 |
| `src/bio/BioHeader.tsx` | h1 on official name | 7 |
| 6 federal `*Card.tsx` + 6 state `*Card.tsx` | h2 card titles | 8 |
| `src/issues/IssueRadarChart.tsx` | C3 axis labels + accessibilityLabel | 10 |
| `test/stubs/react-native-svg.tsx` | add `Text`→`<text>` for C3 tests | 10 |
| `CLAUDE.md`, audit doc | closeout | 11 |

---

### Task 1: B3 + B4 — `StateServiceRecordCard` NULL handling + loading guard

**Files:**
- Modify: `packages/officials-ui/src/state/StateServiceRecordCard.tsx`
- Test: `packages/officials-ui/test/state/StateServiceRecordCard.test.tsx`

Context: `:91-94` render `m?.bills_sponsored_count ?? 0` (4 rows). `fmtCount` (`:28`) already returns `'—'` for null. The card has no `isLoading` guard, so it paints zeros while `metrics`/`sponsored`/`votes` load. Mirror `FederalServiceRecordCard.tsx:40-47`.

- [ ] **Step 1: Read the existing test** `test/state/StateServiceRecordCard.test.tsx` to see what it currently asserts (it likely pins the `?? 0` behavior). Note assertions that need updating (slice-56 lesson: a test can lock in the bug).

- [ ] **Step 2: Write/Update failing tests.** Add these cases (adapt to the file's existing mock harness — it uses `vi.mock` on `@chiaro/officials` + `@chiaro/state-bills`; reuse its `mockMetrics`/`mockSponsored`/`mockVotes` setters):

```tsx
it('renders "—" not "0" for NULL top-row metrics (B3)', () => {
  setMetrics({ data: { bills_sponsored_count: null, bills_cosponsored_count: null,
    votes_voted_count: null, votes_missed_count: null } as never, isLoading: false })
  setSponsored({ data: [], isLoading: false }); setVotes({ data: [], isLoading: false })
  render(<StateServiceRecordCard official={STATE_OFFICIAL} />)
  expect(screen.getByText('Bills sponsored').parentElement?.textContent).toContain('—')
  expect(screen.queryByText('0')).toBeNull()
})

it('shows a loading branch while queries are in flight (B4)', () => {
  setMetrics({ data: undefined, isLoading: true })
  setSponsored({ data: undefined, isLoading: true }); setVotes({ data: undefined, isLoading: true })
  render(<StateServiceRecordCard official={STATE_OFFICIAL} />)
  expect(screen.getByText(/loading service record/i)).toBeTruthy()
  expect(screen.queryByText('Bills sponsored')).toBeNull()
})
```

- [ ] **Step 3: Run the tests — verify they FAIL.** Run: `pnpm --filter @chiaro/officials-ui test StateServiceRecordCard`. Expected: the B3 test fails (renders "0"), the B4 test fails (renders rows, no loading text).

- [ ] **Step 4: Implement.** In `StateServiceRecordCard.tsx`:

(a) Add the loading guard after the `isStateLevel` gate (`:54`), before `const m = metrics.data`:
```tsx
  if (!isStateLevel(official.chamber)) return null

  if (metrics.isLoading || sponsored.isLoading || votes.isLoading) {
    return (
      <View
        testID="state-service-record-card"
        style={[styles.card, { backgroundColor: semantic.bg.app, borderColor: semantic.border.default }]}
      >
        <Text style={[styles.title, { color: semantic.text.primary }]}>Service Record</Text>
        <Text style={[styles.subtitle, { color: semantic.text.muted, marginTop: 8 }]}>Loading service record…</Text>
      </View>
    )
  }
```

(b) Wrap the four top rows (`:91-94`) in `fmtCount`:
```tsx
        <ScalarRow label="Bills sponsored" value={fmtCount(m?.bills_sponsored_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Bills cosponsored" value={fmtCount(m?.bills_cosponsored_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Votes voted" value={fmtCount(m?.votes_voted_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Votes missed" value={fmtCount(m?.votes_missed_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
```

- [ ] **Step 5: Run the tests — verify PASS** (and the full StateServiceRecordCard file is green). Run: `pnpm --filter @chiaro/officials-ui test StateServiceRecordCard`.

- [ ] **Step 6: Commit.**
```bash
git add packages/officials-ui/src/state/StateServiceRecordCard.tsx packages/officials-ui/test/state/StateServiceRecordCard.test.tsx
git commit -m "fix(slice-57): StateServiceRecordCard NULL->— + loading guard (B3,B4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: B5 — `StateFinanceCard` loading guard

**Files:**
- Modify: `packages/officials-ui/src/state/StateFinanceCard.tsx`
- Test: `packages/officials-ui/test/state/StateFinanceCard.test.tsx` (create if absent)

Context: `:61-62` does `const summary = summaryQ.data; if (!summary) return <empty card>`. No loading check → it flashes "No state finance data yet" during load.

- [ ] **Step 1: Write the failing test** (match the file's mock harness for `useOfficialStateFinanceSummary`/`useOfficialStateDonors`):
```tsx
it('shows a loading branch while the summary query is in flight (B5)', () => {
  setSummary({ data: undefined, isLoading: true }); setDonors({ data: undefined, isLoading: true })
  render(<StateFinanceCard official={STATE_OFFICIAL} />)
  expect(screen.getByText(/loading finance/i)).toBeTruthy()
  expect(screen.queryByText(/no state finance data yet/i)).toBeNull()
})
```

- [ ] **Step 2: Run — verify FAIL.** Run: `pnpm --filter @chiaro/officials-ui test StateFinanceCard`. Expected: renders the empty-state copy during load.

- [ ] **Step 3: Implement.** Insert the loading guard immediately before `const summary = summaryQ.data` (`:61`):
```tsx
  if (summaryQ.isLoading) {
    return (
      <View style={[styles.card, cardColors]}>
        <Text style={[styles.title, titleColor]}>Finance</Text>
        <Text style={[styles.emptyMuted, mutedColor]}>Loading finance…</Text>
      </View>
    )
  }

  const summary = summaryQ.data
```

- [ ] **Step 4: Run — verify PASS.** Run: `pnpm --filter @chiaro/officials-ui test StateFinanceCard`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/state/StateFinanceCard.tsx packages/officials-ui/test/state/StateFinanceCard.test.tsx
git commit -m "fix(slice-57): StateFinanceCard loading guard (B5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: B9 — null-aware `allEmpty` in `StateConductCard` + `StateCommunityPresenceCard`

**Files:**
- Modify: `packages/officials-ui/src/state/StateConductCard.tsx` (`:52`)
- Modify: `packages/officials-ui/src/state/StateCommunityPresenceCard.tsx` (`:57`)
- Test: the respective test files (create if absent)

Context: `allEmpty = complaintCount === 0 && eventCount === 0` is `false` when a count is `null` (not-ingested) → renders a "—"-filled populated card instead of the empty state. NULL and 0 should both route to the existing empty state.

- [ ] **Step 1: Write failing tests** (one per card; match each file's mock harness):
```tsx
// StateConductCard.test.tsx
it('shows the empty state when all counts are NULL (B9)', () => {
  setComplaints({ data: undefined, isLoading: false }); setEvents({ data: undefined, isLoading: false })
  render(<StateConductCard official={STATE_OFFICIAL} />)
  expect(screen.getByText(/no conduct/i)).toBeTruthy() // match the card's actual empty-state copy
})
```
(Analogous test for `StateCommunityPresenceCard` with all three of halls/offices/hearings NULL → its empty-state copy.)

- [ ] **Step 2: Run — verify FAIL** (renders the populated card). Run: `pnpm --filter @chiaro/officials-ui test "StateConductCard|StateCommunityPresenceCard"`.

- [ ] **Step 3: Implement.**
- `StateConductCard.tsx:52`:
```tsx
  const allEmpty = (complaintCount ?? 0) === 0 && (eventCount ?? 0) === 0
```
- `StateCommunityPresenceCard.tsx:57`:
```tsx
  const allEmpty = (hallCount ?? 0) === 0 && (officeCount ?? 0) === 0 && (hearingCount ?? 0) === 0
```

- [ ] **Step 4: Run — verify PASS.** Run: `pnpm --filter @chiaro/officials-ui test "StateConductCard|StateCommunityPresenceCard"`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/state/StateConductCard.tsx packages/officials-ui/src/state/StateCommunityPresenceCard.tsx packages/officials-ui/test/state/StateConductCard.test.tsx packages/officials-ui/test/state/StateCommunityPresenceCard.test.tsx
git commit -m "fix(slice-57): null-aware allEmpty in StateConduct + StateCommunityPresence (B9)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: B6 + C2 — `StateBillsEvidence` + `StateVotesEvidence` (url-guard + aria-expanded)

**Files:**
- Modify: `packages/officials-ui/src/state/StateBillsEvidence.tsx`, `packages/officials-ui/src/state/StateVotesEvidence.tsx`
- Test: respective test files

Context: each renders rows as `<Pressable onPress={() => Linking.openURL(x.source_url).catch(...)}>` (unguarded — B6) and a show-more `<Pressable onPress={() => setExpanded(...)}>` with no expanded signal (C2). Federal guard pattern: `FederalSponsoredBillsList.tsx:30-35`.

- [ ] **Step 1: Write failing tests** (per file):
```tsx
import { Linking } from 'react-native'
// Robust B6 assertion: spy on openURL (works regardless of DOM structure — RNW
// renders both Pressable and View as <div>, so a role/structure check is flaky).
// If FederalSponsoredBillsList.test.tsx already has an established assertion for
// this guard, reuse that approach instead.
it('does not call openURL for a row with null source_url, does for a valid one (B6)', () => {
  const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true as never)
  render(<StateBillsEvidence bills={[{ ...BILL, source_url: null }]} />)
  fireEvent.click(screen.getByText(BILL.title))            // null url → guarded View, no handler
  expect(spy).not.toHaveBeenCalled()
  spy.mockClear()
  render(<StateBillsEvidence bills={[{ ...BILL, id: 'b2', source_url: 'https://x' }]} />)
  fireEvent.click(screen.getAllByText(BILL.title).at(-1)!)  // valid url → Pressable fires openURL
  expect(spy).toHaveBeenCalledWith('https://x')
})

it('show-more toggle exposes aria-expanded (C2)', () => {
  render(<StateBillsEvidence bills={MANY_BILLS} />) // > INITIAL_ROW_COUNT
  const toggle = screen.getByText(/show more/i).closest('[aria-expanded]') as HTMLElement
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
})
```

- [ ] **Step 2: Run — verify FAIL.** Run: `pnpm --filter @chiaro/officials-ui test "StateBillsEvidence|StateVotesEvidence"`.

- [ ] **Step 3: Implement (both files).**
(a) B6 — replace the unconditional row Pressable with the guard. For `StateBillsEvidence` (adapt field names per file; votes uses `v.source_url`):
```tsx
        const url = b.source_url ?? null
        const Row = url ? Pressable : View
        return (
          <Row
            key={b.id /* or existing key */}
            {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}
            style={rowStyle}
          >
            {/* ...existing row content unchanged... */}
          </Row>
        )
```
(Ensure `View` is imported — it already is.)

(b) C2 — the show-more toggle:
```tsx
        <Pressable
          onPress={() => setExpanded(e => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          style={moreButtonStyle}
        >
```

- [ ] **Step 4: Run — verify PASS.** Run: `pnpm --filter @chiaro/officials-ui test "StateBillsEvidence|StateVotesEvidence"`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/state/StateBillsEvidence.tsx packages/officials-ui/src/state/StateVotesEvidence.tsx packages/officials-ui/test/state/StateBillsEvidence.test.tsx packages/officials-ui/test/state/StateVotesEvidence.test.tsx
git commit -m "fix(slice-57): StateBills/Votes evidence url-guard + aria-expanded (B6,C2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: B6 — url-guard in `StateOfficialEventsList` + `StateTownHallsList`

**Files:**
- Modify: `packages/officials-ui/src/state/StateOfficialEventsList.tsx`, `packages/officials-ui/src/state/StateTownHallsList.tsx`
- Test: respective test files

Context: both press straight into `Linking.openURL(row.source_url)`. Apply the same `url ? Pressable : View` guard as Task 4(a). These lists have no show-more toggle (no C2).

- [ ] **Step 1: Write failing test** (per file) — the "non-pressable row when source_url is null" test from Task 4 Step 1, adapted to each component's props/field.

- [ ] **Step 2: Run — verify FAIL.** Run: `pnpm --filter @chiaro/officials-ui test "StateOfficialEventsList|StateTownHallsList"`.

- [ ] **Step 3: Implement** the `const url = row.source_url ?? null; const Row = url ? Pressable : View; <Row {...(url ? { onPress } : {})}>` guard in each (read each file first to match the exact row variable + key + style).

- [ ] **Step 4: Run — verify PASS.**

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/state/StateOfficialEventsList.tsx packages/officials-ui/src/state/StateTownHallsList.tsx packages/officials-ui/test/state/StateOfficialEventsList.test.tsx packages/officials-ui/test/state/StateTownHallsList.test.tsx
git commit -m "fix(slice-57): url-guard StateOfficialEventsList + StateTownHallsList (B6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: C2 — aria-expanded in `StateDonorsEvidence` + `StateIssuePositionsCard`

**Files:**
- Modify: `packages/officials-ui/src/state/StateDonorsEvidence.tsx`, `packages/officials-ui/src/state/StateIssuePositionsCard.tsx`
- Test: respective test files

Context: both have a show-more / expand `<Pressable onPress={() => setExpanded(...)}>` (or a Set-based expand in StateIssuePositionsCard) lacking `aria-expanded`. Read each first — `StateIssuePositionsCard` may toggle a per-row `expanded` Set, so apply `aria-expanded` to each row's expand control with that row's boolean.

- [ ] **Step 1: Write failing test** (per file) — the aria-expanded toggle test from Task 4 Step 1, adapted.

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement** — add `accessibilityRole="button"` + `accessibilityState={{ expanded }}` + `aria-expanded={expanded}` to each toggle (for StateIssuePositionsCard's per-row Set, use `aria-expanded={openSet.has(key)}`).

- [ ] **Step 4: Run — verify PASS.**

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/state/StateDonorsEvidence.tsx packages/officials-ui/src/state/StateIssuePositionsCard.tsx packages/officials-ui/test/state/StateDonorsEvidence.test.tsx packages/officials-ui/test/state/StateIssuePositionsCard.test.tsx
git commit -m "fix(slice-57): aria-expanded on StateDonors + StateIssuePositions toggles (C2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: C1 h1 — official name in `BioHeader`

**Files:**
- Modify: `packages/officials-ui/src/bio/BioHeader.tsx` (`:39`)
- Test: `packages/officials-ui/test/bio/BioHeader.test.tsx`

Context: `:39` `<Text style={{ fontSize: 24, … }}>{p.fullName}</Text>` is a plain Text. Make it `<h1>`-equivalent. This is the page's top heading (closes C4).

- [ ] **Step 1: Write the failing test:**
```tsx
it('renders the official name as an h1-equivalent heading (C1/C4)', () => {
  render(<BioHeader {...BIO_PROPS} />)
  const name = screen.getByText(BIO_PROPS.fullName)
  expect(name.getAttribute('role')).toBe('heading')
  expect(name.getAttribute('aria-level')).toBe('1')
})
```

- [ ] **Step 2: Run — verify FAIL.** Run: `pnpm --filter @chiaro/officials-ui test BioHeader`.

- [ ] **Step 3: Implement** — add the two props to the name Text (`:39`):
```tsx
      <Text accessibilityRole="header" accessibilityLevel={1} style={{ fontSize: 24, fontWeight: '700', color: semantic.text.primary }}>{p.fullName}</Text>
```

- [ ] **Step 4: Run — verify PASS.**

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/bio/BioHeader.tsx packages/officials-ui/test/bio/BioHeader.test.tsx
git commit -m "feat(slice-57): BioHeader official name as h1 (C1/C4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: C1 h2 — all 12 card titles become headings

**Files (modify the title `<Text>` in each):**
- Federal: `FederalServiceRecordCard.tsx` (`titleStyle` var → applied at the 3 `<Text style={titleStyle}>` sites: loading/empty/populated), `FederalFinanceCard.tsx` (`:44,:59,:78`), `FederalVotingBillsCard.tsx` (`:52,:74,:91`), `FederalIssuePositionsCard.tsx` (`:51,:66,:83`), `FederalEthicsAccountabilityCard.tsx` (title `<Text>` sites), `FederalCommunityPresenceCard.tsx` (title `<Text>` sites).
- State: `StateServiceRecordCard.tsx` (`:74` + the Task-1 loading-branch title), `StateFinanceCard.tsx` (`:65,:79` + the Task-2 loading-branch title), `StateIssuePositionsCard.tsx`, `StateFinancialActivityCard.tsx`, `StateConductCard.tsx`, `StateCommunityPresenceCard.tsx`.
- Test: a new shared spec `packages/officials-ui/test/a11y/card-headings.test.tsx` plus per-card assertions where a card test already exists.

The edit is uniform: every card-title `<Text>` (the one styled with `styles.title`) gets `accessibilityRole="header" accessibilityLevel={2}`. For cards using a `titleStyle` variable, add the props to each `<Text style={titleStyle}>…</Text>` element (not the variable). **Every render branch** (loading/empty/populated + the Task 1/2 loading branches added earlier) must carry the props.

- [ ] **Step 1: Write the failing test** `test/a11y/card-headings.test.tsx` — render each card (reusing each card's mock harness via lightweight per-card describe blocks, or a representative subset: `FederalServiceRecordCard`, `StateServiceRecordCard`, `StateFinanceCard`, `StateConductCard`) and assert the title element has `role="heading"` + `aria-level="2"`. Minimum: one assertion per distinct card title string. Example:
```tsx
it('Service Record card title is an h2 heading', () => {
  render(<StateServiceRecordCard official={STATE_OFFICIAL} />)
  const title = screen.getByText('Service Record')
  expect(title.getAttribute('role')).toBe('heading')
  expect(title.getAttribute('aria-level')).toBe('2')
})
```

- [ ] **Step 2: Run — verify FAIL.** Run: `pnpm --filter @chiaro/officials-ui test card-headings`.

- [ ] **Step 3: Implement** — add `accessibilityRole="header" accessibilityLevel={2}` to every card-title `<Text>`. Read each card file, locate every `<Text style={[styles.title…]}>` (and `<Text style={titleStyle}>`), add the two props. Confirm the count: 6 federal + 6 state cards; FederalFinance/IssuePositions/VotingBills + StateFinance have multiple branch copies + the Task 1/2 loading branches.

- [ ] **Step 4: Run — verify PASS** (card-headings test + the full suite, to confirm no existing card test broke — adding `role=heading` does not change `getByText`/textContent assertions, but verify). Run: `pnpm --filter @chiaro/officials-ui test`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/federal/*Card.tsx packages/officials-ui/src/state/*Card.tsx packages/officials-ui/test/a11y/card-headings.test.tsx
git commit -m "feat(slice-57): card titles become h2 headings across federal+state (C1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: C1 h3 — static in-card sub-section headings

**Files:**
- Modify: `packages/officials-ui/src/state/StateServiceRecordCard.tsx` (`:99` "Performance metrics", `:117` + `:124` evidence headings) + any other static sub-heading Texts found.
- Test: extend `test/state/StateServiceRecordCard.test.tsx`

- [ ] **Step 1: Grep for the full h3 set.** Run: `grep -rn "styles.subheading\|styles.evidenceHeading\|styles.sectionTitle\|styles.subTitle\|styles.sectionLabel" packages/officials-ui/src/federal packages/officials-ui/src/state`. Apply h3 to each STATIC (non-interactive, not inside a Pressable) sub-heading Text. (Confirmed: StateServiceRecordCard's 3. Add any others surfaced.)

- [ ] **Step 2: Write the failing test:**
```tsx
it('renders static sub-section headings as h3 (C1)', () => {
  setMetrics({ data: {} as never, isLoading: false }); setSponsored({ data: [], isLoading: false }); setVotes({ data: [], isLoading: false })
  render(<StateServiceRecordCard official={STATE_OFFICIAL} />)
  const perf = screen.getByText('Performance metrics')
  expect(perf.getAttribute('role')).toBe('heading')
  expect(perf.getAttribute('aria-level')).toBe('3')
})
```

- [ ] **Step 3: Run — verify FAIL.**

- [ ] **Step 4: Implement** — add `accessibilityRole="header" accessibilityLevel={3}` to each static sub-heading Text (StateServiceRecordCard `:99`, `:117`, `:124`, + any from Step 1). Do NOT touch interactive `CardSubsection` toggle labels.

- [ ] **Step 5: Run — verify PASS.** Run: `pnpm --filter @chiaro/officials-ui test StateServiceRecordCard`.

- [ ] **Step 6: Commit.**
```bash
git add packages/officials-ui/src/state/StateServiceRecordCard.tsx packages/officials-ui/test/state/StateServiceRecordCard.test.tsx
git commit -m "feat(slice-57): static sub-section headings become h3 (C1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: C3 — radar axis labels + accessibilityLabel

**Files:**
- Modify: `packages/officials-ui/test/stubs/react-native-svg.tsx` (add `Text`)
- Modify: `packages/officials-ui/src/issues/IssueRadarChart.tsx`
- Test: `packages/officials-ui/test/issues/IssueRadarChart.test.tsx`

Context: `IssueRadarChart` discards axis labels (`:53` `axes.map((_, i) …)`) and uses a generic container `accessibilityLabel` (`:50`). The svg stub renders no `<text>`. `userValues: number[]` (0–1) is the value vector.

- [ ] **Step 1: Extend the svg stub** `test/stubs/react-native-svg.tsx` — add to `BaseProps`: `x?: number|string; y?: number|string; fontSize?: number|string; textAnchor?: string; fill?: string` (fill exists). Add a `Text` component + export it:
```tsx
function Text({ x, y, fill, fontSize, textAnchor, children }: BaseProps & { children?: ReactNode }): React.JSX.Element {
  return createElement('text', { x, y, fill, fontSize, textAnchor }, children)
}
```
Add `Text` to the `export { … }` list. (This stub is aliased by BOTH the officials-ui and apps/web vitest configs — Gotcha #19g — so apps/web tests get it too.)

- [ ] **Step 2: Write the failing test** (extend `IssueRadarChart.test.tsx`):
```tsx
it('renders each axis label and lists values in the accessibilityLabel (C3)', () => {
  const axes = ['Environment', 'Economy', 'Health']
  const { container } = render(<IssueRadarChart axes={axes} userValues={[0.9, 0.4, 0.6]} />)
  for (const a of axes) expect(screen.getByText(a)).toBeTruthy()
  const root = container.querySelector('[aria-label]') as HTMLElement
  expect(root.getAttribute('aria-label')).toMatch(/Environment 90%/)
  expect(root.getAttribute('aria-label')).toMatch(/Economy 40%/)
})
```

- [ ] **Step 3: Run — verify FAIL.** Run: `pnpm --filter @chiaro/officials-ui test IssueRadarChart`.

- [ ] **Step 4: Implement** in `IssueRadarChart.tsx`:
(a) Import `Text as SvgText`: `import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg'`.
(b) Give labels room — change `const r = size / 2 - 18` to `const r = size / 2 - 28`.
(c) Compose the accessibilityLabel:
```tsx
  const axisSummary = axes.map((a, i) => `${a} ${Math.round((userValues[i] ?? 0) * 100)}%`).join(', ')
```
and set it on the View: `<View accessibilityLabel={\`Issue priorities radar: ${axisSummary}\`}>`.
(d) Render labels after the spokes `.map` (before/after the polygons is fine; place after spokes):
```tsx
        {axes.map((label, i) => {
          const p = radarPoint(i, n, 1.18, r, cx, cy)
          const anchor = p.x < cx - 1 ? 'end' : p.x > cx + 1 ? 'start' : 'middle'
          return (
            <SvgText key={`label-${i}`} x={p.x} y={p.y} fontSize={10} fill={c.grid} textAnchor={anchor}>
              {label}
            </SvgText>
          )
        })}
```
(Use `c.grid` or a muted radar color from `useRadarColors()`; if a dedicated label color exists in the radar token, prefer it. The exact `1.18` radius / anchor may be nudged so labels don't clip the `size×size` Svg — the test asserts presence, not pixels; keep `r = size/2 - 28` so there's room.)

- [ ] **Step 5: Run — verify PASS** (IssueRadarChart test + the radar-consuming tests: `IssueRadarResultScreen`, `IssueRadarOverlay`, `MyIssuesCard` — confirm the added labels/accessibilityLabel don't break their assertions). Run: `pnpm --filter @chiaro/officials-ui test "IssueRadar|MyIssuesCard"`.

- [ ] **Step 6: Commit.**
```bash
git add packages/officials-ui/src/issues/IssueRadarChart.tsx packages/officials-ui/test/stubs/react-native-svg.tsx packages/officials-ui/test/issues/IssueRadarChart.test.tsx
git commit -m "feat(slice-57): IssueRadarChart axis labels + accessibilityLabel (C3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Verify + closeout

**Files:**
- Modify: `CLAUDE.md` (slice-57 entry)
- Modify: `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` (mark T2 done)

- [ ] **Step 1: Full verification.**
Run, expecting green:
- `pnpm -r typecheck`
- `pnpm --filter @chiaro/officials-ui test` (record the new total — target ~647 → ~690)
- `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test`
- `pnpm --filter @chiaro/mobile test`
If any web/mobile render test referencing a touched component breaks (e.g. a snapshot now carrying `role="heading"`), update it.

- [ ] **Step 2: CLAUDE.md** — add the slice-57 entry after the slice-56 entry in "Slices delivered":
```markdown
- **Slice 57 — State-card correctness + detail-page a11y (audit T2)** (2026-06-07): Mega Slice (~25 files). Second audit-T-track remediation, all in `@chiaro/officials-ui`. **Correctness:** `StateServiceRecordCard` NULL metrics render "—" not a fabricated "0" (B3, via the existing `fmtCount`) + an isLoading guard (B4); `StateFinanceCard` isLoading guard before its empty check (B5); `StateConductCard` + `StateCommunityPresenceCard` `allEmpty` made null-aware `(count ?? 0) === 0` so all-NULL reps show the empty state (B9). **Evidence:** 4 state lists (StateBills/Votes/OfficialEvents/TownHalls) adopt the federal `url ? Pressable : View` null-`source_url` guard (B6); 4 show-more toggles (StateBills/Votes/Donors/IssuePositions) gain direct `aria-expanded` + `accessibilityState` (C2, Gotcha #22). **Heading hierarchy (C1+C4):** h1 = official name (BioHeader), h2 = all 12 federal+state card titles, h3 = static in-card sub-headings; interactive CardSubsection toggles stay buttons. **C3:** `IssueRadarChart` renders `<SvgText>` axis labels + composes per-axis values into the container `accessibilityLabel` (svg test stub extended with a `Text`→`<text>` export, shared by officials-ui + apps/web). No schema (pgTAP stays 490); officials-ui ~647 → ~690 tests.
```

- [ ] **Step 3: Mark audit T2 done** — in `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`, prepend `✅ SHIPPED (slice 57). ` to the T2 row's Note cell.

- [ ] **Step 4: Commit.**
```bash
git add CLAUDE.md docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md
git commit -m "docs(slice-57): CLAUDE.md slice entry + mark audit T2 done

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (controller, after all tasks)
- [ ] All 4 CI jobs green on the PR (db / build / functions / test). `build` + `test` exercise the officials-ui + web render changes.
- [ ] `git log --oneline master..HEAD` shows spec + plan + Tasks 1–11.
- [ ] PR title: "Slice 57 — State-card correctness + detail-page a11y (audit T2)". Squash-merge + delete branch; sync master.

## Notes
- **DRY/YAGNI:** props added inline (no `CardTitle`/`BrandHeading` refactor) per the approved design. No visual restyle (Gotcha #15 asymmetries preserved).
- **Slice-56 lesson:** every task greps/updates existing tests that assert the old behavior before implementing.
- **react-native-svg stub** is shared by officials-ui + apps/web vitest — extend it once (Task 10).
