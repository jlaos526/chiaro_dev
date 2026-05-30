import { BrandPageScreen, BrandBodyText, BrandLink } from '@chiaro/officials-ui'

export default function NotFound(): React.JSX.Element {
  return (
    <BrandPageScreen title="Page not found">
      <BrandBodyText>We couldn&apos;t find what you were looking for.</BrandBodyText>
      <BrandLink href="/">← Go home</BrandLink>
    </BrandPageScreen>
  )
}
