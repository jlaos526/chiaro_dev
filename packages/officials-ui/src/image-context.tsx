'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { Image } from 'react-native'

// Injectable image renderer (audit C13). officials-ui must stay Expo-free
// (no `expo-image` import — see BioPortrait's gradient note), so the concrete
// image component is supplied by the host app via context. Mobile injects an
// `expo-image`-backed adapter (disk cache + recycling); web + tests fall back
// to the RN Image default below. The prop contract hides both libs' shapes.

export interface BrandImageProps {
  uri: string
  size: number
  borderRadius: number
  accessibilityLabel: string
  /** Hint for the image lib to recycle the underlying view (expo-image). */
  recyclingKey?: string
}

export type BrandImageComponent = (props: BrandImageProps) => React.JSX.Element

/** Default renderer: plain RN Image (RNW renders it as <img> on web). */
export function DefaultBrandImage({
  uri,
  size,
  borderRadius,
  accessibilityLabel,
}: BrandImageProps): React.JSX.Element {
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, borderRadius }}
    />
  )
}

// Default is DefaultBrandImage (not null) — consumers without a provider still
// render a working image, unlike ChiaroClientContext which throws.
const BrandImageContext = createContext<BrandImageComponent>(DefaultBrandImage)

export interface BrandImageProviderProps {
  component: BrandImageComponent
  children: ReactNode
}

export function BrandImageProvider({
  component,
  children,
}: BrandImageProviderProps): React.JSX.Element {
  return <BrandImageContext.Provider value={component}>{children}</BrandImageContext.Provider>
}

export function useBrandImage(): BrandImageComponent {
  return useContext(BrandImageContext)
}
