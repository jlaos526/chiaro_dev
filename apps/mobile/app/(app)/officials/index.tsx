import { Drawer } from 'expo-router/drawer'
import { useRouter } from 'expo-router'
import { BrandPageScreen, OfficialsList } from '@chiaro/officials-ui'

export default function OfficialsScreen() {
  const router = useRouter()
  return (
    <>
      <Drawer.Screen options={{ title: 'Officials' }} />
      <BrandPageScreen>
        <OfficialsList
          onSelect={({ officialId }) => router.push(`/officials/${officialId}` as never)}
          onCalibrate={() => router.push('/calibrate' as never)}
        />
      </BrandPageScreen>
    </>
  )
}
