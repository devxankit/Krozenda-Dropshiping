import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '../../../../components/ui'
import { FIELD_HEIGHT, FieldLabel, fieldBox } from '../../../../components/ui/fieldStyles'
import { toast } from '../../../../lib/toast'
import { pickDocumentFile } from '../../lib/filePicker'
import { colors } from '../../../../theme'

// Native stand-in for `<Input type="file" accept=".pdf,.jpg,.jpeg,.png">`: the system document
// picker (PDF + images). `onChange(file | null)` receives { uri, name, type }.
export function FilePickerField({ label, file, onChange, types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] }) {
  async function choose() {
    try {
      const picked = await pickDocumentFile(types)
      if (picked) onChange(picked)
    } catch {
      toast.error('Could not open files', 'Please try again.')
    }
  }

  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable accessibilityRole="button" onPress={choose} style={[...fieldBox({}), { height: FIELD_HEIGHT.md, gap: 10 }]}>
        <View style={styles.btn}>
          <Text style={styles.btnText}>Choose File</Text>
        </View>
        <Text noTranslate={Boolean(file)} numberOfLines={1} style={{ flex: 1, fontSize: 14, color: file ? colors.slate[900] : colors.ink.faint }}>
          {file ? file.name : 'No file chosen'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  btn: { borderRadius: 6, backgroundColor: colors.slate[100], paddingHorizontal: 10, paddingVertical: 4 },
  btnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
})
