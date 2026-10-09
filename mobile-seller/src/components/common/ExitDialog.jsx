import { Pressable, View, StyleSheet } from 'react-native'
import { Sheet } from '../ui/Sheet'
import { Text } from '../ui/Text'
import { Icon } from '../ui/Icon'
import { colors } from '../../theme'

// Port of the Flutter wrapper's widgets/exit_dialog.dart ("Exit App?" - shown when back is pressed
// on the root screen). Wrapper colours: primary #8E4692, exit button red, radius 20.
export function ExitDialog({ visible, onCancel, onExit }) {
  return (
    <Sheet visible={visible} onClose={onCancel} variant="center" style={{ borderRadius: 20 }}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Icon name="HiArrowRightOnRectangle" size={40} color="#8E4692" />
        </View>
        <Text noTranslate style={styles.title}>Exit App?</Text>
        <Text noTranslate style={styles.desc}>Are you sure you want to exit?</Text>
        <View style={styles.row}>
          <Pressable onPress={onCancel} style={[styles.btn, styles.cancel]}>
            <Text noTranslate style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={onExit} style={[styles.btn, { backgroundColor: colors.red[500] }]}>
            <Text noTranslate style={styles.exitText}>Exit</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { padding: 24, alignItems: 'center' },
  iconWrap: { height: 80, width: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(142,70,146,0.15)' },
  title: { marginTop: 20, fontSize: 24, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
  desc: { marginTop: 12, fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  row: { flexDirection: 'row', gap: 12, marginTop: 24, alignSelf: 'stretch' },
  btn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1, borderColor: '#ddd' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
  exitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
