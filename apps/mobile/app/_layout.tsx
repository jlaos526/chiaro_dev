import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryProvider } from '@/lib/query-client'
import { ErrorBoundary, initSentry } from '@/lib/sentry'
import { supabase } from '@/lib/supabase'
import { readBrandMode, writeBrandMode } from '@/lib/brand-mode-storage'
import { BrandImageProvider, BrandModeProvider, ChiaroClientProvider } from '@chiaro/officials-ui'
import { ExpoBrandImage } from '@/lib/brand-image'
import type { Session } from '@supabase/supabase-js'
import type { BrandMode } from '@chiaro/ui-tokens'

initSentry()

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [brandMode, setBrandMode] = useState<BrandMode | null>(null)
  const [brandModeLoaded, setBrandModeLoaded] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    readBrandMode().then((m) => {
      setBrandMode(m)
      setBrandModeLoaded(true)
    })
  }, [])

  const loaded = sessionLoaded && brandModeLoaded

  useEffect(() => {
    if (!loaded) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) router.replace('/(auth)/sign-in')
    else if (session && inAuthGroup) router.replace('/(app)')
  }, [session, loaded, segments])

  if (!loaded) {
    return (
      <ErrorBoundary>
        <BrandModeProvider defaultMode={null} onChange={writeBrandMode}>
          <ChiaroClientProvider client={supabase}>
            <BrandImageProvider component={ExpoBrandImage}>
              <QueryProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                  </View>
                </GestureHandlerRootView>
              </QueryProvider>
            </BrandImageProvider>
          </ChiaroClientProvider>
        </BrandModeProvider>
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <BrandModeProvider defaultMode={brandMode} onChange={writeBrandMode}>
        <ChiaroClientProvider client={supabase}>
          <BrandImageProvider component={ExpoBrandImage}>
            <QueryProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <Slot />
              </GestureHandlerRootView>
            </QueryProvider>
          </BrandImageProvider>
        </ChiaroClientProvider>
      </BrandModeProvider>
    </ErrorBoundary>
  )
}
