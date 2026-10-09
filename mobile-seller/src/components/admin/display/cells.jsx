import { StyleSheet, Text as RNText, View } from 'react-native'
import { Badge, Text } from '../../ui'
import { formatMoney } from '../../../modules/admin/lib/format'
import { colors, fontFamilyFor, fontSize } from '../../../theme'

// The small, repeated pieces every table and detail screen is assembled from.

// The web lets callers append Tailwind classes (`className="text-success-600 font-bold"`). Natively
// pass `style`; for convenience a small subset of utility classes is understood here too:
// text-{colour}-{shade}, text-{xs|sm|base|lg|xl}, font-{medium|semibold|bold}. `sm:` variants ignored.
function classStyle(className) {
  if (!className) return null
  const out = {}
  for (const token of String(className).split(/\s+/)) {
    if (!token || token.includes(':')) continue
    let m = token.match(/^text-([a-z]+)-(\d{2,3})$/)
    if (m && colors[m[1]]?.[m[2]]) {
      out.color = colors[m[1]][m[2]]
      continue
    }
    m = token.match(/^text-(xs|sm|base|lg|xl|2xl)$/)
    if (m) {
      const [size, line] = fontSize[m[1]]
      out.fontSize = size
      out.lineHeight = line
      continue
    }
    if (token === 'font-medium') out.fontWeight = '500'
    else if (token === 'font-semibold') out.fontWeight = '600'
    else if (token === 'font-bold') out.fontWeight = '700'
  }
  return out
}

// ---- money ---------------------------------------------------------------
export function MoneyCell({ amount, compact = false, muted = false, className, style }) {
  return (
    <Text
      noTranslate
      style={[
        styles.tabular,
        { fontWeight: '600', color: muted ? colors.ink.subtle : colors.slate[900] },
        classStyle(className),
        style,
      ]}
    >
      {formatMoney(amount, { compact })}
    </Text>
  )
}

// ---- date ----------------------------------------------------------------
export function DateCell({ value, withTime = true, className, style }) {
  const date = new Date(value)
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <Text noTranslate style={[{ color: colors.ink.muted }, classStyle(className), style]}>
      {day}
      {withTime ? (
        <RNText style={[styles.tabular, { color: colors.ink.faint, fontFamily: fontFamilyFor('400') }]}>{`, ${time}`}</RNText>
      ) : null}
    </Text>
  )
}

// ---- status --------------------------------------------------------------
// Tone and label both come from a map in constants.js. A screen never decides what colour a
// status is.
export function StatusPill({ status, labels = {}, tones = {}, size = 'md' }) {
  return (
    <Badge tone={(tones && tones[status]) || 'neutral'} size={size} dot>
      {(labels && labels[status]) || status}
    </Badge>
  )
}

// ---- identity ------------------------------------------------------------
// The web's `to` (a route link) becomes `onPress` natively; with it the id is brand-coloured.
export function IdCell({ id, onPress, className, style }) {
  return (
    <Text
      noTranslate
      onPress={onPress}
      style={[
        styles.tabular,
        { fontWeight: '600', color: onPress ? colors.brand[700] : colors.slate[900] },
        classStyle(className),
        style,
      ]}
    >
      {id}
    </Text>
  )
}

export function PrimaryCell({ title, subtitle, onPress }) {
  return (
    <View style={{ minWidth: 0 }}>
      <Text numberOfLines={1} onPress={onPress} style={{ fontWeight: '500', color: colors.slate[900] }}>
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
})
