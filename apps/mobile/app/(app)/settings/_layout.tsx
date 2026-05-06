import { Stack } from 'expo-router'

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerTitle: 'Settings' }}>
      <Stack.Screen name="index" options={{ headerTitle: 'Settings' }} />
      <Stack.Screen name="address" options={{ headerTitle: 'Home address' }} />
    </Stack>
  )
}
