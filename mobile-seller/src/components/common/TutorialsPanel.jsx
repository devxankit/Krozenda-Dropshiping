import { useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Text } from '../ui'
import { fetchPublicTutorials } from '../../lib/tutorialService'
import { colors, shadows } from '../../theme'

// The web embeds YouTube/Vimeo in an <iframe> and plays direct .mp4 in a <video>. Natively every
// video link is handed to the system (YouTube app / browser / video player) via Linking, so no
// WebView or video dependency is needed.
function TutorialVideo({ url }) {
  return (
    <Pressable onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link">
      <Text style={styles.watch}>Watch video</Text>
    </Pressable>
  )
}

// Read-only list of admin-published tutorials for one audience. Shared by the
// seller panel and the customer help center.
export function TutorialsPanel({ audience }) {
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['tutorials', audience],
    queryFn: () => fetchPublicTutorials(audience),
  })
  const [openId, setOpenId] = useState(null)

  if (isLoading) return <Text style={styles.note}>Loading tutorials…</Text>
  if (isError) return <Text style={styles.note}>Could not load tutorials. Please try again later.</Text>
  if (items.length === 0) return <Text style={styles.note}>No tutorials have been published yet.</Text>

  return (
    <View style={{ gap: 12 }}>
      {items.map((t) => {
        const isOpen = openId === t.id
        return (
          <View key={t.id} style={[styles.card, shadows.xs]}>
            <Pressable
              onPress={() => setOpenId(isOpen ? null : t.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={styles.head}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>{t.title}</Text>
                <Text noTranslate style={styles.meta}>
                  {t.category}
                  {t.videoUrl ? ' · Video' : ''}
                  {t.description ? ' · Steps' : ''}
                </Text>
              </View>
              <Text noTranslate style={styles.sign}>{isOpen ? '−' : '+'}</Text>
            </Pressable>
            {isOpen ? (
              <View style={styles.body}>
                {t.videoUrl ? <TutorialVideo url={t.videoUrl} /> : null}
                {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  note: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  meta: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  sign: { fontSize: 14, lineHeight: 20, color: colors.slate[400] },
  body: { gap: 12, borderTopWidth: 1, borderTopColor: colors.slate[100], padding: 16 },
  watch: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.blue[700], textDecorationLine: 'underline' },
  desc: { fontSize: 12, lineHeight: 19.5, color: colors.slate[700] },
})
