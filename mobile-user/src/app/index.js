import { Redirect } from 'expo-router'
import { USER_ROUTES } from '../config/routes'

export default function Index() {
  return <Redirect href={USER_ROUTES.DASHBOARD} />
}
