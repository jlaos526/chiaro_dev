'use client'

import { Drawer } from 'expo-router/drawer'
import type { ComponentProps } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandDrawerContent } from './BrandDrawerContent.tsx'

type DrawerProps = ComponentProps<typeof Drawer>

export interface BrandDrawerProps extends Omit<DrawerProps, 'drawerContent' | 'screenOptions'> {
  /** Override screen options per-screen if needed. Brand defaults always applied first. */
  screenOptionsOverride?: DrawerProps['screenOptions']
}

/**
 * Themed wrapper around Expo Router's <Drawer> (React Navigation Drawer).
 * Composes brand-themed screenOptions via useBrandTokens() + supplies
 * BrandDrawerContent as the custom drawerContent. Children + per-screen
 * overrides are forwarded.
 */
export function BrandDrawer({ screenOptionsOverride, children, ...rest }: BrandDrawerProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const baseOptions: DrawerProps['screenOptions'] = {
    headerStyle: { backgroundColor: semantic.bg.elevated },
    headerTintColor: semantic.text.primary,
    headerTitleStyle: { fontWeight: '700', fontSize: 17 },
    headerShadowVisible: false,
    drawerStyle: { backgroundColor: semantic.bg.elevated, width: '78%' },
    drawerType: 'front',
    overlayColor: 'rgba(0,0,0,0.4)',
    sceneStyle: { backgroundColor: semantic.bg.app },
  }
  const merged = screenOptionsOverride
    ? { ...baseOptions, ...screenOptionsOverride }
    : baseOptions
  return (
    <Drawer
      drawerContent={(props) => <BrandDrawerContent {...props} />}
      screenOptions={merged}
      {...rest}
    >
      {children}
    </Drawer>
  )
}
