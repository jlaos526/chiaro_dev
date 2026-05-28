import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBrandModeSetter } from '../src/brand-mode-provider.tsx'

describe('useBrandModeSetter (outside Provider)', () => {
  it('throws a clear error when used without <BrandModeProvider>', () => {
    expect(() => renderHook(() => useBrandModeSetter())).toThrow(
      /must be used inside <BrandModeProvider>/,
    )
  })
})
