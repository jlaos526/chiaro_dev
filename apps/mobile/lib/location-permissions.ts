import * as Location from 'expo-location'
import { Linking, Platform } from 'react-native'

export type GpsResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'unknown'; message: string }

export async function getCurrentLocation(): Promise<GpsResult> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    return {
      ok: false,
      reason: 'denied',
      message: 'Location access is off. Enable it in Settings, or enter your address manually.',
    }
  }
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch (err) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Could not get your location. Enter your address instead.',
    }
  }
}

export function openOSPermissionSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:')
  } else {
    Linking.openSettings()
  }
}
