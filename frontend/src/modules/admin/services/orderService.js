// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { fetchResource } from './mockTransport'
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
    schema: orderListSchema,
    live: true,
  })
}

export function fetchOrderDetail(orderId) {
  return fetchResource({
    path: `/admin/orders/${orderId}`,
    schema: orderDetailSchema,
    live: true,
  })
}

export async function createOrder(payload) {
  const { data } = await api.post('/admin/orders', payload)
  return orderDetailSchema.parse(data.data)
}

// Super admin only; the server refuses anything but a cancelled order no
// money ever moved for, and says why.
export async function deleteOrder({ id }) {
  const { data } = await api.delete(`/admin/orders/${id}`)
  return data.data
}

export async function updateOrderStatus({ id, status }) {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status })
  return orderDetailSchema.parse(data.data)
}
