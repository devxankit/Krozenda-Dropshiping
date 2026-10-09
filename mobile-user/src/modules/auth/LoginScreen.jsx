import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg'
import { env } from '../../config/env'
import { USER_ROUTES } from '../../config/routes'
import { useAuthStore } from '../../lib/authStore'
import { useT } from '../../lib/i18n'
import { enablePush } from '../../lib/notificationStore'
import { sanitizeIndianPhoneNumber } from '../../lib/phoneUtils'
import { toast } from '../../lib/toast'
import { resolveImageSource } from '../../components/ui/SmartImage'
import { Icon } from '../../components/ui/Icon'
import { Text } from '../../components/ui/Text'
import { Screen } from '../../components/layout/Screen'
import { shadows } from '../../theme'
import { GradientFill } from './components/GradientFill'
import { sendCustomerOtp, verifyCustomerOtp } from './services/customerAuthService'

// Port of modules/auth/pages/LoginPage.jsx (phone width): 1 welcome -> 2 mobile -> 3 OTP -> 4 verified.
// Route param `mode` (login | welcome | mobile | otp | verified) comes from src/app/auth/[mode].js; like the
// web (`pathname.includes('welcome')`) only `welcome` starts at step 1. `redirect` is where to go after login.

const LOGO = resolveImageSource('/images/logo.png')
const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const EASE_IN_OUT = Easing.inOut(Easing.ease) // module-level so the loop effect deps stay stable
const PRIMARY = '#4f46e5'
const SLATE_900 = '#0f172a'

const OTP_EMPTY = ['', '', '', '', '', '']

function openWebPage(path) {
  Linking.openURL(`${env.webOrigin}${path}`).catch(() => {})
}

// ---------------------------------------------------------------------------------------------
// Small animation helpers
// ---------------------------------------------------------------------------------------------

// .lp-stagger-N: fade + rise 12px, 500ms, 60ms * N delay.
function Stagger({ n = 1, children, style }) {
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 500, delay: n * 60, easing: EASE, useNativeDriver: true }).start()
  }, [v, n])
  return (
    <Animated.View
      style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }, style]}
    >
      {children}
    </Animated.View>
  )
}

function useLoop(duration, { from = 0, to = 1, easing = EASE_IN_OUT, alternate = false, delay = 0 } = {}) {
  const [v] = useState(() => new Animated.Value(from))
  useEffect(() => {
    const step = Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true })
    const seq = alternate
      ? Animated.sequence([step, Animated.timing(v, { toValue: from, duration, easing, useNativeDriver: true })])
      : Animated.sequence([step, Animated.timing(v, { toValue: from, duration: 0, useNativeDriver: true })])
    const loop = Animated.loop(seq)
    const t = setTimeout(() => loop.start(), delay)
    return () => {
      clearTimeout(t)
      loop.stop()
    }
  }, [v, duration, from, to, easing, alternate, delay])
  return v
}

// lpHaloBreathe: scale 1 -> 1.1, opacity .8 -> .4.
function Halo({ style, delay = 0 }) {
  const v = useLoop(1500, { alternate: true, delay })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.4] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
        },
      ]}
    />
  )
}

function Spin({ children }) {
  const v = useLoop(600, { easing: Easing.linear })
  return (
    <Animated.View style={{ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      {children}
    </Animated.View>
  )
}

// .lp-btn-shine::after sweep.
function Shine() {
  const v = useLoop(2800)
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shine,
        {
          opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [-420, 520, 520] }) },
            { skewX: '-25deg' },
          ],
        },
      ]}
    />
  )
}
function IndianFlag() {
  return (
    <View style={styles.flagWrap}>
      <Svg width={24} height={16} viewBox="0 0 26 18" fill="none">
        <Rect width="26" height="6" fill="#FF9933" />
        <Rect y="6" width="26" height="6" fill="#ffffff" />
        <Rect y="12" width="26" height="6" fill="#138808" />
        <Circle cx="13" cy="9" r="2.5" fill="none" stroke="#000080" strokeWidth="0.7" />
        <Circle cx="13" cy="9" r="0.6" fill="#000080" />
      </Svg>
    </View>
  )
}

function ErrorAlert({ msg }) {
  return (
    <View style={[styles.alert, styles.alertError]} accessibilityRole="alert">
      <Icon name="HiExclamationTriangle" size={16} color="#b91c1c" style={styles.alertIcon} />
      <Text style={[styles.alertText, { color: '#b91c1c' }]}>{msg}</Text>
    </View>
  )
}

function PrimaryButton({ label, onPress, disabled, loading, loadingLabel, colors, glow = PRIMARY, icon = 'HiArrowRight', leadIcon }) {
  const dim = disabled || loading
  const inactive = disabled && !loading
  return (
    <Pressable
      onPress={onPress}
      disabled={dim}
      style={({ pressed }) => [
        styles.primaryBtn,
        // A solid base under the gradient: the shadow of an elevated view with no background is drawn as a hollow
        // ring on Android, and if the SVG gradient is late or fails the white label would be invisible.
        inactive ? styles.primaryBtnDisabled : [shadows.lg, { shadowColor: glow, backgroundColor: (colors || [])[0] || '#5b51e8' }],
        pressed && !dim && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {inactive ? null : <GradientFill colors={colors || ['#5b51e8', '#6d66f3', '#4e45d9']} />}
      {inactive ? null : <Shine />}
      {loading ? (
        <>
          <Spin>
            <Icon name="HiArrowPath" size={18} color="#fff" />
          </Spin>
          <Text style={styles.primaryBtnText}>{loadingLabel}</Text>
        </>
      ) : (
        <>
          {leadIcon ? <Icon name={leadIcon} size={18} color="#fff" /> : null}
          <Text style={[styles.primaryBtnText, inactive && { color: '#94a3b8' }]}>{label}</Text>
          <Icon name={icon} size={17} color={inactive ? '#94a3b8' : '#fff'} />
        </>
      )}
    </Pressable>
  )
}

function Stepper({ step, phoneValid }) {
  const done = step === 3
  const fill = done ? 1 : phoneValid ? 0.5 : 0
  const [v] = useState(() => new Animated.Value(fill))
  useEffect(() => {
    Animated.timing(v, { toValue: fill, duration: 400, useNativeDriver: false }).start()
  }, [v, fill])
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperItem}>
        <View style={[styles.stepCircle, done ? styles.stepDone : styles.stepActive]}>
          <GradientFill colors={done ? ['#059669', '#10b981'] : [PRIMARY, '#6366f1']} />
          {done ? <Icon name="HiCheck" size={14} color="#fff" /> : <Text noTranslate style={styles.stepNum}>1</Text>}
        </View>
        <Text style={[styles.stepLabel, { color: done ? '#059669' : PRIMARY }]}>Mobile</Text>
      </View>
      <View style={styles.connector}>
        <Animated.View style={{ height: '100%', width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
          <GradientFill
            colors={done ? ['#059669', PRIMARY] : [PRIMARY, '#06b6d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>
      <View style={styles.stepperItem}>
        <View style={[styles.stepCircle, done ? styles.stepActive : styles.stepIdle]}>
          {done ? <GradientFill colors={[PRIMARY, '#6366f1']} /> : null}
          <Text noTranslate style={[styles.stepNum, !done && { color: '#94a3b8' }]}>2</Text>
        </View>
        <Text style={[styles.stepLabel, { color: done ? PRIMARY : '#94a3b8' }]}>Verify</Text>
      </View>
    </View>
  )
}

// Brand banner at the top of the mobile-number step: gradient, soft orbs and a floating logo tile.
// Twinkling bokeh speck.
function Speck({ left, top, size = 4, delay = 0 }) {
  const v = useLoop(1800 + delay, { alternate: true, delay })
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${left}%`,
        top,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#e0e7ff',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.95] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }],
      }}
    />
  )
}

// Vector illustration for the hero (right side): parcel box, delivery truck, phone with a shop UI,
// paper plane and map pins - drawn with react-native-svg, no raster assets.
function HeroIllustration({ width = 190 }) {
  const h = width * 0.86
  return (
    <Svg width={width} height={h} viewBox="0 0 190 164" pointerEvents="none">
      <Defs>
        <LinearGradient id="ilBox" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fcd9a8" />
          <Stop offset="1" stopColor="#e7a867" />
        </LinearGradient>
        <LinearGradient id="ilTruck" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8b5cf6" />
          <Stop offset="1" stopColor="#5b21b6" />
        </LinearGradient>
        <LinearGradient id="ilPhone" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#e0e7ff" />
        </LinearGradient>
      </Defs>

      {/* soft ground glow */}
      <Ellipse cx="100" cy="150" rx="82" ry="9" fill="#1e1b4b" opacity="0.28" />

      {/* map pins */}
      <Path d="M150 18c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z" fill="#c4b5fd" opacity="0.9" />
      <Circle cx="150" cy="27" r="3.2" fill="#fff" />
      <Path d="M112 52c-4 0-7 3-7 7 0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z" fill="#a5b4fc" opacity="0.85" />
      <Circle cx="112" cy="59" r="2.4" fill="#fff" />

      {/* dotted route */}
      <Path d="M30 112 C 60 70, 90 96, 112 66" stroke="#c7d2fe" strokeWidth="1.6" strokeDasharray="3 5" fill="none" opacity="0.8" />

      {/* phone */}
      <Rect x="112" y="30" width="62" height="104" rx="11" fill="#312e81" />
      <Rect x="115.5" y="33.5" width="55" height="97" rx="8.5" fill="url(#ilPhone)" />
      <Rect x="132" y="36.5" width="23" height="4" rx="2" fill="#312e81" opacity="0.85" />
      <Circle cx="143" cy="52" r="8.5" fill="#6366f1" />
      <Path d="M138.5 49.5h1.8l1.3 6h5.6l1.1-4.4h-7.4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx="141.8" cy="58" r="1" fill="#fff" />
      <Circle cx="146.8" cy="58" r="1" fill="#fff" />
      <Rect x="120" y="68" width="22" height="22" rx="6" fill="#ede9fe" />
      <Rect x="144" y="68" width="22" height="22" rx="6" fill="#fce7f3" />
      <Rect x="120" y="93" width="22" height="22" rx="6" fill="#dbeafe" />
      <Rect x="144" y="93" width="22" height="22" rx="6" fill="#fef3c7" />
      <Rect x="124" y="75" width="14" height="8" rx="3" fill="#8b5cf6" />
      <Circle cx="155" cy="79" r="5" fill="#ec4899" />
      <Rect x="124" y="100" width="14" height="8" rx="3" fill="#3b82f6" />
      <Rect x="148" y="100" width="14" height="8" rx="3" fill="#f59e0b" />

      {/* parcel box */}
      <Path d="M18 78 L58 64 L98 78 L98 118 L58 134 L18 118 Z" fill="url(#ilBox)" />
      <Path d="M18 78 L58 92 L98 78 L58 64 Z" fill="#fde9c9" />
      <Path d="M58 92 L58 134 L18 118 L18 78 Z" fill="#e0a05e" opacity="0.55" />
      <Path d="M48 70 L68 78 L68 96 L48 88 Z" fill="#fff" opacity="0.5" />
      <Rect x="30" y="98" width="20" height="13" rx="3" fill="#4f46e5" transform="rotate(14 40 104)" />
      <Path d="M36 107l3-6 3 3 3-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(14 40 104)" />

      {/* truck */}
      <Rect x="42" y="118" width="86" height="26" rx="5" fill="url(#ilTruck)" />
      <Path d="M128 124h14c3 0 5 1.6 6.6 4.2l5.4 8.8c.8 1.3 1.2 2.8 1.2 4.3V144h-27z" fill="#ede9fe" />
      <Path d="M133 128h9c1.6 0 2.8.7 3.6 2l3 5h-15.6z" fill="#7dd3fc" />
      <Rect x="42" y="141" width="106" height="4" rx="2" fill="#1e1b4b" opacity="0.5" />
      <Circle cx="66" cy="146" r="8" fill="#0f0a3c" />
      <Circle cx="66" cy="146" r="3.4" fill="#cbd5e1" />
      <Circle cx="132" cy="146" r="8" fill="#0f0a3c" />
      <Circle cx="132" cy="146" r="3.4" fill="#cbd5e1" />
      {/* speed lines */}
      <Path d="M8 124h22M2 132h26M10 140h20" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

      {/* paper plane */}
      <G transform="translate(8 14) rotate(-14 30 20)">
        <Path d="M2 20 L58 2 L36 38 L28 24 Z" fill="#fff" />
        <Path d="M28 24 L58 2 L34 28 Z" fill="#c7d2fe" />
        <Path d="M28 24 L30 36 L36 38 Z" fill="#a5b4fc" />
      </G>
    </Svg>
  )
}

function HeroBanner({ level = 3 }) {
  const float = useLoop(3200, { alternate: true })
  const [box, setBox] = useState({ width: 0, height: 0 })
  return (
    <View style={[styles.hero, level < 3 && { paddingTop: 16, paddingBottom: 40 }]} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      <GradientFill colors={['#4338ca', '#6d28d9', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="heroOrbA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#22d3ee" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="heroOrbB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#f0abfc" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#f0abfc" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={box.width * 0.05} cy={box.height * 0.1} r={110} fill="url(#heroOrbA)" />
        <Circle cx={box.width * 0.78} cy={box.height * 0.55} r={130} fill="url(#heroOrbB)" />
      </Svg>

      <Speck left={46} top={20} size={4} delay={0} />
      <Speck left={8} top={150} size={3} delay={500} />
      <Speck left={60} top={120} size={3} delay={900} />

      {level >= 2 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.heroArt, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
        >
          <HeroIllustration width={level >= 3 ? 190 : 150} />
        </Animated.View>
      ) : null}

      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>WELCOME TO KROZENDA</Text>
        <Text style={styles.heroHeadline}>
          {'Factory-direct prices,\n'}
          <Text style={[styles.heroHeadline, { color: '#ddd6fe' }]}>delivered pan-India</Text>
        </Text>
        {level >= 2 ? (
          <View style={styles.heroChips}>
            {[
              { icon: 'HiBolt', label: '24-48 hr dispatch' },
              { icon: 'HiShieldCheck', label: 'Secure orders' },
            ].map((c) => (
              <View key={c.label} style={styles.heroChip}>
                <Icon name={c.icon} size={14} color="#fde68a" />
                <Text style={styles.heroChipText}>{c.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

// Soft lavender waves at the very bottom of the page (decoration only).
function BottomWave() {
  const { width } = useWindowDimensions()
  return (
    <Svg width={width} height={70} viewBox="0 0 400 70" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <Path d="M0 38 C 90 8, 170 64, 270 30 S 380 10, 400 22 L400 70 L0 70 Z" fill="#c7d2fe" opacity="0.32" />
      <Path d="M0 50 C 110 24, 200 70, 300 42 S 380 34, 400 40 L400 70 L0 70 Z" fill="#ddd6fe" opacity="0.5" />
    </Svg>
  )
}

function Ambient() {
  const { width, height } = useWindowDimensions()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GradientFill colors={['#fafbfc', '#f1f5f9', '#f8fafc']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="orbA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#6366f1" stopOpacity="0.22" />
            <Stop offset="0.7" stopColor="#4f46e5" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="orbB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#38bdf8" stopOpacity="0.2" />
            <Stop offset="0.7" stopColor="#06b6d4" stopOpacity="0.04" />
            <Stop offset="1" stopColor="#06b6d4" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="orbC" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#d946ef" stopOpacity="0.14" />
            <Stop offset="0.7" stopColor="#a855f7" stopOpacity="0.03" />
            <Stop offset="1" stopColor="#a855f7" stopOpacity="0" />
          </RadialGradient>
          <Pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <Circle cx="0.5" cy="0.5" r="0.7" fill="rgba(99,102,241,0.1)" />
          </Pattern>
        </Defs>
        <Circle cx={-120 + 275} cy={-160 + 275} r={275} fill="url(#orbA)" />
        <Circle cx={width + 100 - 240} cy={height + 100 - 240} r={240} fill="url(#orbB)" />
        <Circle cx={width / 2} cy={height * 0.4} r={190} fill="url(#orbC)" />
        <Rect width={width} height={height} fill="url(#dots)" opacity={0.45} />
      </Svg>
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------------------------

export function LoginScreen() {
  const router = useRouter()
  const t = useT()
  const { mode, redirect } = useLocalSearchParams()
  const { width: screenW } = useWindowDimensions()
  const wide = screenW >= 400
  // The login must fit one screen with no scrolling: the space actually available (it shrinks when the
  // keyboard opens) decides how much of the decoration is shown.
  // The decoration level must NOT change when the keyboard opens: it shrinks the screen, and re-laying the
  // card out (banner, wave, dots appearing/disappearing) under a focused input was dropping its focus. So the
  // level follows the LARGEST height ever laid out (the keyboard-free one) - it can grow, never shrink.
  const [avail, setAvail] = useState(null)
  const height = avail ?? 800
  const level = height >= 780 ? 3 : height >= 680 ? 2 : height >= 560 ? 1 : 0

  const initialStep = mode === 'welcome' ? 1 : 2
  const fromRoute = typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : null
  const returnUrl = fromRoute && !fromRoute.startsWith('/auth') ? fromRoute : USER_ROUTES.DASHBOARD

  const [currentStep, setCurrentStep] = useState(initialStep)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [otp, setOtpState] = useState(OTP_EMPTY)
  // The latest digits, written synchronously. Building the next code from the `otp` of the last render
  // lost a digit whenever two arrived before React re-rendered (fast typing, SMS auto-fill) - and a
  // 5-digit code never submits, leaving the buyer stuck on this screen.
  const otpRef = useRef(OTP_EMPTY)
  const setOtp = (next) => {
    otpRef.current = next
    setOtpState(next)
  }
  const [timer, setTimer] = useState(45)
  const [resendNotice, setResendNotice] = useState('')
  const [stepVisible, setStepVisible] = useState(true)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [otpFocus, setOtpFocus] = useState(-1)
  const inputRefs = useRef([])
  const [bodyAnim] = useState(() => new Animated.Value(1))

  useEffect(() => {
    Animated.timing(bodyAnim, { toValue: stepVisible ? 1 : 0, duration: 350, useNativeDriver: true }).start()
  }, [stepVisible, bodyAnim])

  useEffect(() => {
    let id = null
    if (currentStep === 3 && timer > 0) id = setInterval(() => setTimer((p) => (p > 0 ? p - 1 : 0)), 1000)
    return () => id && clearInterval(id)
  }, [currentStep, timer])

  useEffect(() => {
    if (currentStep !== 3) return undefined
    const id = setTimeout(() => inputRefs.current[0]?.focus(), 350)
    return () => clearTimeout(id)
  }, [currentStep])

  const changeStep = useCallback((next) => {
    setStepVisible(false)
    setTimeout(() => {
      setCurrentStep(next)
      setStepVisible(true)
    }, 350)
  }, [])

  const goDashboard = useCallback(() => router.replace(USER_ROUTES.DASHBOARD), [router])

  const goBack = useCallback(() => {
    setError(null)
    if (currentStep === 3) changeStep(2)
    else if (currentStep === 2 && fromRoute) goDashboard()
    else if (currentStep === 2 && initialStep === 1) changeStep(1)
    else if (currentStep === 4) changeStep(2)
    else goDashboard()
  }, [currentStep, fromRoute, initialStep, changeStep, goDashboard])

  // Android back = the header's back arrow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack()
      return true
    })
    return () => sub.remove()
  }, [goBack])

  const handlePhoneChange = (text) => {
    setPhoneNumber(sanitizeIndianPhoneNumber(text))
    if (error) setError(null)
  }

  const handleMobileSubmit = async () => {
    const clean = phoneNumber.replace(/\D/g, '')
    if (clean.length !== 10) return setError('Please enter a valid 10-digit mobile number.')
    if (!acceptedTerms) return setError('Please accept Terms & Conditions to continue.')
    setIsLoading(true)
    setError(null)
    try {
      await sendCustomerOtp(clean)
      setOtp(OTP_EMPTY)
      setTimer(45)
      toast.success('OTP Sent', 'Check your mobile for the verification code.')
      changeStep(3)
    } catch (err) {
      const msg = err?.message || 'Could not send OTP. Please try again.'
      setError(msg)
      toast.error('Could not send OTP', msg)
    } finally {
      setIsLoading(false)
    }
  }

  const verifyingRef = useRef(false)
  const [shakeX] = useState(() => new Animated.Value(0))
  // Error feedback never relies on motion alone: the ErrorAlert + red cell borders stay; the shake is extra.
  const shakeOtp = () => {
    Animated.sequence(
      [8, -8, 6, -6, 3, 0].map((toValue) => Animated.timing(shakeX, { toValue, duration: 45, useNativeDriver: true })),
    ).start()
  }

  const verifyOtpCode = async (entered) => {
    // Auto-submit on the 6th digit and the button can both fire; only one verification may be in flight.
    if (verifyingRef.current) return
    verifyingRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const res = await verifyCustomerOtp({ mobileNumber: phoneNumber, otp: entered })
      useAuthStore.getState().setSession({
        user: res?.data?.user,
        roles: ['customer', 'user'],
        permissions: ['customer.access', 'user.access'],
        accessToken: res?.data?.accessToken,
        refreshToken: res?.data?.refreshToken,
      })
      setUserProfile(res?.data?.user)
      setIsNewUser(Boolean(res?.isNewUser))
      toast.success('Welcome back!', 'Signed in successfully.')
      changeStep(4)
    } catch (err) {
      const msg = err?.message || 'Invalid OTP. Please try again.'
      setError(msg)
      shakeOtp()
      toast.error('Verification failed', msg)
    } finally {
      verifyingRef.current = false
      setIsLoading(false)
    }
  }

  const handleOtpChange = (i, raw) => {
    const digits = String(raw || '').replace(/\D/g, '')
    if (error) setError(null)
    // Several digits at once (SMS auto-fill, paste): spread them over the boxes.
    if (digits.length >= 6 || (digits.length > 1 && !otpRef.current[i])) {
      const start = digits.length >= 6 ? 0 : i
      const n = [...otpRef.current]
      for (let k = 0; k < digits.length && start + k < 6; k += 1) n[start + k] = digits[k]
      setOtp(n)
      const full = n.join('')
      inputRefs.current[Math.min(start + digits.length, 5)]?.focus()
      if (full.length === 6) verifyOtpCode(full)
      return
    }
    const ch = digits.slice(-1)
    const next = [...otpRef.current]
    next[i] = ch
    setOtp(next)
    if (ch && i < 5) inputRefs.current[i + 1]?.focus()
    if (ch && i === 5) {
      const full = next.join('')
      if (full.length === 6) verifyOtpCode(full)
    }
  }

  const handleOtpKeyPress = (i, e) => {
    if (e.nativeEvent.key === 'Backspace' && !otpRef.current[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }

  const handleResendOtp = async () => {
    if (!phoneNumber) return
    setTimer(45)
    setError(null)
    try {
      await sendCustomerOtp(phoneNumber)
      setResendNotice('OTP resent successfully!')
      toast.success('OTP Resent', 'A fresh code has been sent to your mobile.')
      setTimeout(() => setResendNotice(''), 3000)
    } catch (err) {
      const msg = err?.message || 'Failed to resend OTP.'
      setError(msg)
      toast.error('Resend failed', msg)
    }
  }

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const isOtpComplete = otp.every((d) => d !== '')
  const isPhoneValid = phoneNumber.length === 10

  const editNumber = () => {
    setError(null)
    changeStep(2)
  }

  // Nested <Text> does not inherit the parent's colour here, so the caption style is passed down.
  const termsLinks = (base) => (
    <>
      <Text style={[base, styles.link]} onPress={() => openWebPage('/terms')}>Terms of Service</Text>
      <Text style={base}> & </Text>
      <Text style={[base, styles.link]} onPress={() => openWebPage('/privacy-policy')}>Privacy Policy</Text>
    </>
  )

  return (
    <Screen scroll={false} background="#f8fafc">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Ambient />
      {level >= 2 ? <BottomWave /> : null}
      <View style={{ flex: 1 }} onLayout={(e) => { const h = e.nativeEvent.layout.height; setAvail((prev) => (prev == null || h > prev ? h : prev)) }}>

      <View style={styles.header}>
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

      <View style={styles.main}>
        <View style={styles.cardWrapper}>
          {currentStep === 2 && level >= 1 ? <HeroBanner level={level} /> : null}
          <View style={[styles.card, currentStep === 2 && level >= 1 && styles.cardOverHero]}>

            <Animated.View
              style={{
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              }}
            >
              {/* ───────── STEP 1: WELCOME ───────── */}
              {currentStep === 1 && (
                <View style={[styles.step, { alignItems: 'center' }]}>
                  <Stagger n={1}>
                    <View style={styles.heroAvatar}>
                      <Halo style={styles.heroRingOuter} />
                      <Halo style={styles.heroRingInner} delay={750} />
                      <View style={styles.heroLogoBox}>
                        <Image source={LOGO} style={{ width: 44, height: 44 }} contentFit="contain" />
                      </View>
                    </View>
                  </Stagger>

                  <Stagger n={2}>
                    <View style={styles.blueBadge}>
                      <Icon name="HiSparkles" size={14} color="#3b82f6" />
                      <Text style={styles.blueBadgeText}>India's #1 B2B & B2C Dropshipping Platform</Text>
                    </View>
                  </Stagger>

                  <Stagger n={3}>
                    <Text style={styles.heroTitle}>Direct Factory Wholesale & Commerce</Text>
                  </Stagger>

                  <Stagger n={4}>
                    <Text style={styles.heroDesc}>
                      Connect directly with top manufacturers. Single unit wholesale pricing, zero inventory holding, pan-India 24-48hr dispatch.
                    </Text>
                  </Stagger>

                  <Stagger n={5} style={{ width: '100%', gap: 10 }}>
                    <PrimaryButton label="Sign In with Mobile" onPress={() => changeStep(2)} />
                    <Pressable onPress={goDashboard} style={({ pressed }) => [styles.secondaryBtn, pressed && { backgroundColor: '#f8fafc' }]}>
                      <Text style={styles.secondaryBtnText}>Explore Wholesale Marketplace</Text>
                    </Pressable>
                  </Stagger>

                  <Stagger n={5}>
                    <Text style={styles.termsNotice}>
                      By continuing, you agree to our {termsLinks(styles.termsNotice)}
                    </Text>
                  </Stagger>
                </View>
              )}

              {/* ───────── STEP 2: MOBILE INPUT ───────── */}
              {currentStep === 2 && (
                <View>
                  
                  <View style={styles.step}>
                  <Stagger n={1}>
                    <Stepper step={2} phoneValid={isPhoneValid} />
                  </Stagger>

                  <Stagger n={3}>
                    <Text style={styles.mainTitle}>Enter Your Mobile</Text>
                  </Stagger>

                  {error ? <ErrorAlert msg={error} /> : null}

                  <Stagger n={4} style={{ gap: 20 }}>
                    <View
                      style={[
                        styles.inputContainer,
                        isPhoneValid && { borderColor: '#818cf8' },
                        // Border colour ONLY. Changing the container's elevation/shadow while the input is focused made Android drop the
                        // input's focus ~200ms after it was tapped (keyboard closed, digits lost).
                        phoneFocused && { borderColor: PRIMARY },
                        !!error && { borderColor: '#ef4444' },
                      ]}
                    >
                      <View style={styles.country}>
                        <IndianFlag />
                        <Text noTranslate style={styles.countryCode}>+91</Text>
                        <Icon name="HiChevronDown" size={14} color="#475569" />
                      </View>
                      <View style={styles.separator} />
                      <TextInput
                        value={phoneNumber}
                        onChangeText={handlePhoneChange}
                        onFocus={() => setPhoneFocused(true)}
                        onBlur={() => setPhoneFocused(false)}
                        onSubmitEditing={handleMobileSubmit}
                        editable={!isLoading}
                        keyboardType="phone-pad"
                        inputMode="numeric"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        maxLength={16}
                        autoFocus
                        placeholder={t('Enter 10-digit number')}
                        placeholderTextColor="#94a3b8"
                        style={[styles.phoneInput, !phoneNumber && styles.phoneInputEmpty]}
                        returnKeyType="done"
                      />
                      {phoneNumber && !isLoading ? (
                        <Pressable
                          onPress={() => {
                            setPhoneNumber('')
                            setError(null)
                          }}
                          accessibilityLabel="Clear mobile number"
                          style={styles.clearBtn}
                        >
                          <Icon name="HiXMark" size={14} color="#64748b" />
                        </Pressable>
                      ) : null}
                    </View>

                    {level >= 2 ? <View style={styles.dotsWrap}>
                      <View style={styles.dotsRow}>
                        {Array.from({ length: 10 }).map((_, index) => (
                          <View key={index} style={[styles.dot, index < phoneNumber.length && styles.dotFilled]} />
                        ))}
                      </View>
                    </View> : null}

                    <Pressable
                      style={styles.checkRow}
                      onPress={() => {
                        const next = !acceptedTerms
                        setAcceptedTerms(next)
                        if (error && next) setError(null)
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: acceptedTerms }}
                    >
                      <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
                        {acceptedTerms ? <Icon name="HiCheck" size={13} color="#fff" /> : null}
                      </View>
                      <Text style={styles.checkCaption}>
                        I agree to KroZenda's {termsLinks(styles.checkCaption)}
                      </Text>
                    </Pressable>

                    <PrimaryButton
                      onPress={handleMobileSubmit}
                      disabled={!isPhoneValid}
                      loading={isLoading}
                      loadingLabel="Sending Secure OTP…"
                      label={isPhoneValid ? 'Get Verification Code' : 'Enter Mobile to Continue'}
                    />
                  </Stagger>

                  
                  </View>
                </View>
              )}

              {/* ───────── STEP 3: OTP ───────── */}
              {currentStep === 3 && (
                <View style={styles.step}>
                  <Stagger n={1}>
                    <Stepper step={3} phoneValid />
                  </Stagger>

                  <Stagger n={2}>
                    <View style={styles.phonePill}>
                      <View style={styles.pillPrefix}>
                        <IndianFlag />
                        <Text noTranslate style={styles.pillNumber}>+91 {phoneNumber}</Text>
                      </View>
                      <Pressable onPress={editNumber} accessibilityLabel="Change phone number" style={styles.editBtn}>
                        <Icon name="HiPencilSquare" size={13} color={PRIMARY} />
                        <Text style={styles.editText}>Edit</Text>
                      </Pressable>
                    </View>
                  </Stagger>

                  <Stagger n={3}>
                    <Text style={styles.mainTitle}>Enter Verification Code</Text>
                  </Stagger>

                  {error ? <ErrorAlert msg={error} /> : null}

                  {resendNotice ? (
                    <View style={[styles.alert, styles.alertSuccess]}>
                      <Icon name="HiCheckCircle" size={16} color="#15803d" style={styles.alertIcon} />
                      <Text style={[styles.alertText, { color: '#15803d' }]}>{resendNotice}</Text>
                    </View>
                  ) : null}

                  <Stagger n={4}>
                    <Animated.View style={[styles.otpWrap, { gap: wide ? 10 : 8, transform: [{ translateX: shakeX }] }]}>
                      {otp.map((digit, i) => (
                        <TextInput
                          key={i}
                          ref={(el) => {
                            inputRefs.current[i] = el
                          }}
                          value={digit}
                          editable={!isLoading}
                          onChangeText={(v) => handleOtpChange(i, v)}
                          onKeyPress={(e) => handleOtpKeyPress(i, e)}
                          onFocus={() => setOtpFocus(i)}
                          onBlur={() => setOtpFocus((f) => (f === i ? -1 : f))}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          // Lets the OS offer the SMS code (iOS one-time-code / Android autofill).
                          autoComplete="sms-otp"
                          textContentType="oneTimeCode"
                          selectTextOnFocus
                          caretHidden
                          accessibilityLabel={`OTP digit ${i + 1}`}
                          style={[
                            styles.otpCell,
                            wide && styles.otpCellWide,
                            digit ? styles.otpCellFilled : null,
                            otpFocus === i && styles.otpCellFocus,
                            !!error && { borderColor: '#ef4444' },
                            isLoading && { opacity: 0.7 },
                          ]}
                        />
                      ))}
                    </Animated.View>
                  </Stagger>

                  <Stagger n={5}>
                    <PrimaryButton
                      onPress={() => verifyOtpCode(otp.join(''))}
                      disabled={!isOtpComplete}
                      loading={isLoading}
                      loadingLabel="Verifying Credentials…"
                      label="Verify & Continue"
                    />
                  </Stagger>

                  <Stagger n={5}>
                    <View style={styles.resendRow}>
                      {timer > 0 ? (
                        <View style={styles.timerBadge}>
                          <Text style={styles.timerText}>Resend code in</Text>
                          <Text noTranslate style={styles.timerClock}>{fmt(timer)}</Text>
                        </View>
                      ) : (
                        <Pressable onPress={handleResendOtp} style={styles.linkBtn}>
                          <Icon name="HiArrowPath" size={13} color={PRIMARY} />
                          <Text style={[styles.linkBtnText, { color: PRIMARY, fontWeight: '700' }]}>Resend OTP</Text>
                        </Pressable>
                      )}
                      <Text style={styles.linkSep}>•</Text>
                      <Pressable onPress={editNumber} style={styles.linkBtn}>
                        <Text style={styles.linkBtnText}>Change Number</Text>
                      </Pressable>
                    </View>
                  </Stagger>
                </View>
              )}

              {/* ───────── STEP 4: VERIFIED ───────── */}
              {currentStep === 4 && (
                <View style={[styles.step, { alignItems: 'center' }]}>
                  <Stagger n={1}>
                    <View style={styles.successVisual}>
                      <Halo style={[styles.halo, { top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,185,129,0.12)' }]} />
                      <Halo style={[styles.halo, { top: 12, left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(16,185,129,0.18)' }]} delay={500} />
                      <View style={[styles.successBadge, shadows.lg, { shadowColor: '#10b981' }]}>
                        <GradientFill colors={['#059669', '#10b981']} />
                        <Icon name="HiShieldCheck" size={36} color="#fff" />
                      </View>
                    </View>
                  </Stagger>

                  <Stagger n={2}>
                    <View style={styles.successPill}>
                      <Icon name="HiSparkles" size={14} color="#3b82f6" />
                      <Text style={styles.successPillText}>{isNewUser ? 'Welcome to KroZenda!' : 'Welcome Back!'}</Text>
                    </View>
                  </Stagger>

                  <Stagger n={3}>
                    <Text style={[styles.mainTitle, { textAlign: 'center' }]}>
                      {userProfile?.name ? `Hello, ${userProfile.name}!` : 'Verification Complete!'}
                    </Text>
                  </Stagger>

                  <Stagger n={4}>
                    <Text style={styles.subtitle}>
                      Successfully verified for{' '}
                      <Text noTranslate style={{ color: SLATE_900, fontWeight: '800' }}>+91 {phoneNumber}</Text>
                      .{'\n'}You have unlocked full factory wholesale pricing and order management.
                    </Text>
                  </Stagger>

                  <Stagger n={5} style={{ width: '100%' }}>
                    <PrimaryButton
                      colors={['#10b981', '#059669']}
                      glow="#10b981"
                      leadIcon="HiShoppingBag"
                      label="Continue to Marketplace"
                      onPress={() => {
                        // A real tap, so the OS allows the notification prompt.
                        enablePush()
                        router.replace(returnUrl)
                      }}
                    />
                  </Stagger>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Security footer */}
          {level >= 2 ? (
          <View style={styles.footer}>
            <View style={styles.footerTrust}>
              <Icon name="HiLockClosed" size={13} color="#10b981" />
              <Text style={styles.footerTrustText}>256-bit SSL Encrypted  •  GST Invoiced</Text>
            </View>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink} onPress={() => openWebPage('/terms')}>Terms</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLink} onPress={() => openWebPage('/privacy-policy')}>Privacy Policy</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLink} onPress={() => openWebPage('/help')}>Help & Support</Text>
            </View>
          </View>
          ) : null}
        </View>
      </View>
      </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { zIndex: 30 },
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

  main: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12 },
  cardWrapper: { width: '100%', maxWidth: 480, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(226,232,240,0.85)', overflow: 'hidden', ...shadows.lg, shadowColor: '#6366f1' },
  cardOverHero: { marginTop: -34 },
  strip: { height: 3.5, overflow: 'hidden' },

  // hero banner (mobile-number step)
  hero: { paddingTop: 24, paddingBottom: 56, paddingHorizontal: 22, borderRadius: 28, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: -6, bottom: 22 },
  heroCopy: { gap: 8 },
  heroKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#c7d2fe' },
  heroHeadline: { fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, color: '#fff', textAlign: 'left' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, maxWidth: '78%' },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  heroChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  step: { paddingTop: 16, paddingHorizontal: 22, paddingBottom: 20, gap: 12 },

  // stepper
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 220, alignSelf: 'center' },
  stepperItem: { alignItems: 'center', gap: 4 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stepActive: { ...shadows.sm, shadowColor: PRIMARY },
  stepDone: { ...shadows.sm, shadowColor: '#10b981' },
  stepIdle: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  stepNum: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  connector: { flex: 1, height: 2.5, backgroundColor: '#e2e8f0', marginHorizontal: 10, marginBottom: 18, borderRadius: 99, overflow: 'hidden' },

  mainTitle: { fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.72, color: SLATE_900, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 22.4, color: '#64748b', fontWeight: '500', textAlign: 'center' },

  // alerts
  alert: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  alertError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  alertSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  alertIcon: { marginTop: 1 },
  alertText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },

  // phone input
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 18,
    paddingVertical: 6, paddingHorizontal: 14, gap: 10, height: 56, ...shadows['2xs'],
  },
  country: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  flagWrap: { width: 24, height: 16, borderRadius: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  countryCode: { fontSize: 15, fontWeight: '700', color: SLATE_900, letterSpacing: 0.15 },
  separator: { width: 1, height: 24, backgroundColor: '#e2e8f0' },
  phoneInput: { flex: 1, minWidth: 0, padding: 0, fontSize: 17, fontWeight: '700', color: SLATE_900, letterSpacing: 1, fontFamily: 'PlusJakartaSans_700Bold' },
  phoneInputEmpty: { fontSize: 14, fontWeight: '500', letterSpacing: 0, fontFamily: 'PlusJakartaSans_500Medium' },
  clearBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  dotsWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginTop: -4 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#e2e8f0' },
  dotFilled: { width: 12, backgroundColor: PRIMARY },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: -2 },
  checkbox: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  checkCaption: { flex: 1, fontSize: 12, lineHeight: 18.6, color: '#64748b' },
  link: { color: PRIMARY, fontWeight: '700' },

  // buttons
  primaryBtn: {
    width: '100%', height: 52, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  primaryBtnDisabled: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', opacity: 0.5 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.15, color: '#fff' },
  shine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 160, backgroundColor: 'rgba(255,255,255,0.3)' },
  secondaryBtn: { width: '100%', height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },

  // benefits
  benefits: { flexDirection: 'row', gap: 8, marginTop: 4 },
  benefit: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', gap: 6 },
  benefitIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { fontSize: 11, lineHeight: 13, fontWeight: '700', color: SLATE_900, textAlign: 'center' },
  benefitSub: { fontSize: 9.5, lineHeight: 11.4, color: '#64748b', textAlign: 'center', marginTop: -5 },

  // step 3
  phonePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', width: '100%',
  },
  pillPrefix: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillNumber: { fontSize: 14, fontWeight: '700', color: SLATE_900, letterSpacing: 0.56 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  editText: { fontSize: 11.5, fontWeight: '700', color: PRIMARY },
  otpWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  otpCell: {
    width: 42, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff', textAlign: 'center',
    fontSize: 20, fontWeight: '800', color: SLATE_900, padding: 0, fontFamily: 'PlusJakartaSans_800ExtraBold', ...shadows['2xs'],
  },
  otpCellWide: { width: 46, height: 52, fontSize: 22 },
  otpCellFocus: { borderColor: PRIMARY, ...shadows.raised, shadowColor: PRIMARY },
  otpCellFilled: { borderColor: PRIMARY, backgroundColor: '#f8faff', color: PRIMARY },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  timerClock: { fontSize: 13, color: PRIMARY, fontWeight: '800' },
  linkSep: { color: '#cbd5e1', fontSize: 13 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  // step 1
  heroAvatar: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  heroRingOuter: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 28, backgroundColor: 'rgba(99,102,241,0.12)' },
  heroRingInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, backgroundColor: 'rgba(99,102,241,0.16)' },
  heroLogoBox: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
    ...shadows.md, shadowColor: '#6366f1',
  },
  blueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
  },
  blueBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.22, color: '#1d4ed8' },
  heroTitle: { fontSize: 26, lineHeight: 31.2, fontWeight: '800', letterSpacing: -0.78, color: SLATE_900, textAlign: 'center' },
  heroDesc: { fontSize: 13.5, lineHeight: 21.6, color: '#64748b', textAlign: 'center' },
  termsNotice: { fontSize: 11.5, lineHeight: 17.25, color: '#94a3b8', textAlign: 'center' },

  // step 4
  successVisual: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  halo: { position: 'absolute', borderRadius: 999 },
  successBadge: { width: 68, height: 68, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  successPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
  },
  successPillText: { fontSize: 11.5, fontWeight: '700', color: '#065f46' },

  // footer
  footer: { alignItems: 'center', gap: 8 },
  footerTrust: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerTrustText: { fontSize: 11, color: '#64748b', fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLink: { fontSize: 11.5, color: '#64748b' },
  footerDot: { fontSize: 11.5, color: '#cbd5e1' },
})
