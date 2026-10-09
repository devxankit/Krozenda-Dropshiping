import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { colors, radius, shadows } from '../../../../theme'
import { fetchPublicTutorials } from '../../services/tutorialService'

// Admin-published how-to guides for customers. Videos open in the phone's
// video / browser app; the text steps are shown inline.
export function TutorialsList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchPublicTutorials('customer')
      .then((rows) => mounted && setItems(rows || []))
      .catch(() => mounted && setFailed(true))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <Skeleton style={{ height: 120, borderRadius: radius['2xl'] }} />
  if (failed) return <Text style={{ fontSize: 12, color: colors.slate[500] }}>Could not load guides. Please try again later.</Text>
  if (items.length === 0) return <Text style={{ fontSize: 12, color: colors.slate[500] }}>No guides have been published yet.</Text>

  return (
    <View style={{ gap: 12 }}>
      {items.map((t) => {
        const open = openId === t.id
        return (
          <View key={t.id} style={[{ backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.slate[200] }, shadows.xs]}>
            <Pressable onPress={() => setOpenId(open ? null : t.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.slate[900] }}>{t.title}</Text>
                <Text style={{ fontSize: 11, color: colors.slate[500] }}>
                  {t.category}
                  {t.videoUrl ? ' · Video' : ''}
                  {t.description ? ' · Steps' : ''}
                </Text>
              </View>
              <Icon name="HiChevronDown" size={16} color={colors.slate[400]} />
            </Pressable>
            {open ? (
              <View style={{ gap: 12, padding: 16, paddingTop: 0 }}>
                {t.videoUrl ? (
                  <Pressable
                    onPress={() => Linking.openURL(t.videoUrl).catch(() => {})}
                    style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.xl, backgroundColor: colors.blue[600] }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Watch video</Text>
                  </Pressable>
                ) : null}
                {t.description ? (
                  <Text style={{ fontSize: 12, lineHeight: 19, color: colors.slate[700] }}>{t.description}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
