// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import { orderDetailFixture, orderListFixture } from '../fixtures/orders'
import { orderDetailSchema, orderListSchema } from '../schemas/orderSchema'

export function fetchOrders(query) {
  return fetchResource({
    path: '/admin/orders',
    params: {
      tab: query.tab,
      page: query.page,
      rowsPerPage: query.rowsPerPage,
      sort: query.sort ? `${query.sort.key}:${query.sort.direction}` : undefined,
      ...query.filters,
    },
    fixture: () => orderListFixture(query),
    schema: orderListSchema,
  })
}

export function fetchOrderDetail(orderId) {
  return fetchResource({
    path: `/admin/orders/${orderId}`,
    fixture: () => orderDetailFixture(orderId),
    schema: orderDetailSchema,
  })
}
