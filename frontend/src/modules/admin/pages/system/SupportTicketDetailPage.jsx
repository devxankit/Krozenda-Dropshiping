import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Checkbox, Select, Textarea } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { SectionCard, KeyValueList } from '../../components/display'
import {
  useSupportTicketDetailController,
  useSupportTicketWriteController,
} from '../../controllers/useSystemController'
import { PRIORITY_TONE, TICKET_TONE } from '../../tableColumns/systemColumns'

const SENDER_LABEL = Object.freeze({
  user: 'Customer',
  vendor: 'Seller',
  agent: 'Admin',
  system: 'System',
})

function MessageBubble({ message }) {
  const isSystem = message.sender === 'system'
  const isAgent = message.sender === 'agent'

  if (isSystem) {
    return (
      <div className="my-1 text-center text-2xs text-ink-faint">
        {message.message}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${isAgent ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1.5 text-2xs text-ink-faint">
        <span className="font-medium text-ink-subtle">{message.senderName || SENDER_LABEL[message.sender]}</span>
        <span>·</span>
        <span>{new Date(message.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        {message.isInternal && (
          <Badge tone="warning" size="sm">
            Internal note
          </Badge>
        )}
      </div>
      <div
        className={`max-w-[32rem] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          message.isInternal
            ? 'border border-warning-200 bg-warning-50 text-warning-900'
            : isAgent
              ? 'bg-brand-600 text-white'
              : 'border border-border bg-surface-subtle text-ink-default'
        }`}
      >
        {message.message}
      </div>
    </div>
  )
}

export function SupportTicketDetailPage() {
  const { ticketId } = useParams()
  const { data: ticket, isLoading, error, refetch } = useSupportTicketDetailController(ticketId)
  const write = useSupportTicketWriteController()

  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }
  if (error || !ticket) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const isClosed = ticket.status === 'closed'
  const targetLabel = ticket.targetRole === 'vendor' ? 'Seller' : 'Admin'

  const submitReply = () => {
    const message = reply.trim()
    if (!message) return
    write.sendMessage.run(
      { id: ticket.ticketId, message, isInternal },
      { onSuccess: () => setReply('') },
    )
  }

  return (
    <PageBody>
      <PageHeader
        title={ticket.subject}
        trail={[{ label: ticket.ticketId }]}
        actions={
          <Select
            id="ticket-status"
            size="sm"
            value={ticket.status}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'waiting', label: 'Waiting' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
            onChange={(event) => write.setStatus.run({ id: ticket.ticketId, status: event.target.value })}
            disabled={write.setStatus.isSubmitting}
          />
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={TICKET_TONE[ticket.status]} size="sm" dot>
            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
          </Badge>
          <Badge tone={PRIORITY_TONE[ticket.priority]} size="sm" dot={ticket.priority !== 'low'}>
            {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
          </Badge>
          <Badge tone={ticket.party === 'seller' ? 'accent' : 'neutral'} size="sm">
            {ticket.party === 'seller' ? 'Raised by seller' : 'Raised by buyer'}
          </Badge>
          {ticket.escalatedToAdmin && (
            <Badge tone="danger" size="sm" dot>
              Escalated to Admin
            </Badge>
          )}
          <span className="text-border-strong">·</span>
          <span>Currently with {targetLabel}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="Conversation" description="Every message here is saved to the ticket thread">
            <div className="flex flex-col gap-3 px-4 py-4">
              {ticket.messages.length === 0 ? (
                <p className="text-xs text-ink-faint">No messages yet.</p>
              ) : (
                ticket.messages.map((message) => <MessageBubble key={message.id || message.createdAt} message={message} />)
              )}
            </div>
          </SectionCard>

          <SectionCard title="Reply">
            <div className="flex flex-col gap-3 px-4 py-4">
              <Textarea
                id="ticket-reply"
                rows={3}
                placeholder={isClosed ? 'This ticket is closed — reopen it to reply.' : 'Write a reply…'}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                disabled={isClosed}
              />
              <div className="flex items-center justify-between">
                <Checkbox
                  id="ticket-internal-note"
                  label="Internal note (not visible to customer/seller)"
                  checked={isInternal}
                  onChange={(event) => setIsInternal(event.target.checked)}
                  disabled={isClosed}
                />
                <Button
                  size="control"
                  icon="send"
                  onClick={submitReply}
                  disabled={isClosed || !reply.trim() || write.sendMessage.isSubmitting}
                >
                  {isInternal ? 'Add note' : 'Send reply'}
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="Details">
            <div className="px-4 py-4">
              <KeyValueList
                items={[
                  { label: 'Raised by', value: ticket.name },
                  { label: 'Email', value: ticket.email || '—' },
                  { label: 'Phone', value: ticket.phone || '—' },
                  { label: 'Category', value: ticket.category },
                  { label: 'Order', value: ticket.orderNumber || '—' },
                  { label: 'Product', value: ticket.productName || '—' },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Assign" description="Who on the team owns this ticket">
            <div className="flex flex-col gap-2 px-4 py-4">
              <input
                id="ticket-owner"
                type="text"
                defaultValue={ticket.owner || ''}
                placeholder="Unassigned"
                className="h-9 rounded-md border border-border bg-surface px-3 text-xs text-ink-default outline-none focus:border-brand-500"
                onBlur={(event) => {
                  const owner = event.target.value.trim()
                  if (owner !== (ticket.owner || '')) {
                    write.assign.run({ id: ticket.ticketId, owner: owner || null })
                  }
                }}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </PageBody>
  )
}
