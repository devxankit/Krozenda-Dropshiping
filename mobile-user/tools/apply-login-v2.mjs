// One-off patch for the login redesign (kept for traceability).
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'src/modules/auth/LoginScreen.jsx'
let s = readFileSync(FILE, 'utf8')
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70))
  s = s.replace(a, b)
}
const snip = readFileSync('tools/hero-v2.snippet.jsx', 'utf8')

// 1. new hero (keep Speck)
const a = s.indexOf('// A floating glass bubble')
const b = s.indexOf('function Ambient() {')
const old = s.slice(a, b)
const speck = old.slice(old.indexOf('// Twinkling bokeh speck.'), old.indexOf('function HeroBanner'))
s = s.slice(0, a) + speck + snip + s.slice(b)

// 2. header
const h0 = s.indexOf('      {/* Frosted header */}')
const h1 = s.indexOf('      <View style={styles.main}>')
s =
  s.slice(0, h0) +
  `      <View style={styles.header}>
        <View style={styles.headerRow}>
          {currentStep >= 3 ? (
            <Pressable onPress={goBack} accessibilityLabel="Go back" style={styles.navBtn}>
              <Icon name="HiArrowLeft" size={18} color="#475569" />
            </Pressable>
          ) : null}

          <Pressable onPress={goDashboard} style={styles.brand}>
            <Image source={LOGO} style={styles.brandLogo} contentFit="contain" />
            <View>
              <Text style={styles.brandTitle}>KroZenda</Text>
              <Text style={styles.brandSub}>DROPSHIPPING HUB</Text>
            </View>
          </Pressable>

          <Pressable onPress={goDashboard} style={styles.guestBtn} accessibilityRole="button">
            <Icon name="HiUser" size={15} color="#4f46e5" />
            <Text style={styles.guestText}>Guest</Text>
            <Icon name="HiArrowRight" size={13} color="#4f46e5" />
          </Pressable>
        </View>
      </View>

` +
  s.slice(h1)

// 3. hero out of the card, above it
rep('{level >= 1 ? <HeroBanner level={level} /> : null}', '')
rep(
  '<View style={styles.cardWrapper}>\n          <View style={styles.card}>\n            <GlowStrip />',
  '<View style={styles.cardWrapper}>\n          {currentStep === 2 && level >= 1 ? <HeroBanner level={level} /> : null}\n          <View style={[styles.card, currentStep === 2 && level >= 1 && styles.cardOverHero]}>',
)

// 5. benefits row removed (not in the new design)
const b0 = s.indexOf('{level >= 3 ? <View style={styles.benefits}>')
const b1 = s.indexOf('</View> : null}', b0) + '</View> : null}'.length
s = s.slice(0, b0) + s.slice(b1)

// 6. footer text, wave, chevron
rep('256-Bit SSL Encrypted • RBI Compliant Escrow • GST Invoiced', '256-bit SSL Encrypted  •  GST Invoiced')
rep('      <Ambient />\n', '      <Ambient />\n      {level >= 2 ? <BottomWave /> : null}\n')
rep(
  '<Text noTranslate style={styles.countryCode}>+91</Text>',
  '<Text noTranslate style={styles.countryCode}>+91</Text>\n                        <Icon name="HiChevronDown" size={14} color="#475569" />',
)
rep("import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg'", "import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg'")

// 8. styles
const st0 = s.indexOf('  header: {')
const st1 = s.indexOf('  main: {')
s =
  s.slice(0, st0) +
  `  header: { zIndex: 30 },
  headerRow: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  navBtn: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...shadows['2xs'],
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandLogo: { width: 46, height: 46 },
  brandTitle: { fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6, color: SLATE_900 },
  brandSub: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: '#6366f1' },
  guestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999,
    borderWidth: 1, borderColor: '#c7d2fe', backgroundColor: '#fff', ...shadows['2xs'],
  },
  guestText: { fontSize: 13, fontWeight: '700', color: '#4f46e5' },

` +
  s.slice(st1)

const hs0 = s.indexOf('  hero: {')
const hs1 = s.indexOf('  heroKicker:')
s =
  s.slice(0, hs0) +
  `  hero: { paddingTop: 24, paddingBottom: 56, paddingHorizontal: 22, borderRadius: 28, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: -6, bottom: 22 },
  heroCopy: { gap: 8 },
` +
  s.slice(hs1)
rep(
  /  heroKicker: \{[^\n]*\n/.exec(s)[0],
  "  heroKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#c7d2fe' },\n",
)
rep(
  /  heroHeadline: \{[^\n]*\n/.exec(s)[0],
  "  heroHeadline: { fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, color: '#fff', textAlign: 'left' },\n",
)
rep(
  /  heroChips: \{[^\n]*\n/.exec(s)[0],
  "  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, maxWidth: '78%' },\n",
)
rep(
  /  card: \{\n[^}]*\},\n/.exec(s)[0],
  "  card: { backgroundColor: '#fff', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(226,232,240,0.85)', overflow: 'hidden', ...shadows.lg, shadowColor: '#6366f1' },\n  cardOverHero: { marginTop: -34 },\n",
)
writeFileSync(FILE, s)
console.log('login v2 applied')
