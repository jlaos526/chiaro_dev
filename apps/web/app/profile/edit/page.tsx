'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'
import { BrandFormScreen, BrandTextInput, BrandButton, BrandAlert } from '@chiaro/officials-ui'

export default function ProfileEditPage(): React.JSX.Element {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    const parsed = profileFormSchema.safeParse({ display_name: displayName, username })
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join('; '))
      return
    }
    setLoading(true)
    const client = createSupabaseBrowserClient()
    try {
      await updateMyProfile(client, parsed.data)
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof ProfileError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <BrandFormScreen title="Complete your profile" backHref="/" backLabel="← Home">
      <BrandTextInput
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        required
      />
      <BrandTextInput label="Username" value={username} onChangeText={setUsername} required />
      {error ? (
        <BrandAlert severity="danger" title="Couldn't save">
          {error}
        </BrandAlert>
      ) : null}
      <BrandButton variant="primary" disabled={loading} onPress={handleSubmit}>
        {loading ? 'Saving…' : 'Save'}
      </BrandButton>
    </BrandFormScreen>
  )
}
