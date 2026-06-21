import { render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { Text } from 'react-native'
import {
  BrandImageProvider,
  DefaultBrandImage,
  useBrandImage,
  type BrandImageProps,
} from '../src/image-context.tsx'
import { OfficialAvatar } from '../src/OfficialAvatar.tsx'

describe('useBrandImage', () => {
  it('returns DefaultBrandImage when no provider is present', () => {
    const { result } = renderHook(() => useBrandImage())
    expect(result.current).toBe(DefaultBrandImage)
  })

  it('returns the injected component inside a provider', () => {
    const Injected = (_props: BrandImageProps) => createElement(Text, null, 'injected')
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(BrandImageProvider, { component: Injected, children })
    const { result } = renderHook(() => useBrandImage(), { wrapper })
    expect(result.current).toBe(Injected)
  })
})

describe('DefaultBrandImage', () => {
  it('renders an RN Image (→ <img>) with the uri and a11y label', () => {
    const { container } = render(
      <DefaultBrandImage
        uri="https://example.com/p.jpg"
        size={48}
        borderRadius={24}
        accessibilityLabel="Jane Doe"
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/p.jpg')
    // RNW surfaces accessibilityLabel as aria-label somewhere in the rendered
    // tree (matches OfficialAvatar's image-branch a11y assertion).
    expect(container.querySelector('[aria-label="Jane Doe"]')).not.toBeNull()
  })
})

describe('OfficialAvatar — injected image renderer', () => {
  it('renders the injected component for a portraitUrl', () => {
    const Injected = (props: BrandImageProps) =>
      createElement(Text, { testID: 'injected' }, `img:${props.uri}`)
    const { getByText } = render(
      <BrandImageProvider component={Injected}>
        <OfficialAvatar fullName="Jane Doe" portraitUrl="https://example.com/jane.jpg" size={64} />
      </BrandImageProvider>,
    )
    expect(getByText('img:https://example.com/jane.jpg')).toBeTruthy()
  })

  it('renders the initials fallback (not the injected image) without a portraitUrl', () => {
    const Injected = (_props: BrandImageProps) =>
      createElement(Text, { testID: 'injected' }, 'injected')
    const { getByText, queryByTestId } = render(
      <BrandImageProvider component={Injected}>
        <OfficialAvatar fullName="Jane Doe" portraitUrl={null} />
      </BrandImageProvider>,
    )
    expect(getByText('JD')).toBeTruthy()
    expect(queryByTestId('injected')).toBeNull()
  })
})
