'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer'
import { getMyProfile } from '@chiaro/profile'
import { useChiaroClient } from '../client-context.tsx'
import { BrandNavRailBody, type RailRouteKey } from './BrandNavRailBody.tsx'
import { signOut } from './sign-out.ts'

function deriveInitial(p: { display_name: string | null; username: string | null } | null): string {
  const source = p?.display_name ?? p?.username
  if (!source || source.length === 0) return '?'
  return source[0]!.toUpperCase()
}

const ROUTE_TO_KEY: Record<string, RailRouteKey> = {
  index: 'home',
  'officials/index': 'officials',
  'settings/index': 'settings',
}

const KEY_TO_ROUTE: Record<RailRouteKey, string> = {
  home: 'index',
  officials: 'officials/index',
  settings: 'settings/index',
}

/**
 * Custom drawerContent for Expo Router's <Drawer>. Renders the shared
 * BrandNavRailBody composition inside React Navigation's drawer chrome
 * (scrim, slide animation, swipe gestures, safe area all handled by the
 * library).
 */
export function BrandDrawerContent(props: DrawerContentComponentProps): React.JSX.Element {
  const router = useRouter()
  const client = useChiaroClient()
  const [profile, setProfile] = useState<{
    display_name: string | null
    username: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await getMyProfile(client)
      if (!cancelled) setProfile(p)
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  const activeRouteName = props.state.routes[props.state.index]?.name ?? ''
  const activeKey: RailRouteKey | null = ROUTE_TO_KEY[activeRouteName] ?? null

  const handleNavigate = (key: RailRouteKey) => {
    props.navigation.navigate(KEY_TO_ROUTE[key])
    props.navigation.closeDrawer()
  }

  const handleSignOut = () => {
    void signOut(router, client)
    props.navigation.closeDrawer()
  }

  const user = {
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    initial: deriveInitial(profile),
  }

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <BrandNavRailBody
        user={user}
        activeRouteKey={activeKey}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
    </DrawerContentScrollView>
  )
}
