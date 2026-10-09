import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { fetchTicketDetails, sendTicketMessage, updateTicketStatus } from '../../services/ticketService'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../../lib/toast'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'
import { Gradient } from './Gradient'

const STATUS_BADGES = {
  open: { label: 'Open', bg: colors.sky[50], fg: colors.sky[700], border: colors.sky[200] },
  waiting: { label: 'In Review', bg: colors.purple[50], fg: colors.purple[700], border: colors.purple[200] },
  resolved: { label: 'Resolved', bg: colors.emerald[50], fg: colors.emerald[700], border: colors.emerald[200] },
  closed: { label: 'Closed', bg: colors.slate[100], fg: colors.slate[600], border: colors.slate[200] },
}

const PRIORITY_BADGES = {
  low: { label: 'Low Priority', fg: colors.slate[500] },
  normal: { label: 'Normal Priority', fg: colors.blue[600] },
  high: { label: 'High Priority', fg: colors.amber[600] },
  urgent: { label: 'Urgent Priority', fg: colors.rose[600] },
}

export function TicketDetailsModal({ ticketId, isOpen, onClose, onTicketUpdated }) {
  const user = useAuthStore((s) => s.user)

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showResolveConfirm, setShowResolveConfirm] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')

  const scrollRef = useRef(null)

  const loadTicket = async (id) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await fetchTicketDetails(id)
      setTicket(data)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load ticket details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && ticketId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load the ticket when the modal opens
      loadTicket(ticketId)
    } else {
      setTicket(null)
      setReplyText('')
      setShowResolveConfirm(false)
      setResolutionNote('')
    }
  }, [isOpen, ticketId])

  useEffect(() => {
    if (ticket?.messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [ticket?.messages])

  const handleSendReply = async () => {
    if (!replyText.trim()) return

    setSendingReply(true)
    setErrorMsg('')
    try {
      const updated = await sendTicketMessage(ticket.ticketId || ticket.id, replyText.trim(), user?.name || ticket.name || 'Customer')
      setTicket(updated)
      setReplyText('')
      toast.success('Message Sent', 'Your message was added to this ticket.')
      if (onTicketUpdated) onTicketUpdated(updated)
    } catch (err) {
      const msg = err.message || 'Failed to send message. Please try again.'
      setErrorMsg(msg)
      toast.error('Could not send message', err)
    } finally {
      setSendingReply(false)
    }
  }

  const handleUpdateStatus = async (newStatus, note = '') => {
    setUpdatingStatus(true)
    setErrorMsg('')
    try {
      const updated = await updateTicketStatus(ticket.ticketId || ticket.id, newStatus, note)
      setTicket(updated)
      setShowResolveConfirm(false)
      toast.success('Ticket Updated', `Status changed to ${newStatus}.`)
      if (onTicketUpdated) onTicketUpdated(updated)
    } catch (err) {
      const msg = err.message || 'Failed to update ticket status.'
      setErrorMsg(msg)
      toast.error('Could not update status', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const isResolvedOrClosed = ticket?.status === 'resolved' || ticket?.status === 'closed'
  const statusBadge = STATUS_BADGES[ticket?.status] || STATUS_BADGES.open
  const priorityBadge = PRIORITY_BADGES[ticket?.priority] || PRIORITY_BADGES.normal

  return (
    <Sheet visible={isOpen} onClose={onClose} variant="center" maxHeight="90%">
      {/* Header */}
      <View style={{ padding: 20 }}>
        <Gradient id="ticketHead" stops={[[0, colors.slate[900]], [0.5, colors.blue[950]], [1, colors.indigo[950]]]} />
        <View style={{ gap: 12, paddingRight: 40 }}>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <Text noTranslate style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: '800', color: colors.amber[400], letterSpacing: 0.3 }}>
                #{ticket?.ticketId || ticketId}
              </Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 2, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.slate[200] }}>{ticket?.category || 'Support'}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: priorityBadge.fg }}>{priorityBadge.label}</Text>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 18, lineHeight: 28, fontWeight: '800', color: '#fff' }}>
              {ticket?.subject || 'Loading ticket...'}
            </Text>
          </View>

          {ticket ? (
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
              ]}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusBadge.fg, marginRight: 6 }} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: statusBadge.fg }}>{statusBadge.label}</Text>
            </View>
          ) : null}
        </View>

        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Icon name="HiXMark" size={20} color={colors.slate[400]} />
        </Pressable>
      </View>

      {/* Status lifecycle */}
      {ticket ? (
        <View style={styles.timeline}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.slate[400] }}>Timeline:</Text>
            <Text style={[styles.step, { backgroundColor: colors.blue[100], color: colors.blue[800] }]}>1. Created</Text>
            <Text noTranslate style={{ color: colors.slate[300] }}>
              →
            </Text>
            <Text
              style={[
                styles.step,
                ticket.status === 'open'
                  ? { backgroundColor: colors.slate[200], color: colors.slate[500] }
                  : { backgroundColor: colors.purple[100], color: colors.purple[800] },
              ]}
            >
              2. In Review
            </Text>
            <Text noTranslate style={{ color: colors.slate[300] }}>
              →
            </Text>
            <Text
              style={[
                styles.step,
                isResolvedOrClosed
                  ? { backgroundColor: colors.emerald[100], color: colors.emerald[800] }
                  : { backgroundColor: colors.slate[200], color: colors.slate[500] },
              ]}
            >
              {`3. ${ticket.status === 'closed' ? 'Closed' : 'Resolved'}`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {!isResolvedOrClosed ? (
              <Pressable
                onPress={() => setShowResolveConfirm(true)}
                disabled={updatingStatus}
                style={({ pressed }) => [
                  styles.quickBtn,
                  shadows.xs,
                  { backgroundColor: pressed ? colors.emerald[700] : colors.emerald[600], opacity: updatingStatus ? 0.5 : 1 },
                ]}
              >
                <Icon name="HiCheckCircle" size={16} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Mark as Resolved</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => handleUpdateStatus('open')}
                disabled={updatingStatus}
                style={({ pressed }) => [
                  styles.quickBtn,
                  shadows.xs,
                  { backgroundColor: pressed ? colors.amber[600] : colors.amber[500], opacity: updatingStatus ? 0.5 : 1 },
                ]}
              >
                <Icon name="HiArrowPath" size={16} color={colors.slate[950]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[950] }}>Reopen Ticket</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {/* Resolve confirmation */}
      {showResolveConfirm ? (
        <View style={styles.confirm}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.emerald[900] }}>
                Are you satisfied with the resolution of this issue?
              </Text>
              <Text style={{ fontSize: 11, color: colors.emerald[700], marginTop: 2 }}>
                Marking this ticket as resolved lets our team know your issue has been settled. You can still reopen it anytime if you need more assistance.
              </Text>
            </View>
            <Pressable onPress={() => setShowResolveConfirm(false)}>
              <Icon name="HiXMark" size={16} color={colors.emerald[700]} />
            </Pressable>
          </View>
          <TextInput
            value={resolutionNote}
            onChangeText={setResolutionNote}
            placeholder="Optional closing remark (e.g. Received replacement item, refund credited)"
            placeholderTextColor={colors.slate[400]}
            style={styles.noteInput}
          />
          <Pressable
            onPress={() => handleUpdateStatus('resolved', resolutionNote)}
            disabled={updatingStatus}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: pressed ? colors.emerald[800] : colors.emerald[700], opacity: updatingStatus ? 0.6 : 1 },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Confirm Resolved</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Order reference */}
      {ticket?.orderNumber ? (
        <View style={styles.orderRef}>
          <Icon name="HiShoppingBag" size={16} color={colors.blue[600]} />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.blue[900] }}>
            {'Associated with Order #'}
            <Text noTranslate style={{ fontSize: 12, fontWeight: '600', color: colors.blue[900] }}>
              {ticket.orderNumber}
            </Text>
          </Text>
        </View>
      ) : null}

      {/* Error */}
      {errorMsg ? (
        <View style={styles.errorBar}>
          <Icon name="HiExclamationTriangle" size={16} color={colors.rose[700]} />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.rose[700] }}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={{ flexShrink: 1, backgroundColor: 'rgba(248,250,252,0.5)' }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        {loading ? (
          <View style={{ gap: 16 }}>
            <Skeleton style={{ height: 56, width: '70%', borderRadius: 16 }} />
            <Skeleton style={{ height: 40, width: '55%', borderRadius: 16, alignSelf: 'flex-end' }} />
            <Skeleton style={{ height: 72, width: '75%', borderRadius: 16 }} />
          </View>
        ) : !ticket?.messages?.length ? (
          <Text style={{ paddingVertical: 48, textAlign: 'center', fontSize: 12, color: colors.slate[400] }}>
            No messages recorded yet for this ticket.
          </Text>
        ) : (
          ticket.messages.map((m, idx) => {
            const isUser = m.sender === 'user'
            const isSystem = m.sender === 'system'
            const msgDate = m.createdAt
              ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
              : ''

            if (isSystem) {
              return (
                <View key={idx} style={{ alignItems: 'center', marginVertical: 6 }}>
                  <View style={[styles.system, shadows['2xs']]}>
                    <Icon name="HiShieldCheck" size={14} color={colors.slate[500]} />
                    <Text style={{ flexShrink: 1, fontSize: 11, fontWeight: '600', color: colors.slate[600] }}>{m.message}</Text>
                    <Text noTranslate style={{ fontSize: 11, color: colors.slate[400] }}>
                      · {msgDate}
                    </Text>
                  </View>
                </View>
              )
            }

            return (
              <View key={idx} style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.slate[700] }}>
                    {isUser ? m.senderName || 'You (Customer)' : m.senderName || 'Krozenda Support Specialist'}
                  </Text>
                  {!isUser ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.indigo[100], borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: colors.indigo[800], textTransform: 'uppercase' }}>Support Staff</Text>
                    </View>
                  ) : null}
                  <Text noTranslate style={{ fontSize: 10, fontWeight: '500', color: colors.slate[400] }}>
                    {msgDate}
                  </Text>
                </View>

                <View
                  style={[
                    styles.bubble,
                    shadows.xs,
                    isUser
                      ? { backgroundColor: colors.blue[600], borderTopRightRadius: 0 }
                      : { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', borderTopLeftRadius: 0 },
                  ]}
                >
                  <Text noTranslate style={{ fontSize: 12, lineHeight: 19.5, fontWeight: '500', color: isUser ? '#fff' : colors.slate[800] }}>
                    {m.message}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Resolved banner */}
      {isResolvedOrClosed ? (
        <View style={styles.resolved}>
          <Icon name="HiCheckCircle" size={20} color={colors.emerald[600]} />
          <Text style={{ flex: 1, fontSize: 12, color: colors.emerald[800] }}>
            {'This ticket was marked as '}
            <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: colors.emerald[800] }}>
              {ticket.status}
            </Text>
            {'. If your issue persists, you can send a reply or click "Reopen Ticket".'}
          </Text>
        </View>
      ) : null}

      {/* Reply input */}
      <View style={styles.replyBar}>
        <TextInput
          value={replyText}
          onChangeText={setReplyText}
          placeholder={
            isResolvedOrClosed
              ? 'Type a message to reopen and ask further questions...'
              : 'Type a message or provide additional details...'
          }
          placeholderTextColor={colors.slate[400]}
          returnKeyType="send"
          onSubmitEditing={handleSendReply}
          style={styles.replyInput}
        />
        <Pressable
          onPress={handleSendReply}
          disabled={!replyText.trim() || sendingReply}
          style={({ pressed }) => [
            styles.replyBtn,
            shadows.sm,
            { backgroundColor: pressed ? colors.blue[800] : colors.blue[700], opacity: !replyText.trim() || sendingReply ? 0.4 : 1 },
          ]}
        >
          {sendingReply ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Sending...</Text>
          ) : (
            <>
              <Icon name="HiPaperAirplane" size={16} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Reply</Text>
            </>
          )}
        </Pressable>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  closeBtn: { position: 'absolute', right: 16, top: 16, padding: 8, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.1)' },
  timeline: {
    backgroundColor: colors.slate[50],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  step: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 11, fontWeight: '700', overflow: 'hidden', fontFamily: fontFamilyFor('700') },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.xl },
  confirm: { backgroundColor: colors.emerald[50], borderBottomWidth: 1, borderBottomColor: colors.emerald[200], padding: 16, gap: 12 },
  noteInput: {
    height: 36,
    paddingHorizontal: 12,
    paddingVertical: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.emerald[300],
    borderRadius: radius.xl,
    fontSize: 12,
    color: colors.slate[800],
    fontFamily: fontFamilyFor('400'),
  },
  confirmBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.xl },
  orderRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(239,246,255,0.5)',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.rose[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.rose[200],
  },
  system: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(226,232,240,0.8)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 9999, maxWidth: '100%' },
  bubble: { maxWidth: '88%', padding: 16, borderRadius: radius['2xl'] },
  resolved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.emerald[50],
    borderTopWidth: 1,
    borderTopColor: colors.emerald[200],
  },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.slate[200] },
  replyInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    paddingVertical: 0,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius['2xl'],
    fontSize: 12,
    color: colors.slate[800],
    fontFamily: fontFamilyFor('500'),
  },
  replyBtn: { height: 40, paddingHorizontal: 18, borderRadius: radius['2xl'], flexDirection: 'row', alignItems: 'center', gap: 8 },
})
