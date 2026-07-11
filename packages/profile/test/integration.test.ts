import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createChiaroClient } from '@chiaro/supabase-client'
import { getMyProfile, updateMyProfile, ProfileError } from '../src/index.ts'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.SUPABASE_ANON_KEY

// Slice 63 (audit U10): skip locally when the env isn't exported instead of a
// module-scope throw. CI always runs (live = true via CI env) and still
// hard-fails there on a missing key.
const live = !!anonKey || !!process.env.CI
const describeLive = describe.skipIf(!live)
if (!live) {
  console.warn(
    '[@chiaro/profile] SUPABASE_ANON_KEY not set — skipping integration suite. ' +
      'Run `pnpm db:start`, then export keys from `supabase status --output env` (ANON_KEY).',
  )
}

// Each test client gets an ISOLATED in-memory auth store (CLAUDE.md Gotcha #1).
// Without this, every createChiaroClient shares the default storageKey, so a
// later signUp leaks its session to earlier/anon clients. The slice-66 swap of
// getUser() (network, per-client in-memory token) → getSession() (reads the
// store) surfaced this: getMyProfile/updateMyProfile resolve the user id from
// the session, so a shared store would hand back the wrong (or a leaked) id.
// Production never hits this — one client per process. Mirrors the distinct
// storage already used by the officials/bills/location integration tests.
function makeMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  }
}

function newClient() {
  return createChiaroClient({ url, anonKey: anonKey!, storage: makeMemoryStorage() })
}

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

// Track each created auth.users id so afterAll can delete them.
// Cascades to public.profiles via `references auth.users(id) on delete cascade`.
const createdUserIds: string[] = []

async function newSignedInUser(label: string) {
  const client = newClient()
  const email = uniqueEmail(label)
  const { data, error } = await client.auth.signUp({ email, password: 'password123!' })
  if (error) throw error
  if (data.user) createdUserIds.push(data.user.id)
  return { client, email }
}

afterAll(async () => {
  if (createdUserIds.length === 0) return
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!svcKey) {
    // Soft-fail: pre-existing test contract only required ANON_KEY.
    // Cleanup is best-effort; without service role we can't admin.deleteUser.
    console.warn(
      '[profile integration] SUPABASE_SERVICE_ROLE_KEY not set — skipping auth.users cleanup. ' +
        `${createdUserIds.length} test users will persist in local Supabase.`,
    )
    return
  }
  // Distinct storageKey per CLAUDE.md gotcha #1 — admin client mustn't share
  // auth state with the anon-key client that the tests used to sign in.
  const admin = createClient(url, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'profile-cleanup' },
  })
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id)
  }
})

describeLive('profile integration', () => {
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
    await expect(
      updateMyProfile(clientB, { display_name: 'B', username: taken }),
    ).rejects.toMatchObject({ message: 'Username taken' })
  })

  it('anonymous client throws "Not signed in"', async () => {
    const client = newClient()
    await expect(
      updateMyProfile(client, { display_name: 'X', username: 'xxx' }),
    ).rejects.toBeInstanceOf(ProfileError)
  })
})
