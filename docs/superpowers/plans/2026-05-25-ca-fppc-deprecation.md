# Slice 21 — CA FPPC Form 700 deprecation implementation plan

> Patch-tier slice. ~4 files. 2 tasks executed inline.

**Goal:** Close out slice 12 audit's last PDF-bound candidate by deprecating ca-fppc stub + documenting Granicus DisclosureDocs migration. Pre-audit research confirmed bucket-B (SPA) — no parser to build.

---

## Task 1: Deprecate ca-fppc stub + audit doc + Gotcha #24

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/ca-fppc.ts` (add `@deprecated` JSDoc)
- Create: `docs/superpowers/audits/2026-05-25-ca-fppc-revalidation.md`
- Modify: `CLAUDE.md` (Gotcha #24)

- [ ] **Step 1: Add `@deprecated` JSDoc to ca-fppc.ts**

Add JSDoc block above the `caFppcDisclosures` export (full text in spec).

- [ ] **Step 2: Create audit doc**

`docs/superpowers/audits/2026-05-25-ca-fppc-revalidation.md` — captures the pre-audit research findings (URLs probed, bucket-B rationale, recommendation).

- [ ] **Step 3: Append Gotcha #24 to CLAUDE.md**

After Gotcha #23, add the Granicus DisclosureDocs migration pattern Gotcha (full text in spec).

- [ ] **Step 4: Verify**

```bash
pnpm --filter @chiaro/db typecheck                  # composite from slice 18
pnpm --filter @chiaro/db exec vitest run state-ethics/disclosures/ca-fppc    # 4 tests still pass
```

- [ ] **Step 5: Commit Task 1**

---

## Task 2: Closure — CLAUDE.md slice entry + memory + verify gate

**Files:**
- Modify: `CLAUDE.md` (slice 21 entry)
- Create (outside repo): memory file
- Modify (outside repo): MEMORY.md index

- [ ] **Step 1: Append slice 21 entry to CLAUDE.md `## Slices delivered`**

- [ ] **Step 2: Write memory file at `~/.claude/projects/.../memory/project_chiaro_slice21_ca_fppc_deprecation.md`** with `<squash SHA>` placeholder

- [ ] **Step 3: Update MEMORY.md index line after slice 20**

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run                         # 716 tests (unchanged)
pnpm --filter @chiaro/web build                                  # 12 routes green
```

- [ ] **Step 5: Commit Task 2**
