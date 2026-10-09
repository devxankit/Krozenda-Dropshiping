import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { LANGUAGES, languageShort, useLanguageStore } from '../../lib/i18n'
import { colors, radius } from '../../theme'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'

// Port of components/common/LanguageSwitcher.jsx. The web uses a native <select> (OS picker) in both
// variants; natively the picker is a bottom Sheet listing every language labelled in its OWN script
// (+ the English name so a shared device's owner can undo someone else's pick). Language names are
// never translated (noTranslate): someone looking for their language scans for letters they know.
//   variant="compact" - header pill (icon + short code + chevron); variant="field" - full-width field.
// The web's "translating" spinner has no native equivalent (lib/i18n does not expose a busy flag).

function Options({ language, onPick }) {
  return (
    <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
      {LANGUAGES.map(({ code, native, label }) => {
        const active = code === language
        return (
          <Pressable
            key={code}
            onPress={() => onPick(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { backgroundColor: colors.slate[50] }]}
          >
            <Text noTranslate style={[styles.optionText, active && { color: colors.blue[700] }]}>
              {native}
              {native === label ? '' : ` — ${label}`}
            </Text>
            {active ? <Icon name="HiCheck" size={18} color={colors.blue[600]} /> : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export function LanguageSwitcher({ style, variant = 'field' }) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)

  const pick = (code) => {
    setLanguage(code)
    setOpen(false)
  }

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]

  return (
    <>
      {variant === 'compact' ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityLabel="Change language"
          style={[styles.compact, style]}
        >
          <Icon name="HiLanguage" size={16} color={colors.slate[700]} />
          <Text noTranslate style={styles.compactText}>{languageShort(language)}</Text>
          <Icon name="HiChevronDown" size={12} color={colors.slate[400]} />
        </Pressable>
      ) : (
        <Pressable onPress={() => setOpen(true)} accessibilityLabel="Change language" style={[styles.field, style]}>
          <View style={styles.fieldIcon}>
            <Icon name="HiLanguage" size={16} color={colors.slate[400]} />
          </View>
          <Text noTranslate numberOfLines={1} style={styles.fieldText}>
            {current.native}
            {current.native === current.label ? '' : ` — ${current.label}`}
          </Text>
          <View style={styles.fieldChevron}>
            <Icon name="HiChevronDown" size={16} color={colors.slate[400]} />
          </View>
        </Pressable>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Change language</Text>
          <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close" hitSlop={8}>
            <Icon name="HiXMark" size={20} color={colors.slate[500]} />
          </Pressable>
        </View>
        <Options language={language} onPick={pick} />
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  // rounded-xl border-slate-200/80 bg-slate-50 px-2 py-1.5 gap-1
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.slate[50],
  },
  compactText: { fontSize: 11, lineHeight: 11, fontWeight: '800', color: colors.slate[700] },
  // rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs font-bold text-slate-900
  field: {
    width: '100%',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingLeft: 36,
    paddingRight: 36,
  },
  fieldIcon: { position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center' },
  fieldChevron: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  fieldText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.slate[900] },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  optionActive: { backgroundColor: colors.blue[50] },
  optionText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[800] },
})
