import { Image as ExpoImage } from 'expo-image'
import type { BrandImageProps } from '@chiaro/officials-ui'

// expo-image-backed adapter for officials-ui's injectable image renderer (C13).
// officials-ui stays Expo-free; mobile injects this via <BrandImageProvider> in
// app/_layout.tsx so all portraits get disk caching + view recycling.
export function ExpoBrandImage({
  uri,
  size,
  borderRadius,
  accessibilityLabel,
  recyclingKey,
}: BrandImageProps): React.JSX.Element {
  return (
    <ExpoImage
      source={uri}
      style={{ width: size, height: size, borderRadius }}
      accessibilityLabel={accessibilityLabel}
      cachePolicy="disk"
      recyclingKey={recyclingKey}
      contentFit="cover"
    />
  )
}
