import { Drawer } from 'expo-router/drawer'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
  BackButton,
} from '@chiaro/officials-ui'

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
      router.replace('/(app)' as never)
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Edit profile',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <BrandFormScreen title="Complete your profile" backHref="/" backLabel="← Home">
        <BrandTextInput label="Display name" value={displayName} onChangeText={setDisplayName} />
        <BrandTextInput label="Username" value={username} onChangeText={setUsername} />
        {error ? <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert> : null}
        <BrandButton variant="primary" disabled={loading} onPress={onSubmit}>
          {loading ? 'Saving…' : 'Save'}
        </BrandButton>
      </BrandFormScreen>
    </>
  )
}
