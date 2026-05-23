import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { QueryProvider } from '@/lib/query-client'
import { ErrorBoundary, initSentry } from '@/lib/sentry'
import { supabase } from '@/lib/supabase'
import { ChiaroClientProvider } from '@chiaro/officials-ui'
import type { Session } from '@supabase/supabase-js'

initSentry()

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
    return (
      <ErrorBoundary>
        <ChiaroClientProvider client={supabase}>
          <QueryProvider>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
            </View>
          </QueryProvider>
        </ChiaroClientProvider>
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <ChiaroClientProvider client={supabase}>
        <QueryProvider>
          <Slot />
        </QueryProvider>
      </ChiaroClientProvider>
    </ErrorBoundary>
  )
}
