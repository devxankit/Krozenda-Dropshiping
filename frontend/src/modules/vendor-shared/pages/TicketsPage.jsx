import { useState } from 'react'
import { Badge, Button, Input, Modal, Select, Textarea } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { toast } from '../../admin/stores/toastStore'
import { useVendorTicketController, useVendorTicketsController } from '../controllers/useVendorController'

const EMPTY_FORM = { subject: '', category: 'Other', priority: 'normal', message: '' }

function TicketThread({ ticketId, onClose }) {
  const { ticket, isLoading, reply } = useVendorTicketController(ticketId)
  const [message, setMessage] = useState('')

  async function handleReply() {
    if (!message.trim()) return
    try {
      await reply(message.trim())
      setMessage('')
    } catch (err) {
      toast.error('Could not send message', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <Modal isOpen={Boolean(ticketId)} onClose={onClose} title={ticket ? `${ticket.ticketId} — ${ticket.subject}` : 'Ticket'} size="lg">
      {isLoading || !ticket ? (
        <p className="text-xs text-ink-subtle">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="brand" size="sm">{ticket.status}</Badge>
            <Badge tone="neutral" size="sm">{ticket.category}</Badge>
          </div>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto admin-scroll rounded-lg border border-border p-3">
            {ticket.messages.map((m) => (
              <div key={m.id || m.createdAt} className={`rounded-md p-2.5 text-xs ${m.sender === 'vendor' ? 'bg-brand-50 self-end' : 'bg-surface-muted'}`}>
                <p className="font-semibold text-slate-900">{m.senderName}</p>
                <p className="mt-0.5 text-ink-muted">{m.message}</p>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Textarea rows={2} placeholder="Type a reply…" value={message} onChange={(e) => setMessage(e.target.value)} className="flex-1" />
            <Button onClick={handleReply}>Send</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function TicketsPage() {
  const { items, isLoading, createTicket } = useVendorTicketsController()
  const [createOpen, setCreateOpen] = useState(false)
  const [activeTicketId, setActiveTicketId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  async function handleCreate() {
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Missing fields', 'Fill in subject and message.')
      return
    }
    try {
      await createTicket(form)
      toast.success('Ticket raised', 'Admin has been notified.')
      setCreateOpen(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error('Could not raise ticket', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Support Tickets"
        description="Raise issues with Admin, and see tickets customers raised about your products."
        actions={
          <Button size="sm" icon="add" onClick={() => setCreateOpen(true)}>
            New ticket
          </Button>
        }
      />

      {isLoading && <p className="text-xs text-ink-subtle">Loading tickets…</p>}
      {!isLoading && items.length === 0 && <p className="text-xs text-ink-subtle">No support tickets yet.</p>}

      <div className="flex flex-col gap-2">
        {items.map((t) => (
          <button key={t._id} onClick={() => setActiveTicketId(t._id)} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5 text-left hover:border-brand-300">
            <div>
              <p className="text-xs font-semibold text-slate-900">{t.subject}</p>
              <p className="text-2xs text-ink-subtle">{t.ticketId} · {t.category} · {t.raisedByRole === 'vendor' ? 'Raised by you' : `Raised by ${t.name}`}</p>
            </div>
            <Badge tone={t.status === 'open' ? 'warning' : t.status === 'resolved' ? 'success' : 'neutral'} size="sm">{t.status}</Badge>
          </button>
        ))}
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Raise a support ticket"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Submit</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={[
              { value: 'Payout', label: 'Payout / Settlement' },
              { value: 'Order', label: 'Order Issue' },
              { value: 'Account', label: 'Account' },
              { value: 'Other', label: 'Other' },
            ]}
          />
          <Textarea label="Message" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>
      </Modal>

      <TicketThread ticketId={activeTicketId} onClose={() => setActiveTicketId(null)} />
    </PageBody>
  )
}
