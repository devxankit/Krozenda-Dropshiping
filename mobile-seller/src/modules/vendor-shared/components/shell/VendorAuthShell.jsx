import { Linking, ScrollView, StyleSheet, View, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../../../../components/ui/Icon'
import { Text } from '../../../../components/ui/Text'
import { env } from '../../../../config/env'
import { colors, shadows } from '../../../../theme'

const open = (path) => Linking.openURL(`${env.webOrigin}${path}`).catch(() => {})

// Port of VendorAuthShell: header with brand + "Marketplace ->", a white card with title/subtitle and
// the form slot, and a footer. The Marketplace / Terms / Privacy links lead into the buyer app's
// pages on the website, so they open in the browser. `width` is accepted for parity (phone: full width).
export function VendorAuthShell({ title, subtitle, children, scrollRef }) {
  const insets = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.slate[50] }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingTop: insets.top, paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Icon name="HiOutlineBuildingStorefront" size={20} color="#fff" />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text noTranslate style={styles.name}>KROZENDA</Text>
                <View style={styles.tag}>
                  <Text noTranslate style={styles.tagText}>SELLER</Text>
                </View>
              </View>
              <Text style={styles.sub}>Dropshipping Supplier Portal</Text>
            </View>
          </View>
          <Pressable onPress={() => open('/app/dashboard')} style={{ flexDirection: 'row', gap: 4 }}>
            <Text style={styles.link}>Marketplace</Text>
            <Text noTranslate style={styles.link}>→</Text>
          </Pressable>
        </View>

        <View style={styles.main}>
          <View style={[styles.card, shadows.sm]}>
            <View style={styles.cardHead}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <View>{children}</View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text noTranslate style={styles.copy}>© {new Date().getFullYear()} Krozenda E-Commerce. All rights reserved.</Text>
          <View style={styles.footLinks}>
            <Pressable onPress={() => open('/app/terms')}><Text style={styles.footLink}>Terms of Service</Text></Pressable>
            <Pressable onPress={() => open('/app/privacy')}><Text style={styles.footLink}>Privacy Policy</Text></Pressable>
            <Pressable onPress={() => open('/seller/login')}><Text style={styles.footLink}>Seller Support</Text></Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: { width: '100%', paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { height: 36, width: 36, borderRadius: 12, backgroundColor: colors.brand[600], alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.slate[900] },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.brand[50], borderWidth: 1, borderColor: colors.brand[200] },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, color: colors.brand[700] },
  sub: { fontSize: 10, fontWeight: '500', color: colors.slate[500] },
  link: { fontSize: 12, fontWeight: '600', color: colors.slate[600] },
  main: { width: '100%', paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' },
  card: { width: '100%', maxWidth: 448, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', padding: 24, gap: 20 },
  cardHead: { borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.slate[900] },
  subtitle: { marginTop: 4, fontSize: 12, fontWeight: '500', color: colors.slate[500] },
  footer: { paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.6)' },
  copy: { fontSize: 12, color: colors.slate[400], textAlign: 'center' },
  footLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  footLink: { fontSize: 12, color: colors.slate[500] },
})
