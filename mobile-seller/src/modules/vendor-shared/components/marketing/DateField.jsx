import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Icon, Text } from '../../../../components/ui'
import { FIELD_HEIGHT, FieldLabel, fieldBox } from '../../../../components/ui/fieldStyles'
import { colors } from '../../../../theme'

// Native stand-in for <input type="date">: value and onChange use the same 'YYYY-MM-DD' string
// (onChange receives { target: { value } } like the other form controls).
function toIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date()
}

export function DateField({ label, required, value, onChange }) {
  const [iosOpen, setIosOpen] = useState(false)

  function emit(date) {
    onChange?.({ target: { value: toIso(date) } })
  }

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromIso(value),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) emit(date)
        },
      })
    } else {
      setIosOpen((v) => !v)
    }
  }

  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      <Pressable accessibilityRole="button" onPress={open} style={[...fieldBox({}), { height: FIELD_HEIGHT.md }]}>
        <Text noTranslate style={{ flex: 1, fontSize: 14, color: value ? colors.slate[900] : colors.ink.faint }}>
          {value || 'Select date'}
        </Text>
        <Icon name="calendar" size={16} color={colors.ink.faint} />
      </Pressable>
      {Platform.OS !== 'android' && iosOpen ? (
        <DateTimePicker
          value={fromIso(value)}
          mode="date"
          display="inline"
          onChange={(event, date) => {
            if (date) emit(date)
          }}
        />
      ) : null}
    </View>
  )
}
