import { useState } from 'react'
import { ActivityIndicator, Pressable, TextInput, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { USER_ROUTES } from '../../../../config/routes'
import { useProfileController } from '../../controllers/useProfileController'
import { toast } from '../../../../lib/toast'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

// Mirrors the backend's multer limit and its accepted formats. Checked before the upload rather
// than after a slow failed request.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const NAME_MAX_LENGTH = 80

function toDateInputValue(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }

export function EditProfileScreen({ onBack }) {
  const router = useRouter()
  const handleBack =
    onBack ||
    (() => {
      if (router.canGoBack()) router.back()
      else router.replace(USER_ROUTES.DASHBOARD)
    })

  const {
    profile,
    isLoading,
    updateProfile,
    isUpdating,
    updateError,
    uploadImage,
    isUploadingImage,
    changePassword,
    isChangingPassword,
    changePasswordError,
  } = useProfileController()

  const [form, setForm] = useState({
    name: '',
    email: '',
    dob: '',
    mobileNumber: '',
    business: { companyName: '', gstin: '', pan: '', tradeType: '' },
  })
  const [savedMessage, setSavedMessage] = useState(false)
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Seed the form from the profile once it arrives (render-phase adjustment, no flash of empty).
  const [seededFor, setSeededFor] = useState(null)
  if (profile && seededFor !== profile.id) {
    setSeededFor(profile.id)
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      dob: toDateInputValue(profile.dob),
      mobileNumber: profile.mobileNumber || '',
      business: {
        companyName: profile.business?.companyName || '',
        gstin: profile.business?.gstin || '',
        pan: profile.business?.pan || '',
        tradeType: profile.business?.tradeType || '',
      },
    })
  }

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handlePickImage = async () => {
    setImageError(null)
    let result
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    } catch (err) {
      setImageError(err?.message || 'Could not open your photos.')
      return
    }
    if (result.canceled || !result.assets?.length) return // the user cancelled the picker - not an error
    const asset = result.assets[0]
    const type = (asset.mimeType || '').toLowerCase()

    if (!ACCEPTED_IMAGE_TYPES.includes(type)) {
      setImageError('Please choose a JPEG, PNG, WebP, AVIF or GIF image.')
      return
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setImageError('That image is larger than 10MB. Please choose a smaller one.')
      return
    }

    const file = {
      uri: asset.uri,
      name: asset.fileName || `profile-${Date.now()}.${EXT_BY_TYPE[type] || 'jpg'}`,
      type,
    }
    try {
      await uploadImage(file)
      toast.success('Photo Updated', 'Your profile picture was uploaded successfully.')
    } catch (err) {
      const msg = err?.message || 'Could not upload that photo. Please try again.'
      setImageError(msg)
      toast.error('Upload Failed', err)
    }
  }

  const handleSubmit = async () => {
    if (isUpdating) return
    if (!form.name.trim()) {
      toast.error('Full Name is required')
      return
    }
    setSavedMessage(false)
    try {
      await updateProfile(form)
      setSavedMessage(true)
      toast.success('Profile Updated', 'Your personal details have been saved.')
      setTimeout(() => setSavedMessage(false), 3000)
    } catch (err) {
      toast.error('Could not save profile', err)
    }
  }

  const updatePassword = (field) => (value) => setPasswordForm((prev) => ({ ...prev, [field]: value }))

  const handlePasswordSubmit = async () => {
    if (isChangingPassword) return
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in the new password fields')
      return
    }
    setPasswordSaved(false)
    try {
      await changePassword(passwordForm)
      setPasswordForm(EMPTY_PASSWORD_FORM)
      setPasswordSaved(true)
      toast.success('Password Updated', 'Your password was changed successfully.')
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (err) {
      toast.error('Could not update password', err)
    }
  }

  const header = (
    <View style={styles.topBar}>
      <Pressable onPress={handleBack} accessibilityLabel="Go back" style={styles.backBtn}>
        <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
      </Pressable>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.slate[900] }}>Edit Profile</Text>
    </View>
  )

  const dobDate = form.dob ? new Date(`${form.dob}T00:00:00`) : new Date()

  return (
    <Screen nav activeTab="profile" header={header} keyboard>
      {isLoading ? (
        <View style={{ padding: 16, gap: 16 }}>
          <View style={[styles.card, { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
            <Skeleton style={{ height: 80, width: 80, borderRadius: 40 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ height: 14, width: '60%' }} />
              <Skeleton style={{ height: 12, width: '80%' }} />
            </View>
          </View>
          <View style={[styles.card, { padding: 20, gap: 16 }]}>
            {[0, 1, 2, 3].map((n) => (
              <View key={n} style={{ gap: 8 }}>
                <Skeleton style={{ height: 10, width: 80 }} />
                <Skeleton style={{ height: 44, width: '100%', borderRadius: radius.lg }} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ padding: 16, gap: 16 }}>
          {/* Profile photo */}
          <View style={[styles.card, shadows.xs, { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
            <View>
              <View style={[styles.avatar, shadows.md]}>
                {profile?.image ? (
                  <SmartImage src={profile.image} alt={`${profile.name || 'Your'} profile photo`} ratio={1} fit="cover" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text noTranslate style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>
                    {(form.name || 'C').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={handlePickImage}
                disabled={isUploadingImage}
                accessibilityLabel="Change profile photo"
                style={({ pressed }) => [
                  styles.camera,
                  shadows.md,
                  { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: isUploadingImage ? 0.6 : 1 },
                ]}
              >
                {isUploadingImage ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="HiCamera" size={16} color="#fff" />}
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>Profile Photo</Text>
              <Text style={{ fontSize: 11, color: colors.slate[500], marginTop: 2 }}>
                {isUploadingImage ? 'Uploading…' : 'JPEG, PNG or WebP, up to 10MB'}
              </Text>
              {imageError ? (
                <Text style={{ marginTop: 4, fontSize: 11, fontWeight: '600', color: colors.red[600] }}>{imageError}</Text>
              ) : null}
            </View>
          </View>

          {/* Fields */}
          <View style={[styles.card, shadows.xs, { padding: 20, gap: 16 }]}>
            <Field label="Full Name" value={form.name} onChangeText={update('name')} required maxLength={NAME_MAX_LENGTH} autoComplete="name" />
            <Field
              label="Email Address"
              value={form.email}
              onChangeText={update('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Date of Birth"
              value={form.dob}
              placeholder="YYYY-MM-DD"
              pressable
              onPress={() => setShowDatePicker(true)}
            />
            <Field
              label="Mobile Number"
              value={form.mobileNumber}
              readOnly
              helperText="Mobile number cannot be changed as it is linked to your account login."
            />
          </View>

          {showDatePicker ? (
            <DateTimePicker
              value={dobDate}
              mode="date"
              maximumDate={new Date()}
              onValueChange={(_event, date) => {
                setShowDatePicker(false)
                if (date) update('dob')(date.toISOString().slice(0, 10))
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          ) : null}

          {updateError ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600], paddingHorizontal: 4 }}>{updateError.message}</Text>
          ) : null}
          {savedMessage ? <SuccessBanner text="Profile updated successfully" /> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={isUpdating}
            style={({ pressed }) => [
              styles.submit,
              shadows.md,
              { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: isUpdating ? 0.6 : 1 },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>

          {/* Password */}
          <View style={[styles.card, shadows.xs, { padding: 20, gap: 16, marginTop: 0 }]}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>Password</Text>
              <Text style={{ fontSize: 11, color: colors.slate[500], marginTop: 2 }}>
                {'Optional — set a password if you’d also like to sign in without OTP. Leave “Current password” blank if you have not set one yet.'}
              </Text>
            </View>
            <Field
              label="Current Password"
              secureTextEntry
              value={passwordForm.currentPassword}
              onChangeText={updatePassword('currentPassword')}
              autoCapitalize="none"
              autoComplete="current-password"
            />
            <Field
              label="New Password"
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={updatePassword('newPassword')}
              autoCapitalize="none"
              autoComplete="new-password"
              required
            />
            <Field
              label="Confirm New Password"
              secureTextEntry
              value={passwordForm.confirmPassword}
              onChangeText={updatePassword('confirmPassword')}
              autoCapitalize="none"
              autoComplete="new-password"
              required
            />
          </View>

          {changePasswordError ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600], paddingHorizontal: 4 }}>{changePasswordError.message}</Text>
          ) : null}
          {passwordSaved ? <SuccessBanner text="Password updated successfully" /> : null}

          <Pressable
            onPress={handlePasswordSubmit}
            disabled={isChangingPassword || !passwordForm.newPassword}
            style={({ pressed }) => [
              styles.submit,
              shadows.xs,
              {
                backgroundColor: pressed ? colors.slate[50] : '#fff',
                borderWidth: 2,
                borderColor: colors.blue[700],
                opacity: isChangingPassword || !passwordForm.newPassword ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[700], letterSpacing: 0.3 }}>
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  )
}

function SuccessBanner({ text }) {
  return (
    <View style={styles.success}>
      <Icon name="HiCheckCircle" size={16} color={colors.emerald[700]} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.emerald[700] }}>{text}</Text>
    </View>
  )
}

function Field({ label, required, readOnly, helperText, pressable, onPress, ...props }) {
  const [focused, setFocused] = useState(false)
  const isLocked = Boolean(readOnly)
  const inputStyle = [
    styles.input,
    isLocked
      ? { backgroundColor: colors.slate[100], color: colors.slate[500], borderColor: colors.slate[200] }
      : { backgroundColor: focused ? '#fff' : colors.slate[50], color: colors.slate[900], borderColor: focused ? colors.blue[500] : colors.slate[200], borderWidth: focused ? 2 : 1 },
  ]
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[500] }}>
          {label}
          {required && !isLocked ? (
            <Text noTranslate style={{ color: colors.red[500] }}>
              {' *'}
            </Text>
          ) : null}
        </Text>
        {isLocked ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="HiLockClosed" size={12} color={colors.slate[400]} />
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.slate[400] }}>Not Editable</Text>
          </View>
        ) : null}
      </View>
      {pressable ? (
        <Pressable onPress={onPress} style={[inputStyle, { justifyContent: 'center' }]}>
          <Text noTranslate style={{ fontSize: 12, fontWeight: '600', color: props.value ? colors.slate[900] : colors.slate[400] }}>
            {props.value || props.placeholder}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          {...props}
          editable={!isLocked}
          placeholderTextColor={colors.slate[400]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={inputStyle}
        />
      )}
      {helperText ? <Text style={{ fontSize: 10, fontWeight: '500', color: colors.slate[400], paddingHorizontal: 2 }}>{helperText}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  card: { backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: colors.blue[900],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fff',
  },
  camera: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    height: 40,
    width: 40,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 40,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: radius.xl,
    borderWidth: 1,
    fontSize: 12,
    fontFamily: fontFamilyFor('600'),
  },
  submit: { width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.xl, alignItems: 'center' },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.emerald[50],
    borderWidth: 1,
    borderColor: colors.emerald[200],
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
})
