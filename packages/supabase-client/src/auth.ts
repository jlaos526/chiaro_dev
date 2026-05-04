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
