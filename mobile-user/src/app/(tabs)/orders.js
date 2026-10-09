import { RequireAuth } from '../../components/layout/RequireAuth'
import { OrderListScreen } from '../../modules/user/components/orders/OrderListScreen'

export default function Route() {
  return (
    <RequireAuth>
      <OrderListScreen />
    </RequireAuth>
  )
}
