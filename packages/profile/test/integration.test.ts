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
