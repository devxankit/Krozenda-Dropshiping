import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Icon } from '../../../../components/ui/Icon'
import { Text } from '../../../../components/ui/Text'
import { useT } from '../../../../lib/i18n'
import { colors, fontFamilyFor, radius } from '../../../../theme'
import { useDeliveryCheckController } from '../../controllers/useDeliveryCheckController'

// "Do you deliver to my PIN code, and what will it cost?"
//
// Real carrier rates for this product's actual lane, not a generic promise. A signed-in shopper's
// default address fills this in and answers on its own. When the carrier cannot be reached, it
// says so rather than falling back to "we deliver everywhere".

function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso) {
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const UNAVAILABLE_COPY = {
  SHIPPING_DISABLED: 'Delivery checks are unavailable right now.',
  NO_ORIGIN: 'Delivery pricing is not set up for this item yet.',
  CARRIER_UNAVAILABLE: 'Could not reach the courier just now. Please try again in a moment.',
}

export function DeliveryCheckCard({ productId }) {
  const t = useT()
  const { pincode, setPincode, check, isChecking, result, error, fromSavedAddress, savedAddressLabel, isValid } =
    useDeliveryCheckController(productId)

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Icon name="HiTruck" size={16} color={colors.blue[600]} />
        <Text style={styles.title}>Delivery Details</Text>
      </View>

      <View style={styles.box}>
        <View style={styles.formRow}>
          <View style={styles.inputWrap}>
            <Icon name="HiMapPin" size={16} color={colors.slate[400]} />
            <TextInput
              keyboardType="number-pad"
              autoComplete="postal-code"
              maxLength={6}
              value={pincode}
              onChangeText={(text) => setPincode(text.replace(/\D/g, ''))}
              onSubmitEditing={check}
              returnKeyType="done"
              placeholder={t('Enter PIN code')}
              placeholderTextColor={colors.slate[400]}
              accessibilityLabel="Delivery PIN code"
              style={styles.input}
            />
          </View>
          <Pressable onPress={check} disabled={!isValid || isChecking} style={(!isValid || isChecking) && { opacity: 0.4 }}>
            <Text style={styles.checkText}>{isChecking ? 'Checking…' : 'Check'}</Text>
          </Pressable>
        </View>

        {fromSavedAddress && savedAddressLabel ? <Text style={styles.savedNote}>From your saved address</Text> : null}

        {result || error ? <View style={styles.divider} /> : null}

        {error ? (
          <Text accessibilityRole="alert" style={[styles.status, { fontWeight: '700', color: colors.red[600] }]}>
            Could not check delivery right now. Please try again.
          </Text>
        ) : null}

        {result && !result.available ? (
          <Text style={[styles.status, { fontWeight: '600', color: colors.slate[600] }]}>
            {UNAVAILABLE_COPY[result.reason] || 'Could not check delivery for this PIN code.'}
          </Text>
        ) : null}

        {result?.available && !result.serviceable ? (
          <Text style={[styles.status, { fontWeight: '700', color: colors.red[600] }]}>
            {`Sorry, we don't deliver to ${result.pincode} yet.`}
          </Text>
        ) : null}

        {result?.available && result.serviceable ? (
          <View style={{ gap: 8 }}>
            <Row
              icon={<Icon name="HiTruck" size={16} color={colors.slate[400]} />}
              label="Prepaid Delivery"
              value={result.prepaid?.available ? formatMoney(result.prepaid.charge) : 'Not available'}
              muted={!result.prepaid?.available}
              translate={!result.prepaid?.available}
            />
            <Row
              icon={<Icon name="HiTruck" size={16} color={colors.slate[400]} />}
              label="COD Delivery"
              value={result.cod?.available ? formatMoney(result.cod.charge) : 'Not available'}
              muted={!result.cod?.available}
              translate={!result.cod?.available}
            />
            {result.estimatedDeliveryDate ? (
              <Row
                icon={<Icon name="HiCheckCircle" size={16} color={colors.emerald[500]} />}
                label="Est. Delivery Date"
                value={formatDate(result.estimatedDeliveryDate)}
                tone={colors.emerald[600]}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function Row({ icon, label, value, tone = colors.slate[900], muted = false, translate = false }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        {icon}
        <Text style={styles.rowLabelText}>{label}</Text>
      </View>
      <Text noTranslate={!translate} style={[styles.rowValue, { color: muted ? colors.slate[400] : tone }]}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12, borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, color: colors.slate[900], textTransform: 'uppercase' },
  box: { borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.slate[200], backgroundColor: '#fff', padding: 14 },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inputWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: fontFamilyFor('700'),
    color: colors.slate[900],
  },
  checkText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.orange[600] },
  savedNote: { marginTop: 4, paddingLeft: 24, fontSize: 10, lineHeight: 14, fontWeight: '500', color: colors.slate[400] },
  divider: { marginVertical: 12, borderTopWidth: 1, borderTopColor: colors.slate[100] },
  status: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabelText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[600] },
  rowValue: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
})
