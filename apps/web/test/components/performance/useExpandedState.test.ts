import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExpandedState } from '@/components/performance/useExpandedState'

describe('useExpandedState', () => {
  it('defaults all categories closed', () => {
    const { result } = renderHook(() => useExpandedState())
    expect(result.current.isCategoryOpen('finance')).toBe(false)
  })

  it('toggleCategory flips state', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.toggleCategory('finance'))
    expect(result.current.isCategoryOpen('finance')).toBe(true)
    act(() => result.current.toggleCategory('finance'))
    expect(result.current.isCategoryOpen('finance')).toBe(false)
  })

  it('openCategory is idempotent', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.openCategory('issue-positions'))
    act(() => result.current.openCategory('issue-positions'))
    expect(result.current.isCategoryOpen('issue-positions')).toBe(true)
  })

  it('sub-cascades track per <categoryId>:<subId> key', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.toggleSubCascade('issue-positions', 'environment'))
    expect(result.current.isSubCascadeOpen('issue-positions', 'environment')).toBe(true)
    expect(result.current.isSubCascadeOpen('issue-positions', 'civil-liberties')).toBe(false)
    expect(result.current.isSubCascadeOpen('finance', 'environment')).toBe(false)
  })

  it('opening a sub-cascade also opens its parent category (convenience)', () => {
    const { result } = renderHook(() => useExpandedState())
    act(() => result.current.openSubCascade('finance', 'top-industries'))
    expect(result.current.isCategoryOpen('finance')).toBe(true)
    expect(result.current.isSubCascadeOpen('finance', 'top-industries')).toBe(true)
  })

  it('initial state can be seeded (used by URL hash hook)', () => {
    const { result } = renderHook(() =>
      useExpandedState({ categories: ['issue-positions'], subCascades: ['issue-positions:environment'] })
    )
    expect(result.current.isCategoryOpen('issue-positions')).toBe(true)
    expect(result.current.isSubCascadeOpen('issue-positions', 'environment')).toBe(true)
  })
})
