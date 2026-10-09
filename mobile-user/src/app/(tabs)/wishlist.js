import { RequireAuth } from '../../components/layout/RequireAuth'
import { WishlistScreen } from '../../modules/user/components/profile/WishlistScreen'

export default function Route() {
  return (
    <RequireAuth>
      <WishlistScreen />
    </RequireAuth>
  )
}
