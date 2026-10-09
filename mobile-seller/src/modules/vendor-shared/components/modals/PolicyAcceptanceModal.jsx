import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Icon } from '../../../../components/ui/Icon'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { PolicyContent } from '../../../../components/common/PolicyContent'
import { AuthButton } from '../auth/AuthFields'
import { useSellerPoliciesController } from '../../controllers/useVendorController'
import { colors, radius, shadows } from '../../../../theme'

// Shows every mandatory CMS policy one after another in a single scroll. Accept stays disabled until the
// seller has scrolled to the end of the last one; it then accepts them all at once and onAccepted fires
// with the versions agreed to. "Read to the end" = the scroll viewport reaching the bottom of the content
// (also true at once when everything fits without scrolling). Mount only while open so every opening
// starts again with nothing read.
const END_SLACK = 24

export function PolicyAcceptanceModal({ onClose, onAccepted }) {
  const policies = useSellerPoliciesController()
  const [reachedEnd, setReachedEnd] = useState(false)
  const scrollRef = useRef(null)
  const viewport = useRef(0)
  const content = useRef(0)
  const sectionY = useRef({})

  const docs = policies.data || []

  function check(offset) {
    if (viewport.current > 0 && content.current > 0 && offset + viewport.current >= content.current - END_SLACK) {
      setReachedEnd(true)
    }
  }

  function handleAccept() {
    onAccepted(docs.map(({ slug, title, version }) => ({ slug, title, version })))
  }

  function jumpTo(slug) {
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[slug] || 0) + BODY_PAD_TOP - 8), animated: true })
  }

  return (
    <Sheet visible onClose={onClose} variant="center" inset={12} maxHeight="100%" dismissable={false} style={styles.dialog}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Seller Policies & Agreements</Text>
          <Text style={styles.desc}>Please read all the documents below to the end and accept them to continue your registration.</Text>
        </View>
        <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8} style={styles.close}>
          <Icon name="close" size={16} color={colors.ink.faint} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flexShrink: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEventThrottle={64}
        onLayout={(e) => {
          viewport.current = e.nativeEvent.layout.height
          check(0)
        }}
        onContentSizeChange={(_w, h) => {
          content.current = h
          check(0)
        }}
        onScroll={(e) => check(e.nativeEvent.contentOffset.y)}
      >
        {policies.isLoading ? <Text style={styles.centerMuted}>Loading policies…</Text> : null}

        {policies.isError ? (
          <View style={styles.centerBlock}>
            <Text style={[styles.centerText, { color: colors.danger[600] }]}>Could not load the policies. Please check your connection.</Text>
            <AuthButton variant="outline" onPress={() => policies.refetch()} px={16}>
              Try again
            </AuthButton>
          </View>
        ) : null}

        {policies.isSuccess && docs.length === 0 ? (
          <View style={styles.centerBlock}>
            <Text style={[styles.centerText, { color: colors.slate[600] }]}>There are no policies to accept right now.</Text>
            <AuthButton onPress={() => onAccepted([])} px={16}>
              Continue
            </AuthButton>
          </View>
        ) : null}

        {docs.length > 0 ? (
          <View style={{ gap: 16 }}>
            {/* Quick links to each document */}
            <View style={styles.links}>
              {docs.map((doc) => (
                <Pressable key={doc.slug} onPress={() => jumpTo(doc.slug)} style={styles.linkChip}>
                  <Text style={styles.linkText}>{doc.title}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.status}>
              <Icon
                name={reachedEnd ? 'HiCheckCircle' : 'HiOutlineArrowDown'}
                size={16}
                color={reachedEnd ? colors.success[600] : colors.warning[600]}
              />
              <Text style={[styles.statusText, { color: reachedEnd ? colors.success[600] : colors.warning[600] }]}>
                {reachedEnd
                  ? 'You have read all the documents. You can accept them now.'
                  : 'Scroll to the end of all the documents to enable “I Accept”.'}
              </Text>
            </View>

            {docs.map((doc) => (
              <View
                key={doc.slug}
                style={{ gap: 8 }}
                onLayout={(e) => {
                  sectionY.current[doc.slug] = e.nativeEvent.layout.y
                }}
              >
                <View style={styles.docHead}>
                  <Text noTranslate style={styles.docTitle}>
                    {doc.title}
                  </Text>
                  <Text noTranslate style={styles.docVersion}>
                    {`${doc.version}${doc.updatedAt ? ` · Updated ${doc.updatedAt}` : ''}`}
                  </Text>
                </View>
                <View style={styles.docBody}>
                  <PolicyContent content={doc.content} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {docs.length ? (
        <View style={styles.footer}>
          <AuthButton variant="outline" onPress={onClose} px={16} style={{ paddingVertical: 8 }}>
            Cancel
          </AuthButton>
          <AuthButton onPress={handleAccept} disabled={!reachedEnd} px={16} style={{ paddingVertical: 8 }}>
            {docs.length > 1 ? `I Accept All ${docs.length} & Continue` : 'I Accept & Continue'}
          </AuthButton>
        </View>
      ) : null}
    </Sheet>
  )
}

const BODY_PAD_TOP = 12

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, borderColor: colors.border.DEFAULT, ...shadows.overlay },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.15, color: colors.slate[900] },
  desc: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink.subtle },
  close: { marginRight: -4, marginTop: -2, padding: 6, borderRadius: radius.md },
  body: { paddingHorizontal: 14, paddingVertical: BODY_PAD_TOP },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  centerMuted: { paddingVertical: 40, textAlign: 'center', fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  centerBlock: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  centerText: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linkChip: { borderRadius: 8, borderWidth: 1, borderColor: colors.brand[200], backgroundColor: colors.brand[50], paddingHorizontal: 8, paddingVertical: 4 },
  linkText: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.brand[700] },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  docHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  docTitle: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  docVersion: { fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  docBody: { borderRadius: 12, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: 'rgba(248,250,252,0.6)', paddingHorizontal: 16, paddingVertical: 12 },
})
