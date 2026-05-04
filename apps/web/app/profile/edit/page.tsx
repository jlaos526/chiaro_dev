'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'

export default function ProfileEditPage(): React.JSX.Element {
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
