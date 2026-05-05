# Auth + Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the foundational vertical slice of Chiaro — email + password auth on mobile (Expo) and web (Next.js), a `profiles` row materialized by a Postgres trigger on signup, and Supabase RLS that enforces self-edit-only.

**Architecture:** pnpm + Turborepo monorepo with `apps/{mobile,web}` and `packages/{db, supabase-client, profile}`. `packages/db` holds migrations and the generated `Database` type. `packages/supabase-client` wraps `createClient<Database>` with platform-appropriate session storage. `packages/profile` is the seam where mobile and web share form validation (zod) and the update mutation. RLS is verified by both pgTAP (policy logic) and a Vitest integration test (full client → PostgREST → RLS path).

**Tech Stack:** Node 20+, pnpm 9, Turborepo 2, TypeScript 5, Supabase CLI, PostgreSQL 15 (via Supabase), Next.js 15 (App Router) + React 19, Expo SDK 52 + React Native, expo-router, `@supabase/supabase-js` 2, `@supabase/ssr` 0.5+, `@react-native-async-storage/async-storage`, Zod 3, Vitest 2, pgTAP.

**Reference spec:** `docs/superpowers/specs/2026-05-02-auth-profile-foundation-design.md` — read this first.

---

## File Structure

```
chiaro/
├── apps/
│   ├── mobile/                              # Expo
│   │   ├── app/
│   │   │   ├── _layout.tsx                  # Root layout, auth context
│   │   │   ├── (auth)/_layout.tsx           # Public stack
│   │   │   ├── (auth)/sign-in.tsx
│   │   │   ├── (auth)/sign-up.tsx
│   │   │   ├── (app)/_layout.tsx            # Auth-guarded stack
│   │   │   ├── (app)/index.tsx              # Home
│   │   │   └── (app)/profile/edit.tsx       # Profile form
│   │   ├── lib/
│   │   │   └── supabase.ts                  # Client instance + AppState refresh
│   │   ├── app.config.ts
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.example
│   └── web/                                 # Next.js 15
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx                     # Home (server component)
│       │   ├── sign-in/page.tsx
│       │   ├── sign-up/page.tsx
│       │   └── profile/edit/page.tsx
│       ├── lib/
│       │   └── supabase/
│       │       ├── server.ts                # createServerClient
│       │       └── client.ts                # createBrowserClient
│       ├── middleware.ts
│       ├── next.config.mjs
│       ├── tsconfig.json
│       ├── package.json
│       └── .env.example
├── packages/
│   ├── db/
│   │   ├── supabase/
│   │   │   ├── config.toml
│   │   │   ├── migrations/
│   │   │   │   ├── 0001_profiles.sql
│   │   │   │   └── 0002_profiles_rls.sql
│   │   │   └── tests/
│   │   │       └── profiles_rls.test.sql
│   │   ├── src/
│   │   │   ├── index.ts                     # Re-exports Database type
│   │   │   └── types.ts                     # Generated; treat as build artifact
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── supabase-client/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts                    # createChiaroClient
│   │   │   └── auth.ts                      # signUp/signIn/signOut/getSession wrappers
│   │   ├── test/
│   │   │   └── client.test.ts
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── profile/
│       ├── src/
│       │   ├── index.ts
│       │   ├── schema.ts                    # Zod
│       │   ├── errors.ts                    # mapProfileError
│       │   ├── queries.ts                   # getMyProfile
│       │   └── mutations.ts                 # updateMyProfile
│       ├── test/
│       │   ├── schema.test.ts               # Unit
│       │   └── integration.test.ts          # Live Supabase
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
├── .github/workflows/ci.yml
├── docs/superpowers/{specs,plans}/...       # Existing
├── .gitignore                                # Created in Task 1
├── .env.example                              # Top-level shape
├── package.json                              # Root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

**Untouched by this slice:** the existing HTML mockup directories at the repo root (`Login_Screen/`, `Home_Screen/`, etc.) and `server.js`. They are reference material, not part of the monorepo packages.

---

## Task 1: Monorepo Skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

**Reading required:** the spec's "Architecture → Monorepo layout" section.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "chiaro",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.10.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "db:start": "pnpm --filter @chiaro/db supabase:start",
    "db:stop": "pnpm --filter @chiaro/db supabase:stop",
    "db:reset": "pnpm --filter @chiaro/db supabase:reset",
    "db:test": "pnpm --filter @chiaro/db supabase:test",
    "db:gen-types": "pnpm --filter @chiaro/db supabase:gen-types"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

(Why `^typecheck` rather than `^build`: every package in this monorepo runs with `noEmit: true` and exposes `./src/index.ts` as `main` — there are no built artifacts. `^typecheck` chains type-checking through dependencies without forcing useless build steps.)

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
# deps
node_modules/
.pnpm-store/

# build
dist/
.next/
.turbo/
*.tsbuildinfo

# env
.env
.env.local
.env.*.local
!.env.example

# supabase local artifacts
**/supabase/.branches/
**/supabase/.temp/
**/supabase/seed.sql.bak

# expo
.expo/
.expo-shared/

# IDE
.vscode/
.idea/

# system
.DS_Store
Thumbs.db
```

- [ ] **Step 6: Create root `.env.example`**

```
# Local Supabase (defaults from `supabase start`)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=replace-with-output-of-supabase-status
```

- [ ] **Step 7: Verify pnpm install runs cleanly**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml package.json turbo.json tsconfig.base.json .gitignore .env.example pnpm-lock.yaml
git commit -m "chore: monorepo skeleton with pnpm + turbo"
```

---

## Task 2: `packages/db` Scaffold + Supabase Init

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/types.ts` (placeholder)
- Create: `packages/db/supabase/config.toml` (via `supabase init`, then customized)

**Reading required:** spec's "Database" section, Task 1's root `package.json` for the supabase scripts.

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@chiaro/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:test": "supabase test db",
    "supabase:gen-types": "supabase gen types typescript --local > src/types.ts"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

When pnpm runs a script in a workspace package, it executes with that package's directory as cwd. The Supabase CLI auto-discovers `supabase/config.toml` from cwd, so no `--workdir` flag is needed.

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create placeholder `packages/db/src/types.ts`**

```ts
// This file is generated by `pnpm db:gen-types`.
// It is intentionally minimal until migrations exist + types are generated.
export type Database = Record<string, never>
```

- [ ] **Step 4: Create `packages/db/src/index.ts`**

```ts
export type { Database } from './types.ts'
```

- [ ] **Step 5: Initialize Supabase in `packages/db`**

From the repo root, run (PowerShell): `Set-Location packages/db; supabase init; Set-Location ../..`
From bash: `(cd packages/db && supabase init)`
Expected: creates `packages/db/supabase/config.toml` and `packages/db/supabase/seed.sql`.

If the command prompts about VS Code settings, decline (`N`).

- [ ] **Step 6: Edit `packages/db/supabase/config.toml`**

Set the following keys (file structure varies by CLI version; locate each section and update):

```toml
[auth]
enable_confirmations = false   # Local dev: signup returns a session immediately
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000", "exp://127.0.0.1:8081"]

[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false
```

(If a key already exists at the right value, no change needed.)

- [ ] **Step 7: Verify Supabase starts**

Run: `pnpm db:start`
Expected: Supabase services boot; `supabase status` shows the local API URL and anon key.

Run: `pnpm db:stop`

- [ ] **Step 8: Run typecheck**

Run: `pnpm --filter @chiaro/db typecheck`
Expected: PASS (no errors).

- [ ] **Step 9: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): scaffold @chiaro/db package with Supabase init"
```

---

## Task 3: Migration `0001_profiles.sql` (Schema + Trigger) — TDD

**Files:**
- Create: `packages/db/supabase/migrations/0001_profiles.sql`
- Create: `packages/db/supabase/tests/profiles_rls.test.sql` (test 1 only in this task; expanded in Task 4)

**Reading required:** spec's "Database → Migration `0001_profiles.sql`" + "pgTAP" sections.

- [ ] **Step 1: Write the failing pgTAP test for the trigger (test #1)**

Create `packages/db/supabase/tests/profiles_rls.test.sql`:

```sql
begin;

select plan(1);

-- Test 1: trigger fires on auth.users insert and creates a stub profile row
do $$
declare
  v_user_id uuid;
begin
  v_user_id := extensions.uuid_generate_v4();
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_user_id, 'trigger-test@example.com', crypt('password', gen_salt('bf')),
          now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
end $$;

select results_eq(
  $$ select display_name, username, completed
       from public.profiles
      where id = (select id from auth.users where email = 'trigger-test@example.com') $$,
  $$ values (null::text, null::citext, false) $$,
  'Trigger creates stub profile row with nulls and completed=false'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Start Supabase if not already: `pnpm db:start`

Run: `pnpm db:test`

Expected: FAIL — `relation "public.profiles" does not exist` or similar.

- [ ] **Step 3: Write `packages/db/supabase/migrations/0001_profiles.sql`**

```sql
-- citext for case-insensitive unique usernames
create extension if not exists citext;

create table public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  display_name  text                 check (display_name is null or char_length(display_name) between 1 and 50),
  username      citext      unique   check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  completed     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();
```

- [ ] **Step 4: Reset the DB and re-run the test**

Run: `pnpm db:reset`
Expected: migration applies cleanly.

Run: `pnpm db:test`
Expected: PASS — 1/1 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0001_profiles.sql packages/db/supabase/tests/profiles_rls.test.sql
git commit -m "feat(db): add profiles table with stub-row trigger and pgTAP test"
```

---

## Task 4: Migration `0002_profiles_rls.sql` (RLS) — TDD

**Files:**
- Create: `packages/db/supabase/migrations/0002_profiles_rls.sql`
- Modify: `packages/db/supabase/tests/profiles_rls.test.sql` (add tests 2–9)

**Reading required:** spec's "Database → Migration `0002_profiles_rls.sql`" + the pgTAP test table from "Testing → Layer 1."

- [ ] **Step 1: Replace `packages/db/supabase/tests/profiles_rls.test.sql` with the full suite**

```sql
begin;

select plan(9);

-- Helper: create two test users via auth.users insert (trigger creates profiles)
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-00000000000a';
  v_b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values
    (v_a, 'a@example.com', crypt('p', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_b, 'b@example.com', crypt('p', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
end $$;

-- Test 1: trigger created stub rows for both users
select results_eq(
  $$ select count(*)::int from public.profiles where id in
       ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b') $$,
  $$ values (2) $$,
  'Trigger created stub profiles for both users'
);

-- Switch to user A's auth context
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- Test 2: User A updates own row
select lives_ok(
  $$ update public.profiles set display_name='Alice', username='alice', completed=true
      where id='00000000-0000-0000-0000-00000000000a' $$,
  'User A can update own row'
);

-- Test 3: User A attempts to update user B's row → 0 rows affected, no error
select results_eq(
  $$ with upd as (
       update public.profiles set display_name='hax'
        where id='00000000-0000-0000-0000-00000000000b'
       returning 1
     ) select count(*)::int from upd $$,
  $$ values (0) $$,
  'User A update of user B''s row returns 0 rows (RLS filter)'
);

-- Test 4: User A attempts to update id column → permission denied
select throws_ok(
  $$ update public.profiles set id='00000000-0000-0000-0000-00000000000b'
      where id='00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'Updating id is denied by column grant'
);

-- Test 5: User A attempts to update created_at → permission denied
select throws_ok(
  $$ update public.profiles set created_at=now()
      where id='00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'Updating created_at is denied by column grant'
);

-- Test 7 (auth read): User A can read any profile
select results_eq(
  $$ select count(*)::int from public.profiles
      where id in ('00000000-0000-0000-0000-00000000000a',
                   '00000000-0000-0000-0000-00000000000b') $$,
  $$ values (2) $$,
  'Authenticated user can read all profiles'
);

-- Switch to anon
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

-- Test 6: anon select returns 0 rows (RLS, no anon policy)
select results_eq(
  $$ select count(*)::int from public.profiles $$,
  $$ values (0) $$,
  'Anon select returns 0 rows (RLS, no to-anon policy)'
);

-- Reset role to test cascade and uniqueness
reset role;
reset "request.jwt.claims";

-- Test 9: username uniqueness is case-insensitive (run while both A and B exist)
select throws_ok(
  $$ update public.profiles set username='ALICE' where id='00000000-0000-0000-0000-00000000000b' $$,
  '23505',
  null,
  'Case-insensitive username uniqueness enforced'
);

-- Test 8: cascade delete from auth.users → profile gone
delete from auth.users where id='00000000-0000-0000-0000-00000000000a';
select results_eq(
  $$ select count(*)::int from public.profiles where id='00000000-0000-0000-0000-00000000000a' $$,
  $$ values (0) $$,
  'Deleting auth.users row cascades to profiles'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the suite to verify the new tests fail**

Run: `pnpm db:test`
Expected: FAIL — at minimum tests 2, 3, 4, 5 fail because RLS is not enabled and grants are unrestricted (test 2 may pass, others won't behave correctly without RLS configured).

- [ ] **Step 3: Write `packages/db/supabase/migrations/0002_profiles_rls.sql`**

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant  update (display_name, username, completed) on public.profiles to authenticated;
```

- [ ] **Step 4: Reset the DB and re-run**

Run: `pnpm db:reset`
Expected: both migrations apply cleanly.

Run: `pnpm db:test`
Expected: PASS — 9/9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0002_profiles_rls.sql packages/db/supabase/tests/profiles_rls.test.sql
git commit -m "feat(db): add RLS policies and column grants for profiles"
```

---

## Task 5: Generate `Database` Type + Drift Check Script

**Files:**
- Modify: `packages/db/src/types.ts` (regenerated)
- Modify: root `package.json` (add `db:check-types-drift` script)

**Reading required:** spec's "Testing → CI pipeline" — the `git diff --exit-code` step.

- [ ] **Step 1: Regenerate types from the local DB**

Ensure Supabase is running: `pnpm db:start`

Run: `pnpm db:gen-types`
Expected: `packages/db/src/types.ts` is overwritten with the generated `Database` type, including a `profiles` table definition.

- [ ] **Step 2: Verify the file looks right**

Open `packages/db/src/types.ts` and confirm:
- It exports `Database`
- Under `Database['public']['Tables']['profiles']` there are `Row`, `Insert`, `Update` types with the columns from migration 0001.

- [ ] **Step 3: Add a `db:check-types-drift` script to root `package.json`**

Edit root `package.json` `scripts` block — add:

```json
"db:check-types-drift": "pnpm db:gen-types && git diff --exit-code packages/db/src/types.ts"
```

(Place it after `db:gen-types`. Existing scripts unchanged.)

- [ ] **Step 4: Verify drift check passes**

Run: `pnpm db:check-types-drift`
Expected: exit code 0, no diff.

- [ ] **Step 5: Run typecheck for `@chiaro/db`**

Run: `pnpm --filter @chiaro/db typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/types.ts package.json
git commit -m "feat(db): generate Database type from schema and add drift check script"
```

---

## Task 6: `packages/supabase-client`

**Files:**
- Create: `packages/supabase-client/package.json`
- Create: `packages/supabase-client/tsconfig.json`
- Create: `packages/supabase-client/vitest.config.ts`
- Create: `packages/supabase-client/src/index.ts`
- Create: `packages/supabase-client/src/client.ts`
- Create: `packages/supabase-client/src/auth.ts`
- Create: `packages/supabase-client/test/client.test.ts`

**Reading required:** spec's "Client Wiring → `packages/supabase-client`" section.

- [ ] **Step 1: Create `packages/supabase-client/package.json`**

```json
{
  "name": "@chiaro/supabase-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/supabase-client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/supabase-client/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Install deps**

Run: `pnpm install`
Expected: workspace links resolve, no errors.

- [ ] **Step 5: Write the failing test**

Create `packages/supabase-client/test/client.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createChiaroClient } from '../src/client.ts'

describe('createChiaroClient', () => {
  it('returns a SupabaseClient with the provided url and key', () => {
    const client = createChiaroClient({
      url: 'http://127.0.0.1:54321',
      anonKey: 'test-anon-key',
    })
    // The client object exposes from() and auth — smoke check
    expect(typeof client.from).toBe('function')
    expect(typeof client.auth.signUp).toBe('function')
  })

  it('accepts a custom storage adapter', () => {
    const memoryStore = new Map<string, string>()
    const storage = {
      getItem: (k: string) => memoryStore.get(k) ?? null,
      setItem: (k: string, v: string) => { memoryStore.set(k, v) },
      removeItem: (k: string) => { memoryStore.delete(k) },
    }
    const client = createChiaroClient({
      url: 'http://127.0.0.1:54321',
      anonKey: 'test-anon-key',
      storage,
    })
    expect(typeof client.auth.getSession).toBe('function')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter @chiaro/supabase-client test`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `packages/supabase-client/src/client.ts`**

```ts
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'

export type ChiaroClient = SupabaseClient<Database>

export interface CreateChiaroClientOptions {
  url: string
  anonKey: string
  storage?: SupportedStorage
  detectSessionInUrl?: boolean
}

export function createChiaroClient(opts: CreateChiaroClientOptions): ChiaroClient {
  return createClient<Database>(opts.url, opts.anonKey, {
    auth: {
      storage: opts.storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: opts.detectSessionInUrl ?? false,
    },
  })
}
```

- [ ] **Step 8: Write `packages/supabase-client/src/auth.ts`**

```ts
import type { ChiaroClient } from './client.ts'

export async function signUp(client: ChiaroClient, email: string, password: string) {
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(client: ChiaroClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut(client: ChiaroClient) {
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getSession(client: ChiaroClient) {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}
```

- [ ] **Step 9: Write `packages/supabase-client/src/index.ts`**

```ts
export { createChiaroClient, type ChiaroClient, type CreateChiaroClientOptions } from './client.ts'
export { signUp, signIn, signOut, getSession } from './auth.ts'
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `pnpm --filter @chiaro/supabase-client test`
Expected: PASS — 2/2.

- [ ] **Step 11: Run typecheck**

Run: `pnpm --filter @chiaro/supabase-client typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/supabase-client pnpm-lock.yaml
git commit -m "feat(supabase-client): add typed client factory and auth helpers"
```

---

## Task 7: `packages/profile` — Schema and Errors (Unit-Tested)

**Files:**
- Create: `packages/profile/package.json`
- Create: `packages/profile/tsconfig.json`
- Create: `packages/profile/vitest.config.ts`
- Create: `packages/profile/src/index.ts`
- Create: `packages/profile/src/schema.ts`
- Create: `packages/profile/src/errors.ts`
- Create: `packages/profile/test/schema.test.ts`

**Reading required:** spec's "Client Wiring → Profile feature module" section.

- [ ] **Step 1: Create `packages/profile/package.json`**

```json
{
  "name": "@chiaro/profile",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:integration": "vitest run test/integration.test.ts"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/profile/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/profile/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
```

- [ ] **Step 4: Install**

Run: `pnpm install`

- [ ] **Step 5: Write the failing schema test**

Create `packages/profile/test/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { profileFormSchema } from '../src/schema.ts'

describe('profileFormSchema', () => {
  it('accepts valid input and lowercases the username', () => {
    const result = profileFormSchema.parse({
      display_name: 'Alice',
      username: 'AliceCool_99',
    })
    expect(result.display_name).toBe('Alice')
    expect(result.username).toBe('alicecool_99')
  })

  it('rejects empty display_name', () => {
    expect(() => profileFormSchema.parse({ display_name: '', username: 'alice' })).toThrow()
  })

  it('rejects too-long display_name (>50)', () => {
    expect(() => profileFormSchema.parse({
      display_name: 'a'.repeat(51),
      username: 'alice',
    })).toThrow()
  })

  it('rejects username with disallowed characters', () => {
    expect(() => profileFormSchema.parse({ display_name: 'Alice', username: 'alice!' })).toThrow()
  })

  it('rejects username shorter than 3', () => {
    expect(() => profileFormSchema.parse({ display_name: 'Alice', username: 'al' })).toThrow()
  })

  it('rejects username longer than 20', () => {
    expect(() => profileFormSchema.parse({ display_name: 'Alice', username: 'a'.repeat(21) })).toThrow()
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm --filter @chiaro/profile test`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `packages/profile/src/schema.ts`**

```ts
import { z } from 'zod'

export const profileFormSchema = z.object({
  display_name: z.string().trim().min(1).max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
})

export type ProfileFormInput = z.infer<typeof profileFormSchema>
```

- [ ] **Step 8: Write `packages/profile/src/errors.ts`**

```ts
import type { PostgrestError } from '@supabase/supabase-js'

export class ProfileError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message)
    this.name = 'ProfileError'
  }
}

export function mapProfileError(error: PostgrestError): ProfileError {
  if (error.code === '23505' && error.message.toLowerCase().includes('username')) {
    return new ProfileError('Username taken', error)
  }
  return new ProfileError(error.message, error)
}
```

- [ ] **Step 9: Write `packages/profile/src/index.ts` (schema and errors only — queries/mutations added in Task 8)**

```ts
export { profileFormSchema, type ProfileFormInput } from './schema.ts'
export { ProfileError, mapProfileError } from './errors.ts'
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `pnpm --filter @chiaro/profile test`
Expected: PASS — 6/6 schema tests pass.

- [ ] **Step 10a: Run typecheck**

Run: `pnpm --filter @chiaro/profile typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/profile pnpm-lock.yaml
git commit -m "feat(profile): add zod schema and error mapper for profile form"
```

---

## Task 8: `packages/profile` — Queries, Mutations, and Integration Tests

**Files:**
- Create: `packages/profile/src/queries.ts`
- Create: `packages/profile/src/mutations.ts`
- Modify: `packages/profile/src/index.ts` (re-export the new functions if not already)
- Create: `packages/profile/test/integration.test.ts`

**Reading required:** spec's "End-to-end flow," "Profile feature module," and "Testing → Layer 2" sections.

- [ ] **Step 1: Write `packages/profile/src/queries.ts`**

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'

export async function getMyProfile(client: ChiaroClient) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, username, completed, created_at, updated_at')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Write `packages/profile/src/mutations.ts`**

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { ProfileFormInput } from './schema.ts'
import { ProfileError, mapProfileError } from './errors.ts'

export async function updateMyProfile(client: ChiaroClient, input: ProfileFormInput) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new ProfileError('Not signed in')
  const { data, error } = await client
    .from('profiles')
    .update({
      display_name: input.display_name,
      username: input.username,
      completed: true,
    })
    .eq('id', user.id)
    .select('id, display_name, username, completed, created_at, updated_at')
    .single()
  if (error) throw mapProfileError(error)
  return data
}
```

- [ ] **Step 3: Expand `packages/profile/src/index.ts` to include the new functions**

Replace the file contents with:

```ts
export { profileFormSchema, type ProfileFormInput } from './schema.ts'
export { ProfileError, mapProfileError } from './errors.ts'
export { getMyProfile } from './queries.ts'
export { updateMyProfile } from './mutations.ts'
```

- [ ] **Step 4: Write the failing integration test**

Create `packages/profile/test/integration.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createChiaroClient } from '@chiaro/supabase-client'
import { getMyProfile, updateMyProfile, ProfileError } from '../src/index.ts'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.SUPABASE_ANON_KEY
if (!anonKey) {
  throw new Error('Set SUPABASE_ANON_KEY for the integration test (run `supabase status`).')
}

function newClient() {
  return createChiaroClient({ url, anonKey: anonKey! })
}

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function newSignedInUser(label: string) {
  const client = newClient()
  const email = uniqueEmail(label)
  const { error } = await client.auth.signUp({ email, password: 'password123!' })
  if (error) throw error
  return { client, email }
}

describe('profile integration', () => {
  it('signUp + getMyProfile returns a stub row with completed=false', async () => {
    const { client } = await newSignedInUser('stub')
    const profile = await getMyProfile(client)
    expect(profile).not.toBeNull()
    expect(profile!.completed).toBe(false)
    expect(profile!.display_name).toBeNull()
    expect(profile!.username).toBeNull()
  })

  it('updateMyProfile persists fields and flips completed to true', async () => {
    const { client } = await newSignedInUser('update')
    const username = 'u' + Math.random().toString(36).slice(2, 10)
    const result = await updateMyProfile(client, { display_name: 'Alice', username })
    expect(result.display_name).toBe('Alice')
    expect(result.username).toBe(username)
    expect(result.completed).toBe(true)
  })

  it('user A update of user B row returns no rows (RLS)', async () => {
    const { client: clientA } = await newSignedInUser('rls-a')
    const { client: clientB } = await newSignedInUser('rls-b')
    const profileB = await getMyProfile(clientB)
    expect(profileB).not.toBeNull()
    // User A attempts to update user B's row by id
    const { data, error } = await clientA
      .from('profiles')
      .update({ display_name: 'pwned' })
      .eq('id', profileB!.id)
      .select()
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('username conflict surfaces "Username taken"', async () => {
    const taken = 'u' + Math.random().toString(36).slice(2, 10)
    const { client: clientA } = await newSignedInUser('dup-a')
    await updateMyProfile(clientA, { display_name: 'A', username: taken })
    const { client: clientB } = await newSignedInUser('dup-b')
    await expect(updateMyProfile(clientB, { display_name: 'B', username: taken }))
      .rejects.toMatchObject({ message: 'Username taken' })
  })

  it('anonymous client throws "Not signed in"', async () => {
    const client = newClient()
    await expect(updateMyProfile(client, { display_name: 'X', username: 'xxx' }))
      .rejects.toBeInstanceOf(ProfileError)
  })
})
```

- [ ] **Step 5: Run the integration test**

Ensure local Supabase is running: `pnpm db:start`

Get the anon key:
- PowerShell: `Set-Location packages/db; supabase status; Set-Location ../..`
- Bash: `(cd packages/db && supabase status)`

Copy the `anon key` value from the output.

Run (PowerShell):
```powershell
$env:SUPABASE_ANON_KEY = "<anon-key-from-status>"
pnpm --filter @chiaro/profile test:integration
```

Or (bash):
```bash
SUPABASE_ANON_KEY="<anon-key-from-status>" pnpm --filter @chiaro/profile test:integration
```

Expected: PASS — 5/5. (If the env var is missing, the test throws a clear error before connecting; if Supabase isn't running, expect a connection error.)

- [ ] **Step 6: Run the full package test suite to confirm no regressions**

Run (with `SUPABASE_ANON_KEY` set as in step 5): `pnpm --filter @chiaro/profile test`
Expected: PASS — 11 tests (6 schema + 5 integration).

- [ ] **Step 7: Run typecheck**

Run: `pnpm --filter @chiaro/profile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/profile
git commit -m "feat(profile): add queries, mutations, and integration tests"
```

---

## Task 9: `apps/web` Scaffold + Supabase SSR Wiring

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/middleware.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx` (placeholder home)
- Create: `apps/web/.env.example`
- Create: `apps/web/.env.local` (untracked)

**Reading required:** spec's "Client Wiring → Web (Next.js App Router)" + Supabase docs at `https://supabase.com/docs/guides/auth/server-side/nextjs` for the canonical `@supabase/ssr` middleware shape.

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@chiaro/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@chiaro/profile": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.45.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.mjs`**

```mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@chiaro/db', '@chiaro/profile', '@chiaro/supabase-client'],
}
export default nextConfig
```

- [ ] **Step 4: Create `apps/web/.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-output-of-supabase-status
```

Copy this to `apps/web/.env.local` (not committed) and fill in the anon key from `pnpm db:start` / `supabase status`.

- [ ] **Step 5: Create `apps/web/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@chiaro/db'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll called from a Server Component; safe to ignore — middleware refreshes
          }
        },
      },
    },
  )
}
```

- [ ] **Step 6: Create `apps/web/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@chiaro/db'

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 7: Create `apps/web/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@chiaro/db'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Refresh session — must be called for cookie rotation to happen
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 8: Create `apps/web/app/layout.tsx`**

```tsx
export const metadata = { title: 'Chiaro' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 9: Create `apps/web/app/page.tsx` (placeholder home)**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return <main><h1>Chiaro home (placeholder)</h1><p>Signed in as {user.email}</p></main>
}
```

(This will redirect to `/sign-in` which doesn't exist yet — that's fine for this task; we'll see a 404 on redirect, but `/` for an authenticated user will render. We add `/sign-in` in Task 10.)

- [ ] **Step 10: Install and verify build**

Run: `pnpm install`
Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/web build`
Expected: build succeeds (a 404 for `/sign-in` is expected at this stage — we're verifying the toolchain compiles, not the routing).

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js app with Supabase SSR wiring"
```

---

## Task 10: `apps/web` — Auth and Profile Pages

**Files:**
- Create: `apps/web/app/sign-in/page.tsx`
- Create: `apps/web/app/sign-up/page.tsx`
- Create: `apps/web/app/profile/edit/page.tsx`
- Create: `apps/web/app/sign-out/route.ts` (POST handler)
- Modify: `apps/web/app/page.tsx` (read profile, render display_name or CTA)

**Reading required:** spec's "End-to-end flow" + `packages/profile/src/index.ts` to know which functions to call.

- [ ] **Step 1: Create `apps/web/app/sign-in/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit}>
        <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p>No account? <a href="/sign-up">Sign up</a></p>
    </main>
  )
}
```

- [ ] **Step 2: Create `apps/web/app/sign-up/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      // Email confirmation required (production); placeholder UI
      setError('Check your email to confirm your account.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password <input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Signing up…' : 'Sign up'}</button>
      </form>
      <p>Have an account? <a href="/sign-in">Sign in</a></p>
    </main>
  )
}
```

- [ ] **Step 3: Create `apps/web/app/sign-out/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/sign-in', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
}
```

- [ ] **Step 4: Replace `apps/web/app/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyProfile } from '@chiaro/profile'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const profile = await getMyProfile(supabase)
  // createSupabaseServerClient returns SupabaseClient<Database>, identical to ChiaroClient.

  return (
    <main>
      <h1>Chiaro</h1>
      {profile?.completed ? (
        <p>Welcome, {profile.display_name} (@{profile.username})</p>
      ) : (
        <p><a href="/profile/edit">Complete your profile</a></p>
      )}
      <form action="/sign-out" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Create `apps/web/app/profile/edit/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'

export default function ProfileEditPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = profileFormSchema.safeParse({ display_name: displayName, username })
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join('; '))
      return
    }
    setLoading(true)
    const client = createSupabaseBrowserClient()
    try {
      await updateMyProfile(client, parsed.data)
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Complete your profile</h1>
      <form onSubmit={handleSubmit}>
        <label>Display name <input value={displayName} onChange={e => setDisplayName(e.target.value)} required /></label>
        <label>Username <input value={username} onChange={e => setUsername(e.target.value)} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Verify typecheck and build**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/web build`
Expected: PASS.

- [ ] **Step 7: Manual smoke test**

Ensure Supabase is running: `pnpm db:start`. Confirm `apps/web/.env.local` has the correct `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from `supabase status --workdir packages/db`).

Run: `pnpm --filter @chiaro/web dev`

In a browser:
1. Open `http://localhost:3000` → redirected to `/sign-in`.
2. Click "Sign up", enter `web-test@example.com` / `password123!`.
3. Land on `/`, see "Complete your profile" link.
4. Click it; submit `display_name="Web Tester"`, `username="webtester"`.
5. Land back on `/`, see "Welcome, Web Tester (@webtester)".
6. Sign out; land on `/sign-in`.

If any step fails, debug before committing.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add sign-in, sign-up, home, and profile edit pages"
```

---

## Task 11: `apps/mobile` Scaffold + Supabase Wiring

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/app.config.ts`
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx` (placeholder)
- Create: `apps/mobile/.env.example`

**Reading required:** spec's "Client Wiring → Mobile (Expo)" + Expo docs `https://docs.expo.dev/router/installation/`.

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "@chiaro/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start --clear",
    "build": "echo 'mobile build is via EAS — out of scope for this slice'",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@chiaro/profile": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "@expo/metro-runtime": "~6.1.2",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@supabase/supabase-js": "^2.45.0",
    "expo": "~54.0.0",
    "expo-constants": "~18.0.13",
    "expo-linking": "~8.0.12",
    "expo-router": "~6.0.23",
    "expo-status-bar": "~3.0.9",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.5",
    "react-native-safe-area-context": "5.6.2",
    "react-native-screens": "~4.16.0",
    "react-native-url-polyfill": "^2.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~19.1.17",
    "typescript": "^5.4.0"
  }
}
```

(Versions reflect Expo SDK 54, the canonical SDK pin for this plan. If a newer Expo SDK is current when executing this plan, run `npx expo install --check` after `pnpm install` and follow the same `npx expo install --fix` flow to update to the SDK-aligned set.)

- [ ] **Step 2: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Create `apps/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
```

- [ ] **Step 4: Create `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
```

- [ ] **Step 5: Create `apps/mobile/app.config.ts`**

```ts
import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Chiaro',
  slug: 'chiaro',
  scheme: 'chiaro',
  version: '0.0.0',
  orientation: 'portrait',
  newArchEnabled: true,
  ios: { supportsTablet: false, bundleIdentifier: 'com.chiaro.app' },
  android: { package: 'com.chiaro.app' },
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
}

export default config
```

- [ ] **Step 6: Create `apps/mobile/.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=replace-with-output-of-supabase-status
```

Copy to `apps/mobile/.env.local` and fill in the anon key.

(Note: when running on a physical device, `127.0.0.1` will not resolve to your dev machine. Replace with your LAN IP, e.g., `http://192.168.1.50:54321`.)

- [ ] **Step 7: Create `apps/mobile/lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { createChiaroClient } from '@chiaro/supabase-client'

export const supabase = createChiaroClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  storage: AsyncStorage,
})

// Documented Supabase + RN pattern: refresh tokens while foregrounded; pause when backgrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
```

(`react-native-url-polyfill` is required by `@supabase/supabase-js` on React Native; it's listed as a direct dep in step 1 of this task.)

- [ ] **Step 8: Create `apps/mobile/app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: true }} />
}
```

- [ ] **Step 9: Create `apps/mobile/app/index.tsx` (placeholder)**

```tsx
import { Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Chiaro mobile (placeholder home)</Text>
    </View>
  )
}
```

- [ ] **Step 10: Install and verify**

Run: `pnpm install`

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

Manual: from `apps/mobile`, run `pnpm dev`. Open Expo Go on a simulator or device, scan the QR, see "Chiaro mobile (placeholder home)." Stop the dev server.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo app with Supabase client and AppState refresh"
```

---

## Task 12: `apps/mobile` — Auth and Profile Screens

**Files:**
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(auth)/sign-up.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/index.tsx` (replaces the placeholder home in `app/index.tsx`)
- Delete: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/app/(app)/profile/edit.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (rewire to use grouped routes)

**Reading required:** spec's "End-to-end flow" + Expo Router groups docs `https://docs.expo.dev/router/layouts/`.

- [ ] **Step 1: Replace `apps/mobile/app/_layout.tsx` with a session-aware root**

```tsx
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!loaded) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) router.replace('/(auth)/sign-in')
    else if (session && inAuthGroup) router.replace('/(app)')
  }, [session, loaded, segments])

  if (!loaded) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>
  }
  return <Slot />
}
```

- [ ] **Step 2: Delete `apps/mobile/app/index.tsx`**

The home now lives at `(app)/index.tsx`.

- [ ] **Step 3: Create `apps/mobile/app/(auth)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: true }} />
}
```

- [ ] **Step 4: Create `apps/mobile/app/(auth)/sign-in.tsx`**

```tsx
import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Text>Password</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={loading} />
      <Link href="/(auth)/sign-up">No account? Sign up</Link>
    </View>
  )
}
```

- [ ] **Step 5: Create `apps/mobile/app/(auth)/sign-up.tsx`**

```tsx
import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      setError('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Text>Password (min 8)</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title={loading ? 'Signing up…' : 'Sign up'} onPress={onSubmit} disabled={loading} />
      <Link href="/(auth)/sign-in">Have an account? Sign in</Link>
    </View>
  )
}
```

- [ ] **Step 6: Create `apps/mobile/app/(app)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: true }} />
}
```

- [ ] **Step 7: Create `apps/mobile/app/(app)/index.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Button, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyProfile } from '@chiaro/profile'

type Profile = Awaited<ReturnType<typeof getMyProfile>>

export default function Home() {
  const [profile, setProfile] = useState<Profile>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getMyProfile(supabase).then((p) => {
      if (mounted) {
        setProfile(p)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  if (loading) return <View style={{ padding: 24 }}><Text>Loading…</Text></View>

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24 }}>Chiaro</Text>
      {profile?.completed ? (
        <Text>Welcome, {profile.display_name} (@{profile.username})</Text>
      ) : (
        <Link href="/(app)/profile/edit">Complete your profile</Link>
      )}
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  )
}
```

- [ ] **Step 8: Create `apps/mobile/app/(app)/profile/edit.tsx`**

```tsx
import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'

export default function ProfileEdit() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setError(null)
    const parsed = profileFormSchema.safeParse({ display_name: displayName, username })
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join('; '))
      return
    }
    setLoading(true)
    try {
      await updateMyProfile(supabase, parsed.data)
      router.replace('/(app)')
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20 }}>Complete your profile</Text>
      <Text>Display name</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} />
      <Text>Username</Text>
      <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title={loading ? 'Saving…' : 'Save'} onPress={onSubmit} disabled={loading} />
    </View>
  )
}
```

- [ ] **Step 9: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 10: Manual smoke test**

Ensure Supabase is running and `apps/mobile/.env.local` has the LAN URL (for physical device) or localhost (for simulator).

Run: `pnpm --filter @chiaro/mobile dev`

In Expo Go (simulator or physical device):
1. App opens to sign-in screen.
2. Tap "Sign up", enter `mobile-test@example.com` / `password123!`.
3. Land on home, see "Complete your profile" link.
4. Tap it, enter `Mobile Tester` / `mobiletester`, save.
5. Land back on home, see "Welcome, Mobile Tester (@mobiletester)."
6. Tap "Sign out"; routed back to sign-in.

If any step fails, debug before committing.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): add auth and profile screens with grouped routing"
```

---

## Task 13: CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Reading required:** spec's "Testing → CI pipeline" section.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: pnpm install --frozen-lockfile
      - name: Start Supabase
        run: pnpm db:start
      - name: Apply migrations
        run: pnpm db:reset
      - name: Run pgTAP suite
        run: pnpm db:test
      - name: Generate types and check drift
        run: pnpm db:check-types-drift
      - name: Stop Supabase
        if: always()
        run: pnpm db:stop

  build:
    runs-on: ubuntu-latest
    needs: db
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build

  test:
    runs-on: ubuntu-latest
    needs: db
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: pnpm install --frozen-lockfile
      - name: Start Supabase
        run: pnpm db:start
      - name: Capture anon key for integration tests
        id: supabase-status
        working-directory: packages/db
        run: |
          ANON_KEY=$(supabase status --output env | grep '^ANON_KEY' | cut -d'=' -f2- | tr -d '"')
          echo "anon_key=$ANON_KEY" >> "$GITHUB_OUTPUT"
      - name: Run package tests
        env:
          SUPABASE_ANON_KEY: ${{ steps.supabase-status.outputs.anon_key }}
          SUPABASE_URL: http://127.0.0.1:54321
        run: pnpm test
      - name: Stop Supabase
        if: always()
        run: pnpm db:stop
```

- [ ] **Step 2: Verify the lockfile is committed**

Run: `git status`
Expected: clean tree (lockfile already committed in earlier tasks). If not, `git add pnpm-lock.yaml` before continuing.

- [ ] **Step 3: Local CI dry-run — db job equivalent**

```bash
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm db:check-types-drift
pnpm db:stop
```

Expected: all green.

- [ ] **Step 4: Local CI dry-run — build + test**

```bash
pnpm typecheck
pnpm build
pnpm db:start
SUPABASE_ANON_KEY=<anon-key> SUPABASE_URL=http://127.0.0.1:54321 pnpm test
pnpm db:stop
```

(Use PowerShell `$env:` syntax on Windows.)

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add db, build, and test jobs with pgTAP and integration coverage"
```

---

## Task 14: Definition of Done Verification

**Files:** none (verification task).

**Reading required:** spec's "Definition of Done" section.

- [ ] **Step 1: Fresh-clone simulation**

```bash
# in a separate directory, simulate a fresh clone
git clone <this-repo> chiaro-fresh
cd chiaro-fresh
pnpm install
pnpm db:start
pnpm dev
```

Expected: both apps start; web on `http://localhost:3000`, Expo dev server prints a QR.

- [ ] **Step 2: Web end-to-end**

Sign up via web with a fresh email. Confirm:
- Stub profile exists by querying the local Supabase Studio (`http://127.0.0.1:54323`) → SQL editor: `select * from profiles order by created_at desc limit 1;` → row exists with `completed=false`.
- Complete profile via `/profile/edit`.
- Re-query the profile in Studio: `completed=true`, fields filled.

- [ ] **Step 3: Mobile end-to-end**

Sign up via mobile with a different fresh email. Same verification path.

- [ ] **Step 4: Cross-user RLS check (manual sanity)**

In Supabase Studio SQL editor, find two profile IDs (the two users created in steps 2 and 3). Open a new browser tab in incognito. Sign in as user A. Open DevTools → Network. Attempt to update user B's profile via the JS console:

```js
const { createBrowserClient } = await import('@supabase/ssr')
const c = createBrowserClient(URL, KEY)
await c.from('profiles').update({ display_name: 'pwned' }).eq('id', '<user-B-id>')
```

Expected: `data: []`, `error: null`. The update silently affects 0 rows (RLS).

- [ ] **Step 5: Run full test suite**

```bash
pnpm db:test
SUPABASE_ANON_KEY=<key> pnpm test
pnpm typecheck
pnpm build
```

Expected: all green.

- [ ] **Step 6: Final commit (if any docs were updated during verification)**

If the verification revealed any small fixes needed, apply them and commit. Otherwise, no commit needed — this task is verification only.

- [ ] **Step 7: Tag the slice**

```bash
git tag v0.1.0-auth-profile-foundation
```

(Optional but useful — marks the slice's completion point.)

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to at least one task.
  - Architecture & monorepo → Task 1.
  - Database schema/trigger/RLS → Tasks 2, 3, 4.
  - Generated types + drift check → Task 5.
  - `packages/supabase-client` → Task 6.
  - `packages/profile` → Tasks 7, 8.
  - Web → Tasks 9, 10.
  - Mobile → Tasks 11, 12.
  - Testing CI → Task 13.
  - Definition of Done → Task 14.
- **Type consistency:** `ChiaroClient` (from `@chiaro/supabase-client`) is the type used throughout `packages/profile`. Web pages cast `SupabaseClient<Database>` from `@supabase/ssr` to `ChiaroClient` via `as never` because `@supabase/ssr`'s return type is structurally identical but nominally distinct; this is documented inline in the page code.
- **Risks called out in spec but not directly testable here:**
  - RN background→foreground refresh — handled by the AppState listener in Task 11; manual verification only.
  - SSR cookie matcher — copied verbatim from Supabase official example; no automated test.
  - Production `enable_confirmations` flip — explicitly deferred; the apps already handle "no session after signup" with a placeholder message.
