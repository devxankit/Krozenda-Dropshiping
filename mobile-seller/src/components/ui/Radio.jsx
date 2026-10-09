import { Pressable, View, StyleSheet } from 'react-native'
import { colors, radius } from '../../theme'
import { Text } from './Text'

// options: [{ value, label, description?, disabled? }]. onChange(value) - same as the web.
function Dot({ selected }) {
  return (
    <View style={[styles.dot, selected ? styles.dotOn : styles.dotOff]}>{selected ? <View style={styles.dotCore} /> : null}</View>
  )
}

export function RadioGroup({ value, options = [], onChange, label, style }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? <Text style={styles.legend}>{label}</Text> : null}
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option.value, disabled: option.disabled }}
          disabled={option.disabled}
          onPress={() => onChange?.(option.value)}
          style={[styles.row, option.disabled && { opacity: 0.5 }]}
        >
          <View style={{ marginTop: 1 }}>
            <Dot selected={value === option.value} />
          </View>
          <View style={styles.text}>
            <Text style={styles.label}>{option.label}</Text>
            {option.description ? <Text style={styles.desc}>{option.description}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  )
}

export function RadioCards({ value, options = [], onChange, label, columns = 1, style }) {
  const rows = []
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns))
  return (
    <View style={style}>
      {label ? <Text style={[styles.legend, { marginBottom: 8 }]}>{label}</Text> : null}
      <View style={{ gap: 10 }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
            {row.map((option) => {
              const selected = value === option.value
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: option.disabled }}
                  disabled={option.disabled}
                  onPress={() => onChange?.(option.value)}
                  style={[
                    styles.card,
                    selected
                      ? { borderWidth: 2, padding: 11, borderColor: colors.brand[600], backgroundColor: 'rgba(239,246,255,0.5)' }
                      : { borderWidth: 1, padding: 12, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
                    option.disabled && { opacity: 0.5 },
                  ]}
                >
                  <View style={{ marginTop: 2 }}>
                    <Dot selected={selected} />
                  </View>
                  <View style={styles.text}>
                    <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '500', color: selected ? colors.slate[900] : colors.slate[700] }}>{option.label}</Text>
                    {option.description ? <Text style={styles.desc}>{option.description}</Text> : null}
                  </View>
                </Pressable>
              )
            })}
            {row.length < columns ? Array.from({ length: columns - row.length }, (_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />) : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  legend: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[700] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  text: { flexShrink: 1, gap: 2 },
  label: { fontSize: 14, lineHeight: 18, color: colors.slate[800] },
  desc: { fontSize: 12, lineHeight: 16, color: colors.ink.faint },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotOn: { borderColor: colors.brand[600], backgroundColor: colors.brand[600] },
  dotOff: { borderColor: colors.border.strong, backgroundColor: colors.surface.DEFAULT },
  dotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  card: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.lg },
})
