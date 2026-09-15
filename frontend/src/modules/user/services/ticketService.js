// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'

const LOCAL_STORAGE_TICKETS_KEY = 'krozenda_user_ticket_ids'

function getLocalTicketIds() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TICKETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalTicketId(id) {
  try {
    const ids = getLocalTicketIds()
    if (!ids.includes(id)) {
      ids.unshift(id)
      localStorage.setItem(LOCAL_STORAGE_TICKETS_KEY, JSON.stringify(ids.slice(0, 50)))
    }
  } catch {}
}

export async function fetchUserTickets(params = {}) {
  const localIds = getLocalTicketIds()
  const query = { ...params }
  if (localIds.length > 0) {
    query.ids = localIds.join(',')
  }

  const response = await api.get('/user/tickets', { params: query })
  return response.data?.data || { items: [], total: 0, counts: { all: 0, open: 0, resolved: 0, closed: 0 } }
}

export async function createSupportTicket(payload) {
  const response = await api.post('/user/tickets', payload)
  const ticket = response.data?.data
  if (ticket?.ticketId) {
    saveLocalTicketId(ticket.ticketId)
  }
  return ticket
}

export async function fetchTicketDetails(id) {
  const response = await api.get(`/user/tickets/${encodeURIComponent(id)}`)
  return response.data?.data
}

export async function sendTicketMessage(id, message, senderName) {
  const response = await api.post(`/user/tickets/${encodeURIComponent(id)}/messages`, {
    message,
    senderName,
  })
  return response.data?.data
}

export async function updateTicketStatus(id, status, note) {
  const response = await api.patch(`/user/tickets/${encodeURIComponent(id)}/status`, {
    status,
    note,
  })
  return response.data?.data
}
