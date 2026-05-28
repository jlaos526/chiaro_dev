import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BrandMode } from '@chiaro/ui-tokens'

export const BRAND_MODE_STORAGE_KEY = 'chiaro_brand_mode'

export async function readBrandMode(): Promise<BrandMode | null> {
  try {
    const v = await AsyncStorage.getItem(BRAND_MODE_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export async function writeBrandMode(mode: BrandMode | null): Promise<void> {
  if (mode === null) {
    await AsyncStorage.removeItem(BRAND_MODE_STORAGE_KEY)
  } else {
    await AsyncStorage.setItem(BRAND_MODE_STORAGE_KEY, mode)
  }
}
