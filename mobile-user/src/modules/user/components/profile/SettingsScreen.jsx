import { useState } from 'react'
import { Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { CMS_ROUTES, USER_ROUTES } from '../../../../config/routes'
import { LANGUAGES, useLanguageStore } from '../../../../lib/i18n'
import { colors, radius, shadows } from '../../../../theme'

// Native replacement for the web's <select> LanguageSwitcher: a field that opens a picker sheet.
// Each option is labelled in its OWN script (हिन्दी, not "Hindi") plus the English name.
function LanguageField() {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]
  const optionLabel = ({ native, label }) => (native === label ? native : `${native} — ${label}`)

  return (
    <>
      <Pressable accessibilityLabel="Change language" onPress={() => setOpen(true)} style={styles.langField}>
        <Icon name="HiLanguage" size={16} color={colors.slate[400]} />
        <Text noTranslate numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>
          {current.native}
        </Text>
        <Icon name="HiChevronDown" size={16} color={colors.slate[400]} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} maxHeight="70%">
        <View style={styles.sheetHead}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>Language</Text>
          <Pressable onPress={() => setOpen(false)} style={{ padding: 6, borderRadius: 9999 }}>
            <Icon name="HiXMark" size={20} color={colors.slate[500]} />
          </Pressable>
        </View>
        <ScrollView>
          {LANGUAGES.map((item) => {
            const active = item.code === language
            return (
              <Pressable
                key={item.code}
                onPress={() => {
                  setLanguage(item.code)
                  setOpen(false)
                }}
                style={({ pressed }) => [styles.langRow, (active || pressed) && { backgroundColor: colors.blue[50] }]}
              >
                <Text noTranslate style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: active ? colors.blue[700] : colors.slate[900] }}>
                  {optionLabel(item)}
                </Text>
                {active ? <Icon name="HiCheckCircle" size={18} color={colors.blue[600]} /> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      </Sheet>
    </>
  )
}

export function SettingsScreen({ onBack }) {
  const router = useRouter()
  const handleBack =
    onBack ||
    (() => {
      if (router.canGoBack()) router.back()
      else router.replace(USER_ROUTES.DASHBOARD)
    })

  const settingsOptions = [
    {
      id: 'privacy-policy',
      label: 'Privacy Policy',
      description: 'Learn how your data, privacy, and personal information are protected',
      icon: 'HiShieldCheck',
      bg: colors.emerald[50],
      fg: colors.emerald[600],
      action: () => router.push(CMS_ROUTES.PRIVACY),
    },
    {
      id: 'terms-conditions',
      label: 'Terms & Conditions',
      description: 'Review our platform marketplace rules, terms, and usage agreements',
      icon: 'HiDocumentText',
      bg: colors.indigo[50],
      fg: colors.indigo[600],
      action: () => router.push(CMS_ROUTES.TERMS),
    },
  ]

  return (
    <Screen nav activeTab="profile">
      <View style={{ padding: 16, gap: 20 }}>
        {/* Header bar */}
        <View style={[styles.card, shadows.xs, { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <Pressable onPress={handleBack} accessibilityLabel="Back" style={{ padding: 8, borderRadius: radius.xl }}>
            <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.slate[900] }}>Settings</Text>
            <Text style={{ fontSize: 12, color: colors.slate[500], marginTop: 2 }}>
              Language, privacy policy and terms & conditions
            </Text>
          </View>
        </View>

        {/* Language */}
        <View style={[styles.card, shadows.xs, { padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.slate[900] }}>Language</Text>
              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.slate[400], marginTop: 2 }}>
                Saved to your account, on every device, until you change it
              </Text>
            </View>
            <View style={{ width: 160 }}>
              <LanguageField />
            </View>
          </View>
        </View>

        {/* Policy links */}
        <View style={[styles.card, shadows.xs, { overflow: 'hidden' }]}>
          {settingsOptions.map(({ id, label, description, icon, bg, fg, action }, idx) => (
            <Pressable
              key={id}
              onPress={action}
              style={({ pressed }) => [
                styles.optionRow,
                idx > 0 && { borderTopWidth: 1, borderTopColor: colors.slate[100] },
                pressed && { backgroundColor: 'rgba(248,250,252,0.8)' },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                <View style={[styles.optionIcon, { backgroundColor: bg }]}>
                  <Icon name={icon} size={20} color={fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.slate[900] }}>{label}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '500', color: colors.slate[400], marginTop: 2 }}>
                    {description}
                  </Text>
                </View>
              </View>
              <Icon name="HiChevronRight" size={16} color={colors.slate[400]} style={{ marginLeft: 8 }} />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.slate[200] },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  optionIcon: { width: 44, height: 44, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center' },
  langField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sheetHead: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langRow: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
