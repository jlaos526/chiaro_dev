import { renderHook } from '@testing-library/react-native'
import { useExpoParamSync } from '@/components/performance/useExpoParamSync'

const mockParams = jest.fn()
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
}))

describe('useExpoParamSync', () => {
  beforeEach(() => mockParams.mockReset())

  function makeApi() {
    return {
      isCategoryOpen: jest.fn(() => false),
      toggleCategory: jest.fn(),
      openCategory: jest.fn(),
      isSubCascadeOpen: jest.fn(() => false),
      toggleSubCascade: jest.fn(),
      openSubCascade: jest.fn(),
    }
  }

  it('opens category from cat param', () => {
    mockParams.mockReturnValue({ cat: 'finance' })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).toHaveBeenCalledWith('finance')
    expect(api.openSubCascade).not.toHaveBeenCalled()
  })

  it('opens category + sub when both params present', () => {
    mockParams.mockReturnValue({ cat: 'finance', sub: 'top-industries' })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).toHaveBeenCalledWith('finance')
    expect(api.openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })

  it('ignores unknown category', () => {
    mockParams.mockReturnValue({ cat: 'bogus' })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).not.toHaveBeenCalled()
  })

  it('no-ops when params empty', () => {
    mockParams.mockReturnValue({})
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).not.toHaveBeenCalled()
  })

  it('coerces array-shaped params to first string', () => {
    mockParams.mockReturnValue({ cat: ['finance', 'whatever'], sub: ['top-industries'] })
    const api = makeApi()
    renderHook(() => useExpoParamSync(api))
    expect(api.openCategory).toHaveBeenCalledWith('finance')
    expect(api.openSubCascade).toHaveBeenCalledWith('finance', 'top-industries')
  })
})
