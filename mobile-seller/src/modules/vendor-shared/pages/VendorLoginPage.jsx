import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { VendorAuthShell as VendorLoginShell } from '../components/shell/VendorAuthShell'
import { AuthButton, AuthInput, AuthLabel } from '../components/auth/AuthFields'
import { Icon } from '../../../components/ui/Icon'
import { Text } from '../../../components/ui/Text'
import { useAuthStore } from '../../../lib/authStore'
import { toast } from '../../../lib/toast'
import {
  useVendorForgotPasswordController,
  useVendorLoginController,
  useVendorPushRegistration,
  useVendorResetPasswordController,
} from '../controllers/useVendorController'
import { AUTH_ROUTES, SELLER_ROUTES } from '../../../config/routes'
import { colors, shadows } from '../../../theme'

// Seller sign-in. The web's 'partner' demo branch is out of scope for the native seller app, and demo
// credentials are never pre-filled (the web only does that in dev builds).
export function VendorLoginPage() {
  return <SellerLoginPage />
}

function SellerLoginPage() {
  const router = useRouter()
  const registerPushToken = useVendorPushRegistration()
  const { login, isSubmitting } = useVendorLoginController()
  const [vendorType, setVendorType] = useState('B2C')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const [view, setView] = useState('login') // 'login' | 'forgot'
  const passwordRef = useRef(null)
  const busy = useRef(false)

  function handleTypeSwitch(nextType) {
    setVendorType(nextType)
    setEmail('')
    setPassword('')
    setError(null)
    setErrorCode(null)
  }

  async function handleSubmit() {
    if (busy.current) return
    setError(null)
    setErrorCode(null)
    // Web inputs are `required` (the browser blocks an empty submit).
    if (!email.trim() || !password) {
      setError('Please fill out the email address and password.')
      return
    }

    busy.current = true
    try {
      const { token, vendor } = await login({ email: email.trim(), password })

      useAuthStore.getState().setSession({
        user: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          storeName: vendor.business?.businessName || vendor.name,
          entityType: vendor.vendorType === 'B2B' ? 'Registered Business' : 'Individual Seller',
          language: vendor.language ?? null,
        },
        roles: ['seller', vendor.vendorType === 'B2B' ? 'b2b_seller' : 'b2c_seller'],
        permissions: ['seller.access', 'vendor.access'],
        accessToken: token,
      })

      registerPushToken()
      toast.success('Signed in', `Welcome back, ${vendor.name}.`)
      router.replace(SELLER_ROUTES.DASHBOARD)
    } catch (err) {
      const message =
        err?.message ||
        err?.response?.data?.message ||
        'Unable to sign in. Please verify your credentials or check your account status.'
      const code = err?.code || err?.response?.data?.code || null
      setError(message)
      setErrorCode(code)
      if (code === 'VERIFICATION_PENDING') {
        toast.warning('Account Under Review', message)
      } else if (code === 'VERIFICATION_REJECTED') {
        toast.error('Application Rejected', message)
      } else if (code === 'ACCOUNT_INACTIVE') {
        toast.error('Account Deactivated', message)
      } else {
        toast.error('Sign in failed', message)
      }
    } finally {
      busy.current = false
    }
  }

  if (view === 'forgot') {
    return (
      <VendorLoginShell title="Reset Password" subtitle="Enter your email to receive a 6-digit recovery code">
        <ForgotPasswordFlow
          initialEmail={email}
          onDone={(resetEmail) => {
            setEmail(resetEmail)
            setPassword('')
            setView('login')
          }}
          onCancel={() => setView('login')}
        />
      </VendorLoginShell>
    )
  }

  const alert = ALERT_TONES[errorCode] || ALERT_TONES.default

  return (
    <VendorLoginShell title="Sign in to Seller Portal" subtitle="Manage your products, orders, inventory and payouts">
      <View style={{ gap: 16 }}>
        {/* Segmented Tab Switcher */}
        <View style={{ gap: 8 }}>
          <Text style={styles.typeLabel}>SELLER ACCOUNT TYPE</Text>
          <View style={styles.segment}>
            {['B2C', 'B2B'].map((type) => {
              const isSelected = vendorType === type
              return (
                <Pressable
                  key={type}
                  onPress={() => handleTypeSwitch(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.segItem, isSelected && [styles.segOn, shadows.xs]]}
                >
                  <Icon
                    name={type === 'B2B' ? 'HiOutlineBuildingOffice2' : 'HiOutlineUser'}
                    size={16}
                    color={isSelected ? colors.slate[900] : colors.slate[500]}
                  />
                  <Text style={[styles.segText, { color: isSelected ? colors.slate[900] : colors.slate[500] }]}>{`${type} Seller`}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Main Login Form */}
        <View style={{ gap: 16, paddingTop: 4 }}>
          <AuthInput
            label="Email Address"
            required
            icon="HiOutlineEnvelope"
            value={email}
            onChangeText={setEmail}
            placeholder="seller@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <View>
            <View style={styles.pwHead}>
              <AuthLabel required style={{ marginBottom: 0 }}>
                Password
              </AuthLabel>
              <Pressable onPress={() => setView('forgot')} hitSlop={8}>
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            </View>
            <AuthInput
              ref={passwordRef}
              icon="HiOutlineLockClosed"
              secure
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {/* Error Alert */}
          {error ? (
            <View style={[styles.alert, { backgroundColor: alert.bg, borderColor: alert.border }]}>
              <View style={[styles.dot, { backgroundColor: alert.dot }]} />
              <View style={{ flex: 1 }}>
                {alert.title ? <Text style={[styles.alertTitle, { color: alert.titleColor }]}>{alert.title}</Text> : null}
                <Text style={[styles.alertText, { color: alert.text }]}>{error}</Text>
              </View>
            </View>
          ) : null}

          {/* Submit CTA */}
          <AuthButton onPress={handleSubmit} disabled={isSubmitting} iconRight={isSubmitting ? undefined : 'HiOutlineArrowRight'} style={shadows.xs}>
            {isSubmitting ? 'Signing in…' : `Sign In as ${vendorType} Seller`}
          </AuthButton>
        </View>

        {/* Switch to Register */}
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>New seller on Krozenda? </Text>
          <Pressable onPress={() => router.push(AUTH_ROUTES.REGISTER)} hitSlop={8}>
            <Text style={styles.switchLink}>Create an account</Text>
          </Pressable>
        </View>
      </View>
    </VendorLoginShell>
  )
}

const ALERT_TONES = {
  VERIFICATION_PENDING: {
    bg: colors.warning[50],
    border: colors.warning[300],
    text: colors.warning[900],
    dot: colors.warning[500],
    title: 'Account Under Review',
    titleColor: colors.warning[900],
  },
  VERIFICATION_REJECTED: {
    bg: colors.danger[50],
    border: colors.danger[300],
    text: colors.danger[900],
    dot: colors.danger[500],
    title: 'Application Needs Attention',
    titleColor: colors.danger[900],
  },
  ACCOUNT_INACTIVE: {
    bg: colors.slate[100],
    border: colors.slate[300],
    text: colors.slate[800],
    dot: colors.slate[500],
    title: 'Account Deactivated',
    titleColor: colors.slate[900],
  },
  default: { bg: colors.danger[50], border: colors.danger[200], text: colors.danger[700], dot: colors.danger[600], title: null },
}

function ForgotPasswordFlow({ initialEmail, onDone, onCancel }) {
  const { requestReset, isSubmitting: isRequesting } = useVendorForgotPasswordController()
  const { resetPassword, isSubmitting: isResetting } = useVendorResetPasswordController()

  const [step, setStep] = useState('request')
  const [email, setEmail] = useState(initialEmail || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [devHint, setDevHint] = useState(null)
  const newPwRef = useRef(null)
  const confirmPwRef = useRef(null)
  const otpRef = useRef(null)

  async function handleRequest() {
    if (isRequesting) return
    setError(null)
    if (!email.trim()) {
      setError('Please fill out the registered email address.')
      return
    }
    try {
      const result = await requestReset({ email: email.trim() })
      setDevHint(result?.otp || null)
      toast.success('Reset code sent', 'Check your email for the 6-digit code.')
      setStep('reset')
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || 'Could not send reset code')
    }
  }

  async function handleReset() {
    if (isResetting) return
    setError(null)
    if (!otp.trim() || !newPassword || !confirmPassword) {
      setError('Please fill out all the fields.')
      return
    }
    try {
      await resetPassword({ email: email.trim(), otp: otp.trim(), newPassword, confirmPassword })
      toast.success('Password reset', 'Sign in with your new password.')
      onDone(email.trim())
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || 'Could not reset password')
    }
  }

  const errorBox = error ? (
    <View style={styles.simpleError}>
      <Text style={styles.simpleErrorText}>{error}</Text>
    </View>
  ) : null

  return (
    <View style={{ gap: 16 }}>
      {step === 'request' ? (
        <View style={{ gap: 16 }}>
          <AuthInput
            label="Registered Email Address"
            required
            icon="HiOutlineEnvelope"
            value={email}
            onChangeText={setEmail}
            placeholder="seller@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={handleRequest}
          />
          {errorBox}
          <View style={styles.btnRow}>
            <AuthButton variant="outline" onPress={onCancel} px={12} style={{ flex: 1 }}>
              Cancel
            </AuthButton>
            <AuthButton onPress={handleRequest} disabled={isRequesting} style={[{ flex: 2 }, shadows.xs]}>
              {isRequesting ? 'Sending Code…' : 'Send Reset Code'}
            </AuthButton>
          </View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {devHint ? (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Demo OTP: <Text noTranslate style={styles.hintOtp}>{devHint}</Text>
              </Text>
              <Pressable onPress={() => setOtp(devHint)} hitSlop={8}>
                <Text style={styles.hintFill}>Auto-fill</Text>
              </Pressable>
            </View>
          ) : null}

          <AuthInput
            ref={otpRef}
            label="6-Digit Code (OTP)"
            required
            icon="HiOutlineKey"
            mono
            bold
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => newPwRef.current?.focus()}
          />

          <AuthInput
            ref={newPwRef}
            label="New Password"
            required
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmPwRef.current?.focus()}
          />

          <AuthInput
            ref={confirmPwRef}
            label="Confirm New Password"
            required
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleReset}
          />

          {errorBox}

          <View style={styles.btnRow}>
            <AuthButton variant="outline" onPress={() => setStep('request')} px={12} style={{ flex: 1 }}>
              Back
            </AuthButton>
            <AuthButton variant="success" onPress={handleReset} disabled={isResetting} style={[{ flex: 2 }, shadows.xs]}>
              {isResetting ? 'Saving…' : 'Update Password'}
            </AuthButton>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  typeLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.slate[500], letterSpacing: 0.55 },
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: colors.slate[100],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
  },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  segOn: { backgroundColor: '#fff' },
  segText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  pwHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  forgot: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.brand[600] },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  alertTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', marginBottom: 2 },
  alertText: { fontSize: 12, lineHeight: 19.5 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', paddingTop: 8 },
  switchText: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  switchLink: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand[600] },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  simpleError: { padding: 12, borderRadius: 12, backgroundColor: colors.danger[50], borderWidth: 1, borderColor: colors.danger[200] },
  simpleErrorText: { fontSize: 12, lineHeight: 16, color: colors.danger[700] },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[200],
  },
  hintText: { fontSize: 12, lineHeight: 16, color: colors.brand[800] },
  hintOtp: { fontWeight: '700', color: colors.brand[900] },
  hintFill: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand[700], textDecorationLine: 'underline' },
})
