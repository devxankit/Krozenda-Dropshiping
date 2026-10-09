import { Children } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '../ui'
import { colors } from '../../theme'

// Native stand-in for the web's `grid grid-cols-N gap-X` at phone width: children are laid out N per
// row with equal widths; a short last row keeps the same column width (like a CSS grid).
export function Cols({ n = 2, gap = 12, children, style }) {
  const items = Children.toArray(children).filter((child) => child !== null && child !== false)
  const rows = []
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n))
  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
          {row.map((child, c) => (
            <View key={c} style={{ flex: 1, minWidth: 0 }}>
              {child}
            </View>
          ))}
          {row.length < n ? Array.from({ length: n - row.length }, (_, k) => <View key={`pad-${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  )
}

// The numbered round badge + uppercase heading every product-form section starts with.
export function SectionHeading({ step, children, required }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.step}>
        <Text noTranslate style={styles.stepText}>
          {step}
        </Text>
      </View>
      <Text style={styles.heading}>
        {children}
        {required ? <Text style={{ color: colors.rose[500] }}> *</Text> : null}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: {
    height: 20,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[200],
  },
  stepText: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: colors.brand[600] },
  heading: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.slate[900] },
})
