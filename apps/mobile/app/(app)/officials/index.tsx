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
          onSelect={({ officialId, level }) =>
            router.push(
              level === 'state' ? `/state-officials/${officialId}` : `/officials/${officialId}`,
            )
          }
          onCalibrate={() => router.push('/calibrate')}
        />
      </BrandPageScreen>
    </>
  )
}
