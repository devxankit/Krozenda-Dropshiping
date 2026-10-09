import { useEffect, useRef, useState } from 'react'
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Icon, Modal, Text } from '../ui'
import { api } from '../../lib/axios'
import { colors, fontFamilyFor, radius } from '../../theme'

// A real barcode scanner — the handheld gun kind, or a phone's Bluetooth one
// — behaves exactly like a second keyboard: pointed at a label, it "types" the
// digits into whatever field is focused and finishes with Enter. So an
// ordinary, always-focused text input that submits on Enter IS the scan
// handler, and it doubles as a manual lookup for a label a scanner can't get to.
//
// Native addition (the phone has a camera, the web panel's desktop did not): "Scan with camera" opens
// expo-camera's CameraView and feeds the first code it reads through the same lookup. The camera
// permission is only requested the first time that button is pressed.
//
// `lookupPath` is a function (code) => API path, so this same component
// serves the admin panel (`/admin/catalog/products/barcode/:code`) and the
// seller panel (`/vendor/products/barcode/:code`, scoped server-side to that
// seller's own catalog) without knowing which one it is.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr']

export function ScanBarcodeModal({ isOpen, onClose, lookupPath, onFound }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | not-found | error
  const [focused, setFocused] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const inputRef = useRef(null)
  const busyRef = useRef(false)

  // Reset on every open — done during render (React's own recipe for
  // adjusting state when a prop changes) rather than in an effect, which
  // would paint one frame of the PREVIOUS lookup's leftover state first.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setCode('')
      setStatus('idle')
      setCameraOn(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return undefined
    busyRef.current = false
    // A scanner fires the instant the modal is on screen — nothing to tap
    // first, or the scan lands in the void.
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [isOpen])

  async function lookup(raw) {
    const trimmed = String(raw || '').trim()
    if (!trimmed || busyRef.current) return
    // The label's barcode types the SKU; a 2D scanner reading its QR code
    // types the whole details line ("2000000000015 | Name | SKU: …"), whose
    // first field is the 13-digit barcode. Only a LEADING 13-digit field is
    // taken, so a SKU that happens to contain 13 digits is left intact.
    const barcode = trimmed.match(/^(\d{13})\s*\|/)?.[1] || trimmed

    busyRef.current = true
    setStatus('loading')
    try {
      const res = await api.get(lookupPath(encodeURIComponent(barcode)))
      setStatus('idle')
      setCode('')
      setCameraOn(false)
      onFound(res.data?.data)
    } catch (err) {
      setStatus(err?.status === 404 || err?.response?.status === 404 ? 'not-found' : 'error')
    } finally {
      busyRef.current = false
    }
  }

  async function startCamera() {
    let current = permission
    if (!current?.granted) current = await requestPermission()
    if (current?.granted) setCameraOn(true)
  }

  function handleScanned({ data }) {
    if (busyRef.current || !data) return
    setCode(String(data))
    lookup(data)
  }

  const denied = permission && !permission.granted && !permission.canAskAgain

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan barcode"
      description="Point a scanner at the label, or type the code and press Enter."
    >
      <View style={{ gap: 12 }}>
        <View style={[styles.field, focused && styles.fieldFocus]}>
          <Icon name="HiMagnifyingGlass" size={16} color={colors.ink.faint} />
          <TextInput
            ref={inputRef}
            value={code}
            autoCapitalize="none"
            onChangeText={(value) => {
              setCode(value)
              if (status !== 'idle' && status !== 'loading') setStatus('idle')
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => lookup(code)}
            returnKeyType="search"
            placeholder="0000000000000"
            placeholderTextColor={colors.ink.faint}
            autoComplete="off"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {status === 'not-found' ? (
          <View style={styles.errorRow}>
            <Icon name="HiExclamationTriangle" size={14} color={colors.danger[600]} />
            <Text style={styles.errorText}>No product carries this barcode.</Text>
          </View>
        ) : null}
        {status === 'error' ? (
          <View style={styles.errorRow}>
            <Icon name="HiExclamationTriangle" size={14} color={colors.danger[600]} />
            <Text style={styles.errorText}>Something went wrong — try again.</Text>
          </View>
        ) : null}

        {cameraOn ? (
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={status === 'loading' ? undefined : handleScanned}
            />
            <Pressable onPress={() => setCameraOn(false)} accessibilityLabel="Close camera" style={styles.cameraClose}>
              <Icon name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={startCamera} accessibilityRole="button" style={({ pressed }) => [styles.cameraBtn, pressed && { backgroundColor: colors.slate[50] }]}>
            <Icon name="HiCamera" size={16} color={colors.brand[600]} />
            <Text style={styles.cameraBtnText}>Scan with camera</Text>
          </Pressable>
        )}

        {denied && !cameraOn ? (
          <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
            <Text style={styles.errorText}>Camera access is turned off. Tap here to open settings and allow it.</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldFocus: { borderColor: colors.brand[500], borderWidth: 2, paddingHorizontal: 11, paddingVertical: 7 },
  input: { flex: 1, padding: 0, fontSize: 14, fontFamily: fontFamilyFor('500'), color: colors.slate[900] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.danger[600] },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: '#fff',
  },
  cameraBtnText: { fontSize: 14, fontWeight: '500', color: colors.slate[900] },
  cameraBox: { height: 240, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#000' },
  cameraClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
})
