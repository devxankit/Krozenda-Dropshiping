// The one theme file. Every token mirrors the web app (frontend/tailwind.config.js + Tailwind
// defaults). Screens reference these tokens; no raw hex outside this folder except where the web
// screen itself used an arbitrary value (text-[#...]).
import { Platform } from 'react-native'
import { palette } from './palette'

export const colors = {
  ...palette,
  // tailwind.config.js `brand` scale (blue)
  brand: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6',
    600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
  },
  surface: { DEFAULT: '#ffffff', muted: '#f8fafc', sunken: '#f1f5f9', inverted: '#0f172a' },
  border: { DEFAULT: '#e2e8f0', subtle: '#f1f5f9', strong: '#cbd5e1' },
  ink: { DEFAULT: '#0f172a', muted: '#475569', subtle: '#64748b', faint: '#94a3b8' },
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  accent: palette.violet,
  // body background / text set in index.css
  background: '#f8fafc',
  text: '#0f172a',
  transparent: 'transparent',
}

// Tailwind spacing scale: n * 4px (0.5 -> 2px).
export const sp = (n) => n * 4

export const radius = {
  none: 0, sm: 4, DEFAULT: 6, md: 8, lg: 12, xl: 16, '2xl': 16, '3xl': 24, full: 9999,
}

// [fontSize, lineHeight] - tailwind.config.js overrides + defaults
export const fontSize = {
  '2xs': [11, 16], xs: [12, 16], sm: [14, 20], base: [16, 24], lg: [18, 28], xl: [20, 28],
  '2xl': [24, 32], '3xl': [30, 36], '4xl': [36, 40], '5xl': [48, 48],
}

export const fonts = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
}

// Resolves a CSS fontWeight to the bundled family (RN cannot synthesise weights for custom fonts).
export function fontFamilyFor(weight) {
  const w = String(weight ?? '400')
  if (w === 'normal') return fonts[400]
  if (w === 'bold') return fonts[700]
  if (w === '300' || w === '200' || w === '100') return fonts[400]
  if (w === '900') return fonts[800]
  return fonts[w] || fonts[400]
}

const shadow = (offsetY, blur, opacity, elevation) =>
  Platform.select({
    android: { elevation },
    default: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: offsetY }, shadowOpacity: opacity, shadowRadius: blur },
  })

// Approximations of the web box-shadows (RN has no multi-layer shadows).
export const shadows = {
  none: {},
  xs: shadow(1, 2, 0.05, 1),
  '2xs': shadow(1, 1, 0.04, 0),
  sm: shadow(1, 3, 0.1, 2),
  card: shadow(1, 3, 0.04, 1),
  raised: shadow(2, 8, 0.08, 2),
  md: shadow(4, 6, 0.1, 4),
  lg: shadow(10, 15, 0.1, 8),
  xl: shadow(20, 25, 0.1, 12),
  '2xl': shadow(25, 50, 0.25, 16),
  overlay: shadow(8, 24, 0.18, 10),
}

export const theme = { colors, sp, radius, fontSize, fonts, shadows }
export default theme
