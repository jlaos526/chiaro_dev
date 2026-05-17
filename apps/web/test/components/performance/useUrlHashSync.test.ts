import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { parseHash, useUrlHashSync } from '@/components/performance/useUrlHashSync'

describe('parseHash', () => {
  it('returns null for empty hash', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
  })
  it('parses category only', () => {
    expect(parseHash('#issue-positions')).toEqual({ categoryId: 'issue-positions', subId: null })
  })
  it('parses category + sub-cascade', () => {
    expect(parseHash('#issue-positions:environment')).toEqual({
      categoryId: 'issue-positions', subId: 'environment',
    })
  })
  it('rejects unknown categories', () => {
    expect(parseHash('#bogus-category')).toBeNull()
    expect(parseHash('#bogus-category:foo')).toBeNull()
  })
})

describe('useUrlHashSync', () => {
  it('opens matching category + sub-cascade on mount', () => {
    const openCategory = vi.fn()
    const openSubCascade = vi.fn()
    const api = {
      isCategoryOpen: vi.fn(() => false),
      toggleCategory: vi.fn(),
      openCategory,
      isSubCascadeOpen: vi.fn(() => false),
      toggleSubCascade: vi.fn(),
      openSubCascade,
    }
    renderHook(() => useUrlHashSync(api, '#finance:top-industries'))
    expect(openCategory).toHaveBeenCalledWith('finance')
    expect(openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })
  it('opens category only when no sub-id present', () => {
    const openCategory = vi.fn()
    const openSubCascade = vi.fn()
    const api = {
      isCategoryOpen: vi.fn(() => false), toggleCategory: vi.fn(), openCategory,
      isSubCascadeOpen: vi.fn(() => false), toggleSubCascade: vi.fn(), openSubCascade,
    }
    renderHook(() => useUrlHashSync(api, '#service-record'))
    expect(openCategory).toHaveBeenCalledWith('service-record')
    expect(openSubCascade).not.toHaveBeenCalled()
  })
  it('no-ops when hash is empty', () => {
    const openCategory = vi.fn()
    const api = {
      isCategoryOpen: vi.fn(), toggleCategory: vi.fn(), openCategory,
      isSubCascadeOpen: vi.fn(), toggleSubCascade: vi.fn(), openSubCascade: vi.fn(),
    }
    renderHook(() => useUrlHashSync(api, ''))
    expect(openCategory).not.toHaveBeenCalled()
  })
})
