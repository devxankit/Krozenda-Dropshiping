import { useLocalSearchParams } from 'expo-router'
import { PublicCmsScreen } from '../../modules/cms/PublicCmsScreen'

export default function Route() {
  const { slug } = useLocalSearchParams()
  return <PublicCmsScreen slug={Array.isArray(slug) ? slug[0] : slug} />
}
