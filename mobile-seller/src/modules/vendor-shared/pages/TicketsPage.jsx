import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Badge, Button, Input, Modal, Select, Text, Textarea } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { toast } from '../../../lib/toast'
import { TutorialsPanel } from '../../../components/common/TutorialsPanel'
import { useVendorTicketController, useVendorTicketsController } from '../controllers/useVendorController'
import { colors } from '../../../theme'

const EMPTY_FORM = { subject: '', category: 'Other', priority: 'normal', message: '' }

const VIEW_TABS = [
  { id: 'tickets', label: 'My tickets' },
  { id: 'tutorials', label: 'Tutorials' },
]

const CATEGORY_OPTIONS = [
  { value: 'Payout', label: 'Payout / Settlement' },
  { value: 'Order', label: 'Order Issue' },
  { value: 'Account', label: 'Account' },
  { value: 'Other', label: 'Other' },
]

function TicketThread({ ticketId, onClose }) {
  const { ticket, isLoading, reply } = useVendorTicketController(ticketId)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  async function handleReply() {
    if (!message.trim() || isSending) return
    setIsSending(true)
    try {
      await reply(message.trim())
      toast.success('Reply sent')
      setMessage('')
    } catch (err) {
      toast.error('Could not send message', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Modal isOpen={Boolean(ticketId)} onClose={onClose} title={ticket ? `${ticket.ticketId} — ${ticket.subject}` : 'Ticket'} size="lg">
      {isLoading || !ticket ? (
        <Text style={styles.note}>Loading…</Text>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge tone="brand" size="sm">
              {ticket.status}
            </Badge>
            <Badge tone="neutral" size="sm">
              {ticket.category}
            </Badge>
          </View>
          <ScrollView style={styles.thread} contentContainerStyle={{ gap: 8 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {ticket.messages.map((m) => (
              <View key={m.id || m.createdAt} style={[styles.bubble, m.sender === 'vendor' ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={styles.sender}>{m.senderName}</Text>
                <Text style={styles.msg}>{m.message}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Textarea containerStyle={{ flex: 1 }} rows={2} placeholder="Type a reply…" value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button onClick={handleReply} isLoading={isSending}>
              Send
            </Button>
          </View>
        </View>
      )}
    </Modal>
  )
}

export function TicketsPage() {
  const { items, isLoading, createTicket } = useVendorTicketsController()
  const [view, setView] = useState('tickets')
  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [activeTicketId, setActiveTicketId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  async function handleCreate() {
    if (isCreating) return
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Missing fields', 'Fill in subject and message.')
      return
    }
    setIsCreating(true)
    try {
      await createTicket(form)
      toast.success('Ticket raised', 'Admin has been notified.')
      setCreateOpen(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error('Could not raise ticket', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsCreating(false)
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

      <View style={styles.viewTabs}>
        {VIEW_TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setView(t.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: view === t.id }}
            style={[styles.viewTab, view === t.id && { backgroundColor: colors.brand[600] }]}
          >
            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: view === t.id ? '#fff' : colors.ink.muted }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'tutorials' ? <TutorialsPanel audience="seller" /> : null}

      {view === 'tickets' && isLoading ? <Text style={styles.note}>Loading tickets…</Text> : null}
      {view === 'tickets' && !isLoading && items.length === 0 ? <Text style={styles.note}>No support tickets yet.</Text> : null}

      {view === 'tickets' ? (
        <View style={{ gap: 8 }}>
          {items.map((t) => (
            <Pressable key={t._id} onPress={() => setActiveTicketId(t._id)} accessibilityRole="button" style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{t.subject}</Text>
                <Text style={styles.rowMeta}>
                  {t.ticketId} · {t.category} · {t.raisedByRole === 'vendor' ? 'Raised by you' : `Raised by ${t.name}`}
                </Text>
              </View>
              <Badge tone={t.status === 'open' ? 'warning' : t.status === 'resolved' ? 'success' : 'neutral'} size="sm">
                {t.status}
              </Badge>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Raise a support ticket"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={isCreating}>
              Submit
            </Button>
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATEGORY_OPTIONS} />
          <Textarea label="Message" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </View>
      </Modal>

      <TicketThread ticketId={activeTicketId} onClose={() => setActiveTicketId(null)} />
    </PageBody>
  )
}

const styles = StyleSheet.create({
  note: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  viewTabs: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 4,
  },
  viewTab: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 14,
  },
  rowTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  rowMeta: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  thread: { maxHeight: 320, borderRadius: 8, borderWidth: 1, borderColor: colors.border.DEFAULT, padding: 12 },
  bubble: { borderRadius: 6, padding: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.brand[50] },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surface.muted },
  sender: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  msg: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.muted },
})
