import { Redirect } from 'expo-router'
import { USER_ROUTES } from '../config/routes'

// Web: <Route path="*" element={<Navigate to=/app/dashboard replace />} />
export default function NotFound() {
  return <Redirect href={USER_ROUTES.DASHBOARD} />
}
