import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../../../../components/ui/Icon'
import { Animated as Reanimated, enterFade } from '../../../../components/ui/motion'
import { Text } from '../../../../components/ui/Text'
import { useT } from '../../../../lib/i18n'
import { colors, shadows } from '../../../../theme'
import { AiAvatar } from './AiAvatar'
import { AiChatHistory } from './AiChatHistory'

// Shown on an empty thread. Phrased as the customer would ask, and every one
// of them is answerable from the tools the backend exposes.
const SUGGESTED_QUESTIONS = [
  'Tell me everything about my account',
  'How much balance is in my wallet?',
  'Where is my latest order?',
  'How many orders have I placed?',
  "What's in my cart and wishlist?",
  'Show my support tickets and returns',
]

const MAX_MESSAGE_LENGTH = 2000

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// Memoised: the panel re-renders on every keystroke of the draft, the transcript rows must not.
const MessageBubble = memo(function MessageBubble({ role, message, createdAt }) {
  const isUser = role === 'user'
  return (
    <Reanimated.View
      entering={enterFade(0)}
      style={{ width: '100%', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}
    >
      <View style={{ maxWidth: '85%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {/* Model replies are free text - never run through the UI translator. */}
          <Text noTranslate selectable style={[styles.bubbleText, { color: isUser ? '#fff' : colors.slate[800], fontWeight: '500' }]}>
            {message}
          </Text>
        </View>
        <Text noTranslate style={styles.time}>{formatTime(createdAt)}</Text>
      </View>
    </Reanimated.View>
  )
})

const renderMessage = ({ item }) => <MessageBubble role={item.role} message={item.message} createdAt={item.createdAt} />

function BounceDot({ delay }) {
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.delay(500 - delay),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v, delay])
  return (
    <Animated.View
      style={[styles.dot, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
    />
  )
}

function ThinkingBubble() {
  return (
    <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
      <View style={styles.thinking}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 150, 300].map((delay) => (
            <BounceDot key={delay} delay={delay} />
          ))}
        </View>
        <Text style={styles.thinkingText}>AI is thinking...</Text>
      </View>
    </View>
  )
}

// `assistant` is the useAiAssistantController() result, owned by AiAssistantLauncher so the transcript
// survives closing this sheet. Rendered in a Modal: bottom sheet (88% of the screen, rounded-t-3xl)
// over a slate-900/40 scrim, like the phone-width web sheet.
export function AiChatPanel({ assistant, onClose = () => {} }) {
  const {
    conversationId,
    messages,
    status,
    error,
    isSending,
    canRetry,
    send,
    retry,
    startNewChat,
    openConversation,
    removeConversation,
    conversations,
    isHistoryLoading,
  } = assistant

  const t = useT()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState('')
  const [draftFocused, setDraftFocused] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [listHeight, setListHeight] = useState(0)
  const listRef = useRef(null)

  const isEmpty = messages.length === 0

  // Auto-scroll on every new bubble and while the thinking indicator is up, so the latest turn is
  // always in view.
  const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: true })
  useEffect(() => {
    const id = setTimeout(scrollToEnd, 50)
    return () => clearTimeout(id)
  }, [messages, isSending])

  const handleSubmit = () => {
    const text = draft.trim()
    if (!text || isSending) return
    setDraft('')
    send(text)
  }

  const handleSuggestion = (question) => {
    if (isSending) return
    send(question)
  }

  const activeTitle = useMemo(() => {
    const match = conversations.find((c) => c.id === conversationId)
    return match?.title || 'Krozenda Assistant'
  }, [conversations, conversationId])

  const empty = (
    <View style={[styles.empty, listHeight > 0 && { minHeight: listHeight - 32 }]}>
      <AiAvatar size={64} iconSize={36} style={styles.emptyAvatar} />
      <Text style={styles.emptyTitle}>Hi! How can I help?</Text>
      <Text style={styles.emptySub}>Ask me about your orders, deliveries and purchases.</Text>

      <View style={{ marginTop: 20, width: '100%', gap: 8 }}>
        {SUGGESTED_QUESTIONS.map((question) => (
          <Pressable
            key={question}
            onPress={() => handleSuggestion(question)}
            disabled={isSending}
            style={({ pressed }) => [
              styles.suggestion,
              isSending && { opacity: 0.5 },
              pressed && { borderColor: colors.blue[300], backgroundColor: colors.blue[50] },
            ]}
          >
            <Text style={styles.suggestionText}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )

  const footer = (
    <View>
      {isSending ? <ThinkingBubble /> : null}
      {status === 'error' && error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {canRetry ? (
            <Pressable onPress={retry} style={styles.retryBtn}>
              <Icon name="HiArrowPath" size={14} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      // Back closes the history overlay first, then the panel (layered dismiss).
      onRequestClose={() => (showHistory ? setShowHistory(false) : onClose())}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.scrimWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close AI assistant" />

          <View style={[styles.panel, shadows['2xl']]} accessibilityViewIsModal>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <AiAvatar size={36} iconSize={20} style={styles.headerAvatar} />
                <View style={styles.onlineDot} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text noTranslate numberOfLines={1} style={styles.headerTitle}>{activeTitle}</Text>
                <View style={styles.onlineRow}>
                  <View style={styles.onlineDotSmall} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>

              <Pressable onPress={() => setShowHistory(true)} accessibilityLabel="Chat history" style={styles.headerBtn}>
                <Icon name="HiOutlineClock" size={20} color={colors.slate[500]} />
              </Pressable>
              <Pressable onPress={startNewChat} accessibilityLabel="New chat" style={styles.headerBtn}>
                <Icon name="HiOutlinePlus" size={20} color={colors.slate[500]} />
              </Pressable>
              <Pressable onPress={onClose} accessibilityLabel="Close assistant" style={styles.headerBtn}>
                <Icon name="HiXMark" size={20} color={colors.slate[500]} />
              </Pressable>
            </View>

            {/* Transcript */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              renderItem={renderMessage}
              initialNumToRender={12}
              windowSize={9}
              ListHeaderComponent={isEmpty ? empty : null}
              ListFooterComponent={footer}
              onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
            />

            {/* Composer */}
            <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <TextInput
                  value={draft}
                  onChangeText={(v) => setDraft(v.slice(0, MAX_MESSAGE_LENGTH))}
                  onFocus={() => setDraftFocused(true)}
                  onBlur={() => setDraftFocused(false)}
                  placeholder={t('Ask about your orders...')}
                  placeholderTextColor={colors.slate[400]}
                  multiline
                  // On a touch keyboard Enter makes a new line; the send button submits.
                  style={[
                    styles.input,
                    draftFocused && { borderColor: colors.blue[400], backgroundColor: '#fff' },
                  ]}
                />
                <Pressable
                  onPress={handleSubmit}
                  disabled={isSending || !draft.trim()}
                  accessibilityLabel="Send message"
                  style={({ pressed }) => [
                    styles.sendBtn,
                    isSending || !draft.trim() ? styles.sendBtnDisabled : [shadows.xs, pressed && { transform: [{ scale: 0.95 }] }],
                  ]}
                >
                  <Icon name="HiOutlinePaperAirplane" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>

            {showHistory ? (
              <AiChatHistory
                conversations={conversations}
                isLoading={isHistoryLoading}
                activeConversationId={conversationId}
                onSelect={(id) => {
                  openConversation(id)
                  setShowHistory(false)
                }}
                onDelete={removeConversation}
                onNewChat={() => {
                  startNewChat()
                  setShowHistory(false)
                }}
                onClose={() => setShowHistory(false)}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrimWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  panel: {
    height: '88%',
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    backgroundColor: colors.slate[50],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    backgroundColor: '#fff',
    zIndex: 10,
  },
  headerAvatar: { borderWidth: 2, borderColor: 'rgba(59,130,246,0.3)', ...shadows.sm },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: colors.emerald[500],
  },
  headerTitle: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald[500] },
  onlineText: { fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.emerald[600] },
  headerBtn: { padding: 8, borderRadius: 999 },

  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, ...shadows['2xs'] },
  bubbleUser: { backgroundColor: colors.blue[600], borderBottomRightRadius: 8 },
  bubbleBot: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200], borderBottomLeftRadius: 8 },
  bubbleText: { fontSize: 14, lineHeight: 22.75 },
  time: { marginTop: 4, paddingHorizontal: 4, fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.slate[400] },

  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    ...shadows['2xs'],
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue[500] },
  thinkingText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },

  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  emptyAvatar: { borderWidth: 4, borderColor: 'rgba(59,130,246,0.2)', marginBottom: 12, ...shadows.lg, shadowColor: '#2563eb' },
  emptyTitle: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.slate[900], textAlign: 'center' },
  emptySub: { marginTop: 4, maxWidth: 256, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[500], textAlign: 'center' },
  suggestion: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadows['2xs'],
  },
  suggestionText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },

  errorBox: { borderRadius: 16, borderWidth: 1, borderColor: colors.rose[200], backgroundColor: colors.rose[50], paddingHorizontal: 14, paddingVertical: 12 },
  errorText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.rose[700] },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.rose[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: { fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: '#fff' },

  composer: { borderTopWidth: 1, borderTopColor: colors.slate[200], backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 10, zIndex: 10 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.slate[800],
    textAlignVertical: 'top',
  },
  sendBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.blue[600], alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.slate[300] },
})
