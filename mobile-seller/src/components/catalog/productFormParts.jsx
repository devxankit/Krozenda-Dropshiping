import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Icon, SegmentedControl, Text, resolveImageSource } from '../ui'
import { colors, radius, shadows } from '../../theme'
import { SectionHeading } from './layout'
import { withAlpha } from './tw'

// Pieces the web's Add and Edit product modals both spell out inline (identical markup in both), shared
// here so the two native modals cannot drift.

export const GST_RATE_OPTIONS = [
  { value: '', label: 'Select GST slab (optional)' },
  { value: '0', label: '0% (Exempt)' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
]

export function Strong({ children }) {
  return <Text style={{ fontWeight: '600', color: colors.slate[700] }}>{children}</Text>
}

// `rounded-xl border border-border bg-surface p-3.5 shadow-2xs` (subtle: bg-surface-subtle, no shadow).
export function SectionCard({ children, subtle = false, gap = 12 }) {
  return <View style={[styles.card, subtle ? styles.cardSubtle : shadows['2xs'], { gap }]}>{children}</View>
}

export function Section({ step, title, children, gap }) {
  return (
    <SectionCard gap={gap}>
      <SectionHeading step={step}>{title}</SectionHeading>
      {children}
    </SectionCard>
  )
}

const THUMB_BADGE = {
  main: { bg: colors.brand[600], label: '★ Main' },
  gallery: { bg: withAlpha(colors.slate[900], 0.7), label: 'Gallery' },
  new: { bg: colors.emerald[600], label: 'New' },
}

// items: [{ key, src, kind: 'main' | 'gallery' | 'new', isNewUpload?, onRemove }]
export function ImagesSection({ note, count, addLabel, onAdd, items }) {
  return (
    <SectionCard subtle gap={8}>
      <View style={styles.imagesHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SectionHeading step={1} required>
            Images & Photos
          </SectionHeading>
          <Text style={styles.note}>{note}</Text>
        </View>
        {count > 0 ? (
          <Badge tone="brand" size="sm">
            {`${count} ${count === 1 ? 'photo' : 'photos'}`}
          </Badge>
        ) : null}
      </View>

      <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [styles.add, pressed && { backgroundColor: withAlpha(colors.brand[50], 0.5) }]}>
        <Icon name="upload" size={16} color={colors.brand[600]} />
        <Text style={styles.addText}>{addLabel}</Text>
      </Pressable>

      {items.length > 0 ? (
        <View style={styles.thumbs}>
          {items.map((item) => {
            const badge = THUMB_BADGE[item.kind]
            const isMain = item.kind === 'main'
            return (
              <View
                key={String(item.key?.uri ?? item.key)}
                style={[
                  styles.thumb,
                  shadows['2xs'],
                  isMain ? styles.thumbMain : item.isNewUpload ? { borderColor: colors.brand[300] } : { borderColor: colors.border.DEFAULT },
                ]}
              >
                <Image source={resolveImageSource(item.src)} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={[styles.thumbBadge, { backgroundColor: badge.bg }]}>
                  <Text style={styles.thumbBadgeText}>{badge.label}</Text>
                </View>
                <Pressable onPress={item.onRemove} hitSlop={6} accessibilityLabel="Remove image" style={styles.thumbRemove}>
                  <Icon name="close" size={10} color="#fff" />
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : null}
    </SectionCard>
  )
}

const STATUS_ITEMS = (activeLabel) => [
  { id: 'Active', label: activeLabel },
  { id: 'Draft', label: 'Draft' },
  { id: 'Inactive', label: 'Inactive' },
]

export function StatusSection({ status, onChange, activeLabel, activeNote }) {
  return (
    <SectionCard gap={8}>
      <View style={styles.statusHead}>
        <SectionHeading step={6} required>
          Product Status
        </SectionHeading>
        <Badge tone={status === 'Active' ? 'success' : status === 'Draft' ? 'warning' : 'neutral'} dot size="sm">
          {status}
        </Badge>
      </View>

      <SegmentedControl items={STATUS_ITEMS(activeLabel)} activeId={status} onChange={onChange} />
      <Text style={styles.note}>
        {status === 'Active' && activeNote}
        {status === 'Draft' && 'Draft products remain saved as unpublished drafts.'}
        {status === 'Inactive' && 'Inactive products remain disabled.'}
      </Text>
    </SectionCard>
  )
}

// Flash Sale / Trending placement is set by admin, not the seller - only "returnable" is theirs.
export function ReturnableCard({ checked, onChange }) {
  return (
    <View style={styles.returnable}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
      >
        <View style={[styles.check, checked && { backgroundColor: colors.emerald[600], borderColor: colors.emerald[600] }]}>
          {checked ? <Icon name="check" size={12} color="#fff" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.returnTitle}>↩️ Returnable Product</Text>
          <Text style={styles.returnNote}>
            When on, buyers can request a return or replacement within 7 days of delivery. Turn off for non-returnable items.
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 14,
  },
  cardSubtle: { backgroundColor: colors.surface.muted },
  imagesHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  note: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 10,
  },
  addText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  thumb: {
    height: 64,
    width: 64,
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface.DEFAULT,
  },
  thumbMain: { borderColor: colors.brand[500], borderWidth: 2 },
  thumbBadge: { position: 'absolute', left: 2, top: 2, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  thumbBadgeText: { fontSize: 8, lineHeight: 11, fontWeight: '700', color: '#fff' },
  thumbRemove: {
    position: 'absolute',
    right: 2,
    top: 2,
    height: 16,
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: withAlpha(colors.slate[900], 0.8),
  },
  returnable: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.emerald[200], 0.9),
    backgroundColor: withAlpha(colors.emerald[50], 0.8),
    padding: 14,
  },
  check: {
    marginTop: 2,
    height: 16,
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.emerald[300],
    backgroundColor: '#fff',
  },
  returnTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  returnNote: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.slate[600] },
})
