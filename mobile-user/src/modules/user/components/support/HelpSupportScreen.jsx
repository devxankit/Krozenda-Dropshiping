import { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native'
import { Screen } from '../../../../components/layout/Screen'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { fetchPublicFaqs } from '../../services/faqService'
import { fetchUserTickets } from '../../services/ticketService'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'
import { Gradient } from './Gradient'
import { RaiseTicketModal } from './RaiseTicketModal'
import { TicketDetailsModal } from './TicketDetailsModal'
import { TutorialsList } from './TutorialsList'

const DEFAULT_FAQS = [
  {
    id: 'faq-1',
    category: 'Orders & Tracking',
    question: 'How do I track my Krozenda order?',
    answer:
      'You can track your order in real-time by visiting "My Orders" in your profile and clicking on "Track Shipment". You will see live courier partner updates and the estimated delivery date.',
  },
  {
    id: 'faq-2',
    category: 'Returns & Refunds',
    question: 'What is the return and replacement policy?',
    answer:
      'We offer a 7-day hassle-free replacement or return window on eligible items from the delivery date. To initiate a return, go to "My Orders", choose the item, and select "Request Return / Replacement".',
  },
  {
    id: 'faq-3',
    category: 'Returns & Refunds',
    question: 'When will I receive my refund?',
    answer:
      'Once the returned product arrives at our hub and passes quality inspection, refunds are credited within 2-4 business days for UPI/cards and instantly for Krozenda Wallet balances.',
  },
  {
    id: 'faq-4',
    category: 'Payments & Billing',
    question: 'What payment methods are accepted on Krozenda?',
    answer:
      'We accept all major UPI apps (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, Krozenda Wallet, and Cash on Delivery (COD) on eligible pin codes.',
  },
  {
    id: 'faq-5',
    category: 'Payments & Billing',
    question: 'How do I download a GST invoice for my purchase?',
    answer:
      'You can download tax invoices directly from "My Orders" > "Order Details" > "Download Invoice". You can also add your GSTIN during checkout for B2B input tax credit.',
  },
  {
    id: 'faq-6',
    category: 'Orders & Tracking',
    question: 'Can I cancel an order after placing it?',
    answer:
      'Yes, orders can be cancelled immediately from "My Orders" as long as the shipment has not been handed over to the courier partner. Once shipped, you can refuse delivery or request a return.',
  },
  {
    id: 'faq-7',
    category: 'Account & Safety',
    question: 'Is my personal and payment data secure?',
    answer:
      'Yes, Krozenda uses bank-grade 256-bit encryption and RBI-approved PCI-DSS compliant payment gateways (Razorpay). We never store your full card numbers or banking passwords.',
  },
  {
    id: 'faq-8',
    category: 'Damaged or Defective Item',
    question: 'What if I receive a damaged or incorrect product?',
    answer:
      'If you received a damaged, defective, or incorrect product, please raise a support ticket or return request within 48 hours of delivery along with photos. We will arrange a free reverse pickup and fast replacement.',
  },
]

const FAQ_CATEGORIES = ['All', 'Orders & Tracking', 'Returns & Refunds', 'Payments & Billing', 'Damaged or Defective Item', 'Account & Safety']

const TICKET_FILTER_TABS = [
  { id: 'all', label: 'All Tickets' },
  { id: 'open', label: 'Open' },
  { id: 'waiting', label: 'In Review' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]

const STATUS_STYLE = {
  open: { bg: colors.sky[50], fg: colors.sky[700], border: colors.sky[200] },
  waiting: { bg: colors.purple[50], fg: colors.purple[700], border: colors.purple[200] },
  resolved: { bg: colors.emerald[50], fg: colors.emerald[700], border: colors.emerald[200] },
  closed: { bg: colors.slate[100], fg: colors.slate[600], border: colors.slate[200] },
}

export function HelpSupportScreen() {
  // Navigation tabs: 'faqs' | 'tickets'
  const [activeTab, setActiveTab] = useState('faqs')

  // FAQ state
  const [faqs, setFaqs] = useState([])
  const [faqsLoading, setFaqsLoading] = useState(true)
  const [selectedFaqCategory, setSelectedFaqCategory] = useState('All')
  const [faqSearch, setFaqSearch] = useState('')
  const [openFaqId, setOpenFaqId] = useState(null)

  // Ticket state
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketFilter, setTicketFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketCounts, setTicketCounts] = useState({ all: 0, open: 0, waiting: 0, resolved: 0, closed: 0 })

  // Modals state
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)

  // Success banner
  const [alertMessage, setAlertMessage] = useState(null)

  const showAlert = (msg) => {
    setAlertMessage(msg)
    setTimeout(() => setAlertMessage(null), 5000)
  }

  // Fetch FAQs
  useEffect(() => {
    let isMounted = true
    fetchPublicFaqs()
      .then((items) => {
        if (!isMounted) return
        if (items && items.length > 0) {
          // Merge API faqs with standard fallback defaults
          const merged = [...items]
          DEFAULT_FAQS.forEach((df) => {
            if (!merged.some((m) => m.question.toLowerCase() === df.question.toLowerCase())) {
              merged.push(df)
            }
          })
          setFaqs(merged)
        } else {
          setFaqs(DEFAULT_FAQS)
        }
      })
      .catch(() => {
        if (isMounted) setFaqs(DEFAULT_FAQS)
      })
      .finally(() => {
        if (isMounted) setFaqsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fetch tickets
  const loadTickets = async (filter = ticketFilter) => {
    setTicketsLoading(true)
    try {
      const data = await fetchUserTickets({ status: filter !== 'all' ? filter : undefined })
      setTickets(data.items || [])
      if (data.counts) {
        setTicketCounts(data.counts)
      }
    } catch {
      setTickets([])
    } finally {
      setTicketsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    loadTickets(ticketFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketFilter])

  const visibleFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedFaqCategory === 'All' || faq.category?.toLowerCase() === selectedFaqCategory.toLowerCase()
    const matchesSearch =
      !faqSearch.trim() || `${faq.question} ${faq.answer} ${faq.category}`.toLowerCase().includes(faqSearch.trim().toLowerCase())
    return matchesCategory && matchesSearch
  })

  const visibleTickets = tickets.filter((t) => {
    if (!ticketSearch.trim()) return true
    const q = ticketSearch.trim().toLowerCase()
    return (
      (t.ticketId && t.ticketId.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    )
  })

  const handleTicketCreated = (newTicket) => {
    showAlert(`Ticket #${newTicket.ticketId} created successfully! Our team is reviewing it.`)
    setActiveTab('tickets')
    setTicketFilter('all')
    loadTickets('all')
    // Auto-open new ticket details
    setSelectedTicketId(newTicket.ticketId || newTicket.id)
    setIsDetailsModalOpen(true)
  }

  const handleTicketUpdated = (updated) => {
    showAlert(`Ticket #${updated.ticketId} updated. Status: ${updated.status.toUpperCase()}`)
    loadTickets()
  }

  const searchValue = activeTab === 'faqs' ? faqSearch : ticketSearch
  const setSearchValue = activeTab === 'faqs' ? setFaqSearch : setTicketSearch

  return (
    <Screen keyboard>
      <View style={{ padding: 16, gap: 24 }}>
        {alertMessage ? (
          <View style={[styles.alert, shadows.lg]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Icon name="HiCheckCircle" size={20} color={colors.emerald[200]} />
              <Text noTranslate style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#fff' }}>
                {alertMessage}
              </Text>
            </View>
            <Pressable onPress={() => setAlertMessage(null)}>
              <Text noTranslate style={{ color: colors.emerald[200] }}>
                ✕
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Hero */}
        <View style={[styles.hero, shadows.xl]}>
          <Gradient id="helpHero" direction="br" stops={[[0, colors.blue[950]], [0.5, colors.blue[900]], [1, colors.indigo[900]]]} />
          <View style={{ padding: 24, alignItems: 'center', gap: 16 }}>
            <View style={styles.heroPill}>
              <Icon name="HiSparkles" size={16} color={colors.slate[900]} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.slate[950], textTransform: 'uppercase', letterSpacing: 0.6 }}>
                24/7 CUSTOMER SUPPORT & HELP DESK
              </Text>
            </View>
            <Text style={{ fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.4 }}>
              How can we help you today?
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.blue[200], textAlign: 'center' }}>
              Browse quick answers in our FAQ knowledge base or raise a support ticket to connect directly with our resolution specialists.
            </Text>

            <View style={[styles.searchWrap, shadows.xl, activeTab === 'tutorials' && { display: 'none' }]}>
              <View style={{ position: 'absolute', left: 16, zIndex: 1 }}>
                <Icon name="HiMagnifyingGlass" size={20} color={colors.slate[400]} />
              </View>
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder={
                  activeTab === 'faqs'
                    ? 'Search FAQs (e.g. tracking order, refund timeline, returns)...'
                    : 'Search your tickets by Ticket ID or Subject...'
                }
                placeholderTextColor={colors.slate[400]}
                style={styles.searchInput}
                numberOfLines={1}
              />
              {searchValue ? (
                <Pressable onPress={() => setSearchValue('')} style={{ position: 'absolute', right: 84, padding: 4 }} accessibilityLabel="Clear search">
                  <Icon name="HiXMark" size={16} color={colors.slate[400]} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setIsRaiseModalOpen(true)}
                style={({ pressed }) => [styles.raiseSmall, shadows.sm, { backgroundColor: pressed ? colors.blue[700] : colors.blue[600] }]}
              >
                <Icon name="HiPlus" size={16} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Raise</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tab switcher */}
        <View style={{ gap: 16, borderBottomWidth: 1, borderBottomColor: colors.slate[200], paddingBottom: 16 }}>
          <View style={styles.switcher}>
            {[
              { id: 'faqs', icon: 'HiQuestionMarkCircle', label: 'Frequently Asked Questions' },
              { id: 'tutorials', icon: 'HiQuestionMarkCircle', label: 'How-to Guides' },
              { id: 'tickets', icon: 'HiTicket', label: 'My Support Tickets' },
            ].map((tab) => {
              const active = activeTab === tab.id
              return (
                <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.switchBtn, active && [{ backgroundColor: '#fff' }, shadows.sm]]}>
                  <Icon name={tab.icon} size={16} color={active ? colors.blue[900] : colors.slate[600]} />
                  <Text style={{ flexShrink: 1, fontSize: 12, fontWeight: '800', color: active ? colors.blue[900] : colors.slate[600] }}>
                    {tab.label}
                  </Text>
                  {tab.id === 'tickets' && ticketCounts.open > 0 ? (
                    <View style={styles.openBadge}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>
                        <Text noTranslate style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>
                          {ticketCounts.open}
                        </Text>
                        {' Open'}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              )
            })}
          </View>

          <Pressable onPress={() => setIsRaiseModalOpen(true)} style={[styles.createBtn, shadows.md]}>
            <Gradient id="helpCreate" stops={[[0, colors.blue[700]], [1, colors.indigo[700]]]} />
            <Icon name="HiPlus" size={16} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Create New Support Ticket</Text>
          </Pressable>
        </View>

        {/* TAB 1: FAQs */}
        {activeTab === 'faqs' ? (
          <View style={{ gap: 24 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {FAQ_CATEGORIES.map((cat) => {
                const active = selectedFaqCategory === cat
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedFaqCategory(cat)}
                    style={[
                      styles.pill,
                      active ? [{ backgroundColor: colors.blue[900] }, shadows.xs] : { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200] },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.slate[600] }}>{cat}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={[styles.card, shadows.xs, { padding: 24, gap: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Icon name="HiQuestionMarkCircle" size={20} color={colors.blue[600]} />
                  <Text style={{ flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.slate[900] }}>Popular Questions & Solutions</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[400], marginLeft: 8 }}>
                  <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: colors.slate[400] }}>
                    {visibleFaqs.length}
                  </Text>
                  {visibleFaqs.length === 1 ? ' article' : ' articles'}
                </Text>
              </View>

              {faqsLoading ? (
                <View style={{ gap: 12, paddingVertical: 16 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} style={{ height: 48, borderRadius: radius['2xl'] }} />
                  ))}
                </View>
              ) : visibleFaqs.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                  <Icon name="HiQuestionMarkCircle" size={40} color={colors.slate[300]} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[500], textAlign: 'center' }}>
                    {`No FAQs matching "${faqSearch}".`}
                  </Text>
                  <Pressable onPress={() => setIsRaiseModalOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="HiPlus" size={16} color={colors.blue[600]} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[600] }}>Raise a ticket with your question instead</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  {visibleFaqs.map((faq, idx) => {
                    const faqId = faq.id || faq._id
                    const isOpen = openFaqId === faqId
                    return (
                      <View key={faqId} style={[{ paddingVertical: 14 }, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.slate[100] }]}>
                        <Pressable
                          onPress={() => setOpenFaqId(isOpen ? null : faqId)}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue[500] }} />
                            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.slate[900] }}>{faq.question}</Text>
                          </View>
                          <Icon
                            name="HiChevronDown"
                            size={16}
                            color={isOpen ? colors.blue[600] : colors.slate[400]}
                            style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
                          />
                        </Pressable>
                        {isOpen ? (
                          <View style={styles.answer}>
                            <Text style={{ fontSize: 12, lineHeight: 19.5, fontWeight: '500', color: colors.slate[700] }}>{faq.answer}</Text>
                            {faq.category ? (
                              <Text style={{ marginTop: 10, fontSize: 10, fontWeight: '700', color: colors.slate[400], textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                {`Category: ${faq.category}`}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>

            {/* Still can't find the answer */}
            <View style={[styles.cta, shadows.md]}>
              <Gradient id="helpCta" stops={[[0, colors.blue[900]], [1, colors.indigo[900]]]} />
              <View style={{ padding: 24, alignItems: 'center', gap: 16 }}>
                <View style={{ gap: 4, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' }}>Still can't find the answer?</Text>
                  <Text style={{ fontSize: 12, color: colors.blue[200], textAlign: 'center' }}>
                    Our dedicated support agents can review your specific order, account, or refund status.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsRaiseModalOpen(true)}
                  style={({ pressed }) => [styles.ctaBtn, shadows.md, { backgroundColor: pressed ? colors.amber[300] : colors.amber[400] }]}
                >
                  <Icon name="HiTicket" size={16} color={colors.slate[950]} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.slate[950] }}>Raise Support Ticket</Text>
                </Pressable>
              </View>
            </View>

            {/* Direct support channels */}
            <View style={[styles.card, shadows.xs, { padding: 24, gap: 20 }]}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.slate[900], borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 12 }}>
                Direct Support Channels
              </Text>

              <View style={{ gap: 12 }}>
                {[
                  { url: 'https://wa.me/919876543210', icon: 'HiChatBubbleLeftRight', title: 'WhatsApp Chat', sub: 'Live chat assistance (9 AM - 8 PM)', bg: colors.emerald[50], border: colors.emerald[200], iconBg: colors.emerald[600], t: colors.emerald[950], s: colors.emerald[700], subWeight: '400' },
                  { url: 'tel:18005720000', icon: 'HiPhone', title: 'Toll-Free Phone Helpline', sub: '1800-KROZENDA (Toll Free)', bg: colors.blue[50], border: colors.blue[200], iconBg: colors.blue[600], t: colors.blue[950], s: colors.blue[700], subWeight: '600' },
                  { url: 'mailto:support@krozenda.com', icon: 'HiEnvelope', title: 'Email Helpdesk', sub: 'support@krozenda.com', bg: colors.slate[50], border: colors.slate[200], iconBg: colors.slate[800], t: colors.slate[900], s: colors.slate[500], subWeight: '500' },
                ].map((c) => (
                  <Pressable
                    key={c.title}
                    onPress={() => Linking.openURL(c.url).catch(() => {})}
                    style={[styles.channel, { backgroundColor: c.bg, borderColor: c.border }]}
                  >
                    <View style={[styles.channelIcon, shadows.xs, { backgroundColor: c.iconBg }]}>
                      <Icon name={c.icon} size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: c.t }}>{c.title}</Text>
                      <Text noTranslate={c.icon === 'HiEnvelope'} style={{ fontSize: 11, fontWeight: c.subWeight, color: c.s }}>
                        {c.sub}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={styles.hours}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[700] }}>Support Hours:</Text>
                <Text style={{ fontSize: 11, color: colors.slate[500] }}>Monday to Saturday: 09:30 AM to 07:00 PM IST</Text>
                <Text style={{ fontSize: 11, color: colors.slate[500] }}>Tickets submitted outside hours are answered next business day.</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* TAB: How-to guides (video + text, managed by admin) */}
        {activeTab === 'tutorials' ? <TutorialsList /> : null}

        {/* TAB 2: My tickets */}
        {activeTab === 'tickets' ? (
          <View style={{ gap: 24 }}>
            <View style={[styles.card, shadows.xs, { padding: 16, gap: 16 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {TICKET_FILTER_TABS.map((tab) => {
                  const count = ticketCounts[tab.id] ?? 0
                  const active = ticketFilter === tab.id
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => setTicketFilter(tab.id)}
                      style={[styles.pill, { flexDirection: 'row', alignItems: 'center', gap: 6 }, active ? [{ backgroundColor: colors.blue[900] }, shadows.xs] : { backgroundColor: colors.slate[100] }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.slate[600] }}>{tab.label}</Text>
                      {count > 0 ? (
                        <View style={{ paddingHorizontal: 6, borderRadius: 9999, backgroundColor: active ? '#fff' : colors.slate[200] }}>
                          <Text noTranslate style={{ fontSize: 10, fontWeight: '800', color: active ? colors.blue[900] : colors.slate[700] }}>
                            {count}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  )
                })}
              </ScrollView>

              <View style={{ justifyContent: 'center' }}>
                <View style={{ position: 'absolute', left: 12, zIndex: 1 }}>
                  <Icon name="HiMagnifyingGlass" size={16} color={colors.slate[400]} />
                </View>
                <TextInput
                  value={ticketSearch}
                  onChangeText={setTicketSearch}
                  placeholder="Filter by Ticket ID / Subject..."
                  placeholderTextColor={colors.slate[400]}
                  style={styles.filterInput}
                />
              </View>
            </View>

            {ticketsLoading ? (
              <View style={{ gap: 16 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} style={{ height: 112, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200], borderRadius: radius['3xl'] }} />
                ))}
              </View>
            ) : visibleTickets.length === 0 ? (
              <View style={[styles.card, shadows.xs, { padding: 32, alignItems: 'center', gap: 16 }]}>
                <View style={[styles.emptyIcon, shadows.xs]}>
                  <Icon name="HiTicket" size={32} color={colors.blue[600]} />
                </View>
                <View style={{ gap: 4, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.slate[900] }}>No support tickets found</Text>
                  <Text style={{ fontSize: 12, color: colors.slate[500], textAlign: 'center', maxWidth: 360 }}>
                    {ticketFilter !== 'all'
                      ? `You don't have any tickets with status "${ticketFilter}".`
                      : 'You have not raised any support inquiries yet. Whenever you experience an issue with an order, shipment, or refund, create a ticket here!'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsRaiseModalOpen(true)}
                  style={({ pressed }) => [styles.emptyBtn, shadows.md, { backgroundColor: pressed ? colors.blue[800] : colors.blue[700] }]}
                >
                  <Icon name="HiPlus" size={16} color="#fff" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Raise Support Ticket</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {visibleTickets.map((t) => {
                  const id = t.ticketId || t.id
                  const lastMessage = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null
                  const st = STATUS_STYLE[t.status] || STATUS_STYLE.closed
                  const prio =
                    t.priority === 'urgent'
                      ? { bg: colors.rose[100], fg: colors.rose[700] }
                      : t.priority === 'high'
                        ? { bg: colors.amber[100], fg: colors.amber[800] }
                        : { bg: colors.slate[100], fg: colors.slate[600] }
                  const open = () => {
                    setSelectedTicketId(id)
                    setIsDetailsModalOpen(true)
                  }

                  return (
                    <Pressable key={id} onPress={open} style={[styles.card, shadows.xs, { padding: 20, gap: 16 }]}>
                      <View style={{ gap: 10, borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 12 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <Text noTranslate style={[styles.tag, { fontFamily: 'monospace', fontWeight: '800', color: colors.blue[700], backgroundColor: colors.blue[50] }]}>
                            #{id}
                          </Text>
                          <Text style={[styles.tag, { fontWeight: '700', color: colors.slate[700], backgroundColor: colors.slate[100] }]}>{t.category}</Text>
                          {t.orderNumber ? (
                            <Text noTranslate style={[styles.tag, { fontWeight: '700', color: colors.indigo[700], backgroundColor: colors.indigo[50] }]}>
                              Order #{t.orderNumber}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text noTranslate style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: prio.bg, color: prio.fg }}>
                            {t.priority}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.fg, marginRight: 6 }} />
                            <Text noTranslate style={{ fontSize: 12, fontWeight: '800', color: st.fg }}>
                              {t.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={{ gap: 6 }}>
                        <Text noTranslate style={{ fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] }}>
                          {t.subject}
                        </Text>
                        {lastMessage ? (
                          <Text noTranslate numberOfLines={2} style={{ fontSize: 12, lineHeight: 19.5, fontWeight: '500', color: colors.slate[500] }}>
                            <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: colors.slate[700] }}>
                              {lastMessage.sender === 'user' ? 'You' : lastMessage.senderName}:
                            </Text>
                            {` ${lastMessage.message}`}
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ gap: 12, paddingTop: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Icon name="HiClock" size={14} color={colors.slate[400]} />
                            <Text style={styles.foot}>
                              {'Opened: '}
                              <Text noTranslate style={styles.foot}>
                                {t.openedAt || 'Recently'}
                              </Text>
                            </Text>
                          </View>
                          <Text noTranslate style={styles.foot}>
                            ·
                          </Text>
                          <Text style={styles.foot}>
                            <Text noTranslate style={styles.foot}>
                              {t.messages?.length || 1}
                            </Text>
                            {' messages'}
                          </Text>
                        </View>
                        <Pressable onPress={open} style={({ pressed }) => [styles.viewBtn, pressed && { backgroundColor: colors.blue[100] }]}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[700] }}>View Conversation & Updates →</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
        ) : null}
      </View>

      <RaiseTicketModal isOpen={isRaiseModalOpen} onClose={() => setIsRaiseModalOpen(false)} onTicketCreated={handleTicketCreated} />

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onTicketUpdated={handleTicketUpdated}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  alert: { padding: 16, borderRadius: radius['2xl'], backgroundColor: colors.emerald[600], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hero: { borderRadius: radius['3xl'], overflow: 'hidden' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: 'rgba(251,191,36,0.9)', borderRadius: 9999 },
  searchWrap: { width: '100%', justifyContent: 'center' },
  searchInput: {
    height: 48,
    paddingLeft: 48,
    paddingRight: 112,
    paddingVertical: 0,
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    fontSize: 12,
    fontFamily: fontFamilyFor('600'),
    color: colors.slate[900],
  },
  raiseSmall: { position: 'absolute', right: 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.xl },
  switcher: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(226,232,240,0.7)', padding: 6, borderRadius: radius['2xl'] },
  switchBtn: { flex: 1, paddingHorizontal: 8, paddingVertical: 8, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  openBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: colors.blue[600] },
  createBtn: { alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius['2xl'], overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.xl },
  card: { backgroundColor: '#fff', borderRadius: radius['3xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' },
  answer: {
    marginTop: 12,
    paddingLeft: 16,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.blue[500],
    backgroundColor: 'rgba(239,246,255,0.4)',
    borderTopRightRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
  cta: { borderRadius: radius['3xl'], overflow: 'hidden' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.xl },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius['2xl'], borderWidth: 1 },
  channelIcon: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  hours: { padding: 16, backgroundColor: colors.slate[50], borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.slate[100], gap: 4 },
  filterInput: {
    height: 36,
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 0,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.xl,
    fontSize: 12,
    color: colors.slate[800],
    fontFamily: fontFamilyFor('600'),
  },
  emptyIcon: { width: 64, height: 64, borderRadius: radius['3xl'], backgroundColor: colors.blue[50], alignItems: 'center', justifyContent: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.xl },
  tag: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md, overflow: 'hidden' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  foot: { fontSize: 12, fontWeight: '500', color: colors.slate[400] },
  viewBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.xl, backgroundColor: colors.blue[50] },
})
