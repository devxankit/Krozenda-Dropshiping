import { useState } from 'react'
import { PixelRatio, View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { env } from '../../config/env'
import { colors } from '../../theme'
import { Icon } from './Icon'
import { Text } from './Text'

export const DEFAULT_PRODUCT_IMAGE = '/images/default-product.png'

// Relative paths ('/images/x.png', '/uploads/...') load from the web origin (EXPO_PUBLIC_WEB_ORIGIN); absolute URLs untouched.
export function resolveImageSource(src) {
  if (!src) return null
  if (typeof src === 'number') return src
  const value = String(src)
  if (/^(https?:|data:|file:)/i.test(value)) return { uri: value }
  if (value.startsWith('//')) return { uri: `https:${value}` }
  return { uri: `${env.webOrigin}${value.startsWith('/') ? '' : '/'}${value}` }
}

// Picks the smallest srcSet candidate ("url 400w, url 800w, url 1200w") that still covers
// `cssWidth` device-independent px on this screen, so a card thumbnail never decodes the 1000px+ file.
// Falls back to `fallback` (the canonical src) when there is no usable srcSet.
export function pickFromSrcSet(srcSet, cssWidth, fallback) {
  if (!srcSet || typeof srcSet !== 'string') return fallback
  const candidates = []
  const re = /(\S+)\s+(\d+)w/g
  let m = re.exec(srcSet)
  while (m) {
    candidates.push({ url: m[1].replace(/^,/, ''), width: Number(m[2]) })
    m = re.exec(srcSet)
  }
  if (!candidates.length) return fallback
  candidates.sort((a, b) => a.width - b.width)
  const need = cssWidth * Math.min(PixelRatio.get(), 3)
  return (candidates.find((c) => c.width >= need) ?? candidates[candidates.length - 1]).url
}

// One image component for the whole buyer app (port of components/ui/SmartImage.jsx): fixed aspect
// ratio box, shimmer while loading, fallback image, "No image" placeholder.
// `ratio` is a number (width / height) or a '1 / 1' string like the web version.
// `srcSet` + `displayWidth` (css px the image is shown at) pick the right backend derivative.
export function SmartImage({
  src,
  srcSet,
  displayWidth = 200,
  alt,
  ratio = 1,
  fit = 'contain',
  style,
  fallbackSrc = DEFAULT_PRODUCT_IMAGE,
  priority = false,
}) {
  const [failedSrc, setFailedSrc] = useState(null)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const [loadedSrc, setLoadedSrc] = useState(null)

  const aspectRatio =
    typeof ratio === 'string' ? ratio.split('/').reduce((a, b, i) => (i === 0 ? Number(b) : a / Number(b)), 1) : ratio

  // Responsive derivative when the backend provided one (card thumbnails); canonical `src` otherwise.
  const sizedSrc = src && srcSet ? pickFromSrcSet(srcSet, displayWidth, src) : src
  const primaryFailed = failedSrc === sizedSrc
  const useFallback = !sizedSrc || primaryFailed
  const activeSrc = useFallback ? fallbackSrc : sizedSrc
  const loaded = loadedSrc === activeSrc
  const source = !useFallback || !fallbackFailed ? resolveImageSource(activeSrc) : null

  return (
    <View style={[styles.box, { aspectRatio }, style]} accessibilityLabel={alt || 'Image'}>
      {!loaded && source ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.slate[100] }]} /> : null}
      {source ? (
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, useFallback && { padding: 8 }]}
          contentFit={useFallback ? 'contain' : fit}
          transition={160}
          cachePolicy="memory-disk"
          priority={priority ? 'high' : 'normal'}
          recyclingKey={String(activeSrc)}
          onLoad={() => setLoadedSrc(activeSrc)}
          onError={() => {
            if (!useFallback) setFailedSrc(sizedSrc)
            else setFallbackFailed(true)
          }}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="HiPhoto" size={32} color={colors.slate[300]} />
          <Text style={styles.placeholderText}>NO IMAGE</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: colors.slate[50] },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 4 },
  placeholderText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, color: colors.slate[400] },
})
