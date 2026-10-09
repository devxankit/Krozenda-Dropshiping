import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Badge, Icon, Input, Text } from '../../../../components/ui'
import { FormDrawer } from '../../../../components/admin/forms'
import { InlineAlert } from '../../../../components/admin/feedback'
import { pickImages } from '../../../../components/catalog/pickImages'
import { withAlpha } from '../../../../components/catalog/tw'
import { SELLER_ROUTES } from '../../../../config/routes'
import { colors, radius, shadows } from '../../../../theme'
import { useVendorFssaiController } from '../../controllers/useVendorController'

const FSSAI_WARNING = {
  MISSING: 'You have not uploaded an FSSAI licence. Admin will not approve a food category until you upload one from Store Profile and it is approved.',
  PENDING: 'Your FSSAI licence is under review. This category will be reviewed once admin approves the licence.',
  REJECTED: 'Your FSSAI licence was rejected. Re-upload a valid licence from Store Profile — until then this category cannot be approved.',
}

// The picked file is { uri, name, type } - the shape React Native's FormData uploads (the web passes a File).

function PickerBlock({ label, file, onPick, onClear, chooseLabel, changeLabel, hint, icon, tint, contain }) {
  const previewSrc = file?.uri
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerBox}>
        {previewSrc ? (
          <View style={[styles.previewBig, contain && { alignItems: 'center', justifyContent: 'center', padding: 4 }]}>
            <Image source={{ uri: previewSrc }} style={contain ? { height: '100%', width: '100%' } : StyleSheet.absoluteFill} contentFit={contain ? 'contain' : 'cover'} />
          </View>
        ) : (
          <View style={[styles.previewBig, { backgroundColor: tint.bg, borderColor: tint.ring, alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name={icon} size={28} color={tint.fg} />
          </View>
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={onPick} accessibilityRole="button" style={({ pressed }) => [styles.chooseBtn, shadows.xs, pressed && { backgroundColor: colors.slate[50] }]}>
              <Icon name="upload" size={14} color={colors.slate[700]} />
              <Text style={styles.chooseText}>{previewSrc ? changeLabel : chooseLabel}</Text>
            </Pressable>
            {file ? (
              <Pressable onPress={onClear} accessibilityRole="button" style={styles.clearBtn}>
                <Text style={styles.clearText}>Clear Selection</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      </View>
    </View>
  )
}

function CardPreview({ name, file, placeholder, initialsFallback, tint, contain }) {
  const previewSrc = file?.uri
  return (
    <View style={styles.previewWrap}>
      <Text style={styles.previewLabel}>Live Card Preview</Text>
      <View style={[styles.previewCard, shadows.xs]}>
        {previewSrc ? (
          <View style={[styles.previewSmall, contain && { padding: 4, backgroundColor: '#fff' }]}>
            <Image source={{ uri: previewSrc }} style={contain ? { height: '100%', width: '100%' } : StyleSheet.absoluteFill} contentFit={contain ? 'contain' : 'cover'} />
          </View>
        ) : (
          <View style={[styles.previewSmall, { backgroundColor: tint.bg, borderColor: tint.ring, alignItems: 'center', justifyContent: 'center' }]}>
            <Text noTranslate style={[styles.initials, { color: tint.fg }]}>
              {name ? name.slice(0, 2).toUpperCase() : initialsFallback}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.previewName}>
            {name || placeholder}
          </Text>
          <Badge tone="warning" dot size="sm" style={{ marginTop: 4 }}>
            Pending review
          </Badge>
        </View>
      </View>
    </View>
  )
}

export function VendorCategoryFormDrawer({ isOpen, onClose, onSubmit, isSubmitting }) {
  const router = useRouter()
  const [imageFile, setImageFile] = useState(null)
  const [name, setName] = useState('')
  const [isFood, setIsFood] = useState(false)
  const [issue, setIssue] = useState(null)
  const { data: fssai } = useVendorFssaiController()
  const fssaiWarning = isFood && fssai && fssai.status !== 'APPROVED' ? FSSAI_WARNING[fssai.status] : null

  function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setIssue('Category name is required')
      return
    }
    setIssue(null)
    onSubmit({ name: name.trim(), image: imageFile, isFood })
  }

  async function pick() {
    const [file] = await pickImages({ multiple: false })
    if (file) setImageFile(file)
  }

  const brandTint = { bg: colors.brand[50], ring: colors.brand[100], fg: colors.brand[600] }
  const initialsTint = { bg: withAlpha(colors.brand[500], 0.1), ring: withAlpha(colors.brand[500], 0.2), fg: colors.brand[600] }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Category"
      description="Name and image — admin reviews this before it appears on the storefront or in product forms."
      submitLabel="Add Category"
      isSubmitting={isSubmitting}
      error={issue ? { message: issue } : null}
      onSubmit={handleSubmit}
      width="md"
    >
      <InlineAlert tone="info" title="Goes live after approval">
        This category stays hidden and unusable until an admin approves it from the Approval Queue.
      </InlineAlert>

      <PickerBlock
        label="Category Image / Thumbnail"
        file={imageFile}
        onPick={pick}
        onClear={() => setImageFile(null)}
        chooseLabel="Choose File"
        changeLabel="Change Image"
        hint="Recommended: Square PNG, WebP or JPG at least 600×600 px."
        icon="categories"
        tint={brandTint}
      />

      <Input label="Category Name" required placeholder="e.g. Ayurvedic Wellness" value={name} onChange={(event) => setName(event.target.value)} />

      <Pressable
        onPress={() => setIsFood((prev) => !prev)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isFood }}
        style={styles.foodBox}
      >
        <View style={[styles.check, isFood && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] }]}>
          {isFood ? <Icon name="check" size={12} color="#fff" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.foodTitle}>This is a food category</Text>
          <Text style={styles.foodNote}>Food, grocery, beverages, snacks etc. — needs an approved FSSAI licence.</Text>
        </View>
      </Pressable>

      {fssaiWarning ? (
        <InlineAlert
          tone="warning"
          title="FSSAI licence required"
          action={
            <Pressable
              onPress={() => {
                onClose()
                router.push(SELLER_ROUTES.PROFILE)
              }}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Go to Store Profile</Text>
            </Pressable>
          }
        >
          {fssaiWarning}
        </InlineAlert>
      ) : null}

      <CardPreview name={name} file={imageFile} placeholder="Category Name" initialsFallback="CT" tint={initialsTint} />
    </FormDrawer>
  )
}

export function VendorBrandFormDrawer({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [logoFile, setLogoFile] = useState(null)
  const [name, setName] = useState('')
  const [issue, setIssue] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setIssue('Brand name is required')
      return
    }
    setIssue(null)
    onSubmit({ name: name.trim(), logo: logoFile })
  }

  async function pick() {
    const [file] = await pickImages({ multiple: false })
    if (file) setLogoFile(file)
  }

  const warnTint = { bg: colors.warning[50], ring: colors.warning[100], fg: colors.warning[700] }
  const initialsTint = { bg: withAlpha(colors.warning[500], 0.1), ring: withAlpha(colors.warning[500], 0.2), fg: colors.warning[700] }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Brand"
      description="Name and logo — admin reviews this before it appears on the storefront or in product forms."
      submitLabel="Add Brand"
      isSubmitting={isSubmitting}
      error={issue ? { message: issue } : null}
      onSubmit={handleSubmit}
      width="md"
    >
      <InlineAlert tone="info" title="Goes live after approval">
        This brand stays hidden and unusable until an admin approves it from the Approval Queue.
      </InlineAlert>

      <PickerBlock
        label="Brand Logo"
        file={logoFile}
        onPick={pick}
        onClear={() => setLogoFile(null)}
        chooseLabel="Upload Logo"
        changeLabel="Change Logo"
        hint="Square logo with clean background (PNG, WebP or SVG)."
        icon="brands"
        tint={warnTint}
        contain
      />

      <Input label="Brand Name" required placeholder="e.g. Arya Manufacturing" value={name} onChange={(event) => setName(event.target.value)} />

      <CardPreview name={name} file={logoFile} placeholder="Brand Name" initialsFallback="BR" tint={initialsTint} contain />
    </FormDrawer>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.slate[500] },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.slate[300],
    backgroundColor: withAlpha(colors.slate[50], 0.8),
    padding: 16,
  },
  previewBig: {
    height: 64,
    width: 64,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  chooseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chooseText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
  clearBtn: { borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 6 },
  clearText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.danger[600] },
  hint: { fontSize: 11, lineHeight: 16, color: colors.slate[400] },
  foodBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: withAlpha(colors.slate[50], 0.7),
    padding: 12,
  },
  check: {
    marginTop: 2,
    height: 16,
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.slate[300],
    backgroundColor: '#fff',
  },
  foodTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  foodNote: { fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  link: { fontSize: 12, lineHeight: 16, fontWeight: '600', textDecorationLine: 'underline', color: colors.warning[700] },
  previewWrap: {
    marginTop: 8,
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: withAlpha(colors.slate[200], 0.8),
    backgroundColor: withAlpha(colors.slate[50], 0.6),
    padding: 16,
  },
  previewLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.slate[400] },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    padding: 14,
  },
  previewSmall: {
    height: 48,
    width: 48,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: withAlpha(colors.slate[200], 0.8),
    backgroundColor: colors.slate[50],
  },
  initials: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  previewName: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
})
