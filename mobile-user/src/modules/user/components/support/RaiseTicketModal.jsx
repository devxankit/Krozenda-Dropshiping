import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { createSupportTicket } from '../../services/ticketService'
import { fetchUserOrders } from '../../services/orderService'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../../lib/toast'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'
import { Gradient } from './Gradient'

const CATEGORIES = [
  { id: 'Orders & Delivery', label: 'Order & Delivery', icon: 'HiShoppingBag', desc: 'Delay, courier tracking, wrong address' },
  { id: 'Returns & Refunds', label: 'Returns & Refunds', icon: 'HiArrowPath', desc: 'Return request, pickup, refund status' },
  { id: 'Payments & Billing', label: 'Payment & Billing', icon: 'HiCreditCard', desc: 'Payment failed, UPI, invoice download' },
  { id: 'Damaged or Defective Item', label: 'Damaged / Defective', icon: 'HiExclamationCircle', desc: 'Broken, missing parts, wrong item' },
  { id: 'Account & Security', label: 'Account & Security', icon: 'HiShieldCheck', desc: 'OTP issue, password, profile' },
  { id: 'General Inquiry', label: 'General Inquiry', icon: 'HiQuestionMarkCircle', desc: 'Offers, feedback, general queries' },
]

const PRIORITIES = [
  { id: 'low', label: 'Low', fg: colors.slate[600], bg: colors.slate[100], border: colors.slate[200] },
  { id: 'normal', label: 'Normal', fg: colors.blue[700], bg: colors.blue[50], border: colors.blue[200] },
  { id: 'high', label: 'High', fg: colors.amber[700], bg: colors.amber[50], border: colors.amber[200] },
  { id: 'urgent', label: 'Urgent', fg: colors.rose[700], bg: colors.rose[50], border: colors.rose[200] },
]

export function RaiseTicketModal({ isOpen, onClose, onTicketCreated }) {
  const user = useAuthStore((s) => s.user)

  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [priority, setPriority] = useState('normal')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [customOrderNumber, setCustomOrderNumber] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [orders, setOrders] = useState([])
  const [, setOrdersLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [orderPickerOpen, setOrderPickerOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (user) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the form each time the modal opens
        setName(user.name || '')
        setEmail(user.email || '')
        setPhone(user.mobileNumber || user.phone || '')
      }
      // Load user orders for the order picker
      setOrdersLoading(true)
      fetchUserOrders()
        .then((items) => setOrders(items || []))
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false))
    } else {
      // Reset form
      setSubject('')
      setDescription('')
      setSelectedOrderId('')
      setCustomOrderNumber('')
      setErrorMsg('')
    }
  }, [isOpen, user])

  const orderLabel = (ord) => {
    const ordId = ord.id || ord._id
    const ordTotal = ord.total ? `₹${ord.total}` : ''
    const ordDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-GB') : ''
    return `Order #${ordId.slice(-8)} ${ordTotal ? `• ${ordTotal}` : ''} ${ordDate ? `• ${ordDate}` : ''}`
  }

  const handleSubmit = async () => {
    setErrorMsg('')

    if (!subject.trim()) {
      setErrorMsg('Please enter a brief subject for your issue.')
      return
    }
    if (!description.trim()) {
      setErrorMsg('Please provide a detailed description so our team can help you.')
      return
    }

    setSubmitting(true)
    try {
      const selectedOrder = orders.find((o) => (o.id || o._id) === selectedOrderId)
      const orderNumber = selectedOrder
        ? selectedOrder.orderNumber || selectedOrder.id || selectedOrder._id
        : customOrderNumber.trim()

      const payload = {
        subject: subject.trim(),
        category,
        priority,
        message: description.trim(),
        orderId: selectedOrderId || undefined,
        orderNumber: orderNumber || undefined,
        name: name.trim() || 'Customer',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }

      const newTicket = await createSupportTicket(payload)
      if (onTicketCreated) {
        onTicketCreated(newTicket)
      }
      toast.success('Ticket Raised', 'Our support team has been notified.')
      onClose()
    } catch (err) {
      const msg = err.message || 'Failed to raise support ticket. Please try again.'
      setErrorMsg(msg)
      toast.error('Could not create ticket', err)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedOrder = orders.find((o) => (o.id || o._id) === selectedOrderId)

  return (
    <Sheet visible={isOpen} onClose={onClose} variant="center" maxHeight="92%">
      {/* Header */}
      <View style={{ padding: 24 }}>
        <Gradient id="raiseHead" stops={[[0, colors.blue[900]], [0.5, colors.indigo[900]], [1, colors.blue[950]]]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 40 }}>
          <View style={styles.headIcon}>
            <Icon name="HiTicket" size={24} color={colors.slate[950]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '800', color: '#fff' }}>Raise a Support Ticket</Text>
            <Text style={{ fontSize: 12, color: colors.blue[200] }}>
              Our support team is active 24/7 to resolve your inquiries promptly.
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Icon name="HiXMark" size={20} color={colors.blue[200]} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 24 }}>
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Icon name="HiExclamationCircle" size={16} color={colors.rose[700]} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.rose[700] }}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* 1. Category */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>
            1. Select Issue Category
            <Text noTranslate style={{ color: colors.rose[500] }}>
              {' *'}
            </Text>
          </Text>
          <View style={{ gap: 10 }}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={[
                    styles.cat,
                    isSelected
                      ? [{ borderColor: colors.blue[600], backgroundColor: 'rgba(239,246,255,0.7)', borderWidth: 2 }, shadows.xs]
                      : { borderColor: colors.slate[200], backgroundColor: '#fff' },
                  ]}
                >
                  <View style={[styles.catIcon, { backgroundColor: isSelected ? colors.blue[600] : colors.slate[100] }]}>
                    <Icon name={cat.icon} size={16} color={isSelected ? '#fff' : colors.slate[600]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, lineHeight: 15, fontWeight: '700', color: isSelected ? colors.blue[900] : colors.slate[700] }}>
                      {cat.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.slate[400], marginTop: 2 }}>{cat.desc}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* 2. Priority */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>2. Priority Level</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PRIORITIES.map((p) => {
              const isSelected = priority === p.id
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPriority(p.id)}
                  style={[
                    styles.prio,
                    isSelected
                      ? [{ backgroundColor: p.bg, borderColor: colors.blue[400], borderWidth: 2 }, shadows.xs]
                      : { borderColor: colors.slate[200], backgroundColor: '#fff' },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: isSelected ? '800' : '700', color: isSelected ? p.fg : colors.slate[600] }}>
                    {p.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* 3. Linked order */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>
            3. Link Related Order <Text style={{ fontSize: 12, color: colors.slate[400] }}>(Optional)</Text>
          </Text>
          {orders.length > 0 ? (
            <Pressable onPress={() => setOrderPickerOpen(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text noTranslate={!!selectedOrder} numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.slate[800] }}>
                {selectedOrder ? orderLabel(selectedOrder) : '-- No specific order / General inquiry --'}
              </Text>
              <Icon name="HiChevronDown" size={16} color={colors.slate[400]} />
            </Pressable>
          ) : (
            <TextInput
              value={customOrderNumber}
              onChangeText={setCustomOrderNumber}
              placeholder="Enter Order ID if applicable (e.g. ORD-9821)"
              placeholderTextColor={colors.slate[400]}
              style={styles.input}
            />
          )}
        </View>

        {/* 4. Subject */}
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>
            4. Subject / Issue Title
            <Text noTranslate style={{ color: colors.rose[500] }}>
              {' *'}
            </Text>
          </Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g., Courier tracking shows delivered but not received"
            placeholderTextColor={colors.slate[400]}
            maxLength={120}
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.hint}>Be concise and clear</Text>
            <Text noTranslate style={styles.hint}>
              {subject.length}/120
            </Text>
          </View>
        </View>

        {/* 5. Description */}
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>
            5. Detailed Description
            <Text noTranslate style={{ color: colors.rose[500] }}>
              {' *'}
            </Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Please explain the issue in detail, including what happened, expected resolution, or any reference numbers..."
            placeholderTextColor={colors.slate[400]}
            maxLength={1500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.input, { minHeight: 100, paddingTop: 12, lineHeight: 19, fontFamily: fontFamilyFor('500') }]}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[styles.hint, { flex: 1 }]}>Provide all relevant details to help us solve this faster</Text>
            <Text noTranslate style={styles.hint}>
              {description.length}/1500
            </Text>
          </View>
        </View>

        {/* Contact details (guest only) */}
        {!user ? (
          <View style={styles.contact}>
            <Text style={styles.label}>Your Contact Information (for updates)</Text>
            <TextInput
              placeholder="Your Full Name *"
              placeholderTextColor={colors.slate[400]}
              value={name}
              onChangeText={setName}
              style={[styles.input, styles.contactInput]}
            />
            <TextInput
              placeholder="Email Address"
              placeholderTextColor={colors.slate[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={[styles.input, styles.contactInput]}
            />
            <TextInput
              placeholder="Mobile Number"
              placeholderTextColor={colors.slate[400]}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={[styles.input, styles.contactInput]}
            />
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            disabled={submitting}
            style={({ pressed }) => [styles.cancel, pressed && { backgroundColor: colors.slate[100] }]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[600] }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSubmit} disabled={submitting} style={[styles.submit, shadows.md, submitting && { opacity: 0.5 }]}>
            <Gradient id="raiseSubmit" stops={[[0, colors.blue[700]], [1, colors.indigo[700]]]} />
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="HiPaperAirplane" size={16} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Submit Support Ticket</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Order picker (native replacement for the web <select>) */}
      <Sheet visible={orderPickerOpen} onClose={() => setOrderPickerOpen(false)} maxHeight="70%">
        <View style={styles.pickerHead}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>Link Related Order</Text>
          <Pressable onPress={() => setOrderPickerOpen(false)} style={{ padding: 6, borderRadius: 9999 }}>
            <Icon name="HiXMark" size={20} color={colors.slate[500]} />
          </Pressable>
        </View>
        <ScrollView>
          <Pressable
            onPress={() => {
              setSelectedOrderId('')
              setOrderPickerOpen(false)
            }}
            style={[styles.pickerRow, !selectedOrderId && { backgroundColor: colors.blue[50] }]}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.slate[800] }}>-- No specific order / General inquiry --</Text>
          </Pressable>
          {orders.map((ord) => {
            const ordId = ord.id || ord._id
            return (
              <Pressable
                key={ordId}
                onPress={() => {
                  setSelectedOrderId(ordId)
                  setOrderPickerOpen(false)
                }}
                style={[styles.pickerRow, selectedOrderId === ordId && { backgroundColor: colors.blue[50] }]}
              >
                <Text noTranslate style={{ fontSize: 12, fontWeight: '600', color: colors.slate[800] }}>
                  {orderLabel(ord)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </Sheet>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  headIcon: { width: 40, height: 40, borderRadius: radius['2xl'], backgroundColor: colors.amber[400], alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', right: 20, top: 20, padding: 8, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.1)' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius['2xl'],
    backgroundColor: colors.rose[50],
    borderWidth: 1,
    borderColor: colors.rose[200],
  },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate[700] },
  cat: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: radius['2xl'], borderWidth: 1 },
  catIcon: { width: 32, height: 32, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  prio: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center' },
  input: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.xl,
    fontSize: 12,
    color: colors.slate[800],
    fontFamily: fontFamilyFor('600'),
  },
  hint: { fontSize: 10, color: colors.slate[400] },
  contact: { padding: 16, backgroundColor: colors.slate[50], borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', gap: 12 },
  contactInput: { backgroundColor: '#fff', paddingHorizontal: 12, fontFamily: fontFamilyFor('500') },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  cancel: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate[200] },
  submit: {
    minHeight: 40,
    paddingHorizontal: 24,
    borderRadius: radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickerHead: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
})
