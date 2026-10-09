import { RequireAuth } from '../../components/layout/RequireAuth'
import { ProfileDashboardScreen } from '../../modules/user/components/profile/ProfileDashboardScreen'

export default function Route() {
  return (
    <RequireAuth>
      <ProfileDashboardScreen />
    </RequireAuth>
  )
}
